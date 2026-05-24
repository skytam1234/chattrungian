import prisma from '../../config/prisma.js';
import socketService from '../services/socket.service.js';
import { SOCKET_EVENTS } from '../events.js';
import { isUserOccupied, setUserOccupied, releaseUserOccupation } from '../../services/callCleanup.service.js';

// Store for call timers
const callTimers = new Map();

/**
 * Clear call timer
 */
const clearCallTimer = (callId) => {
  if (callTimers.has(callId)) {
    clearTimeout(callTimers.get(callId));
    callTimers.delete(callId);
  }
};

/**
 * Call Handler - Handle all call-related socket events
 */
class CallHandler {
  /**
   * Handle call initiation
   */
  async handleCallInitiate(socket, data) {
    try {
      const { conversationId, calleeId, type } = data;
      const callerId = socket.userId;

      console.log(`📞 [CALL] handleCallInitiate: A (${callerId}) calling B (${calleeId}), conv=${conversationId}, type=${type}`);

      if (!conversationId || !calleeId || !type) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing required fields' });
        return;
      }

      if (!['audio', 'video'].includes(type)) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Invalid call type' });
        return;
      }

      // Verify caller is a participant
      const participant = await prisma.conversationUser.findFirst({
        where: { conversationId, userId: callerId },
      });

      if (!participant) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Not a participant of this conversation' });
        return;
      }

      // Verify callee is a participant
      const calleeParticipant = await prisma.conversationUser.findFirst({
        where: { conversationId, userId: calleeId },
      });

      if (!calleeParticipant) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Callee is not a participant of this conversation' });
        return;
      }

      // Layer 4: Check if caller is already in a call (caller-level busy check)
      const callerBusy = await isUserOccupied(callerId);
      if (callerBusy) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Bạn đang trong một cuộc gọi khác. Vui lòng kết thúc cuộc gọi hiện tại trước.' });
        return;
      }

      // Layer 5: Check if callee is already in a call (user-level busy check)
      const calleeBusy = await isUserOccupied(calleeId);
      if (calleeBusy) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Người dùng đang trong một cuộc gọi khác. Vui lòng thử lại sau.' });
        return;
      }

      // CRITICAL: Check if callee is online BEFORE creating call
      const calleeOnline = socketService.isUserOnline(calleeId);
      
      if (!calleeOnline) {
        console.log(`📞 [CALL] handleCallInitiate: B (${calleeId}) IS OFFLINE -> rejecting call`);
        // Return error immediately - do NOT create call record
        socket.emit(SOCKET_EVENTS.CALL_REJECTED, {
          calleeId,
          reason: 'offline',
          message: 'Người dùng hiện không liên lạc được',
        });
        return;
      }

      // Check if there's an active call in this conversation (with valid occupation)
      const activeCall = await prisma.call.findFirst({
        where: {
          conversationId,
          status: { in: ['pending', 'ringing', 'accepted'] },
        },
        include: {
          caller: { select: { callOccupiedUntil: true } },
          callee: { select: { callOccupiedUntil: true } },
        },
      });

      // If there's an active call, verify the occupation is still valid
      if (activeCall) {
        const now = new Date();
        const callerOccupied = activeCall.caller.callOccupiedUntil && new Date(activeCall.caller.callOccupiedUntil) > now;
        const calleeOccupied = activeCall.callee.callOccupiedUntil && new Date(activeCall.callee.callOccupiedUntil) > now;
        
        // Only block if at least one party is still occupied
        if (callerOccupied || calleeOccupied) {
          socket.emit(SOCKET_EVENTS.ERROR, { error: 'There is already an active call in this conversation' });
          return;
        }
        
        // If neither party is occupied but call record exists, it means stale data - cleanup
        console.log(`📞 [CALL] handleCallInitiate: Found stale call record ${activeCall.id}, cleaning up...`);
        await prisma.call.update({
          where: { id: activeCall.id },
          data: { status: 'ended', endedAt: now },
        });
      }

      // Get caller info
      const caller = await prisma.user.findUnique({
        where: { id: callerId },
        select: { id: true, displayName: true, avatarUrl: true },
      });

      // Create call record with TTL (only after verifying callee is online)
      const expiresAt = new Date(Date.now() + 120000); // 2 minutes from now
      const call = await prisma.call.create({
        data: {
          conversationId,
          callerId,
          calleeId,
          type,
          status: 'pending',
          expiresAt,
        },
      });

      // Join caller to call room
      socket.join(`call:${call.id}`);

      // Send incoming call to callee (callee is guaranteed online at this point)
      // DEBUG: log who is in the callee's room
      const socketsInCalleeRoom = socketService.getSocketsInRoom(`user:${calleeId}`);
      console.log(`📞 [CALL] handleCallInitiate: sockets in room 'user:${calleeId}': count=${socketsInCalleeRoom.length}, ids=${JSON.stringify(socketsInCalleeRoom)}`);
      console.log(`📞 [CALL] handleCallInitiate: calling socket.to('user:${calleeId}').emit('incoming_call', ...) now...`);
      socket.to(`user:${calleeId}`).emit(SOCKET_EVENTS.INCOMING_CALL, {
        callId: call.id,
        conversationId,
        caller: {
          id: caller.id,
          displayName: caller.displayName,
          avatarUrl: caller.avatarUrl,
        },
        type,
        timestamp: new Date().toISOString(),
      });
      console.log(`📞 [CALL] handleCallInitiate: emit('incoming_call') sent to room user:${calleeId} successfully`);

      // Update call status to ringing
      await prisma.call.update({
        where: { id: call.id },
        data: { status: 'ringing' },
      });

      // Set timeout - if no response in 30 seconds, notify caller
      const timer = setTimeout(async () => {
        try {
          const currentCall = await prisma.call.findUnique({
            where: { id: call.id },
          });

          if (currentCall && ['pending', 'ringing'].includes(currentCall.status)) {
            // Update call status to missed
            await prisma.call.update({
              where: { id: call.id },
              data: { status: 'missed', endedAt: new Date(), expiresAt: null },
            });

            // Release caller occupation
            await releaseUserOccupation(callerId);

            // Notify caller - no answer
            socket.emit(SOCKET_EVENTS.CALL_NO_ANSWER, {
              callId: call.id,
              conversationId,
              calleeId,
              timestamp: new Date().toISOString(),
            });

            // Notify callee that call was cancelled
            socket.to(`user:${calleeId}`).emit(SOCKET_EVENTS.CALL_CANCELLED, {
              callId: call.id,
              conversationId,
              timestamp: new Date().toISOString(),
            });

            clearCallTimer(call.id);
          }
        } catch (error) {
          console.error('Error in call timeout handler:', error);
        }
      }, 30000); // 30 seconds timeout

      callTimers.set(call.id, timer);

      // Confirm to caller - callee is ringing
      socket.emit(SOCKET_EVENTS.CALL_RINGING, {
        callId: call.id,
        conversationId,
        calleeId,
        type,
        calleeOnline: true,
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to initiate call' });
    }
  }

  /**
   * Handle call acceptance
   */
  async handleCallAccept(socket, data) {
    try {
      const { callId } = data;
      const userId = socket.userId;

      console.log(`📞 [CALL] handleCallAccept: B (${userId}) accepting call ${callId}`);

      if (!callId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing call ID' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        console.log(`📞 [CALL] handleCallAccept: call ${callId} NOT FOUND`);
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      console.log(`📞 [CALL] handleCallAccept: found call, status=${call.status}, caller=${call.callerId}, callee=${call.calleeId}`);

      if (call.calleeId !== userId) {
        console.log(`📞 [CALL] handleCallAccept: user ${userId} is NOT callee (callee is ${call.calleeId})`);
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'You are not the callee of this call' });
        return;
      }

      if (!['pending', 'ringing'].includes(call.status)) {
        console.log(`📞 [CALL] handleCallAccept: call status is ${call.status}, not active`);
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call is no longer active' });
        return;
      }

      // Clear timeout timer
      clearCallTimer(callId);

      // Update call status
      console.log(`📞 [CALL] handleCallAccept: updating call to 'accepted'`);
      const updatedCall = await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'accepted',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min TTL after accept
        },
      });

      // Set user occupation (both parties are now busy)
      console.log(`📞 [CALL] handleCallAccept: setting user occupation for both parties`);
      await setUserOccupied(call.calleeId, callId);
      await setUserOccupied(call.callerId, callId);

      // Join callee to call room
      socket.join(`call:${callId}`);

      // Notify caller
      console.log(`📞 [CALL] handleCallAccept: emitting CALL_ACCEPTED to A (${call.callerId})`);
      socket.to(`user:${call.callerId}`).emit(SOCKET_EVENTS.CALL_ACCEPTED, {
        callId,
        acceptedBy: userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to accept call' });
    }
  }

  /**
   * Handle call decline
   */
  async handleCallDecline(socket, data) {
    try {
      const { callId } = data;
      const userId = socket.userId;

      if (!callId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing call ID' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      if (call.calleeId !== userId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'You are not the callee of this call' });
        return;
      }

      if (!['pending', 'ringing'].includes(call.status)) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call is no longer active' });
        return;
      }

      // Clear timeout timer
      clearCallTimer(callId);

      // Update call status
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'declined',
          endedAt: new Date(),
          expiresAt: null,
        },
      });

      // Release caller occupation
      await releaseUserOccupation(call.callerId);

      // Notify caller
      socket.to(`user:${call.callerId}`).emit(SOCKET_EVENTS.CALL_DECLINED, {
        callId,
        declinedBy: userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error declining call:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to decline call' });
    }
  }

  /**
   * Handle call end
   */
  async handleCallEnd(socket, data) {
    try {
      const { callId } = data;
      const userId = socket.userId;

      if (!callId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing call ID' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      if (call.callerId !== userId && call.calleeId !== userId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'You are not a participant of this call' });
        return;
      }

      if (!['pending', 'ringing', 'accepted'].includes(call.status)) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call is no longer active' });
        return;
      }

      // Clear timeout timer
      clearCallTimer(callId);

      // Calculate duration if call was accepted
      let duration = 0;
      if (call.startedAt) {
        duration = Math.floor((new Date() - new Date(call.startedAt)) / 1000);
      }

      // Update call status
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'ended',
          endedAt: new Date(),
          duration,
          expiresAt: null,
        },
      });

      // Release both parties' occupation
      await releaseUserOccupation(call.callerId);
      await releaseUserOccupation(call.calleeId);

      // Get other participant's socket
      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;

      // Notify callee (even if not in call room yet - user might be in ringing state)
      socket.to(`user:${otherUserId}`).emit(SOCKET_EVENTS.CALL_ENDED, {
        callId,
        endedBy: userId,
        duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error ending call:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to end call' });
    }
  }

  /**
   * Handle missed call (when callee doesn't respond)
   */
  async handleCallMissed(socket, data) {
    try {
      const { callId } = data;
      const userId = socket.userId;

      if (!callId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing call ID' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      if (call.callerId !== userId) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'You are not the caller of this call' });
        return;
      }

      if (!['pending', 'ringing'].includes(call.status)) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call is no longer active' });
        return;
      }

      // Clear timeout timer
      clearCallTimer(callId);

      // Update call status
      await prisma.call.update({
        where: { id: callId },
        data: {
          status: 'missed',
          endedAt: new Date(),
          expiresAt: null,
        },
      });

      // Release caller occupation
      await releaseUserOccupation(call.callerId);

      // Notify callee
      socket.to(`user:${call.calleeId}`).emit(SOCKET_EVENTS.CALL_MISSED_NOTIFY, {
        callId,
        callerId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error marking call as missed:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to mark call as missed' });
    }
  }

  /**
   * Handle WebRTC offer
   */
  async handleCallOffer(socket, data) {
    try {
      const { callId, offer } = data;
      const senderId = socket.userId;

      if (!callId || !offer) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing required fields' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      if (call.status !== 'accepted') {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call must be accepted before exchanging offers' });
        return;
      }

      // Forward offer to callee
      socket.to(`call:${callId}`).emit(SOCKET_EVENTS.CALL_OFFER_RECEIVED, {
        callId,
        offer,
        from: senderId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling call offer:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to forward offer' });
    }
  }

  /**
   * Handle WebRTC answer
   */
  async handleCallAnswer(socket, data) {
    try {
      const { callId, answer } = data;
      const senderId = socket.userId;

      if (!callId || !answer) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing required fields' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      if (call.status !== 'accepted') {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call must be accepted before exchanging answers' });
        return;
      }

      // Forward answer to caller
      socket.to(`call:${callId}`).emit(SOCKET_EVENTS.CALL_ANSWER_RECEIVED, {
        callId,
        answer,
        from: senderId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling call answer:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to forward answer' });
    }
  }

  /**
   * Handle ICE candidate
   */
  async handleCallIceCandidate(socket, data) {
    try {
      const { callId, candidate } = data;
      const senderId = socket.userId;

      if (!callId || !candidate) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Missing required fields' });
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (!call) {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call not found' });
        return;
      }

      if (call.status !== 'accepted') {
        socket.emit(SOCKET_EVENTS.ERROR, { error: 'Call must be accepted before exchanging ICE candidates' });
        return;
      }

      // Forward ICE candidate to other participants
      socket.to(`call:${callId}`).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE_RECEIVED, {
        callId,
        candidate,
        from: senderId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { error: 'Failed to forward ICE candidate' });
    }
  }
}

export default new CallHandler();
