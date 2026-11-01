import { Client } from "ssh2";
import { Writable, type Readable } from "node:stream";

export interface SshTarget {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type SshErrorKind =
  | "unreachable"
  | "auth_failed"
  | "timeout"
  | "unknown";

export class SshError extends Error {
  constructor(
    public readonly kind: SshErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SshError";
  }
}

/**
 * Runs one command. `input`, when given, is written to the command's stdin
 * and then closed: the way to hand a secret to the server (e.g. `cat > file`)
 * without it ever appearing in the command line, `ps` or shell history.
 */
export type Run = (cmd: string, input?: string) => Promise<RunResult>;

/**
 * A running command as streams, for data too big to hold in memory (a
 * database dump). `stdout` is the command's output, `stdin` its input; end
 * stdin when you've written everything. `done` resolves when it exits.
 */
export interface Exec {
  stdout: Readable;
  stdin: Writable;
  done: Promise<{ code: number; stderr: string }>;
}
export type Stream = (cmd: string) => Promise<Exec>;

export async function withSsh<T>(
  target: SshTarget,
  fn: (run: Run, stream: Stream) => Promise<T>,
): Promise<T> {
  const client = await open(target);
  try {
    return await fn(
      (cmd, input) => exec(client, cmd, input),
      (cmd) => streamExec(client, cmd),
    );
  } finally {
    client.end();
  }
}

function classify(err: Error & { code?: string }): SshError {
  // Couldn't reach the machine at all: wrong IP, wrong port, firewall, it's off.
  const unreachableCodes = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
  ];
  if (err.code && unreachableCodes.includes(err.code)) {
    return new SshError("unreachable", "Server unreachable");
  }

  // Reached it, but it said no to our key (or wrong username).
  if (err.message.includes("All configured authentication methods failed")) {
    return new SshError("auth_failed", "Key refused");
  }

  // Reached it, but it never finished saying hello within readyTimeout.
  if (err.message.includes("Timed out while waiting for handshake")) {
    return new SshError("timeout", "Connection timed out");
  }

  return new SshError("unknown", "Connection failed");
}

/**
 * A command whose output is read as it arrives, for commands that never end
 * on their own (`docker logs -f`). stdout and stderr stay apart.
 */
export interface Follow {
  /** Resolves with the exit code when the command ends or the connection drops (-1). */
  done: Promise<number>;
  /**
   * Closes the channel. The server doesn't kill the command for that; it only
   * closes its stdin, so a follower must watch stdin (see the worker's logs).
   */
  stop(): void;
}

/**
 * A connection that stays open, for the log collector. Each `follow` is one
 * SSH channel; sshd allows about 10 per connection (MaxSessions), so a caller
 * following many commands opens more connections.
 */
export interface SshSession {
  run: Run;
  follow(cmd: string, onStdout: (d: Buffer) => void, onStderr: (d: Buffer) => void): Promise<Follow>;
  /** Resolves when the connection ends, with the error if it broke. */
  closed: Promise<Error | null>;
  close(): void;
}

export async function openSsh(target: SshTarget): Promise<SshSession> {
  // Keepalives notice a dead server within ~45 s instead of waiting on TCP.
  const client = await open(target, { keepaliveInterval: 15_000, keepaliveCountMax: 3 });
  const closed = new Promise<Error | null>((resolve) => {
    let error: Error | null = null;
    client.on("error", (e) => (error = e));
    client.on("close", () => resolve(error));
  });
  return {
    run: (cmd, input) => exec(client, cmd, input),
    follow: (cmd, onStdout, onStderr) => follow(client, cmd, onStdout, onStderr),
    closed,
    close: () => client.end(),
  };
}

function follow(client: Client, cmd: string, onStdout: (d: Buffer) => void, onStderr: (d: Buffer) => void): Promise<Follow> {
  return new Promise((resolve, reject) => {
    try {
      client.exec(cmd, (err, channel) => {
        // Not classified: "Channel open failure" means this connection has no
        // channel left, and the caller opens another connection for it.
        if (err) return reject(err);
        channel.on("data", onStdout);
        channel.stderr.on("data", onStderr);
        const done = new Promise<number>((res) => {
          let code = -1;
          channel.on("exit", (c: number | null) => (code = c ?? -1));
          channel.on("close", () => res(code));
        });
        resolve({ done, stop: () => channel.close() });
      });
    } catch (e) {
      reject(e as Error); // the connection is already gone
    }
  });
}

function open(target: SshTarget, extra: { keepaliveInterval?: number; keepaliveCountMax?: number } = {}): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client
      .on("ready", () => resolve(client))
      .on("error", (err) => reject(classify(err)))
      .connect({
        host: target.host,
        port: target.port,
        username: target.username,
        privateKey: target.privateKey,
        readyTimeout: 10_000,
        ...extra,
      });
  });
}

function exec(client: Client, cmd: string, input?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(classify(err));
      let stdout = "",
        stderr = "";
      stream
        .on("data", (d: Buffer) => (stdout += d.toString()))
        .on("close", (code: number) =>
          resolve({ code: code ?? -1, stdout, stderr }),
        );
      stream.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      if (input !== undefined) stream.end(input);
    });
  });
}

function streamExec(client: Client, cmd: string): Promise<Exec> {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, channel) => {
      if (err) return reject(classify(err));
      let stderr = "";
      // Keep only the start of stderr: enough to explain a failure.
      channel.stderr.on("data", (d: Buffer) => {
        if (stderr.length < 8_000) stderr += d.toString();
      });
      const done = new Promise<{ code: number; stderr: string }>((res) => {
        let code = -1;
        channel.on("exit", (c: number | null) => (code = c ?? -1));
        channel.on("close", () => res({ code, stderr }));
      });
      // The channel is one duplex stream: reading it is stdout, writing it is
      // stdin. stdin gets its own Writable so `pipeline(file, exec.stdin)`
      // finishes when the input is sent: with the duplex itself as the last
      // step, pipeline would also wait for stdout to end, which never happens
      // if nobody reads it.
      const stdin = new Writable({
        write: (chunk, _enc, cb) => {
          if (channel.write(chunk)) cb();
          else channel.once("drain", () => cb());
        },
        final: (cb) => {
          channel.end();
          cb();
        },
      });
      stdin.on("error", () => channel.close());
      resolve({ stdout: channel, stdin, done });
    });
  });
}
