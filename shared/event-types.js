/**
 * Event Types for communication between worker and web
 */

export const EVENT_TYPES = {
  // Worker → Web
  STATUS_UPDATE: "STATUS_UPDATE",
  PREVIEW_READY: "PREVIEW_READY",
  BUILD_ERROR: "BUILD_ERROR",

  // Web → Worker
  START_BUILD: "START_BUILD",
  STOP_BUILD: "STOP_BUILD",
};
