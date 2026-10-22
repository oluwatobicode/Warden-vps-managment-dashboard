import { prisma } from "db";
import { deployLogChannel } from "shared-types";
import { redis } from "../redis";

/** A build can print a lot; past this, the log says so and stops growing. */
const MAX_BYTES = 4 * 1024 * 1024;
const FLUSH_MS = 600;

/**
 * A deploy's output. Text is collected and, every ~0.6s, saved as one
 * DeploymentLog row (in order, by seq) and published on Redis for anyone
 * watching live. Never pass a secret to it: everything here is shown to every
 * member of the org.
 */
export class DeployLog {
  private seq = 0;
  private buffer = "";
  private bytes = 0;
  private full = false;
  private chain: Promise<void> = Promise.resolve();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly deploymentId: string) {
    this.timer = setInterval(() => this.flush(), FLUSH_MS);
  }

  /** Raw output, as it arrives (a build's lines, an app's first logs). */
  write(text: string): void {
    if (this.full || !text) return;
    if (this.bytes + text.length > MAX_BYTES) {
      this.full = true;
      this.buffer += "\n… the log is over 4 MB, so the rest isn't kept …\n";
      return;
    }
    this.bytes += text.length;
    this.buffer += text.replace(/\r(?!\n)/g, "\n");
  }

  /** A line from Warden itself, so it stands out from the build's own output. */
  say(message: string): void {
    this.write(`${this.buffer.endsWith("\n") || this.bytes === 0 ? "" : "\n"}▸ ${message}\n`);
  }

  private flush(): Promise<void> {
    if (!this.buffer) return this.chain;
    const text = this.buffer;
    this.buffer = "";
    const seq = ++this.seq;
    // One write at a time, so rows land in seq order.
    this.chain = this.chain.then(async () => {
      try {
        await prisma.deploymentLog.create({ data: { deploymentId: this.deploymentId, seq, text } });
        await redis.publish(deployLogChannel(this.deploymentId), JSON.stringify({ seq, text }));
      } catch {
        // A lost log chunk must never fail the deploy itself.
      }
    });
    return this.chain;
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
