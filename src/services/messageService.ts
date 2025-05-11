import { z } from 'zod';

const MessageSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
});

export class MessageService {
  static async sendMessage<T>(message: unknown): Promise<T> {
    // Validate message
    const validatedMessage = MessageSchema.parse(message);

    // Add security headers
    const secureMessage = {
      ...validatedMessage,
      timestamp: Date.now(),
      nonce: crypto.randomUUID(),
    };

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(secureMessage, (response) => {
          if (chrome.runtime.lastError) {
            // Gracefully handle 'Extension context invalid' error
            if (
              chrome.runtime.lastError.message &&
              chrome.runtime.lastError.message.includes('Extension context invalid')
            ) {
              console.warn('Extension context invalid. Skipping message.');
              resolve(undefined as unknown as T);
              return;
            }
            reject(chrome.runtime.lastError);
            return;
          }
          resolve(response as T);
        });
      } catch (err) {
        // Handle case where chrome.runtime is not available
        if (
          err instanceof Error &&
          err.message.includes('Extension context invalid')
        ) {
          console.warn('Extension context invalid. Skipping message.');
          resolve(undefined as unknown as T);
          return;
        }
        reject(err);
      }
    });
  }

  static async sendMessageWithRetry<T>(message: unknown, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.sendMessage<T>(message);
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }

    throw lastError || new Error('Failed to send message after retries');
  }
} 