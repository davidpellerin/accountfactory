import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
  ListAccountsCommand,
  OrganizationsClient,
} from '@aws-sdk/client-organizations';

// Create mock at the top level
const organizationsClientMock = mockClient(OrganizationsClient);

describe('OrganizationsService', () => {
  beforeEach(() => {
    organizationsClientMock.reset();
    jest.clearAllMocks();
  });

  describe('createAwsOrganizationsClient', () => {
    test('should return new client when called', async () => {
      const module = await import('./organizationsService.js');
      const client = module.createAwsOrganizationsClient();
      expect(client).toBeInstanceOf(OrganizationsClient);
    });
  });

  describe('constructor', () => {
    test('should throw error when client not provided', async () => {
      const module = await import('./organizationsService.js');
      expect(() => new module.OrganizationsService()).toThrow('OrganizationsClient is required');
    });

    test('should initialize service when client provided', async () => {
      const module = await import('./organizationsService.js');
      const client = new OrganizationsClient();
      const service = new module.OrganizationsService(client);
      expect(service.client).toBe(client);
    });
  });

  describe('createAccount', () => {
    const testEmail = 'test@example.com';
    const testAccountName = 'Test Account';
    const testAccountId = '123456789012';
    const testCreateAccountId = 'car-12345';

    test('should return account id when creation succeeds', async () => {
      // Setup mocks
      organizationsClientMock
        .on(ListAccountsCommand)
        .resolves({ Accounts: [] })
        .on(CreateAccountCommand)
        .resolves({ CreateAccountStatus: { Id: testCreateAccountId } })
        .on(DescribeCreateAccountStatusCommand)
        .resolves({
          CreateAccountStatus: {
            Id: testCreateAccountId,
            State: 'SUCCEEDED',
            AccountId: testAccountId,
          },
        });

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock, 0);

      // Act
      const result = await service.createAccount(
        testEmail,
        testAccountName,
        module.ORGANIZATION_ROLE_NAME
      );

      // Assert
      expect(result).toBe(testAccountId);
      expect(organizationsClientMock.calls()).toHaveLength(3);

      const createCall = organizationsClientMock.calls().find(call =>
        call.args[0].constructor.name === 'CreateAccountCommand'
      );
      expect(createCall.args[0].input).toEqual({
        Email: testEmail,
        AccountName: testAccountName,
        RoleName: module.ORGANIZATION_ROLE_NAME,
      });
    });

    test('should return null when account already exists', async () => {
      // Setup mocks
      organizationsClientMock.on(ListAccountsCommand).resolves({
        Accounts: [
          {
            Email: testEmail,
            Id: testAccountId,
            Status: 'ACTIVE',
          },
        ],
      });

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock);

      // Act
      const result = await service.createAccount(
        testEmail,
        testAccountName,
        module.ORGANIZATION_ROLE_NAME
      );

      // Assert
      expect(result).toBeNull();
      expect(organizationsClientMock.calls()).toHaveLength(1);
      expect(organizationsClientMock.calls()[0].args[0].constructor.name).toBe('ListAccountsCommand');
    });

    test('should return null when creation fails', async () => {
      // Setup mocks
      organizationsClientMock
        .on(ListAccountsCommand)
        .resolves({ Accounts: [] })
        .on(CreateAccountCommand)
        .resolves({ CreateAccountStatus: { Id: testCreateAccountId } })
        .on(DescribeCreateAccountStatusCommand)
        .resolves({
          CreateAccountStatus: {
            Id: testCreateAccountId,
            State: 'FAILED',
            FailureReason: 'Test failure',
          },
        });

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock, 0);

      // Act
      const result = await service.createAccount(
        testEmail,
        testAccountName,
        module.ORGANIZATION_ROLE_NAME
      );

      // Assert
      expect(result).toBeNull();
      expect(organizationsClientMock.calls()).toHaveLength(3);
    });
  });

  describe('listOrganizationsAccounts', () => {
    test('should return all accounts when multiple pages exist', async () => {
      // Setup test data
      const accounts = [
        { Email: 'test1@example.com', Id: '111111111111', Status: 'ACTIVE' },
        { Email: 'test2@example.com', Id: '222222222222', Status: 'ACTIVE' },
      ];

      // Setup mocks
      organizationsClientMock
        .on(ListAccountsCommand)
        .resolvesOnce({
          Accounts: [accounts[0]],
          NextToken: 'token',
        })
        .resolvesOnce({
          Accounts: [accounts[1]],
        });

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock, 0);

      // Act
      const result = await service.listOrganizationsAccounts();

      // Assert
      expect(result).toEqual(accounts);
      expect(organizationsClientMock.calls()).toHaveLength(2);

      const calls = organizationsClientMock.calls();
      expect(calls[0].args[0].input).toEqual({});
      expect(calls[1].args[0].input).toEqual({ NextToken: 'token' });
    });

    test('should throw error when access denied', async () => {
      // Setup mocks
      organizationsClientMock.on(ListAccountsCommand).rejects(new Error('Access denied'));

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock, 0);

      // Act
      try {
        await service.listOrganizationsAccounts();
      } catch (e) {
        expect(e.name).toBe('Error');
      }
    });
  });

  describe('accountExists', () => {
    test('should return true when account exists', async () => {
      // Setup test data
      const testEmail = 'test@example.com';

      // Setup mocks
      organizationsClientMock.on(ListAccountsCommand).resolves({
        Accounts: [
          {
            Email: testEmail,
            Id: '123456789012',
            Status: 'ACTIVE',
          },
        ],
      });

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock);

      // Act
      const result = await service.accountExists(testEmail);

      // Assert
      expect(result).toBe(true);
      expect(organizationsClientMock.calls()[0].args[0].constructor.name).toBe('ListAccountsCommand');
    });

    test('should return false when account does not exist', async () => {
      // Setup test data
      const testEmail = 'test@example.com';

      // Setup mocks
      organizationsClientMock.on(ListAccountsCommand).resolves({
        Accounts: [
          {
            Email: 'other@example.com',
            Id: '123456789012',
            Status: 'ACTIVE',
          },
        ],
      });

      const module = await import('./organizationsService.js');
      const service = new module.OrganizationsService(organizationsClientMock);

      // Act
      const result = await service.accountExists(testEmail);

      // Assert
      expect(result).toBe(false);
    });
  });
});
