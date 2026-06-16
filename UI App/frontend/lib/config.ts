/** Shared client/runtime config. Reads public env with safe fallbacks. */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Diagram Studio";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** ws:// base derived from API_URL. */
export const WS_URL = API_URL.replace(/^http/, "ws");
