-- Perenidade: camada opcional de contas (Supabase / PostgreSQL).
--
-- ESTADO: rascunho. Ainda não foi aplicado nem testado em um projeto Supabase,
-- e o site não depende dele. Hoje o acervo vive em content/ (Git), a moderação
-- acontece por Pull Request e o progresso fica no navegador.
--
-- Este esquema serve para quando existir login:
--   1. sincronizar o progresso entre aparelhos;
--   2. aceitar contribuições e denúncias de quem não tem conta no GitHub.
--
-- Princípios: nenhum dado pessoal além do mínimo, nenhum arquivo hospedado,
-- moderação por mudança de status, RLS em todas as tabelas.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('user', 'moderator', 'admin');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.submission_kind as enum ('lesson', 'book_link');

-- Perfis: espelho mínimo de auth.users. Login só por OAuth, sem senhas.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now()
);

-- Fila de contribuições. Texto puro (Markdown). Aprovar aqui não publica nada:
-- um moderador leva o texto aprovado para o repositório, onde ele ganha histórico.
create table public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.submission_kind not null,
  title text not null check (char_length(title) between 3 and 200),
  body_md text not null check (char_length(body_md) between 1 and 100000),
  status public.submission_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Progresso do aluno. lesson_id segue o formato "trilha/aula" usado no site.
create table public.user_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 200),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Denúncias de quem não usa o GitHub.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target text not null check (char_length(target) <= 500),
  reason text not null check (char_length(reason) between 20 and 5000),
  created_at timestamptz not null default now()
);

-- security definer: consulta profiles sem passar pela RLS da própria tabela,
-- o que evita recursão infinita nas políticas abaixo.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

-- Cria o perfil no primeiro login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(new.raw_user_meta_data ->> 'full_name', 80),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.content_submissions enable row level security;
alter table public.user_progress enable row level security;
alter table public.reports enable row level security;

-- Privilégios por coluna. A RLS decide QUAIS linhas; estes grants decidem QUAIS colunas.
-- Sem isto, um usuário poderia trocar o próprio papel para 'admin', e um moderador
-- poderia reescrever o texto de uma contribuição em vez de só aprovar ou recusar.
revoke all on public.profiles, public.content_submissions, public.user_progress, public.reports
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

grant select on public.content_submissions to authenticated;
grant insert (author_id, kind, title, body_md) on public.content_submissions to authenticated;
grant update (status, reviewed_by, reviewed_at) on public.content_submissions to authenticated;

grant select, insert, delete on public.user_progress to authenticated;

grant insert (target, reason) on public.reports to anon, authenticated;
grant select on public.reports to authenticated;

-- profiles: cada um vê e edita o próprio; a moderação vê todos. O papel só muda pelo painel do Supabase.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- contribuições: o autor cria (o status começa em 'pending' pelo default) e vê as suas;
-- a moderação vê todas e só consegue alterar as colunas de revisão.
create policy "submissions_insert_own" on public.content_submissions
  for insert to authenticated
  with check (author_id = auth.uid());

create policy "submissions_select" on public.content_submissions
  for select to authenticated
  using (author_id = auth.uid() or public.is_staff());

create policy "submissions_review" on public.content_submissions
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff() and reviewed_by = auth.uid());

-- progresso: só o próprio usuário.
create policy "progress_own" on public.user_progress
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- denúncias: qualquer pessoa envia; só a moderação lê.
create policy "reports_insert" on public.reports
  for insert to anon, authenticated
  with check (true);

create policy "reports_select_staff" on public.reports
  for select to authenticated
  using (public.is_staff());
