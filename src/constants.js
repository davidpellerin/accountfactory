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
export const MAX_POLLING_TIME = 600000; // 10 minutes
export const ACCOUNT_READY_WAIT_TIME = 30000; // 30 seconds

/**
 * Environment configurations
 */
export const VALID_ENVIRONMENTS = ['global'];
export const ENV_ENABLE_LOGGING = 'ACCOUNTFACTORY_ENABLE_LOGGING';

/**
 * AWS CLI output formats
 */
export const CLI_OUTPUT_FORMAT = 'json';

/**
 * Secret naming patterns
 */
export const SECRET_NAME_PREFIX = 'iam-user';
export const SECRET_NAME_PATTERN = `${SECRET_NAME_PREFIX}/%s/%s`; // accountId/username

/**
 * Password generation configuration
 */
export const PASSWORD_LENGTH = 12;
export const PASSWORD_CHARS = {
  UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
  NUMBERS: '0123456789',
  SPECIAL: '!@#$%^&*'
};
