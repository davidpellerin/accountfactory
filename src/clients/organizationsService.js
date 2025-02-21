import {
  OrganizationsClient,
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
  ListAccountsCommand,
} from '@aws-sdk/client-organizations';
import logger from '../utils/logger.js';
import {
  ORGANIZATION_ROLE_NAME,
  MAX_ACCOUNT_CREATION_RETRIES,
  INITIAL_RETRY_DELAY,
} from '../constants.js';

// Factory function to create an Organizations client
export const createAwsOrganizationsClient = () => {
  logger.debug('Creating AWS OrganizationsClient');
  return new OrganizationsClient();
};

export class OrganizationsService {
  constructor(organizationsClient, delayBetweenOperations = 15000) {
    if (!organizationsClient) throw new Error('OrganizationsClient is required');
    this.client = organizationsClient;
    this.DELAY_BETWEEN_OPERATIONS = delayBetweenOperations;
    logger.debug('OrganizationsService constructor called');
  }

  async #createOrganizationAccount(email, accountName, roleName) {
    const createAccountCommand = new CreateAccountCommand({
      Email: email,
      AccountName: accountName,
      RoleName: roleName,
    });
    const createAccountResponse = await this.client.send(createAccountCommand);
    const statusId = createAccountResponse.CreateAccountStatus.Id;

    return statusId;
  }

  async describeCreateAccountStatus(statusId) {
    const describeAccountStatusCommand = new DescribeCreateAccountStatusCommand({
      CreateAccountRequestId: statusId,
    });
    const status = await this.client.send(describeAccountStatusCommand);

    return status.CreateAccountStatus;
  }

  async createAccount(email, accountName, roleName, overwrite = false) {
    logger.debug(`Starting account creation process for ${email}`);

    // Check if account exists
    if (overwrite !== true) {
      const exists = await this.accountExists(email);
      if (exists) {
        logger.info(`Account ${email} already exists. Skipping creation...`);
        return null;
      }
    }

    // Create the account
    const createAccountId = await this.#createOrganizationAccount(email, accountName, roleName);
    logger.info(`Account creation initiated: ${createAccountId}`);

    // Poll for completion
    const accountStatus = await this.pollAccountCreation(createAccountId);

    if (accountStatus.State === 'SUCCEEDED') {
      logger.info('Account creation succeeded');
    } else {
      logger.error(`Account creation failed: ${accountStatus.FailureReason}`);
    }

    // Wait before creating the next account
    await this.waitForNextOperation();

    return accountStatus.State === 'SUCCEEDED' ? accountStatus.AccountId : null;
  }

  async pollAccountCreation(createAccountId, delay = 1000) {
    let accountStatus = { State: 'STARTED' };

    while (accountStatus.State !== 'SUCCEEDED' && accountStatus.State !== 'FAILED') {
      logger.debug(`Polling account creation status (${createAccountId})...`);
      accountStatus = await this.describeCreateAccountStatus(createAccountId);
      logger.debug(`Account Status: ${JSON.stringify(accountStatus)}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return accountStatus;
  }

  async listOrganizationsAccounts() {
    try {
      let accounts = [];
      let nextToken;

      do {
        const response = await this.client.send(
          new ListAccountsCommand({
            NextToken: nextToken,
          })
        );
        accounts = accounts.concat(response.Accounts || []);
        nextToken = response.NextToken;
      } while (nextToken);

      const accountDetails = accounts.map(({ Email, Id, Status }) => ({
        Email,
        Id,
        Status,
      }));

      return accountDetails;
    } catch (error) {
      if (error.name === 'AccessDeniedException') {
        logger.error(
          'Access Denied. This account does not have permissions to list or create accounts in AWS Organizations. Please use a profile with the required permissions.'
        );
        process.exit(1);
      }
      throw error;
    }
  }

  async accountExists(email) {
    const accounts = await this.listOrganizationsAccounts();
    return accounts.some(account => account.Email.toLowerCase() === email.toLowerCase());
  }

  async waitForNextOperation() {
    const delayInSeconds = this.DELAY_BETWEEN_OPERATIONS / 1000;
    logger.info(`Waiting ${delayInSeconds} seconds before next operation...`);
    await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_OPERATIONS));
  }
}
