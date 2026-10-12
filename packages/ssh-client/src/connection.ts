import { Client } from "ssh2";

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

export async function withSsh<T>(
  target: SshTarget,
  fn: (run: (cmd: string) => Promise<RunResult>) => Promise<T>,
): Promise<T> {
  const client = await open(target);
  try {
    return await fn((cmd) => exec(client, cmd));
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

function open(target: SshTarget): Promise<Client> {
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
      });
  });
}

function exec(client: Client, cmd: string): Promise<RunResult> {
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
    });
  });
}
