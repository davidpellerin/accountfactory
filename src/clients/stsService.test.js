import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { createTestLogger } from '../utils/testLogger.js';

let testLogger;
const stsClientMock = mockClient(STSClient);

describe('STSService', () => {
  beforeEach(() => {
    stsClientMock.reset();
    testLogger = createTestLogger();
  });

  describe('createAwsSTSClient', () => {
    test('should create and return a new STSClient', async () => {
      const { createAwsSTSClient } = await import('./stsService.js');
      const client = createAwsSTSClient();
      expect(client).toBeInstanceOf(STSClient);
    });
  });

  describe('constructor', () => {
    test('should throw error when stsClient is not provided', async () => {
      const { STSService } = await import('./stsService.js');
      expect(() => new STSService()).toThrow('STSClient is required');
    });

    test('should create instance when stsClient is provided', async () => {
      const { STSService } = await import('./stsService.js');
      expect(() => new STSService(stsClientMock, testLogger)).not.toThrow();
      const logs = testLogger.getLogEntries();
      expect(logs).toHaveLength(1);
      expect(logs).toContainEqual({ level: 'debug', message: 'STSService initialized with all required dependencies' });
    });
  });

  describe('getCallerIdentity', () => {
    test('should return caller identity when request succeeds', async () => {
      const mockResponse = {
        Account: '123456789012',
        Arn: 'arn:aws:iam::123456789012:user/test-user',
        UserId: 'AIDAXXXXXXXXXXXXXXXX'
      };

      stsClientMock.on(GetCallerIdentityCommand).resolves(mockResponse);

      const { STSService } = await import('./stsService.js');
      const stsService = new STSService(stsClientMock, testLogger);

      const result = await stsService.getCallerIdentity();

      expect(result).toEqual(mockResponse);
      expect(stsClientMock.calls()).toHaveLength(1);
      const call = stsClientMock.calls()[0];
      expect(call.args[0].constructor.name).toBe('GetCallerIdentityCommand');

      const logs = testLogger.getLogEntries();
      expect(logs).toHaveLength(2);
      expect(logs).toContainEqual({ level: 'info', message: `AWS account ID: ${mockResponse.Account}` });
    });

    test('should log warning when running as root user', async () => {
      const mockResponse = {
        Account: '123456789012',
        Arn: 'arn:aws:iam::123456789012:root',
        UserId: 'AIDAXXXXXXXXXXXXXXXX'
      };

      stsClientMock.on(GetCallerIdentityCommand).resolves(mockResponse);

      const { STSService } = await import('./stsService.js');
      const stsService = new STSService(stsClientMock, testLogger);

      const result = await stsService.getCallerIdentity();

      expect(result).toEqual(mockResponse);
      const logs = testLogger.getLogEntries();
      expect(logs).toHaveLength(3);
      expect(logs).toContainEqual({ level: 'warning', message: `Warning: Running as root user. Consider using an IAM user instead.` });
    });

    test('should throw error when account ID is missing', async () => {
      const mockResponse = {
        Arn: 'arn:aws:iam::123456789012:user/test-user',
        UserId: 'AIDAXXXXXXXXXXXXXXXX'
      };

      stsClientMock.on(GetCallerIdentityCommand).resolves(mockResponse);

      const { STSService } = await import('./stsService.js');
      const stsService = new STSService(stsClientMock);

      await expect(stsService.getCallerIdentity()).rejects.toThrow(
        'Failed to retrieve AWS account ID. Please check your AWS credentials.'
      );
    });

    test('should throw error when AWS request fails', async () => {
      const errorMessage = 'AWS request failed';
      const mockErr = new Error(errorMessage);
      stsClientMock.on(GetCallerIdentityCommand).rejects(mockErr);

      const { STSService } = await import('./stsService.js');
      const stsService = new STSService(stsClientMock, testLogger);

      await expect(stsService.getCallerIdentity()).rejects.toThrow(errorMessage);

      const logs = testLogger.getLogEntries();
      expect(logs).toHaveLength(2);
      expect(logs).toContainEqual({ level: 'error', message: `Failed to get caller identity: ${errorMessage}` });
    });
  });
});
