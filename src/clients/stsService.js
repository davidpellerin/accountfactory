import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { Logger } from "../utils/logger.js";

const logger = new Logger();

// Factory function to create an STS client
export const createAwsSTSClient = () => {
  logger.debug('Creating AWS STSClient');
  return new STSClient();
};

export class STSService {
  constructor(stsClient, injectedLogger = logger) {
    if (!stsClient) {throw new Error('STSClient is required');}
    this.stsClient = stsClient;
    this.logger = injectedLogger;
    this.logger.debug('STSService initialized with all required dependencies');
  }

  async getCallerIdentity() {
    try {
      const getCallerIdentityCommand = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(getCallerIdentityCommand);

      if (!response.Account) {
        throw new Error('Failed to retrieve AWS account ID. Please check your AWS credentials.');
      }

      if (response.Arn.endsWith(':root')) {
        this.logger.warning('Warning: Running as root user. Consider using an IAM user instead.');
      }

      this.logger.info(`AWS account ID: ${response.Account}`);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get caller identity: ${error.message}`);
      throw error;
    }
  }
}
