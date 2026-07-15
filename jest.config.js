/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",

  preset: "ts-jest",

  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
        module: "commonjs",
      },
    }],
  },

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/.worktrees/",
    "functions[\\\\/]__tests__[\\\\/]firestoreRules\\.test\\.ts$",
  ],
};
