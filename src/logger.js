import winston from 'winston';
import chalk from 'chalk';

// Define custom log levels
const customLevels = {
  levels: {
    error: 0,
    warning: 1,
    success: 2,
    info: 3,
    debug: 4
  },
  colors: {
    error: 'red',
    warning: 'yellow',
    success: 'green',
    info: 'white',
    debug: 'gray'
  }
};

// Create the logger for file logging
const fileLogger = winston.createLogger({
  levels: customLevels.levels,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      silent: process.env.NODE_ENV === 'test',
    }),
    new winston.transports.File({
      filename: 'combined.log',
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

// CLI-friendly logging function
const log = (message, type = 'info') => {
  const colors = {
    debug: chalk.gray,
    info: chalk.white,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
  };

  // Don't output to console during tests unless explicitly enabled
  if (process.env.NODE_ENV !== 'test' || process.env.LOG_IN_TEST) {
    const color = colors[type] || colors.info;
    // eslint-disable-next-line no-console
    console.log(color(`[${new Date().toISOString()}] [${type.toUpperCase()}] ${message}`));
  }

  // Always log to file (except in test)
  fileLogger.log(type, message);
};

export const logger = {
  debug: message => log(message, 'debug'),
  info: message => log(message, 'info'),
  success: message => log(message, 'success'),
  error: message => log(message, 'error'),
  warning: message => log(message, 'warning'),
};

export default logger;
