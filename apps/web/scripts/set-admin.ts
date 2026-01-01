import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "ialilham77@gmail.com";
  console.log(`Updating user ${email} to admin...`);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "admin" },
      create: {
        email,
        role: "admin",
        name: "Admin User",
        paymentStatus: "active",
      },
    });
    console.log("Success:", user);
  } catch (error) {
    console.error("Error updating user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
