-- =============================================================================
-- User Preferences Table
-- =============================================================================
-- Stores per-user dashboard preferences: layout, watchlist, theme, interval.
-- Single row per user. Run this migration in the Supabase Dashboard SQL editor.
-- =============================================================================

create table public.user_preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb,
  watchlist_symbols text[] default '{}',
  theme text default 'dark' check (theme in ('dark', 'light')),
  interval text default '1m' check (interval in ('1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M')),
  updated_at timestamptz default now()
);

-- RLS: users can only access their own row
alter table public.user_preferences enable row level security;

create policy "Users can read own preferences"
  on public.user_preferences for select
  using (auth.uid() = id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
