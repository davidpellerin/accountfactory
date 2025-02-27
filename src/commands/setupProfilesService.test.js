import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { STSClient } from '@aws-sdk/client-sts';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createTestLogger } from '../utils/testLogger.js';
import { DEFAULT_REGION } from '../constants.js';

const stsClientMock = mockClient(STSClient);
const secretsManagerClientMock = mockClient(SecretsManagerClient);
let testLogger;

// Create a mock for child_process.exec
const mockExec = jest.fn();

// Mock the child_process module
jest.unstable_mockModule('child_process', () => ({
  exec: mockExec,
}));

describe('SetupProfilesService', () => {
  beforeEach(() => {
    stsClientMock.reset();
    secretsManagerClientMock.reset();
    testLogger = createTestLogger();

    // Reset the exec mock
    mockExec.mockClear();
    mockExec.mockImplementation((command, callback) => {
      callback(null, 'success', '');
    });
  });

  describe('constructor', () => {
    test('should throw error when STSClient is not provided', async () => {
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      expect(() => new SetupProfilesService(null, secretsManagerClientMock)).toThrow(
        'STSClient is required'
      );
    });

    test('should throw error when SecretsManagerClient is not provided', async () => {
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      expect(() => new SetupProfilesService(stsClientMock, null)).toThrow(
        'SecretsManagerClient is required'
      );
    });

    test('should create instance when all dependencies are provided', async () => {
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      expect(
        () => new SetupProfilesService(stsClientMock, secretsManagerClientMock, testLogger)
      ).not.toThrow();
    });
  });

  describe('setupAwsProfile', () => {
    const testAccountConfig = {
      email: 'test@example.com',
      profileName: 'test-profile',
    };

    const testLiveAccountList = [
      {
        Id: '123456789012',
        Name: 'Test Account',
        Email: 'test@example.com',
        Status: 'ACTIVE',
      },
    ];

    const testOptions = {
      username: 'testuser',
    };

    const testCredentials = {
      username: 'testuser',
      password: 'testpassword',
      access_key_id: 'AKIATEST12345',
      secret_access_key: 'secretkey12345',
      account_id: '123456789012',
      console_url: 'https://123456789012.signin.aws.amazon.com/console',
    };

    test('should throw error when account not found in live account list', async () => {
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      const service = new SetupProfilesService(stsClientMock, secretsManagerClientMock, testLogger);

      await expect(
        service.setupAwsProfile(
          { ...testAccountConfig, email: 'nonexistent@example.com' },
          testLiveAccountList,
          testOptions
        )
      ).rejects.toThrow(
        'Could not find AWS Organizations account with email nonexistent@example.com'
      );
    });

    test('should throw error when credentials not found in Secrets Manager', async () => {
      // Create a service with a mocked secretsManagerService
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      const service = new SetupProfilesService(stsClientMock, secretsManagerClientMock, testLogger);

      // Replace the secretsManagerService with a mock implementation
      service.secretsManagerService = {
        getExistingCredentials: jest.fn().mockResolvedValue(null),
      };

      // Call the method and expect it to throw
      await expect(
        service.setupAwsProfile(testAccountConfig, testLiveAccountList, testOptions)
      ).rejects.toThrow(/No credentials found for user testuser in account 123456789012/);
    });

    test('should configure AWS profile successfully when credentials exist', async () => {
      // Create a service with a mocked secretsManagerService
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      const service = new SetupProfilesService(stsClientMock, secretsManagerClientMock, testLogger);

      // Replace the secretsManagerService with a mock implementation
      const mockGetExistingCredentials = jest.fn().mockResolvedValue(testCredentials);
      service.secretsManagerService = {
        getExistingCredentials: mockGetExistingCredentials,
      };

      // Call the method
      await service.setupAwsProfile(testAccountConfig, testLiveAccountList, testOptions);

      // Verify getExistingCredentials was called with correct parameters
      expect(mockGetExistingCredentials).toHaveBeenCalledWith('123456789012', 'testuser');

      // Verify exec was called 4 times with the correct AWS configure commands
      expect(mockExec).toHaveBeenCalledTimes(4);
      expect(mockExec).toHaveBeenCalledWith(
        `aws configure set aws_access_key_id ${testCredentials.access_key_id} --profile ${testAccountConfig.profileName}`,
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        `aws configure set aws_secret_access_key ${testCredentials.secret_access_key} --profile ${testAccountConfig.profileName}`,
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        `aws configure set region ${DEFAULT_REGION} --profile ${testAccountConfig.profileName}`,
        expect.any(Function)
      );
      expect(mockExec).toHaveBeenCalledWith(
        `aws configure set output json --profile ${testAccountConfig.profileName}`,
        expect.any(Function)
      );

      // Verify success log message
      const logs = testLogger.getLogEntries();
      const successLog = logs.find(
        log =>
          log.level === 'success' &&
          log.message.includes(
            `Successfully configured AWS profile '${testAccountConfig.profileName}'`
          )
      );
      expect(successLog).toBeTruthy();
    });

    test('should throw error when AWS configure command fails', async () => {
      // Create a service with a mocked secretsManagerService
      const { SetupProfilesService } = await import('./setupProfilesService.js');
      const service = new SetupProfilesService(stsClientMock, secretsManagerClientMock, testLogger);

      // Replace the secretsManagerService with a mock implementation
      service.secretsManagerService = {
        getExistingCredentials: jest.fn().mockResolvedValue(testCredentials),
      };

      // Mock exec to fail on the second call
      mockExec
        .mockImplementationOnce((command, callback) => {
          callback(null, 'success', '');
        })
        .mockImplementationOnce((command, callback) => {
          callback(new Error('Command failed'), '', 'stderr output');
        });

      // Call the method and expect it to throw
      await expect(
        service.setupAwsProfile(testAccountConfig, testLiveAccountList, testOptions)
      ).rejects.toThrow('Command failed');

      // Verify error log message
      const logs = testLogger.getLogEntries();
      const errorLog = logs.find(
        log => log.level === 'error' && log.message.includes('Failed to set up AWS profile')
      );
      expect(errorLog).toBeTruthy();
    });
  });
});
