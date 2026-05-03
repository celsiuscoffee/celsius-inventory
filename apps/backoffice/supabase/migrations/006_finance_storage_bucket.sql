-- Finance Module — storage bucket for AP supplier doc uploads
-- Private bucket, 15 MB cap, PDF/JPEG/PNG/WEBP only. Server-side reads
-- create signed URLs with short TTL (see /api/finance/exceptions/[id]).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('finance-docs', 'finance-docs', false, 15728640,
   array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
