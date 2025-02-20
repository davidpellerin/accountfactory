#!/usr/bin/env node

import { APP_NAME, APP_VERSION } from './constants.js';
import { logger } from './utils/logger.js';
import { program } from 'commander';
import { CommandHandler } from './commands/commandHandler.js';
import { createAwsSTSClient } from './clients/stsService.js';
import { createAwsIAMClient } from './clients/iamService.js';
import { createAwsOrganizationsClient } from './clients/organizationsService.js';
import { createAwsSecretsManagerClient } from './clients/secretsManagerService.js';

async function main() {
  logger.debug('Initializing services...');

  // Initialize all clients and services
  const stsClient = createAwsSTSClient();
  const iamClient = createAwsIAMClient();
  const awsOrganizationsClient = createAwsOrganizationsClient();
  const secretsManagerClient = createAwsSecretsManagerClient();

  // Create command handler with dependencies
  const commandHandler = new CommandHandler(
    awsOrganizationsClient,
    iamClient,
    stsClient,
    secretsManagerClient
  );

  program.name(APP_NAME).description('AWS Infrastructure deployment tool').version(APP_VERSION);

  program
    .command('list-accounts')
    .description('📋 List accounts in the AWS Organization')
    .action(() => commandHandler.handleListAccounts());

  program
    .command('list-accounts-with-credentials')
    .description('🔑 List accounts with credentials from Secrets Manager')
    .action(() => commandHandler.handleListAccountsWithCredentials());

  program
    .command('generate-skeleton')
    .description('💀 Generate a skeleton accountfactory.json file')
    .action(() => commandHandler.handleGenerateSkeleton());

  program
    .command('create-accounts')
    .description('🚀 Deploy accounts in the AWS Organization')
    .option('--username <username>', 'IAM username to create in each account', 'deploy')
    .option('--overwrite', 'Overwrite existing accounts', false)
    .option('--skipconfirmation', 'Skip confirmation prompt', false)
    .action((options) => commandHandler.handleCreateAccounts(options));

  program
    .command('setup-aws-profiles')
    .description('🔧 Configure AWS profiles using creds from Secrets Manager')
    .option('--username <username>', 'IAM username to use', 'deploy')
    .action(() => commandHandler.handleSetupAwsProfiles());

  program.parse();
}

export default main;

// Only run main when this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    logger.debug(`Error stack: ${error.stack}`);
    process.exit(1);
  });
}
