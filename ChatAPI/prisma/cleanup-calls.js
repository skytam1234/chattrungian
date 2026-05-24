/**
 * Manual Database Cleanup Script
 * Cleans up stale call records that may block future calls
 * Run this: node prisma/cleanup-calls.js
 * 
 * Or via npm script: npm run cleanup:calls
 */

import 'dotenv/config';
import prisma from '../src/config/prisma.js';

const CALL_TIMEOUT_MS = 30000;
const CALL_GRACE_PERIOD_MS = 60000;
const MAX_CALL_DURATION_MS = 30 * 60 * 1000; // 30 minutes

async function cleanupStaleCalls() {
  console.log('🧹 Starting database cleanup for stale calls...\n');

  const now = new Date();
  const pendingThreshold = new Date(now.getTime() - (CALL_TIMEOUT_MS + CALL_GRACE_PERIOD_MS));
  const acceptedThreshold = new Date(now.getTime() - MAX_CALL_DURATION_MS);

  let totalCleaned = 0;

  try {
    // 1. Find stale pending/ringing calls
    const stalePending = await prisma.call.findMany({
      where: {
        status: { in: ['pending', 'ringing'] },
        createdAt: { lt: pendingThreshold },
      },
    });

    if (stalePending.length > 0) {
      console.log(`📞 Found ${stalePending.length} stale pending/ringing calls:`);
      stalePending.forEach((call) => {
        const age = Math.floor((now - new Date(call.createdAt)) / 1000);
        console.log(`   - Call ${call.id}: ${call.status} (created ${age}s ago, caller=${call.callerId}, callee=${call.calleeId})`);
      });

      await prisma.call.updateMany({
        where: {
          id: { in: stalePending.map((c) => c.id) },
        },
        data: {
          status: 'missed',
          endedAt: now,
          expiresAt: null,
        },
      });
      totalCleaned += stalePending.length;
      console.log(`   ✅ Updated ${stalePending.length} calls to 'missed'\n`);
    } else {
      console.log('✅ No stale pending/ringing calls found\n');
    }

    // 2. Find stale accepted calls (accepted but never ended for too long)
    const staleAccepted = await prisma.call.findMany({
      where: {
        status: 'accepted',
        startedAt: { lt: acceptedThreshold },
      },
    });

    if (staleAccepted.length > 0) {
      console.log(`📞 Found ${staleAccepted.length} stale accepted calls (hung calls):`);
      staleAccepted.forEach((call) => {
        const age = Math.floor((now - new Date(call.startedAt)) / 1000 / 60);
        console.log(`   - Call ${call.id}: accepted ${age} min ago (caller=${call.callerId}, callee=${call.calleeId})`);
      });

      await prisma.call.updateMany({
        where: {
          id: { in: staleAccepted.map((c) => c.id) },
        },
        data: {
          status: 'ended',
          endedAt: now,
          expiresAt: null,
        },
      });
      totalCleaned += staleAccepted.length;
      console.log(`   ✅ Updated ${staleAccepted.length} calls to 'ended'\n`);
    } else {
      console.log('✅ No stale accepted calls found\n');
    }

    // 3. Clean expired user occupations
    const expiredUsers = await prisma.user.findMany({
      where: {
        callOccupiedUntil: { not: null, lt: now },
      },
      select: { id: true, callOccupiedUntil: true },
    });

    if (expiredUsers.length > 0) {
      console.log(`👤 Found ${expiredUsers.length} users with expired call occupation:`);
      expiredUsers.forEach((user) => {
        console.log(`   - User ${user.id}: occupied until ${user.callOccupiedUntil}`);
      });

      await prisma.user.updateMany({
        where: {
          id: { in: expiredUsers.map((u) => u.id) },
        },
        data: { callOccupiedUntil: null },
      });
      console.log(`   ✅ Cleared occupation for ${expiredUsers.length} users\n`);
    } else {
      console.log('✅ No expired user occupations found\n');
    }

    // 4. Summary
    console.log('═══════════════════════════════════════');
    if (totalCleaned > 0) {
      console.log(`🎉 Cleanup complete! Total records cleaned: ${totalCleaned}`);
    } else {
      console.log('🎉 Cleanup complete! Database is clean.');
    }

    // 5. Show current active calls for reference
    const activeCalls = await prisma.call.findMany({
      where: {
        status: { in: ['pending', 'ringing', 'accepted'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (activeCalls.length > 0) {
      console.log(`\n📋 Current active calls (${activeCalls.length}):`);
      activeCalls.forEach((call) => {
        const age = Math.floor((now - new Date(call.createdAt)) / 1000);
        const expires = call.expiresAt ? `expires in ${Math.max(0, Math.floor((new Date(call.expiresAt) - now) / 1000))}s` : 'no TTL';
        console.log(`   - ${call.id}: ${call.status} (${age}s old, ${expires})`);
      });
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
cleanupStaleCalls().catch(console.error);
