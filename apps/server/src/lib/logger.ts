// Minimal structured logger — avoids pino dependency for now.
// Replace with pino once it's added to package.json.

const isDev = process.env.NODE_ENV !== 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, obj: Record<string, unknown>, msg: string) {
  const entry = JSON.stringify({ level, time: Date.now(), ...obj, msg });
  if (level === 'error') process.stderr.write(entry + '\n');
  else if (isDev || level !== 'debug') process.stdout.write(entry + '\n');
}

export const logger = {
  info:  (obj: Record<string, unknown>, msg: string) => log('info',  obj, msg),
  warn:  (obj: Record<string, unknown>, msg: string) => log('warn',  obj, msg),
  error: (obj: Record<string, unknown>, msg: string) => log('error', obj, msg),
  debug: (obj: Record<string, unknown>, msg: string) => log('debug', obj, msg),
};
