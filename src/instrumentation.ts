/**
 * Runs once at boot, in every runtime. The actual wiring lives in
 * ./instrumentation-node because it reaches the database and native deps, and this
 * file is compiled for the Edge runtime too (middleware). The literal
 * `process.env.NEXT_RUNTIME === "nodejs"` check is what lets the bundler drop the
 * import from the Edge build — a runtime guard around a dynamic import is not
 * enough, it still drags `stream` into a bundle that has no `stream`.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
