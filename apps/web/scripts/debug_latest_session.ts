import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Debugging Latest Session...");

  const session = await prisma.session.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    console.log("❌ No sessions found.");
    return;
  }

  console.log(`\n📋 Session ID: ${session.id}`);
  console.log(`Status: ${session.status}`);
  console.log(`Preview URL: ${session.previewUrl}`);
  console.log(`Preview Port: ${session.previewPort}`);
  console.log(`Preview Token: ${session.previewToken}`);

  const projectPath = path.join("/tmp", "arlys", session.id);
  console.log(`\n📂 Checking Path: ${projectPath}`);

  try {
    const files = await fs.readdir(projectPath);
    console.log(`Files found (${files.length}):`, files);

    if (files.includes("index.html")) {
      const stats = await fs.stat(path.join(projectPath, "index.html"));
      console.log(`✅ index.html exists (Size: ${stats.size} bytes)`);
    } else {
      console.log("❌ index.html MISSING from disk!");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`❌ Error accessing path: ${message}`);
  }

  console.log("\n📄 Generated Files in DB:");
  const dbFiles = await prisma.generatedFile.findMany({
    where: { sessionId: session.id },
    select: { path: true, language: true },
  });
  dbFiles.forEach((f) => console.log(` - ${f.path} (${f.language})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
