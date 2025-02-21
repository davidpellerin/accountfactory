import { logger } from '../utils/logger.js';
import { STSService } from '../clients/stsService.js';
import { OrganizationsService } from '../clients/organizationsService.js';
import { configManager } from '../utils/config.js';
import { generateSkeletonService } from './generateSkeletonService.js';
import { createInterface } from 'readline';
import { IAMService } from '../clients/iamService.js';
import { SetupProfilesService } from './setupProfilesService.js';
import { SecretsManagerService } from '../clients/secretsManagerService.js';

export class CommandHandler {
  constructor(organizationsClient, iamClient, stsClient, secretsManagerClient) {
    this.organizationsClient = organizationsClient;
    this.iamClient = iamClient;
    this.stsClient = stsClient;
    this.secretsManagerClient = secretsManagerClient;
    this.configManager = configManager;
    this.generateSkeletonService = generateSkeletonService;
    logger.debug('CommandHandler initialized with dependencies');
    this.stsService = new STSService(this.stsClient);
    this.organizationsService = new OrganizationsService(this.organizationsClient);
    this.iamService = new IAMService(this.iamClient);
    this.setupProfilesService = new SetupProfilesService(this.stsClient, this.secretsManagerClient);
    this.secretsManagerService = new SecretsManagerService(this.secretsManagerClient);
  }

  async confirm(message) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(`${message} [y/N] `, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  async handleListAccounts() {
    try {
      logger.debug('Listing accounts');
      await this.stsService.getCallerIdentity();
      const accountList = await this.organizationsService.listOrganizationsAccounts();
      if (accountList && accountList.length > 0) {
        // eslint-disable-next-line no-console
        console.table(accountList);
      } else {
        logger.info('No accounts found in AWS Organizations');
      }
    } catch (error) {
      logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async handleListAccountsWithCredentials() {
    try {
      logger.debug('Listing accounts');
      await this.stsService.getCallerIdentity();
      const accountList = await this.organizationsService.listOrganizationsAccounts();
      for (const account of accountList) {
        const password = await this.secretsManagerService.getExistingCredentials(account.Id, 'deploy');
        logger.info(`${account.Id} - ${account.Email} - ${account.Status}`);
        logger.info(password);
      }
    } catch (error) {
      logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async handleGenerateSkeleton() {
    logger.debug('Generating skeleton');
    const skeleton = await this.generateSkeletonService.generateSkeleton();
    logger.info(skeleton);
  }

  async handleCreateAccounts(options) {

    logger.debug('Creating accounts');

    try {
      if (options.skipConfirmation === false) {
        await this.confirm('Are you sure you want to create new accounts in AWS Organizations?');
      }

      await this.stsService.getCallerIdentity();

      const accountFactoryConfig = await this.configManager.readAccountFactoryConfig();

      if (accountFactoryConfig.accounts.length === 0) {
        logger.error('No accounts found in accountfactory.json');
        process.exit(1);
      }

      for (const environmentConfig of accountFactoryConfig.accounts) {
        const accountId = await this.organizationsService.createAccount(
          environmentConfig.email,
          environmentConfig.accountName,
          "OrganizationAccountAccessRole",
          options.overwrite
        );

        if (accountId) {
          logger.info(`Account ${environmentConfig.email} created with ID ${accountId}`);
          await this.iamService.createIAMUser(accountId, options.username);
        }
      }
    } catch (error) {
      logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async handleSetupAwsProfiles(options) {
    try {
      await this.stsService.getCallerIdentity();
      const liveAccountList = await this.organizationsService.listOrganizationsAccounts();
      const config = await this.configManager.readAccountFactoryConfig();

      for (const accountConfig of config.accounts) {
        logger.info(`Setting up profiles for account ${accountConfig.email}`);

        // accountName = 'Shared Services'
        // email = 'owlsignalsshared@owlalerts.xyz'
        // profileName = 'owlsignals-shared'

        await this.setupProfilesService.setupAwsProfile(accountConfig, liveAccountList, options);
      }
    } catch (error) {
      logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }
}
