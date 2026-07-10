const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: baseConfig.testPathIgnorePatterns.filter(
    (path) => path !== '<rootDir>/functions/__tests__/firestoreRules.test.ts',
  ),
};
