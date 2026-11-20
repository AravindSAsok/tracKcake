-- Nutrition Engine V2: durable, user-owned recipe history and richer catalogue provenance.
-- Additive only: existing diary/catalogue records are preserved.
alter table public.nutrition_catalog
  add column if not exists category text,
  add column if not exists serving_definitions jsonb not null default '[]'::jsonb,
  add column if not exists optional_nutrients jsonb not null default '{}'::jsonb,
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists supersedes_id uuid references public.nutrition_catalog(id) on delete set null,
  add column if not exists reviewed_by text,
  add column if not exists review_notes text;

create index if not exists nutrition_catalog_barcode_exact_idx
  on public.nutrition_catalog (barcode) where barcode is not null;
create index if not exists nutrition_catalog_source_record_idx
  on public.nutrition_catalog (source_name, source_record_id) where source_record_id is not null;

create table if not exists public.nutrition_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_name text not null check (char_length(trim(recipe_name)) between 1 and 90),
  servings integer not null check (servings between 1 and 50),
  ingredients jsonb not null check (
    jsonb_typeof(ingredients) = 'array'
    and jsonb_array_length(ingredients) between 2 and 8
  ),
  total_nutrition jsonb not null check (jsonb_typeof(total_nutrition) = 'object'),
  per_serving_nutrition jsonb not null check (jsonb_typeof(per_serving_nutrition) = 'object'),
  diary_entry_id uuid references public.food_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nutrition_recipes_user_created_idx
  on public.nutrition_recipes (user_id, created_at desc);
create unique index if not exists nutrition_recipes_diary_entry_unique_idx
  on public.nutrition_recipes (diary_entry_id) where diary_entry_id is not null;

alter table public.nutrition_recipes enable row level security;
drop policy if exists "Users can read their own nutrition recipes" on public.nutrition_recipes;
create policy "Users can read their own nutrition recipes"
  on public.nutrition_recipes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their own nutrition recipes" on public.nutrition_recipes;
create policy "Users can create their own nutrition recipes"
  on public.nutrition_recipes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own nutrition recipes" on public.nutrition_recipes;
create policy "Users can update their own nutrition recipes"
  on public.nutrition_recipes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own nutrition recipes" on public.nutrition_recipes;
create policy "Users can delete their own nutrition recipes"
  on public.nutrition_recipes for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.nutrition_recipes to authenticated;
comment on table public.nutrition_recipes is
  'User-owned recipe history with ingredient-level nutrition and source provenance. Diary entries remain separate and are never auto-created by this table.';
