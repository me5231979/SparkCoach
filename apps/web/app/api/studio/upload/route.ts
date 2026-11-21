// Client uploads for Studio source files (PDF, Word, PowerPoint, images, video frames) straight to the private
// Blob store, so large files never pass through a function body. Authors only, into their own org's folder.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ctx } from "../../../../lib/session";

const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png", "image/jpeg", "image/webp", "image/gif",
];

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const out = await handleUpload({
      request: req, body,
      onBeforeGenerateToken: async (pathname) => {
        const c = await ctx();
        if (!c || !c.can("author")) throw new Error("Sign in as an author.");
        if (!pathname.startsWith(`orgs/${c.org.id}/sources/`)) throw new Error("Wrong folder.");
        return { allowedContentTypes: ALLOWED, maximumSizeInBytes: 30 * 1024 * 1024, addRandomSuffix: true, validUntil: Date.now() + 10 * 60_000 };
      },
    });
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 400 });
  }
}
