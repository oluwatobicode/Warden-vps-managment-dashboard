import { q, removeFile, writePrivateFile, type Run } from "docker-client";
import type { Stream } from "ssh-client";
import type { DeployLog } from "./logger";

/*
 * Steps 2 and 3 of a deploy: get the code onto the server, and turn it into
 * an image. Git runs in a small container, so the server doesn't need git
 * installed; the build runs with the server's own Docker.
 */

export const GIT_IMAGE = "alpine/git:v2.54.0";
/** Builds stop after 20 minutes (a stuck `npm install`, an endless loop). */
const BUILD_TIMEOUT_S = 20 * 60;

/** Run a command on the server and copy everything it prints into the deploy log. */
export async function streamed(stream: Stream, log: DeployLog, cmd: string): Promise<{ code: number; tail: string }> {
  const exec = await stream(`${cmd} 2>&1`);
  exec.stdin.end();
  let tail = "";
  exec.stdout.on("data", (d: Buffer) => {
    const text = d.toString();
    log.write(text);
    tail = (tail + text).slice(-4000);
  });
  const { code } = await exec.done;
  return { code, tail };
}

export interface CloneOptions {
  /** Where the code goes, an absolute path on the server. */
  dir: string;
  /** https://github.com/owner/repo */
  repoUrl: string;
  /** A commit sha, or a branch name. */
  ref: string;
  /** A GitHub App installation token, for private repos. Never logged, never on a command line. */
  token?: string;
}

/**
 * Fetch exactly one commit (shallow, fast). The token, if any, reaches git
 * through a credential helper reading it from an env file, so it never
 * appears in a process list, in `docker inspect` of anything that lives on,
 * or in the build folder (where `COPY . .` would bake it into the image).
 */
export async function clone(run: Run, stream: Stream, log: DeployLog, o: CloneOptions): Promise<{ sha: string; message: string }> {
  const tokenFile = `${o.dir}.git-token`;
  const url = `${o.repoUrl.replace(/\/+$/, "").replace(/\.git$/, "")}.git`;
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(url)) throw new Error("The repo address isn't a github.com repository");
  if (!/^[\w./-]+$/.test(o.ref)) throw new Error("That branch or commit name has characters Warden won't pass to git");

  const mk = await run(`mkdir -p ${q(o.dir)} && echo "$(id -u):$(id -g)"`);
  if (mk.code !== 0) throw new Error(`Couldn't create the build folder: ${mk.stderr.trim()}`);
  const user = mk.stdout.trim();
  if (o.token) await writePrivateFile(run, tokenFile, `GIT_TOKEN=${o.token}\n`);

  const helper = `credential.helper=!f() { echo username=x-access-token; echo "password=$GIT_TOKEN"; }; f`;
  const script = [
    "set -e",
    "git init -q",
    `git remote add origin ${q(url)}`,
    `git ${o.token ? `-c ${q(helper)} ` : ""}fetch --depth 1 origin ${q(o.ref)}`,
    "git checkout -q FETCH_HEAD",
    // The last two lines of the output: the commit Warden really got.
    "git log -1 --format='%H%n%s'",
  ].join(" && ");
  try {
    const r = await streamed(
      stream,
      log,
      [
        "docker run --rm",
        `--user ${q(user)}`,
        "-e HOME=/tmp",
        o.token ? `--env-file ${q(tokenFile)}` : "",
        `-v ${q(`${o.dir}:/src`)}`,
        "-w /src",
        "--entrypoint sh",
        GIT_IMAGE,
        `-c ${q(script)}`,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (r.code !== 0) {
      if (/could not read Username|Authentication failed|Repository not found|not found/i.test(r.tail)) {
        throw new Error(o.token ? "GitHub refused access to the repo. Is it still allowed in the Warden GitHub App?" : "Couldn't read the repo. If it's private, connect GitHub (Settings → GitHub) and pick it there");
      }
      if (/couldn't find remote ref|no such ref/i.test(r.tail)) throw new Error(`The branch or commit "${o.ref}" doesn't exist in the repo`);
      throw new Error("Couldn't get the code from GitHub (see the log)");
    }
    const lines = r.tail.trim().split("\n");
    return { sha: lines.at(-2)?.trim() ?? "", message: lines.at(-1)?.trim() ?? "" };
  } finally {
    if (o.token) await removeFile(run, tokenFile);
  }
}

/** Is there a Dockerfile at this path? (Then it's used; otherwise Railpack.) */
export async function hasDockerfile(run: Run, contextDir: string, dockerfilePath: string): Promise<boolean> {
  return (await run(`test -f ${q(`${contextDir}/${dockerfilePath}`)}`)).code === 0;
}

/** Build with the repo's own Dockerfile. */
export async function buildDockerfile(stream: Stream, log: DeployLog, o: { contextDir: string; dockerfilePath: string; tag: string; serviceId: string }): Promise<void> {
  const r = await streamed(
    stream,
    log,
    [
      `cd ${q(o.contextDir)} &&`,
      `timeout ${BUILD_TIMEOUT_S}`,
      "docker build --progress=plain",
      `-f ${q(o.dockerfilePath)}`,
      `-t ${q(o.tag)}`,
      "--label warden=1",
      `--label ${q(`warden.service=${o.serviceId}`)}`,
      ".",
    ].join(" "),
  );
  if (r.code !== 0) throw buildError(r.code, r.tail);
}

/** Turn a failed build's exit code and last output into one sentence a person can act on. */
export function buildError(code: number, tail: string): Error {
  if (/no space left on device/i.test(tail)) return new Error("The server ran out of disk space during the build. Run Docker cleanup on the server's page, then deploy again");
  if (code === 137 || /signal: killed|exit code: 137|out of memory/i.test(tail)) return new Error("The build ran out of memory. Add swap or use a server with more RAM");
  if (code === 124) return new Error("The build took longer than 20 minutes and was stopped");
  return new Error("The build failed (see the log for the error)");
}
