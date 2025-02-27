import { createTestLogger } from './testLogger';

describe('testLogger', () => {
  let testLogger;
  
  beforeEach(() => {
    testLogger = createTestLogger();
  });
  
  it('should create a testLogger with the required methods', () => {
    expect(testLogger).toHaveProperty('debug');
    expect(testLogger).toHaveProperty('info');
    expect(testLogger).toHaveProperty('success');
    expect(testLogger).toHaveProperty('error');
    expect(testLogger).toHaveProperty('warning');
    expect(testLogger).toHaveProperty('getLogEntries');
    expect(testLogger).toHaveProperty('clearLogs');
  });
  
  it('should log debug messages', () => {
    testLogger.debug('test debug message');
    const logs = testLogger.getLogEntries();
    
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      level: 'debug',
      message: 'test debug message'
    });
  });
  
  it('should log info messages', () => {
    testLogger.info('test info message');
    const logs = testLogger.getLogEntries();
    
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      level: 'info',
      message: 'test info message'
    });
  });
  
  it('should log success messages', () => {
    testLogger.success('test success message');
    const logs = testLogger.getLogEntries();
    
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      level: 'success',
      message: 'test success message'
    });
  });
  
  it('should log error messages', () => {
    testLogger.error('test error message');
    const logs = testLogger.getLogEntries();
    
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      level: 'error',
      message: 'test error message'
    });
  });
  
  it('should log warning messages', () => {
    testLogger.warning('test warning message');
    const logs = testLogger.getLogEntries();
    
    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual({
      level: 'warning',
      message: 'test warning message'
    });
  });
  
  it('should accumulate logs across multiple calls', () => {
    testLogger.info('first message');
    testLogger.debug('second message');
    testLogger.error('third message');
    
    const logs = testLogger.getLogEntries();
    
    expect(logs).toHaveLength(3);
    expect(logs[0]).toEqual({ level: 'info', message: 'first message' });
    expect(logs[1]).toEqual({ level: 'debug', message: 'second message' });
    expect(logs[2]).toEqual({ level: 'error', message: 'third message' });
  });
  
  it('should clear logs when clearLogs is called', () => {
    testLogger.info('test message');
    expect(testLogger.getLogEntries()).toHaveLength(1);
    
    testLogger.clearLogs();
    expect(testLogger.getLogEntries()).toHaveLength(0);
  });
  
  it('should return a copy of logs from getLogEntries', () => {
    testLogger.info('test message');
    
    const logs1 = testLogger.getLogEntries();
    expect(logs1).toHaveLength(1);
    
    // Modify the returned array
    logs1.push({ level: 'debug', message: 'added message' });
    
    // Get logs again and verify the original logs array wasn't modified
    const logs2 = testLogger.getLogEntries();
    expect(logs2).toHaveLength(1);
  });
});