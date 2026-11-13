import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewProject } from "@/lib/rbac";
import { storage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const asset = await db.projectAsset.findUnique({
    where: { id },
    include: { project: { select: { editorId: true, tasks: { select: { assigneeId: true } } } } },
  });
  if (!asset) return new Response("Not found", { status: 404 });
  if (!canViewProject(session.user, asset.project)) return new Response("Forbidden", { status: 403 });
  if (asset.url) return Response.redirect(asset.url, 302);
  if (!asset.storageKey) return new Response("Not found", { status: 404 });

  const buf = await storage.download(asset.storageKey);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": asset.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(asset.filename ?? "download")}"`,
    },
  });
}
