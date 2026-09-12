import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

const BUCKET = "ad-flyers";
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — flyers don't need to be bigger than this

async function ensureBucketExists(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
}

/**
 * POST /api/admin/ads
 * multipart/form-data:
 *   sponsor_name, placement, target_link (optional)
 *   EITHER file (an actual image upload) OR flyer_image_url (a pasted URL)
 *
 * Real image uploads go to a public Supabase Storage bucket ("ad-flyers")
 * and the resulting public URL is what gets stored on the ad row — the
 * admin panel no longer requires hosting the image somewhere else first.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await req.formData();
  const sponsorName = formData.get("sponsor_name") as string | null;
  const placement = formData.get("placement") as string | null;
  const targetLink = (formData.get("target_link") as string | null) || null;
  const file = formData.get("file") as File | null;
  const pastedUrl = formData.get("flyer_image_url") as string | null;

  if (!sponsorName || !placement) {
    return NextResponse.json({ error: "Sponsor name and placement are required." }, { status: 400 });
  }
  if (!["watermark", "result_banner", "dashboard"].includes(placement)) {
    return NextResponse.json({ error: "Invalid placement." }, { status: 400 });
  }
  if (!file && !pastedUrl) {
    return NextResponse.json({ error: "Upload an image or provide a flyer URL." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let flyerImageUrl = pastedUrl ?? "";

  if (file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Image must be PNG, JPEG, WEBP, or GIF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
    }

    await ensureBucketExists(supabase);

    const ext = file.name.split(".").pop() || "png";
    const path = `${placement}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    flyerImageUrl = publicUrlData.publicUrl;
  }

  const { data: ad, error: insertErr } = await supabase
    .from("advertisements")
    .insert({
      sponsor_name: sponsorName,
      flyer_image_url: flyerImageUrl,
      target_link: targetLink,
      placement,
      is_active: true,
      created_by: admin.userId
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ad });
}

/** GET /api/admin/ads — list every ad (active or not) for the admin panel */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("advertisements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ads: data });
}

/** PATCH /api/admin/ads — body: { id, is_active } — toggle an ad on/off */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id, is_active } = await req.json();
  if (!id || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "id and is_active are required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("advertisements").update({ is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
