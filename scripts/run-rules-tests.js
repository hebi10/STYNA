const path = require('path');
const { spawn, spawnSync } = require('child_process');

const RULES_PROJECT_ID = 'demo-hebimall-rules-test';
const FIRESTORE_PORT = 8081;
const FIREBASE_RULES_TEST_COMMAND = [
  'firebase emulators:exec',
  `--project ${RULES_PROJECT_ID}`,
  '--config firebase.rules-test.json',
  '--only firestore,storage',
  '"jest --config jest.rules.config.js --runInBand functions/__tests__/firestoreRules.test.ts functions/__tests__/storageRules.test.ts"',
].join(' ');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCommandLine(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .toLowerCase();
}

function isProjectRulesFirestoreEmulator(commandLine, {
  repositoryRoot = path.resolve(__dirname, '..'),
  projectId = RULES_PROJECT_ID,
  port = FIRESTORE_PORT,
} = {}) {
  const normalized = normalizeCommandLine(commandLine);
  const normalizedRulesPath = normalizeCommandLine(
    path.join(repositoryRoot, 'firestore.rules'),
  );
  const projectPattern = new RegExp(
    `(?:^|\\s)--project_id\\s+${escapeRegExp(projectId.toLowerCase())}(?:\\s|$)`,
  );
  const portPattern = new RegExp(`(?:^|\\s)--port\\s+${port}(?:\\s|$)`);

  return normalized.includes('cloud-firestore-emulator')
    && projectPattern.test(normalized)
    && portPattern.test(normalized)
    && normalized.includes('--rules')
    && normalized.includes(normalizedRulesPath);
}

function runPowerShellJsonQuery(query, {
  spawnCommand = spawnSync,
} = {}) {
  const utf8Query = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);',
    query,
  ].join(' ');
  const result = spawnCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', utf8Query],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Windows 프로세스 조회에 실패했습니다.');
  }

  const output = result.stdout.trim();
  if (!output) {
    return null;
  }

  return JSON.parse(output);
}

function listWindowsProcesses() {
  const query = [
    'Get-CimInstance Win32_Process',
    "Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -like '*cloud-firestore-emulator*' }",
    'Select-Object ProcessId,Name,CommandLine',
    'ConvertTo-Json -Compress',
  ].join(' | ');
  const parsed = runPowerShellJsonQuery(query);

  if (!parsed) {
    return [];
  }

  return Array.isArray(parsed) ? parsed : [parsed];
}

function terminateWindowsProcess(processId) {
  try {
    process.kill(processId);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function cleanupProjectRulesEmulators({
  platform = process.platform,
  repositoryRoot = path.resolve(__dirname, '..'),
  listProcesses = listWindowsProcesses,
  terminateProcess = terminateWindowsProcess,
  wait = delay,
  maxAttempts = 20,
  retryDelayMs = 100,
} = {}) {
  if (platform !== 'win32') {
    return [];
  }

  const findMatchingProcesses = () => listProcesses().filter((candidate) => (
    isProjectRulesFirestoreEmulator(candidate.CommandLine, { repositoryRoot })
  ));
  const matchingProcesses = findMatchingProcesses();
  const processIds = matchingProcesses.map((candidate) => candidate.ProcessId);

  for (const processId of processIds) {
    terminateProcess(processId);
  }

  for (let attempt = 0; attempt < maxAttempts && processIds.length > 0; attempt += 1) {
    const remainingProcessIds = new Set(
      findMatchingProcesses().map((candidate) => candidate.ProcessId),
    );
    const allStopped = processIds.every((processId) => !remainingProcessIds.has(processId));

    if (allStopped) {
      return processIds;
    }

    await wait(retryDelayMs);
  }

  if (processIds.length > 0) {
    throw new Error(
      `Rules Firestore Emulator 프로세스를 종료하지 못했습니다: ${processIds.join(', ')}`,
    );
  }

  return processIds;
}

function signalExitCode(signal) {
  if (signal === 'SIGINT') {
    return 130;
  }

  if (signal === 'SIGTERM') {
    return 143;
  }

  return 1;
}

function waitForChild(child, processRef) {
  return new Promise((resolve, reject) => {
    const cleanupListeners = () => {
      processRef.removeListener('SIGINT', handleSigint);
      processRef.removeListener('SIGTERM', handleSigterm);
    };
    const forwardSignal = (signal) => {
      try {
        child.kill(signal);
      } catch (error) {
        if (error?.code !== 'ESRCH') {
          reject(error);
        }
      }
    };
    const handleSigint = () => forwardSignal('SIGINT');
    const handleSigterm = () => forwardSignal('SIGTERM');

    processRef.on('SIGINT', handleSigint);
    processRef.on('SIGTERM', handleSigterm);

    child.once('error', (error) => {
      cleanupListeners();
      reject(error);
    });
    child.once('close', (code, signal) => {
      cleanupListeners();
      resolve(Number.isInteger(code) ? code : signalExitCode(signal));
    });
  });
}

async function runRulesTests({
  cleanup = cleanupProjectRulesEmulators,
  spawnProcess = spawn,
  processRef = process,
  repositoryRoot = path.resolve(__dirname, '..'),
} = {}) {
  await cleanup({ repositoryRoot });

  try {
    const child = spawnProcess(FIREBASE_RULES_TEST_COMMAND, {
      cwd: repositoryRoot,
      shell: true,
      stdio: 'inherit',
      windowsHide: true,
    });

    return await waitForChild(child, processRef);
  } finally {
    await cleanup({ repositoryRoot });
  }
}

if (require.main === module) {
  runRulesTests()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  cleanupProjectRulesEmulators,
  isProjectRulesFirestoreEmulator,
  runPowerShellJsonQuery,
  runRulesTests,
};
