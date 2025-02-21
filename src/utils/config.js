import { readFile } from 'fs/promises';
import { join } from 'path';

export class ConfigManager {
  async readAccountFactoryConfig() {
    try {
      const configPath = join(process.cwd(), 'accountfactory.json');
      const configContent = await readFile(configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      throw new Error(`Failed to read account factory config: ${error.message}.

              Please ensure 'accountfactory.json' exists in the current directory and is valid JSON.

              See 'accountfactory.json.example' for an example configuration.`);
    }
  }
}

export const configManager = new ConfigManager();
