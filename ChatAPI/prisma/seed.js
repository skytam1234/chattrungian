import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 12);

  const user1 = await prisma.user.upsert({
    where: { email: 'user1@example.com' },
    update: {},
    create: {
      username: 'user1',
      email: 'user1@example.com',
      passwordHash,
      displayName: 'User One',
      isVerified: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'user2@example.com' },
    update: {},
    create: {
      username: 'user2',
      email: 'user2@example.com',
      passwordHash,
      displayName: 'User Two',
      isVerified: true,
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'user3@example.com' },
    update: {},
    create: {
      username: 'user3',
      email: 'user3@example.com',
      passwordHash,
      displayName: 'User Three',
      isVerified: true,
    },
  });

  console.log('Created users:', { user1: user1.id, user2: user2.id, user3: user3.id });

  // Create a direct conversation between user1 and user2
  const directConversation = await prisma.conversation.create({
    data: {
      type: 'direct',
      createdBy: user1.id,
      users: {
        create: [
          { userId: user1.id, role: 'member' },
          { userId: user2.id, role: 'member' },
        ],
      },
    },
    include: {
      users: true,
    },
  });

  console.log('Created direct conversation:', directConversation.id);

  // Create a group conversation
  const groupConversation = await prisma.conversation.create({
    data: {
      type: 'group',
      name: 'Test Group',
      description: 'A test group conversation',
      createdBy: user1.id,
      users: {
        create: [
          { userId: user1.id, role: 'owner' },
          { userId: user2.id, role: 'admin' },
          { userId: user3.id, role: 'member' },
        ],
      },
    },
    include: {
      users: {
        include: { user: true },
      },
    },
  });

  console.log('Created group conversation:', groupConversation.id);

  // Create some test messages
  const message1 = await prisma.message.create({
    data: {
      conversationId: directConversation.id,
      senderId: user1.id,
      content: 'Hello, this is a test message!',
      messageType: 'text',
    },
  });

  const message2 = await prisma.message.create({
    data: {
      conversationId: directConversation.id,
      senderId: user2.id,
      content: 'Hi there! Thanks for the message.',
      messageType: 'text',
    },
  });

  // Update conversation last message
  await prisma.conversation.update({
    where: { id: directConversation.id },
    data: {
      lastMessageId: message2.id,
      lastMessageAt: message2.createdAt,
    },
  });

  console.log('Created test messages:', { message1: message1.id, message2: message2.id });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
