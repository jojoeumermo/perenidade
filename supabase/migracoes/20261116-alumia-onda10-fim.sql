-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Onda 10 · fim: marca no banco que as migrações da onda 10 foram instaladas (o fórum, os cargos e a chegada, a estrutura
-- das comunidades, o acervo, a decisão e os números e os atos e eventos: as migrações 20261116-alumia-o10-*.sql, na ordem do fim
-- do install.sql), acerta o que a onda 9 deixou para quem junta e põe a porta da entrada em toda função nova. Pode rodar mais de
-- uma vez. Roda por último, depois de todas elas.
-- Serve para conferir de fora, sem entrar no painel, se o SQL da onda já está em produção:
--   POST /rest/v1/rpc/rede_alumia_versao  →  7
-- O site NÃO exige a versão 7 para abrir: com o banco ainda em 6, o que já existia segue igual e cada função nova que faltar
-- responde "indisponível" na própria tela (o painel de controle mostra "esperada 7 · instalada 6").
--
-- O que a onda 9 deixou e entra aqui:
--   · os avisos de marcação (9A) e os recados "Estou bem" e "Fui detido" (9C) viram tipos que a pessoa liga e desliga na tela de
--     avisos, como os outros (interno.rede_alumia_tipos_de_aviso, a mesma lista de lib/rede/tipos-avisos.ts, TIPOS_DE_AVISO, na
--     mesma ordem). O gatilho de sempre (interno.rede3_aviso_antes) já não grava o aviso de um tipo desligado no site; o recado
--     continua no Modo ato, com o prazo dele, com o aviso ligado ou não;
--   · os seletores de comunidade da moderação mostram o nome da comunidade, não o endereço: public.rede_mod_escopo devolve também
--     "nomes" (endereço → nome), só das comunidades que a pessoa já modera.
-- As funções que as frentes da onda 10 deixaram para a junta conferir: nenhuma das seis migrações redefine uma função de outra,
-- e nenhuma redefine interno.alumia_porta_aberta (a lista de 20261115-alumia-o9-transparencia.sql, com a federação e o diretório,
-- continua valendo).

-- ── 1. A versão ───────────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 7
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. Os tipos de aviso que a pessoa liga e desliga ──────────────────────────────────────────────────────────────────────

/** Os tipos que a pessoa liga e desliga na tela (a mesma lista de lib/rede/tipos-avisos.ts, TIPOS_DE_AVISO, na mesma ordem). */
create or replace function interno.rede_alumia_tipos_de_aviso() returns text[] language sql immutable as $$
  select array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio',
               'conversa_seguida', 'ajudou', 'ato', 'reacao_story', 'lembrete',
               'marcacao', 'estou_bem', 'detido']::text[]
$$;
revoke all on function interno.rede_alumia_tipos_de_aviso() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_alumia_tipos_de_aviso() from anon, authenticated;
  end if;
end $$;

-- A regra da tabela de preferências passa a aceitar os três tipos. Ela é refeita a partir da que está no banco, só acrescentando
-- (para não tirar tipo de ninguém, nem os da federação), e lida nos dois jeitos em que o banco a guarda: lista entre chaves
-- ('{a,b}'::text[]) ou in ('a', 'b').
do $$
declare r record; v_tipos text[] := '{}'; v_novos text[] := array['marcacao', 'estou_bem', 'detido'];
begin
  for r in select conname, pg_get_constraintdef(oid) as def from pg_constraint
           where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~* '[^_]tipo' loop
    v_tipos := v_tipos
      || array(select x from (select unnest(string_to_array(m[1], ',')) as x from regexp_matches(r.def, '''\{([a-z_,]*)\}''', 'g') m) z where x <> '')
      || array(select m[1] from regexp_matches(r.def, '''([a-z_]+)''', 'g') m);
  end loop;
  if v_tipos @> v_novos then return; end if;
  -- Leitura que não achou os tipos de sempre: não mexe (melhor sem os três tipos novos do que sem os outros).
  if not v_tipos @> array['resposta', 'mencao', 'citacao'] then return; end if;
  for r in select conname from pg_constraint
           where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~* '[^_]tipo' loop
    execute format('alter table interno.rede_avisos_prefs drop constraint %I', r.conname);
  end loop;
  v_tipos := array(select distinct unnest(v_tipos || v_novos || interno.rede_alumia_tipos_de_aviso() || array['resumo']) order by 1);
  execute format('alter table interno.rede_avisos_prefs add constraint rede_avisos_prefs_tipo_b1 check (tipo = any (%L::text[]))', v_tipos);
end $$;

-- ── 3. O nome da comunidade nos seletores da moderação ────────────────────────────────────────────────────────────────────

/** O que quem chama modera: o painel só mostra o que cabe. "nomes": o nome de cada comunidade da lista (só das que ela modera). */
create or replace function public.rede_mod_escopo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  return jsonb_build_object(
    'cuida', interno.cuida(), 'coord', interno.coord(),
    'comunidades', coalesce((select jsonb_agg(m.comunidade order by m.comunidade) from rede_comunidade_membros m where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo'), '[]'::jsonb),
    'nomes', coalesce((select jsonb_object_agg(c.slug, c.nome) from rede_comunidade_membros m join rede_comunidades c on c.slug = m.comunidade
                       where m.usuario = v and m.papel = 'moderacao' and m.situacao = 'ativo'), '{}'::jsonb),
    'nucleos', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'nome', n.nome) order by n.nome) from rede_nucleo_membros m join rede_nucleos n on n.id = m.nucleo where m.usuario = v and m.papel = 'mediacao'), '[]'::jsonb));
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
