import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log(
    "Removing sessions in 'initializing', 'planning', or 'executing' status..."
  );

  try {
    const result = await prisma.session.deleteMany({
      where: {
        status: {
          in: ["initializing", "planning", "executing"],
        },
      },
    });
    console.log(`Deleted ${result.count} active sessions.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
