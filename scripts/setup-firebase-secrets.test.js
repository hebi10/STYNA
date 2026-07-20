jest.mock('child_process', () => ({
  execSync: jest.fn(),
  execFileSync: jest.fn(),
}));

const { execSync, execFileSync } = require('child_process');
const { setFirebaseSecret } = require('./setup-firebase-secrets');

describe('setup-firebase-secrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('passes the secret name as an argument and the value only through stdin', () => {
    setFirebaseSecret('CHAT_RATE_LIMIT_SALT', 'super-secret-value');

    expect(execFileSync).toHaveBeenCalledWith(
      'firebase',
      ['functions:secrets:set', 'CHAT_RATE_LIMIT_SALT'],
      {
        input: 'super-secret-value',
        stdio: ['pipe', 'inherit', 'inherit'],
      },
    );
    expect(execSync).not.toHaveBeenCalled();
    expect(JSON.stringify(jest.mocked(console.log).mock.calls)).not.toContain('super-secret-value');
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('super-secret-value');
  });
});
