import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'admin@portalcomexbr.com' },
    update: {},
    create: {
      id: 'mock-user-id',
      email: 'admin@portalcomexbr.com',
      name: 'Admin User',
      password: 'password123', // In real app, this should be hashed
    },
  });
  console.log({ user });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
