import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

// Load environment variables manually since we are running standalone
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  console.log("Testing DB Status...");
  console.log("URL:", process.env.DATABASE_URL?.replace(/:[^:]*@/, ":****@")); // Log masked URL

  try {
    // Try simple query
    const start = Date.now();
    const count = await prisma.user.count();
    const duration = Date.now() - start;

    console.log(`✅ Connection Success! Found ${count} users.`);
    console.log(`⏱️ Query time: ${duration}ms`);

    // Test write if needed? No, read is enough for connectivity
  } catch (e: any) {
    console.error("❌ Connection Failed:", e.message);
    console.error("Full Error:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
