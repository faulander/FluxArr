import { query } from './db';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details: Record<string, unknown> | null;
}

interface LogEntryRow {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details: string | null;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Minimum level to store in database (can be configured)
let minDbLevel: LogLevel = 'info';

// Also output to console
let consoleOutput = true;

export function configureLogger(options: { minDbLevel?: LogLevel; consoleOutput?: boolean }) {
  if (options.minDbLevel) minDbLevel = options.minDbLevel;
  if (options.consoleOutput !== undefined) consoleOutput = options.consoleOutput;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minDbLevel];
}

function formatConsoleMessage(level: LogLevel, source: string, message: string): string {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase().padEnd(5);
  return `${timestamp} [${levelUpper}] [${source}] ${message}`;
}

function logToConsole(
  level: LogLevel,
  source: string,
  message: string,
  details?: Record<string, unknown>
) {
  if (!consoleOutput) return;

  const formatted = formatConsoleMessage(level, source, message);

  switch (level) {
    case 'error':
      console.error(formatted, details || '');
      break;
    case 'warn':
      console.warn(formatted, details || '');
      break;
    case 'debug':
      console.debug(formatted, details || '');
      break;
    default:
      console.log(formatted, details || '');
  }
}

// Track if we've warned about missing table to avoid spam
let warnedAboutMissingTable = false;

function logToDb(
  level: LogLevel,
  source: string,
  message: string,
  details?: Record<string, unknown>
) {
  if (!shouldLog(level)) return;

  try {
    query.run('INSERT INTO logs (level, source, message, details) VALUES (?, ?, ?, ?)', [
      level,
      source,
      message,
      details ? JSON.stringify(details) : null
    ]);
  } catch (error) {
    // Silently ignore "no such table" errors during startup (before migrations)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('no such table: logs')) {
      if (!warnedAboutMissingTable) {
        console.warn('Database logs table not yet created - logs will appear after migrations run');
        warnedAboutMissingTable = true;
      }
      return;
    }
    // Log other errors
    console.error('Failed to write log to database:', error);
  }
}

function log(level: LogLevel, source: string, message: string, details?: Record<string, unknown>) {
  logToConsole(level, source, message, details);
  logToDb(level, source, message, details);
}

/**
 * Create a logger instance for a specific source/module
 */
export function createLogger(source: string) {
  return {
    debug: (message: string, details?: Record<string, unknown>) =>
      log('debug', source, message, details),
    info: (message: string, details?: Record<string, unknown>) =>
      log('info', source, message, details),
    warn: (message: string, details?: Record<string, unknown>) =>
      log('warn', source, message, details),
    error: (message: string, details?: Record<string, unknown>) =>
      log('error', source, message, details)
  };
}

// Pre-configured loggers for common sources
export const logger = {
  http: createLogger('HTTP'),
  background: createLogger('Background'),
  tvmaze: createLogger('TVMaze'),
  sonarr: createLogger('Sonarr'),
  omdb: createLogger('OMDB'),
  tmdb: createLogger('TMDB'),
  radarr: createLogger('Radarr'),
  db: createLogger('Database'),
  auth: createLogger('Auth')
};

/**
 * Query logs with filtering and pagination
 */
export interface LogQueryOptions {
  level?: LogLevel | LogLevel[];
  source?: string | string[];
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface LogQueryResult {
  logs: LogEntry[];
  total: number;
}

export function queryLogs(options: LogQueryOptions = {}): LogQueryResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.level) {
    const levels = Array.isArray(options.level) ? options.level : [options.level];
    conditions.push(`level IN (${levels.map(() => '?').join(', ')})`);
    params.push(...levels);
  }

  if (options.source) {
    const sources = Array.isArray(options.source) ? options.source : [options.source];
    conditions.push(`source IN (${sources.map(() => '?').join(', ')})`);
    params.push(...sources);
  }

  if (options.search) {
    conditions.push('message LIKE ?');
    params.push(`%${options.search}%`);
  }

  if (options.startDate) {
    conditions.push('timestamp >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push('timestamp <= ?');
    params.push(options.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = query.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM logs ${whereClause}`,
    params
  );
  const total = countResult?.count || 0;

  // Get paginated results
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  const rows = query.all<LogEntryRow>(
    `SELECT * FROM logs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const logs: LogEntry[] = rows.map((row) => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null
  }));

  return { logs, total };
}

/**
 * Get distinct sources from logs
 */
export function getLogSources(): string[] {
  const rows = query.all<{ source: string }>('SELECT DISTINCT source FROM logs ORDER BY source');
  return rows.map((r) => r.source);
}

/**
 * Get log statistics
 */
export interface LogStats {
  total: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<string, number>;
  oldestLog: string | null;
  newestLog: string | null;
}

export function getLogStats(): LogStats {
  const total = query.get<{ count: number }>('SELECT COUNT(*) as count FROM logs')?.count || 0;

  const byLevelRows = query.all<{ level: LogLevel; count: number }>(
    'SELECT level, COUNT(*) as count FROM logs GROUP BY level'
  );
  const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const row of byLevelRows) {
    byLevel[row.level] = row.count;
  }

  const bySourceRows = query.all<{ source: string; count: number }>(
    'SELECT source, COUNT(*) as count FROM logs GROUP BY source ORDER BY count DESC'
  );
  const bySource: Record<string, number> = {};
  for (const row of bySourceRows) {
    bySource[row.source] = row.count;
  }

  const oldest = query.get<{ timestamp: string }>(
    'SELECT timestamp FROM logs ORDER BY timestamp ASC LIMIT 1'
  );
  const newest = query.get<{ timestamp: string }>(
    'SELECT timestamp FROM logs ORDER BY timestamp DESC LIMIT 1'
  );

  return {
    total,
    byLevel,
    bySource,
    oldestLog: oldest?.timestamp || null,
    newestLog: newest?.timestamp || null
  };
}

/**
 * Delete logs older than specified date
 */
export function pruneLogs(beforeDate: string): number {
  const result = query.run('DELETE FROM logs WHERE timestamp < ?', [beforeDate]);
  return result.changes;
}

/**
 * Delete all logs
 */
export function clearAllLogs(): number {
  const result = query.run('DELETE FROM logs', []);
  return result.changes;
}

/**
 * Export logs as JSON
 */
export function exportLogs(options: LogQueryOptions = {}): LogEntry[] {
  // Remove pagination for export
  const { logs } = queryLogs({ ...options, limit: 100000, offset: 0 });
  return logs;
}
