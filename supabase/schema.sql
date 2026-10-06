-- Perenidade: esquema inicial (Supabase / PostgreSQL)
-- Princípios: zero PII além do necessário, sem PDFs hospedados, moderação por status, RLS estrito.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('user', 'moderator', 'admin');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.submission_kind as enum ('lesson', 'book_link');

-- Perfis (espelho mínimo de auth.users; login só por OAuth, sem senhas)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Livros: apenas metadados + link externo. NUNCA arquivos.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  synopsis text,
  cover_url text,
  external_url text not null check (external_url ~* '^https?://'),
  license text not null,
  area text not null,
  is_active boolean not null default true, -- false = quarentena (denúncia/DMCA)
  created_at timestamptz not null default now()
);

-- Submissões da comunidade (fila de moderação). Texto puro (Markdown).
create table public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.submission_kind not null,
  title text not null check (char_length(title) between 3 and 200),
  body_md text not null check (char_length(body_md) <= 100000),
  status public.submission_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Progresso do aluno
create table public.user_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_slug text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

-- Denúncias (DMCA / Marco Civil)
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  reason text not null check (char_length(reason) <= 5000),
  contact_email text,
  created_at timestamptz not null default now()
);

-- Helper: papel do usuário atual
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- Cria perfil automaticamente no primeiro login
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.content_submissions enable row level security;
alter table public.user_progress enable row level security;
alter table public.reports enable row level security;

-- profiles: cada um lê/edita o próprio (sem poder mudar o próprio papel)
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- books: público lê só itens ativos; staff gerencia
create policy "books_public_read" on public.books for select using (is_active or public.is_staff());
create policy "books_staff_write" on public.books for all using (public.is_staff()) with check (public.is_staff());

-- submissões: autor cria (sempre pending) e vê as suas; staff vê tudo e só altera status
create policy "subs_insert_own" on public.content_submissions for insert
  with check (author_id = auth.uid() and status = 'pending');
create policy "subs_select_own_or_staff" on public.content_submissions for select
  using (author_id = auth.uid() or public.is_staff());
create policy "subs_staff_review" on public.content_submissions for update
  using (public.is_staff()) with check (public.is_staff());

-- progresso: só o próprio usuário
create policy "progress_own" on public.user_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- denúncias: qualquer um envia, só staff lê
create policy "reports_insert_any" on public.reports for insert with check (true);
create policy "reports_staff_read" on public.reports for select using (public.is_staff());

-- Storage: se houver bucket de capas, aceite só imagens pequenas (configure no painel):
--   allowed_mime_types = {image/png, image/jpeg, image/webp}, file_size_limit = 512 KB
