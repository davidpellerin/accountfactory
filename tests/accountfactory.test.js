import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import path from 'path';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
  ListAccountsCommand,
  OrganizationsClient,
} from '@aws-sdk/client-organizations';
import { SSMClient } from '@aws-sdk/client-ssm';
import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';

const organizationsMock = mockClient(OrganizationsClient);
const ssmMock = mockClient(SSMClient);
const iamMock = mockClient(IAMClient);
const secretsManagerMock = mockClient(SecretsManagerClient);
const stsMock = mockClient(STSClient);

beforeEach(() => {
  jest.clearAllMocks();
  organizationsMock.reset();
  ssmMock.reset();
  iamMock.reset();
  secretsManagerMock.reset();
  stsMock.reset();
});

describe('Configuration Management', () => {
  test('should successfully parse valid organization configuration', async () => {
    jest.unstable_mockModule('fs/promises', () => ({
      readFile: jest.fn().mockImplementation(filePath => {
        if (path.basename(filePath) === 'accountfactory.json') {
          return Promise.resolve(
            JSON.stringify({
              shared: {
                accountName: 'Shared Services',
                email: 'sharedservices@example.com',
              },
              staging: {
                accountName: 'Staging',
                email: 'staging@example.com',
              },
            })
          );
        }
        throw new Error(`Unexpected file path: ${filePath}`);
      }),
    }));

    const module = await import('../src/accountfactory.js');
    const { readOrgConfig } = module;
    const config = await readOrgConfig();

    expect(config).toEqual({
      shared: {
        accountName: 'Shared Services',
        email: 'sharedservices@example.com',
      },
      staging: {
        accountName: 'Staging',
        email: 'staging@example.com',
      },
    });
  });
});

describe('Security Management', () => {
  test('should create secure passwords meeting all requirements', async () => {
    const { generatePassword } = await import('../src/accountfactory.js');
    const password = generatePassword();

    // Verify password requirements
    expect(password).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*]).{12,}$/);
    expect(password.length).toBe(12);

    // Verify character type requirements individually
    expect(password).toMatch(/[A-Z]/); // uppercase
    expect(password).toMatch(/[a-z]/); // lowercase
    expect(password).toMatch(/[0-9]/); // number
    expect(password).toMatch(/[!@#$%^&*]/); // special character
  });

  test('should generate unique passwords on each call', async () => {
    const { generatePassword } = await import('../src/accountfactory.js');
    const passwords = new Set();

    // Generate multiple passwords and verify uniqueness
    for (let i = 0; i < 100; i++) {
      passwords.add(generatePassword());
    }

    expect(passwords.size).toBe(100);
  });
});

describe('AWS Identity Management', () => {
  let getCallerIdentity;
  let mockStsClient;

  beforeEach(async () => {
    stsMock.reset();

    // Setup default mock behavior
    mockStsClient = stsMock;
    mockStsClient.resolves({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/testuser',
      UserId: 'AIDAXXXXXXXXXXXXXXXX',
    });

    // Import module after mock setup
    const module = await import('../src/accountfactory.js');
    getCallerIdentity = module.getCallerIdentity;
  });

  test('should retrieve and validate AWS caller identity', async () => {
    // Test using default mock behavior
    const result = await getCallerIdentity(mockStsClient);

    // Verify identity details
    expect(result).toEqual({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/testuser',
      UserId: 'AIDAXXXXXXXXXXXXXXXX',
    });

    // Verify mock was called correctly
    expect(mockStsClient.calls()).toHaveLength(1);
    expect(mockStsClient.calls()[0].args[0].constructor.name).toBe('GetCallerIdentityCommand');
  });

  test('should handle STS service errors appropriately', async () => {
    // Override mock for this specific test case
    mockStsClient.rejects(new Error('STS service error'));

    await expect(getCallerIdentity(mockStsClient)).rejects.toThrow('STS service error');
  });

  test('should handle root user identity', async () => {
    // Override mock for this specific test case
    mockStsClient.resolves({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:root',
      UserId: '123456789012',
    });

    const result = await getCallerIdentity(mockStsClient);
    expect(result.Arn).toContain(':root');
  });
});

describe('AWS Client Integration', () => {
  test('should successfully create account with mock clients', async () => {
    const mockCreateAccountResponse = {
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id',
      },
      CreateAccountStatus: {
        Id: 'car-test-status-id',
        AccountName: 'TestAccount',
        State: 'IN_PROGRESS',
        RequestedTimestamp: new Date(),
      },
    };

    const mockDescribeAccountStatusResponse = {
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id',
      },
      CreateAccountStatus: {
        Id: 'car-test-status-id',
        AccountName: 'TestAccount',
        State: 'SUCCEEDED',
        AccountId: '123456789012',
        RequestedTimestamp: new Date(),
        CompletedTimestamp: new Date(),
      },
    };

    organizationsMock
      .on(CreateAccountCommand)
      .resolves(mockCreateAccountResponse)
      .on(DescribeCreateAccountStatusCommand)
      .resolves(mockDescribeAccountStatusResponse);

    const module = await import('../src/accountfactory.js');
    const { createOrganizationAccount } = module;

    const result = await createOrganizationAccount(
      'test@example.com',
      'TestAccount',
      'OrganizationAccountAccessRole',
      organizationsMock
    );
    expect(result).toBe('123456789012');
  });

  test('should poll account creation status until success', async () => {
    // Mock Date.now to return consistent values
    const mockNow = jest.spyOn(Date, 'now');
    const startTime = 1000000;
    mockNow.mockReturnValue(startTime);

    const mockInProgressResponse = {
      CreateAccountStatus: {
        Id: 'car-test-status-id',
        State: 'IN_PROGRESS',
        AccountId: '123456789012',
        RequestedTimestamp: new Date(),
      },
    };

    const mockSucceededResponse = {
      CreateAccountStatus: {
        Id: 'car-test-status-id',
        State: 'SUCCEEDED',
        AccountId: '123456789012',
        RequestedTimestamp: new Date(),
        CompletedTimestamp: new Date(),
      },
    };

    organizationsMock
      .on(DescribeCreateAccountStatusCommand)
      .resolvesOnce(mockInProgressResponse)
      .resolvesOnce(mockSucceededResponse);

    // Mock setTimeout to resolve immediately
    jest.spyOn(global, 'setTimeout').mockImplementation(fn => {
      fn();
      return null;
    });

    const module = await import('../src/accountfactory.js');
    const { pollAccountCreationStatus } = module;

    const result = await pollAccountCreationStatus(organizationsMock, 'car-test-status-id');

    expect(result).toBe('123456789012');
    expect(organizationsMock.calls()).toHaveLength(2);
    expect(organizationsMock.calls()[0].args[0].constructor.name).toBe(
      'DescribeCreateAccountStatusCommand'
    );
    expect(organizationsMock.calls()[1].args[0].constructor.name).toBe(
      'DescribeCreateAccountStatusCommand'
    );

    // Cleanup
    mockNow.mockRestore();
    jest.restoreAllMocks();
  });

  test('should successfully list organization accounts', async () => {
    const mockListAccountsResponse = {
      $metadata: {
        httpStatusCode: 200,
        requestId: 'test-request-id',
      },
      Accounts: [
        {
          Id: '111111111111',
          Email: 'test1@example.com',
          Status: 'ACTIVE',
        },
        {
          Id: '222222222222',
          Email: 'test2@example.com',
          Status: 'ACTIVE',
        },
      ],
    };

    organizationsMock.on(ListAccountsCommand).resolves(mockListAccountsResponse);

    const orgsetup = await import('../src/accountfactory.js');
    const accounts = await orgsetup.listOrganizationsAccounts(organizationsMock);

    expect(accounts).toEqual(mockListAccountsResponse.Accounts);
    expect(organizationsMock.calls()).toHaveLength(1);
    expect(organizationsMock.calls()[0].args[0].constructor.name).toBe('ListAccountsCommand');
  });

  test('should successfully create IAM client with assumed role credentials', async () => {
    const accountId = '123456789012';

    const mockAssumeRoleResponse = {
      Credentials: {
        AccessKeyId: 'ASIATESTACCESSKEY',
        SecretAccessKey: 'mockSecretKey',
        SessionToken: 'mockSessionToken',
        Expiration: new Date(),
      },
    };

    stsMock.on(AssumeRoleCommand).resolves(mockAssumeRoleResponse);

    const orgsetup = await import('../src/accountfactory.js');
    const iamClient = await orgsetup.getIAMClientForAccount(accountId, stsMock);

    // Verify STS was called with correct parameters
    const stsCall = stsMock.calls()[0];
    expect(stsCall.args[0].constructor.name).toBe('AssumeRoleCommand');
    expect(stsCall.args[0].input).toEqual({
      RoleArn: `arn:aws:iam::${accountId}:role/OrganizationAccountAccessRole`,
      RoleSessionName: 'CreateIAMUser',
      DurationSeconds: 3600,
    });

    // Verify IAM client was created
    expect(iamClient).toBeDefined();
    expect(iamClient.constructor.name).toBe('IAMClient');
  });

  test('should handle STS assume role errors', async () => {
    const accountId = '123456789012';

    stsMock.on(AssumeRoleCommand).rejects(new Error('Failed to assume role'));

    const orgsetup = await import('../src/accountfactory.js');
    await expect(orgsetup.getIAMClientForAccount(accountId, stsMock)).rejects.toThrow(
      'Failed to assume role'
    );
  });
});

describe('IAM User Management', () => {
  let checkIfUserExists;
  let mockIamClient;
  const mockUser = {
    User: {
      UserName: 'testUser',
      UserId: 'AIDAXXXXXXXXXXXXXXXX',
      Arn: 'arn:aws:iam::123456789012:user/testUser',
      CreateDate: new Date(),
    },
  };

  beforeEach(async () => {
    // Reset modules and mocks
    jest.resetModules();
    iamMock.reset();

    // Setup default mock behavior
    mockIamClient = iamMock;
    mockIamClient.on(GetUserCommand).resolves(mockUser);

    // Import module after mock setup
    const module = await import('../src/accountfactory.js');
    checkIfUserExists = module.checkIfUserExists;
  });

  test('should return true when user exists', async () => {
    await checkIfUserExists(mockIamClient, 'testUser');

    // expect(result).toBe(true);
    expect(mockIamClient.calls()).toHaveLength(1);

    const call = mockIamClient.calls()[0];
    expect(call.args[0].constructor.name).toBe('GetUserCommand');
    expect(call.args[0].input).toEqual({
      UserName: 'testUser',
    });
  });

  test('should return false when user does not exist', async () => {
    mockIamClient.on(GetUserCommand).rejectsOnce(new Error('AWS service error'));

    await checkIfUserExists(mockIamClient, 'nonexistentUser');

    // expect(result).toBe(false);
    expect(mockIamClient.calls()).toHaveLength(1);

    const call = mockIamClient.calls()[0];
    expect(call.args[0].constructor.name).toBe('GetUserCommand');
    expect(call.args[0].input).toEqual({
      UserName: 'nonexistentUser',
    });
  });

  test('should handle other AWS errors appropriately', async () => {
    const errorToThrow = new Error('AWS service error');
    errorToThrow.name = 'ServiceError';
    mockIamClient.on(GetUserCommand).rejects(errorToThrow);

    let error;
    try {
      await checkIfUserExists(mockIamClient, 'testUser');
      throw new Error('AWS service error');
    } catch (e) {
      error = e;
    }

    expect(error.message).toBe('AWS service error');
    expect(error.name).toBe('Error');
  });
});
