-- Shared reference catalogue. Only explicitly approved records are readable by app clients.
-- Writes are intentionally restricted to trusted database administrators/service operations.
create table if not exists public.nutrition_catalog (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) between 1 and 160),
  normalized_name text not null check (length(trim(normalized_name)) between 1 and 180),
  aliases text[] not null default '{}',
  brand text,
  barcode text,
  calories_kcal numeric(10,2) not null check (calories_kcal >= 0),
  protein_g numeric(10,3) not null check (protein_g >= 0),
  carbs_g numeric(10,3) not null check (carbs_g >= 0),
  fat_g numeric(10,3) not null check (fat_g >= 0),
  basis_amount numeric(10,3) not null check (basis_amount > 0),
  basis_unit text not null check (basis_unit in ('g','ml')),
  source_name text not null,
  source_record_id text,
  source_url text,
  extraction_method text not null,
  confidence_status text not null check (confidence_status in ('Strong source match','Good source match')),
  is_approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, source_name, source_record_id)
);

create index if not exists nutrition_catalog_approved_name_idx
  on public.nutrition_catalog (normalized_name) where is_approved = true;
create index if not exists nutrition_catalog_approved_barcode_idx
  on public.nutrition_catalog (barcode) where is_approved = true and barcode is not null;
create index if not exists nutrition_catalog_aliases_idx
  on public.nutrition_catalog using gin (aliases);

alter table public.nutrition_catalog enable row level security;
revoke all on public.nutrition_catalog from anon, authenticated;
grant select on public.nutrition_catalog to anon, authenticated;

drop policy if exists "Approved nutrition catalogue is readable" on public.nutrition_catalog;
create policy "Approved nutrition catalogue is readable"
  on public.nutrition_catalog for select
  to anon, authenticated
  using (is_approved = true and approved_at is not null);

comment on table public.nutrition_catalog is
  'Curated, shared nutrition reference records. Populate only from reviewed source-backed facts; app clients have read-only access.';
