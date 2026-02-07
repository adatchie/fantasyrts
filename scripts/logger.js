/**
 * FANTASY RTS - Logger Utility
 * 本番環境ではログ出力を無効化
 * 開発時は DEBUG = true に設定
 */

export const DEBUG = false;

export const logger = {
    log: (...args) => { if (DEBUG) console.log(...args); },
    warn: (...args) => { if (DEBUG) console.warn(...args); },
    error: (...args) => { console.error(...args); }, // エラーは常に出力
    debug: (...args) => { if (DEBUG) console.log('[DEBUG]', ...args); }
};

// ショートカット
export const log = logger.log;
export const warn = logger.warn;
export const debug = logger.debug;
