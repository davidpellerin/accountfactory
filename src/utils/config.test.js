import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { join } from 'path';

const mockReadFile = jest.fn();

jest.unstable_mockModule('fs/promises', () => ({
  readFile: mockReadFile,
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  test('should successfully read and parse config file', async () => {
    const mockConfigData = {
      someKey: 'someValue',
      anotherKey: 123,
    };

    mockReadFile.mockResolvedValue(JSON.stringify(mockConfigData));

    const { ConfigManager } = await import('./config.js');
    const configManager = new ConfigManager();

    const result = await configManager.readAccountFactoryConfig();

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(join(process.cwd(), 'accountfactory.json'), 'utf8');
    expect(result).toEqual(mockConfigData);
  });

  test('should throw error when config file does not exist', async () => {
    const errorMessage = 'ENOENT: no such file or directory';
    mockReadFile.mockRejectedValue(new Error(errorMessage));

    const { ConfigManager } = await import('./config.js');
    const configManager = new ConfigManager();

    await expect(async () => {
      await configManager.readAccountFactoryConfig();
    }).rejects.toThrow(/Failed to read account factory config/);

    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  test('should throw error when config file contains invalid JSON', async () => {
    mockReadFile.mockResolvedValue('{ invalid: json }');

    const { ConfigManager } = await import('./config.js');
    const configManager = new ConfigManager();

    await expect(async () => {
      await configManager.readAccountFactoryConfig();
    }).rejects.toThrow(/Failed to read account factory config/);

    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });
});
