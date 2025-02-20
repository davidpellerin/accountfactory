import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const secretsManagerMock = mockClient(SecretsManagerClient);

describe('SecretsManagerService', () => {
  beforeEach(() => {
    secretsManagerMock.reset();
  });

  describe('constructor', () => {
    test('should throw error when client is not provided', async () => {
      const { SecretsManagerService } = await import('./secretsManagerService.js');
      expect(() => new SecretsManagerService()).toThrow('SecretsManagerClient is required');
    });

    test('should create instance when client is provided', async () => {
      const { SecretsManagerService } = await import('./secretsManagerService.js');
      expect(() => new SecretsManagerService(secretsManagerMock)).not.toThrow();
    });
  });

  describe('storeCredentialsInSecretsManager', () => {
    const testAccountId = '123456789012';
    const testUsername = 'testUser';
    const testCredentials = {
      password: 'testPassword',
      accessKeyId: 'AKIATEST',
      secretAccessKey: 'secretTest',
    };
    const expectedSecretName = `iam-user/${testAccountId}/${testUsername}`;
    const expectedSecretValue = JSON.stringify({
      username: testUsername,
      password: testCredentials.password,
      access_key_id: testCredentials.accessKeyId,
      secret_access_key: testCredentials.secretAccessKey,
      account_id: testAccountId,
      console_url: `https://${testAccountId}.signin.aws.amazon.com/console`,
    });

    test('should create new secret when it does not exist', async () => {
      secretsManagerMock.on(CreateSecretCommand).resolves({});

      const { SecretsManagerService } = await import('./secretsManagerService.js');
      const service = new SecretsManagerService(secretsManagerMock);

      await service.storeCredentialsInSecretsManager(testAccountId, testUsername, testCredentials);

      const calls = secretsManagerMock.calls();
      expect(calls).toHaveLength(1);

      const createCall = calls[0];
      expect(createCall.args[0].constructor.name).toBe('CreateSecretCommand');
      expect(createCall.args[0].input).toEqual({
        Name: expectedSecretName,
        SecretString: expectedSecretValue,
        Description: `Credentials for IAM user ${testUsername} in account ${testAccountId}`,
        Tags: [
          { Key: 'AccountId', Value: testAccountId },
          { Key: 'Username', Value: testUsername },
        ],
      });
    });

    test('should update existing secret when it already exists', async () => {
      secretsManagerMock
        .on(CreateSecretCommand).rejects({ name: 'ResourceExistsException' })
        .on(PutSecretValueCommand).resolves({});

      const { SecretsManagerService } = await import('./secretsManagerService.js');
      const service = new SecretsManagerService(secretsManagerMock);

      await service.storeCredentialsInSecretsManager(testAccountId, testUsername, testCredentials);

      const calls = secretsManagerMock.calls();
      expect(calls).toHaveLength(2);

      const putCall = calls[1];
      expect(putCall.args[0].constructor.name).toBe('PutSecretValueCommand');
      expect(putCall.args[0].input).toEqual({
        SecretId: expectedSecretName,
        SecretString: expectedSecretValue,
      });
    });

    test('should throw error when AWS operation fails', async () => {
      const errorMessage = 'AWS operation failed';
      secretsManagerMock
        .on(CreateSecretCommand).rejects(new Error(errorMessage));

      const { SecretsManagerService } = await import('./secretsManagerService.js');
      const service = new SecretsManagerService(secretsManagerMock);

      await expect(
        service.storeCredentialsInSecretsManager(testAccountId, testUsername, testCredentials)
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('getExistingCredentials', () => {
    const testAccountId = '123456789012';
    const testUsername = 'testUser';
    const testSecretData = {
      username: testUsername,
      password: 'testPassword',
      access_key_id: 'AKIATEST',
      secret_access_key: 'secretTest',
      account_id: testAccountId,
      console_url: `https://${testAccountId}.signin.aws.amazon.com/console`,
    };

    test('should return credentials when secret exists', async () => {
      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify(testSecretData),
      });

      const { SecretsManagerService } = await import('./secretsManagerService.js');
      const service = new SecretsManagerService(secretsManagerMock);

      const result = await service.getExistingCredentials(testAccountId, testUsername);

      expect(result).toEqual(testSecretData);

      const calls = secretsManagerMock.calls();
      expect(calls).toHaveLength(1);

      const getCall = calls[0];
      expect(getCall.args[0].constructor.name).toBe('GetSecretValueCommand');
      expect(getCall.args[0].input).toEqual({
        SecretId: `iam-user/${testAccountId}/${testUsername}`,
      });
    });

    test('should return null when secret does not exist', async () => {
      secretsManagerMock.on(GetSecretValueCommand).rejects(new Error('Secret not found'));

      const { SecretsManagerService } = await import('./secretsManagerService.js');
      const service = new SecretsManagerService(secretsManagerMock);

      const result = await service.getExistingCredentials(testAccountId, testUsername);

      expect(result).toBeNull();
    });
  });
});