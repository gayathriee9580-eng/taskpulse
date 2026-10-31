const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (msg, ...args) => {
    console.log(`\x1b[36m[INFO]\x1b[0m [${getTimestamp()}] ${msg}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m [${getTimestamp()}] ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`\x1b[33m[WARN]\x1b[0m [${getTimestamp()}] ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`\x1b[31m[ERROR]\x1b[0m [${getTimestamp()}] ${msg}`, ...args);
  },
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\x1b[35m[DEBUG]\x1b[0m [${getTimestamp()}] ${msg}`, ...args);
    }
  },
};

export default logger;
