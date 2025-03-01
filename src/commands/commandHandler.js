import { STSService } from '../clients/stsService.js';
import { OrganizationsService } from '../clients/organizationsService.js';
import { configManager } from '../utils/config.js';
import { generateSkeletonService } from './generateSkeletonService.js';
import { createInterface } from 'readline';
import { IAMService } from '../clients/iamService.js';
import { SetupProfilesService } from './setupProfilesService.js';
import { SecretsManagerService } from '../clients/secretsManagerService.js';
import { logger } from "../utils/logger.js";


export class CommandHandler {
  constructor(organizationsClient, iamClient, stsClient, secretsManagerClient, injectedLogger = logger) {
    if (!organizationsClient) {
      throw new Error('OrganizationsClient is required');
    }
    if (!iamClient) {
      throw new Error('IAMClient is required');
    }
    if (!stsClient) {
      throw new Error('STSClient is required');
    }
    if (!secretsManagerClient) {
      throw new Error('SecretsManagerClient is required');
    }
    this.organizationsClient = organizationsClient;
    this.iamClient = iamClient;
    this.stsClient = stsClient;
    this.secretsManagerClient = secretsManagerClient;
    this.configManager = configManager;
    this.generateSkeletonService = generateSkeletonService;
    this.logger = injectedLogger;
    this.logger.debug('CommandHandler initialized with dependencies');
    this.stsService = new STSService(this.stsClient, this.logger);
    this.organizationsService = new OrganizationsService(this.organizationsClient, this.logger);
    this.iamService = new IAMService(this.iamClient, this.secretsManagerClient, this.stsClient, this.logger);
    this.setupProfilesService = new SetupProfilesService(this.stsClient, this.secretsManagerClient, this.logger);
    this.secretsManagerService = new SecretsManagerService(this.secretsManagerClient, this.logger);
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
      this.logger.debug('Listing accounts');
      await this.stsService.getCallerIdentity();
      const accountList = await this.organizationsService.listOrganizationsAccounts();
      if (accountList && accountList.length > 0) {
        // eslint-disable-next-line no-console
        console.table(accountList);
      } else {
        this.logger.info('No accounts found in AWS Organizations');
      }
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async handleListAccountsWithCredentials() {
    try {
      this.logger.debug('Listing accounts');
      await this.stsService.getCallerIdentity();
      const accountList = await this.organizationsService.listOrganizationsAccounts();
      for (const account of accountList) {
        const password = await this.secretsManagerService.getExistingCredentials(account.Id, 'deploy');
        this.logger.info(`${account.Id} - ${account.Email} - ${account.Status}`);
        this.logger.info(password);
      }
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async handleGenerateSkeleton() {
    this.logger.debug('Generating skeleton');
    const skeleton = await this.generateSkeletonService.generateSkeleton();
    this.logger.info(skeleton);
  }

  async handleCreateAccounts(options) {

    this.logger.debug('Creating accounts');

    try {
      if (options.skipConfirmation === false) {
        await this.confirm('Are you sure you want to create new accounts in AWS Organizations?');
      }

      await this.stsService.getCallerIdentity();

      const accountFactoryConfig = await this.configManager.readAccountFactoryConfig();

      if (accountFactoryConfig.accounts.length === 0) {
        this.logger.error('No accounts found in accountfactory.json');
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
          this.logger.info(`Account ${environmentConfig.email} created with ID ${accountId}`);
          await this.iamService.createIAMUser(accountId, options.username);
        }
      }
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  async handleSetupAwsProfiles(options) {
    try {
      await this.stsService.getCallerIdentity();
      const liveAccountList = await this.organizationsService.listOrganizationsAccounts();
      const config = await this.configManager.readAccountFactoryConfig();

      for (const accountConfig of config.accounts) {
        this.logger.info(`Setting up profiles for account ${accountConfig.email}`);
        await this.setupProfilesService.setupAwsProfile(accountConfig, liveAccountList, options);
      }
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`);
      process.exit(1);
    }
  }
}
