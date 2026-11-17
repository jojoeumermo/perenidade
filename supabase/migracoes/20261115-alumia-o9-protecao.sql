-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 9 · Proteção contra ataque (15/11/2026) ═══════════════════════════
-- O que a pessoa usa quando vira alvo de ataque em massa (telas em components/rede/protecao/):
--
--   1. Modo protegido por um tempo (blindagem): por 24 horas ou 7 dias, só quem a pessoa SEGUE responde aos posts dela, menciona
--      e cita. Liga com um toque e desliga sozinho no fim do prazo (ou antes, quando ela quiser). A regra vale no banco, para
--      qualquer caminho que grave uma resposta, uma citação ou uma menção (gatilhos), e não só na tela.
--   2. Restringir em vez de bloquear, com a troca por princípio (backlog, "Trocas por princípio" 6): a pessoa restrita continua
--      respondendo, mas a resposta dela numa conversa de quem restringiu fica recolhida como "aguardando a dona da conversa". Quem
--      escreveu vê a própria resposta com essa marca; quem restringiu abre com um toque e pode liberá-la; para as outras pessoas
--      a resposta sai do fio, sem marca (ninguém de fora deduz quem restringiu quem). A tela não engana quem escreveu. As
--      menções, citações e respostas da restrita não viram aviso, e a resposta recolhida não vira aviso para ninguém.
--   3. Desvincular citação: quem foi citada solta o próprio post da citação de outra pessoa. A citação continua existindo sem o
--      post dentro, e a mesma pessoa não cita aquele post de novo.
--   4. Quem pode me mencionar (todos, quem eu sigo, ninguém): a menção de quem não pode continua sendo texto, mas não vira aviso
--      nem entra na lista de menções da pessoa.
--   5. Marcações em post com imagem que só aparecem depois do aceite: padrão "ninguém me marca" e, para quem abrir, "aprovar antes
--      de aparecer" ligado. Proibido em post de ato (a foto do ato com nome é risco; backlog, troca 7). Sem reconhecimento facial.
--
-- O aviso de link suspeito (lista aberta de padrões no aparelho, sem consultar serviço de fora) não usa o banco:
-- components/rede/protecao/link-suspeito.ts.
--
-- Cuidado: esta migração NÃO redefine
-- interno.rede_ve nem as leituras de post. A regra fica em funções próprias:
--   - interno.rede_o9_protecao_permite(alvo, quem, acao): pode responder / citar / mencionar / marcar? Já chamada pelos gatilhos
--     daqui; quem compuser rede_ve e vizinhas pode chamá-la também (por exemplo, para esconder o botão Responder).
--   - interno.rede_o9_recolhida(post, quem): a resposta está recolhida PARA ESTA pessoa? As leituras (rede_post_v2 e a árvore da
--     conversa) devem trocar o texto por nada e mandar "aguardando": true quando ela disser sim. Até isso ser composto, a tela
--     marca a resposta com o carimbo "aguardando" (components/rede/protecao/), mas o texto ainda chega a quem lê.
--
-- Tudo no esquema interno, RLS ligada sem políticas, acesso só por função security definer com search_path fixo; toda função
-- pública passa pela porta da entrada (interno.alumia_trancar no fim). Nenhum endereço de rede, nenhuma lista de quem fez o quê:
-- a lista de restritos é só da própria pessoa, como a de bloqueados. Idempotente (scripts/testar-alumia-o9-protecao.mjs roda duas
-- vezes no banco local). NÃO rodar em produção sem o Jonathan.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- As escolhas de proteção da pessoa. Sem linha = o padrão (todos mencionam, ninguém marca, aprovar marcação, sem blindagem).
create table if not exists interno.rede_o9_prefs (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  mencao_quem text not null default 'todos' check (mencao_quem in ('todos', 'seguindo', 'ninguem')),
  marcar_quem text not null default 'ninguem' check (marcar_quem in ('todos', 'seguindo', 'ninguem')),
  marcar_aprovar boolean not null default true,
  blindagem_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

-- Quem a pessoa restringiu. Só ela lê (rede_o9_restritos); ninguém de fora sabe: a resposta recolhida sai do fio para terceiros
-- e visitantes, sem carimbo (20261115-alumia-onda9-fim.sql, rede2_pode_ver). A restrita vê o "aguardando" na própria resposta
-- (troca por princípio 6: a tela não engana quem escreveu).
create table if not exists interno.rede_o9_restritos (
  quem uuid not null references interno.perfis (id) on delete cascade,
  restrito uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (quem, restrito),
  check (quem <> restrito)
);
create index if not exists rede_o9_restritos_restrito on interno.rede_o9_restritos (restrito);

-- Respostas de restrita que quem restringiu liberou (passam a aparecer como qualquer outra). Só o id da resposta e a data.
create table if not exists interno.rede_o9_liberadas (
  resposta uuid primary key references interno.rede_posts (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Citações desvinculadas: o post que citava, o post que foi solto e quem citou (para não citar de novo o mesmo post).
create table if not exists interno.rede_o9_soltas (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  citado uuid not null references interno.rede_posts (id) on delete cascade,
  quem uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists rede_o9_soltas_citado on interno.rede_o9_soltas (citado, quem);

-- Marcações em post com imagem: 'pendente' (esperando o aceite), 'aprovada' (aparece) ou 'recusada' (não aparece e não se refaz).
create table if not exists interno.rede_o9_marcacoes (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  marcado uuid not null references interno.perfis (id) on delete cascade,
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'recusada')),
  criado_em timestamptz not null default now(),
  primary key (post, marcado)
);
create index if not exists rede_o9_marcacoes_marcado on interno.rede_o9_marcacoes (marcado, estado, criado_em desc);

-- O aviso de marcação ('marcacao', previsto no contrato da onda 5): a regra dos tipos de aviso é refeita a partir da que está no
-- banco, só acrescentando, para não tirar tipo de ninguém (o mesmo jeito das outras frentes).
do $$
declare v_def text; v_tipos text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conrelid = 'interno.avisos'::regclass and conname = 'avisos_tipo';
  if v_def is null then return; end if;
  -- A regra aparece de dois jeitos: tipo = any ('{a,b}'::text[]) ou tipo in ('a', 'b'). Lê os dois.
  select coalesce(array_agg(distinct x), '{}') into v_tipos from (
    select unnest(string_to_array(m[1], ',')) as x from regexp_matches(v_def, '''\{([a-z_,]*)\}''', 'g') m
    union all
    select m[1] from regexp_matches(v_def, '''([a-z_]+)''', 'g') m) z
  where x <> '';
  if 'marcacao' = any (v_tipos) then return; end if;
  -- Leitura que não achou os tipos de sempre: não mexe (melhor sem o aviso de marcação do que sem os outros).
  if not v_tipos @> array['resposta', 'mencao', 'citacao'] then return; end if;
  v_tipos := array(select distinct unnest(v_tipos || array['marcacao']) order by 1);
  alter table interno.avisos drop constraint if exists avisos_tipo;
  execute format('alter table interno.avisos add constraint avisos_tipo check (tipo is null or tipo = any (%L::text[]))', v_tipos);
end $$;

alter table interno.rede_o9_prefs enable row level security;
alter table interno.rede_o9_restritos enable row level security;
alter table interno.rede_o9_liberadas enable row level security;
alter table interno.rede_o9_soltas enable row level security;
alter table interno.rede_o9_marcacoes enable row level security;
revoke all on table interno.rede_o9_prefs, interno.rede_o9_restritos, interno.rede_o9_liberadas, interno.rede_o9_soltas, interno.rede_o9_marcacoes from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_o9_prefs, interno.rede_o9_restritos, interno.rede_o9_liberadas, interno.rede_o9_soltas, interno.rede_o9_marcacoes
      from anon, authenticated;
  end if;
end $$;

-- ── 2. A regra ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem segue DE FATO (o pedido ainda pendente para um perfil trancado não conta). */
create or replace function interno.rede_o9_segue(p_quem uuid, p_segue uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_segue is not null
     and exists (select 1 from rede_seguindo s where s.quem = p_quem and s.segue = p_segue and not s.pendente)
$$;

/** A blindagem desta pessoa está valendo agora? */
create or replace function interno.rede_o9_blindada(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_usuario is not null and coalesce((select f.blindagem_ate > now() from rede_o9_prefs f where f.usuario = p_usuario), false)
$$;

/** p_quem restringiu p_alvo? */
create or replace function interno.rede_o9_restringiu(p_quem uuid, p_alvo uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_alvo is not null and exists (select 1 from rede_o9_restritos r where r.quem = p_quem and r.restrito = p_alvo)
$$;

/**
 * A regra de proteção, num lugar só: p_quem pode `p_acao` ('responder', 'citar', 'mencionar', 'marcar') em relação a p_alvo (a dona
 * do post, a mencionada ou a marcada)? A própria pessoa sempre pode; sem uma das duas (conta apagada, chegada de fora), a regra não
 * se aplica aqui. Com a blindagem valendo, só quem p_alvo segue. Mencionar segue a escolha de quem é mencionada; marcar, a de quem
 * é marcada (padrão: ninguém). A restrita não menciona nem marca (a menção dela não vira aviso); responder e citar ela pode (a
 * resposta fica recolhida, ver interno.rede_o9_recolhida).
 */
create or replace function interno.rede_o9_protecao_permite(p_alvo uuid, p_quem uuid, p_acao text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f rede_o9_prefs; v_escolha text;
begin
  if p_alvo is null or p_quem is null or p_alvo = p_quem then return true; end if;
  if p_acao not in ('responder', 'citar', 'mencionar', 'marcar') then return false; end if;
  select * into f from rede_o9_prefs where usuario = p_alvo;
  if f.blindagem_ate > now() and not interno.rede_o9_segue(p_alvo, p_quem) then return false; end if;
  if p_acao in ('responder', 'citar') then return true; end if;
  if interno.rede_o9_restringiu(p_alvo, p_quem) then return false; end if;
  v_escolha := case p_acao when 'mencionar' then coalesce(f.mencao_quem, 'todos') else coalesce(f.marcar_quem, 'ninguem') end;
  return case v_escolha when 'todos' then true when 'seguindo' then interno.rede_o9_segue(p_alvo, p_quem) else false end;
end $$;

/**
 * As donas que deixam esta resposta "aguardando": quem abriu a conversa e quem escreveu o post respondido, se restringiram a autora
 * da resposta. Vazio quando a resposta já foi liberada, quando não é resposta ou quando ninguém restringiu.
 */
create or replace function interno.rede_o9_donas(p interno.rede_posts) returns uuid[] language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(array_agg(distinct d.dona) filter (where d.dona is not null), '{}'::uuid[])
  from (
    select o.autor as dona from rede_posts o where o.id = p.resposta_a
    union all
    select r.autor from rede_posts r where r.id = coalesce(p.root_id, p.resposta_a)
  ) d
  where p.resposta_a is not null and p.autor is not null
    and not exists (select 1 from rede_o9_liberadas l where l.resposta = p.id)
    and d.dona is distinct from p.autor
    and interno.rede_o9_restringiu(d.dona, p.autor)
$$;

/** Esta resposta está aguardando (para alguém)? */
create or replace function interno.rede_o9_aguardando(p interno.rede_posts) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select cardinality(interno.rede_o9_donas(p)) > 0
$$;

/**
 * A resposta fica recolhida PARA ESTA pessoa? Sim quando está aguardando e quem lê não é quem escreveu, não é uma das donas e não
 * cuida do post (a mediação continua vendo tudo). É esta a função que as leituras de post chamam na junção.
 */
create or replace function interno.rede_o9_recolhida(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_o9_aguardando(p)
     and p_quem is distinct from p.autor
     and not coalesce(p_quem = any (interno.rede_o9_donas(p)), false)
     and not coalesce(interno.rede3_conv_modera(p, p_quem), false)
$$;

-- ── 3. Os gatilhos (a regra vale para qualquer caminho) ───────────────────────────────────────────────────────────────────

/** Responder: com a blindagem de quem abriu a conversa ou de quem escreveu o post respondido, só quem ela segue. */
create or replace function interno.rede_o9_resposta_confere() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_pai uuid; v_raiz uuid;
begin
  if new.resposta_a is null or new.autor is null then return new; end if;
  select o.autor, r.autor into v_pai, v_raiz
  from rede_posts o left join rede_posts r on r.id = coalesce(o.root_id, o.id)
  where o.id = new.resposta_a;
  if not interno.rede_o9_protecao_permite(v_pai, new.autor, 'responder') or not interno.rede_o9_protecao_permite(v_raiz, new.autor, 'responder') then
    perform interno.erro('protegido');
  end if;
  return new;
end $$;
drop trigger if exists rede_o9_resposta_confere on interno.rede_posts;
create trigger rede_o9_resposta_confere before insert on interno.rede_posts for each row execute function interno.rede_o9_resposta_confere();

/** Citar: a blindagem de quem é citada vale, e quem teve a citação desvinculada não cita de novo o mesmo post. */
create or replace function interno.rede_o9_citar_confere() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_autor uuid;
begin
  if new.quote_of is null or new.autor is null then return new; end if;
  if tg_op = 'UPDATE' and new.quote_of is not distinct from old.quote_of then return new; end if;
  select autor into v_autor from rede_posts where id = new.quote_of;
  if not interno.rede_o9_protecao_permite(v_autor, new.autor, 'citar') then perform interno.erro('protegido'); end if;
  if exists (select 1 from rede_o9_soltas s where s.citado = new.quote_of and s.quem = new.autor) then perform interno.erro('citacao_solta'); end if;
  return new;
end $$;
drop trigger if exists rede_o9_citar_confere on interno.rede_posts;
create trigger rede_o9_citar_confere before insert or update of quote_of on interno.rede_posts for each row execute function interno.rede_o9_citar_confere();

/**
 * Mencionar: a linha de rede_mencoes só nasce (e só então o aviso sai, ver interno.rede3_conv_mencionar) quando a regra deixa.
 * Quando não deixa, a menção continua no texto do post, sem aviso e fora da lista de menções da pessoa.
 */
create or replace function interno.rede_o9_mencao_filtro() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_autor uuid;
begin
  select autor into v_autor from rede_posts where id = new.post;
  if not interno.rede_o9_protecao_permite(new.mencionado, v_autor, 'mencionar') then return null; end if;
  return new;
end $$;
drop trigger if exists rede_o9_mencao_filtro on interno.rede_mencoes;
create trigger rede_o9_mencao_filtro before insert on interno.rede_mencoes for each row execute function interno.rede_o9_mencao_filtro();

/**
 * Avisos: resposta, menção, citação e conversa seguida que vêm de quem a pessoa restringiu não chegam. E a resposta recolhida
 * (aguardando a dona) não vira aviso para ninguém: o texto dela não pode sair por fora do fio, pela menção a uma terceira pessoa
 * ou pela conversa seguida.
 */
create or replace function interno.rede_o9_aviso_filtro() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  if new.categoria = 'rede' and new.tipo in ('resposta', 'mencao', 'citacao', 'conversa_seguida') then
    if new.ator is not null and interno.rede_o9_restringiu(new.para, new.ator) then
      return null;
    end if;
    if new.post is not null then
      select * into x from rede_posts where id = new.post;
      if found and x.resposta_a is not null and x.autor is distinct from new.para and interno.rede_o9_aguardando(x) then
        return null;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists rede_o9_aviso_filtro on interno.avisos;
create trigger rede_o9_aviso_filtro before insert on interno.avisos for each row execute function interno.rede_o9_aviso_filtro();

-- ── 4. As escolhas da pessoa ──────────────────────────────────────────────────────────────────────────────────────────────

/** A conta pode usar a proteção? (Membro da Alumia, com idade confirmada.) Devolve quem chama. */
create or replace function interno.rede_o9_eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  return v;
end $$;

/**
 * A situação da proteção de quem chama: blindagem (até quando, ou nulo), as escolhas de menção e de marcação, quantas pessoas
 * ela restringiu e quantas marcações esperam o aceite dela. Tudo dela mesma.
 */
create or replace function public.rede_o9_protecao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); f rede_o9_prefs;
begin
  select * into f from rede_o9_prefs where usuario = v;
  return jsonb_build_object(
    'blindagem_ate', case when f.blindagem_ate > now() then f.blindagem_ate end,
    'mencao_quem', coalesce(f.mencao_quem, 'todos'),
    'marcar_quem', coalesce(f.marcar_quem, 'ninguem'),
    'marcar_aprovar', coalesce(f.marcar_aprovar, true),
    'restritos', (select count(*)::integer from rede_o9_restritos r where r.quem = v),
    'marcacoes_pendentes', (select count(*)::integer from rede_o9_marcacoes m join rede_posts p on p.id = m.post
                             where m.marcado = v and m.estado = 'pendente' and p.apagado_em is null));
end $$;

/** Liga a blindagem por 24 ou 168 horas (7 dias), a contar de agora; 0 desliga. Devolve {blindagem_ate}. */
create or replace function public.rede_o9_blindagem(p_horas integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); v_ate timestamptz;
begin
  if p_horas is null or p_horas not in (0, 24, 168) then perform interno.erro('invalido:horas'); end if;
  perform interno.rede2_limite('editar');
  v_ate := case when p_horas = 0 then null else now() + make_interval(hours => p_horas) end;
  insert into rede_o9_prefs (usuario, blindagem_ate) values (v, v_ate)
  on conflict (usuario) do update set blindagem_ate = excluded.blindagem_ate, atualizado_em = now();
  return jsonb_build_object('blindagem_ate', v_ate);
end $$;

/** Muda as escolhas: p.mencao_quem e p.marcar_quem ('todos' | 'seguindo' | 'ninguem'), p.marcar_aprovar (sim/não). */
create or replace function public.rede_o9_preferir(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); f rede_o9_prefs;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:pedido'); end if;
  if p ? 'mencao_quem' and coalesce(p ->> 'mencao_quem', '') not in ('todos', 'seguindo', 'ninguem') then perform interno.erro('invalido:mencao_quem'); end if;
  if p ? 'marcar_quem' and coalesce(p ->> 'marcar_quem', '') not in ('todos', 'seguindo', 'ninguem') then perform interno.erro('invalido:marcar_quem'); end if;
  if p ? 'marcar_aprovar' and jsonb_typeof(p -> 'marcar_aprovar') is distinct from 'boolean' then perform interno.erro('invalido:marcar_aprovar'); end if;
  perform interno.rede2_limite('editar');
  insert into rede_o9_prefs (usuario) values (v) on conflict (usuario) do nothing;
  update rede_o9_prefs set
    mencao_quem = coalesce(p ->> 'mencao_quem', mencao_quem),
    marcar_quem = coalesce(p ->> 'marcar_quem', marcar_quem),
    marcar_aprovar = coalesce((p ->> 'marcar_aprovar')::boolean, marcar_aprovar),
    atualizado_em = now()
  where usuario = v
  returning * into f;
  return jsonb_build_object('mencao_quem', f.mencao_quem, 'marcar_quem', f.marcar_quem, 'marcar_aprovar', f.marcar_aprovar);
end $$;

-- ── 5. Restringir ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Restringe (p_sim) ou deixa de restringir uma pessoa pelo @. Ninguém é avisado. Não vale para si mesma; até 1.000 por conta.
 * Devolve {restrita}.
 */
create or replace function public.rede_o9_restringir(p_handle text, p_sim boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); v_alvo uuid;
begin
  select id into v_alvo from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null then perform interno.erro('nao_encontrado'); end if;
  if v_alvo = v then perform interno.erro('invalido:propria'); end if;
  perform interno.rede2_limite('editar');
  if not coalesce(p_sim, true) then
    delete from rede_o9_restritos where quem = v and restrito = v_alvo;
    return jsonb_build_object('restrita', false);
  end if;
  if not exists (select 1 from rede_o9_restritos where quem = v and restrito = v_alvo)
     and (select count(*) from rede_o9_restritos where quem = v) >= 1000 then
    perform interno.erro('invalido:muitas');
  end if;
  insert into rede_o9_restritos (quem, restrito) values (v, v_alvo) on conflict do nothing;
  return jsonb_build_object('restrita', true);
end $$;

/** A lista de quem a própria pessoa restringiu (@, codinome e desde quando), da mais recente para a mais antiga. Até 200. */
create or replace function public.rede_o9_restritos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'codinome', interno.rede_nome(f.id), 'desde', r.criado_em)
            order by r.criado_em desc, f.rede_handle), '[]'::jsonb)
          from (select * from rede_o9_restritos where quem = v order by criado_em desc limit 200) r join perfis f on f.id = r.restrito);
end $$;

/**
 * Quem pode liberar (ou recolher de novo) esta resposta: quem abriu a conversa ou escreveu o post respondido E restringiu a
 * autora. Vale com a resposta já liberada (para poder voltar atrás).
 */
create or replace function interno.rede_o9_pode_liberar(p interno.rede_posts, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p.resposta_a is not null and p.autor is distinct from p_quem
     and interno.rede_o9_restringiu(p_quem, p.autor)
     and exists (select 1 from rede_posts o where o.id in (p.resposta_a, coalesce(p.root_id, p.resposta_a)) and o.autor = p_quem)
$$;

/** Uma dona libera (p_sim) ou recolhe de novo uma resposta de quem ela restringiu. Devolve {liberada}. */
create or replace function public.rede_o9_liberar(p_resposta uuid, p_sim boolean default true) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); x rede_posts;
begin
  select * into x from rede_posts where id = p_resposta;
  if not found or x.apagado_em is not null or x.resposta_a is null or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_o9_pode_liberar(x, v) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('editar');
  if coalesce(p_sim, true) then
    insert into rede_o9_liberadas (resposta) values (x.id) on conflict do nothing;
  else
    delete from rede_o9_liberadas where resposta = x.id;
  end if;
  return jsonb_build_object('liberada', coalesce(p_sim, true));
end $$;

/**
 * As respostas recolhidas de uma conversa PARA QUEM PERGUNTA (pelo id de qualquer post dela): {ids, dona}. `dona` diz se quem
 * pergunta abriu a conversa. Serve à tela da conversa para tirar do fio o que está aguardando (a quem junta: o mesmo lugar onde
 * entra rede_roda_ocultas). Visitante e quem não vê a conversa: lista vazia.
 */
create or replace function public.rede_o9_aguardando_na_conversa(p_post uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; r rede_posts;
begin
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, v) then return jsonb_build_object('ids', '[]'::jsonb, 'dona', false); end if;
  r := interno.rede3_conv_raiz(x);
  if r.id is null or not interno.rede_ve(r, v) then return jsonb_build_object('ids', '[]'::jsonb, 'dona', false); end if;
  return jsonb_build_object(
    'ids', (select coalesce(jsonb_agg(p.id order by p.criado_em, p.id), '[]'::jsonb)
            from rede_posts p
            where coalesce(p.root_id, p.id) = r.id and p.id <> r.id and p.apagado_em is null and interno.rede_ve(p, v) and interno.rede_o9_recolhida(p, v)),
    'dona', v is not null and r.autor = v);
end $$;

-- ── 6. Desvincular citação ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Quem foi citada solta o próprio post da citação p_post (de outra pessoa). A citação continua no ar, sem o post dentro; quem citou
 * não cita aquele post de novo. Devolve {solta}.
 */
create or replace function public.rede_o9_citacao_soltar(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); x rede_posts; o rede_posts;
begin
  select * into x from rede_posts where id = p_post for update;
  if not found or x.apagado_em is not null or not interno.rede_ve(x, v) then perform interno.erro('nao_encontrado'); end if;
  if x.quote_of is null then
    if exists (select 1 from rede_o9_soltas s join rede_posts c on c.id = s.citado where s.post = x.id and c.autor = v) then
      return jsonb_build_object('solta', true);
    end if;
    perform interno.erro('nao_encontrado');
  end if;
  select * into o from rede_posts where id = x.quote_of;
  if o.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if x.autor = v then perform interno.erro('invalido:propria'); end if;
  perform interno.rede2_limite('editar');
  insert into rede_o9_soltas (post, citado, quem) values (x.id, o.id, x.autor) on conflict (post) do nothing;
  update rede_posts set quote_of = null where id = x.id;
  return jsonb_build_object('solta', true);
end $$;

-- ── 7. Marcações ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A autora marca uma pessoa (pelo @) no próprio post com imagem. Recusa: post de ato (o post do ato, ou ligado a um ato), post sem
 * imagem, resposta, mais de 10 marcações, pessoa que não aceita marcação de quem marca (a escolha dela; padrão ninguém), bloqueio
 * e quem não pode ver o post. Nasce 'pendente' (a pessoa aprova) ou, se ela desligou "aprovar antes", 'aprovada'. Devolve {estado}.
 */
create or replace function public.rede_o9_marcar(p_post uuid, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); x rede_posts; v_alvo uuid; v_estado text; v_aprovar boolean;
begin
  select * into x from rede_posts where id = p_post;
  if not found or x.apagado_em is not null or x.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if x.resposta_a is not null then perform interno.erro('invalido:resposta'); end if;
  if x.chamado is not null or x.ato is not null or exists (select 1 from rede_chamados c where c.post = x.id) then perform interno.erro('marcar_ato'); end if;
  if not exists (select 1 from rede_midia m where m.post = x.id) then perform interno.erro('invalido:sem_imagem'); end if;
  select id into v_alvo from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null then perform interno.erro('nao_encontrado'); end if;
  if v_alvo = v then perform interno.erro('invalido:propria'); end if;
  if exists (select 1 from rede_o9_marcacoes where post = x.id and marcado = v_alvo) then
    -- Já marcada (ou recusou): não se refaz. A tela não diz qual dos dois, para não pressionar quem recusou.
    return jsonb_build_object('estado', 'feita');
  end if;
  if interno.rede_bloqueado(v, v_alvo) or not interno.rede2_membro(v_alvo) or not interno.rede_ve(x, v_alvo)
     or not interno.rede_o9_protecao_permite(v_alvo, v, 'marcar') then
    perform interno.erro('marcar_fechado');
  end if;
  if (select count(*) from rede_o9_marcacoes where post = x.id and estado <> 'recusada') >= 10 then perform interno.erro('invalido:muitas'); end if;
  perform interno.rede2_limite('editar');
  v_aprovar := coalesce((select marcar_aprovar from rede_o9_prefs where usuario = v_alvo), true);
  v_estado := case when v_aprovar then 'pendente' else 'aprovada' end;
  insert into rede_o9_marcacoes (post, marcado, estado) values (x.id, v_alvo, v_estado);
  -- O aviso da marcação (tipo 'marcacao', já aceito pela regra da tabela de avisos). Nunca derruba a marcação.
  begin
    insert into avisos (para, texto, categoria, tipo, post, alvo, ator)
    values (v_alvo, left(format(case when v_aprovar then '%s quer marcar você num post da Alumia. A marcação só aparece se você aceitar.'
                                     else '%s marcou você num post da Alumia.' end, interno.rede_nome(v)), 500),
            'rede', 'marcacao', x.id, x.id, v)
    on conflict do nothing;
  exception when others then null;
  end;
  return jsonb_build_object('estado', v_estado);
end $$;

/** Tira uma marcação: a autora do post tira qualquer uma; a pessoa marcada tira a própria. Devolve {tirada}. */
create or replace function public.rede_o9_desmarcar(p_post uuid, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); x rede_posts; v_alvo uuid;
begin
  select * into x from rede_posts where id = p_post;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select id into v_alvo from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null then perform interno.erro('nao_encontrado'); end if;
  if x.autor is distinct from v and v_alvo is distinct from v then perform interno.erro('sem_permissao'); end if;
  if v_alvo = v and x.autor is distinct from v then
    -- Quem foi marcada e tira a marcação não é marcada de novo naquele post.
    update rede_o9_marcacoes set estado = 'recusada' where post = x.id and marcado = v;
  else
    delete from rede_o9_marcacoes where post = x.id and marcado = v_alvo and estado <> 'recusada';
  end if;
  return jsonb_build_object('tirada', true);
end $$;

/** As marcações que esperam o aceite de quem chama: post, codinome e @ de quem marcou, um trecho e a data. Até 50. */
create or replace function public.rede_o9_marcacoes_pendentes() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('post', z.id, 'codinome', interno.rede_nome(z.autor), 'handle', z.handle,
                   'trecho', left(z.texto, 140), 'criado_em', z.criado_em) order by z.criado_em desc, z.id), '[]'::jsonb)
          from (select p.id, p.autor, f.rede_handle as handle, p.texto, m.criado_em
                from rede_o9_marcacoes m join rede_posts p on p.id = m.post left join perfis f on f.id = p.autor
                where m.marcado = v and m.estado = 'pendente' and p.apagado_em is null and interno.rede_ve(p, v)
                order by m.criado_em desc limit 50) z);
end $$;

/** Aceita (p_aceitar) ou recusa uma marcação pendente. Recusada, não aparece e não se refaz naquele post. Devolve {estado}. */
create or replace function public.rede_o9_marcacao_decidir(p_post uuid, p_aceitar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o9_eu(); v_estado text;
begin
  if p_aceitar is null then perform interno.erro('invalido:decisao'); end if;
  v_estado := case when p_aceitar then 'aprovada' else 'recusada' end;
  update rede_o9_marcacoes set estado = v_estado where post = p_post and marcado = v and estado = 'pendente';
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('estado', v_estado);
end $$;

-- ── 8. O que o cartão precisa saber, por lote ─────────────────────────────────────────────────────────────────────────────

/**
 * Para cada post (até 50) que quem pergunta pode ver: {aguardando, recolhida, dona, liberada, citacao_minha, solta, restringi,
 * marcacoes, minha_marcacao}. `aguardando` diz que a resposta está recolhida para alguém (o carimbo que só quem escreveu e as
 * donas veem: para as outras pessoas a resposta nem chega, ver rede2_pode_ver); `recolhida`, que está recolhida para quem
 * pergunta; `dona`, que quem pergunta pode abrir e liberar; `citacao_minha`, que o post cita um post de quem pergunta (pode
 * desvincular); `solta`, que a citação foi desvinculada; `restringi`, que quem pergunta restringiu a autora;
 * `marcacoes`, as aprovadas (@ e codinome); `minha_marcacao`, o estado da marcação de quem pergunta, se houver. Sem conta: só o
 * que é público (solta e as marcações aprovadas).
 */
create or replace function public.rede_o9_cartoes(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; p rede_posts; v_donas uuid[]; v_cit uuid;
begin
  if p_ids is null then return r; end if;
  for p in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null loop
    continue when not interno.rede_ve(p, v);
    v_donas := interno.rede_o9_donas(p);
    select o.autor into v_cit from rede_posts o where o.id = p.quote_of;
    r := r || jsonb_build_object(p.id::text, jsonb_build_object(
      'aguardando', cardinality(v_donas) > 0,
      'recolhida', interno.rede_o9_recolhida(p, v),
      'dona', interno.rede_o9_pode_liberar(p, v),
      'liberada', p.resposta_a is not null and exists (select 1 from rede_o9_liberadas l where l.resposta = p.id),
      'citacao_minha', v is not null and v_cit = v and p.autor is distinct from v,
      'solta', exists (select 1 from rede_o9_soltas s where s.post = p.id),
      'restringi', v is not null and interno.rede_o9_restringiu(v, p.autor),
      'marcacoes', (select coalesce(jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'codinome', interno.rede_nome(f.id)) order by m.criado_em), '[]'::jsonb)
                    from rede_o9_marcacoes m join perfis f on f.id = m.marcado where m.post = p.id and m.estado = 'aprovada'),
      'minha_marcacao', case when v is not null then (select m.estado from rede_o9_marcacoes m where m.post = p.id and m.marcado = v and m.estado <> 'recusada') end));
    v_cit := null;
  end loop;
  return r;
end $$;

-- ── 9. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_o9_segue(uuid, uuid), interno.rede_o9_blindada(uuid), interno.rede_o9_restringiu(uuid, uuid),
  interno.rede_o9_protecao_permite(uuid, uuid, text), interno.rede_o9_donas(interno.rede_posts), interno.rede_o9_aguardando(interno.rede_posts),
  interno.rede_o9_recolhida(interno.rede_posts, uuid), interno.rede_o9_pode_liberar(interno.rede_posts, uuid), interno.rede_o9_resposta_confere(), interno.rede_o9_citar_confere(),
  interno.rede_o9_mencao_filtro(), interno.rede_o9_aviso_filtro(), interno.rede_o9_eu() from public;
revoke all on function public.rede_o9_protecao(), public.rede_o9_blindagem(integer), public.rede_o9_preferir(jsonb),
  public.rede_o9_restringir(text, boolean), public.rede_o9_restritos(), public.rede_o9_liberar(uuid, boolean),
  public.rede_o9_aguardando_na_conversa(uuid), public.rede_o9_citacao_soltar(uuid), public.rede_o9_marcar(uuid, text),
  public.rede_o9_desmarcar(uuid, text), public.rede_o9_marcacoes_pendentes(), public.rede_o9_marcacao_decidir(uuid, boolean),
  public.rede_o9_cartoes(uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_o9_segue(uuid, uuid), interno.rede_o9_blindada(uuid), interno.rede_o9_restringiu(uuid, uuid),
      interno.rede_o9_protecao_permite(uuid, uuid, text), interno.rede_o9_donas(interno.rede_posts), interno.rede_o9_aguardando(interno.rede_posts),
      interno.rede_o9_recolhida(interno.rede_posts, uuid), interno.rede_o9_pode_liberar(interno.rede_posts, uuid), interno.rede_o9_resposta_confere(), interno.rede_o9_citar_confere(),
      interno.rede_o9_mencao_filtro(), interno.rede_o9_aviso_filtro(), interno.rede_o9_eu() from anon, authenticated;
    revoke all on function public.rede_o9_protecao(), public.rede_o9_blindagem(integer), public.rede_o9_preferir(jsonb),
      public.rede_o9_restringir(text, boolean), public.rede_o9_restritos(), public.rede_o9_liberar(uuid, boolean),
      public.rede_o9_aguardando_na_conversa(uuid), public.rede_o9_citacao_soltar(uuid), public.rede_o9_marcar(uuid, text),
      public.rede_o9_desmarcar(uuid, text), public.rede_o9_marcacoes_pendentes(), public.rede_o9_marcacao_decidir(uuid, boolean),
      public.rede_o9_cartoes(uuid[]) from anon, authenticated;
    grant execute on function public.rede_o9_protecao(), public.rede_o9_blindagem(integer), public.rede_o9_preferir(jsonb),
      public.rede_o9_restringir(text, boolean), public.rede_o9_restritos(), public.rede_o9_liberar(uuid, boolean),
      public.rede_o9_citacao_soltar(uuid), public.rede_o9_marcar(uuid, text), public.rede_o9_desmarcar(uuid, text),
      public.rede_o9_marcacoes_pendentes(), public.rede_o9_marcacao_decidir(uuid, boolean) to authenticated, service_role;
    grant execute on function public.rede_o9_aguardando_na_conversa(uuid), public.rede_o9_cartoes(uuid[]) to anon, authenticated, service_role;
  end if;
end $$;

-- ── 10. A porta ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função pública acima ganha a porta da entrada (interno.alumia_porta) pela regra das portas (20261112-alumia-portas.sql).
select interno.alumia_trancar();
