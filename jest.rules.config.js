const baseConfig = require('./jest.config');
const firestoreRulesTestPattern = 'functions[\\\\/]__tests__[\\\\/]firestoreRules\\.test\\.ts$';
const storageRulesTestPattern = 'functions[\\\\/]__tests__[\\\\/]storageRules\\.test\\.ts$';

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: baseConfig.testPathIgnorePatterns.filter(
    (path) => path !== firestoreRulesTestPattern && path !== storageRulesTestPattern,
  ),
};
