import logger from './logger.js';

export async function checkForTools(tools) {
  const checkPromises = tools.map(tool =>
    execAsync(`command -v ${tool}`).catch(() => {
      logger.error(`${tool} is required to run this script. Please install ${tool} and try again.`);
      throw new Error(`Missing required tool: ${tool}`);
    })
  );

  try {
    await Promise.all(checkPromises);
  } catch (error) {
    process.exit(1);
  }
}
