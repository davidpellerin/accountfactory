import winston from 'winston';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const customLevels = {
  levels: {
    error: 0,
    warning: 1,
    success: 2,
    info: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warning: 'yellow',
    success: 'green',
    info: 'white',
    debug: 'gray',
  },
};

const createLogDirectory = () => {
  const logDirectory = getLogDirectory();
  if (!existsSync(logDirectory)) {
    mkdirSync(logDirectory, { recursive: true });
  }
};

const getLogDirectory = () => {
  if (process.platform === 'win32') {
    return join(
      process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
      'accountfactory',
      'logs'
    );
  }
  return join(homedir(), '.local', 'state', 'accountfactory', 'logs');
};

const transports = [];

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      const color =
        {
          debug: chalk.gray,
          info: chalk.white,
          success: chalk.green,
          error: chalk.red,
          warning: chalk.yellow,
        }[level] || chalk.white;
      return color(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    })
  ),
  silent: process.env.NODE_ENV === 'test',
});

transports.push(consoleTransport);

// if ACCOUNTFACTORY_ENABLE_LOGGING environment variable is set add file transport
if (process.env.ACCOUNTFACTORY_ENABLE_LOGGING === 'true') {
  createLogDirectory();
  transports.push(
    new winston.transports.File({
      filename: join(getLogDirectory(), 'accountfactory.log'),
    })
  );
}

const winstonLogger = winston.createLogger({
  levels: customLevels.levels,
  transports,
});

const log = (message, type = 'info') => {
  winstonLogger.log(type, message);
};

export const logger = {
  debug: message => log(message, 'debug'),
  info: message => log(message, 'info'),
  success: message => log(message, 'success'),
  error: message => log(message, 'error'),
  warning: message => log(message, 'warning'),
};

export default logger;
