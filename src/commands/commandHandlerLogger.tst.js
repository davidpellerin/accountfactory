import { CommandHandler } from './commandHandler';
import { logger } from '../utils/logger';

describe('CommandHandler', () => {
  let commandHandler;

  beforeEach(() => {
    // Mock the logger
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();

    // Initialize the command handler with mock dependencies
    commandHandler = new CommandHandler(null, null, null, null, logger);
  });

  it('should set the log level when loglevel option is provided', async () => {
    const options = { loglevel: 'debug' };
    await commandHandler.handleSetLogConfig(options);

    expect(logger.level).toBe('debug');
    expect(logger.info).toHaveBeenCalledWith('Log level set to debug');
  });

  it('should enable file logging when fileLogging option is true', async () => {
    const options = { fileLogging: 'true' };
    await commandHandler.handleSetLogConfig(options);

    expect(logger.enableFileLogging).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('File logging enabled');
  });

  it('should disable file logging when fileLogging option is false', async () => {
    const options = { fileLogging: 'false' };
    await commandHandler.handleSetLogConfig(options);

    expect(logger.enableFileLogging).toBe(false);
    expect(logger.info).toHaveBeenCalledWith('File logging disabled');
  });

  it('should handle both loglevel and fileLogging options', async () => {
    const options = { loglevel: 'info', fileLogging: 'true' };
    await commandHandler.handleSetLogConfig(options);

    expect(logger.level).toBe('info');
    expect(logger.enableFileLogging).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Log level set to info');
    expect(logger.info).toHaveBeenCalledWith('File logging enabled');
  });

  it('should handle errors during configuration', async () => {
    const options = { loglevel: 'invalid' };
    const error = new Error('Invalid log level');
    logger.level = jest.fn(() => {
      throw error;
    });

    await commandHandler.handleSetLogConfig(options);

    expect(logger.error).toHaveBeenCalledWith(`Command failed: ${error.message}`);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
