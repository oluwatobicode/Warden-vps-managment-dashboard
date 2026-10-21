/** What running one shell command on the server gives back. */
export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs one command on the target server. In Warden this is the `run` that
 * ssh-client's `withSsh` hands out, but this package doesn't care how the
 * command gets there, which is also how the tests fake it.
 */
export type Run = (cmd: string, input?: string) => Promise<RunResult>;

export type DockerErrorKind = "not_installed" | "permission_denied" | "failed";

export class DockerError extends Error {
  constructor(
    public readonly kind: DockerErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "DockerError";
  }
}

/** Run a docker command and return stdout, or throw a DockerError saying why not. */
export async function docker(run: Run, cmd: string): Promise<string> {
  const r = await run(cmd);
  if (r.code === 0) return r.stdout;
  const err = r.stderr.toLowerCase();
  if (r.code === 127 || err.includes("command not found")) {
    throw new DockerError("not_installed", "Docker isn't installed on this server");
  }
  if (err.includes("permission denied")) {
    throw new DockerError("permission_denied", "This SSH user can't use Docker (add it to the docker group)");
  }
  // First line only: enough to say what went wrong, never a wall of output.
  const first = r.stderr.trim().split("\n")[0]?.slice(0, 200) || `exit code ${r.code}`;
  throw new DockerError("failed", first);
}
