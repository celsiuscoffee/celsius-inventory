import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { centralDb } from '@/lib/central-db';

// GET /api/outlets?brand_id=brand-celsius — fetch all active outlets
export async function GET(request: NextRequest) {
  try {
    // Try central DB "Outlet" table (Prisma schema)
    if (centralDb) {
      const { data, error } = await centralDb
        .from('Outlet')
        .select('id, name, code, status, loyaltyOutletId')
        .eq('status', 'ACTIVE')
        .order('name');

      if (!error && data?.length) {
        // Use loyaltyOutletId as the ID (for PIN verification compatibility)
        const mapped = data
          .filter((o: { loyaltyOutletId?: string }) => o.loyaltyOutletId)
          .map((o: { id: string; name: string; code?: string; loyaltyOutletId?: string }) => ({
            id: o.loyaltyOutletId,
            name: o.name,
            brand_id: 'brand-celsius',
            is_active: true,
          }));

        const response = NextResponse.json(mapped);
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
        return response;
      }
    }

    // Fall back to loyalty DB "outlets" table (legacy)
    const { data, error } = await supabaseAdmin
      .from('outlets')
      .select('id, brand_id, name, address, phone, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json(data);
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
