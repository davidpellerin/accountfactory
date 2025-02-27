import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { IAMClient } from '@aws-sdk/client-iam';
import { STSClient } from '@aws-sdk/client-sts';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createTestLogger } from '../utils/testLogger.js';

// Mock dependencies
const organizationsClientMock = mockClient(OrganizationsClient);
const iamClientMock = mockClient(IAMClient);
const stsClientMock = mockClient(STSClient);
const secretsManagerClientMock = mockClient(SecretsManagerClient);
let testLogger;

// Mock readline interface
const mockQuestion = jest.fn();
const mockClose = jest.fn();
jest.unstable_mockModule('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: mockQuestion,
    close: mockClose,
  }),
}));

// Mock config manager
const mockReadAccountFactoryConfig = jest.fn();
jest.unstable_mockModule('../utils/config.js', () => ({
  configManager: {
    readAccountFactoryConfig: mockReadAccountFactoryConfig,
  },
}));

// Mock process.exit
const originalExit = process.exit;
const mockExit = jest.fn();

// Mock console.table
const originalConsoleTable = console.table;
const mockConsoleTable = jest.fn();

describe('CommandHandler', () => {
  let CommandHandler;
  let commandHandler;
  let mockSTSService;
  let mockOrganizationsService;
  let mockIAMService;
  let mockSetupProfilesService;
  let mockSecretsManagerService;
  let mockGenerateSkeletonService;

  beforeEach(async () => {
    // Reset all mocks
    organizationsClientMock.reset();
    iamClientMock.reset();
    stsClientMock.reset();
    secretsManagerClientMock.reset();
    testLogger = createTestLogger();

    mockQuestion.mockClear();
    mockClose.mockClear();
    mockReadAccountFactoryConfig.mockClear();
    mockConsoleTable.mockClear();

    // Mock process.exit
    process.exit = mockExit;
    mockExit.mockClear();

    // Mock console.table
    console.table = mockConsoleTable;

    // Create mock services
    mockSTSService = {
      getCallerIdentity: jest.fn().mockResolvedValue({ Account: '123456789012' }),
    };

    mockOrganizationsService = {
      listOrganizationsAccounts: jest.fn().mockResolvedValue([
        { Id: '111111111111', Email: 'account1@example.com', Status: 'ACTIVE' },
        { Id: '222222222222', Email: 'account2@example.com', Status: 'ACTIVE' },
      ]),
      createAccount: jest.fn().mockResolvedValue('333333333333'),
    };

    mockIAMService = {
      createIAMUser: jest.fn().mockResolvedValue(true),
    };

    mockSetupProfilesService = {
      setupAwsProfile: jest.fn().mockResolvedValue(undefined),
    };

    mockSecretsManagerService = {
      getExistingCredentials: jest.fn().mockResolvedValue({
        username: 'deploy',
        password: 'password123',
        access_key_id: 'AKIATEST',
        secret_access_key: 'secretTest',
      }),
    };

    mockGenerateSkeletonService = {
      generateSkeleton: jest.fn().mockResolvedValue(
        JSON.stringify(
          {
            accounts: [
              {
                accountName: 'Test Account',
                email: 'test@example.com',
                profileName: 'test-profile',
              },
            ],
          },
          null,
          2
        )
      ),
    };

    // Import the CommandHandler class
    const module = await import('./commandHandler.js');
    CommandHandler = module.CommandHandler;

    // Create a new instance with mocked dependencies
    commandHandler = new CommandHandler(
      organizationsClientMock,
      iamClientMock,
      stsClientMock,
      secretsManagerClientMock,
      testLogger
    );

    // Replace the services with mocks
    commandHandler.stsService = mockSTSService;
    commandHandler.organizationsService = mockOrganizationsService;
    commandHandler.iamService = mockIAMService;
    commandHandler.setupProfilesService = mockSetupProfilesService;
    commandHandler.secretsManagerService = mockSecretsManagerService;
    commandHandler.generateSkeletonService = mockGenerateSkeletonService;
  });

  afterEach(() => {
    // Restore original functions
    process.exit = originalExit;
    console.table = originalConsoleTable;
  });

  describe('constructor', () => {
    test('should initialize with all dependencies', async () => {
      expect(commandHandler.organizationsClient).toBe(organizationsClientMock);
      expect(commandHandler.iamClient).toBe(iamClientMock);
      expect(commandHandler.stsClient).toBe(stsClientMock);
      expect(commandHandler.secretsManagerClient).toBe(secretsManagerClientMock);
      expect(commandHandler.logger).toBe(testLogger);

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({
        level: 'debug',
        message: 'CommandHandler initialized with dependencies',
      });
    });

    test('should throw error when organizationsClient is not provided', async () => {
      expect(
        () =>
          new CommandHandler(
            null,
            iamClientMock,
            stsClientMock,
            secretsManagerClientMock,
            testLogger
          )
      ).toThrow('OrganizationsClient is required');
    });

    test('should throw error when iamClient is not provided', async () => {
      expect(
        () =>
          new CommandHandler(
            organizationsClientMock,
            null,
            stsClientMock,
            secretsManagerClientMock,
            testLogger
          )
      ).toThrow('IAMClient is required');
    });

    test('should throw error when stsClient is not provided', async () => {
      expect(
        () =>
          new CommandHandler(
            organizationsClientMock,
            iamClientMock,
            null,
            secretsManagerClientMock,
            testLogger
          )
      ).toThrow('STSClient is required');
    });

    test('should throw error when secretsManagerClient is not provided', async () => {
      expect(
        () =>
          new CommandHandler(
            organizationsClientMock,
            iamClientMock,
            stsClientMock,
            null,
            testLogger
          )
      ).toThrow('SecretsManagerClient is required');
    });
  });

  describe('confirm', () => {
    test('should return true when user confirms with "y"', async () => {
      mockQuestion.mockImplementation((message, callback) => {
        callback('y');
      });

      const result = await commandHandler.confirm('Are you sure?');

      expect(result).toBe(true);
      expect(mockQuestion).toHaveBeenCalledWith('Are you sure? [y/N] ', expect.any(Function));
      expect(mockClose).toHaveBeenCalled();
    });

    test('should return false when user does not confirm', async () => {
      mockQuestion.mockImplementation((message, callback) => {
        callback('n');
      });

      const result = await commandHandler.confirm('Are you sure?');

      expect(result).toBe(false);
      expect(mockQuestion).toHaveBeenCalledWith('Are you sure? [y/N] ', expect.any(Function));
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('handleListAccounts', () => {
    test('should list accounts successfully', async () => {
      await commandHandler.handleListAccounts();

      expect(mockSTSService.getCallerIdentity).toHaveBeenCalled();
      expect(mockOrganizationsService.listOrganizationsAccounts).toHaveBeenCalled();
      expect(mockConsoleTable).toHaveBeenCalledWith([
        { Id: '111111111111', Email: 'account1@example.com', Status: 'ACTIVE' },
        { Id: '222222222222', Email: 'account2@example.com', Status: 'ACTIVE' },
      ]);
      expect(mockExit).not.toHaveBeenCalled();

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'debug', message: 'Listing accounts' });
    });

    test('should handle empty account list', async () => {
      mockOrganizationsService.listOrganizationsAccounts.mockResolvedValue([]);

      await commandHandler.handleListAccounts();

      expect(mockSTSService.getCallerIdentity).toHaveBeenCalled();
      expect(mockOrganizationsService.listOrganizationsAccounts).toHaveBeenCalled();
      expect(mockConsoleTable).not.toHaveBeenCalled();

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({
        level: 'info',
        message: 'No accounts found in AWS Organizations',
      });
    });

    test('should handle errors and exit', async () => {
      const errorMessage = 'Failed to list accounts';
      mockSTSService.getCallerIdentity.mockRejectedValue(new Error(errorMessage));

      await commandHandler.handleListAccounts();

      expect(mockExit).toHaveBeenCalledWith(1);

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'error', message: `Command failed: ${errorMessage}` });
    });
  });

  describe('handleListAccountsWithCredentials', () => {
    test('should list accounts with credentials', async () => {
      await commandHandler.handleListAccountsWithCredentials();

      expect(mockSTSService.getCallerIdentity).toHaveBeenCalled();
      expect(mockOrganizationsService.listOrganizationsAccounts).toHaveBeenCalled();
      expect(mockSecretsManagerService.getExistingCredentials).toHaveBeenCalledTimes(2);
      expect(mockSecretsManagerService.getExistingCredentials).toHaveBeenCalledWith(
        '111111111111',
        'deploy'
      );
      expect(mockSecretsManagerService.getExistingCredentials).toHaveBeenCalledWith(
        '222222222222',
        'deploy'
      );

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'debug', message: 'Listing accounts' });
      expect(logs).toContainEqual({
        level: 'info',
        message: '111111111111 - account1@example.com - ACTIVE',
      });
      expect(logs).toContainEqual({
        level: 'info',
        message: '222222222222 - account2@example.com - ACTIVE',
      });
    });

    test('should handle errors and exit', async () => {
      const errorMessage = 'Failed to list accounts with credentials';
      mockSTSService.getCallerIdentity.mockRejectedValue(new Error(errorMessage));

      await commandHandler.handleListAccountsWithCredentials();

      expect(mockExit).toHaveBeenCalledWith(1);

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'error', message: `Command failed: ${errorMessage}` });
    });
  });

  describe('handleGenerateSkeleton', () => {
    test('should generate skeleton successfully', async () => {
      await commandHandler.handleGenerateSkeleton();

      expect(mockGenerateSkeletonService.generateSkeleton).toHaveBeenCalled();

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'debug', message: 'Generating skeleton' });
      expect(logs).toContainEqual({
        level: 'info',
        message: JSON.stringify(
          {
            accounts: [
              {
                accountName: 'Test Account',
                email: 'test@example.com',
                profileName: 'test-profile',
              },
            ],
          },
          null,
          2
        ),
      });
    });
  });

  describe('handleCreateAccounts', () => {
    const mockAccountFactoryConfig = {
      accounts: [
        { accountName: 'Test Account 1', email: 'test1@example.com' },
        { accountName: 'Test Account 2', email: 'test2@example.com' },
      ],
    };

    beforeEach(() => {
      mockReadAccountFactoryConfig.mockResolvedValue(mockAccountFactoryConfig);
    });

    test('should create accounts with confirmation', async () => {
      // Mock user confirmation
      mockQuestion.mockImplementation((message, callback) => {
        callback('y');
      });

      await commandHandler.handleCreateAccounts({ skipConfirmation: false, username: 'deploy' });

      expect(mockSTSService.getCallerIdentity).toHaveBeenCalled();
      expect(mockReadAccountFactoryConfig).toHaveBeenCalled();
      expect(mockOrganizationsService.createAccount).toHaveBeenCalledTimes(2);
      expect(mockOrganizationsService.createAccount).toHaveBeenCalledWith(
        'test1@example.com',
        'Test Account 1',
        'OrganizationAccountAccessRole',
        undefined
      );
      expect(mockOrganizationsService.createAccount).toHaveBeenCalledWith(
        'test2@example.com',
        'Test Account 2',
        'OrganizationAccountAccessRole',
        undefined
      );
      expect(mockIAMService.createIAMUser).toHaveBeenCalledTimes(2);
      expect(mockIAMService.createIAMUser).toHaveBeenCalledWith('333333333333', 'deploy');

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'debug', message: 'Creating accounts' });
      expect(logs).toContainEqual({
        level: 'info',
        message: 'Account test1@example.com created with ID 333333333333',
      });
      expect(logs).toContainEqual({
        level: 'info',
        message: 'Account test2@example.com created with ID 333333333333',
      });
    });

    test('should skip confirmation when skipConfirmation is true', async () => {
      await commandHandler.handleCreateAccounts({ skipConfirmation: true, username: 'deploy' });

      expect(mockQuestion).not.toHaveBeenCalled();
      expect(mockSTSService.getCallerIdentity).toHaveBeenCalled();
      expect(mockReadAccountFactoryConfig).toHaveBeenCalled();
      expect(mockOrganizationsService.createAccount).toHaveBeenCalledTimes(2);
      expect(mockIAMService.createIAMUser).toHaveBeenCalledTimes(2);
    });

    test('should handle empty accounts list', async () => {
      mockReadAccountFactoryConfig.mockResolvedValue({ accounts: [] });

      await commandHandler.handleCreateAccounts({ skipConfirmation: true, username: 'deploy' });

      expect(mockExit).toHaveBeenCalledWith(1);

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({
        level: 'error',
        message: 'No accounts found in accountfactory.json',
      });
    });

    test('should handle errors and exit', async () => {
      const errorMessage = 'Failed to create accounts';
      mockSTSService.getCallerIdentity.mockRejectedValue(new Error(errorMessage));

      await commandHandler.handleCreateAccounts({ skipConfirmation: true, username: 'deploy' });

      expect(mockExit).toHaveBeenCalledWith(1);

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'error', message: `Command failed: ${errorMessage}` });
    });
  });

  describe('handleSetupAwsProfiles', () => {
    const mockAccountFactoryConfig = {
      accounts: [
        {
          accountName: 'Test Account 1',
          email: 'test1@example.com',
          profileName: 'test-profile-1',
        },
        {
          accountName: 'Test Account 2',
          email: 'test2@example.com',
          profileName: 'test-profile-2',
        },
      ],
    };

    beforeEach(() => {
      mockReadAccountFactoryConfig.mockResolvedValue(mockAccountFactoryConfig);
    });

    test('should setup AWS profiles successfully', async () => {
      const options = { username: 'deploy' };

      await commandHandler.handleSetupAwsProfiles(options);

      expect(mockSTSService.getCallerIdentity).toHaveBeenCalled();
      expect(mockOrganizationsService.listOrganizationsAccounts).toHaveBeenCalled();
      expect(mockReadAccountFactoryConfig).toHaveBeenCalled();
      expect(mockSetupProfilesService.setupAwsProfile).toHaveBeenCalledTimes(2);
      expect(mockSetupProfilesService.setupAwsProfile).toHaveBeenCalledWith(
        mockAccountFactoryConfig.accounts[0],
        [
          { Id: '111111111111', Email: 'account1@example.com', Status: 'ACTIVE' },
          { Id: '222222222222', Email: 'account2@example.com', Status: 'ACTIVE' },
        ],
        options
      );
      expect(mockSetupProfilesService.setupAwsProfile).toHaveBeenCalledWith(
        mockAccountFactoryConfig.accounts[1],
        [
          { Id: '111111111111', Email: 'account1@example.com', Status: 'ACTIVE' },
          { Id: '222222222222', Email: 'account2@example.com', Status: 'ACTIVE' },
        ],
        options
      );

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({
        level: 'info',
        message: 'Setting up profiles for account test1@example.com',
      });
      expect(logs).toContainEqual({
        level: 'info',
        message: 'Setting up profiles for account test2@example.com',
      });
    });

    test('should handle errors and exit', async () => {
      const errorMessage = 'Failed to setup AWS profiles';
      mockSTSService.getCallerIdentity.mockRejectedValue(new Error(errorMessage));

      await commandHandler.handleSetupAwsProfiles({});

      expect(mockExit).toHaveBeenCalledWith(1);

      const logs = testLogger.getLogEntries();
      expect(logs).toContainEqual({ level: 'error', message: `Command failed: ${errorMessage}` });
    });
  });
});
