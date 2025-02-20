export class GenerateSkeletonService {
  async generateSkeleton() {
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
}

export const generateSkeletonService = new GenerateSkeletonService();
