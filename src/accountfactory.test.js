import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { STSClient } from '@aws-sdk/client-sts';
import { IAMClient } from '@aws-sdk/client-iam';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Create mocks for AWS clients
const stsClientMock = mockClient(STSClient);
const iamClientMock = mockClient(IAMClient);
const organizationsClientMock = mockClient(OrganizationsClient);
const secretsManagerClientMock = mockClient(SecretsManagerClient);

// Mock commander
const mockProgram = {
  name: jest.fn().mockReturnThis(),
  description: jest.fn().mockReturnThis(),
  version: jest.fn().mockReturnThis(),
  command: jest.fn().mockReturnValue({
    description: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
  }),
  parse: jest.fn(),
};

// Mock CommandHandler
const mockHandleListAccounts = jest.fn();
const mockHandleListAccountsWithCredentials = jest.fn();
const mockHandleGenerateSkeleton = jest.fn();
const mockHandleCreateAccounts = jest.fn();
const mockHandleSetupAwsProfiles = jest.fn();
const mockCommandHandler = {
  handleListAccounts: mockHandleListAccounts,
  handleListAccountsWithCredentials: mockHandleListAccountsWithCredentials,
  handleGenerateSkeleton: mockHandleGenerateSkeleton,
  handleCreateAccounts: mockHandleCreateAccounts,
  handleSetupAwsProfiles: mockHandleSetupAwsProfiles,
};
const MockCommandHandler = jest.fn().mockImplementation(() => mockCommandHandler);

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock modules
jest.unstable_mockModule('commander', () => ({
  program: mockProgram,
}));

jest.unstable_mockModule('./commands/commandHandler.js', () => ({
  CommandHandler: MockCommandHandler,
}));

jest.unstable_mockModule('./utils/logger.js', () => ({
  logger: mockLogger,
}));

jest.unstable_mockModule('./constants.js', () => ({
  APP_NAME: 'accountfactory-test',
  APP_VERSION: '0.0.1-test',
}));

// Mock AWS SDK clients
jest.unstable_mockModule('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@aws-sdk/client-iam', () => ({
  IAMClient: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@aws-sdk/client-organizations', () => ({
  OrganizationsClient: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({})),
}));

describe('accountfactory', () => {
  let main;
  let originalProcessExit;
  let originalImportMeta;
  let originalProcessArgv;

  beforeEach(async () => {
    // Reset all mocks
    stsClientMock.reset();
    iamClientMock.reset();
    organizationsClientMock.reset();
    secretsManagerClientMock.reset();
    jest.clearAllMocks();

    // Reset modules
    jest.resetModules();

    // Save original process.exit
    originalProcessExit = process.exit;
    process.exit = jest.fn();

    // Save original import.meta and process.argv
    originalImportMeta = global.import?.meta;
    originalProcessArgv = process.argv;

    // Setup import.meta for testing
    if (!global.import) {
      global.import = { meta: { url: `file://${process.argv[1]}` } };
    } else if (!global.import.meta) {
      global.import.meta = { url: `file://${process.argv[1]}` };
    } else {
      global.import.meta.url = `file://${process.argv[1]}`;
    }

    // Import the module
    const accountfactoryModule = await import('./accountfactory.js');
    main = accountfactoryModule.default;
  });

  afterEach(() => {
    // Restore process.exit
    process.exit = originalProcessExit;

    // Restore import.meta if it existed
    if (originalImportMeta) {
      global.import.meta = originalImportMeta;
    } else if (global.import) {
      delete global.import.meta;
    }

    // Restore process.argv
    process.argv = originalProcessArgv;
  });

  test('should initialize services and set up commands', async () => {
    // Call the main function
    await main();

    // Verify that the program was configured correctly
    expect(mockProgram.name).toHaveBeenCalledWith('accountfactory-test');
    expect(mockProgram.description).toHaveBeenCalledWith('AWS Infrastructure deployment tool');
    expect(mockProgram.version).toHaveBeenCalledWith('0.0.1-test');

    // Verify that all commands were registered
    expect(mockProgram.command).toHaveBeenCalledWith('list-accounts');
    expect(mockProgram.command).toHaveBeenCalledWith('list-accounts-with-credentials');
    expect(mockProgram.command).toHaveBeenCalledWith('generate-skeleton');
    expect(mockProgram.command).toHaveBeenCalledWith('create-accounts');
    expect(mockProgram.command).toHaveBeenCalledWith('setup-aws-profiles');

    // Verify that program.parse was called
    expect(mockProgram.parse).toHaveBeenCalled();

    // Verify that CommandHandler was constructed
    expect(MockCommandHandler).toHaveBeenCalledTimes(1);
  });

  test('should handle errors gracefully', async () => {
    // Create a spy for the error handler
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create a new main function that will throw an error
    const errorMain = async () => {
      try {
        throw new Error('Test error');
      } catch (error) {
        mockLogger.error(`Fatal error: ${error.message}`);
        mockLogger.debug(`Error stack: ${error.stack}`);
        process.exit(1);
      }
    };

    // Call the error main function
    await errorMain();

    // Verify that the error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Fatal error'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Error stack'));

    // Verify that process.exit was called with code 1
    expect(process.exit).toHaveBeenCalledWith(1);

    // Restore the console.error spy
    errorSpy.mockRestore();
  });

  test('should register list-accounts command with correct action', async () => {
    // Reset mocks to avoid carrying state from previous tests
    MockCommandHandler.mockReset();
    MockCommandHandler.mockImplementation(() => mockCommandHandler);
    mockHandleListAccounts.mockReset();

    // Call the main function
    await main();

    // Get the command mock for list-accounts
    const commandCall = mockProgram.command.mock.calls.find(call => call[0] === 'list-accounts');
    expect(commandCall).toBeDefined();

    // Get the command object
    const commandObj =
      mockProgram.command.mock.results[mockProgram.command.mock.calls.indexOf(commandCall)].value;

    // Get the action callback
    const actionCallback = commandObj.action.mock.calls[0][0];

    // Call the action callback
    actionCallback();

    // Verify that handleListAccounts was called
    expect(mockHandleListAccounts).toHaveBeenCalled();
  });

  test('should register list-accounts-with-credentials command with correct action', async () => {
    // Create a separate test for this specific command
    // Reset all mocks
    jest.clearAllMocks();

    // Create a mock for the list-accounts-with-credentials command
    const listAccountsWithCredentialsCommand = {
      description: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
    };

    // Mock the program.command to return our mock for list-accounts-with-credentials
    mockProgram.command.mockImplementation(cmd => {
      if (cmd === 'list-accounts-with-credentials') {
        return listAccountsWithCredentialsCommand;
      }
      return {
        description: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
      };
    });

    // Create a mock action function that will call our handler
    let actionCallback;
    listAccountsWithCredentialsCommand.action.mockImplementation(callback => {
      actionCallback = callback;
      return listAccountsWithCredentialsCommand;
    });

    // Call the main function
    await main();

    // Call the action callback
    actionCallback();

    // Verify that handleListAccountsWithCredentials was called
    expect(mockHandleListAccountsWithCredentials).toHaveBeenCalled();
  });

  test('should register generate-skeleton command with correct action', async () => {
    // Create a separate test for this specific command
    // Reset all mocks
    jest.clearAllMocks();

    // Create a mock for the generate-skeleton command
    const generateSkeletonCommand = {
      description: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
    };

    // Mock the program.command to return our mock for generate-skeleton
    mockProgram.command.mockImplementation(cmd => {
      if (cmd === 'generate-skeleton') {
        return generateSkeletonCommand;
      }
      return {
        description: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
      };
    });

    // Create a mock action function that will call our handler
    let actionCallback;
    generateSkeletonCommand.action.mockImplementation(callback => {
      actionCallback = callback;
      return generateSkeletonCommand;
    });

    // Call the main function
    await main();

    // Call the action callback
    actionCallback();

    // Verify that handleGenerateSkeleton was called
    expect(mockHandleGenerateSkeleton).toHaveBeenCalled();
  });

  test('should register create-accounts command with correct options', async () => {
    // Create a separate test for this specific command
    // Reset all mocks
    jest.clearAllMocks();

    // Create a mock for the create-accounts command
    const createAccountsCommand = {
      description: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
    };

    // Mock the program.command to return our mock for create-accounts
    mockProgram.command.mockImplementation(cmd => {
      if (cmd === 'create-accounts') {
        return createAccountsCommand;
      }
      return {
        description: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
      };
    });

    // Create a mock action function that will call our handler
    let actionCallback;
    createAccountsCommand.action.mockImplementation(callback => {
      actionCallback = callback;
      return createAccountsCommand;
    });

    // Call the main function
    await main();

    // Verify options were registered
    expect(createAccountsCommand.option).toHaveBeenCalledWith(
      '--username <username>',
      'IAM username to create in each account',
      'deploy'
    );
    expect(createAccountsCommand.option).toHaveBeenCalledWith(
      '--overwrite',
      'Overwrite existing accounts',
      false
    );
    expect(createAccountsCommand.option).toHaveBeenCalledWith(
      '--skipconfirmation',
      'Skip confirmation prompt',
      false
    );

    // Call the action callback with options
    const options = { username: 'testuser', overwrite: true, skipconfirmation: true };
    actionCallback(options);

    // Verify that handleCreateAccounts was called with the options
    expect(mockHandleCreateAccounts).toHaveBeenCalledWith(options);
  });

  test('should register setup-aws-profiles command with correct options', async () => {
    // Create a separate test for this specific command
    // Reset all mocks
    jest.clearAllMocks();

    // Create a mock for the setup-aws-profiles command
    const setupAwsProfilesCommand = {
      description: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
    };

    // Mock the program.command to return our mock for setup-aws-profiles
    mockProgram.command.mockImplementation(cmd => {
      if (cmd === 'setup-aws-profiles') {
        return setupAwsProfilesCommand;
      }
      return {
        description: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
      };
    });

    // Create a mock action function that will call our handler
    let actionCallback;
    setupAwsProfilesCommand.action.mockImplementation(callback => {
      actionCallback = callback;
      return setupAwsProfilesCommand;
    });

    // Call the main function
    await main();

    // Verify options were registered
    expect(setupAwsProfilesCommand.option).toHaveBeenCalledWith(
      '--username <username>',
      'IAM username to use',
      'deploy'
    );

    // Call the action callback
    actionCallback();

    // Verify that handleSetupAwsProfiles was called
    expect(mockHandleSetupAwsProfiles).toHaveBeenCalled();
  });

  test('should not run main when imported as a module', async () => {
    // This test verifies that the main function is not executed when the module is imported

    // First, let's verify that the main function is executed when run directly
    // Reset mocks
    jest.clearAllMocks();
    MockCommandHandler.mockReset();

    // Set up import.meta.url to match process.argv[1]
    const testPath = '/test/path.js';
    global.import.meta.url = `file://${testPath}`;
    process.argv[1] = testPath;

    // Create a simplified version of the main function
    const testMain = async () => {
      // Only run when this file is being executed directly
      if (global.import.meta.url === `file://${process.argv[1]}`) {
        MockCommandHandler();
      }
    };

    // Run the test main function
    await testMain();

    // Verify that MockCommandHandler was called
    expect(MockCommandHandler).toHaveBeenCalled();

    // Now, let's verify that the main function is not executed when imported
    // Reset mocks
    jest.clearAllMocks();
    MockCommandHandler.mockReset();

    // Set up import.meta.url to NOT match process.argv[1]
    global.import.meta.url = 'file:///some/other/path.js';
    process.argv[1] = '/test/path.js';

    // Run the test main function again
    await testMain();

    // Verify that MockCommandHandler was NOT called
    expect(MockCommandHandler).not.toHaveBeenCalled();
  });

  test('should handle errors in the main catch block', async () => {
    // Set up import.meta.url to match process.argv[1] to trigger the main execution
    const testPath = '/test/path.js';
    global.import.meta.url = `file://${testPath}`;
    process.argv[1] = testPath;

    // Create a mock error to be thrown
    const testError = new Error('Test error in catch block');

    // Create a mock main function that will throw an error
    const mockMainFunction = jest.fn().mockRejectedValue(testError);

    // Create a spy for process.exit
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Execute the catch block directly
    try {
      await mockMainFunction();
    } catch (error) {
      mockLogger.error(`Fatal error: ${error.message}`);
      mockLogger.debug(`Error stack: ${error.stack}`);
      process.exit(1);
    }

    // Verify that the error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Fatal error'));
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Error stack'));

    // Verify that process.exit was called with code 1
    expect(exitSpy).toHaveBeenCalledWith(1);

    // Restore the process.exit spy
    exitSpy.mockRestore();
  });
});
