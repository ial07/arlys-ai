import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: "ialilham77@gmail.com" },
    data: { tosAcceptedAt: new Date() } as any,
  });
  console.log("ToS accepted for:", user.email);
  await prisma.$disconnect();
}

main();
