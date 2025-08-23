import { Logger } from './logger.config';

// Helper function to detect and enhance database connection errors
function enhanceDatabaseError(error: any) {
  const isDatabaseError = error?.message?.includes('getaddrinfo') || 
                         error?.code === 'ENOTFOUND' ||
                         error?.code === 'ECONNREFUSED' ||
                         error?.syscall === 'getaddrinfo' ||
                         error?.stack?.includes('pg-pool') ||
                         error?.stack?.includes('prisma');

  if (isDatabaseError) {
    return {
      isDatabaseConnectionError: true,
      suspectedCause: error?.code === 'ENOTFOUND' ? 
        'DNS resolution failed - check if hostname is correct and reachable' :
        error?.code === 'ECONNREFUSED' ? 
        'Connection refused - check if database service is running and port is correct' :
        'Database connection issue',
      troubleshooting: {
        steps: [
          'Verify DATABASE_HOST or DATABASE_CONNECTION_URI environment variable',
          'Check if database service is running',
          'Verify network connectivity to database host',
          'Check firewall settings',
          'Verify credentials and permissions'
        ],
        commonCauses: [
          'Incorrect hostname in environment variables',
          'Database service not running',
          'Network connectivity issues',
          'Firewall blocking connection',
          'Wrong port number',
          'DNS resolution issues'
        ]
      },
      databaseConfig: {
        usingConnectionUri: !!process.env.DATABASE_CONNECTION_URI,
        usingIndividualVars: !!(process.env.DATABASE_HOST || process.env.DATABASE_PORT),
        configuredHost: process.env.DATABASE_HOST,
        configuredPort: process.env.DATABASE_PORT,
        configuredProvider: process.env.DATABASE_PROVIDER,
        // Safely extract host from connection URI
        extractedHostFromUri: process.env.DATABASE_CONNECTION_URI ? 
          (() => {
            try {
              const url = new URL(process.env.DATABASE_CONNECTION_URI!);
              return url.hostname;
            } catch { return 'invalid-uri'; }
          })() : undefined
      }
    };
  }
  
  return { isDatabaseConnectionError: false };
}

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
      // Enhanced source tracking
      code: (error as any)?.code,
      errno: (error as any)?.errno,
      syscall: (error as any)?.syscall,
      hostname: (error as any)?.hostname,
      host: (error as any)?.host,
      port: (error as any)?.port,
      address: (error as any)?.address,
      // Database error analysis
      ...enhanceDatabaseError(error),
      // Environment context
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      // Memory usage at time of error
      memoryUsage: process.memoryUsage(),
      // Environment variables that might be relevant
      relevantEnvVars: {
        DATABASE_HOST: process.env.DATABASE_HOST,
        DATABASE_CONNECTION_URI: process.env.DATABASE_CONNECTION_URI,
        DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_PORT: process.env.DATABASE_PORT,
        DATABASE_USERNAME: process.env.DATABASE_USERNAME,
        DATABASE_DB: process.env.DATABASE_DB,
      },
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
      // Enhanced source tracking for promise rejections
      code: (reason as any)?.code,
      errno: (reason as any)?.errno,
      syscall: (reason as any)?.syscall,
      hostname: (reason as any)?.hostname,
      host: (reason as any)?.host,
      port: (reason as any)?.port,
      address: (reason as any)?.address,
      // Database connection specific properties
      connectionString: (reason as any)?.connectionString,
      query: (reason as any)?.query,
      parameters: (reason as any)?.parameters,
      // Database error analysis
      ...enhanceDatabaseError(reason),
      // Environment context
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      // Memory usage at time of error
      memoryUsage: process.memoryUsage(),
      // Environment variables that might be relevant (sanitized)
      relevantEnvVars: {
        DATABASE_HOST: process.env.DATABASE_HOST,
        DATABASE_CONNECTION_URI: process.env.DATABASE_CONNECTION_URI ? 
          process.env.DATABASE_CONNECTION_URI.replace(/:[^:@]*@/, ':<HIDDEN>@') : undefined,
        DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_PORT: process.env.DATABASE_PORT,
        DATABASE_USERNAME: process.env.DATABASE_USERNAME,
        DATABASE_DB: process.env.DATABASE_DB,
        REDIS_URI: process.env.REDIS_URI ? 
          process.env.REDIS_URI.replace(/:[^:@]*@/, ':<HIDDEN>@') : undefined,
        CACHE_REDIS_URI: process.env.CACHE_REDIS_URI ? 
          process.env.CACHE_REDIS_URI.replace(/:[^:@]*@/, ':<HIDDEN>@') : undefined,
      },
      // Promise state information
      promiseState: {
        isRejected: true,
        hasHandler: promise.constructor.name === 'Promise',
      },
      reason: reason, // Full reason object for additional context
    };
    
    logger.error(rejectionInfo);
  });
}
