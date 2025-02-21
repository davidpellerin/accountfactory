import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreateLoginProfileCommand,
  GetUserCommand,
  IAMClient,
} from '@aws-sdk/client-iam';
import { AssumeRoleCommand } from '@aws-sdk/client-sts';
import logger from '../utils/logger.js';
import { ADMIN_POLICY_ARN, ORGANIZATION_ROLE_NAME } from '../constants.js';
import { PasswordService } from '../utils/passwordService.js';

// Factory function to create an IAM client
export const createAwsIAMClient = () => {
  logger.debug('Creating AWS IAMClient');
  return new IAMClient();
};

export class IAMService {
  constructor(iamClient, secretsManagerClient, stsClient) {
    if (!iamClient) {
      throw new Error('IAMClient is required');
    }
    if (!secretsManagerClient) {
      throw new Error('SecretsManagerClient is required');
    }
    if (!stsClient) {
      throw new Error('STSClient is required');
    }
    this.iamClient = iamClient;
    this.secretsManagerClient = secretsManagerClient;
    this.stsClient = stsClient;
    logger.debug('IAMService initialized with all required dependencies');
  }

  async createNewUser(username) {
    try {
      let password;
      // Generate and set password
      try {
        password = PasswordService.generatePassword();
        await this.iamClient.send(
          new CreateLoginProfileCommand({
            UserName: username,
            Password: password,
            PasswordResetRequired: true,
          })
        );
      } catch (error) {
        if (error?.name === 'EntityAlreadyExists' || error?.$metadata?.httpStatusCode === 409) {
          logger.warning(
            `Login profile already exists for user ${username}, skipping password creation`
          );
          password = '**EXISTING PASSWORD NOT CHANGED**';
        } else {
          throw error;
        }
      }

      // Attach admin policy
      await this.iamClient.send(
        new AttachUserPolicyCommand({
          UserName: username,
          PolicyArn: ADMIN_POLICY_ARN,
        })
      );

      // Create access key
      const accessKeyResponse = await this.iamClient.send(
        new CreateAccessKeyCommand({
          UserName: username,
        })
      );

      return {
        password,
        accessKeyId: accessKeyResponse.AccessKey.AccessKeyId,
        secretAccessKey: accessKeyResponse.AccessKey.SecretAccessKey,
      };
    } catch (error) {
      logger.error(`Error creating new user: ${error.message}`);
      throw error;
    }
  }

  async checkIfIamUserExists(username) {
    try {
      await this.iamClient.send(new GetUserCommand({ UserName: username }));
      return true;
    } catch (error) {
      if (error.name === 'NoSuchEntityException') {
        return false;
      }
      throw error;
    }
  }

  async createIAMUser(accountId, username) {
    try {
      logger.info(`Creating IAM user ${username} in account ${accountId}`);

      await this.getIAMClientForAccount(accountId);

      // Check if user exists and handle accordingly
      const userExists = await this.checkIfIamUserExists(username);
      if (userExists) {
        logger.info(
          `IAM User already exists. Skipping user creation for ${username} in account ${accountId}`
        );
        return false;
      } else {
        logger.info(
          `User ${username} does not exist in account ${accountId}. Creating new user...`
        );

        // Create new user and get credentials
        logger.info(`Creating new user ${username} in account ${accountId}`);
        const credentials = await this.createNewUser(username);

        // Store credentials in Secrets Manager
        logger.info(
          `Storing credentials in Secrets Manager for user ${username} in account ${accountId}`
        );
        await this.secretsManagerClient.storeCredentialsInSecretsManager(
          accountId,
          username,
          credentials
        );

        return true;
      }
    } catch (error) {
      logger.error(`Error creating user in account ${accountId}: ${error.message}`);
      throw error;
    }
  }

  async getIAMClientForAccount(accountId) {
    try {
      // Assume the OrganizationAccountAccessRole in target account
      const assumeRoleResponse = await this.stsClient.send(
        new AssumeRoleCommand({
          RoleArn: `arn:aws:iam::${accountId}:role/${ORGANIZATION_ROLE_NAME}`,
          RoleSessionName: 'CreateIAMUser',
          DurationSeconds: 3600,
        })
      );

      // Return IAM client with temporary credentials
      return new IAMClient({
        credentials: {
          accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
          secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
          sessionToken: assumeRoleResponse.Credentials.SessionToken,
        },
      });
    } catch (error) {
      logger.error(`Failed to get IAM client for account ${accountId}: ${error.message}`);
      throw error;
    }
  }
}
