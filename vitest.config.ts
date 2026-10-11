import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/env.ts"],
    // Every suite talks to the same Postgres instance and deletes overlapping course rows, so
    // running files concurrently produced deadlocks and lock timeouts rather than real failures.
    fileParallelism: false,
    maxWorkers: 1,
    // The cascade and earnings queries run against a remote pooler, so the default 5s is too
    // tight and produced spurious timeouts that looked like logic failures.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
