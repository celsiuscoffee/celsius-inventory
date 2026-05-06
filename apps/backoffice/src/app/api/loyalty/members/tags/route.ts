import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/loyalty/supabase';
import { requireAuth } from '@/lib/auth';

// GET /api/loyalty/members/tags
// Returns the distinct member tags currently in use, with how many members
// carry each tag. Used by the promotion modal so admins can pick from the
// existing cohort vocabulary instead of free-typing tag strings (which is
// case-sensitive and easy to mis-spell).
//
// Sorted by member count desc — most common tags surface first.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { data, error } = await supabaseAdmin.rpc('member_tag_counts');
  if (error) {
    // Fallback to inline query if the RPC isn't deployed yet — keeps the
    // promotion modal usable while migrations catch up.
    const { data: rows, error: queryErr } = await supabaseAdmin
      .from('members')
      .select('tags')
      .not('tags', 'is', null);
    if (queryErr) {
      return NextResponse.json({ error: queryErr.message }, { status: 500 });
    }
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      const tags = (r.tags as string[] | null) ?? [];
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const list = Array.from(counts, ([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json(list);
  }

  return NextResponse.json(data ?? []);
}
