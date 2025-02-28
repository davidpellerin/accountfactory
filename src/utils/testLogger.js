import winston from 'winston';

export const createTestLogger = () => {
  const logs = [];

  const testTransport = new winston.transports.Console({
    silent: true,
  });

  const logger = winston.createLogger({
    level: 'debug',
    levels: {
      error: 0,
      warning: 1,
      success: 2,
      info: 3,
      debug: 4,
    },
    transports: [testTransport],
  });

  const testLogger = {
    debug: msg => {
      logger.debug(msg);
      logs.push({ level: 'debug', message: msg });
    },
    info: msg => {
      logger.info(msg);
      logs.push({ level: 'info', message: msg });
    },
    success: msg => {
      logger.log('success', msg);
      logs.push({ level: 'success', message: msg });
    },
    error: msg => {
      logger.error(msg);
      logs.push({ level: 'error', message: msg });
    },
    warning: msg => {
      logger.log('warning', msg);
      logs.push({ level: 'warning', message: msg });
    },
    getLogEntries: () => [...logs],
    clearLogs: () => {
      logs.length = 0;
    },
  };

  return testLogger;
};
