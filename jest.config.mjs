import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1", "^@content/(.*)$": "<rootDir>/content/$1" },
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  // Floor set at the 2026-10-28 level (statements 80.2, branches 70.9, functions 74.5, lines 83.2).
  // Raise it when coverage rises; never lower it to make a change pass.
  coverageThreshold: { global: { statements: 80, branches: 70, functions: 74, lines: 83 } },
};

export default createJestConfig(config);
