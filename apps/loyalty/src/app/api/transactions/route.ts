import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/transactions?member_id=member-1&brand_id=brand-celsius&limit=50
// Fetch point transactions for a member (paginated)
// Public endpoint — customers access via OTP-verified session (phone stored client-side).
// member_id acts as the access token; transactions are non-sensitive point history.
// Rate-limited per member_id to prevent enumeration / scraping.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    const brandId = searchParams.get('brand_id');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
    const page = parseInt(searchParams.get('page') ?? '0');

    if (!memberId || !brandId) {
      return NextResponse.json(
        { error: 'member_id and brand_id query parameters are required' },
        { status: 400 }
      );
    }

    const rateCheck = await checkRateLimit(`txn:${memberId}`, RATE_LIMITS.PHONE_LOOKUP);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('member_id', memberId)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
