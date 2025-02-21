export class SetupProfilesService {
  constructor(client = null) {
    this.client = client || new STSClient();
  }

  async handleSetupAwsProfilesCommand(options) {
    try {
      await callGetCallerIdentity();
      const liveAccountList = await listOrganizationsAccounts();
      const accountFactoryConfig = await readAccountFactoryConfig();

      for (const environmentConfig of accountFactoryConfig.accounts) {
        const account = liveAccountList.find(
          account => account.Email.toLowerCase() === environmentConfig.email.toLowerCase()
        );

        if (account) {
          logger.info(
            `Found AWS Organizations account with email ${environmentConfig.email} and profile name ${environmentConfig.profileName}`
          );
        } else if (!account) {
          throw new Error(
            `Could not find AWS Organizations account with email ${environmentConfig.email}`
          );
        }
        await setupAwsProfile(account.Id, options.username, `${environmentConfig.profileName}`);
      }
    } catch (error) {
      handleError(error);
    }
  }

  async setupAwsProfile(accountId, username, profileName, secretsClient = null) {
    try {
      const client = secretsClient || new SecretsManagerClient();

      logger.info(`Getting existing credentials for user ${username} in account ${accountId}`);
      const credentials = await getExistingCredentials(accountId, username, client);

      if (!credentials) {
        throw new Error(
          `No credentials found for user ${username} in account ${accountId}. ` +
          'Please run "accountfactory create-accounts --username ' + username + '" first to create the IAM user and store credentials.'
        );
      }

      // Run AWS configure commands to set up the profile
      const commands = [
        `aws configure set aws_access_key_id ${credentials.access_key_id} --profile ${profileName}`,
        `aws configure set aws_secret_access_key ${credentials.secret_access_key} --profile ${profileName}`,
        `aws configure set region us-east-1 --profile ${profileName}`,
        `aws configure set output json --profile ${profileName}`,
      ];

      for (const command of commands) {
        const { stderr } = await new Promise((resolve, reject) => {
          exec(command, (error, stdout, stderr) => {
            if (error) {
              reject(error);
            }
            resolve({ stdout, stderr });
          });
        });

        if (stderr) {
          throw new Error(`Error running command ${command}: ${stderr}`);
        }
      }

      logger.success(`Successfully configured AWS profile '${profileName}' 🎉`);
      logger.info(`You can now use this profile with: aws --profile ${profileName} [command]`);
    } catch (error) {
      logger.error(`Failed to set up AWS profile: ${error.message}`);
      throw error;
    }
  }
}
