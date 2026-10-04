-- ============================================================================
-- Migration 005 — Public blog (buying guides, maintenance tips, etc.)
-- Readable by anyone, no login required. Writable only by accounts with
-- profiles.platform_role = 'admin' (that enum value already exists from
-- migration 004 — no one has it set yet, so grant it manually:
--   update public.profiles set platform_role = 'admin' where id = '<uuid>';
-- ============================================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users (id) on delete set null,

  slug text not null unique,
  title text not null,
  excerpt text,
  cover_image_url text,
  content text not null, -- plain text / simple markdown, rendered as paragraphs — see app/blog/[slug]/page.tsx
  category text not null default 'guide' check (category in ('guide', 'maintenance', 'sustainability', 'news')),

  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute procedure public.set_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists "Anyone can view published posts" on public.blog_posts;
create policy "Anyone can view published posts"
  on public.blog_posts for select
  using (status = 'published');

drop policy if exists "Admins can view all posts" on public.blog_posts;
create policy "Admins can view all posts"
  on public.blog_posts for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

drop policy if exists "Admins can write posts" on public.blog_posts;
create policy "Admins can write posts"
  on public.blog_posts for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

drop policy if exists "Admins can update posts" on public.blog_posts;
create policy "Admins can update posts"
  on public.blog_posts for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));

drop policy if exists "Admins can delete posts" on public.blog_posts;
create policy "Admins can delete posts"
  on public.blog_posts for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.platform_role = 'admin'));
