// Liveness for uptime checks and the extension. No data, no auth.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    service: "spark",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    checks: {
      database: Boolean(process.env.DATABASE_URL),
      blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      ai: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  });
}
