export class CreateAccountsService {
  constructor(client = null) {
    this.client = client || new STSClient();
  }

  async handleCreateAccountsCommand(options) {
    config.environment = 'global';
    await printHeader();
    await confirm('Are you sure you want to create new accounts in AWS Organizations?');

    await callGetCallerIdentity();
    const liveAccountList = await listOrganizationsAccounts();

    const accountFactoryConfig = await readAccountFactoryConfig();

    if (accountFactoryConfig.accounts.length === 0) {
      logger.error('No accounts found in accountfactory.json');
      process.exit(1);
    }

    for (const environmentConfig of accountFactoryConfig.accounts) {
      logger.info(`checking for ${environmentConfig.email}`);

      if (
        liveAccountList.some(
          account => account.Email.toLowerCase() === environmentConfig.email.toLowerCase()
        )
      ) {
        logger.info(
          `Account ${environmentConfig.email} already exists in AWS Organizations. Skipping account creation...`
        );
        continue;
      }

      const accountId = await createAccountWithRetry(
        environmentConfig.email,
        environmentConfig.accountName
      );
      if (accountId) {
        logger.info('Waiting 30 seconds for account to be ready before creating IAM user...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        await createIAMUser(accountId, options.username);
      }
    }
  }

  async handleExistingUser(accountId, username) {
    logger.info(`Retrieving credentials for existing user...`);
    const existingCreds = await getExistingCredentials(accountId, username);

    if (existingCreds) {
      await displayCredentialInfo(accountId, username);
      return false;
    }

    logger.warning(
      `No credentials found in Secrets Manager for existing user, creating new ones...`
    );
    return true;
  }

  async displayCredentialInfo(accountId, username) {
    const secretName = `iam-user/${accountId}/${username}`;
    const secretArn = `arn:aws:secretsmanager:${config.accountId}:secret:${secretName}`;

    logger.info(chalk.bold(`\nCredentials are stored in Secrets Manager:`));
    logger.info(`Secret ARN: ${secretArn}`);
    logger.info(`\nYou can retrieve the credentials using the AWS Console or CLI:`);
    logger.info(`aws secretsmanager get-secret-value --secret-id ${secretName}`);
    logger.info();
  }
}

export const createAccountsService = new CreateAccountsService();