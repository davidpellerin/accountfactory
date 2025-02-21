import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import logger from '../utils/logger.js';

export const createAwsSecretsManagerClient = () => {
  logger.debug('Creating AWS SecretsManagerClient');
  return new SecretsManagerClient({ region: 'us-east-1' });
};

export class SecretsManagerService {
  constructor(secretsManagerClient) {
    if (!secretsManagerClient) {throw new Error('SecretsManagerClient is required');}
    this.client = secretsManagerClient;
    logger.debug('SecretsManagerService initialized with all required dependencies');
  }

  async storeCredentialsInSecretsManager(accountId, username, credentials) {
    try {
      // Use a more descriptive secret name that includes the account ID
      const secretName = `iam-user/${accountId}/${username}`;
      const secretValue = JSON.stringify({
        username,
        password: credentials.password,
        access_key_id: credentials.accessKeyId,
        secret_access_key: credentials.secretAccessKey,
        account_id: accountId,
        console_url: `https://${accountId}.signin.aws.amazon.com/console`,
      });

      try {
        // Try to create a new secret
        await this.client.send(
          new CreateSecretCommand({
            Name: secretName,
            SecretString: secretValue,
            Description: `Credentials for IAM user ${username} in account ${accountId}`,
            Tags: [
              {
                Key: 'AccountId',
                Value: accountId,
              },
              {
                Key: 'Username',
                Value: username,
              },
            ],
          })
        );
        logger.success(`Stored credentials in parent account's Secrets Manager as ${secretName}`);
      } catch (error) {
        if (error.name === 'ResourceExistsException') {
          // If secret exists, update it
          await this.client.send(
            new PutSecretValueCommand({
              SecretId: secretName,
              SecretString: secretValue,
            })
          );
          logger.success(
            `Updated credentials in parent account's Secrets Manager as ${secretName}`
          );
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.error(`Error storing credentials in Secrets Manager: ${error.message}`);
      throw error;
    }
  }

  async getExistingCredentials(accountId, username) {
    try {
      const secretName = `iam-user/${accountId}/${username}`;
      logger.info(`Retrieving credentials from Secrets Manager for ${secretName}`);
      const response = await this.client.send(
        new GetSecretValueCommand({
          SecretId: secretName,
        })
      );

      return JSON.parse(response.SecretString);
    } catch (error) {
      logger.warning(`No existing credentials found in Secrets Manager: ${error.message}`);
      return null;
    }
  }
}
