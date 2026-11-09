-- ───────────────────────── Back-end novo, parte 1 (Etapa 8), novembro de 2026 ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Ainda NÃO está no install.sql (a integração junta;
-- rode DEPOIS do install.sql, porque este arquivo troca interno.limite por uma versão que lê os limites ajustados).
-- Texto do pacote: docs/backend-1.md.
--
-- Itens (cada um com função SQL, tela em components/painel/BackendUm.tsx e teste em scripts/testar-backend-1.mjs):
--   1. recursos ligados sem publicar de novo           public.recursos_lidos / recursos_estado / recurso_ajustar
--   2. confirmação de segunda pessoa                    public.confirmacoes_listar / confirmacao_decidir / confirmacao_cancelar
--   3. zerar segundo fator e aparelhos                  public.zerar_2fa_pedir / zerar_aparelhos_pedir
--   4. segunda avaliação externa pelo painel            public.avaliacao_externa_estado / avaliacao_externa_pedir
--   5. limites ajustáveis                               public.limites_listar / limite_ajustar / limite_restaurar
--   6. constantes do site no banco                      public.site_constantes_ler / _listar / _gravar
--   7. aula da semana e destaques da home               public.destaques_ler / destaque_* / aula_semana_*
--   8. texto de apresentação da trilha                  public.trilha_apresentacao_*
--   9. editar conteúdo em arquivo (PR no GitHub)        public.conteudo_pode_editar / conteudo_pr_registrar / conteudo_prs_listar
--  10. correções aprovadas aplicadas por PR             public.correcao_propor / correcoes_listar / correcao_decidir / correcao_para_aplicar / correcao_aplicada
--
-- Nenhuma tabela no esquema public; acesso só pelas funções public.* (security definer, search_path = interno, pg_temp).
-- Nenhuma função de interno.* é executável por anon nem authenticated.
-- Privacidade (LGPD, Lei 13.709/2018, art. 6º, III e VII): o PR aberto no GitHub não leva nome de ninguém; guardamos só a conta
-- que pediu, no banco, para o registro de atividades.

-- ───────────────────────── Tabelas ─────────────────────────

/** Catálogo dos recursos do site (a mesma lista de lib/recursos.ts; o teste confere). so_pelo_nome: "todos" não liga. */
create table if not exists interno.recursos_catalogo (
  nome text primary key check (nome ~ '^[a-z0-9-]{2,40}$'),
  so_pelo_nome boolean not null default false
);
insert into interno.recursos_catalogo (nome, so_pelo_nome) values
  ('meu-estudo', false), ('exercicios', false), ('revisoes', false), ('turma', false), ('professores', false),
  ('mapa-curricular', false), ('nivelamento', false), ('metas', false), ('vlibras', false), ('ajudou', false),
  ('guia-contribuir', false), ('pratica-sem-placar', false), ('enem-video', false), ('enem-curso', false),
  ('escola', true), ('vale-o-escrito', true), ('rede-v2', true),
  ('turmas', false), -- em pausa (T08): "todos" não liga (lib/recursos.ts, EM_PAUSA); ligar pelo painel vale na hora
  ('assistente-publico', false), -- T03: o assistente em todo o site, sem conta (app/api/assistente); ligado por padrão
  ('fediverso-total', true), ('fediverso-grupos', true) -- Alumia mesclada ao Fediverso (PLANO-FEDIVERSO): só pelo nome, desligadas
on conflict (nome) do update set so_pelo_nome = excluded.so_pelo_nome;

/** O que a coordenação decidiu pelo painel. Linha existe = decisão explícita (ligado true liga, false desliga). */
create table if not exists interno.recursos_vivos (
  nome text primary key references interno.recursos_catalogo (nome) on delete cascade,
  ligado boolean not null,
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

/** Pedidos que esperam uma segunda pessoa da coordenação (ou da vice-coordenação). */
create table if not exists interno.confirmacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('recurso', 'zerar_2fa', 'zerar_aparelhos', 'avaliacao_externa')),
  alvo text not null default '' check (char_length(alvo) <= 80),
  motivo text not null default '' check (char_length(motivo) <= 500),
  pedido_por uuid references interno.perfis (id) on delete set null,
  pedido_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '48 hours',
  status text not null default 'aguardando' check (status in ('aguardando', 'confirmada', 'recusada', 'cancelada', 'expirada')),
  decidido_por uuid references interno.perfis (id) on delete set null,
  decidido_em timestamptz
);
create index if not exists confirmacoes_status on interno.confirmacoes (status, pedido_em desc);

/** Limites ajustados pela coordenação. Sem linha, vale o que o código da função pede. */
create table if not exists interno.limites_config (
  acao text primary key check (acao ~ '^[a-z0-9_]{2,60}$'),
  maximo integer not null check (maximo between 1 and 5000),
  minutos integer not null check (minutos between 1 and 1440),
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

/** Constantes do site: só as chaves conhecidas (interno.site_constantes_modelo). */
create table if not exists interno.site_constantes (
  chave text primary key check (chave ~ '^[a-z_]{2,40}$'),
  valor text not null check (char_length(valor) <= 300),
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

/** Destaques da home: até 6 posições, apontando para páginas do próprio site. */
create table if not exists interno.destaques_home (
  posicao smallint primary key check (posicao between 1 and 6),
  caminho text not null check (caminho ~ '^/[a-z0-9/_-]{1,160}$'),
  titulo text not null check (char_length(titulo) between 3 and 120),
  resumo text not null default '' check (char_length(resumo) <= 240),
  ate date,
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

/** Aula da semana escolhida à mão (a semana é o número usado em lib/lambe-do-dia.ts). Sem linha, o site sorteia como sempre. */
create table if not exists interno.aula_semana (
  semana integer primary key check (semana between 1 and 100000),
  trilha text not null check (trilha ~ '^[a-z0-9-]{2,80}$'),
  aula text not null check (aula ~ '^[a-z0-9-]{1,100}$'),
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

/** Texto de apresentação de cada trilha, por idioma. */
create table if not exists interno.trilhas_apresentacao (
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  idioma text not null check (idioma in ('pt', 'en', 'es', 'fr', 'ru', 'zh')),
  texto text not null check (char_length(texto) between 10 and 1200),
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now(),
  primary key (slug, idioma)
);

/** PRs abertos pelo painel (edição de conteúdo em arquivo ou correção aprovada). */
create table if not exists interno.conteudo_prs (
  id uuid primary key default gen_random_uuid(),
  caminho text not null check (caminho ~ '^content/[a-z0-9/_.-]{3,200}$'),
  numero integer not null check (numero > 0),
  url text not null check (url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$'),
  tipo text not null default 'edicao' check (tipo in ('edicao', 'correcao')),
  por uuid references interno.perfis (id) on delete set null,
  em timestamptz not null default now()
);

/** Correções propostas: trocar um trecho exato de um arquivo de conteúdo. Aprovada por OUTRA pessoa e aplicada por PR. */
create table if not exists interno.correcoes_conteudo (
  id uuid primary key default gen_random_uuid(),
  caminho text not null check (caminho ~ '^content/[a-z0-9/_.-]{3,200}[.]md$' and caminho !~ '[.][.]'),
  trecho text not null check (char_length(trecho) between 3 and 2000),
  troca text not null check (char_length(troca) <= 2000),
  motivo text not null default '' check (char_length(motivo) <= 500),
  erro_relatado uuid references interno.erros_relatados (id) on delete set null,
  status text not null default 'proposta' check (status in ('proposta', 'aprovada', 'aplicada', 'recusada')),
  proposta_por uuid references interno.perfis (id) on delete set null,
  proposta_em timestamptz not null default now(),
  decidida_por uuid references interno.perfis (id) on delete set null,
  decidida_em timestamptz,
  nota text not null default '' check (char_length(nota) <= 500),
  pr_url text not null default '' check (pr_url = '' or pr_url ~ '^https://github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/pull/[0-9]+$')
);
create index if not exists correcoes_conteudo_status on interno.correcoes_conteudo (status, proposta_em desc);

do $$
declare t text;
begin
  foreach t in array array['recursos_catalogo', 'recursos_vivos', 'confirmacoes', 'limites_config', 'site_constantes', 'destaques_home', 'aula_semana', 'trilhas_apresentacao', 'conteudo_prs', 'correcoes_conteudo'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on interno.%I from anon, authenticated', t); end if;
  end loop;
end $$;

-- ───────────────────────── Funções internas ─────────────────────────

/** As constantes que o painel pode mudar, com o tipo de cada uma. O site continua com o valor de lib/site.ts enquanto não houver linha. */
create or replace function interno.site_constantes_modelo() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'apoio_url', 'https',
    'instagram_usuario', 'usuario',
    'contato_email', 'email',
    'historico_desde', 'data')
$$;

/** Confere o valor de uma constante conforme o tipo dela no modelo. */
create or replace function interno.valida_constante(p_chave text, p_valor text) returns boolean language sql immutable as $$
  select case interno.site_constantes_modelo() ->> p_chave
    when 'https' then p_valor ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]*)?$'
    when 'usuario' then p_valor ~ '^[A-Za-z0-9._]{1,30}$'
    when 'email' then p_valor ~ '^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,120}\.[A-Za-z]{2,}$'
    when 'data' then p_valor ~ '^\d{4}-\d{2}-\d{2}$' and p_valor::date is not null
    else false end
$$;

/** Aplica o efeito de um pedido já confirmado. */
create or replace function interno.executar_confirmacao(c interno.confirmacoes) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_alvo uuid;
begin
  if c.tipo = 'recurso' then
    insert into recursos_vivos (nome, ligado, por) values (c.alvo, true, c.decidido_por)
    on conflict (nome) do update set ligado = true, por = excluded.por, em = now();
    perform interno.registrar('recurso_ligado', c.alvo, jsonb_build_object('confirmada_por_segunda_pessoa', true));
  elsif c.tipo = 'avaliacao_externa' then
    insert into configuracoes (chave, valor) values ('comunidade', jsonb_build_object('avaliacao_externa', true))
    on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
    perform interno.registrar('avaliacao_externa_ligada', '', jsonb_build_object('confirmada_por_segunda_pessoa', true));
  elsif c.tipo in ('zerar_2fa', 'zerar_aparelhos') then
    v_alvo := c.alvo::uuid;
    if c.tipo = 'zerar_2fa' then
      if to_regclass('auth.mfa_factors') is not null then execute 'delete from auth.mfa_factors where user_id = $1' using v_alvo; end if;
      -- Sessões abertas saem junto: quem tinha a senha roubada perde o acesso também.
      if to_regclass('auth.sessions') is not null then execute 'delete from auth.sessions where user_id = $1' using v_alvo; end if;
      perform interno.avisar(v_alvo, 'O segundo fator da sua conta foi zerado pela coordenação (duas pessoas confirmaram). Entre de novo e cadastre o aplicativo autenticador.');
      perform interno.registrar('segundo_fator_zerado', v_alvo::text, '{}'::jsonb);
    else
      delete from aparelhos where usuario = v_alvo;
      perform interno.avisar(v_alvo, 'A lista de aparelhos da sua conta foi zerada pela coordenação. O próximo acesso de cada aparelho será avisado como aparelho novo.');
      perform interno.registrar('aparelhos_zerados', v_alvo::text, '{}'::jsonb);
    end if;
  end if;
end $$;

/** Abre um pedido de segunda pessoa e avisa a liderança. Não deixa dois pedidos iguais abertos. */
create or replace function interno.pedir_confirmacao(p_tipo text, p_alvo text, p_motivo text) returns uuid language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_id uuid;
begin
  update confirmacoes set status = 'expirada' where status = 'aguardando' and expira_em < now();
  select id into v_id from confirmacoes where status = 'aguardando' and tipo = p_tipo and alvo = p_alvo;
  if v_id is not null then perform interno.erro('ja_pedido'); end if;
  insert into confirmacoes (tipo, alvo, motivo, pedido_por) values (p_tipo, p_alvo, p_motivo, v) returning id into v_id;
  perform interno.registrar('confirmacao_pedida', v_id::text, jsonb_build_object('tipo', p_tipo));
  perform interno.avisar_lideranca('Há um pedido esperando a confirmação de uma segunda pessoa (Segurança › Confirmações).', v);
  return v_id;
end $$;

/** Troca interno.limite por uma versão que respeita os limites ajustados. O resto é igual ao do install.sql. */
create or replace function interno.limite(p_acao text, p_maximo integer, p_minutos integer) returns void
language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_max integer := p_maximo;
  v_min integer := p_minutos;
  v_chave text;
  v_janela timestamptz;
  v_total integer;
begin
  select maximo, minutos into v_max, v_min from limites_config where acao = p_acao;
  if not found then v_max := p_maximo; v_min := p_minutos; end if;
  v_chave := p_acao || ':' || coalesce(auth.uid()::text, interno.origem());
  v_janela := to_timestamp(floor(extract(epoch from now()) / (v_min * 60)) * v_min * 60);
  insert into limites (chave, janela, total) values (v_chave, v_janela, 1)
  on conflict (chave, janela) do update set total = limites.total + 1
  returning total into v_total;
  if random() < 0.02 then delete from limites where janela < now() - interval '2 days'; end if;
  if v_total > v_max then perform interno.erro('muitos_pedidos'); end if;
end $$;

/** Quem edita conteúdo: coordenação, vice, curadoria e desenvolvimento. */
create or replace function interno.edita_conteudo() returns boolean language sql stable as $$
  select interno.curador() or interno.tem('desenvolvimento')
$$;

do $$
declare f text;
begin
  foreach f in array array['site_constantes_modelo()', 'valida_constante(text, text)', 'executar_confirmacao(interno.confirmacoes)', 'pedir_confirmacao(text, text, text)', 'edita_conteudo()'] loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
end $$;

-- ───────────────────────── 1. Recursos ligados sem publicar de novo ─────────────────────────

/** Público (o site lê com cache curto): só os nomes. Nunca quem decidiu nem quando. */
create or replace function public.recursos_lidos() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'ligados', coalesce((select jsonb_agg(nome order by nome) from recursos_vivos where ligado), '[]'::jsonb),
    'desligados', coalesce((select jsonb_agg(nome order by nome) from recursos_vivos where not ligado), '[]'::jsonb))
$$;

create or replace function public.recursos_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('recursos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nome', k.nome, 'so_pelo_nome', k.so_pelo_nome, 'decisao', v.ligado, 'em', v.em,
      'aguardando', exists (select 1 from confirmacoes c where c.tipo = 'recurso' and c.alvo = k.nome and c.status = 'aguardando' and c.expira_em > now()))
      order by k.nome)
    from recursos_catalogo k left join recursos_vivos v on v.nome = k.nome), '[]'::jsonb));
end $$;

/**
 * Liga ou desliga um recurso sem publicar de novo. Desligar é sempre imediato. Ligar um recurso comum também. Ligar um dos que só
 * ligam pelo nome (escola, vale-o-escrito, rede-v2) abre um pedido que OUTRA pessoa da coordenação precisa confirmar.
 * p_ligar null apaga a decisão (volta ao que a variável de montagem diz).
 */
create or replace function public.recurso_ajustar(p_nome text, p_ligar boolean, p_motivo text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); k recursos_catalogo; v_id uuid;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('recurso_ajustar', 60, 60);
  select * into k from recursos_catalogo where nome = p_nome;
  if not found then perform interno.erro('invalido:nome'); end if;
  if p_ligar is null then
    delete from recursos_vivos where nome = p_nome;
    perform interno.registrar('recurso_decisao_apagada', p_nome, '{}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;
  if p_ligar and k.so_pelo_nome then
    v_id := interno.pedir_confirmacao('recurso', p_nome, interno.txt(p_motivo, 'motivo', 5, 500));
    return jsonb_build_object('aguardando', true, 'id', v_id);
  end if;
  insert into recursos_vivos (nome, ligado, por) values (p_nome, p_ligar, v)
  on conflict (nome) do update set ligado = excluded.ligado, por = excluded.por, em = now();
  perform interno.registrar(case when p_ligar then 'recurso_ligado' else 'recurso_desligado' end, p_nome, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 2. Confirmação de segunda pessoa ─────────────────────────

create or replace function public.confirmacoes_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  update confirmacoes set status = 'expirada' where status = 'aguardando' and expira_em < now();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'tipo', c.tipo, 'alvo', c.alvo,
      'alvo_nome', case when c.tipo in ('zerar_2fa', 'zerar_aparelhos') then coalesce((select nome from perfis where id = c.alvo::uuid), '') else '' end,
      'motivo', c.motivo, 'pedido_por', coalesce((select nome from perfis where id = c.pedido_por), ''), 'meu', c.pedido_por = v,
      'pedido_em', c.pedido_em, 'expira_em', c.expira_em, 'status', c.status) order by c.pedido_em desc)
    from (select * from confirmacoes order by pedido_em desc limit 60) c), '[]'::jsonb);
end $$;

create or replace function public.confirmacao_decidir(p_id uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c confirmacoes;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into c from confirmacoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'aguardando' then perform interno.erro('ja_decidida'); end if;
  if c.expira_em < now() then
    update confirmacoes set status = 'expirada' where id = p_id;
    perform interno.erro('expirada');
  end if;
  -- A regra inteira: quem pediu não confirma o próprio pedido.
  if c.pedido_por = v then perform interno.erro('segunda_pessoa'); end if;
  c.decidido_por := v;
  update confirmacoes set status = case when p_aceitar then 'confirmada' else 'recusada' end, decidido_por = v, decidido_em = now() where id = p_id;
  if p_aceitar then perform interno.executar_confirmacao(c); end if;
  perform interno.registrar('confirmacao_decidida', p_id::text, jsonb_build_object('tipo', c.tipo, 'aceita', coalesce(p_aceitar, false)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.confirmacao_cancelar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c confirmacoes;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into c from confirmacoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'aguardando' then perform interno.erro('ja_decidida'); end if;
  if c.pedido_por is distinct from v then perform interno.erro('sem_permissao'); end if;
  update confirmacoes set status = 'cancelada', decidido_por = v, decidido_em = now() where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 3. Zerar segundo fator e aparelhos ─────────────────────────

create or replace function interno.pedir_zerar(p_tipo text, p_usuario uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('zerar_pedir', 10, 60);
  if p_usuario is null or not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  -- Quem tem a coordenação ou a vice-coordenação só tem a conta mexida por quem lidera.
  if exists (select 1 from papeis where usuario = p_usuario and papel in ('coordenacao', 'vice')) and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  v_id := interno.pedir_confirmacao(p_tipo, p_usuario::text, interno.txt(p_motivo, 'motivo', 10, 500));
  return jsonb_build_object('aguardando', true, 'id', v_id);
end $$;
revoke all on function interno.pedir_zerar(text, uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.pedir_zerar(text, uuid, text) from anon, authenticated; end if;
end $$;

create or replace function public.zerar_2fa_pedir(p_usuario uuid, p_motivo text) returns jsonb language sql security definer set search_path = interno, pg_temp as $$
  select interno.pedir_zerar('zerar_2fa', p_usuario, p_motivo)
$$;
create or replace function public.zerar_aparelhos_pedir(p_usuario uuid, p_motivo text) returns jsonb language sql security definer set search_path = interno, pg_temp as $$
  select interno.pedir_zerar('zerar_aparelhos', p_usuario, p_motivo)
$$;

/** Pessoas que a coordenação pode escolher para zerar (nome e id; sem e-mail). */
create or replace function public.zerar_pessoas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.nome)
                   from (select id, nome from perfis where exists (select 1 from papeis where usuario = perfis.id) order by nome limit 300) f), '[]'::jsonb);
end $$;

-- ───────────────────────── 4. Segunda avaliação externa pelo painel ─────────────────────────

create or replace function public.avaliacao_externa_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'ligada', coalesce((select (valor ->> 'avaliacao_externa')::boolean from configuracoes where chave = 'comunidade'), false),
    'aguardando', exists (select 1 from confirmacoes where tipo = 'avaliacao_externa' and status = 'aguardando' and expira_em > now()));
end $$;

/**
 * Desligar é imediato. Ligar exige a caixa "a página de privacidade já foi atualizada" (o texto de cada mensagem passa a ir a uma
 * empresa de fora do país: LGPD, art. 33; docs/privacidade-avaliacao-automatica.md) e a confirmação de uma segunda pessoa.
 */
create or replace function public.avaliacao_externa_pedir(p_ligar boolean, p_privacidade_ok boolean default false) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_id uuid;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if not coalesce(p_ligar, false) then
    insert into configuracoes (chave, valor) values ('comunidade', jsonb_build_object('avaliacao_externa', false))
    on conflict (chave) do update set valor = configuracoes.valor || excluded.valor;
    perform interno.registrar('avaliacao_externa_desligada', '', '{}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;
  if p_privacidade_ok is distinct from true then perform interno.erro('invalido:privacidade'); end if;
  v_id := interno.pedir_confirmacao('avaliacao_externa', '', 'Ligar a segunda avaliação externa (privacidade já atualizada).');
  return jsonb_build_object('aguardando', true, 'id', v_id);
end $$;

-- ───────────────────────── 5. Limites ajustáveis ─────────────────────────

create or replace function public.limites_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'ajustados', coalesce((select jsonb_agg(jsonb_build_object('acao', acao, 'maximo', maximo, 'minutos', minutos, 'em', em) order by acao) from limites_config), '[]'::jsonb),
    -- Ações vistas nos últimos 2 dias, com o total de pessoas (agregado, sem identificar ninguém).
    'vistos', coalesce((select jsonb_agg(jsonb_build_object('acao', a.acao, 'pessoas', a.pessoas, 'maior', a.maior) order by a.acao)
                        from (select split_part(chave, ':', 1) acao, count(*) pessoas, max(total) maior from limites group by 1 order by 1 limit 200) a), '[]'::jsonb));
end $$;

create or replace function public.limite_ajustar(p_acao text, p_maximo integer, p_minutos integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_acao, '') !~ '^[a-z0-9_]{2,60}$' then perform interno.erro('invalido:acao'); end if;
  if p_maximo is null or p_maximo not between 1 and 5000 then perform interno.erro('invalido:maximo'); end if;
  if p_minutos is null or p_minutos not between 1 and 1440 then perform interno.erro('invalido:minutos'); end if;
  insert into limites_config (acao, maximo, minutos, por) values (p_acao, p_maximo, p_minutos, v)
  on conflict (acao) do update set maximo = excluded.maximo, minutos = excluded.minutos, por = excluded.por, em = now();
  perform interno.registrar('limite_ajustado', p_acao, jsonb_build_object('maximo', p_maximo, 'minutos', p_minutos));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.limite_restaurar(p_acao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from limites_config where acao = p_acao;
  perform interno.registrar('limite_restaurado', coalesce(p_acao, ''), '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 6. Constantes do site no banco ─────────────────────────

create or replace function public.site_constantes_ler() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) from site_constantes
$$;

create or replace function public.site_constantes_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('modelo', interno.site_constantes_modelo(), 'valores', public.site_constantes_ler());
end $$;

/** p_valor vazio apaga a constante (o site volta ao valor do código). */
create or replace function public.site_constante_gravar(p_chave text, p_valor text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t text := btrim(coalesce(p_valor, ''));
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('site_constante', 60, 60);
  if not (interno.site_constantes_modelo() ? coalesce(p_chave, '')) then perform interno.erro('invalido:chave'); end if;
  if t = '' then
    delete from site_constantes where chave = p_chave;
  else
    if not interno.valida_constante(p_chave, t) then perform interno.erro('invalido:valor'); end if;
    insert into site_constantes (chave, valor, por) values (p_chave, t, v)
    on conflict (chave) do update set valor = excluded.valor, por = excluded.por, em = now();
  end if;
  perform interno.registrar('site_constante', p_chave, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 7. Aula da semana e destaques da home ─────────────────────────

create or replace function public.destaques_ler() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'destaques', coalesce((select jsonb_agg(jsonb_build_object('posicao', posicao, 'caminho', caminho, 'titulo', titulo, 'resumo', resumo) order by posicao)
                           from destaques_home where ate is null or ate >= current_date), '[]'::jsonb),
    'aulas', coalesce((select jsonb_agg(jsonb_build_object('semana', semana, 'trilha', trilha, 'aula', aula) order by semana)
                       from aula_semana where semana >= ((((now() at time zone 'America/Sao_Paulo')::date - date '1970-01-01') + 3) / 7) - 1), '[]'::jsonb))
$$;

create or replace function public.destaques_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'destaques', coalesce((select jsonb_agg(jsonb_build_object('posicao', posicao, 'caminho', caminho, 'titulo', titulo, 'resumo', resumo, 'ate', ate) order by posicao) from destaques_home), '[]'::jsonb),
    'aulas', coalesce((select jsonb_agg(jsonb_build_object('semana', semana, 'trilha', trilha, 'aula', aula) order by semana desc) from (select * from aula_semana order by semana desc limit 30) x), '[]'::jsonb));
end $$;

create or replace function public.destaque_salvar(p_posicao integer, p_caminho text, p_titulo text, p_resumo text default '', p_ate date default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('destaque', 120, 60);
  if p_posicao is null or p_posicao not between 1 and 6 then perform interno.erro('invalido:posicao'); end if;
  if coalesce(p_caminho, '') !~ '^/[a-z0-9/_-]{1,160}$' then perform interno.erro('invalido:caminho'); end if;
  insert into destaques_home (posicao, caminho, titulo, resumo, ate, por)
  values (p_posicao, p_caminho, interno.txt(p_titulo, 'titulo', 3, 120), interno.txt(p_resumo, 'resumo', 0, 240), p_ate, v)
  on conflict (posicao) do update set caminho = excluded.caminho, titulo = excluded.titulo, resumo = excluded.resumo, ate = excluded.ate, por = excluded.por, em = now();
  perform interno.registrar('destaque_salvo', p_posicao::text, jsonb_build_object('caminho', p_caminho));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.destaque_remover(p_posicao integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  delete from destaques_home where posicao = p_posicao;
  perform interno.registrar('destaque_removido', coalesce(p_posicao, 0)::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.aula_semana_definir(p_semana integer, p_trilha text, p_aula text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('aula_semana', 60, 60);
  if p_semana is null or p_semana not between 1 and 100000 then perform interno.erro('invalido:semana'); end if;
  if coalesce(p_trilha, '') !~ '^[a-z0-9-]{2,80}$' or coalesce(p_aula, '') !~ '^[a-z0-9-]{1,100}$' then perform interno.erro('invalido:aula'); end if;
  insert into aula_semana (semana, trilha, aula, por) values (p_semana, p_trilha, p_aula, v)
  on conflict (semana) do update set trilha = excluded.trilha, aula = excluded.aula, por = excluded.por, em = now();
  perform interno.registrar('aula_semana_definida', p_semana::text, jsonb_build_object('trilha', p_trilha, 'aula', p_aula));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.aula_semana_limpar(p_semana integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  delete from aula_semana where semana = p_semana;
  perform interno.registrar('aula_semana_limpa', coalesce(p_semana, 0)::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 8. Texto de apresentação da trilha ─────────────────────────

create or replace function public.trilha_apresentacao_ler(p_slug text, p_idioma text default 'pt') returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select texto from trilhas_apresentacao where slug = p_slug and idioma = p_idioma), '')
$$;

create or replace function public.trilhas_apresentacao_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'idioma', idioma, 'texto', texto, 'em', em) order by slug, idioma) from trilhas_apresentacao), '[]'::jsonb);
end $$;

/** p_texto vazio apaga. */
create or replace function public.trilha_apresentacao_salvar(p_slug text, p_idioma text, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); t text := btrim(coalesce(p_texto, ''));
begin
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('trilha_apresentacao', 60, 60);
  if coalesce(p_slug, '') !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:slug'); end if;
  if p_idioma not in ('pt', 'en', 'es', 'fr', 'ru', 'zh') then perform interno.erro('invalido:idioma'); end if;
  if t = '' then
    delete from trilhas_apresentacao where slug = p_slug and idioma = p_idioma;
  else
    insert into trilhas_apresentacao (slug, idioma, texto, por) values (p_slug, p_idioma, interno.txt(t, 'texto', 10, 1200), v)
    on conflict (slug, idioma) do update set texto = excluded.texto, por = excluded.por, em = now();
  end if;
  perform interno.registrar('trilha_apresentacao', p_slug || '/' || p_idioma, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── 9. Editar conteúdo em arquivo (PR) ─────────────────────────

/** A rota do servidor pergunta antes de abrir o PR: a pessoa pode editar conteúdo e ainda está dentro do ritmo (20 por hora)? */
create or replace function public.conteudo_pode_editar() returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('conteudo_pr', 20, 60);
  return true;
end $$;

create or replace function public.conteudo_pr_registrar(p_caminho text, p_numero integer, p_url text, p_tipo text default 'edicao') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  if p_tipo not in ('edicao', 'correcao') then perform interno.erro('invalido:tipo'); end if;
  insert into conteudo_prs (caminho, numero, url, tipo, por) values (p_caminho, p_numero, p_url, p_tipo, v);
  perform interno.registrar('conteudo_pr_aberto', p_caminho, jsonb_build_object('numero', p_numero, 'tipo', p_tipo));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.conteudo_prs_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'caminho', caminho, 'numero', numero, 'url', url, 'tipo', tipo, 'em', em) order by em desc)
                   from (select * from conteudo_prs order by em desc limit 40) x), '[]'::jsonb);
end $$;

-- ───────────────────────── 10. Correções aprovadas, aplicadas por PR ─────────────────────────

create or replace function public.correcao_propor(p_caminho text, p_trecho text, p_troca text, p_motivo text default '', p_erro uuid default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid;
begin
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('correcao_propor', 60, 60);
  if coalesce(p_caminho, '') !~ '^content/[a-z0-9/_.-]{3,200}[.]md$' or p_caminho like '%//%' or p_caminho like '%..%' or p_caminho !~ '^content/(trilhas|paginas|glossario|professores|contribuir|falacias|debates|memorial)/' or p_caminho ~ '(^|/)[.]' then perform interno.erro('invalido:caminho'); end if;
  if char_length(coalesce(p_trecho, '')) not between 3 and 2000 then perform interno.erro('invalido:trecho'); end if;
  if char_length(coalesce(p_troca, '')) > 2000 or p_troca = p_trecho then perform interno.erro('invalido:troca'); end if;
  insert into correcoes_conteudo (caminho, trecho, troca, motivo, erro_relatado, proposta_por)
  values (p_caminho, p_trecho, p_troca, interno.txt(p_motivo, 'motivo', 0, 500), p_erro, v) returning id into v_id;
  perform interno.registrar('correcao_proposta', v_id::text, jsonb_build_object('caminho', p_caminho));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.correcoes_listar() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.edita_conteudo() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'caminho', c.caminho, 'trecho', c.trecho, 'troca', c.troca, 'motivo', c.motivo, 'status', c.status,
                                                       'minha', c.proposta_por = v, 'proposta_em', c.proposta_em, 'nota', c.nota, 'pr_url', c.pr_url) order by c.proposta_em desc)
                   from (select * from correcoes_conteudo order by proposta_em desc limit 60) c), '[]'::jsonb);
end $$;

/** Aprovar é com a curadoria (ou coordenação) e NUNCA de quem propôs: a segunda pessoa de sempre. */
create or replace function public.correcao_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c correcoes_conteudo;
begin
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  select * into c from correcoes_conteudo where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'proposta' then perform interno.erro('ja_decidida'); end if;
  if c.proposta_por = v then perform interno.erro('segunda_pessoa'); end if;
  update correcoes_conteudo set status = case when p_aprovar then 'aprovada' else 'recusada' end, decidida_por = v, decidida_em = now(), nota = interno.txt(p_nota, 'nota', 0, 500) where id = p_id;
  perform interno.registrar('correcao_decidida', p_id::text, jsonb_build_object('aprovada', coalesce(p_aprovar, false)));
  return jsonb_build_object('ok', true);
end $$;

/** Para a rota do servidor: devolve o que aplicar, só se estiver aprovada e a pessoa for da curadoria. */
create or replace function public.correcao_para_aplicar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c correcoes_conteudo;
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('correcao_aplicar', 30, 60);
  select * into c from correcoes_conteudo where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'aprovada' then perform interno.erro('nao_aprovada'); end if;
  return jsonb_build_object('id', c.id, 'caminho', c.caminho, 'trecho', c.trecho, 'troca', c.troca, 'motivo', c.motivo);
end $$;

create or replace function public.correcao_aplicada(p_id uuid, p_numero integer, p_url text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c correcoes_conteudo;
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  select * into c from correcoes_conteudo where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'aprovada' then perform interno.erro('nao_aprovada'); end if;
  update correcoes_conteudo set status = 'aplicada', pr_url = p_url where id = p_id;
  insert into conteudo_prs (caminho, numero, url, tipo, por) values (c.caminho, p_numero, p_url, 'correcao', auth.uid());
  perform interno.registrar('correcao_aplicada', p_id::text, jsonb_build_object('numero', p_numero));
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── Permissões das funções public.* ─────────────────────────

do $$
declare f text;
begin
  -- Quem lê sem conta (o site): só as de leitura pública.
  foreach f in array array['recursos_lidos()', 'site_constantes_ler()', 'destaques_ler()', 'trilha_apresentacao_ler(text, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('grant execute on function public.%s to anon, authenticated', f); end if;
  end loop;
  -- Quem entrou na conta: o próprio corpo da função confere o papel.
  foreach f in array array[
    'recursos_estado()', 'recurso_ajustar(text, boolean, text)',
    'confirmacoes_listar()', 'confirmacao_decidir(uuid, boolean)', 'confirmacao_cancelar(uuid)',
    'zerar_2fa_pedir(uuid, text)', 'zerar_aparelhos_pedir(uuid, text)', 'zerar_pessoas()',
    'avaliacao_externa_estado()', 'avaliacao_externa_pedir(boolean, boolean)',
    'limites_listar()', 'limite_ajustar(text, integer, integer)', 'limite_restaurar(text)',
    'site_constantes_listar()', 'site_constante_gravar(text, text)',
    'destaques_listar()', 'destaque_salvar(integer, text, text, text, date)', 'destaque_remover(integer)', 'aula_semana_definir(integer, text, text)', 'aula_semana_limpar(integer)',
    'trilhas_apresentacao_listar()', 'trilha_apresentacao_salvar(text, text, text)',
    'conteudo_pode_editar()', 'conteudo_pr_registrar(text, integer, text, text)', 'conteudo_prs_listar()',
    'correcao_propor(text, text, text, text, uuid)', 'correcoes_listar()', 'correcao_decidir(uuid, boolean, text)', 'correcao_para_aplicar(uuid)', 'correcao_aplicada(uuid, integer, text)'] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated', f);
    end if;
  end loop;
end $$;
