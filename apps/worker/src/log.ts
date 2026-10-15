/** One line per event, prefixed with the time. Never pass secrets in. */
export const log = {
  info: (msg: string) => console.log(`${new Date().toISOString()} ${msg}`),
  warn: (msg: string) => console.warn(`${new Date().toISOString()} WARN ${msg}`),
  error: (msg: string) => console.error(`${new Date().toISOString()} ERROR ${msg}`),
};
