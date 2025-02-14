#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from './logger.js';

import {
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
  ListAccountsCommand,
  OrganizationsClient,
} from '@aws-sdk/client-organizations';
import { AssumeRoleCommand, GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreateLoginProfileCommand,
  GetUserCommand,
  IAMClient,
} from '@aws-sdk/client-iam';
import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import { join } from 'path';
import { readFile } from 'fs/promises';
import { writeFile as fsWriteFile } from 'node:fs/promises';

const APP_NAME = 'accountfactory';
const APP_VERSION = '0.0.9';
const ORGANIZATION_ROLE_NAME = 'OrganizationAccountAccessRole';
const execAsync = promisify(exec);

async function readOrgConfig() {
  try {
    const configPath = join(process.cwd(), 'accountfactory.json');
    const configContent = await readFile(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to read organization config: ${error.message}.

      Please ensure 'accountfactory.json' exists in the current directory and is valid JSON.

      See 'accountfactory.json.example' for an example configuration.
      `);
  }
}

const config = {
  environment: '',
  validEnvironments: ['global'],
  adminPolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
};

async function checkForTools(tools) {
  const checkPromises = tools.map(tool =>
    execAsync(`command -v ${tool}`).catch(() => {
      logger.error(`${tool} is required to run this script. Please install ${tool} and try again.`);
      logger.info(
        `You can install ${tool} by following the instructions here: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html`
      );
      throw new Error(`Missing required tool: ${tool}`);
    })
  );

  try {
    await Promise.all(checkPromises);
  } catch (error) {
    process.exit(1);
  }
}

function handleError(error) {
  logger.error(`Command failed: ${error.name}: ${error.message}`);
  if (error.stack) {
    logger.debug(error.stack);
  }
  process.exit(1);
}

const confirm = async message => {
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
};

async function initializeConfig() {
  try {
    // Get caller identity to validate AWS credentials and set account ID
    const callerIdentity = await getCallerIdentity();
    if (!callerIdentity.Account) {
      throw new Error('Failed to retrieve AWS account ID. Please check your AWS credentials.');
    }
    config.accountId = callerIdentity.Account;

    logger.info(`AWS account ID: ${config.accountId}`);
  } catch (error) {
    logger.error(`Failed to initialize config: ${error.message}`);
    throw error;
  }
}

async function getCallerIdentity(stsClientOverride) {
  try {
    const client = stsClientOverride || new STSClient();
    const getCallerIdentityCommand = new GetCallerIdentityCommand({});
    const response = await client.send(getCallerIdentityCommand);

    if (!response.Account) {
      throw new Error('Invalid response from GetCallerIdentity - missing Account ID');
    }

    if (response.Arn.endsWith(':root')) {
      logger.warning('Warning: Running as root user. Consider using an IAM user instead.');
    }

    return response;
  } catch (error) {
    logger.error(`Failed to get caller identity: ${error.message}`);
    throw error;
  }
}

async function readAccountFactoryConfig() {
  try {
    const configPath = join(process.cwd(), 'accountfactory.json');
    const configContent = await readFile(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to read account factory config: ${error.message}.

      Please ensure 'accountfactory.json' exists in the current directory and is valid JSON.

      See 'accountfactory.json.example' for an example configuration.
      `);
  }
}

async function createOrganizationAccount(email, accountName, roleName, client = null) {

  let orgClient;

  if (client === null) {
    orgClient = new OrganizationsClient();
  } else {
    orgClient = client;
  }

  const createAccountCommand = new CreateAccountCommand({
    Email: email,
    AccountName: accountName,
    RoleName: roleName,
  });
  const createAccountResponse = await orgClient.send(createAccountCommand);
  const statusId = createAccountResponse.CreateAccountStatus.Id;

  const describeAccountStatusCommand = new DescribeCreateAccountStatusCommand({
    CreateAccountRequestId: statusId,
  });
  const status = await orgClient.send(describeAccountStatusCommand);

  return status.CreateAccountStatus.AccountId;
}

async function pollAccountCreationStatus(organizationsClient, createAccountStatusId) {
  const MAX_POLLING_TIME = 600000; // 10 minutes
  const startTime = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startTime > MAX_POLLING_TIME) {
      throw new Error(`Account creation timed out after ${MAX_POLLING_TIME / 1000} seconds.`);
    }

    logger.info(`Polling account creation status (${createAccountStatusId})...`);
    const statusResponse = await organizationsClient.send(
      new DescribeCreateAccountStatusCommand({
        CreateAccountRequestId: createAccountStatusId,
      })
    );

    const status = statusResponse.CreateAccountStatus;
    logger.info(`Account creation status: ${status.State}`);

    if (status.State === 'SUCCEEDED') {
      logger.success(`Account created successfully! 🎉 Account ID: ${status.AccountId}`);
      return status.AccountId;
    } else if (status.State === 'FAILED') {
      if (status.FailureReason === 'EMAIL_ALREADY_EXISTS') {
        logger.error(
          'Account creation failed: The email already exists. Please use a different email.'
        );
        return null;
      }
      throw new Error(`Account creation failed: ${status.FailureReason}`);
    }

    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

async function listOrganizationsAccounts(organizationsClient = null) {
  try {
    const client = organizationsClient || new OrganizationsClient();

    let accounts = [];
    let nextToken;

    do {
      const response = await client.send(
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

async function createAccountWithRetry(email, accountName, client = null) {
  const MAX_RETRIES = 5;
  const INITIAL_DELAY = 1000;
  let retryCount = 0;

  let orgClient;

  if (client === null) {
    orgClient = new OrganizationsClient();
  }

  while (retryCount < MAX_RETRIES) {
    try {
      const createAccountStatusId = await createOrganizationAccount(
        email,
        accountName,
        ORGANIZATION_ROLE_NAME,
        orgClient
      );
      logger.info(`Account creation initiated with status ID: ${createAccountStatusId}`);

      return await pollAccountCreationStatus(orgClient, createAccountStatusId);
    } catch (error) {
      if (error.name === 'ConcurrentModificationException') {
        retryCount++;
        const delay = INITIAL_DELAY * Math.pow(2, retryCount);
        logger.warning(
          `Concurrent modification detected. Retrying in ${
            delay / 1000
          } seconds... (Attempt ${retryCount} of ${MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`Failed to create account: ${error.message}`);
        throw error;
      }
    }
  }

  throw new Error(
    `Failed to create account after ${MAX_RETRIES} retries due to concurrent modifications.`
  );
}

const generatePassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  // Ensure one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to make it more random
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

async function storeCredentialsInSecretsManager(
  accountId,
  username,
  credentials,
  secretsClient = null
) {
  try {
    // Create Secrets Manager client in the parent account
    const client = secretsClient || new SecretsManagerClient();

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
      await client.send(
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
        await client.send(
          new PutSecretValueCommand({
            SecretId: secretName,
            SecretString: secretValue,
          })
        );
        logger.success(`Updated credentials in parent account's Secrets Manager as ${secretName}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error(`Error storing credentials in Secrets Manager: ${error.message}`);
    throw error;
  }
}

async function getExistingCredentials(accountId, username, secretsClient = null) {
  try {
    const client = secretsClient || new SecretsManagerClient();

    const secretName = `iam-user/${accountId}/${username}`;
    logger.info(`Retrieving credentials from Secrets Manager for ${secretName}`);
    const response = await client.send(
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

async function getIAMClientForAccount(accountId, stsClient = null) {
  try {
    // Get STS client for assuming role
    const sts = stsClient || new STSClient();

    // Assume the OrganizationAccountAccessRole in target account
    const assumeRoleResponse = await sts.send(
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

async function checkIfUserExists(iamClient, username) {
  try {
    await iamClient.send(new GetUserCommand({ UserName: username }));
    return true;
  } catch (error) {
    if (error.name === 'NoSuchEntityException') {
      return false;
    }
    throw error;
  }
}

async function handleExistingUser(accountId, username) {
  logger.info(`Retrieving credentials for existing user...`);
  const existingCreds = await getExistingCredentials(accountId, username);

  if (existingCreds) {
    await displayCredentialInfo(accountId, username);
    return false;
  }

  logger.warning(`No credentials found in Secrets Manager for existing user, creating new ones...`);
  return true;
}

async function displayCredentialInfo(accountId, username) {
  const secretName = `iam-user/${accountId}/${username}`;
  const secretArn = `arn:aws:secretsmanager:${config.accountId}:secret:${secretName}`;

  logger.info(chalk.bold(`\nCredentials are stored in Secrets Manager:`));
  logger.info(`Secret ARN: ${secretArn}`);
  logger.info(`\nYou can retrieve the credentials using the AWS Console or CLI:`);
  logger.info(`aws secretsmanager get-secret-value --secret-id ${secretName}`);
  logger.info();
}

async function createNewUser(iamClient, username) {
  try {
    // Generate and set password
    const password = generatePassword();
    try {
      await iamClient.send(
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
      } else {
        throw error;
      }
    }

    // Attach admin policy
    await iamClient.send(
      new AttachUserPolicyCommand({
        UserName: username,
        PolicyArn: config.adminPolicyArn,
      })
    );

    // Create access key
    const accessKeyResponse = await iamClient.send(
      new CreateAccessKeyCommand({
        UserName: username,
      })
    );

    return {
      password: password || '**EXISTING PASSWORD NOT CHANGED**',
      accessKeyId: accessKeyResponse.AccessKey.AccessKeyId,
      secretAccessKey: accessKeyResponse.AccessKey.SecretAccessKey,
    };
  } catch (error) {
    logger.error(`Error creating new user: ${error.message}`);
    throw error;
  }
}

async function createIAMUser(accountId, username, stsClient = null) {
  try {
    logger.info(`Creating IAM user ${username} in account ${accountId}`);

    // Get IAM client for target account
    const iamClient = await getIAMClientForAccount(accountId, stsClient);

    // Check if user exists and handle accordingly
    const userExists = await checkIfUserExists(iamClient, username);
    if (userExists) {
      const shouldContinue = await handleExistingUser(accountId, username);
      if (!shouldContinue) {
        return false;
      }
    }

    // Create new user and get credentials
    const credentials = await createNewUser(iamClient, username);

    // Store credentials in Secrets Manager
    await storeCredentialsInSecretsManager(accountId, username, credentials);

    // Display credential information
    await displayCredentialInfo(accountId, username);

    return true;
  } catch (error) {
    logger.error(`Error creating user in account ${accountId}: ${error.message}`);
    throw error;
  }
}

async function setupAwsProfile(accountId, username, profileName, secretsClient = null) {
  try {
    const client = secretsClient || new SecretsManagerClient();

    const credentials = await getExistingCredentials(accountId, username, client);
    if (!credentials) {
      throw new Error(`No credentials found for user ${username} in account ${accountId}`);
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

async function handleListAccountsCommand() {
  try {
    await initializeConfig();
    const accountList = await listOrganizationsAccounts();
    if (accountList && accountList.length > 0) {
      // eslint-disable-next-line no-console
      console.table(accountList);
    } else {
      logger.info('No accounts found in AWS Organizations');
    }
  } catch (error) {
    handleError(error);
  }
}

async function handleCreateAccountsCommand(options) {
  config.environment = 'global';
  await printHeader();
  await confirm('Are you sure you want to create new accounts in AWS Organizations?');

  await initializeConfig();
  const liveAccountList = await listOrganizationsAccounts();

  const accountFactoryConfig = await readAccountFactoryConfig();

  if (accountFactoryConfig.accounts.length === 0) {
    logger.error('No accounts found in accountfactory.json');
    process.exit(1);
  }

  for (const environmentConfig of accountFactoryConfig.accounts) {

    console.log(`checking for ${environmentConfig.email}`);

    if (liveAccountList.some(account => account.Email === environmentConfig.email)) {
      logger.info(`Account ${environmentConfig.email} already exists in AWS Organizations. Skipping account creation...`);
      continue;
    }

    const accountId = await createAccountWithRetry(environmentConfig.email, environmentConfig.accountName);
    if (accountId) {
      logger.info('Waiting 30 seconds for account to be ready before creating IAM user...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      await createIAMUser(accountId, options.username);
    }

  }
}

async function handleSetupAwsProfilesCommand(options) {
  await checkForTools(['aws']);

  try {
    await initializeConfig();
    const accountList = await listOrganizationsAccounts();
    const accountFactoryConfig = await readAccountFactoryConfig();

    for (const environmentConfig of accountFactoryConfig.accounts) {
      const account = accountList.find((account) => account.Email.toLowerCase() === environmentConfig.email.toLowerCase());

      if (account) {
        logger.info(`Found AWS Organizations account with email ${environmentConfig.email} and profile name ${environmentConfig.profileName}`);
      }
      else if (!account) {
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

async function generateSkeleton() {
  const skeleton = {
    accounts: [
      {
        accountName: 'Shared Services',
        profileName: 'myappname-shared',
        email: 'sharedservices@example.com',
      },
      {
        accountName: 'Staging',
        profileName: 'myappname-staging',
        email: 'staging@example.com',
      },
      {
        accountName: 'Production',
        profileName: 'myappname-production',
        email: 'production@example.com',
      },
    ],
  };
  return JSON.stringify(skeleton, null, 2);
}

async function handleGenerateSkeletonCommand() {
  const skeleton = await generateSkeleton();
  fsWriteFile(join(process.cwd(), 'accountfactory.json'), skeleton);
}

async function printHeader() {
  // eslint-disable-next-line no-console
  await console.log(
    chalk.bgRed.white.bold(`
╔════════════════════════════════════════╗
║     AWS ORGANIZATIONS MANAGEMENT       ║
║        USE WITH EXTREME CARE           ║
╚════════════════════════════════════════╝`)
  );
}

async function main() {
  program.name(APP_NAME).description('AWS Infrastructure deployment tool').version(APP_VERSION);

  program
    .command('list-accounts')
    .description('📋 List accounts in the AWS Organization')
    .action(handleListAccountsCommand);

  program
    .command('generate-skeleton')
    .description('💀 Generate a skeleton accountfactory.json file')
    .action(handleGenerateSkeletonCommand);

  program
    .command('create-accounts')
    .description('🚀 Deploy accounts in the AWS Organization')
    .option('--username <username>', 'IAM username to create in each account', 'deploy')
    .action(handleCreateAccountsCommand);

  program
    .command('setup-aws-profiles')
    .description('🔧 Configure AWS profiles using creds from Secrets Manager')
    .option('--username <username>', 'IAM username to use', 'deploy')
    .option('--prefix <prefix>', 'Prefix for AWS profiles', 'accountfactory')
    .action(handleSetupAwsProfilesCommand);

  program.parse();
}

export {
  checkIfUserExists,
  getCallerIdentity,
  readOrgConfig,
  generatePassword,
  createOrganizationAccount,
  createAccountWithRetry,
  createIAMUser,
  listOrganizationsAccounts,
  handleError,
  checkForTools,
  pollAccountCreationStatus,
  getIAMClientForAccount,
};

export default main;

// Only run main when this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
