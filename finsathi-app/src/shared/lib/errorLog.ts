/**
 * FinSathi Error Logging & Diagnostics Engine
 * Captures, normalizes, and stores runtime errors, sync failures, and unhandled rejections.
 * Automatically forwards diagnostics to the local laptop sync daemon when available.
 */

export type ErrorSeverity = 'warn' | 'error' | 'fatal';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: ErrorSeverity;
  component: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent?: string;
  url?: string;
  resolved?: boolean;
}

const STORAGE_KEY = 'finsathi_system_error_logs';
const MAX_LOGS = 100;
const SERVER_URL = 'http://127.0.0.1:3001/api/logs/error';

export function getStoredErrors(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredErrors(logs: ErrorLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch (err) {
    console.error('Failed to save errors to localStorage', err);
  }
}

/**
 * Log a system error with context
 */
export function logSystemError(
  level: ErrorSeverity,
  component: string,
  message: string,
  error?: Error | unknown,
  context?: Record<string, any>
): ErrorLogEntry {
  const stack = error instanceof Error ? error.stack : undefined;
  const entry: ErrorLogEntry = {
    id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    component,
    message: String(message),
    stack,
    context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    resolved: false,
  };

  // 1. Save locally
  const current = getStoredErrors();
  current.push(entry);
  saveStoredErrors(current);

  // 2. Print to developer console
  if (level === 'fatal') {
    console.error(`[FinSathi FATAL] [${component}] ${message}`, error, context);
  } else if (level === 'error') {
    console.error(`[FinSathi ERROR] [${component}] ${message}`, error, context);
  } else {
    console.warn(`[FinSathi WARN] [${component}] ${message}`, context);
  }

  // 3. Fire-and-forget sync to local server
  if (typeof fetch !== 'undefined') {
    fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {
      // Server offline is fine, errors remain safely in client storage
    });
  }

  return entry;
}

export function clearSystemErrors(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function markErrorResolved(id: string): void {
  const errors = getStoredErrors().map(e => e.id === id ? { ...e, resolved: true } : e);
  saveStoredErrors(errors);
}

/**
 * Global initialization for unhandled rejections and window errors
 */
let isInitialized = false;

export function initGlobalErrorCapture(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  window.addEventListener('error', (event) => {
    logSystemError(
      'error',
      'WindowError',
      event.message || 'Unknown window error',
      event.error,
      { filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || 'Unhandled Promise Rejection');
    logSystemError(
      'error',
      'UnhandledPromise',
      message,
      reason instanceof Error ? reason : undefined
    );
  });
}
