import winston from 'winston';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class Logger {
  constructor(options = {}) {
    const {
      level = process.env.ACCOUNTFACTORY_LOG_LEVEL || 'info',
      silent = process.env.NODE_ENV === 'test',
      enableFileLogging = process.env.ACCOUNTFACTORY_ENABLE_LOGGING === 'true'
    } = options;

    this.customLevels = {
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
      }
    };

    this.transports = this.createTransports({ level, silent, enableFileLogging });
    this.logger = this.createLogger();
  }

  createTransports({ level, silent, enableFileLogging }) {
    const transports = [];

    // Console transport
    transports.push(
      new winston.transports.Console({
        level,
        silent,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            const color = {
              debug: chalk.gray,
              info: chalk.white,
              success: chalk.green,
              error: chalk.red,
              warning: chalk.yellow,
            }[level] || chalk.white;
            return color(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
          })
        )
      })
    );

    // File transport (optional)
    if (enableFileLogging) {
      const logDirectory = this.getLogDirectory();
      this.ensureLogDirectory(logDirectory);

      transports.push(
        new winston.transports.File({
          filename: join(logDirectory, 'accountfactory.log')
        })
      );
    }

    return transports;
  }

  createLogger() {
    return winston.createLogger({
      levels: this.customLevels.levels,
      transports: this.transports
    });
  }

  getLogDirectory() {
    if (process.platform === 'win32') {
      return join(
        process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
        'accountfactory',
        'logs'
      );
    }
    return join(homedir(), '.local', 'state', 'accountfactory', 'logs');
  }

  ensureLogDirectory(directory) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
  }

  // Logging methods
  debug(message) { this.logger.debug(message); }
  info(message) { this.logger.info(message); }
  success(message) { this.logger.log('success', message); }
  warning(message) { this.logger.warning(message); }
  error(message) { this.logger.error(message); }

  // Test helpers
  getLogEntries() {
    return this.transports
      .filter(t => t instanceof winston.transports.Console)
      .map(t => t.history || [])
      .flat();
  }

  clearLogEntries() {
    this.transports
      .filter(t => t instanceof winston.transports.Console)
      .forEach(t => t.history = []);
  }
}

// Create default instance
export const logger = new Logger();

// For testing, export the class
export default logger;
