/**
 * Cache Logger
 * Provides detailed console logging for cache operations
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const COLORS = {
  debug: '\x1b[36m',   // Cyan
  info: '\x1b[32m',    // Green
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  cache: '\x1b[35m',   // Magenta for cache-specific
};

const ICONS = {
  hit: '✅',
  miss: '❌',
  skip: '⏭️',
  save: '💾',
  load: '📂',
  info: 'ℹ️',
  warn: '⚠️',
  error: '🚨',
  debug: '🔍',
  time: '⏱️',
  cost: '💰',
};

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return '';
  
  const parts = Object.entries(context).map(([key, value]) => {
    if (typeof value === 'string') {
      return `${key}="${value}"`;
    }
    if (typeof value === 'number') {
      return `${key}=${value}`;
    }
    if (Array.isArray(value)) {
      return `${key}=[${value.length} items]`;
    }
    return `${key}=${JSON.stringify(value)}`;
  });
  
  return ` ${COLORS.dim}(${parts.join(', ')})${COLORS.reset}`;
}

function log(level: LogLevel, icon: string, message: string, context?: LogContext): void {
  const color = COLORS[level];
  const timestamp = formatTimestamp();
  const contextStr = formatContext(context);
  
  console.log(
    `${COLORS.dim}[${timestamp}]${COLORS.reset} ${color}[CACHE]${COLORS.reset} ${icon} ${message}${contextStr}`
  );
}

export const cacheLog = {
  /**
   * Log a cache hit
   */
  hit(message: string, context?: LogContext): void {
    log('info', ICONS.hit, `CACHE HIT: ${message}`, context);
  },
  
  /**
   * Log a cache miss
   */
  miss(message: string, context?: LogContext): void {
    log('info', ICONS.miss, `CACHE MISS: ${message}`, context);
  },
  
  /**
   * Log when skipping due to cache
   */
  skip(message: string, context?: LogContext): void {
    log('info', ICONS.skip, `SKIPPED: ${message}`, context);
  },
  
  /**
   * Log cache save operation
   */
  save(message: string, context?: LogContext): void {
    log('info', ICONS.save, `SAVED: ${message}`, context);
  },
  
  /**
   * Log cache load operation
   */
  load(message: string, context?: LogContext): void {
    log('info', ICONS.load, `LOADED: ${message}`, context);
  },
  
  /**
   * Log general info
   */
  info(message: string, context?: LogContext): void {
    log('info', ICONS.info, message, context);
  },
  
  /**
   * Log warning
   */
  warn(message: string, context?: LogContext): void {
    log('warn', ICONS.warn, message, context);
  },
  
  /**
   * Log error
   */
  error(message: string, context?: LogContext): void {
    log('error', ICONS.error, message, context);
  },
  
  /**
   * Log debug info
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.DEBUG_CACHE === 'true' || process.env.NODE_ENV === 'development') {
      log('debug', ICONS.debug, message, context);
    }
  },
  
  /**
   * Log timing information
   */
  timing(operation: string, durationMs: number, context?: LogContext): void {
    const formatted = durationMs < 1000 
      ? `${durationMs.toFixed(0)}ms`
      : `${(durationMs / 1000).toFixed(2)}s`;
    log('info', ICONS.time, `${operation} took ${formatted}`, context);
  },
  
  /**
   * Log cost information
   */
  cost(message: string, cost: number, context?: LogContext): void {
    log('info', ICONS.cost, `${message}: $${cost.toFixed(4)}`, context);
  },
  
  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.timing(operation, duration);
    };
  },
  
  /**
   * Log a summary of cache operations
   */
  summary(stats: {
    hits: number;
    misses: number;
    saved: number;
    totalTime?: number;
    totalCost?: number;
  }): void {
    const hitRate = stats.hits + stats.misses > 0 
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)
      : '0';
    
    console.log('\n' + COLORS.bright + COLORS.cache + '═══════════════════════════════════════' + COLORS.reset);
    console.log(COLORS.bright + COLORS.cache + '           CACHE SUMMARY' + COLORS.reset);
    console.log(COLORS.cache + '═══════════════════════════════════════' + COLORS.reset);
    console.log(`  ${ICONS.hit} Cache Hits:    ${stats.hits}`);
    console.log(`  ${ICONS.miss} Cache Misses:  ${stats.misses}`);
    console.log(`  ${ICONS.save} Items Saved:   ${stats.saved}`);
    console.log(`  📊 Hit Rate:      ${hitRate}%`);
    if (stats.totalTime !== undefined) {
      console.log(`  ${ICONS.time} Total Time:    ${(stats.totalTime / 1000).toFixed(2)}s`);
    }
    if (stats.totalCost !== undefined) {
      console.log(`  ${ICONS.cost} Total Cost:    $${stats.totalCost.toFixed(4)}`);
    }
    console.log(COLORS.cache + '═══════════════════════════════════════\n' + COLORS.reset);
  }
};

/**
 * Create a scoped logger for a specific component
 */
export function createScopedLogger(scope: string) {
  return {
    hit: (msg: string, ctx?: LogContext) => cacheLog.hit(`[${scope}] ${msg}`, ctx),
    miss: (msg: string, ctx?: LogContext) => cacheLog.miss(`[${scope}] ${msg}`, ctx),
    skip: (msg: string, ctx?: LogContext) => cacheLog.skip(`[${scope}] ${msg}`, ctx),
    save: (msg: string, ctx?: LogContext) => cacheLog.save(`[${scope}] ${msg}`, ctx),
    load: (msg: string, ctx?: LogContext) => cacheLog.load(`[${scope}] ${msg}`, ctx),
    info: (msg: string, ctx?: LogContext) => cacheLog.info(`[${scope}] ${msg}`, ctx),
    warn: (msg: string, ctx?: LogContext) => cacheLog.warn(`[${scope}] ${msg}`, ctx),
    error: (msg: string, ctx?: LogContext) => cacheLog.error(`[${scope}] ${msg}`, ctx),
    debug: (msg: string, ctx?: LogContext) => cacheLog.debug(`[${scope}] ${msg}`, ctx),
    timing: (op: string, ms: number, ctx?: LogContext) => cacheLog.timing(`[${scope}] ${op}`, ms, ctx),
    cost: (msg: string, cost: number, ctx?: LogContext) => cacheLog.cost(`[${scope}] ${msg}`, cost, ctx),
    startTimer: (op: string) => cacheLog.startTimer(`[${scope}] ${op}`),
  };
}
