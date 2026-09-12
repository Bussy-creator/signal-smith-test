import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

/** GET /api/admin/settings — list every setting for the admin panel */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

/**
 * PATCH /api/admin/settings
 * body: { key, value }
 * Upserts a single setting. Students read these directly via the public
 * "read settings" RLS policy — no separate public endpoint needed.
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ error: "key is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value: value ?? "", updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
