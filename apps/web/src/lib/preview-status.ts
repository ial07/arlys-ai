/**
 * Preview Status Constants
 *
 * LOCKED LIFECYCLE (from shared/preview-status.js):
 * INIT → PREPARING_TEMPLATE → INSTALLING_DEPENDENCIES →
 * STARTING_PREVIEW_SERVER → PREVIEW_READY → COMPLETED
 */

export const PREVIEW_STATUS = {
  INIT: "INIT",
  PREPARING_TEMPLATE: "PREPARING_TEMPLATE",
  INSTALLING_DEPENDENCIES: "INSTALLING_DEPENDENCIES",
  STARTING_PREVIEW_SERVER: "STARTING_PREVIEW_SERVER",
  PREVIEW_READY: "PREVIEW_READY",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type PreviewStatusType =
  (typeof PREVIEW_STATUS)[keyof typeof PREVIEW_STATUS];

export const PREVIEW_STATUS_ORDER: PreviewStatusType[] = [
  "INIT",
  "PREPARING_TEMPLATE",
  "INSTALLING_DEPENDENCIES",
  "STARTING_PREVIEW_SERVER",
  "PREVIEW_READY",
  "COMPLETED",
];

export const PREVIEW_STATUS_LABELS: Record<PreviewStatusType, string> = {
  INIT: "Initializing...",
  PREPARING_TEMPLATE: "Preparing template...",
  INSTALLING_DEPENDENCIES: "Installing dependencies...",
  STARTING_PREVIEW_SERVER: "Starting preview server...",
  PREVIEW_READY: "Preview ready!",
  COMPLETED: "Completed",
  FAILED: "Build failed",
};

export function isTerminalStatus(status: string): boolean {
  return (
    status === PREVIEW_STATUS.COMPLETED || status === PREVIEW_STATUS.FAILED
  );
}

export function getStatusIndex(status: string): number {
  return PREVIEW_STATUS_ORDER.indexOf(status as PreviewStatusType);
}
