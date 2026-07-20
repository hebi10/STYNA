#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const FORBIDDEN_OPENAI_REFERENCES = [
  'api.openai.com',
  'OPENAI_API_KEY',
];

function collectJavaScriptFiles(directory) {
  const files = [];
  const pendingDirectories = [directory];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function verifyFunctionsNextChatBoundary(nextDirectory = path.resolve(
  __dirname,
  '..',
  'functions',
  '.next',
)) {
  const resolvedNextDirectory = path.resolve(nextDirectory);
  const serverDirectory = path.join(resolvedNextDirectory, 'server');
  const chatRoutePath = path.join(serverDirectory, 'app', 'api', 'chat', 'route.js');

  if (!fs.existsSync(chatRoutePath)) {
    throw new Error(`Generated Next chat route was not found: ${chatRoutePath}`);
  }

  const offendingFiles = collectJavaScriptFiles(serverDirectory).filter(filePath => {
    const source = fs.readFileSync(filePath, 'utf8');
    return FORBIDDEN_OPENAI_REFERENCES.some(reference => source.includes(reference));
  });

  if (offendingFiles.length > 0) {
    const relativeFiles = offendingFiles
      .map(filePath => path.relative(resolvedNextDirectory, filePath))
      .join(', ');
    throw new Error(
      `Generated Next bundle contains a direct OpenAI reference: ${relativeFiles}`,
    );
  }
}

if (require.main === module) {
  verifyFunctionsNextChatBoundary();
  console.log('Verified generated Next chat provider boundary.');
}

module.exports = { verifyFunctionsNextChatBoundary };
