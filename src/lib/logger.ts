/**
 * Logging utility with configurable log levels
 * 
 * Log levels (in order of severity):
 * - DEBUG: Detailed information for debugging
 * - INFO: General informational messages
 * - WARN: Warning messages
 * - ERROR: Error messages
 * 
 * Set LOG_LEVEL environment variable to control which logs are output:
 * - 'debug': Shows all logs
 * - 'info': Shows info, warn, and error (default in development)
 * - 'warn': Shows warn and error (default in production)
 * - 'error': Shows only error messages
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Parse log level from environment variable
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() || "";
  const isDevelopment = process.env.NODE_ENV === "development";

  // Default to DEBUG in development, WARN in production
  if (!envLevel) {
    return isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  switch (envLevel) {
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    default:
      // Invalid level, default based on environment
      return isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }
}

const currentLogLevel = getLogLevel();

// Check if a log level should be output
function shouldLog(level: LogLevel): boolean {
  return level >= currentLogLevel;
}

// Serialize values for better logging
function serializeValue(value: unknown): string {
  if (value === undefined) {
    return "<undefined>";
  }
  if (value === null) {
    return "<null>";
  }
  
  const type = typeof value;
  
  if (type === "string" || type === "number" || type === "boolean") {
    return String(value);
  }
  
  if (value instanceof Error) {
    return value.toString();
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "<empty array>";
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return `[Array(${value.length})]`;
    }
  }
  
  if (type === "object") {
    try {
      // Check if object has any enumerable properties
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return "<empty object>";
      }
      return JSON.stringify(value, null, 2);
    } catch {
      return `[Object]`;
    }
  }
  
  return String(value);
}

// Format log message with optional context
function formatMessage(
  level: string,
  message: string,
  ...args: unknown[]
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  // Build the message content
  let messageContent = message || "";
  
  if (args.length > 0) {
    // If message contains template literal placeholders (${}), try to replace them
    const templateMatches = message.match(/\$\{[^}]+\}/g);
    
    if (templateMatches && templateMatches.length > 0) {
      // Replace placeholders with serialized values
      templateMatches.forEach((placeholder, index) => {
        if (index < args.length) {
          messageContent = messageContent.replace(
            placeholder,
            serializeValue(args[index])
          );
        }
      });
      // Append any remaining args
      if (args.length > templateMatches.length) {
        const remainingArgs = args
          .slice(templateMatches.length)
          .map(serializeValue)
          .join(" ");
        messageContent += ` ${remainingArgs}`;
      }
    } else {
      // No template placeholders, append all formatted args
      const formattedArgs = args.map(serializeValue).join(" ");
      if (formattedArgs) {
        messageContent += ` ${formattedArgs}`;
      }
    }
  }
  
  // Always prepend the prefix and ensure it's at the beginning
  return messageContent ? `${prefix} ${messageContent}` : prefix;
}

// Logger object with methods for each log level
export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.DEBUG)) {
      const formatted = formatMessage("DEBUG", message, ...args);
      // Always log the formatted message first (with timestamp prefix)
      // Then pass original args for browser dev tools to inspect objects
      if (args.length > 0) {
        console.debug(formatted, ...args);
      } else {
        console.debug(formatted);
      }
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.INFO)) {
      const formatted = formatMessage("INFO", message, ...args);
      // Always log the formatted message first (with timestamp prefix)
      if (args.length > 0) {
        console.info(formatted, ...args);
      } else {
        console.info(formatted);
      }
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.WARN)) {
      const formatted = formatMessage("WARN", message, ...args);
      // Always log the formatted message first (with timestamp prefix)
      if (args.length > 0) {
        console.warn(formatted, ...args);
      } else {
        console.warn(formatted);
      }
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog(LogLevel.ERROR)) {
      const formatted = formatMessage("ERROR", message, ...args);
      // Always log the formatted message first (with timestamp prefix)
      // For errors, we still want to pass original args for stack traces and error inspection
      if (args.length > 0) {
        console.error(formatted, ...args);
      } else {
        console.error(formatted);
      }
    }
  },

  // Convenience method to get current log level (useful for debugging)
  getLevel(): LogLevel {
    return currentLogLevel;
  },

  // Check if a specific level is enabled
  isLevelEnabled(level: LogLevel): boolean {
    return shouldLog(level);
  },
};
