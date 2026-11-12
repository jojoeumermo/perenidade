-- ───────────────────────────── Alumia no Fediverso: as imagens de fora guardadas na chegada (P12) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261110-fediverso-privacidade.sql.
-- O mesmo bloco está no fim do install.sql. Documento: docs/rede/FEDIVERSO.md ("As imagens de fora"). Teste:
-- scripts/testar-fediverso-banco.mjs (seção "Imagens guardadas") e scripts/testar-fediverso-entrada.mjs.
--
-- O problema: a rota-proxy (app/api/fediverso/midia) esconde QUEM vê uma imagem de fora, mas não QUANDO. Ela só ia buscar a
-- imagem na origem no momento em que o primeiro leitor a pedia. Um servidor mal-intencionado que mandasse uma nota a uma pessoa
-- só, com um endereço de imagem único, ficava sabendo a hora em que ela abriu o aviso ou o fio.
--
-- O conserto: quando uma nota com imagem chega (ou o avatar de alguém de fora é guardado), cada imagem entra numa fila, com uma
-- hora sorteada entre 1 e 15 minutos depois. O site, na rodada do timer da VPS (lucia-fediverso.timer, que chama
-- /api/fediverso/entregar), busca as que venceram e grava no DISCO DA VPS (não no Storage do Supabase: o plano gratuito tem 1 GB).
-- A rota-proxy serve a cópia guardada. Enquanto a imagem está na fila, a rota NÃO a busca lá fora (responderia 404 por alguns
-- minutos): a hora em que a origem é tocada não depende de ninguém abrir nada.
--
-- No banco fica só o endereço, um resumo dele (a chave do arquivo), de onde veio (a nota ou o avatar) e o estado. Os bytes
-- ficam na VPS. Uma imagem de nota que venceu, de avatar trocado ou de instância bloqueada sai na faxina
-- (rede_fed_midia_servidor, ação "faxina"), e o site apaga o arquivo. Há um teto de espaço (padrão 20 GB): passado dele, nada
-- novo é buscado (as imagens continuam pela rota-proxy, como antes).
--
-- Sem a pasta configurada no site (ALUMIA_FEDIVERSO_MIDIA_DIR), nada disto é usado: a fila enche e a faxina a esvazia junto com
-- as notas; a rota-proxy faz como antes.

-- 1. A fila e o registro das imagens ─────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_fed_midia (
  chave text primary key check (chave ~ '^[0-9a-f]{64}$'),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  nota text check (nota is null or char_length(nota) <= 500),
  ator text check (ator is null or char_length(ator) <= 500),
  buscar_apos timestamptz not null,
  guardada_em timestamptz,
  bytes integer check (bytes is null or bytes between 1 and 8388608),
  falhas smallint not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists rede_fed_midia_pendentes on interno.rede_fed_midia (buscar_apos) where guardada_em is null;
alter table interno.rede_fed_midia enable row level security;
revoke all on interno.rede_fed_midia from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_fed_midia from anon, authenticated;
  end if;
end $$;

/** A chave do arquivo: o SHA-256 do endereço, em hexadecimal (o site calcula a mesma em lib/rede/fediverso/midia-guardada.ts). */
create or replace function interno.rede_fed_midia_chave(p_url text) returns text language sql immutable as $$
  select encode(sha256(convert_to(p_url, 'UTF8')), 'hex')
$$;

/** Põe uma imagem na fila, com a hora sorteada (1 a 15 minutos). Endereço que já está na fila só ganha a origem nova. */
create or replace function interno.rede_fed_midia_enfileirar(p_url text, p_nota text, p_ator text) returns void
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  if p_url is null or p_url !~ '^https://[^\s]+$' or char_length(p_url) > 500 or interno.rede_fed_bloqueado(p_url) then return; end if;
  insert into rede_fed_midia (chave, url, nota, ator, buscar_apos)
  values (interno.rede_fed_midia_chave(p_url), p_url, p_nota, p_ator, now() + make_interval(secs => 60 + floor(random() * 840)::integer))
  on conflict (chave) do update set nota = coalesce(excluded.nota, rede_fed_midia.nota), ator = coalesce(excluded.ator, rede_fed_midia.ator);
end $$;

/** Gatilho: a nota de fora chegou (ou mudou) com imagens. Só imagem: vídeo e áudio a rota-proxy não serve. Até 4, como a tela. */
create or replace function interno.rede_fed_midia_da_nota() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare m jsonb;
begin
  if tg_op = 'UPDATE' and new.midia is not distinct from old.midia then return null; end if;
  for m in select x from jsonb_array_elements(case when jsonb_typeof(new.midia) = 'array' then new.midia else '[]'::jsonb end) x limit 4 loop
    if coalesce(m ->> 'tipo', 'image') !~* '^(video|audio)' then
      perform interno.rede_fed_midia_enfileirar(m ->> 'url', new.id, null);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists rede_fed_midia_da_nota on interno.rede_fed_recebidos;
create trigger rede_fed_midia_da_nota after insert or update of midia on interno.rede_fed_recebidos
  for each row execute function interno.rede_fed_midia_da_nota();

/** Gatilho: o avatar de alguém de fora foi guardado (ou trocado). */
create or replace function interno.rede_fed_midia_do_ator() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.avatar is not distinct from old.avatar then return null; end if;
  if new.avatar is not null then perform interno.rede_fed_midia_enfileirar(new.avatar, null, new.ator); end if;
  return null;
end $$;
drop trigger if exists rede_fed_midia_do_ator on interno.rede_fed_remotos;
create trigger rede_fed_midia_do_ator after insert or update of avatar on interno.rede_fed_remotos
  for each row execute function interno.rede_fed_midia_do_ator();

-- As notas e os avatares que já estavam guardados antes desta migração entram na fila também (pode rodar de novo: o que já
-- está na fila não muda de hora).
do $$
declare c record; m jsonb;
begin
  for c in select id, midia from interno.rede_fed_recebidos where jsonb_typeof(midia) = 'array' and jsonb_array_length(midia) > 0 loop
    for m in select x from jsonb_array_elements(c.midia) x limit 4 loop
      if coalesce(m ->> 'tipo', 'image') !~* '^(video|audio)' and not exists (select 1 from interno.rede_fed_midia d where d.chave = interno.rede_fed_midia_chave(m ->> 'url')) then
        perform interno.rede_fed_midia_enfileirar(m ->> 'url', c.id, null);
      end if;
    end loop;
  end loop;
  for c in select ator, avatar from interno.rede_fed_remotos where avatar is not null loop
    if not exists (select 1 from interno.rede_fed_midia d where d.chave = interno.rede_fed_midia_chave(c.avatar)) then
      perform interno.rede_fed_midia_enfileirar(c.avatar, null, c.ator);
    end if;
  end loop;
end $$;

-- 2. O que o servidor do site chama (com o segredo da federação) ───────────────────────────────────────────────────────────

/**
 * Ações (todas pedem o segredo, como public.rede_fed_servidor):
 *   pendentes {limite, teto_bytes}  as imagens cuja hora chegou e que ainda não foram guardadas (até `limite`, no máximo 50).
 *                                   Nada, se o que já está guardado passou de `teto_bytes` (padrão 20 GB).
 *   guardada {chave, ok, bytes}     o site guardou (ok) ou não conseguiu; sem conseguir, tenta de novo mais tarde (até 3 vezes).
 *   estado {chave}                  "guardada", "pendente", "falhou" ou "desconhecida" (a rota-proxy decide se pode buscar fora).
 *   faxina {limite}                 tira do registro as imagens cuja nota venceu, cujo avatar mudou ou cuja instância foi
 *                                   bloqueada, e devolve as chaves das que estavam guardadas (o site apaga os arquivos).
 */
create or replace function public.rede_fed_midia_servidor(p_segredo text, p_acao text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v_chave text := lower(coalesce(p ->> 'chave', ''));
  v_limite integer := least(greatest(coalesce((p ->> 'limite')::integer, 10), 1), 50);
  v_teto bigint := coalesce((p ->> 'teto_bytes')::bigint, 21474836480);
  m rede_fed_midia;
  v_res jsonb;
begin
  perform interno.rede_fed_segredo(p_segredo);
  p := coalesce(p, '{}'::jsonb);
  if p_acao in ('guardada', 'estado') and v_chave !~ '^[0-9a-f]{64}$' then perform interno.erro('invalido:chave'); end if;

  case p_acao
  when 'pendentes' then
    if (select coalesce(sum(bytes), 0) from rede_fed_midia where guardada_em is not null) >= v_teto then return '[]'::jsonb; end if;
    select coalesce(jsonb_agg(jsonb_build_object('chave', x.chave, 'url', x.url) order by x.buscar_apos), '[]'::jsonb) into v_res
    from (select d.chave, d.url, d.buscar_apos from rede_fed_midia d
          where d.guardada_em is null and d.falhas < 3 and d.buscar_apos <= now() and not interno.rede_fed_bloqueado(d.url)
          order by d.buscar_apos limit v_limite) x;
    return v_res;

  when 'guardada' then
    if coalesce((p ->> 'ok')::boolean, false) then
      update rede_fed_midia set guardada_em = now(), bytes = least(greatest(coalesce((p ->> 'bytes')::integer, 1), 1), 8388608)
      where chave = v_chave;
    else
      -- Não deu (fora do ar, não é imagem, grande demais): tenta de novo em 30 min, 1 h; depois da terceira, desiste.
      update rede_fed_midia set falhas = falhas + 1, buscar_apos = now() + make_interval(mins => 30 * (falhas + 1))
      where chave = v_chave and guardada_em is null;
    end if;
    return jsonb_build_object('ok', found);

  when 'estado' then
    select * into m from rede_fed_midia where chave = v_chave;
    if not found then return jsonb_build_object('estado', 'desconhecida'); end if;
    return jsonb_build_object('estado', case when m.guardada_em is not null then 'guardada' when m.falhas >= 3 then 'falhou' else 'pendente' end);

  when 'faxina' then
    with vencidas as (
      select d.chave from rede_fed_midia d
      where interno.rede_fed_bloqueado(d.url)
         or ((d.nota is null or not exists (select 1 from rede_fed_recebidos c where c.id = d.nota))
             and (d.ator is null or not exists (select 1 from rede_fed_remotos r where r.ator = d.ator and r.avatar = d.url)))
      limit v_limite * 20
    ), apagadas as (
      delete from rede_fed_midia d using vencidas v where d.chave = v.chave returning d.chave, d.guardada_em
    )
    select coalesce(jsonb_agg(a.chave) filter (where a.guardada_em is not null), '[]'::jsonb) into v_res from apagadas a;
    return v_res;

  else
    perform interno.erro('invalido:acao');
  end case;
  return null;
end $$;

-- 3. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_fed_midia_chave(text), interno.rede_fed_midia_enfileirar(text, text, text),
  interno.rede_fed_midia_da_nota(), interno.rede_fed_midia_do_ator() from public;
revoke all on function public.rede_fed_midia_servidor(text, text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_fed_midia_chave(text), interno.rede_fed_midia_enfileirar(text, text, text),
      interno.rede_fed_midia_da_nota(), interno.rede_fed_midia_do_ator() from anon, authenticated;
    -- Como public.rede_fed_servidor: o site chama com a chave pública e o segredo (sem o segredo, a função recusa).
    grant execute on function public.rede_fed_midia_servidor(text, text, jsonb) to anon, authenticated, service_role;
  end if;
end $$;
