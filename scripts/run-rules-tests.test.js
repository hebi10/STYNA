/** @jest-environment node */

const { EventEmitter } = require('events');
const path = require('path');
const {
  cleanupProjectRulesEmulators,
  isProjectRulesFirestoreEmulator,
  runPowerShellJsonQuery,
  runRulesTests,
} = require('./run-rules-tests');

const repositoryRoot = path.resolve(__dirname, '..');
const rulesPath = path.join(repositoryRoot, 'firestore.rules');

function createFirestoreCommand({
  projectId = 'demo-hebimall-rules-test',
  port = 8081,
  configuredRulesPath = rulesPath,
} = {}) {
  return [
    '"C:\\Program Files\\Java\\jdk-21\\bin\\java.exe"',
    '-jar',
    'C:\\Users\\tester\\.cache\\firebase\\emulators\\cloud-firestore-emulator-v1.21.0.jar',
    '--host 127.0.0.1',
    `--port ${port}`,
    `--project_id ${projectId}`,
    `--rules ${configuredRulesPath}`,
  ].join(' ');
}

function createChildProcess() {
  const child = new EventEmitter();
  child.kill = jest.fn();
  return child;
}

describe('Rules Emulator process matching', () => {
  test('matches only this repository Rules Firestore Emulator', () => {
    expect(isProjectRulesFirestoreEmulator(createFirestoreCommand(), {
      repositoryRoot,
    })).toBe(true);

    expect(isProjectRulesFirestoreEmulator(createFirestoreCommand({
      projectId: 'another-project',
    }), {
      repositoryRoot,
    })).toBe(false);

    expect(isProjectRulesFirestoreEmulator(createFirestoreCommand({
      port: 8080,
    }), {
      repositoryRoot,
    })).toBe(false);

    expect(isProjectRulesFirestoreEmulator(createFirestoreCommand({
      configuredRulesPath: path.join(repositoryRoot, 'other.rules'),
    }), {
      repositoryRoot,
    })).toBe(false);

    expect(isProjectRulesFirestoreEmulator(
      '"C:\\Program Files\\Java\\bin\\java.exe" -jar unrelated-service.jar --port 8081',
      { repositoryRoot },
    )).toBe(false);
  });
});

const testOnWindows = process.platform === 'win32' ? test : test.skip;

testOnWindows('preserves a Korean Windows path returned by PowerShell', () => {
  const result = runPowerShellJsonQuery([
    '$koreanName = -join ([char[]](0xBC15, 0xB3C4, 0xC601));',
    "[pscustomobject]@{ ProcessId = 101; Name = 'java.exe';",
    'CommandLine = "C:\\Users\\$koreanName\\Desktop\\portfolio\\firestore.rules" }',
    '| ConvertTo-Json -Compress',
  ].join(' '));

  expect(result.CommandLine).toBe(
    'C:\\Users\\박도영\\Desktop\\portfolio\\firestore.rules',
  );
});

describe('Rules Emulator cleanup', () => {
  test('terminates only matching orphaned Firestore Emulator processes', async () => {
    const matchingCommand = createFirestoreCommand();
    const unrelatedCommand = createFirestoreCommand({ projectId: 'another-project' });
    const processSnapshots = [
      [
        { ProcessId: 101, Name: 'java.exe', CommandLine: matchingCommand },
        { ProcessId: 202, Name: 'java.exe', CommandLine: unrelatedCommand },
      ],
      [
        { ProcessId: 202, Name: 'java.exe', CommandLine: unrelatedCommand },
      ],
    ];
    const listProcesses = jest.fn()
      .mockImplementation(() => processSnapshots.shift() ?? processSnapshots.at(-1));
    const terminateProcess = jest.fn();

    const terminated = await cleanupProjectRulesEmulators({
      platform: 'win32',
      repositoryRoot,
      listProcesses,
      terminateProcess,
      wait: async () => {},
    });

    expect(terminated).toEqual([101]);
    expect(terminateProcess).toHaveBeenCalledTimes(1);
    expect(terminateProcess).toHaveBeenCalledWith(101);
  });

  test('does not inspect or terminate processes outside Windows', async () => {
    const listProcesses = jest.fn();
    const terminateProcess = jest.fn();

    const terminated = await cleanupProjectRulesEmulators({
      platform: 'linux',
      repositoryRoot,
      listProcesses,
      terminateProcess,
    });

    expect(terminated).toEqual([]);
    expect(listProcesses).not.toHaveBeenCalled();
    expect(terminateProcess).not.toHaveBeenCalled();
  });
});

describe('Rules test lifecycle', () => {
  test('cleans before and after the command while preserving its exit code', async () => {
    const child = createChildProcess();
    const cleanup = jest.fn().mockResolvedValue([]);
    const spawnProcess = jest.fn(() => {
      process.nextTick(() => child.emit('close', 7, null));
      return child;
    });

    const exitCode = await runRulesTests({
      cleanup,
      spawnProcess,
      processRef: new EventEmitter(),
      repositoryRoot,
    });

    expect(exitCode).toBe(7);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test('still cleans when the Firebase command cannot start', async () => {
    const child = createChildProcess();
    const cleanup = jest.fn().mockResolvedValue([]);
    const spawnProcess = jest.fn(() => {
      process.nextTick(() => child.emit('error', new Error('spawn failed')));
      return child;
    });

    await expect(runRulesTests({
      cleanup,
      spawnProcess,
      processRef: new EventEmitter(),
      repositoryRoot,
    })).rejects.toThrow('spawn failed');

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test('forwards interruption signals to Firebase and returns the signal exit code', async () => {
    const child = createChildProcess();
    const cleanup = jest.fn().mockResolvedValue([]);
    const processRef = new EventEmitter();
    const spawnProcess = jest.fn(() => child);

    const resultPromise = runRulesTests({
      cleanup,
      spawnProcess,
      processRef,
      repositoryRoot,
    });

    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    processRef.emit('SIGINT');
    child.emit('close', null, 'SIGINT');

    await expect(resultPromise).resolves.toBe(130);
    expect(child.kill).toHaveBeenCalledWith('SIGINT');
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(processRef.listenerCount('SIGINT')).toBe(0);
    expect(processRef.listenerCount('SIGTERM')).toBe(0);
  });
});
