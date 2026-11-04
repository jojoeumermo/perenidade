-- ───────────────────────────── Vale o Escrito, novembro de 2026 ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. O mesmo bloco está no fim do install.sql.
-- Explicação, regras e fluxo: docs/vale-o-escrito/ESPEC.md. Teste do formato: npm run testar:vale-o-escrito.
--
-- Só acréscimo. Nenhuma função que já existe é redefinida; o papel "curadoria" já existe (interno.curador(): curadoria,
-- coordenação e vice-coordenação) e é o que aprova aqui. Nada de papel novo.
--
-- Tabelas (esquema interno, que a API não expõe; só as funções do esquema public abrem):
--   1. interno.vale_sugestoes   o que o robô achou (ainda não é entrada)
--   2. interno.vale_fila        a fila da curadoria (robô, equipe e público)
--   3. interno.vale_envios      fontes enviadas pelo público (sem IP: só hash com sal do dia)
--   4. interno.vale_correcoes   correção, direito de resposta e remoção de dado
--   5. interno.vale_historico   histórico só de acrescentar (quem mudou o quê, quando)
--   6. interno.vale_sal         o sal do dia, apagado em 2 dias (o hash de ontem não se refaz)
--   7. interno.vale_entradas    entradas aprovadas (a Entrada inteira em jsonb), com retirado_em para quem saiu do ar
-- Nenhuma tabela no esquema public (trava do projeto: npm run testar:banco). O público lê por public.vale_publicadas() e
-- public.vale_publicada(id) (security definer, só o que não foi retirado) e acompanha ao vivo por Broadcast do banco
-- (realtime.send, tópico 'vale-o-escrito', evento 'mudou', carga {id, acao}); sem tabela na publicação do Realtime.
--
-- Por que o hash leva sal do dia: interno.limite grava md5 do endereço de rede por até 2 dias (prática do projeto). Para
-- o envio do público guardamos outro hash, com sal sorteado a cada dia e apagado depois, só para barrar repetição no
-- mesmo dia. Passados 2 dias, nem o banco consegue ligar o hash a um endereço (Marco Civil, art. 15, não nos alcança:
-- não somos provedor de aplicação profissional e não guardamos registro de acesso).

-- 1. Sal do dia ─────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.vale_sal (
  dia date primary key,
  sal uuid not null default gen_random_uuid()
);
alter table interno.vale_sal enable row level security;
revoke all on interno.vale_sal from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_sal from anon, authenticated; end if;
end $$;

/** Hash do endereço de rede com o sal do dia (fuso de Brasília). Apaga os sais com mais de 2 dias. */
create or replace function interno.vale_hash_origem() returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_sal uuid;
begin
  insert into vale_sal (dia) values (v_dia) on conflict do nothing;
  select sal into v_sal from vale_sal where dia = v_dia;
  if random() < 0.05 then delete from vale_sal where dia < v_dia - 2; end if;
  return md5(v_sal::text || ':' || interno.origem());
end $$;

-- 2. Sugestões do robô ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.vale_sugestoes (
  id uuid primary key default gen_random_uuid(),
  fonte_catalogo text not null check (fonte_catalogo ~ '^[a-z0-9-]{2,60}$'),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  url_hash text not null unique,
  titulo text not null check (char_length(titulo) between 3 and 300),
  trecho text not null check (char_length(trecho) between 20 and 400),
  data_fonte date not null,
  municipio_ibge text check (municipio_ibge is null or municipio_ibge ~ '^[0-9]{7}$'),
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  temas text[] not null default '{}',
  resumo_ia text check (resumo_ia is null or char_length(resumo_ia) <= 1200),
  provedor_ia text check (provedor_ia is null or provedor_ia ~ '^[a-z0-9_-]{2,40}$'),
  estado text not null default 'nova' check (estado in ('nova', 'na_fila', 'descartada')),
  criado_em timestamptz not null default now()
);
create index if not exists vale_sugestoes_estado on interno.vale_sugestoes (estado, criado_em desc);
alter table interno.vale_sugestoes enable row level security;
revoke all on interno.vale_sugestoes from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_sugestoes from anon, authenticated; end if;
end $$;

-- 3. Fila da curadoria ──────────────────────────────────────────────────────────────────────────────────────────────────
-- "rascunho" é uma Entrada (lib/vale-o-escrito/tipos.ts) ainda por aprovar. A curadoria edita o rascunho e aprova.
create table if not exists interno.vale_fila (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('robo', 'equipe', 'publico')),
  sugestao uuid references interno.vale_sugestoes (id) on delete set null,
  envio uuid,
  rascunho jsonb not null default '{}'::jsonb,
  estado text not null default 'pendente' check (estado in ('pendente', 'em_revisao', 'aprovada', 'recusada', 'devolvida')),
  revisor uuid references interno.perfis (id) on delete set null,
  nota text check (nota is null or char_length(nota) <= 2000),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists vale_fila_estado on interno.vale_fila (estado, criado_em);
alter table interno.vale_fila enable row level security;
revoke all on interno.vale_fila from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_fila from anon, authenticated; end if;
end $$;

-- 4. Envios do público ──────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.vale_envios (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  descricao text not null check (char_length(descricao) between 10 and 2000),
  trecho text check (trecho is null or char_length(trecho) <= 400),
  dossie text check (dossie is null or dossie ~ '^[a-z0-9-]{2,60}$'),
  contato text check (contato is null or char_length(contato) <= 200),
  origem_hash text not null,
  estado text not null default 'novo' check (estado in ('novo', 'na_fila', 'descartado')),
  criado_em timestamptz not null default now()
);
create index if not exists vale_envios_dia on interno.vale_envios (origem_hash, criado_em);
alter table interno.vale_envios enable row level security;
revoke all on interno.vale_envios from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_envios from anon, authenticated; end if;
end $$;

-- 5. Entradas aprovadas (esquema interno; o público lê por função e acompanha por Broadcast) ──────────────────────────────
-- Trava do projeto: nenhuma tabela no esquema public. Quem lê é public.vale_publicadas()/vale_publicada() (seção 17).
-- Quem já tinha a tabela no esquema public (versão anterior desta migração) a leva para interno, sem perder linha.
do $$ begin
  if to_regclass('public.vale_entradas') is not null and to_regclass('interno.vale_entradas') is null then
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vale_entradas') then
      alter publication supabase_realtime drop table public.vale_entradas;
    end if;
    drop policy if exists vale_entradas_leitura on public.vale_entradas;
    alter table public.vale_entradas set schema interno;
  end if;
end $$;
create table if not exists interno.vale_entradas (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  dossie text not null check (dossie ~ '^[a-z0-9-]{2,60}$'),
  situacao text not null check (situacao in ('suspeito', 'investigado', 'denunciado', 'reu', 'condenado_1a_instancia', 'condenado_transitado', 'absolvido', 'arquivado')),
  confianca text not null check (confianca in ('primaria', 'reportado')),
  -- A Entrada inteira (lib/vale-o-escrito/tipos.ts): fontes com trecho, data, link e arquivo; pessoas com a marca "pública no caso".
  doc jsonb not null,
  publicado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  retirado_em timestamptz
);
create index if not exists vale_entradas_dossie on interno.vale_entradas (dossie, atualizado_em desc);
alter table interno.vale_entradas enable row level security;
revoke all on interno.vale_entradas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_entradas from anon, authenticated; end if;
end $$;

/**
 * Ao vivo sem tabela exposta: cada mudança em interno.vale_entradas manda um aviso pelo Broadcast do Supabase (tópico
 * público 'vale-o-escrito', evento 'mudou', carga só {id, acao}). O aviso não traz o conteúdo: quem escuta busca a
 * entrada por public.vale_publicada(id) e confere de novo. Sem o esquema realtime (teste local) ou se o envio falhar,
 * não faz nada e a gravação segue.
 */
create or replace function interno.vale_entradas_avisar() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_acao text;
begin
  if tg_op = 'INSERT' then v_acao := case when new.retirado_em is null then 'publicada' else 'retirada' end;
  elsif new.retirado_em is not null and old.retirado_em is null then v_acao := 'retirada';
  elsif new.retirado_em is null and old.retirado_em is not null then v_acao := 'publicada';
  elsif new.retirado_em is not null then return new;
  else v_acao := 'atualizada';
  end if;
  begin
    if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
      execute 'select realtime.send($1, $2, $3, $4)' using jsonb_build_object('id', new.id, 'acao', v_acao), 'mudou', 'vale-o-escrito', false;
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function interno.vale_entradas_avisar() from public;
drop trigger if exists vale_entradas_aviso on interno.vale_entradas;
create trigger vale_entradas_aviso after insert or update on interno.vale_entradas for each row execute function interno.vale_entradas_avisar();

-- 6. Correções e direito de resposta ────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.vale_correcoes (
  id uuid primary key default gen_random_uuid(),
  entrada text not null check (entrada ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  tipo text not null check (tipo in ('correcao', 'direito_de_resposta', 'remocao_de_dado')),
  texto text not null check (char_length(texto) between 20 and 4000),
  comprovante_url text check (comprovante_url is null or (comprovante_url ~ '^https?://' and char_length(comprovante_url) <= 2000)),
  nome text check (nome is null or char_length(nome) <= 160),
  contato text check (contato is null or char_length(contato) <= 200),
  origem_hash text not null,
  estado text not null default 'nova' check (estado in ('nova', 'em_analise', 'aceita', 'recusada')),
  -- Resposta publicada ao lado da ficha (direito de resposta aceito) e a nota interna da decisão.
  resposta_publica text check (resposta_publica is null or char_length(resposta_publica) <= 4000),
  nota text check (nota is null or char_length(nota) <= 2000),
  -- Meta interna de 7 dias, por analogia ao prazo do art. 5º da Lei 13.188/2015 (que vale para veículos de comunicação).
  responder_ate date not null default ((now() at time zone 'America/Sao_Paulo')::date + 7),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists vale_correcoes_estado on interno.vale_correcoes (estado, criado_em);
alter table interno.vale_correcoes enable row level security;
revoke all on interno.vale_correcoes from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_correcoes from anon, authenticated; end if;
end $$;

-- 7. Histórico (só acrescenta) ──────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.vale_historico (
  id bigint generated always as identity primary key,
  entrada text,
  acao text not null check (char_length(acao) <= 60),
  usuario uuid,
  antes jsonb,
  depois jsonb,
  nota text check (nota is null or char_length(nota) <= 2000),
  em timestamptz not null default now()
);
create index if not exists vale_historico_entrada on interno.vale_historico (entrada, em desc);
alter table interno.vale_historico enable row level security;
revoke all on interno.vale_historico from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.vale_historico from anon, authenticated; end if;
end $$;

create or replace function interno.vale_historico_so_acrescenta() returns trigger language plpgsql as $$
begin
  raise exception 'vale_historico só aceita acréscimo' using errcode = 'P0001';
end $$;
drop trigger if exists vale_historico_sem_mudar on interno.vale_historico;
create trigger vale_historico_sem_mudar before update or delete on interno.vale_historico for each row execute function interno.vale_historico_so_acrescenta();

-- 8. Conferência do documento (repete o essencial de lib/vale-o-escrito/regras.ts) ─────────────────────────────────────
/**
 * Entrada sem fonte, sem trecho, sem data da fonte ou sem situação é recusada; fonte sem arquivo do Internet Archive só
 * passa com arquivoFalhou = true; pessoa sem a marca publicaNoCaso = true ou sem fonte é recusada; papel de vítima,
 * criança, adolescente ou testemunha é recusado (ECA, arts. 17, 143 e 247; LGPD, art. 14).
 */
create or replace function interno.vale_doc_ok(p jsonb) returns void language plpgsql as $$
declare f jsonb; x jsonb; v_texto text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:doc'); end if;
  if coalesce(p ->> 'situacao', '') not in ('suspeito', 'investigado', 'denunciado', 'reu', 'condenado_1a_instancia', 'condenado_transitado', 'absolvido', 'arquivado') then perform interno.erro('invalido:situacao'); end if;
  if coalesce(p ->> 'confianca', '') not in ('primaria', 'reportado') then perform interno.erro('invalido:confianca'); end if;
  if coalesce(p ->> 'id', '') !~ '^[a-z0-9][a-z0-9-]{1,79}$' then perform interno.erro('invalido:id'); end if;
  if coalesce(p ->> 'dossie', '') !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:dossie'); end if;
  if char_length(coalesce(p ->> 'titulo', '')) < 5 or char_length(coalesce(p ->> 'resumo', '')) < 20 then perform interno.erro('invalido:texto'); end if;
  if coalesce(jsonb_typeof(p -> 'fontes'), '') <> 'array' or jsonb_array_length(p -> 'fontes') = 0 then perform interno.erro('invalido:fontes'); end if;
  for f in select * from jsonb_array_elements(p -> 'fontes') loop
    if coalesce(f ->> 'url', '') !~ '^https?://' or char_length(coalesce(f ->> 'trecho', '')) < 20 or char_length(f ->> 'trecho') > 400
       or coalesce(f ->> 'data', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(f ->> 'veiculo', '') = '' then
      perform interno.erro('invalido:fonte');
    end if;
    if coalesce(f ->> 'arquivoUrl', '') !~ '^https://web\.archive\.org/web/' and coalesce(f ->> 'arquivoFalhou', 'false') <> 'true' then perform interno.erro('invalido:arquivo'); end if;
  end loop;
  -- O resumo cita "segundo [veículo]" de alguma fonte.
  v_texto := lower(p ->> 'resumo');
  if not exists (select 1 from jsonb_array_elements(p -> 'fontes') g, unnest(array['', 'a ', 'o ', 'as ', 'os ']) art where position('segundo ' || art || lower(g ->> 'veiculo') in v_texto) > 0) then perform interno.erro('invalido:segundo_fonte'); end if;
  if jsonb_typeof(p -> 'pessoas') = 'array' then
    for x in select * from jsonb_array_elements(p -> 'pessoas') loop
      if coalesce(x ->> 'situacao', '') not in ('suspeito', 'investigado', 'denunciado', 'reu', 'condenado_1a_instancia', 'condenado_transitado', 'absolvido', 'arquivado') then perform interno.erro('invalido:pessoa_situacao'); end if;
      if lower(coalesce(x ->> 'papelNoCaso', '')) ~ '(v[ií]tima|crian[cç]a|adolescente|menor de idade|testemunha)' then perform interno.erro('invalido:pessoa_papel'); end if;
    end loop;
  end if;
  if jsonb_typeof(p -> 'pessoasPublicas') = 'array' then
    for x in select * from jsonb_array_elements(p -> 'pessoasPublicas') loop
      if coalesce(x ->> 'publicaNoCaso', '') <> 'true' or coalesce(jsonb_typeof(x -> 'fonteIds'), '') <> 'array' or jsonb_array_length(x -> 'fonteIds') = 0 then perform interno.erro('invalido:pessoa_publica'); end if;
      if lower(coalesce(x ->> 'papel', '') || ' ' || coalesce(x ->> 'cargo', '')) ~ '(v[ií]tima|crian[cç]a|adolescente|menor de idade|testemunha)' then perform interno.erro('invalido:pessoa_papel'); end if;
    end loop;
  end if;
end $$;

-- 9. O robô sugere (só o serviço) ───────────────────────────────────────────────────────────────────────────────────────
/**
 * Grava uma sugestão do robô (GitHub Actions, com a chave de serviço) e a põe na fila. Repetida (mesmo link) não grava de
 * novo. O resumo da IA é opcional: sem cota, a sugestão entra sem resumo.
 */
create or replace function public.vale_robo_sugerir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_fila uuid; v_url text := interno.txt(p ->> 'url', 'url', 10, 2000);
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if v_url !~ '^https?://' then perform interno.erro('invalido:url'); end if;
  insert into vale_sugestoes (fonte_catalogo, url, url_hash, titulo, trecho, data_fonte, municipio_ibge, uf, temas, resumo_ia, provedor_ia)
  values (interno.txt(p ->> 'fonte', 'fonte', 2, 60), v_url, md5(v_url), interno.txt(p ->> 'titulo', 'titulo', 3, 300), interno.txt(p ->> 'trecho', 'trecho', 20, 400),
          (p ->> 'data')::date, nullif(p ->> 'municipio_ibge', ''), nullif(p ->> 'uf', ''),
          coalesce((select array_agg(left(t, 60)) from jsonb_array_elements_text(coalesce(p -> 'temas', '[]'::jsonb)) t), '{}'),
          nullif(left(coalesce(p ->> 'resumo_ia', ''), 1200), ''), nullif(p ->> 'provedor_ia', ''))
  on conflict (url_hash) do nothing
  returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', true, 'repetida', true); end if;
  insert into vale_fila (origem, sugestao, rascunho) values ('robo', v_id, coalesce(p -> 'rascunho', '{}'::jsonb)) returning id into v_fila;
  update vale_sugestoes set estado = 'na_fila' where id = v_id;
  insert into vale_historico (acao, depois) values ('robo_sugeriu', jsonb_build_object('sugestao', v_id, 'fila', v_fila));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- 10. Entrada manual da equipe ──────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.vale_fila_criar(p_rascunho jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if p_rascunho is null or jsonb_typeof(p_rascunho) <> 'object' then perform interno.erro('invalido:rascunho'); end if;
  insert into vale_fila (origem, rascunho) values ('equipe', p_rascunho) returning id into v_id;
  insert into vale_historico (acao, usuario, depois) values ('equipe_criou', auth.uid(), jsonb_build_object('fila', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- 11. Curadoria: ver e decidir ──────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.vale_fila_listar(p_estado text default 'pendente') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_estado, '') not in ('pendente', 'em_revisao', 'aprovada', 'recusada', 'devolvida') then perform interno.erro('invalido:estado'); end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em), '[]'::jsonb)
    from (
      select q.id, q.origem, q.rascunho, q.estado, q.nota, q.criado_em, q.decidido_em,
             s.url as sugestao_url, s.titulo as sugestao_titulo, s.resumo_ia, s.provedor_ia,
             e.url as envio_url, e.descricao as envio_descricao, e.trecho as envio_trecho
      from vale_fila q
      left join vale_sugestoes s on s.id = q.sugestao
      left join vale_envios e on e.id = q.envio
      where q.estado = p_estado
      order by q.criado_em
      limit 300
    ) x
  );
end $$;

/**
 * A curadoria decide: 'aprovar' (grava em interno.vale_entradas, com a Entrada já com arquivoUrl do Internet Archive),
 * 'recusar' ou 'devolver'. Aprovar confere o documento (vale_doc_ok). Quem aprova fica no histórico e NUNCA aparece em
 * público: a curadoria é anônima ao leitor.
 */
create or replace function public.vale_fila_decidir(p_id uuid, p_decisao text, p_nota text default '', p_doc jsonb default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_fila vale_fila; v_doc jsonb; v_id text; v_antes jsonb;
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_decisao, '') not in ('aprovar', 'recusar', 'devolver') then perform interno.erro('invalido:decisao'); end if;
  -- Recusar e devolver sem motivo deixam quem enviou sem resposta: o banco também exige a nota (não só a tela).
  if p_decisao in ('recusar', 'devolver') and length(btrim(coalesce(p_nota, ''))) < 5 then perform interno.erro('invalido:nota'); end if;
  select * into v_fila from vale_fila where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if v_fila.estado in ('aprovada', 'recusada') then perform interno.erro('ja_decidida'); end if;
  if p_decisao = 'aprovar' then
    v_doc := coalesce(p_doc, v_fila.rascunho);
    perform interno.vale_doc_ok(v_doc);
    v_id := v_doc ->> 'id';
    select doc into v_antes from interno.vale_entradas where id = v_id;
    insert into interno.vale_entradas (id, dossie, situacao, confianca, doc)
    values (v_id, v_doc ->> 'dossie', v_doc ->> 'situacao', v_doc ->> 'confianca', v_doc)
    on conflict (id) do update set dossie = excluded.dossie, situacao = excluded.situacao, confianca = excluded.confianca, doc = excluded.doc, atualizado_em = now(), retirado_em = null;
    update vale_fila set estado = 'aprovada', revisor = auth.uid(), nota = interno.txt(p_nota, 'nota', 0, 2000), rascunho = v_doc, decidido_em = now() where id = p_id;
    insert into vale_historico (entrada, acao, usuario, antes, depois, nota) values (v_id, 'aprovou', auth.uid(), v_antes, v_doc, interno.txt(p_nota, 'nota', 0, 2000));
  else
    update vale_fila set estado = case p_decisao when 'recusar' then 'recusada' else 'devolvida' end, revisor = auth.uid(), nota = interno.txt(p_nota, 'nota', 0, 2000), decidido_em = now() where id = p_id;
    insert into vale_historico (acao, usuario, depois, nota) values (p_decisao, auth.uid(), jsonb_build_object('fila', p_id), interno.txt(p_nota, 'nota', 0, 2000));
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- 12. Atualizar situação (absolvição, arquivamento, nova decisão) e retirar ────────────────────────────────────────────
/**
 * Muda a situação jurídica de uma entrada já publicada, com a fonte nova dentro do documento. Absolvição e arquivamento
 * entram aqui: a ficha mostra a nova situação e a data na mesma hora (Realtime).
 */
create or replace function public.vale_entrada_atualizar(p_id text, p_doc jsonb, p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_antes jsonb;
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  select doc into v_antes from interno.vale_entradas where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.vale_doc_ok(p_doc);
  if p_doc ->> 'id' <> p_id then perform interno.erro('invalido:id'); end if;
  update interno.vale_entradas set dossie = p_doc ->> 'dossie', situacao = p_doc ->> 'situacao', confianca = p_doc ->> 'confianca', doc = p_doc, atualizado_em = now() where id = p_id;
  insert into vale_historico (entrada, acao, usuario, antes, depois, nota) values (p_id, 'atualizou', auth.uid(), v_antes, p_doc, interno.txt(p_nota, 'nota', 0, 2000));
  return jsonb_build_object('ok', true);
end $$;

/** Retira uma entrada do ar (correção procedente, ordem judicial). Não apaga: fica no banco e no histórico. */
create or replace function public.vale_entrada_retirar(p_id text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  update interno.vale_entradas set retirado_em = now(), atualizado_em = now() where id = p_id and retirado_em is null;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into vale_historico (entrada, acao, usuario, nota) values (p_id, 'retirou', auth.uid(), interno.txt(p_motivo, 'motivo', 3, 2000));
  return jsonb_build_object('ok', true);
end $$;

-- 13. Envio de fonte pelo público ───────────────────────────────────────────────────────────────────────────────────────
/**
 * Sem conta. Campo-isca "site" preenchido: finge que deu certo e não grava. Freio por origem (5 por hora) e um teto
 * geral. Guarda o hash do endereço com o sal do dia, nunca o endereço. Cai direto na fila da curadoria.
 */
create or replace function public.vale_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid; v_hash text; v_url text; v_dossie text;
begin
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('ok', true); end if;
  -- Tempo mínimo de preenchimento (o formulário manda tempoMs): quem manda antes de 3 s é robô; sai em silêncio, como a isca.
  if (case when coalesce(p ->> 'tempoMs', '') ~ '^[0-9]{1,9}$' then (p ->> 'tempoMs')::bigint else 0 end) < 3000 then return jsonb_build_object('ok', true); end if;
  if random() < 0.02 then perform interno.vale_limpeza(); end if;
  perform interno.limite('vale_enviar', 5, 60);
  perform interno.limite('vale_enviar_geral', 300, 60);
  if coalesce(p ->> 'leuOAviso', 'false') <> 'true' then perform interno.erro('invalido:aviso'); end if;
  v_url := interno.txt(p ->> 'url', 'url', 10, 2000);
  if v_url !~ '^https?://' then perform interno.erro('invalido:url'); end if;
  v_dossie := nullif(p ->> 'dossie', '');
  if v_dossie is not null and v_dossie !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:dossie'); end if;
  v_hash := interno.vale_hash_origem();
  -- O mesmo link do mesmo hash no mesmo dia vale uma vez só.
  if exists (select 1 from vale_envios where origem_hash = v_hash and url = v_url and criado_em > now() - interval '1 day') then return jsonb_build_object('ok', true); end if;
  insert into vale_envios (url, descricao, trecho, dossie, contato, origem_hash)
  values (v_url, interno.txt(p ->> 'descricao', 'descricao', 10, 2000), nullif(interno.txt(p ->> 'trecho', 'trecho', 0, 400), ''), v_dossie,
          nullif(interno.txt(p ->> 'contato', 'contato', 0, 200), ''), v_hash)
  returning id into v_id;
  insert into vale_fila (origem, envio) values ('publico', v_id);
  update vale_envios set estado = 'na_fila' where id = v_id;
  return jsonb_build_object('ok', true);
end $$;

-- 14. Correção e direito de resposta ────────────────────────────────────────────────────────────────────────────────────
/** Sem conta. Direito de resposta exige contato. Mesma isca e mesmo freio do envio. A meta de resposta é de 7 dias. */
create or replace function public.vale_corrigir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_tipo text := coalesce(p ->> 'tipo', ''); v_contato text; v_id uuid;
begin
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('ok', true); end if;
  -- Tempo mínimo de preenchimento (o formulário manda tempoMs): quem manda antes de 3 s é robô; sai em silêncio, como a isca.
  if (case when coalesce(p ->> 'tempoMs', '') ~ '^[0-9]{1,9}$' then (p ->> 'tempoMs')::bigint else 0 end) < 3000 then return jsonb_build_object('ok', true); end if;
  if random() < 0.02 then perform interno.vale_limpeza(); end if;
  perform interno.limite('vale_corrigir', 5, 60);
  perform interno.limite('vale_corrigir_geral', 200, 60);
  if v_tipo not in ('correcao', 'direito_de_resposta', 'remocao_de_dado') then perform interno.erro('invalido:tipo'); end if;
  v_contato := nullif(interno.txt(p ->> 'contato', 'contato', 0, 200), '');
  if v_tipo = 'direito_de_resposta' and v_contato is null then perform interno.erro('invalido:contato'); end if;
  -- Lei 13.188/2015, art. 3º: quem pede o direito de resposta se identifica (nome e qualidade, esta no começo do texto).
  if v_tipo = 'direito_de_resposta' and length(btrim(coalesce(p ->> 'nome', ''))) < 3 then perform interno.erro('invalido:nome'); end if;
  if coalesce(p ->> 'entradaId', '') !~ '^[a-z0-9][a-z0-9-]{1,79}$' then perform interno.erro('invalido:entrada'); end if;
  insert into vale_correcoes (entrada, tipo, texto, comprovante_url, nome, contato, origem_hash)
  values (p ->> 'entradaId', v_tipo, interno.txt(p ->> 'texto', 'texto', 20, 4000),
          case when coalesce(p ->> 'comprovanteUrl', '') ~ '^https?://' then left(p ->> 'comprovanteUrl', 2000) end,
          nullif(interno.txt(p ->> 'nome', 'nome', 0, 160), ''), v_contato, interno.vale_hash_origem())
  returning id into v_id;
  insert into vale_historico (entrada, acao, depois) values (p ->> 'entradaId', 'pedido_de_' || v_tipo, jsonb_build_object('correcao', v_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.vale_correcoes_listar(p_estado text default 'nova') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_estado, '') not in ('nova', 'em_analise', 'aceita', 'recusada') then perform interno.erro('invalido:estado'); end if;
  return (select coalesce(jsonb_agg(to_jsonb(c) order by c.responder_ate, c.criado_em), '[]'::jsonb)
          from (select id, entrada, tipo, texto, comprovante_url, nome, contato, estado, resposta_publica, nota, responder_ate, criado_em, decidido_em
                from vale_correcoes where estado = p_estado order by responder_ate, criado_em limit 300) c);
end $$;

/** A curadoria responde: aceita (com a resposta publicada ao lado da ficha, se for direito de resposta) ou recusa. */
create or replace function public.vale_correcao_decidir(p_id uuid, p_estado text, p_resposta text default '', p_nota text default '') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_entrada text;
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_estado, '') not in ('em_analise', 'aceita', 'recusada') then perform interno.erro('invalido:estado'); end if;
  if p_estado = 'recusada' and length(btrim(coalesce(p_nota, ''))) < 5 then perform interno.erro('invalido:nota'); end if;
  update vale_correcoes set estado = p_estado, resposta_publica = nullif(interno.txt(p_resposta, 'resposta', 0, 4000), ''), nota = nullif(interno.txt(p_nota, 'nota', 0, 2000), ''),
         decidido_em = case when p_estado = 'em_analise' then null else now() end
   where id = p_id returning entrada into v_entrada;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into vale_historico (entrada, acao, usuario, nota) values (v_entrada, 'correcao_' || p_estado, auth.uid(), interno.txt(p_nota, 'nota', 0, 2000));
  return jsonb_build_object('ok', true);
end $$;

-- 15. Permissões das funções ────────────────────────────────────────────────────────────────────────────────────────────
-- Público (sem conta): só enviar fonte e pedir correção. Equipe com conta: as da curadoria (cada uma confere o papel por dentro).
-- Serviço: só o robô.
revoke all on function public.vale_robo_sugerir(jsonb) from public;
revoke all on function public.vale_fila_criar(jsonb) from public;
revoke all on function public.vale_fila_listar(text) from public;
revoke all on function public.vale_fila_decidir(uuid, text, text, jsonb) from public;
revoke all on function public.vale_entrada_atualizar(text, jsonb, text) from public;
revoke all on function public.vale_entrada_retirar(text, text) from public;
revoke all on function public.vale_enviar(jsonb) from public;
revoke all on function public.vale_corrigir(jsonb) from public;
revoke all on function public.vale_correcoes_listar(text) from public;
revoke all on function public.vale_correcao_decidir(uuid, text, text, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.vale_robo_sugerir(jsonb) from anon, authenticated;
    revoke all on function public.vale_fila_criar(jsonb) from anon;
    revoke all on function public.vale_fila_listar(text) from anon;
    revoke all on function public.vale_fila_decidir(uuid, text, text, jsonb) from anon;
    revoke all on function public.vale_entrada_atualizar(text, jsonb, text) from anon;
    revoke all on function public.vale_entrada_retirar(text, text) from anon;
    revoke all on function public.vale_correcoes_listar(text) from anon;
    revoke all on function public.vale_correcao_decidir(uuid, text, text, text) from anon;
    grant execute on function public.vale_fila_criar(jsonb) to authenticated;
    grant execute on function public.vale_fila_listar(text) to authenticated;
    grant execute on function public.vale_fila_decidir(uuid, text, text, jsonb) to authenticated;
    grant execute on function public.vale_entrada_atualizar(text, jsonb, text) to authenticated;
    grant execute on function public.vale_entrada_retirar(text, text) to authenticated;
    grant execute on function public.vale_correcoes_listar(text) to authenticated;
    grant execute on function public.vale_correcao_decidir(uuid, text, text, text) to authenticated;
    grant execute on function public.vale_enviar(jsonb) to anon, authenticated;
    grant execute on function public.vale_corrigir(jsonb) to anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.vale_robo_sugerir(jsonb) to service_role;
  end if;
end $$;

-- 16. Curadoria: guardar o rascunho, ler o histórico, pedir o arquivo ───────────────────────────────────────────────────
-- Acréscimo do pacote "curadoria" (painel: Vale o Escrito: curadoria). Nenhuma função anterior é redefinida.
/** Guarda o rascunho que a curadoria está editando (e põe o item "em revisão"). Item já decidido não muda. */
create or replace function public.vale_fila_salvar(p_id uuid, p_rascunho jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if p_rascunho is null or jsonb_typeof(p_rascunho) <> 'object' or pg_column_size(p_rascunho) > 200000 then perform interno.erro('invalido:rascunho'); end if;
  update vale_fila set rascunho = p_rascunho, estado = 'em_revisao', revisor = auth.uid() where id = p_id and estado in ('pendente', 'em_revisao', 'devolvida');
  if not found then perform interno.erro('ja_decidida'); end if;
  insert into vale_historico (acao, usuario, depois) values ('rascunho_salvo', auth.uid(), jsonb_build_object('fila', p_id));
  return jsonb_build_object('ok', true);
end $$;

/** O histórico interno de uma entrada, com quem fez. Só a curadoria lê: o público vê a ficha, que nunca traz nome. */
create or replace function public.vale_historico_listar(p_entrada text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_entrada, '') !~ '^[a-z0-9][a-z0-9-]{1,79}$' then perform interno.erro('invalido:entrada'); end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(h) order by h.em desc), '[]'::jsonb)
    from (select y.id, y.acao, y.nota, y.em, f.nome as quem from vale_historico y left join perfis f on f.id = y.usuario where y.entrada = p_entrada order by y.em desc limit 200) h
  );
end $$;

/**
 * A rota do servidor (app/api/vale-o-escrito/arquivar) chama isto com o token de quem pediu, ANTES de falar com o
 * Internet Archive: confere o papel e segura o ritmo (40 pedidos por hora por pessoa).
 */
create or replace function public.vale_arquivo_pedir() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('vale_arquivar', 40, 60);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.vale_fila_salvar(uuid, jsonb) from public;
revoke all on function public.vale_historico_listar(text) from public;
revoke all on function public.vale_arquivo_pedir() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.vale_fila_salvar(uuid, jsonb) from anon;
    revoke all on function public.vale_historico_listar(text) from anon;
    revoke all on function public.vale_arquivo_pedir() from anon;
    grant execute on function public.vale_fila_salvar(uuid, jsonb) to authenticated;
    grant execute on function public.vale_historico_listar(text) to authenticated;
    grant execute on function public.vale_arquivo_pedir() to authenticated;
  end if;
end $$;

-- 16. Limpeza do que o público enviou ───────────────────────────────────────────────────────────────────────────────────
/**
 * O que a política de privacidade promete (content/paginas/privacidade.md):
 *  - envio de fonte: 90 dias depois do envio o contato e o código da origem são apagados; o envio recusado há mais de 90 dias
 *    some por inteiro (o aprovado virou ficha pública, sem contato e sem nome);
 *  - pedido de correção: um ano depois da decisão o texto, o nome, o contato e o link são apagados (a resposta publicada ao
 *    lado da ficha, se houver, fica); o pedido recusado há mais de um ano some por inteiro.
 * Roda de vez em quando dentro das funções do público e, onde houver pg_cron, toda madrugada. Não mexe no histórico.
 */
create or replace function interno.vale_limpeza() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from vale_fila where origem = 'publico' and estado = 'recusada' and decidido_em < now() - interval '90 days';
  delete from vale_envios e where e.criado_em < now() - interval '90 days'
    and not exists (select 1 from vale_fila q where q.envio = e.id);
  update vale_envios set contato = null, origem_hash = 'apagado' where criado_em < now() - interval '90 days' and (contato is not null or origem_hash <> 'apagado');
  delete from vale_correcoes where estado = 'recusada' and decidido_em < now() - interval '1 year';
  update vale_correcoes set texto = '[texto apagado um ano depois da decisão]', nome = null, contato = null, comprovante_url = null, origem_hash = 'apagado'
   where estado = 'aceita' and decidido_em < now() - interval '1 year' and origem_hash <> 'apagado';
end $$;
revoke all on function interno.vale_limpeza() from public;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vale-limpeza', '23 6 * * *', 'select interno.vale_limpeza()');
  end if;
exception when others then null;
end $$;

-- 17. Leitura pública das entradas aprovadas ────────────────────────────────────────────────────────────────────────────
/** As entradas publicadas (não retiradas), da mais recente mudança para a mais antiga. Sem conta; só o que a ficha mostra. */
create or replace function public.vale_publicadas(p_dossie text default null) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.atualizado_em desc), '[]'::jsonb)
  from (
    select e.id, e.dossie, e.situacao, e.confianca, e.doc, e.publicado_em, e.atualizado_em
    from interno.vale_entradas e
    where e.retirado_em is null and (p_dossie is null or e.dossie = p_dossie)
    order by e.atualizado_em desc
    limit 2000
  ) x
$$;
/** Uma entrada publicada pelo id, ou nulo se não existe ou foi retirada. */
create or replace function public.vale_publicada(p_id text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select (select to_jsonb(x) from (select e.id, e.dossie, e.situacao, e.confianca, e.doc, e.publicado_em, e.atualizado_em
                                    from interno.vale_entradas e where e.id = p_id and e.retirado_em is null) x)
$$;
revoke all on function public.vale_publicadas(text) from public;
revoke all on function public.vale_publicada(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.vale_publicadas(text) to anon, authenticated, service_role;
    grant execute on function public.vale_publicada(text) to anon, authenticated, service_role;
  end if;
end $$;
