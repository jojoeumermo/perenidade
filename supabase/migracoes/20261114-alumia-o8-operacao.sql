-- ───────────────────────────── Alumia: operação (espaço de mídia, silêncio dos avisos, saúde), novembro de 2026 ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 8E da Onda 8 (operação). O que entra:
--
--   1. Espaço de mídia com cota por pessoa. Os dois depósitos da Alumia (rede-midia: imagens e áudios dos posts; rede-stories:
--      imagens e vídeos dos stories) guardam cada arquivo na pasta "<pessoa>/". A soma do que está na pasta da pessoa, nos dois,
--      não passa da cota (interno.configuracoes, chave 'midia_cota', {"bytes": ...}; sem a linha, 500 MB). Quem chegou na cota
--      não sobe arquivo novo até apagar algum: uma regra RESTRITIVA no depósito (só acrescenta, não mexe nas regras de antes).
--      A pessoa vê o próprio uso (public.rede_midia_meu_uso); ninguém vê o de outra pessoa.
--   2. Faxina da mídia órfã: arquivo de rede-midia sem post nem áudio que o use, com mais de 24 horas (o envio que não virou post,
--      o post apagado de vez, a conta apagada). O pg_cron chama todo dia a função faxina-midia (supabase/functions/faxina-midia),
--      que apaga pela API do depósito (apagar direto na tabela deixaria o arquivo para trás) e devolve o resultado aqui. Os
--      stories já têm a faxina deles (faxina-stories).
--   3. O número no painel: public.alumia_painel_espaco (coordenação e admin): o total de cada depósito, a cota, a última faxina e
--      quantas pessoas estão perto da cota (só a partir de 3; nunca quem).
--   4. Horário de silêncio dos avisos no celular: a pessoa escolhe uma janela (ex.: 22h às 7h). Nela, o push não sai; os avisos
--      se juntam e saem num aviso só quando a janela acaba. A janela é guardada em minutos do dia no horário universal, calculada
--      no aparelho: o banco não guarda fuso horário nem cidade.
--   5. A saúde da operação para o monitor (public.operacao_saude): a versão do banco e se as filas andam (e-mails, posts
--      agendados, faxina). Só sim ou não: nenhum número de pessoas, nenhum dado de ninguém.
--
-- Endereço de rede: nada daqui lê ou guarda (decisão de 13/11). Tabelas em interno, RLS ligada e sem política, nenhuma
-- permissão direta. Pode rodar mais de uma vez, sem apagar dado nenhum. Roda depois das migrações da Onda 7.
-- Teste: scripts/operacao/testar-operacao.mjs.

-- 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Uma linha por rotina da operação (hoje só a faxina de mídia): quando rodou e o que fez, em números.
create table if not exists interno.alumia_operacao (
  rotina text primary key check (rotina ~ '^[a-z_]{3,40}$'),
  rodou_em timestamptz not null default now(),
  detalhes jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhes) = 'object')
);
alter table interno.alumia_operacao enable row level security;

-- O horário de silêncio de cada pessoa, em minutos do dia (0 a 1439) no horário universal. Início maior que o fim atravessa a
-- meia-noite (ex.: 1 h às 10 h UTC = 22 h às 7 h em Brasília).
create table if not exists interno.rede_avisos_silencio (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  inicio smallint not null check (inicio between 0 and 1439),
  fim smallint not null check (fim between 0 and 1439),
  check (inicio <> fim)
);
alter table interno.rede_avisos_silencio enable row level security;

-- A cota padrão (o plano de armazenamento é decisão da coordenação: mude o valor aqui, sem migração nova).
insert into interno.configuracoes (chave, valor) values ('midia_cota', '{"bytes": 524288000}'::jsonb) on conflict (chave) do nothing;

-- 2. Espaço de mídia ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A cota de cada pessoa, em bytes (entre 10 MB e 50 GB; valor estranho cai nos 500 MB). */
create or replace function interno.alumia_midia_cota() returns bigint language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select case when (valor ->> 'bytes') ~ '^[0-9]{1,12}$' and (valor ->> 'bytes')::bigint between 10485760 and 53687091200
                               then (valor ->> 'bytes')::bigint end
                   from configuracoes where chave = 'midia_cota'), 524288000)
$$;

/** Quanto a pasta de uma pessoa ocupa nos dois depósitos da Alumia, em bytes. Sem depósito (teste local): zero. */
create or replace function interno.alumia_midia_uso(p_usuario uuid) returns bigint language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v bigint := 0;
begin
  if p_usuario is null or to_regclass('storage.objects') is null then return 0; end if;
  execute 'select coalesce(sum(case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end), 0)::bigint
             from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'') and name like $1'
    into v using p_usuario::text || '/%';
  return coalesce(v, 0);
end $$;

/**
 * Regra do depósito: a pessoa ainda cabe na cota? Usada pela regra restritiva de envio (abaixo). Passa pela entrada da Alumia
 * (interno.alumia_passa) como as outras regras de envio, e responde "não" em vez de erro, para o depósito recusar limpo.
 */
create or replace function public.rede_midia_cabe() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and auth.uid() is not null and interno.alumia_midia_uso(auth.uid()) < interno.alumia_midia_cota()
$$;

/** O espaço que a própria pessoa usa: só dela, nunca de outra. */
create or replace function public.rede_midia_meu_uso() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_uso bigint; v_cota bigint := interno.alumia_midia_cota();
begin
  v_uso := interno.alumia_midia_uso(v);
  return jsonb_build_object('usado', v_uso, 'cota', v_cota, 'cheio', v_uso >= v_cota);
end $$;

-- 3. Faxina da mídia órfã ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Para a função faxina-midia (só a chave de serviço): os arquivos de rede-midia que nenhum post nem áudio usa, com mais de 24
 * horas. Devolve só os caminhos ("<pessoa>/<id>.<ext>"), que a função apaga pela API do depósito.
 */
create or replace function public.rede_midia_faxina_lista(p_limite integer default 200) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lim integer := greatest(1, least(coalesce(p_limite, 200), 1000)); v jsonb := '[]'::jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if to_regclass('storage.objects') is null then return v; end if;
  execute 'select coalesce(jsonb_agg(o.name), ''[]''::jsonb) from (
             select name from storage.objects o
              where o.bucket_id = ''rede-midia'' and o.created_at < now() - interval ''24 hours''
                and not exists (select 1 from interno.rede_midia m where m.caminho = o.name)
                and not exists (select 1 from interno.rede_audios a where a.caminho = o.name)
              order by o.created_at limit $1) o'
    into v using v_lim;
  return v;
end $$;

/** Para a função faxina-midia: o que ela apagou (quantos arquivos e quantos bytes). Fica para o painel e para o monitor. */
create or replace function public.rede_midia_faxina_feito(p_apagados integer, p_bytes bigint default 0, p_falhas integer default 0) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare d jsonb := jsonb_build_object('apagados', greatest(coalesce(p_apagados, 0), 0), 'bytes', greatest(coalesce(p_bytes, 0), 0), 'falhas', greatest(coalesce(p_falhas, 0), 0));
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  insert into alumia_operacao (rotina, rodou_em, detalhes) values ('faxina_midia', now(), d)
  on conflict (rotina) do update set rodou_em = excluded.rodou_em, detalhes = excluded.detalhes;
  return d;
end $$;

/**
 * Chama a função faxina-midia (pg_net), como interno.rede3_push_disparar faz com o push. Só chama se a configuração existe:
 * interno.configuracoes, chave 'faxina_midia' = {"funcao": "https://<projeto>.supabase.co/functions/v1/faxina-midia",
 * "chave_publica": "<anon>", "segredo": "<o mesmo de FAXINA_SEGREDO>"}. Sem ela, não faz nada.
 */
create or replace function interno.alumia_midia_faxina_disparar() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_url text := (select valor ->> 'funcao' from configuracoes where chave = 'faxina_midia');
  v_chave text := coalesce((select valor ->> 'chave_publica' from configuracoes where chave = 'faxina_midia'), '');
  v_segredo text := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'faxina_midia'), '');
begin
  if coalesce(v_url, '') !~ '^https://[a-z0-9.-]+/functions/v1/faxina-midia$' then return; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_chave, 'apikey', v_chave, 'x-lucia-segredo', v_segredo);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    -- Todo dia às 4h30 de Brasília (7h30 UTC), longe do horário de mais uso.
    perform cron.schedule('lucia-alumia-faxina-midia', '30 7 * * *', 'select interno.alumia_midia_faxina_disparar()');
  end if;
end $$;

-- 4. O número no painel ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O espaço de mídia da Alumia, para o painel de controle (coordenação e admin). Só totais: nenhum nome, nenhuma lista. "Perto
 * da cota" (80% ou mais) só aparece a partir de 3 pessoas; abaixo disso vem nulo.
 */
create or replace function public.alumia_painel_espaco() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v_cota bigint := interno.alumia_midia_cota();
  v_depositos jsonb := '{}'::jsonb;
  v_perto integer := 0;
  v_orfaos integer := 0;
  f alumia_operacao;
begin
  perform interno.alumia_painel_exige();
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(jsonb_object_agg(b, jsonb_build_object(''bytes'', bytes, ''arquivos'', arquivos)), ''{}''::jsonb) from (
               select bucket_id as b, coalesce(sum(case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end), 0)::bigint as bytes,
                      count(*)::integer as arquivos
                 from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'') group by bucket_id) x'
      into v_depositos;
    execute 'select count(*)::integer from (
               select split_part(name, ''/'', 1) as dono, sum(case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end) as bytes
                 from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'') group by 1) x where x.bytes >= $1'
      into v_perto using (v_cota * 8) / 10;
    execute 'select count(*)::integer from storage.objects o
              where o.bucket_id = ''rede-midia'' and o.created_at < now() - interval ''24 hours''
                and not exists (select 1 from interno.rede_midia m where m.caminho = o.name)
                and not exists (select 1 from interno.rede_audios a where a.caminho = o.name)'
      into v_orfaos;
  end if;
  select * into f from alumia_operacao where rotina = 'faxina_midia';
  return jsonb_build_object(
    'cota', v_cota,
    'depositos', jsonb_build_object(
      'rede-midia', coalesce(v_depositos -> 'rede-midia', '{"bytes": 0, "arquivos": 0}'::jsonb),
      'rede-stories', coalesce(v_depositos -> 'rede-stories', '{"bytes": 0, "arquivos": 0}'::jsonb)),
    'perto_da_cota', case when v_perto >= 3 then v_perto end,
    'orfaos', v_orfaos,
    'faxina', case when f.rotina is null then null else jsonb_build_object('quando', f.rodou_em, 'detalhes', f.detalhes) end,
    'faxina_ligada', exists (select 1 from configuracoes where chave = 'faxina_midia'),
    'deposito', to_regclass('storage.objects') is not null);
end $$;

-- 5. Horário de silêncio dos avisos ─────────────────────────────────────────────────────────────────────────────────────────

/** A pessoa está no horário de silêncio neste momento? (Minutos do dia no horário universal.) */
create or replace function interno.alumia_em_silencio(p_usuario uuid, p_quando timestamptz default now()) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((
    select case when s.inicio < s.fim then m >= s.inicio and m < s.fim else m >= s.inicio or m < s.fim end
      from rede_avisos_silencio s,
           lateral (select (extract(hour from p_quando at time zone 'UTC') * 60 + extract(minute from p_quando at time zone 'UTC'))::integer as m) agora
     where s.usuario = p_usuario), false)
$$;

/** O horário de silêncio da própria pessoa: {inicio, fim} em minutos UTC, ou nulo. */
create or replace function public.rede_aviso_silencio_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); s rede_avisos_silencio;
begin
  select * into s from rede_avisos_silencio where usuario = v;
  if not found then return null; end if;
  return jsonb_build_object('inicio', s.inicio, 'fim', s.fim);
end $$;

/** Guarda (ou tira, com os dois nulos) o horário de silêncio. Os minutos vêm do aparelho, já no horário universal. */
create or replace function public.rede_aviso_silencio_salvar(p_inicio integer, p_fim integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.limite('rede_aviso_silencio', 30, 60);
  if p_inicio is null and p_fim is null then
    delete from rede_avisos_silencio where usuario = v;
    return null;
  end if;
  if p_inicio is null or p_fim is null or p_inicio not between 0 and 1439 or p_fim not between 0 and 1439 or p_inicio = p_fim then
    perform interno.erro('invalido:horario');
  end if;
  insert into rede_avisos_silencio (usuario, inicio, fim) values (v, p_inicio, p_fim)
  on conflict (usuario) do update set inicio = excluded.inicio, fim = excluded.fim;
  return jsonb_build_object('inicio', p_inicio, 'fim', p_fim);
end $$;

/**
 * Para a função enviar-push (só a chave de serviço): a mesma de 2026-11-rede-avisos.sql, mais o horário de silêncio. Quem está
 * no silêncio fica de fora desta rodada SEM marcar os avisos como empurrados: quando a janela acaba, tudo o que juntou sai num
 * aviso só (o número de grupos não lidos). O conteúdo continua o mesmo molde: o número e o idioma, nunca texto nem nome.
 */
create or replace function public.rede_aviso_push_pendentes(p_limite integer default 50) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; s record; v_n integer; v_out jsonb := '[]'::jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if not pg_try_advisory_xact_lock(hashtext('rede_push')) then return v_out; end if;
  for r in select distinct a.usuario from rede_push_assinaturas a
           where not exists (select 1 from rede_push_assinaturas t where t.usuario = a.usuario and t.ultimo_envio > now() - interval '10 minutes')
             and not interno.alumia_em_silencio(a.usuario)
             and exists (select 1 from avisos x where x.para = a.usuario and x.categoria = 'rede' and x.tipo is not null and not x.lido and not x.empurrado
                         and x.criado_em > a.criado_em and interno.rede3_aviso_pref(x.para, x.tipo, 'push'))
           limit greatest(1, least(coalesce(p_limite, 50), 200)) loop
    update avisos set empurrado = true
     where para = r.usuario and categoria = 'rede' and tipo is not null and not lido and not empurrado and interno.rede3_aviso_pref(para, tipo, 'push');
    if not exists (select 1 from perfis f where f.id = r.usuario and not f.suspenso) or not interno.rede2_membro(r.usuario) then continue; end if;
    select count(*)::integer into v_n from interno.rede3_aviso_grupos(r.usuario) g where not g.lido;
    if v_n = 0 then continue; end if;
    for s in select * from rede_push_assinaturas where usuario = r.usuario loop
      v_out := v_out || jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'lang', s.lang, 'n', least(v_n, 99));
    end loop;
    update rede_push_assinaturas set ultimo_envio = now() where usuario = r.usuario;
  end loop;
  return v_out;
end $$;

-- 6. A saúde da operação, para o monitor ────────────────────────────────────────────────────────────────────────────────────

/**
 * Para o monitor (app/api/saude e .github/workflows/monitor.yml): a versão do banco da Alumia e se as filas andam. Só sim ou
 * não (e a versão, que já é pública): nenhum número de pessoas, nenhum conteúdo. Fora do prefixo rede_/alumia_ de propósito:
 * responde a qualquer um, com a entrada da Alumia trancada ou não, porque não diz nada de ninguém.
 *   emails_em_dia      nenhum e-mail esperando há mais de 1 hora
 *   agendados_em_dia   nenhum post agendado vencido há mais de 15 minutos sem sair
 *   faxina_em_dia      a faxina de mídia rodou nos últimos 3 dias (nulo quando ela não foi ligada)
 *   agendador          o pg_cron está no banco
 */
create or replace function public.operacao_saude() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_faxina alumia_operacao;
begin
  select * into v_faxina from alumia_operacao where rotina = 'faxina_midia';
  return jsonb_build_object(
    'versao', public.rede_alumia_versao(),
    'emails_em_dia', not exists (select 1 from emails where status = 'pendente' and criado_em < now() - interval '1 hour'),
    'agendados_em_dia', not exists (select 1 from rede_agendados where estado = 'pendente' and quando < now() - interval '15 minutes'),
    'faxina_em_dia', case when not exists (select 1 from configuracoes where chave = 'faxina_midia') then null
                          else coalesce(v_faxina.rodou_em > now() - interval '3 days', false) end,
    'agendador', exists (select 1 from pg_extension where extname = 'pg_cron'));
end $$;

-- 7. A regra restritiva do depósito ─────────────────────────────────────────────────────────────────────────────────────────
-- Restritiva: vale JUNTO com as regras de envio de antes (rede_midia_envio, rede_stories_envio), que continuam como estavam. Só
-- olha os dois depósitos da Alumia; os outros depósitos do site passam direto.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "alumia_midia_cota" on storage.objects';
    execute 'create policy "alumia_midia_cota" on storage.objects as restrictive for insert to authenticated with check (bucket_id not in (''rede-midia'', ''rede-stories'') or public.rede_midia_cabe())';
  end if;
end $$;

-- 8. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on table interno.alumia_operacao, interno.rede_avisos_silencio from public;
revoke all on function interno.alumia_midia_cota(), interno.alumia_midia_uso(uuid), interno.alumia_midia_faxina_disparar(),
  interno.alumia_em_silencio(uuid, timestamptz) from public;
revoke all on function public.rede_midia_cabe(), public.rede_midia_meu_uso(), public.rede_midia_faxina_lista(integer),
  public.rede_midia_faxina_feito(integer, bigint, integer), public.alumia_painel_espaco(), public.rede_aviso_silencio_ver(),
  public.rede_aviso_silencio_salvar(integer, integer), public.rede_aviso_push_pendentes(integer), public.operacao_saude() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_operacao, interno.rede_avisos_silencio from anon, authenticated;
    revoke all on function interno.alumia_midia_cota(), interno.alumia_midia_uso(uuid), interno.alumia_midia_faxina_disparar(),
      interno.alumia_em_silencio(uuid, timestamptz) from anon, authenticated;
    revoke all on function public.rede_midia_cabe(), public.rede_midia_meu_uso(), public.rede_midia_faxina_lista(integer),
      public.rede_midia_faxina_feito(integer, bigint, integer), public.alumia_painel_espaco(), public.rede_aviso_silencio_ver(),
      public.rede_aviso_silencio_salvar(integer, integer), public.rede_aviso_push_pendentes(integer), public.operacao_saude() from anon, authenticated;
    grant execute on function public.rede_midia_cabe(), public.rede_midia_meu_uso(), public.alumia_painel_espaco(), public.rede_aviso_silencio_ver(),
      public.rede_aviso_silencio_salvar(integer, integer) to authenticated, service_role;
    grant execute on function public.rede_midia_faxina_lista(integer), public.rede_midia_faxina_feito(integer, bigint, integer),
      public.rede_aviso_push_pendentes(integer) to service_role;
    grant execute on function public.operacao_saude() to anon, authenticated, service_role;
  end if;
end $$;

-- 9. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- As funções novas de membro (rede_midia_meu_uso, rede_aviso_silencio_*, alumia_painel_espaco) ganham a porta da entrada.
select interno.alumia_trancar();
