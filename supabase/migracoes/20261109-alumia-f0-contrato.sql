-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 5 · F0 · o contrato comum (09/11/2026) ═══════════════════════════
-- docs/plano-2026-11/PLANO-ALUMIA.md, seções 1, 5 (F0), 6 e 8. Idempotente: pode rodar duas vezes sem estrago (o teste
-- scripts/testar-alumia-rota.mjs roda duas vezes no banco local). NÃO está no install.sql: o integrador cola no fim, antes das
-- migrações F1..F9. NÃO rodar em produção sem o Jonathan.
--
-- O que muda:
--   1. rede_posts ganha três colunas, só colunas (a lógica é de cada frente): expira_em (F6, posts que somem), ato (F2, a linha ao
--      vivo de um ato) e como (F4/F6, a identidade ou organização que publicou, que é SEMPRE o próprio autor: o dono da
--      identidade nunca fica gravado no post).
--   2. Checks ampliados: os alvos novos de denúncia e de moderação, e os tipos novos de preferência de aviso.
--   3. interno.rede_identidades (dono → identidade/organização) e interno.rede_age_como: o vínculo fica SÓ aqui (§6.6).
--   4. public.rede_alumia_versao(): o número do contrato (a tela mostra "banco desatualizado" quando faltar).
--   5. O catálogo de recursos ganha as flags da Onda 5 (todas só pelo nome).
--   6. A rota mudou para /alumia: o link do resumo semanal e a ponte da página /denunciar (que aceita os dois caminhos).
--
-- Leis (conferidas no texto, leis-do-brasil): LGPD (Lei 13.709/2018) art. 5º, II e art. 11 — opinião política e filiação são
-- dado pessoal sensível: por isso nenhuma função nova devolve lista de pessoas e o vínculo dono↔identidade não sai do banco; art.
-- 6º, III (necessidade): rede_identidades guarda só a DATA da criação, sem hora, para não permitir cruzar o horário com a
-- atividade do dono; art. 46 (segurança): RLS ligada e nenhuma permissão para anon/authenticated nas tabelas novas.

-- ── 1. rede_posts: colunas do contrato ────────────────────────────────────────────────────────────────────────────────────
alter table interno.rede_posts add column if not exists expira_em timestamptz;
alter table interno.rede_posts add column if not exists ato uuid;
alter table interno.rede_posts add column if not exists como uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_ato_fk') then
    alter table interno.rede_posts add constraint rede_posts_ato_fk foreign key (ato) references interno.rede_posts (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_como_fk') then
    alter table interno.rede_posts add constraint rede_posts_como_fk foreign key (como) references interno.perfis (id) on delete cascade;
  end if;
  -- "como" é a identidade que publicou e ela É o autor do post: gravar outra pessoa aqui revelaria o dono da identidade.
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_como_autor') then
    alter table interno.rede_posts add constraint rede_posts_como_autor check (como is null or como = autor);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_posts'::regclass and conname = 'rede_posts_ato_nao_ele') then
    alter table interno.rede_posts add constraint rede_posts_ato_nao_ele check (ato is null or ato <> id);
  end if;
end $$;
create index if not exists rede_posts_ato on interno.rede_posts (ato, criado_em) where ato is not null;
create index if not exists rede_posts_expira on interno.rede_posts (expira_em) where expira_em is not null;

-- ── 2. Checks ampliados ───────────────────────────────────────────────────────────────────────────────────────────────────
-- Denúncia: os alvos de antes + os das frentes novas (stories, notas, organizações, consultas, perguntas da plenária, arquivos
-- do núcleo, wiki, figurinhas, petições). Tudo cai na mesma fila (PLANO-ALUMIA §7.1).
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_denuncias'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%alvo_tipo%' loop
    execute format('alter table interno.rede_denuncias drop constraint %I', r.conname);
  end loop;
  alter table interno.rede_denuncias add constraint rede_denuncias_alvo_tipo_v5 check (alvo_tipo in (
    'post', 'perfil', 'comunidade',
    'story', 'nota', 'org', 'consulta', 'pergunta', 'arquivo', 'wiki', 'figurinha', 'peticao'));
end $$;
-- Registro de moderação (continua só de inserção): os mesmos alvos novos.
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_moderacao'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%alvo_tipo%' loop
    execute format('alter table interno.rede_moderacao drop constraint %I', r.conname);
  end loop;
  alter table interno.rede_moderacao add constraint rede_moderacao_alvo_tipo_v5 check (alvo_tipo in (
    'post', 'perfil', 'comunidade', 'nucleo',
    'story', 'nota', 'org', 'consulta', 'pergunta', 'arquivo', 'wiki', 'figurinha', 'peticao'));
end $$;
-- Preferências de aviso: as de antes + os tipos novos das frentes. O que a pessoa já escolheu fica.
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'interno.rede_avisos_prefs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tipo%' loop
    execute format('alter table interno.rede_avisos_prefs drop constraint %I', r.conname);
  end loop;
  alter table interno.rede_avisos_prefs add constraint rede_avisos_prefs_tipo_v5 check (tipo in (
    'resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio', 'resumo',
    'ato_mudou', 'consulta', 'plenaria', 'org_postou', 'story_resposta', 'estou_bem', 'detido', 'marcacao', 'lembrete', 'conversa_seguida'));
end $$;

-- ── 3. Identidades e contas de organização ────────────────────────────────────────────────────────────────────────────────
-- Uma identidade (ou conta de organização) é OUTRO usuário em auth.users, sem senha, criado pelo servidor (lib/rede/contas-extra.ts).
-- O único lugar que diz de quem ela é: esta tabela. Nenhuma função devolve esse vínculo a outra pessoa nem à moderação comum; só
-- a coordenação, por "quebra de vidro" registrada em rede_moderacao e com ordem judicial (PLANO-ALUMIA §6.6). Risco que fica
-- (documentar na tela): um vazamento do banco inteiro revela o vínculo.
create table if not exists interno.rede_identidades (
  dono uuid not null references interno.perfis (id) on delete cascade,
  identidade uuid not null unique references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('identidade', 'org')),
  -- Só a data (LGPD art. 6º, III): a hora exata ajudaria a ligar a conta nova ao dono pelo horário de atividade.
  criada_em date not null default current_date,
  check (dono <> identidade)
);
create index if not exists rede_identidades_dono on interno.rede_identidades (dono);
alter table interno.rede_identidades enable row level security;
revoke all on table interno.rede_identidades from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_identidades from anon, authenticated;
  end if;
end $$;

/**
 * `p_quem` pode agir como `p_como`? Sim quando é ele mesmo ou quando `p_como` é uma identidade/organização dele. As frentes
 * (F4: gestores da organização; F6: troca de identidade) estendem esta regra com create or replace, sem mudar a assinatura.
 */
create or replace function interno.rede_age_como(p_quem uuid, p_como uuid) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_como is not null
    and (p_quem = p_como or exists (select 1 from rede_identidades i where i.dono = p_quem and i.identidade = p_como))
$$;
revoke all on function interno.rede_age_como(uuid, uuid) from public;

/**
 * Liga uma conta recém-criada (sem senha) ao dono. Só o servidor (chave de serviço) chama, logo depois de criar o usuário em
 * auth.users (lib/rede/contas-extra.ts). Regras: dono e identidade existem e são diferentes; uma identidade não tem dono duas
 * vezes; quem já é identidade não vira dono (sem cadeia); no máximo 5 identidades e 5 organizações por dono. Devolve só "ok".
 */
create or replace function public.rede_identidade_ligar(p_dono uuid, p_identidade uuid, p_tipo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if p_dono is null or p_identidade is null or p_dono = p_identidade then perform interno.erro('invalido:identidade'); end if;
  if p_tipo is null or p_tipo not in ('identidade', 'org') then perform interno.erro('invalido:tipo'); end if;
  if not exists (select 1 from perfis where id = p_dono) or not exists (select 1 from perfis where id = p_identidade) then
    perform interno.erro('nao_encontrado');
  end if;
  if exists (select 1 from rede_identidades where identidade = p_dono) then perform interno.erro('invalido:dono'); end if;
  if exists (select 1 from rede_identidades where dono = p_identidade) then perform interno.erro('invalido:identidade'); end if;
  if exists (select 1 from rede_identidades where identidade = p_identidade) then perform interno.erro('invalido:identidade'); end if;
  if (select count(*) from rede_identidades where dono = p_dono and tipo = p_tipo) >= 5 then perform interno.erro('limite_diario'); end if;
  insert into rede_identidades (dono, identidade, tipo) values (p_dono, p_identidade, p_tipo);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.rede_identidade_ligar(uuid, uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_identidade_ligar(uuid, uuid, text) from anon, authenticated;
    revoke all on function interno.rede_age_como(uuid, uuid) from anon, authenticated;
    grant execute on function public.rede_identidade_ligar(uuid, uuid, text) to service_role;
  end if;
end $$;

-- ── 4. O número do contrato ───────────────────────────────────────────────────────────────────────────────────────────────
/** A versão do contrato da Alumia no banco (1 = F0). A tela compara com a que espera e mostra "banco desatualizado" se faltar. */
create or replace function public.rede_alumia_versao() returns integer language sql immutable set search_path = interno, pg_temp as $$
  select 1
$$;
revoke all on function public.rede_alumia_versao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.rede_alumia_versao() to anon, authenticated, service_role;
  end if;
end $$;

-- ── 5. Catálogo de recursos: as flags da Onda 5 (lib/recursos.ts), todas só pelo nome ───────────────────────────────────────
-- (Ao colar no install.sql, o integrador também acrescenta estas linhas ao PRIMEIRO insert do catálogo: o teste
-- scripts/testar-backend-1.mjs compara aquele bloco com lib/recursos.ts.)
insert into interno.recursos_catalogo (nome, so_pelo_nome) values
  ('alumia-2', true), ('alumia-stories', true), ('alumia-modo-ato', true), ('alumia-org', true), ('alumia-chat-grupo', true)
on conflict (nome) do update set so_pelo_nome = excluded.so_pelo_nome;

-- ── 6. A rota mudou para /alumia (lib/rede/rota-alumia.ts) ──────────────────────────────────────────────────────────────────
-- As mesmas funções de antes, com o caminho novo: o link do resumo semanal leva a /pt/alumia/avisos, e a ponte da página
-- /denunciar reconhece um post pelos dois caminhos (/comunidade/p/<id>, dos links antigos, e /alumia/p/<id>).
create or replace function interno.rede3_aviso_resumo(p_usuario uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  r record; v_n integer := 0; v_linhas text := ''; v_titulos text := ''; v_lista text[] := '{}'; v_t text;
begin
  for r in select g.tipo, sum(g.total)::integer as n from interno.rede3_aviso_grupos(p_usuario, now() - interval '7 days') g where not g.lido group by g.tipo order by 2 desc loop
    v_n := v_n + r.n;
    v_linhas := v_linhas || format(E'- %s %s\n', r.n, case coalesce(r.tipo, '')
      when 'resposta' then case when r.n = 1 then 'resposta' else 'respostas' end
      when 'mencao' then case when r.n = 1 then 'menção' else 'menções' end
      when 'citacao' then case when r.n = 1 then 'citação' else 'citações' end
      when 'seguidor' then case when r.n = 1 then 'novo seguidor' else 'novos seguidores' end
      when 'apoio' then case when r.n = 1 then 'apoio' else 'apoios' end
      when 'chamado' then case when r.n = 1 then 'novidade em chamado' else 'novidades em chamados' end
      when 'nucleo' then case when r.n = 1 then 'novidade em núcleo' else 'novidades em núcleos' end
      when 'moderacao' then case when r.n = 1 then 'aviso da moderação' else 'avisos da moderação' end
      else case when r.n = 1 then 'aviso da conta' else 'avisos da conta' end end);
  end loop;
  if v_n = 0 then return null; end if;
  for r in
    select distinct on (g.post) g.post, g.titulo from interno.rede3_aviso_grupos(p_usuario, now() - interval '7 days') g
    join rede_posts p on p.id = g.post
    where not g.lido and g.tipo in ('resposta', 'mencao', 'citacao') and g.titulo is not null
      and interno.rede2_publico(p) = 'internet' and not p.oculto and not p.retido and p.apagado_em is null
    order by g.post limit 5 loop
    v_t := left(interno.sem_link(r.titulo), 80);
    if v_t <> '' then v_lista := v_lista || v_t; end if;
  end loop;
  if cardinality(v_lista) > 0 then
    v_titulos := E'\n\nConversas públicas com novidade:\n' || (select string_agg('- ' || t, E'\n') from unnest(v_lista) t);
  end if;
  return jsonb_build_object('n', v_n, 'assunto', 'Seu resumo da semana na Rede Lúcia',
    'texto', format(E'Nesta semana você teve %s %s na Rede Lúcia:\n%s%s\n\nAbrir os avisos:\n\n%s\n\nVocê recebe este resumo porque ligou, em Avisos → Preferências, a opção "Resumo semanal por e-mail". Ele leva só contagens e títulos de conversas públicas, nunca o texto de um post. Para desligar, entre em Avisos → Preferências.',
      v_n, case when v_n = 1 then 'aviso novo' else 'avisos novos' end, v_linhas, v_titulos, interno.endereco() || '/pt/alumia/avisos'));
end $$;

create or replace function interno.rede3_aviso_resumo_semanal() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_res jsonb; v_n integer := 0; v_email text;
begin
  for r in select f.id from perfis f
           where not f.suspenso and interno.rede3_aviso_pref(f.id, 'resumo', 'email') and exists (select 1 from rede_avisos_prefs p where p.usuario = f.id and p.tipo = 'resumo' and p.canal = 'email' and p.ligado)
           order by f.id limit 2000 loop
    if not interno.rede2_membro(r.id) then continue; end if;
    v_email := lower(coalesce(interno.email_da_conta(r.id), ''));
    if v_email = '' or exists (select 1 from emails e where e.para = v_email and e.tipo = 'rede_resumo' and e.criado_em > now() - interval '6 days') then continue; end if;
    v_res := interno.rede3_aviso_resumo(r.id);
    if v_res is null then continue; end if;
    if interno.email(v_email, 'rede_resumo', v_res ->> 'assunto', v_res ->> 'texto', interno.endereco() || '/pt/alumia/avisos', 1) then v_n := v_n + 1; end if;
  end loop;
  delete from avisos where categoria = 'rede' and lido and criado_em < now() - interval '120 days';
  return v_n;
end $$;

create or replace function interno.rede3_mod_ponte_denuncia() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id text := substring(new.alvo from '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'); x rede_posts; v_cat text;
begin
  if v_id is null or (new.alvo !~ '/(comunidade|alumia)/p/' and new.alvo !~ 'post=') then return new; end if;
  select * into x from rede_posts where id = v_id::uuid;
  if not found or not interno.rede_ve(x, new.autor) or x.autor is not distinct from new.autor then return new; end if;
  v_cat := interno.rede3_mod_categoria(new.motivo);
  if new.autor is not null and exists (select 1 from rede_denuncias d where d.quem = new.autor and d.alvo_tipo = 'post' and d.alvo = v_id and d.situacao in ('aberta', 'em_analise')) then return new; end if;
  insert into rede_denuncias (alvo_tipo, alvo, categoria, prioridade, texto, quem) values ('post', v_id, v_cat, interno.rede2_prioridade(v_cat), left(new.detalhes, 2000), new.autor);
  return new;
exception when others then
  return new;
end $$;

-- ═══════════════════════════ fim da F0 ═══════════════════════════
