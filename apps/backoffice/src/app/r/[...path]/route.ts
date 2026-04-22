import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { popDownloadName, invoiceDownloadName } from "@/lib/inventory/file-naming";

/**
 * GET /r/[...path]
 *
 * Short-link resolver. Accepts two path shapes:
 *   /r/f1bb4eff                                    — legacy, still works
 *   /r/f1bb4eff/POP_26-0374_Blancoz_RM240.00.pdf   — preferred, URL reads
 *
 * The first segment is the 8-char hex id (the actual resolution key). Any
 * trailing segments are decorative — ignored server-side, so a stale slug
 * still resolves to the current file (GitHub-gist pattern).
 *
 * Proxies PDFs so we can force `application/pdf` and a readable
 * Content-Disposition. Images 302 to Cloudinary with `fl_attachment` so they
 * also download with a proper name.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const id = path?.[0] ?? "";
  if (!id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const link = await prisma.shortLink.findUnique({ where: { id } });
  if (!link) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Look up the linked invoice for filename metadata. Either the shortlink is
  // the POP (stored on Invoice.popShortLink) or it's an invoice photo. The
  // `contains` match on popShortLink tolerates both legacy (`/r/{id}`) and
  // slug-suffixed (`/r/{id}/POP_...pdf`) URLs.
  const popMarker = `/r/${id}`;
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [
        { popShortLink: { contains: popMarker } },
        { photos: { has: link.url } },
      ],
    },
    select: {
      invoiceNumber: true,
      amount: true,
      paidAt: true,
      popShortLink: true,
      photos: true,
      supplier: { select: { name: true } },
      vendorName: true,
      order: { select: { claimedBy: { select: { name: true } } } },
    },
  });

  const isPopLink = invoice?.popShortLink?.includes(popMarker) ?? false;

  const isRaw = /\/raw\/upload\//i.test(link.url);
  const hasImageExt = /\.(jpe?g|png|webp|gif|heic|avif)(\?|$)/i.test(link.url);

  // Build the download filename (falls back to the shortlink id if no invoice match).
  function buildName(ext: "pdf" | "jpg"): string {
    if (!invoice) return `${id}.${ext}`;
    return isPopLink ? popDownloadName(invoice, ext) : invoiceDownloadName(invoice, ext);
  }

  // Image fast path: 302 to Cloudinary with fl_attachment so the download
  // filename is set by Cloudinary itself (no proxy overhead). Cloudinary
  // rejects fl_attachment values containing `.` (it interprets them as a
  // file-extension separator), so strip the extension then swap any remaining
  // periods for hyphens — e.g. `RM21.20` → `RM21-20`.
  if (!isRaw && hasImageExt) {
    const raw = buildName("jpg").replace(/\.[^.]+$/, "");
    const attachmentName = raw.replace(/\./g, "-");
    const target = link.url.replace(
      /\/image\/upload\//,
      `/image/upload/fl_attachment:${encodeURIComponent(attachmentName)}/`,
    );
    return NextResponse.redirect(target, 302);
  }

  let upstream: Response;
  try {
    upstream = await fetch(link.url);
  } catch (err) {
    console.error("[shortlink] upstream fetch failed:", err);
    return new NextResponse("Upstream unavailable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Upstream error", { status: upstream.status || 502 });
  }

  const buf = new Uint8Array(await upstream.arrayBuffer());
  const isPdf = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF

  const upstreamType = upstream.headers.get("content-type") || "";
  const contentType = isPdf ? "application/pdf" : upstreamType || "application/octet-stream";
  const filename = buildName(isPdf ? "pdf" : "jpg");

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buf.byteLength),
      // Inline so browsers render PDFs in-tab; the filename kicks in on download.
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
