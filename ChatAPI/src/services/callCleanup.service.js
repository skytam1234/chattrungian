import prisma from '../config/prisma.js';
import socketService from '../socket/services/socket.service.js';
import { SOCKET_EVENTS } from '../socket/events.js';

/**
 * Call Cleanup Service
 * Handles all call state cleanup operations:
 * - Cleanup on user disconnect
 * - Periodic stale call cleanup
 * - User busy state management
 */

const CALL_TIMEOUT_MS = 30000; // 30 seconds - same as frontend timeout
const CALL_GRACE_PERIOD_MS = 60000; // 60 seconds extra grace after expected end

/**
 * Cleanup all stale calls (status: pending/ringing/accepted) that have expired
 * Call is considered stale if:
 * - status is 'pending' or 'ringing' and createdAt > 2 minutes ago
 * - status is 'accepted' and startedAt > 30 minutes ago (extreme case)
 * - expiresAt is set and has passed
 */
export async function cleanupStaleCalls() {
  const now = new Date();
  const pendingThreshold = new Date(now.getTime() - (CALL_TIMEOUT_MS + CALL_GRACE_PERIOD_MS));
  const acceptedThreshold = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes max call

  try {
    // 1. Update stale pending/ringing calls
    const stalePending = await prisma.call.updateMany({
      where: {
        status: { in: ['pending', 'ringing'] },
        OR: [
          { createdAt: { lt: pendingThreshold } },
          { expiresAt: { not: null, lt: now } },
        ],
      },
      data: {
        status: 'missed',
        endedAt: now,
      },
    });

    // 2. Update stale accepted calls (calls that were accepted but never ended)
    const staleAccepted = await prisma.call.updateMany({
      where: {
        status: 'accepted',
        OR: [
          { startedAt: { lt: acceptedThreshold } },
          { expiresAt: { not: null, lt: now } },
        ],
      },
      data: {
        status: 'ended',
        endedAt: now,
        duration: Math.floor((now.getTime() - acceptedThreshold.getTime()) / 1000),
      },
    });

    // 3. Clean up user occupied states for expired calls
    const expiredOccupations = await prisma.user.updateMany({
      where: {
        callOccupiedUntil: { not: null, lt: now },
      },
      data: {
        callOccupiedUntil: null,
      },
    });

    const total = stalePending.count + staleAccepted.count + expiredOccupations.count;

    if (total > 0) {
      console.log(`[CallCleanup] Cleaned: ${stalePending.count} pending/ringing, ${staleAccepted.count} accepted, ${expiredOccupations.count} user occupations`);
    }

    return { stalePending: stalePending.count, staleAccepted: staleAccepted.count, expiredOccupations: expiredOccupations.count };
  } catch (error) {
    console.error('[CallCleanup] Error during cleanup:', error);
    return null;
  }
}

/**
 * Cleanup all calls for a specific user when they disconnect
 * This ensures stale call state doesn't block future calls
 * Also notifies the other party via socket
 */
export async function cleanupUserCalls(userId, io = null) {
  try {
    const now = new Date();
    const socketIO = io || socketService.io;

    // Find active calls involving this user (pending, ringing, or accepted)
    const activeCalls = await prisma.call.findMany({
      where: {
        OR: [
          { callerId: userId, status: { in: ['pending', 'ringing'] } },
          { calleeId: userId, status: { in: ['pending', 'ringing'] } },
          // Also cleanup accepted calls - user disconnected mid-call
          { callerId: userId, status: 'accepted' },
          { calleeId: userId, status: 'accepted' },
        ],
      },
    });

    if (activeCalls.length === 0) {
      // Clear user's occupied state anyway
      await prisma.user.updateMany({
        where: { id: userId, callOccupiedUntil: { not: null } },
        data: { callOccupiedUntil: null },
      });
      return [];
    }

    // Calculate duration for accepted calls
    const updatedCalls = [];
    for (const call of activeCalls) {
      let duration = 0;
      if (call.status === 'accepted' && call.startedAt) {
        duration = Math.floor((now.getTime() - new Date(call.startedAt).getTime()) / 1000);
      }

      // Update call status in DB
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: call.status === 'accepted' ? 'ended' : 'missed',
          endedAt: now,
          duration,
        },
      });

      // Clear occupied state for both parties
      await prisma.user.updateMany({
        where: { id: { in: [call.callerId, call.calleeId] } },
        data: { callOccupiedUntil: null },
      });

      // Notify the OTHER party about call ended
      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
      
      if (socketIO) {
        console.log(`[CallCleanup] Notifying user ${otherUserId} that call ${call.id} ended (${userId} disconnected)`);
        socketIO.to(`user:${otherUserId}`).emit(SOCKET_EVENTS.CALL_ENDED, {
          callId: call.id,
          endedBy: userId,
          reason: 'disconnected',
          message: 'Cuộc gọi kết thúc do người kia mất kết nối',
          duration,
          timestamp: now.toISOString(),
        });
      }

      updatedCalls.push(call);
    }

    console.log(`[CallCleanup] User ${userId} disconnected - cleaned ${updatedCalls.length} active calls`);
    return updatedCalls;
  } catch (error) {
    console.error(`[CallCleanup] Error cleaning user ${userId} calls:`, error);
    return [];
  }
}

/**
 * Release user busy state after call ends
 */
export async function releaseUserOccupation(userId) {
  try {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { callOccupiedUntil: null },
    });
    return true;
  } catch (error) {
    console.error(`[CallCleanup] Error releasing occupation for ${userId}:`, error);
    return false;
  }
}

/**
 * Set user as occupied (busy in a call)
 * occupiedUntil = now + expected max call duration (5 minutes from accept)
 */
export async function setUserOccupied(userId, callId, expiresAt = null) {
  try {
    const occupiedUntil = expiresAt || new Date(Date.now() + 5 * 60 * 1000); // default 5 min
    await prisma.user.updateMany({
      where: { id: userId },
      data: { callOccupiedUntil: occupiedUntil },
    });
    return true;
  } catch (error) {
    console.error(`[CallCleanup] Error setting occupation for ${userId}:`, error);
    return false;
  }
}

/**
 * Check if a user is currently occupied (busy in a call)
 */
export async function isUserOccupied(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { callOccupiedUntil: true },
    });
    if (!user) return false;
    if (!user.callOccupiedUntil) return false;
    return new Date() < user.callOccupiedUntil;
  } catch (error) {
    console.error(`[CallCleanup] Error checking occupation for ${userId}:`, error);
    return false; // Fail open - allow call if check fails
  }
}

/**
 * Start periodic cleanup job
 * Returns the interval ID so it can be stopped on shutdown
 */
let cleanupInterval = null;

export function startPeriodicCleanup(intervalMs = 60000) {
  if (cleanupInterval) {
    console.log('[CallCleanup] Periodic cleanup already running');
    return cleanupInterval;
  }

  console.log(`[CallCleanup] Starting periodic cleanup every ${intervalMs / 1000}s`);
  cleanupInterval = setInterval(async () => {
    await cleanupStaleCalls();
  }, intervalMs);

  return cleanupInterval;
}

export function stopPeriodicCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[CallCleanup] Periodic cleanup stopped');
  }
}

export default {
  cleanupStaleCalls,
  cleanupUserCalls,
  releaseUserOccupation,
  setUserOccupied,
  isUserOccupied,
  startPeriodicCleanup,
  stopPeriodicCleanup,
};
