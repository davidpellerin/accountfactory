/**
 * Application metadata
 */
export const APP_NAME = 'accountfactory';
export const APP_VERSION = '0.0.12';

/**
 * AWS specific constants
 */
export const ORGANIZATION_ROLE_NAME = 'OrganizationAccountAccessRole';
export const DEFAULT_REGION = 'us-east-1';
export const ADMIN_POLICY_ARN = 'arn:aws:iam::aws:policy/AdministratorAccess';

/**
 * Retry and timeout configurations
 */
export const MAX_ACCOUNT_CREATION_RETRIES = 5;
export const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Environment configurations
 */
export const ENV_ENABLE_LOGGING = 'ACCOUNTFACTORY_ENABLE_LOGGING';

/**
 * Secret naming patterns
 */
export const SECRET_NAME_PREFIX = 'iam-user';
export const SECRET_NAME_PATTERN = `${SECRET_NAME_PREFIX}/%s/%s`; // accountId/username
