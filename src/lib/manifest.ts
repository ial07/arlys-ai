/**
 * Manifest Types
 *
 * Defines the file manifest structure for tracking generation progress.
 */

export interface ManifestFile {
  path: string;
  phase: number; // 1=foundation, 2=types, 3=database, 4=api, 5=ui
  status: "pending" | "generated" | "failed";
  required: boolean;
  retryCount: number;
}

export interface FileManifest {
  totalFiles: number;
  generatedFiles: number;
  files: ManifestFile[];
}

export const PHASE_NAMES: Record<number, string> = {
  0: "manifest",
  1: "foundation",
  2: "types",
  3: "database",
  4: "api",
  5: "ui",
  6: "validation",
};

/**
 * Get phase number from file path
 */
export function getPhaseForPath(path: string): number {
  const lowerPath = path.toLowerCase();

  // Phase 1: Foundation
  if (
    lowerPath === "package.json" ||
    lowerPath === "tsconfig.json" ||
    lowerPath.includes("config") ||
    lowerPath === "readme.md" ||
    lowerPath.includes(".env")
  ) {
    return 1;
  }

  // Phase 2: Types
  if (
    lowerPath.includes("/types/") ||
    lowerPath.includes(".d.ts") ||
    lowerPath.includes("interface")
  ) {
    return 2;
  }

  // Phase 3: Database
  if (
    lowerPath.includes("prisma") ||
    lowerPath.includes("schema") ||
    lowerPath.includes("/db/")
  ) {
    return 3;
  }

  // Phase 4: API
  if (
    lowerPath.includes("/api/") ||
    lowerPath.includes("route.ts") ||
    lowerPath.includes("/services/") ||
    lowerPath.includes("/lib/")
  ) {
    return 4;
  }

  // Phase 5: UI
  if (
    lowerPath.includes("/components/") ||
    lowerPath.includes("/app/") ||
    lowerPath.includes("page.tsx") ||
    lowerPath.includes("layout.tsx") ||
    lowerPath.endsWith(".css")
  ) {
    return 5;
  }

  return 5; // Default to UI phase
}

/**
 * Create an empty manifest
 */
export function createEmptyManifest(): FileManifest {
  return {
    totalFiles: 0,
    generatedFiles: 0,
    files: [],
  };
}

/**
 * Update manifest file status
 */
export function updateManifestFileStatus(
  manifest: FileManifest,
  path: string,
  status: "pending" | "generated" | "failed"
): FileManifest {
  const updated = { ...manifest };
  const file = updated.files.find((f) => f.path === path);

  if (file) {
    const wasGenerated = file.status === "generated";
    file.status = status;

    if (status === "generated" && !wasGenerated) {
      updated.generatedFiles++;
    } else if (status !== "generated" && wasGenerated) {
      updated.generatedFiles--;
    }

    if (status === "failed") {
      file.retryCount++;
    }
  }

  return updated;
}

/**
 * Get missing required files from manifest
 */
export function getMissingRequiredFiles(
  manifest: FileManifest
): ManifestFile[] {
  return manifest.files.filter(
    (f) => f.required && f.status !== "generated" && f.retryCount < 3
  );
}

/**
 * Check if manifest is complete
 */
export function isManifestComplete(manifest: FileManifest): boolean {
  const missingRequired = manifest.files.filter(
    (f) => f.required && f.status !== "generated"
  );
  return missingRequired.length === 0;
}

/**
 * Get files for a specific phase
 */
export function getFilesForPhase(
  manifest: FileManifest,
  phase: number
): ManifestFile[] {
  return manifest.files.filter((f) => f.phase === phase);
}

/**
 * Check if phase is complete
 */
export function isPhaseComplete(
  manifest: FileManifest,
  phase: number
): boolean {
  const phaseFiles = getFilesForPhase(manifest, phase);
  return phaseFiles.every(
    (f) => f.status === "generated" || (!f.required && f.retryCount >= 3)
  );
}
