-- ───────────────────────────── Alumia, onda 13: mapa e ao vivo ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 13B. Duas funções novas:
--
--   1. O MAPA (L1-19, com a troca por princípio): os chamados, os eventos e os núcleos por CIDADE. A precisão é a do município
--      escrito por quem chamou o ato ou cadastrou o núcleo; nunca posição do aparelho, nunca endereço. O banco junta por cidade
--      (o nome escrito, sem acento e sem pontuação, com a UF quando ela vem escrita, "Recife - PE", ou quando o núcleo a tem) e
--      devolve só o agregado: quantos chamados e quantos eventos, só a partir de 3 (abaixo disso, só que há); núcleos sem número
--      (como no mapa das organizações), com o nome das organizações com selo que puseram o núcleo no mapa. O desenho do Brasil é da
--      própria Alumia (lib/rede/mapa, malha do IBGE guardada no repositório): nenhum provedor de mapa de fora.
--      Chamados = ato e mutirão; eventos = assembleia, roda, aula e outro. Só o que a pessoa pode ver (interno.rede_ve), do que
--      começou há até 6 horas ao que começa em 60 dias, sem os cancelados.
--
--   2. AO VIVO, "Pergunte a…" com hora marcada (L1-17): a sessão de perguntas e respostas em texto sobre a caixa de perguntas que
--      já existe (20261110-alumia-b1-comunidade.sql, seção 10). A dona da caixa marca a própria sessão; a moderação de uma
--      comunidade marca a da comunidade e CONVIDA uma pessoa, que aceita ou recusa (sem aceite, nada aparece). As perguntas entram
--      por ordem de chegada e a ordem não muda (um gatilho barra); a pessoa convidada responde (ou passa) SEMPRE a primeira da fila:
--      não escolhe, não pula para a mais fácil. Ninguém vota em pergunta: nada de ranking. Quem perguntou só aparece se quis (o
--      codinome do momento fica guardado só nesse caso); um dia depois do fim, o banco esquece quem perguntou. A moderação da caixa
--      retira pergunta com um motivo de uma lista fechada; a retirada aparece como retirada, sem o texto.
--
-- Desligado no painel ("alumia-mapa", "alumia-ao-vivo"), o banco também recusa (interno.rede_mapa_aberto), não só a tela.
--
-- Nenhum endereço de rede é guardado. Nenhuma função devolve lista de pessoas: nem de quem perguntou, nem de quem foi ao ato; o único
-- nome numa sessão é o da pessoa convidada, depois que ela aceitou. Tudo em interno, com RLS e sem política; o acesso é só por
-- funções security definer com search_path fixo; as de membro passam pela porta da entrada (interno.alumia_trancar, no fim).
-- Nenhuma função recebe parâmetro do tipo linha de tabela.
--
-- Leis: LGPD (Lei 13.709/2018) art. 5º, II e art. 11 (ir a ato e estar em núcleo revelam opinião política: só agregado, número só
-- a partir de 3, nenhuma posição), art. 6º, III (necessidade: quem perguntou some um dia depois do fim). ECA Digital (Lei
-- 15.211/2025): perguntar e marcar sessão exigem ser membro da Alumia (18+ com consentimento).
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261118-alumia-onda12-fim.sql.
-- Teste: scripts/testar-alumia-o13-mapa.mjs.

-- ── 1. O lugar (regra pura, a mesma de lib/rede/mapa/lugar.ts) ─────────────────────────────────────────────────────────────

/**
 * A cidade escrita vira {nome, uf}: minúsculas, sem acento (interno.rede_ato_cidade), pontuação vira espaço; a UF no fim ("Recife -
 * PE", "Recife/PE", "Recife (PE)", "recife, pe") sai do nome. "Sento Sé" é o único município cujo nome termina numa sigla de UF.
 */
create or replace function interno.rede_mapa_lugar(p_texto text) returns text[] language plpgsql immutable set search_path = interno, pg_temp as $$
declare k text := interno.rede_ato_cidade(left(coalesce(p_texto, ''), 80)); m text[]; v_nome text;
begin
  if k is null then return null; end if;
  m := regexp_match(k, '^(.*?)[\s,/(–-]+([a-z]{2})\)?$');
  if m is not null and upper(m[2]) in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
      'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO') and k <> 'sento se' then
    v_nome := btrim(regexp_replace(m[1], '[^a-z0-9]+', ' ', 'g'));
    if char_length(v_nome) >= 2 then return array[v_nome, upper(m[2])]; end if;
  end if;
  v_nome := btrim(regexp_replace(k, '[^a-z0-9]+', ' ', 'g'));
  return case when char_length(v_nome) >= 2 then array[v_nome, null] end;
end $$;

/**
 * A coordenação NÃO desligou esta função no painel (nem a Alumia nova)? A variável de montagem do site só mostra ou esconde a
 * tela; esta trava vale também para quem chama o banco direto (/rest/v1/rpc). Sem decisão no painel vale a montagem, que o banco
 * não vê: aberto. O nome é o do interruptor de lib/recursos.ts ("alumia-mapa" ou "alumia-ao-vivo").
 */
create or replace function interno.rede_mapa_aberto(p_nome text) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return true; end if;
  return not exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', p_nome) and not ligado);
end $$;

-- ── 2. O mapa ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O mapa inteiro, já agregado por cidade: {dias, lugares: [{nome, uf, escrito, chamados, chamados_ha, eventos, eventos_ha,
 * nucleos_ha, orgs: [{handle, nome}]}]}. `chamados` e `eventos` são números só a partir de 3 (abaixo, nulo, e o "_ha" diz se há);
 * núcleo nunca tem número. Até 2000 lugares. Visitante (com a área aberta) vê só o que é público na internet.
 */
create or replace function public.rede_mapa() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-mapa') then perform interno.erro('desligado'); end if;
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_mapa_ler', 120, 60);
  return jsonb_build_object('dias', 60, 'lugares', coalesce((
    with atos as (
      select interno.rede_mapa_lugar(c.cidade) as l, btrim(c.cidade) as escrito, c.tipo in ('ato', 'mutirao') as chamado
        from rede_chamados c join rede_posts p on p.id = c.post
       where c.inicio > now() - interval '6 hours' and c.inicio < now() + interval '60 days'
         and c.cidade is not null and not c.cancelado and c.situacao <> 'cancelado'
         and p.apagado_em is null and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
       order by c.inicio limit 5000
    ), a as (
      select l[1] as nome, l[2] as uf, min(escrito) as escrito, count(*) filter (where chamado) as ch, count(*) filter (where not chamado) as ev
        from atos where l is not null group by 1, 2
    ), nuc as (
      select y.l[1] as nome, coalesce(y.l[2], y.uf_do_nucleo) as uf, y.escrito, y.org from (
        select interno.rede_mapa_lugar(coalesce(nullif(btrim(n.org_cidade), ''), nullif(btrim(n.cidade), ''))) as l,
               coalesce(nullif(btrim(n.org_cidade), ''), nullif(btrim(n.cidade), '')) as escrito, n.org_uf as uf_do_nucleo, n.org
          from rede_nucleos n join rede_orgs o on o.perfil = n.org join perfis f on f.id = n.org
         where n.org_no_mapa and n.org_uf is not null and o.verificada_em is not null and not f.suspenso and not interno.rede_bloqueado(v, n.org)
           and interno.alumia_chama(n.id) = 'plena') y
       where y.l is not null
    ), b as (
      select x.nome, x.uf, min(x.escrito) as escrito,
             (select jsonb_agg(jsonb_build_object('handle', g.rede_handle, 'nome', coalesce(nullif(g.rede_codinome, ''), g.rede_handle)) order by lower(coalesce(g.rede_codinome, g.rede_handle)))
                from (select distinct z.org from nuc z where z.nome = x.nome and z.uf = x.uf) d
                join perfis g on g.id = d.org) as orgs
        from nuc x group by x.nome, x.uf
    )
    select jsonb_agg(jsonb_build_object(
             'nome', coalesce(a.nome, b.nome), 'uf', coalesce(a.uf, b.uf), 'escrito', coalesce(a.escrito, b.escrito),
             'chamados', case when coalesce(a.ch, 0) >= 3 then a.ch end, 'chamados_ha', coalesce(a.ch, 0) > 0,
             'eventos', case when coalesce(a.ev, 0) >= 3 then a.ev end, 'eventos_ha', coalesce(a.ev, 0) > 0,
             'nucleos_ha', b.nome is not null, 'orgs', coalesce((select jsonb_agg(e) from jsonb_array_elements(b.orgs) with ordinality t(e, i) where i <= 8), '[]'::jsonb))
           order by coalesce(a.nome, b.nome), coalesce(a.uf, b.uf))
      from (select * from a order by ch + ev desc limit 2000) a full join b on b.nome = a.nome and b.uf is not distinct from a.uf
  ), '[]'::jsonb));
end $$;

-- ── 3. Ao vivo: as tabelas ────────────────────────────────────────────────────────────────────────────────────────────────

-- A sessão marcada. É de uma pessoa (dono = convidada) ou de uma comunidade (a moderação marca e convida). Quem marcou pela
-- comunidade não fica guardado (a sessão é da comunidade).
create table if not exists interno.rede_ama (
  id uuid primary key default gen_random_uuid(),
  dono uuid references interno.perfis (id) on delete cascade,
  comunidade text references interno.rede_comunidades (slug) on delete cascade on update cascade,
  convidada uuid not null references interno.perfis (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  inicio timestamptz not null,
  fim timestamptz not null,
  situacao text not null default 'marcada' check (situacao in ('convite', 'marcada', 'recusada', 'cancelada')),
  criado_em timestamptz not null default now(),
  check ((dono is null) <> (comunidade is null)),
  check (dono is null or dono = convidada),
  check (fim >= inicio + interval '15 minutes' and fim <= inicio + interval '3 hours')
);
create index if not exists rede_ama_dono on interno.rede_ama (dono, inicio) where dono is not null;
create index if not exists rede_ama_comunidade on interno.rede_ama (comunidade, inicio) where comunidade is not null;
create index if not exists rede_ama_convidada on interno.rede_ama (convidada, situacao);
create index if not exists rede_ama_proximas on interno.rede_ama (fim) where situacao = 'marcada';
alter table interno.rede_ama enable row level security;

-- As perguntas da sessão, por ordem de chegada (seq). `quem` serve para retirar a própria e para o "minha"; some um dia depois do
-- fim. `nome` é o codinome do momento, só quando a pessoa quis aparecer.
create table if not exists interno.rede_ama_perguntas (
  id uuid primary key default gen_random_uuid(),
  ama uuid not null references interno.rede_ama (id) on delete cascade,
  seq bigint generated always as identity,
  quem uuid references interno.perfis (id) on delete set null,
  nome text check (nome is null or char_length(nome) <= 80),
  texto text not null check (char_length(btrim(texto)) between 5 and 500),
  situacao text not null default 'fila' check (situacao in ('fila', 'respondida', 'passada', 'retirada')),
  resposta text check (resposta is null or char_length(btrim(resposta)) between 1 and 2000),
  motivo text check (motivo is null or motivo in ('ofensa', 'dado_pessoal', 'fora_do_tema', 'repetida')),
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  check ((situacao = 'respondida') = (resposta is not null)),
  check ((situacao = 'retirada') = (motivo is not null))
);
create index if not exists rede_ama_perguntas_fila on interno.rede_ama_perguntas (ama, seq);
create index if not exists rede_ama_perguntas_quem on interno.rede_ama_perguntas (quem) where quem is not null;
alter table interno.rede_ama_perguntas enable row level security;

/** A fila não reordena: a ordem, a sessão, o texto e o nome não mudam depois de entrar; quem perguntou só pode ser esquecido. */
create or replace function interno.rede_ama_fila_fixa() returns trigger language plpgsql set search_path = interno, pg_temp as $$
begin
  if new.seq is distinct from old.seq or new.criado_em is distinct from old.criado_em or new.ama is distinct from old.ama
     or new.texto is distinct from old.texto or new.nome is distinct from old.nome or (new.quem is distinct from old.quem and new.quem is not null) then
    raise exception 'fila_fixa' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists rede_ama_fila_fixa on interno.rede_ama_perguntas;
create trigger rede_ama_fila_fixa before update on interno.rede_ama_perguntas for each row execute function interno.rede_ama_fila_fixa();

-- ── 4. Ao vivo: regras ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem cuida da sessão: a dona (sessão pessoal) ou a moderação da comunidade. */
create or replace function interno.rede_ama_cuida(p_id uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (select 1 from rede_ama a where a.id = p_id
    and ((a.dono is not null and a.dono = p_quem) or (a.comunidade is not null and interno.rede3_com_modera(a.comunidade, p_quem))))
$$;

/**
 * p_quem vê a sessão? A mesma regra da caixa de perguntas (perfil fora da busca, conta suspensa, bloqueio, comunidade fechada):
 * sessão pessoal pede conta; da comunidade, a mesma recusa da página. Bloqueio com a pessoa convidada também esconde. Convite,
 * recusa e cancelamento só para quem cuida e para a convidada.
 */
create or replace function interno.rede_ama_ve(p_id uuid, p_quem uuid) returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a rede_ama; f perfis;
begin
  select * into a from rede_ama where id = p_id;
  if not found then return false; end if;
  if p_quem is not null and p_quem = a.convidada then return true; end if;
  if interno.rede_ama_cuida(a.id, p_quem) then return true; end if;
  if a.situacao <> 'marcada' then return false; end if;
  if p_quem is not null and interno.rede_bloqueado(p_quem, a.convidada) then return false; end if;
  select * into f from perfis where id = a.convidada;
  if not found or f.suspenso then return false; end if;
  if a.comunidade is not null then
    begin
      perform interno.rede_alumia_com_ver(a.comunidade, p_quem);
    exception when others then return false;
    end;
    return true;
  end if;
  return p_quem is not null and interno.rede2_membro(f.id) and f.rede_modo <> 'invisivel' and not f.rede_invisivel;
end $$;

/** Esquece quem perguntou nas sessões que acabaram há mais de um dia (o nome que a pessoa quis mostrar fica). */
create or replace function interno.rede_ama_esquecer() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  update rede_ama_perguntas q set quem = null from rede_ama a
   where a.id = q.ama and q.quem is not null and (a.fim < now() - interval '1 day' or a.situacao in ('recusada', 'cancelada'));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/** O momento da sessão: antes, ao vivo (do início ao fim) ou encerrada. */
create or replace function interno.rede_ama_momento(p_inicio timestamptz, p_fim timestamptz) returns text language sql stable set search_path = interno, pg_temp as $$
  select case when now() < p_inicio then 'antes' when now() <= p_fim then 'ao_vivo' else 'encerrada' end
$$;

/** A sessão como a tela mostra (sem as perguntas). Número de perguntas só a partir de 3. */
create or replace function interno.rede_ama_json(p_id uuid, p_quem uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a rede_ama; f perfis; c rede_comunidades; v_n integer; v_cuida boolean;
begin
  select * into a from rede_ama where id = p_id;
  if not found then return null; end if;
  select * into f from perfis where id = a.convidada;
  if a.comunidade is not null then select * into c from rede_comunidades where slug = a.comunidade; end if;
  select count(*) into v_n from rede_ama_perguntas where ama = a.id and situacao <> 'retirada';
  v_cuida := interno.rede_ama_cuida(a.id, p_quem);
  return jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'inicio', a.inicio, 'fim', a.fim, 'situacao', a.situacao, 'momento', interno.rede_ama_momento(a.inicio, a.fim),
    'convidada', jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(f.id)),
    'de', case when a.comunidade is not null then jsonb_build_object('tipo', 'comunidade', 'slug', c.slug, 'nome', c.nome)
               else jsonb_build_object('tipo', 'pessoa', 'handle', f.rede_handle, 'nome', interno.rede_nome(f.id)) end,
    'perguntas', case when v_n >= 3 then v_n end,
    'cuida', v_cuida, 'sou_convidada', p_quem is not null and p_quem = a.convidada);
end $$;

-- ── 5. Ao vivo: funções da tela ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Marca uma sessão. Sem p_slug: a própria (a pessoa responde; já sai marcada). Com p_slug: a da comunidade, só pela moderação, com
 * p.convidada (o @ de um membro da Alumia), que recebe um convite e aceita ou recusa. p: titulo (3–120), inicio (de 10 minutos a 60
 * dias daqui), minutos (15–180, padrão 60). Até 3 sessões por vir em cada caixa.
 */
create or replace function public.rede_ama_marcar(p_slug text, p jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_comunidades; v_titulo text; v_inicio timestamptz; v_min integer; v_conv uuid; v_id uuid; v_sit text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:pedido'); end if;
  v_titulo := interno.txt(regexp_replace(coalesce(p ->> 'titulo', ''), '\s+', ' ', 'g'), 'titulo', 3, 120);
  if interno.rede3_pub_dado_pessoal(v_titulo) then perform interno.erro('dado_pessoal'); end if;
  begin
    v_inicio := (p ->> 'inicio')::timestamptz;
    v_min := coalesce((p ->> 'minutos')::integer, 60);
  exception when others then perform interno.erro('invalido:inicio');
  end;
  if v_inicio is null or v_inicio < now() + interval '10 minutes' or v_inicio > now() + interval '60 days' then perform interno.erro('invalido:inicio'); end if;
  if v_min < 15 or v_min > 180 then perform interno.erro('invalido:minutos'); end if;
  perform interno.limite('alumia_ama_marcar', 10, 1440);
  if nullif(p_slug, '') is not null then
    c := interno.rede_alumia_com_ver(p_slug, v);
    if not interno.rede3_com_modera(c.slug, v) then perform interno.erro('sem_permissao'); end if;
    select f.id into v_conv from perfis f
     where f.rede_handle = lower(regexp_replace(btrim(coalesce(p ->> 'convidada', '')), '^@', '')) and f.rede_codinome_ok and not f.suspenso
       and interno.rede2_membro(f.id) and not interno.rede_bloqueado(v, f.id) and not interno.rede_bloqueado(f.id, v);
    if v_conv is null then perform interno.erro('invalido:convidada'); end if;
    if (select count(*) from rede_ama where comunidade = c.slug and situacao in ('convite', 'marcada') and fim > now()) >= 3 then perform interno.erro('muitos_pedidos'); end if;
    v_sit := case when v_conv = v then 'marcada' else 'convite' end;
    insert into rede_ama (comunidade, convidada, titulo, inicio, fim, situacao)
    values (c.slug, v_conv, v_titulo, v_inicio, v_inicio + make_interval(mins => v_min), v_sit) returning id into v_id;
    if v_sit = 'convite' then
      perform interno.avisar_em(v_conv, 'Você recebeu um convite para responder perguntas ao vivo na Alumia.', 'rede');
    end if;
  else
    if (select count(*) from rede_ama where dono = v and situacao = 'marcada' and fim > now()) >= 3 then perform interno.erro('muitos_pedidos'); end if;
    v_sit := 'marcada';
    insert into rede_ama (dono, convidada, titulo, inicio, fim, situacao)
    values (v, v, v_titulo, v_inicio, v_inicio + make_interval(mins => v_min), v_sit) returning id into v_id;
  end if;
  return jsonb_build_object('id', v_id, 'situacao', v_sit);
end $$;

/** A pessoa convidada aceita (a sessão passa a aparecer) ou recusa. Só antes do fim. */
create or replace function public.rede_ama_convite(p_id uuid, p_aceita boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_ama;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  select * into a from rede_ama where id = p_id;
  if not found or a.convidada <> v then perform interno.erro('nao_encontrado'); end if;
  if a.situacao <> 'convite' or a.fim <= now() then perform interno.erro('invalido:situacao'); end if;
  perform interno.limite('alumia_ama_convite', 30, 60);
  update rede_ama set situacao = case when coalesce(p_aceita, false) then 'marcada' else 'recusada' end where id = a.id;
  return jsonb_build_object('situacao', case when coalesce(p_aceita, false) then 'marcada' else 'recusada' end);
end $$;

/** Quem cuida ou a convidada cancela uma sessão que ainda não acabou. As perguntas dela somem junto. */
create or replace function public.rede_ama_cancelar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_ama;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  select * into a from rede_ama where id = p_id;
  if not found or (a.convidada <> v and not interno.rede_ama_cuida(a.id, v)) then perform interno.erro('nao_encontrado'); end if;
  if a.situacao not in ('convite', 'marcada') or a.fim <= now() then perform interno.erro('invalido:situacao'); end if;
  perform interno.limite('alumia_ama_marcar', 10, 1440);
  update rede_ama set situacao = 'cancelada' where id = a.id;
  delete from rede_ama_perguntas where ama = a.id;
  return jsonb_build_object('situacao', 'cancelada');
end $$;

/**
 * As sessões de uma caixa (@ da pessoa ou slug da comunidade): as que vêm, a que está no ar e as dos últimos 30 dias, até 10. Quem
 * cuida (e a convidada) vê também convite e recusa. {cuida, sessoes}.
 */
create or replace function public.rede_ama_lista(p_handle text default null, p_slug text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r record; v_cuida boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then return jsonb_build_object('cuida', false, 'sessoes', '[]'::jsonb); end if;
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if v is null and nullif(p_slug, '') is null then perform interno.erro('entre_primeiro'); end if;
  select * into r from interno.rede_alumia_caixa_de(p_handle, p_slug, v);
  perform interno.limite('rede2_ler', 600, 60);
  perform interno.rede_ama_esquecer();
  v_cuida := v is not null and ((r.v_dono is not null and r.v_dono = v) or (r.v_slug is not null and interno.rede3_com_modera(r.v_slug, v)));
  return jsonb_build_object('cuida', v_cuida, 'sessoes', coalesce((
    select jsonb_agg(interno.rede_ama_json(x.id, v) order by x.fim < now(), case when x.fim >= now() then x.inicio end, x.inicio desc)
      from (select a.id, a.inicio, a.fim from rede_ama a
             where ((r.v_slug is not null and a.comunidade = r.v_slug) or (r.v_slug is null and a.dono = r.v_dono))
               and a.fim > now() - interval '30 days'
               and (a.situacao = 'marcada' or ((v_cuida or a.convidada = v) and a.situacao in ('convite', 'recusada') and a.fim > now()))
               and interno.rede_ama_ve(a.id, v)
             order by a.fim < now(), a.inicio desc limit 10) x), '[]'::jsonb));
end $$;

/**
 * Uma sessão com as perguntas, por ordem de chegada: as da fila (com a posição), as respondidas (com a resposta), as passadas e as
 * retiradas (sem o texto, com o motivo). Quem perguntou só aparece se quis. `vez` = a pergunta da vez (a primeira da fila).
 */
create or replace function public.rede_ama(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_vez uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if not interno.rede_ama_ve(p_id, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  perform interno.rede_ama_esquecer();
  select id into v_vez from rede_ama_perguntas where ama = p_id and situacao = 'fila' order by seq limit 1;
  return interno.rede_ama_json(p_id, v) || jsonb_build_object(
    'vez', v_vez,
    'pode_perguntar', v is not null and interno.rede2_membro(v) and v <> (select convidada from rede_ama where id = p_id)
      and (select situacao = 'marcada' and fim > now() from rede_ama where id = p_id)
      and coalesce((select interno.rede3_com_situacao(comunidade, v) is distinct from 'banido' from rede_ama where id = p_id and comunidade is not null), true),
    'lista', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'situacao', q.situacao,
        'texto', case when q.situacao <> 'retirada' then q.texto end,
        'resposta', q.resposta, 'respondida_em', q.respondida_em, 'criado_em', q.criado_em,
        'motivo', q.motivo, 'quem', q.nome, 'minha', v is not null and q.quem = v) order by q.seq)
      from (select * from rede_ama_perguntas where ama = p_id order by seq limit 300) q), '[]'::jsonb));
end $$;

/** Pergunta numa sessão marcada que ainda não acabou. Nunca com dado pessoal. Até 3 esperando por pessoa; 300 por sessão. */
create or replace function public.rede_ama_perguntar(p_id uuid, p_texto text, p_mostrar_nome boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); a rede_ama; v_txt text; v_id uuid;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if not interno.rede_ama_ve(p_id, v) then perform interno.erro('nao_encontrado'); end if;
  select * into a from rede_ama where id = p_id;
  if a.situacao <> 'marcada' or a.fim <= now() then perform interno.erro('travado'); end if;
  if a.convidada = v then perform interno.erro('invalido:propria'); end if;
  if a.comunidade is not null and interno.rede3_com_situacao(a.comunidade, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  v_txt := interno.txt(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'), 'texto', 5, 500);
  if interno.rede3_pub_dado_pessoal(v_txt) then perform interno.erro('dado_pessoal'); end if;
  perform interno.limite('alumia_ama_perguntar', 10, 60);
  if (select count(*) from rede_ama_perguntas where ama = a.id and quem = v and situacao = 'fila') >= 3 then perform interno.erro('muitos_pedidos'); end if;
  if (select count(*) from rede_ama_perguntas where ama = a.id) >= 300 then perform interno.erro('fila_cheia'); end if;
  insert into rede_ama_perguntas (ama, quem, nome, texto)
  values (a.id, v, case when coalesce(p_mostrar_nome, false) then interno.rede_nome(v) end, v_txt) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/**
 * A pessoa convidada responde (p_resposta) ou passa (p_resposta nula) a pergunta da VEZ: a primeira da fila. Só do início até uma
 * hora depois do fim. Quem perguntou recebe um aviso, sem nome de ninguém.
 */
create or replace function public.rede_ama_responder(p_pergunta uuid, p_resposta text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); q rede_ama_perguntas; a rede_ama; v_vez uuid; v_txt text;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  select * into q from rede_ama_perguntas where id = p_pergunta;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into a from rede_ama where id = q.ama;
  if a.convidada <> v then perform interno.erro('nao_encontrado'); end if;
  if a.situacao <> 'marcada' or now() < a.inicio or now() > a.fim + interval '1 hour' then perform interno.erro('fora_do_horario'); end if;
  select id into v_vez from rede_ama_perguntas where ama = a.id and situacao = 'fila' order by seq limit 1 for update;
  if v_vez is distinct from q.id then perform interno.erro('fora_da_vez'); end if;
  perform interno.limite('alumia_responder', 120, 60);
  if p_resposta is null then
    update rede_ama_perguntas set situacao = 'passada' where id = q.id;
    return jsonb_build_object('situacao', 'passada');
  end if;
  v_txt := interno.txt(p_resposta, 'resposta', 1, 2000);
  update rede_ama_perguntas set situacao = 'respondida', resposta = v_txt, respondida_em = now() where id = q.id;
  if q.quem is not null then perform interno.avisar_em(q.quem, 'Sua pergunta foi respondida ao vivo na Alumia.', 'rede'); end if;
  return jsonb_build_object('situacao', 'respondida');
end $$;

/**
 * Retira uma pergunta: quem perguntou tira a própria enquanto espera (some de vez); quem cuida da sessão retira com um motivo
 * (ofensa, dado_pessoal, fora_do_tema, repetida), e ela aparece como retirada, sem o texto.
 */
create or replace function public.rede_ama_retirar(p_pergunta uuid, p_motivo text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); q rede_ama_perguntas;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then perform interno.erro('desligado'); end if;
  select * into q from rede_ama_perguntas where id = p_pergunta;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if nullif(p_motivo, '') is null then
    if q.quem is distinct from v or q.situacao <> 'fila' then perform interno.erro('nao_encontrado'); end if;
    delete from rede_ama_perguntas where id = q.id;
    return jsonb_build_object('retirada', true);
  end if;
  if not interno.rede_ama_cuida(q.ama, v) then perform interno.erro('nao_encontrado'); end if;
  if p_motivo not in ('ofensa', 'dado_pessoal', 'fora_do_tema', 'repetida') then perform interno.erro('invalido:motivo'); end if;
  if q.situacao = 'retirada' then return jsonb_build_object('retirada', true); end if;
  perform interno.limite('alumia_responder', 120, 60);
  update rede_ama_perguntas set situacao = 'retirada', motivo = p_motivo, resposta = null, respondida_em = null where id = q.id;
  perform interno.registrar('alumia_ama_retirar', q.id::text, jsonb_build_object('motivo', p_motivo));
  return jsonb_build_object('retirada', true);
end $$;

/**
 * A agenda do ao vivo na Alumia: as sessões no ar e as dos próximos 14 dias que a pessoa pode ver (até 20) e, para quem tem conta,
 * os convites dela esperando resposta. {ao_vivo, proximas, convites}.
 */
create or replace function public.rede_ama_agenda() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  if not interno.rede_mapa_aberto('alumia-ao-vivo') then return jsonb_build_object('ao_vivo', '[]'::jsonb, 'proximas', '[]'::jsonb, 'convites', '[]'::jsonb); end if;
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  perform interno.rede_ama_esquecer();
  return jsonb_build_object(
    'ao_vivo', coalesce((select jsonb_agg(interno.rede_ama_json(x.id, v) order by x.inicio) from (
        select a.id, a.inicio from rede_ama a where a.situacao = 'marcada' and a.inicio <= now() and a.fim >= now() and interno.rede_ama_ve(a.id, v)
        order by a.inicio limit 20) x), '[]'::jsonb),
    'proximas', coalesce((select jsonb_agg(interno.rede_ama_json(x.id, v) order by x.inicio) from (
        select a.id, a.inicio from rede_ama a where a.situacao = 'marcada' and a.inicio > now() and a.inicio < now() + interval '14 days' and interno.rede_ama_ve(a.id, v)
        order by a.inicio limit 20) x), '[]'::jsonb),
    'convites', case when v is null then '[]'::jsonb else coalesce((select jsonb_agg(interno.rede_ama_json(a.id, v) order by a.inicio)
        from rede_ama a where a.convidada = v and a.situacao = 'convite' and a.fim > now()), '[]'::jsonb) end);
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.rede_mapa_aberto(text), interno.rede_mapa_lugar(text), interno.rede_ama_fila_fixa(), interno.rede_ama_cuida(uuid, uuid), interno.rede_ama_ve(uuid, uuid),
  interno.rede_ama_esquecer(), interno.rede_ama_momento(timestamptz, timestamptz), interno.rede_ama_json(uuid, uuid) from public;
revoke all on function public.rede_mapa(), public.rede_ama_marcar(text, jsonb), public.rede_ama_convite(uuid, boolean), public.rede_ama_cancelar(uuid),
  public.rede_ama_lista(text, text), public.rede_ama(uuid), public.rede_ama_perguntar(uuid, text, boolean), public.rede_ama_responder(uuid, text),
  public.rede_ama_retirar(uuid, text), public.rede_ama_agenda() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_mapa_aberto(text), interno.rede_mapa_lugar(text), interno.rede_ama_fila_fixa(), interno.rede_ama_cuida(uuid, uuid), interno.rede_ama_ve(uuid, uuid),
      interno.rede_ama_esquecer(), interno.rede_ama_momento(timestamptz, timestamptz), interno.rede_ama_json(uuid, uuid) from anon, authenticated;
    revoke all on table interno.rede_ama, interno.rede_ama_perguntas from anon, authenticated;
    -- Visitante: só ler (o mapa, a lista de uma comunidade, uma sessão e a agenda), e só com a área aberta e a porta deixando.
    -- O padrão do esquema public dá execução a anon: as de quem tem conta perdem a dele aqui.
    revoke all on function public.rede_ama_marcar(text, jsonb), public.rede_ama_convite(uuid, boolean), public.rede_ama_cancelar(uuid),
      public.rede_ama_perguntar(uuid, text, boolean), public.rede_ama_responder(uuid, text), public.rede_ama_retirar(uuid, text) from anon;
    grant execute on function public.rede_mapa(), public.rede_ama_lista(text, text), public.rede_ama(uuid), public.rede_ama_agenda() to anon;
    grant execute on function public.rede_mapa(), public.rede_ama_marcar(text, jsonb), public.rede_ama_convite(uuid, boolean), public.rede_ama_cancelar(uuid),
      public.rede_ama_lista(text, text), public.rede_ama(uuid), public.rede_ama_perguntar(uuid, text, boolean), public.rede_ama_responder(uuid, text),
      public.rede_ama_retirar(uuid, text), public.rede_ama_agenda() to authenticated;
  end if;
end $$;

-- ── 7. A porta ────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Toda função public.rede_* nova que anon ou authenticated chamam passa pela porta da entrada. "abertas" tem de vir vazia.
select interno.alumia_trancar();
