import { Logger } from './logger.config';

export function onUnexpectedError() {
  process.on('uncaughtException', (error, origin) => {
    // Immediate trace to stderr - useful for development and as fallback
    console.trace('🚨 UNCAUGHT EXCEPTION DETECTED:', error instanceof Error ? error.message : String(error));
    
    const logger = new Logger('uncaughtException');
    
    // Enhanced error information for better debugging
    const errorInfo = {
      origin,
      pid: process.pid,
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      errorObject: error, // Full error object for additional context
    };
    
    logger.error(errorInfo);
  });

  process.on('unhandledRejection', (reason, promise) => {
    // Immediate trace to stderr - useful for development and as fallback
    console.trace('🚨 UNHANDLED REJECTION DETECTED:', reason instanceof Error ? reason.message : String(reason));
    
    const logger = new Logger('unhandledRejection');
    
    // Enhanced error information for unhandled rejections
    const rejectionInfo = {
      promise: promise.toString(),
      pid: process.pid,
      timestamp: new Date().toISOString(),
      message: reason instanceof Error ? reason.message : String(reason),
      name: reason instanceof Error ? reason.name : 'Unknown',
      stack: reason instanceof Error ? reason.stack : undefined,
      reason: reason, // Full reason object for additional context
    };
    
    logger.error(rejectionInfo);
  });
}
