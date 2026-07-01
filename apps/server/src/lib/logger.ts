// Structured JSON logger via pino.
// Import this everywhere instead of using console.log.

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Pretty-print in development, plain JSON in production
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
