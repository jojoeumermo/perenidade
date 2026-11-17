-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 11 · fim: marca no banco que as migrações da onda 11 foram instaladas (o texto formatado e o banco de questões, a
-- turma e a agenda, a redação entre pares, a ponte com a Escola e os interesses na linha: as migrações 20261117-alumia-o11-*.sql,
-- na ordem do fim do install.sql), acerta o que a onda 10 deixou para quem junta e põe a porta da entrada em toda função nova.
-- Pode rodar mais de uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  8
-- O site NÃO exige a versão 8 para abrir: com o banco ainda em 7, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela (o painel de controle mostra "esperada 8 · instalada 7").
--
-- O que entra aqui:
--   · o interruptor "alumia-estudo" no catálogo (lib/recursos.ts): as questões, as turmas, a agenda e a redação, só pelo nome;
--   · o que a onda 10 deixou (as fotos do álbum dos atos, depósito "rede-album", que só o servidor grava):
--       - contam na cota de cada pessoa, junto dos posts e dos stories: o espaço é o da pessoa que mandou a foto (a pasta do álbum
--         é a do ato, então a soma vem pelo registro da foto, não pelo nome da pasta). Quem chegou na cota não reserva foto nova
--         (o erro "midia_cheia", antes de o servidor gravar o arquivo);
--       - o painel de controle mostra o total do depósito do álbum e as pessoas perto da cota já com as fotos;
--       - toda foto que sai do registro (apagada pela pessoa, recusada pela moderação, de conta apagada ou de quem saiu só da
--         Alumia, do ato apagado) vai na hora para a fila de arquivos do servidor (interno.alumia_arquivos_a_apagar, a mesma do
--         apagar conta, que a rota app/api/rede/exportar/faxina esvazia pela API do depósito). A faxina dos órfãos de mais de
--         um dia (public.rede_ato_album_orfas) continua como rede de segurança.
-- As funções que as frentes da onda 11 deixaram para a junta conferir: nenhuma das cinco migrações redefine uma função de outra,
-- nem a regra de quem vê, e nenhuma redefine interno.alumia_porta_aberta (a lista de 20261115-alumia-o9-transparencia.sql, com a
-- federação e o diretório, continua valendo). Endereço de rede: nada daqui lê ou guarda (decisão de 13/11).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 8
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. O interruptor do estudo ────────────────────────────────────────────────────────────────────────────────────────────
-- "alumia-estudo" no catálogo dos recursos (lib/recursos.ts): só pelo nome, como os outros da Alumia.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-estudo', true) on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- ── 3. As fotos do álbum na cota, no painel e na fila de arquivos ─────────────────────────────────────────────────────────

/**
 * Quanto uma pessoa ocupa nos depósitos da Alumia, em bytes: a pasta dela em rede-midia e rede-stories e as fotos que ela mandou
 * ao álbum dos atos (rede-album, pela ligação do registro: a pasta do álbum é a do ato). Sem depósito (teste local): zero.
 */
create or replace function interno.alumia_midia_uso(p_usuario uuid) returns bigint language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v bigint := 0; v_album bigint := 0;
begin
  if p_usuario is null or to_regclass('storage.objects') is null then return 0; end if;
  execute 'select coalesce(sum(case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end), 0)::bigint
             from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'') and name like $1'
    into v using p_usuario::text || '/%';
  if to_regclass('interno.rede_ato_album') is not null then
    execute 'select coalesce(sum(case when (o.metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (o.metadata ->> ''size'')::bigint else 0 end), 0)::bigint
               from storage.objects o join interno.rede_ato_album a on a.caminho = o.name
              where o.bucket_id = ''rede-album'' and a.quem = $1'
      into v_album using p_usuario;
  end if;
  return coalesce(v, 0) + coalesce(v_album, 0);
end $$;

/** Antes de reservar o lugar de uma foto no álbum: quem chegou na cota não manda foto nova (o servidor ainda não gravou nada). */
create or replace function interno.rede_ato_album_na_cota() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if interno.alumia_midia_uso(new.quem) >= interno.alumia_midia_cota() then perform interno.erro('midia_cheia'); end if;
  return new;
end $$;

drop trigger if exists rede_ato_album_na_cota on interno.rede_ato_album;
create trigger rede_ato_album_na_cota before insert on interno.rede_ato_album for each row execute function interno.rede_ato_album_na_cota();

-- A fila de arquivos do servidor passa a aceitar o depósito do álbum. A regra é refeita só se ainda não aceita (pode rodar de novo).
do $$
declare r record;
begin
  if to_regclass('interno.alumia_arquivos_a_apagar') is null then return; end if;
  if exists (select 1 from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ 'deposito' and pg_get_constraintdef(oid) ~ 'rede-album') then
    return;
  end if;
  for r in select conname from pg_constraint where conrelid = 'interno.alumia_arquivos_a_apagar'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'deposito' loop
    execute format('alter table interno.alumia_arquivos_a_apagar drop constraint %I', r.conname);
  end loop;
  alter table interno.alumia_arquivos_a_apagar add constraint alumia_arquivos_a_apagar_deposito_check
    check (deposito in ('rede-midia', 'rede-stories', 'rede-album'));
end $$;

/** Uma foto saiu do registro (apagada, recusada, de conta apagada, do ato apagado): o arquivo vai para a fila do servidor. */
create or replace function interno.rede_ato_album_para_a_fila() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if old.caminho ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$' then
    insert into alumia_arquivos_a_apagar (deposito, caminho) values ('rede-album', old.caminho) on conflict do nothing;
  end if;
  return old;
end $$;

drop trigger if exists rede_ato_album_para_a_fila on interno.rede_ato_album;
create trigger rede_ato_album_para_a_fila after delete on interno.rede_ato_album for each row execute function interno.rede_ato_album_para_a_fila();

revoke all on function interno.rede_ato_album_na_cota(), interno.rede_ato_album_para_a_fila() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_midia_uso(uuid), interno.rede_ato_album_na_cota(), interno.rede_ato_album_para_a_fila() from anon, authenticated;
  end if;
end $$;

/**
 * O espaço de mídia da Alumia, para o painel de controle (coordenação e admin). Só totais: nenhum nome, nenhuma lista. Os três
 * depósitos da pessoa (posts, stories e as fotos do álbum dos atos). "Perto da cota" (80% ou mais, somando os três) só aparece a
 * partir de 3 pessoas; abaixo disso vem nulo.
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
                 from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'', ''rede-album'') group by bucket_id) x'
      into v_depositos;
    execute 'select count(*)::integer from (
               select dono, sum(bytes) as bytes from (
                 select split_part(name, ''/'', 1) as dono, case when (metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (metadata ->> ''size'')::bigint else 0 end as bytes
                   from storage.objects where bucket_id in (''rede-midia'', ''rede-stories'')
                 union all
                 select a.quem::text, case when (o.metadata ->> ''size'') ~ ''^[0-9]{1,15}$'' then (o.metadata ->> ''size'')::bigint else 0 end
                   from storage.objects o join interno.rede_ato_album a on a.caminho = o.name where o.bucket_id = ''rede-album'') y
               group by dono) x where x.bytes >= $1'
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
      'rede-stories', coalesce(v_depositos -> 'rede-stories', '{"bytes": 0, "arquivos": 0}'::jsonb),
      'rede-album', coalesce(v_depositos -> 'rede-album', '{"bytes": 0, "arquivos": 0}'::jsonb)),
    'perto_da_cota', case when v_perto >= 3 then v_perto end,
    'orfaos', v_orfaos,
    'faxina', case when f.rotina is null then null else jsonb_build_object('quando', f.rodou_em, 'detalhes', f.detalhes) end,
    'faxina_ligada', exists (select 1 from configuracoes where chave = 'faxina_midia'),
    'deposito', to_regclass('storage.objects') is not null);
end $$;

-- ── 4. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* e public.alumia_* que anon ou authenticated chamam passa pela porta da entrada (as redefinidas aqui
-- também: create or replace tira a porta, e esta linha a devolve). "abertas" tem de vir vazia.
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(coalesce(v -> 'abertas', '[]'::jsonb)) > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
select interno.alumia_trancar();
