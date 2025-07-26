import { downloadMediaMessage } from 'baileys';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

export interface MediaDownloadParams {
  key: any;
  message: any;
}

import { Logger } from '@config/logger.config';

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 6,
  initialDelay: 1000,
  baseDelay: 3000,
  maxDelay: 15000,
  timeout: 30000,
};

export async function downloadMediaMessageWithRetry(
  message: MediaDownloadParams,
  type: 'buffer' | 'stream' = 'buffer',
  logger?: Logger | null,
  options: any = {},
  retryOptions: RetryOptions = {}
): Promise<Buffer> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };
  let lastError: Error;

  if (config.initialDelay) {
    await new Promise(resolve => setTimeout(resolve, config.initialDelay));
  }

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const downloadPromise = downloadMediaMessage(message, type, options);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout')), config.timeout);
      });

      const result = await Promise.race([downloadPromise, timeoutPromise]);
      return result as Buffer;
    } catch (error) {
      lastError = error as Error;

      if (logger) 
      {
        logger.error(`Error downloading media message (attempt ${attempt}):`);
        logger.error(lastError);
      }
      
      if (attempt === config.maxAttempts) {
        throw new Error(`Failed to download media after ${config.maxAttempts} attempts. Last error: ${lastError.message}`);
      }

      const delay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay);
      if (logger) 
      {
        logger.info(`Retrying download in ${delay}ms...`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}