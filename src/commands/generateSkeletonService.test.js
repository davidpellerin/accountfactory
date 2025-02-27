import { beforeEach, describe, expect, test } from '@jest/globals';

describe('GenerateSkeletonService', () => {
  let generateSkeletonService;

  beforeEach(async () => {
    const module = await import('./generateSkeletonService.js');
    generateSkeletonService = module.generateSkeletonService;
  });

  test('should generate a skeleton JSON with predefined accounts', async () => {
    const result = await generateSkeletonService.generateSkeleton();
    const parsedResult = JSON.parse(result);

    expect(parsedResult).toHaveProperty('accounts');
    expect(Array.isArray(parsedResult.accounts)).toBe(true);
    expect(parsedResult.accounts).toHaveLength(3);

    // Verify the first account (Shared Services)
    expect(parsedResult.accounts[0]).toEqual({
      accountName: 'Shared Services',
      profileName: 'myappname-shared',
      email: 'sharedservices@example.com',
    });

    // Verify the second account (Staging)
    expect(parsedResult.accounts[1]).toEqual({
      accountName: 'Staging',
      profileName: 'myappname-staging',
      email: 'staging@example.com',
    });

    // Verify the third account (Production)
    expect(parsedResult.accounts[2]).toEqual({
      accountName: 'Production',
      profileName: 'myappname-production',
      email: 'production@example.com',
    });
  });

  test('should return a properly formatted JSON string', async () => {
    const result = await generateSkeletonService.generateSkeleton();

    expect(typeof result).toBe('string');
    expect(() => JSON.parse(result)).not.toThrow();

    const expectedIndentation = JSON.stringify(JSON.parse(result), null, 2);
    expect(result).toBe(expectedIndentation);
  });
});
