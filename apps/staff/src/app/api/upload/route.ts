import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const BUCKET = "checklist-photos";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/upload
 * Upload a photo to Supabase Storage.
 * Accepts multipart/form-data with a "file" field.
 * Returns the public URL.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
  }

  // Generate unique path: checklist-photos/{date}/{userId}/{timestamp}.{ext}
  const date = new Date().toISOString().split("T")[0];
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${date}/${session.id}/${Date.now()}.${ext}`;

  const buffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    // Auto-create bucket if it doesn't exist
    if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
      await supabase.storage.createBucket(BUCKET, { public: true });
      const { error: retryError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: false });
      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
