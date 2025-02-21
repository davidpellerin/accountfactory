import logger from '../utils/logger.js';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

// Factory function to create an STS client
export const createAwsSTSClient = () => {
  logger.debug('Creating AWS STSClient');
  return new STSClient();
};

export class STSService {
  constructor(stsClient) {
    if (!stsClient) {throw new Error('STSClient is required');}
    this.stsClient = stsClient;
    logger.debug('STSService constructor called');
  }

  async getCallerIdentity() {
    try {
      const getCallerIdentityCommand = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(getCallerIdentityCommand);

      if (!response.Account) {
        throw new Error('Failed to retrieve AWS account ID. Please check your AWS credentials.');
      }

      if (response.Arn.endsWith(':root')) {
        logger.warning('Warning: Running as root user. Consider using an IAM user instead.');
      }

      logger.info(`AWS account ID: ${response.Account}`);
      return response;
    } catch (error) {
      logger.error(`Failed to get caller identity: ${error.message}`);
      throw error;
    }
  }
}
