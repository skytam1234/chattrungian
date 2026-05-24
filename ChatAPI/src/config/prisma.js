import { PrismaClient } from '@prisma/client';

// Create a singleton PrismaClient instance
const globalForPrisma = globalThis;

let prisma;

if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL) {
  // Test environment - create new client with test URL
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'],
  });
} else if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided
  prisma = globalForPrisma.prisma || new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
} else {
  // Default client
  prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

if (process.env.NODE_ENV !== 'test') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
