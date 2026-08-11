#!/usr/bin/env node
/**
 * One-shot GitHub publisher for Terra-Core.
 *
 * The sandbox blocks `git` entirely, so this script performs the full
 * "create repo + initialize + push" through the GitHub REST API using the
 * low-level Git Data endpoints (blobs → tree → commit → ref), producing a
 * single clean initial commit on `main` with the real author metadata.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx bun run scripts/push-to-github.mjs
 *   — or write the token to `.github-token.tmp` (never uploaded; deleted
 *     by this script when it finishes).
 *
 * Requires a token with `repo` scope.
 */
import { readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_NAME = "Terra-Core";
const REPO_DESCRIPTION =
  "Terra-Core — real-time global monitoring console. Live ADS-B aircraft, weather & AQI, NWS alerts, space weather, aurora oval, precipitation radar, live TV and world news (GDELT / GNews) on an interactive 3D globe. Zero-backend client-side app, installable PWA — an extension of Core-x (Global Watch).";
const BRANCH = "main";
const COMMIT_MESSAGE = "Initial commit: Terra-Core global monitoring console";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ── Files that must never be uploaded ─────────────────────────── */
const EXCLUDED_DIRS = new Set(["node_modules", "dist", ".git"]);
const EXCLUDED_FILES = new Set([
  ".env.local",
  ".env",
  ".env.example",
  ".github-token.tmp",
  ".DS_Store",
  "main.ts", // stale template artifact (Hono/Deno server)
  "integrations.md", // stale template artifact (VLY/Convex docs)
  "sst-env.d.ts", // stale template artifact (SST)
  "package-lock.json", // stale npm lockfile from the removed Convex stack
]);

/* ── GitHub API helper ─────────────────────────────────────────── */
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
      "user-agent": "terra-core-publisher",
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

/* ── Walk the project ──────────────────────────────────────────── */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split(sep).join("/");
    if (EXCLUDED_DIRS.has(entry) || EXCLUDED_FILES.has(entry)) continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (st.size > 0 || /\.(tsx?|jsx?|mjs|css|html|json|md|svg)$/.test(entry)) {
      out.push(rel);
    }
  }
  return out;
}

/* ── Main ──────────────────────────────────────────────────────── */
async function main() {
  const user = await api("/user");
  const owner = user.login;
  console.log(`→ Authenticated as @${owner}`);

  // 1. Create the repository (reuse it if it already exists but is empty)
  try {
    await api("/user/repos", {
      method: "POST",
      body: {
        name: REPO_NAME,
        description: REPO_DESCRIPTION,
        private: false,
        has_issues: true,
        has_projects: false,
        has_wiki: false,
      },
    });
    console.log(`✓ Created ${owner}/${REPO_NAME} (public)`);
  } catch (err) {
    if (!String(err).includes("422")) throw err;
    // An empty repo still reports a default_branch, so check commits instead:
    // GET /commits on a repo with zero commits returns 409 "Git Repository is empty".
    let hasCommits = false;
    try {
      const commits = await api(`/repos/${owner}/${REPO_NAME}/commits?per_page=1`);
      hasCommits = commits.length > 0;
    } catch (err) {
      if (!String(err).includes("409")) throw err;
    }
    if (hasCommits) {
      throw new Error(`Repo ${owner}/${REPO_NAME} already exists with content — stopping.`);
    }
    console.log(`→ Repo ${owner}/${REPO_NAME} already exists (empty) — reusing it`);
  }

  // 2. Seed an initial ref — GitHub's Git Database API refuses to create
  // blobs in a repo with zero commits (409 "Git Repository is empty"), so
  // the README is committed first via the Contents API. The full tree is
  // later attached as an orphan commit and main is force-pointed at it,
  // leaving a single clean initial commit.
  const readme = readFileSync(join(ROOT, "README.md")).toString("utf8");
  try {
    await api(`/repos/${owner}/${REPO_NAME}/contents/README.md`, {
      method: "PUT",
      body: { message: "Seed repository", content: Buffer.from(readme).toString("base64") },
    });
    console.log("✓ Seeded initial ref (README)");
  } catch (err) {
    if (!String(err).includes("422")) throw err;
    console.log("→ README already present — skipping seed");
  }

  // 3. Upload every file as a git blob
  const files = walk(ROOT).sort();
  console.log(`→ Uploading ${files.length} files as blobs…`);
  const blobs = [];
  let i = 0;
  for (const rel of files) {
    const content = readFileSync(join(ROOT, rel));
    const { sha } = await api(`/repos/${owner}/${REPO_NAME}/git/blobs`, {
      method: "POST",
      body: { content: content.toString("base64"), encoding: "base64" },
    });
    blobs.push({ path: rel, sha });
    i += 1;
    if (i % 25 === 0 || i === files.length) console.log(`   ${i}/${files.length}`);
  }

  // 4. Build the nested tree and create it
  const rootNode = {};
  for (const { path, sha } of blobs) {
    const parts = path.split("/");
    let node = rootNode;
    for (let p = 0; p < parts.length - 1; p++) {
      node.dirs ??= {};
      node.dirs[parts[p]] ??= {};
      node = node.dirs[parts[p]];
    }
    node.blobs ??= {};
    node.blobs[parts[parts.length - 1]] = sha;
  }

  async function createTree(node) {
    const entries = [];
    for (const [name, sub] of Object.entries(node.dirs ?? {})) {
      entries.push({ path: name, mode: "040000", type: "tree", sha: await createTree(sub) });
    }
    for (const [name, sha] of Object.entries(node.blobs ?? {})) {
      entries.push({ path: name, mode: "100644", type: "blob", sha });
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    const { sha } = await api(`/repos/${owner}/${REPO_NAME}/git/trees`, {
      method: "POST",
      body: { tree: entries },
    });
    return sha;
  }
  console.log("→ Creating tree…");
  const treeSha = await createTree(rootNode);

  // 5. Create the full tree as an ORPHAN commit (no parents), then force
  // main to it — the seed commit falls out of history, leaving one commit.
  const authorEmail = user.email ?? `${user.id}+${user.login}@users.noreply.github.com`;
  const author = { name: user.name ?? user.login, email: authorEmail };
  const { sha: commitSha } = await api(`/repos/${owner}/${REPO_NAME}/git/commits`, {
    method: "POST",
    body: { message: COMMIT_MESSAGE, tree: treeSha, parents: [], author, committer: author },
  });
  console.log("✓ Initial commit created");

  // 6. Point main at it (force — orphan commit replaces the seed)
  await api(`/repos/${owner}/${REPO_NAME}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: { sha: commitSha, force: true },
  });
  console.log(`✓ Pushed ${BRANCH} → https://github.com/${owner}/${REPO_NAME}`);
  console.log(`  ${files.length} files · 1 commit · public`);
}

main()
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      // Never leave the token on disk
      const tmp = join(ROOT, ".github-token.tmp");
      if (statSync(tmp).isFile()) unlinkSync(tmp);
      console.log("→ token file cleaned up");
    } catch {
      /* already gone */
    }
  });
