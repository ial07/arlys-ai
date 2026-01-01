import { previewService } from "../src/services/preview.service";
import fs from "fs/promises";
import path from "path";
import prisma from "../src/lib/prisma";

async function main() {
  const sessionId = "test-static-bug-" + Date.now().toString().slice(-6);
  const projectPath = path.join("/tmp", "arlys", sessionId);

  console.log(`\n1. Setting up project at ${projectPath}`);
  await fs.mkdir(projectPath, { recursive: true });
  await fs.writeFile(
    path.join(projectPath, "index.html"),
    "<h1>Static Content</h1>"
  );

  // Create dummy session
  await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: { email: "test@example.com" },
  });

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      goal: "Reproduction Test",
      status: "completed",
      userEmail: "test@example.com",
    },
  });
  console.log(`Created session ${session.id}`);

  console.log("\n2. Starting Preview (should detect static mode)");
  const result = await previewService.startPreview(sessionId, projectPath);
  console.log("Start Result:", result);

  console.log("\n3. Checking Preview Info");
  const info = previewService.getPreviewInfo(sessionId);
  console.log(
    "Preview Info object:",
    info ? JSON.stringify(info, null, 2) : "null"
  );

  console.log("\n4. Simulating route.ts Logic");
  // route.ts logic:
  // const info = previewService.getPreviewInfo(sessionId);
  // if (!info) { ... static fallback ... }
  // else { ... proxy ... }

  if (!info) {
    console.log("✅ route.ts condition (!info) is TRUE. ");
    console.log("   -> Would execute Static Mode Fallback.");
    console.log("   -> SUCCESS.");
  } else {
    console.log("❌ route.ts condition (!info) is FALSE.");
    console.log(
      `   -> Will attempt to proxy request to http://localhost:${info.port}`
    );

    if (info.port === 0) {
      console.log("   -> Port is 0. Proxy request will FAIL (ECONNREFUSED).");
      console.log("   -> FAILURE DETECTED.");
      process.exit(1);
    } else {
      console.log("   -> Port is non-zero. Why did it skip static mode?");
    }
  }

  // Cleanup
  await fs.rm(projectPath, { recursive: true, force: true });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
