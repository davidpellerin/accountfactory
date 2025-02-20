import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreateLoginProfileCommand,
  GetUserCommand,
  IAMClient
} from '@aws-sdk/client-iam';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { ORGANIZATION_ROLE_NAME, ADMIN_POLICY_ARN } from '../constants.js';

// Mock the logger
const mockDebug = jest.fn();
const mockInfo = jest.fn();
const mockWarning = jest.fn();
const mockError = jest.fn();

jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    debug: mockDebug,
    info: mockInfo,
    warning: mockWarning,
    error: mockError
  }
}));

// Mock the password service
const mockGeneratePassword = jest.fn();
jest.unstable_mockModule('../utils/passwordService.js', () => ({
  PasswordService: {
    generatePassword: mockGeneratePassword
  }
}));

const iamMock = mockClient(IAMClient);
const stsMock = mockClient(STSClient);

beforeEach(() => {
  iamMock.reset();
  stsMock.reset();
  mockDebug.mockClear();
  mockInfo.mockClear();
  mockWarning.mockClear();
  mockError.mockClear();
  mockGeneratePassword.mockClear();
});

const testUser = {
  User: {
    UserName: 'testUser',
    UserId: 'AIDAXXXXXXXXXXXXXXXX',
    Arn: 'arn:aws:iam::123456789012:user/testUser',
    CreateDate: new Date(),
  },
};

describe('IAMService', () => {
  describe('createAwsIAMClient', () => {
    test('should create and return a new IAMClient', async () => {
      const { createAwsIAMClient } = await import('./iamService.js');
      const client = createAwsIAMClient();
      expect(client).toBeInstanceOf(IAMClient);
      expect(mockDebug).toHaveBeenCalledWith('Creating AWS IAMClient');
    });
  });

  describe('constructor', () => {
    test('should initialize with provided clients', async () => {
      const { IAMService } = await import('./iamService.js');
      const secretsManagerMock = {};
      const service = new IAMService(iamMock, secretsManagerMock, stsMock);
      expect(service.iamClient).toBe(iamMock);
      expect(service.secretsManagerClient).toBe(secretsManagerMock);
      expect(service.stsClient).toBe(stsMock);
    });
  });

  describe('createNewUser', () => {
    const testPassword = 'TestPassword123!';
    const testAccessKey = {
      AccessKey: {
        AccessKeyId: 'AKIATEST',
        SecretAccessKey: 'secretTest'
      }
    };

    beforeEach(() => {
      mockGeneratePassword.mockReturnValue(testPassword);
    });

    test('should create a new user with password and access key', async () => {
      iamMock
        .on(CreateLoginProfileCommand).resolves({})
        .on(AttachUserPolicyCommand).resolves({})
        .on(CreateAccessKeyCommand).resolves(testAccessKey);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock);

      const result = await service.createNewUser('newUser');

      expect(result).toEqual({
        password: testPassword,
        accessKeyId: testAccessKey.AccessKey.AccessKeyId,
        secretAccessKey: testAccessKey.AccessKey.SecretAccessKey
      });

      expect(iamMock.calls()).toHaveLength(3);
      
      const loginCall = iamMock.calls()[0];
      expect(loginCall.args[0].constructor.name).toBe('CreateLoginProfileCommand');
      expect(loginCall.args[0].input).toEqual({
        UserName: 'newUser',
        Password: testPassword,
        PasswordResetRequired: true
      });

      const policyCall = iamMock.calls()[1];
      expect(policyCall.args[0].constructor.name).toBe('AttachUserPolicyCommand');
      expect(policyCall.args[0].input).toEqual({
        UserName: 'newUser',
        PolicyArn: ADMIN_POLICY_ARN
      });

      const keyCall = iamMock.calls()[2];
      expect(keyCall.args[0].constructor.name).toBe('CreateAccessKeyCommand');
      expect(keyCall.args[0].input).toEqual({
        UserName: 'newUser'
      });
    });

    test('should handle existing login profile', async () => {
      const error = new Error('Profile exists');
      error.name = 'EntityAlreadyExists';
      
      iamMock
        .on(CreateLoginProfileCommand).rejects(error)
        .on(AttachUserPolicyCommand).resolves({})
        .on(CreateAccessKeyCommand).resolves(testAccessKey);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock);

      const result = await service.createNewUser('existingUser');

      expect(result).toEqual({
        password: '**EXISTING PASSWORD NOT CHANGED**',
        accessKeyId: testAccessKey.AccessKey.AccessKeyId,
        secretAccessKey: testAccessKey.AccessKey.SecretAccessKey
      });

      expect(mockWarning).toHaveBeenCalledWith(
        'Login profile already exists for user existingUser, skipping password creation'
      );
    });

    test('should throw error on AWS failure', async () => {
      const error = new Error('AWS error');
      iamMock.on(CreateLoginProfileCommand).rejects(error);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock);

      await expect(service.createNewUser('newUser')).rejects.toThrow('AWS error');
      expect(mockError).toHaveBeenCalledWith('Error creating new user: AWS error');
    });
  });

  describe('checkIfIamUserExists', () => {
    test('should return true when user exists', async () => {
      iamMock.on(GetUserCommand).resolves(testUser);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock);

      const doesUserExist = await service.checkIfIamUserExists(testUser.User.UserName);

      expect(doesUserExist).toBe(true);
      expect(iamMock.calls()).toHaveLength(1);

      const call = iamMock.calls()[0];
      expect(call.args[0].constructor.name).toBe('GetUserCommand');
      expect(call.args[0].input).toEqual({
        UserName: 'testUser',
      });
    });

    test('should return false when user does not exist', async () => {
      const error = new Error('User does not exist');
      error.name = 'NoSuchEntityException';
      iamMock.on(GetUserCommand).rejects(error);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock);

      const doesUserExist = await service.checkIfIamUserExists('nonexistentUser');

      expect(doesUserExist).toBe(false);
      expect(iamMock.calls()).toHaveLength(1);

      const call = iamMock.calls()[0];
      expect(call.args[0].constructor.name).toBe('GetUserCommand');
      expect(call.args[0].input).toEqual({
        UserName: 'nonexistentUser',
      });
    });

    test('should throw other AWS errors', async () => {
      iamMock.on(GetUserCommand).rejects(new Error('AWS service error'));

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock);

      await expect(service.checkIfIamUserExists(testUser.User.UserName))
        .rejects.toThrow('AWS service error');
    });
  });

  describe('getIAMClientForAccount', () => {
    const testAccountId = '123456789012';
    const testCredentials = {
      Credentials: {
        AccessKeyId: 'ASIATEST',
        SecretAccessKey: 'secretTest',
        SessionToken: 'tokenTest'
      }
    };

    test('should return IAM client with assumed role credentials', async () => {
      stsMock.on(AssumeRoleCommand).resolves(testCredentials);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock, null, stsMock);

      const client = await service.getIAMClientForAccount(testAccountId);

      expect(client).toBeInstanceOf(IAMClient);
      expect(stsMock.calls()).toHaveLength(1);

      const call = stsMock.calls()[0];
      expect(call.args[0].constructor.name).toBe('AssumeRoleCommand');
      expect(call.args[0].input).toEqual({
        RoleArn: `arn:aws:iam::${testAccountId}:role/${ORGANIZATION_ROLE_NAME}`,
        RoleSessionName: 'CreateIAMUser',
        DurationSeconds: 3600
      });
    });

    test('should throw error when assume role fails', async () => {
      const error = new Error('Failed to assume role');
      stsMock.on(AssumeRoleCommand).rejects(error);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(iamMock, null, stsMock);

      await expect(service.getIAMClientForAccount(testAccountId))
        .rejects.toThrow('Failed to assume role');
      expect(mockError).toHaveBeenCalledWith(
        `Failed to get IAM client for account ${testAccountId}: Failed to assume role`
      );
    });
  });

  describe('createIAMUser', () => {
    const testAccountId = '123456789012';
    const testUsername = 'newUser';
    const testCredentials = {
      password: 'TestPass123!',
      accessKeyId: 'AKIATEST',
      secretAccessKey: 'secretTest'
    };
    const testAssumeRoleResponse = {
      Credentials: {
        AccessKeyId: 'ASIATEST',
        SecretAccessKey: 'secretTest',
        SessionToken: 'tokenTest'
      }
    };

    const secretsManagerMock = {
      storeCredentialsInSecretsManager: jest.fn().mockResolvedValue(undefined)
    };

    beforeEach(() => {
      // Mock successful assume role for all tests
      stsMock.on(AssumeRoleCommand).resolves(testAssumeRoleResponse);
      secretsManagerMock.storeCredentialsInSecretsManager.mockClear();
    });

    test('should create new user when user does not exist', async () => {
      // Mock getIAMClientForAccount
      const assumedIamMock = mockClient(IAMClient);
      assumedIamMock
        .on(GetUserCommand).rejects({ name: 'NoSuchEntityException' })
        .on(CreateLoginProfileCommand).resolves({})
        .on(AttachUserPolicyCommand).resolves({})
        .on(CreateAccessKeyCommand).resolves({
          AccessKey: {
            AccessKeyId: testCredentials.accessKeyId,
            SecretAccessKey: testCredentials.secretAccessKey
          }
        });

      mockGeneratePassword.mockReturnValue(testCredentials.password);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(assumedIamMock, secretsManagerMock, stsMock);

      const result = await service.createIAMUser(testAccountId, testUsername);

      expect(result).toBe(true);
      expect(mockInfo).toHaveBeenCalledWith(
        `Creating IAM user ${testUsername} in account ${testAccountId}`
      );
      expect(mockInfo).toHaveBeenCalledWith(
        `User ${testUsername} does not exist in account ${testAccountId}. Creating new user...`
      );
      expect(secretsManagerMock.storeCredentialsInSecretsManager).toHaveBeenCalledWith(
        testAccountId,
        testUsername,
        expect.objectContaining({
          password: testCredentials.password,
          accessKeyId: testCredentials.accessKeyId,
          secretAccessKey: testCredentials.secretAccessKey
        })
      );
    });

    test('should handle existing user', async () => {
      const assumedIamMock = mockClient(IAMClient);
      assumedIamMock.on(GetUserCommand).resolves(testUser);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(assumedIamMock, secretsManagerMock, stsMock);

      const result = await service.createIAMUser(testAccountId, testUsername);

      expect(result).toBe(false);
      expect(mockInfo).toHaveBeenCalledWith(
        `IAM User already exists. Skipping user creation for ${testUsername} in account ${testAccountId}`
      );
      expect(secretsManagerMock.storeCredentialsInSecretsManager).not.toHaveBeenCalled();
    });

    test('should throw error on AWS failure', async () => {
      const error = new Error('AWS error');
      const assumedIamMock = mockClient(IAMClient);
      assumedIamMock.on(GetUserCommand).rejects(error);

      const { IAMService } = await import('./iamService.js');
      const service = new IAMService(assumedIamMock, secretsManagerMock, stsMock);

      await expect(service.createIAMUser(testAccountId, testUsername))
        .rejects.toThrow('AWS error');
      expect(mockError).toHaveBeenCalledWith(
        `Error creating user in account ${testAccountId}: AWS error`
      );
      expect(secretsManagerMock.storeCredentialsInSecretsManager).not.toHaveBeenCalled();
    });
  });
});
