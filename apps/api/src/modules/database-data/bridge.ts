import type { Duplex } from 'node:stream';
import { DATA_LIMITS } from 'shared-types';
import type { Exec } from 'ssh-client';

/**
 * The SSH channel running bridgeCommand, made to look like a TCP socket to
 * the database drivers: they call setNoDelay/setKeepAlive/setTimeout on it,
 * and pg waits for a 'connect' event. Reading is the database's replies,
 * writing goes to it. Counts what comes back, so a SELECT * on a huge table
 * ends the connection instead of filling the api's memory.
 */
export class Bridge {
  readonly socket: Duplex;
  private bytes = 0;
  tooBig = false;
  timedOut = false;
  private readonly timer: NodeJS.Timeout;

  constructor(exec: Exec) {
    const ch = exec.stdout as Duplex & Record<string, unknown>;
    for (const m of ['setNoDelay', 'setKeepAlive', 'setTimeout', 'ref', 'unref']) ch[m] = () => ch;
    ch.connect = () => setImmediate(() => ch.emit('connect'));
    ch.on('data', (d: Buffer) => {
      this.bytes += d.length;
      if (this.bytes > DATA_LIMITS.resultBytes && !this.tooBig) {
        this.tooBig = true;
        ch.destroy();
      }
    });
    // A little longer than the database's own statement timeout, which reports better.
    this.timer = setTimeout(() => {
      this.timedOut = true;
      ch.destroy();
    }, DATA_LIMITS.timeoutMs + 3000);
    this.socket = ch;
  }

  close(): void {
    clearTimeout(this.timer);
    this.socket.destroy();
  }
}
