/**
 * Minimal Vercel function — runtime probe.
 *
 * Deliberately zero dependencies and zero network calls: if THIS fails,
 * the function runtime itself is broken (build/system issue). If it returns
 * ok, the runtime is fine and the failure is in the heavier proxies
 * (bundling, globals, or upstream fetches).
 *
 * Client contract:
 *   200 { ok: true, runtime, node, hasFetch, hasResponse, envKeys[] }
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(): Promise<Response> {
  return json({
    ok: true,
    runtime: "v8-detected",
    node: typeof process !== "undefined" ? (process.version ?? "n/a") : "no-process",
    hasFetch: typeof fetch === "function",
    hasResponse: typeof Response === "function",
    hasAbortController: typeof AbortController === "function",
    envKeys: Object.keys(process?.env ?? {}).filter((k) =>
      k.startsWith("NEWS") || k === "VERCEL" || k.startsWith("NODE"),
    ),
    at: new Date().toISOString(),
  });
}
