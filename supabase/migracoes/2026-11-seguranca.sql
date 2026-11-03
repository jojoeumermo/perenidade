-- ───────────────────────────── Segurança, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
-- Ordem em produção e comandos: docs/plano-2026-11/notas/seguranca-producao.md.
--
-- 1. equipe_sessao: as rotas /api/fontes e /api/radios (e o limite de /api/gramatica) perguntam ao banco se quem pede é
--    da equipe, sem gravar nada (a função "eu" grava no perfil a origem de quem chama, que ali seria o servidor).
-- 2. contar só aceita alvos que existem: lista de matérias e aulas mantida pela publicação (scripts/alvos-de-contagem.mjs).
-- 3. emails_disparar manda também o segredo próprio da função enviar-emails (x-lucia-segredo), quando houver.
-- 4. transcricao_pedir: porta da transcrição automática, com freio por pessoa.
--
-- Dado de pessoa: nada novo. O freio da transcrição usa a tabela de limites que já existe (total por conta e janela,
-- apagado em dois dias); a lista de alvos é só de endereços de conteúdo público.

-- 1. Quem pede é da equipe? ─────────────────────────────────────────────────────────────────────────────────────────────
/** Para as rotas do servidor: a sessão é de uma conta ativa? Tem função no painel? Só lê; nunca levanta erro. */
create or replace function public.equipe_sessao() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'conta', v.ok,
    'equipe', v.ok and interno.da_equipe(v.id))
  from (select auth.uid() as id,
               auth.uid() is not null and not exists (select 1 from perfis where id = auth.uid() and suspenso) as ok) v
$$;
revoke all on function public.equipe_sessao() from public;
grant execute on function public.equipe_sessao() to anon, authenticated, service_role;

-- 2. Contagens só de alvos que existem ───────────────────────────────────────────────────────────────────────────────────
-- Antes, qualquer alvo com o formato certo virava linha nova (até 120 por minuto por origem). Agora a publicação mantém a
-- lista de matérias do jornal e de aulas ("trilha/aula") e contar ignora o resto. Enquanto a lista de um grupo estiver
-- vazia (antes da primeira publicação com o script), tudo conta como antes: nada para de contar no dia da troca.
create table if not exists interno.contagens_alvos (
  grupo text not null check (grupo in ('jornal', 'aula')),
  alvo text not null check (alvo ~ '^[a-z0-9/_-]{1,160}$'),
  primary key (grupo, alvo)
);
alter table interno.contagens_alvos enable row level security;
revoke all on interno.contagens_alvos from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.contagens_alvos from anon, authenticated; end if;
end $$;

/** Troca a lista inteira de um grupo. Só o serviço (a rotina de publicação, com a chave de serviço). */
create or replace function public.contagens_alvos_definir(p_grupo text, p_alvos text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if p_grupo is null or p_grupo not in ('jornal', 'aula') then perform interno.erro('invalido:grupo'); end if;
  if coalesce(array_length(p_alvos, 1), 0) > 50000 then perform interno.erro('invalido:alvos'); end if;
  delete from contagens_alvos where grupo = p_grupo;
  insert into contagens_alvos (grupo, alvo)
  select p_grupo, a from unnest(coalesce(p_alvos, '{}')) a where a ~ '^[a-z0-9/_-]{1,160}$'
  on conflict do nothing;
  return jsonb_build_object('ok', true, 'total', (select count(*) from contagens_alvos where grupo = p_grupo));
end $$;
revoke all on function public.contagens_alvos_definir(text, text[]) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.contagens_alvos_definir(text, text[]) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function public.contagens_alvos_definir(text, text[]) to service_role; end if;
end $$;

/** Soma um à contagem do dia. Responde sempre vazio: quem chama não fica sabendo de nada. */
create or replace function public.contar(p_tipo text, p_alvo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_grupo text := case when p_tipo = 'jornal_leu' then 'jornal' when p_tipo like 'aula\_%' then 'aula' end;
begin
  if p_tipo not in ('jornal_leu', 'aula_abriu', 'aula_terminou', 'aula_teste', 'aula_acertou', 'aula_ajudou', 'aula_nao_ajudou', 'episodio_ouviu') then return '{}'::jsonb; end if;
  if coalesce(p_alvo, '') !~ '^[a-z0-9/_-]{1,160}$' then return '{}'::jsonb; end if;
  -- O alvo precisa existir. Grupo ainda sem lista: aceita como antes.
  if v_grupo is not null
     and exists (select 1 from contagens_alvos where grupo = v_grupo)
     and not exists (select 1 from contagens_alvos where grupo = v_grupo and alvo = p_alvo) then
    return '{}'::jsonb;
  end if;
  if p_tipo = 'episodio_ouviu' and not exists (select 1 from podcast_episodios where slug = p_alvo and status = 'publicado') then return '{}'::jsonb; end if;
  begin
    perform interno.limite('contar:' || p_tipo || ':' || p_alvo, 3, 60);
    perform interno.limite('contar', 120, 60);
  exception when others then
    return '{}'::jsonb;
  end;
  insert into contagens (tipo, alvo, total) values (p_tipo, p_alvo, 1)
  on conflict (tipo, alvo, dia) do update set total = contagens.total + 1;
  return '{}'::jsonb;
end $$;
revoke all on function public.contar(text, text) from public;
grant execute on function public.contar(text, text) to anon, authenticated, service_role;

-- Limpeza das contagens de alvos inventados que já entraram. Rodar à mão, só depois de a primeira publicação preencher a
-- lista e de conferir os totais (select grupo, count(*) from interno.contagens_alvos group by 1):
--   delete from interno.contagens c where c.tipo like 'aula\_%' and exists (select 1 from interno.contagens_alvos where grupo = 'aula')
--     and not exists (select 1 from interno.contagens_alvos a where a.grupo = 'aula' and a.alvo = c.alvo);
--   delete from interno.contagens c where c.tipo = 'jornal_leu' and exists (select 1 from interno.contagens_alvos where grupo = 'jornal')
--     and not exists (select 1 from interno.contagens_alvos a where a.grupo = 'jornal' and a.alvo = c.alvo);
--   delete from interno.contagens c where c.tipo = 'episodio_ouviu'
--     and not exists (select 1 from interno.podcast_episodios e where e.slug = c.alvo);

-- 3. E-mails: o banco manda o segredo próprio da função ───────────────────────────────────────────────────────────────────
-- O segredo fica em interno.configuracoes ('email'.'segredo'), que ninguém de fora lê; a função enviar-emails confere o
-- cabeçalho x-lucia-segredo quando o segredo EMAILS_SEGREDO estiver definido nela. Sem o valor no banco, o cabeçalho vai
-- vazio, e a função sem o segredo definido aceita como antes.
--   update interno.configuracoes set valor = valor || '{"segredo": "<o mesmo valor de EMAILS_SEGREDO>"}'::jsonb where chave = 'email';
create or replace function interno.emails_disparar() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_url text := (select valor ->> 'funcao' from configuracoes where chave = 'email');
  v_chave text := coalesce((select valor ->> 'chave_publica' from configuracoes where chave = 'email'), '');
  v_segredo text := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'email'), '');
begin
  if coalesce(v_url, '') !~ '^https://[a-z0-9.-]+/functions/v1/enviar-emails$' then return; end if;
  if not exists (select 1 from emails where status = 'pendente' or (status = 'enviando' and tentado_em < now() - interval '15 minutes')) then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave, 'apikey', v_chave, 'x-lucia-segredo', v_segredo);
end $$;
revoke all on function interno.emails_disparar() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.emails_disparar() from anon, authenticated; end if;
end $$;

-- 4. Transcrição automática com freio por pessoa ─────────────────────────────────────────────────────────────────────────
/**
 * Porta da transcrição automática (função transcrever-audio): só quem tem função no painel, até 10 por hora e 30 por dia
 * por pessoa (ajuste aqui conforme a cota da chave de Whisper). Devolve true ou erro (entre_primeiro, conta_suspensa,
 * sem_permissao, muitos_pedidos). Usa a tabela de limites de sempre: só o total por conta e janela, apagado em dois dias.
 */
create or replace function public.transcricao_pedir() returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.da_equipe(auth.uid()) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('transcrever_hora', 10, 60);
  perform interno.limite('transcrever_dia', 30, 1440);
  return true;
end $$;
revoke all on function public.transcricao_pedir() from public;
grant execute on function public.transcricao_pedir() to anon, authenticated, service_role;
