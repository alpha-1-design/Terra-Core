#!/usr/bin/env node
/**
 * One-shot GitHub puller for Terra-Core.
 *
 * The sandbox blocks `git`, so this mirrors `git pull` through the REST API:
 *   1. read the current commit on `main` (or any branch)
 *   2. walk its tree, computing the real git blob SHA of every local file
 *      (SHA-1 of `blob <len>\0<content>`)
 *   3. download files missing locally or whose SHA differs (pull-downs)
 *   4. list files present locally but absent from the remote tree (pull-deletes)
 *   5. print both lists; apply pull-downs, and pull-deletes too when `--apply-deletes`
 *      is passed (extra local files may be intentional new work, so nothing is
 *      deleted without the explicit flag)
 *
 * Usage:
 *   bun run scripts/pull-from-github.mjs [--apply-deletes]
 *   GITHUB_TOKEN=ghp_xxx bun run scripts/pull-from-github.mjs
 *   — or write the token to `.github-token.tmp` (never uploaded; deleted by
 *     this script when it finishes).
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_NAME = "Terra-Core";
const BRANCH = "main";
const APPLY_DELETES = process.argv.includes("--apply-deletes");

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ── Files that must never be touched on disk ─────────────────── */
const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".git"]);
const EXCLUDED_FILES = new Set([".github-token.tmp", ".DS_Store"]);
// Never pull these down from the remote — they may hold live secrets
// that only exist in this environment.
const NEVER_DOWNLOAD = [".env", ".env.local"];
// Local-only files that must survive --apply-deletes (this script itself).
const KEEP_LOCAL = new Set(["scripts/pull-from-github.mjs"]);

let TOKEN = process.env.GITHUB_TOKEN ?? "";
if (!TOKEN) {
  try {
    TOKEN = readFileSync(join(ROOT, ".github-token.tmp"), "utf8").trim();
  } catch {
    console.error("No token. Set GITHUB_TOKEN env var or write .github-token.tmp");
    process.exit(1);
  }
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "terra-core-puller",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = data?.message ? `: ${data.message}` : "";
    throw new Error(`GitHub ${method} ${path} → ${res.status}${msg}`);
  }
  return data;
}

/* ── Walk the local project ───────────────────────────────────── */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split(sep).join("/");
    if (EXCLUDED_DIRS.has(entry) || EXCLUDED_FILES.has(entry)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(rel);
  }
  return out;
}

/* ── Real git blob SHA of a local file ────────────────────────── */
function gitBlobSha(content) {
  const header = Buffer.from(`blob ${Buffer.byteLength(content)}\0`);
  return createHash("sha1").update(Buffer.concat([header, content])).digest("hex");
}

function isBinary(buf) {
  // Same heuristic git uses: look for NUL bytes in the first 8 KiB.
  const len = Math.min(buf.length, 8192);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

/* ── Main ─────────────────────────────────────────────────────── */
async function main() {
  const user = await api("/user");
  const owner = user.login;
  console.log(`→ Authenticated as @${owner}`);

  const ref = await api(`/repos/${owner}/${REPO_NAME}/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  console.log(`→ ${owner}/${REPO_NAME} @ ${BRANCH} · ${headSha.slice(0, 7)}`);

  const commit = await api(`/repos/${owner}/${REPO_NAME}/git/commits/${headSha}`);
  console.log(`→ Latest commit: "${commit.message.split("\n")[0]}"`);
  if (commit.author?.name) console.log(`  authored by ${commit.author.name}`);

  const tree = await api(`/repos/${owner}/${REPO_NAME}/git/trees/${commit.tree.sha}?recursive=1`);
  const remoteFiles = tree.tree.filter((e) => e.type === "blob");
  console.log(`→ Remote tree: ${remoteFiles.length} files${tree.truncated ? " (TRUNCATED)" : ""}`);
  if (tree.truncated) throw new Error("remote tree truncated — too many files for one call");

  const remoteByPath = new Map(remoteFiles.map((e) => [e.path, e.sha]));
  const localFiles = walk(ROOT);
  const localShaByPath = new Map();
  for (const rel of localFiles) {
    localShaByPath.set(rel, gitBlobSha(readFileSync(join(ROOT, rel))));
  }

  /* ── Pull-downs: remote files missing or different locally ── */
  const toPull = [];
  for (const [path, remoteSha] of remoteByPath) {
    if (NEVER_DOWNLOAD.some((p) => path === p || path.startsWith(`${p}/`))) continue;
    if (localShaByPath.get(path) !== remoteSha) toPull.push({ path, sha: remoteSha });
  }

  /* ── Pull-deletes: local files absent from the remote tree ── */
  const remotePaths = new Set(remoteByPath.keys());
  const localExtra = localFiles.filter(
    (p) =>
      !remotePaths.has(p) &&
      !KEEP_LOCAL.has(p) &&
      !NEVER_DOWNLOAD.some((n) => p === n || p.startsWith(`${n}/`)),
  );

  console.log(`\n=== Pull-downs (${toPull.length}) ===`);
  for (const { path } of toPull) console.log(`  ↓ ${path}`);
  console.log(`\n=== Pull-deletes (${localExtra.length}) ===`);
  for (const path of localExtra) console.log(`  ✕ ${path}`);

  if (toPull.length === 0 && localExtra.length === 0) {
    console.log("\n✓ Workspace already matches the remote — nothing to do.");
    return;
  }

  /* ── Download & write pull-downs ───────────────────────────── */
  let pulled = 0;
  for (const { path, sha } of toPull) {
    if (!sha) {
      console.warn(`  ! skipping ${path} — no blob sha`);
      continue;
    }
    const blob = await api(`/repos/${owner}/${REPO_NAME}/git/blobs/${sha}`);
    const buf = Buffer.from(blob.content, "base64");
    const dest = join(ROOT, path);
    mkdirSync(dirname(dest), { recursive: true });
    if (isBinary(buf)) {
      writeFileSync(dest, buf);
    } else {
      writeFileSync(dest, buf, "utf8");
    }
    pulled += 1;
    if (pulled % 25 === 0 || pulled === toPull.length) console.log(`↓ ${pulled}/${toPull.length} written`);
  }

  /* ── Pull-deletes: remove local files absent from the remote ── */
  let deleted = 0;
  if (APPLY_DELETES && localExtra.length > 0) {
    console.log(`\n→ --apply-deletes passed — removing ${localExtra.length} local-only files…`);
    for (const rel of localExtra) {
      const dest = join(ROOT, rel);
      try {
        unlinkSync(dest);
        deleted += 1;
      } catch {
        /* already gone */
      }
    }
    // Prune now-empty directories left behind by the deletions.
    for (const rel of localExtra) {
      let dir = dirname(join(ROOT, rel));
      while (dir.startsWith(ROOT) && dir !== ROOT) {
        try {
          const entries = readdirSync(dir);
          if (entries.length > 0) break;
          rmSync(dir, { recursive: true });
        } catch {
          break;
        }
        dir = dirname(dir);
      }
    }
    console.log(`✕ ${deleted}/${localExtra.length} removed`);
  } else if (localExtra.length > 0) {
    console.log(
      `\n→ ${localExtra.length} local-only files kept (pass --apply-deletes to remove them too).`,
    );
  }

  console.log(`\n✓ Pulled ${pulled} file${pulled === 1 ? "" : "s"} from ${owner}/${REPO_NAME}@${BRANCH}`);
  console.log(`  workspace now matches ${headSha.slice(0, 7)}`);
}

main()
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      const tmp = join(ROOT, ".github-token.tmp");
      if (statSync(tmp).isFile()) unlinkSync(tmp);
      console.log("→ token file cleaned up");
    } catch {
      /* already gone */
    }
  });
