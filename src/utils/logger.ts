/**
 * Mock Logger to simulate Sentry or Firebase Crashlytics integrations.
 * Replace with import * as Sentry from '@sentry/react-native';
 */

export const Logger = {
  log: (message: string, context?: any) => {
    console.log(`[INFO]: ${message}`, context || '');
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN]: ${message}`, context || '');
  },
  error: (error: Error | any, context?: string) => {
    // Sentry.captureException(error, { extra: { context }});
    // crashlytics().recordError(error);
    console.error(`[ERROR - Analytics Logged]: ${context ? `[${context}]` : ''}`, error);
  }
};
