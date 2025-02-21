import { STSClient } from '@aws-sdk/client-sts';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { exec } from 'child_process';
import logger from '../utils/logger.js';
import { DEFAULT_REGION } from '../constants.js';

export class SetupProfilesService {
  constructor(stsClient, secretsManagerClient) {
    if (!stsClient) {throw new Error('STSClient is required');}
    if (!secretsManagerClient) {throw new Error('SecretsManagerClient is required');}
    this.stsClient = stsClient;
    this.secretsManagerClient = secretsManagerClient;
  }

  async setupAwsProfile(accountConfig, liveAccountList, options) {
    try {
      // Find the matching account from live accounts
      const account = liveAccountList.find(
        acc => acc.Email.toLowerCase() === accountConfig.email.toLowerCase()
      );

      if (!account) {
        throw new Error(
          `Could not find AWS Organizations account with email ${accountConfig.email}`
        );
      }

      logger.info(`Getting existing credentials for user ${options.username} in account ${account.Id}`);
      const credentials = await this.secretsManagerClient.getExistingCredentials(
        account.Id, 
        options.username
      );

      if (!credentials) {
        throw new Error(
          `No credentials found for user ${options.username} in account ${account.Id}. ` +
          `Please run "accountfactory create-accounts --username ${options.username}" first to create the IAM user and store credentials.`
        );
      }

      // Run AWS configure commands to set up the profile
      const commands = [
        `aws configure set aws_access_key_id ${credentials.access_key_id} --profile ${accountConfig.profileName}`,
        `aws configure set aws_secret_access_key ${credentials.secret_access_key} --profile ${accountConfig.profileName}`,
        `aws configure set region ${DEFAULT_REGION} --profile ${accountConfig.profileName}`,
        `aws configure set output json --profile ${accountConfig.profileName}`,
      ];

      for (const command of commands) {
        await new Promise((resolve, reject) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              reject(error);
            }
            if (stderr) {
              reject(new Error(stderr));
            }
            resolve(stdout);
          });
        });
      }

      logger.success(`Successfully configured AWS profile '${accountConfig.profileName}' 🎉`);
      logger.info(`You can now use this profile with: aws --profile ${accountConfig.profileName} [command]`);
    } catch (error) {
      logger.error(`Failed to set up AWS profile: ${error.message}`);
      throw error;
    }
  }

}
