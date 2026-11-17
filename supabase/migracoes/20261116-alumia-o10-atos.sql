-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Onda 10 · 10F · atos e eventos (16/11/2026) ═══════════════════════════
-- Roda DEPOIS de 20261115-alumia-onda9-fim.sql. Idempotente: o teste (scripts/testar-alumia-o10-atos.mjs) roda duas vezes no banco
-- local. NÃO rodar em produção sem o Jonathan.
--
-- O que faz:
--   1. EVENTOS RECORRENTES (semanal, quinzenal, mensal, com exceções). A série nasce de um ato que já existe (o modelo) e cada data
--      vira um ato de verdade (post + chamado), com o "Você vai", o lembrete, as tarefas e as caronas de cada dia, sem misturar a
--      contagem de um encontro com a do outro. Só as datas dos próximos 35 dias ficam abertas (até 6 por rodada); a rodada de hora
--      em hora (pg_cron) abre as seguintes. Pular uma data cancela aquela (avisa só quem confirmou, pelo rede_ato_mudar de sempre);
--      encerrar a série cancela as datas que ainda não aconteceram. Até um ano, até 24 exceções.
--   2. ATO COM MAIS DE UM COLETIVO. Quem organizou convida uma organização pelo @; quem gere a organização aceita ou recusa. Só
--      as que aceitaram aparecem no ato ("junto com"); o convite pendente só quem organizou e a organização convidada veem. Quem
--      age como uma organização que aceitou também modera o álbum e a linha ao vivo daquele ato. Até 8 por ato.
--   3. ÁLBUM COLETIVO DO ATO. Quem confirmou presença (ou organiza) manda fotos do ato; o rosto é borrado NO APARELHO antes de
--      enviar (detector do próprio navegador quando há; senão a pessoa marca à mão), a pessoa declara que conferiu, e o servidor tira
--      o metadado de novo (app/api/rede/album). Só o servidor grava no depósito privado "rede-album" (com a chave de serviço, depois
--      de limpar): não há regra de envio para quem tem conta, então ninguém põe ali bytes que não passaram pela limpeza. O caminho
--      não tem o id de quem mandou (<ato>/<id>.<ext>). TODA foto, também a de quem organiza, entra na fila e só aparece para os
--      outros depois que a moderação do ato aprova. Recusar ou apagar tira o registro; o arquivo que ficou sem registro sai do
--      depósito na faxina dos arquivos (app/api/rede/exportar/faxina, com public.rede_ato_album_orfas). Ninguém recebe quem
--      mandou cada foto, nem a moderação.
--   4. LINHA AO VIVO DO ATO. Posts escritos na página do ato ficam marcados com ele (rede_posts.ato, coluna do contrato F0) e
--      aparecem numa linha própria, em ORDEM DE CHEGADA, sem ranking. Escrever pede a janela do ato (de 2 horas antes a 24 horas
--      depois do começo); cada post continua com o público dele (rede_ve decide quem vê). Nenhuma localização. Quem escreveu tira o
--      próprio post da linha; a moderação do ato também (vai a interno.auditoria sem o nome de quem escreveu).
--
-- Privacidade (LGPD, Lei 13.709/2018: art. 5º, II e art. 11 — ir a um ato revela opinião política, dado sensível; art. 6º, III —
-- necessidade; art. 46 — segurança): nenhuma função devolve lista de pessoas (quem confirmou, quem mandou foto, quem escreveu fora
-- do post público); as organizações que aparecem são entidades públicas que aceitaram; nada de GPS nem endereço de rede (limites
-- pela conta, interno.limite). ECA Digital (Lei 15.211/2025): escrever exige membro 18+ (interno.rede2_membro).

-- ── 1. Tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_ato_series (
  id uuid primary key default gen_random_uuid(),
  modelo uuid not null unique references interno.rede_chamados (post) on delete cascade,
  frequencia text not null check (frequencia in ('semanal', 'quinzenal', 'mensal')),
  ate date not null,
  excecoes date[] not null default '{}' check (cardinality(excecoes) <= 24),
  criado_em timestamptz not null default now(),
  encerrada_em timestamptz
);
alter table interno.rede_ato_series enable row level security;
revoke all on table interno.rede_ato_series from public;

alter table interno.rede_chamados add column if not exists serie uuid;
alter table interno.rede_chamados add column if not exists serie_data date;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'interno.rede_chamados'::regclass and conname = 'rede_chamados_serie_fk') then
    alter table interno.rede_chamados add constraint rede_chamados_serie_fk foreign key (serie) references interno.rede_ato_series (id) on delete set null;
  end if;
end $$;
create unique index if not exists rede_chamados_serie_data on interno.rede_chamados (serie, serie_data) where serie is not null;

create table if not exists interno.rede_ato_coletivos (
  ato uuid not null references interno.rede_chamados (post) on delete cascade,
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  convidado_em timestamptz not null default now(),
  aceito_em timestamptz,
  primary key (ato, org)
);
create index if not exists rede_ato_coletivos_org on interno.rede_ato_coletivos (org);
alter table interno.rede_ato_coletivos enable row level security;
revoke all on table interno.rede_ato_coletivos from public;

create table if not exists interno.rede_ato_album (
  id uuid primary key default gen_random_uuid(),
  ato uuid not null references interno.rede_chamados (post) on delete cascade,
  -- Quem mandou: só para a própria pessoa ver e apagar as dela e para o limite. NUNCA sai do banco para outra pessoa.
  quem uuid not null references interno.perfis (id) on delete cascade,
  caminho text not null unique check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  largura integer check (largura is null or largura between 1 and 8000),
  altura integer check (altura is null or altura between 1 and 8000),
  legenda text not null default '' check (char_length(legenda) <= 140),
  estado text not null default 'reservada' check (estado in ('reservada', 'pendente', 'aprovada')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists rede_ato_album_ato on interno.rede_ato_album (ato, estado, criado_em);
create index if not exists rede_ato_album_quem on interno.rede_ato_album (quem);
alter table interno.rede_ato_album enable row level security;
revoke all on table interno.rede_ato_album from public;

-- ── 2. Peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Quem modera o ato: quem age como o autor do chamado ou como uma organização que aceitou o convite. */
create or replace function interno.rede_ato_organiza(p_ato uuid, p_quem uuid) returns boolean
language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and (
    exists (select 1 from rede_posts p where p.id = p_ato and interno.rede_age_como(p_quem, p.autor))
    or exists (select 1 from rede_ato_coletivos c where c.ato = p_ato and c.aceito_em is not null and interno.rede_age_como(p_quem, c.org)))
$$;

/** A conta de quem chama, membro 18+ com consentimento (o erro de sempre quando não). */
create or replace function interno.rede_o10_membro() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  return v;
end $$;

/** A data de número n da série (0 = o modelo), no horário de Brasília (a hora do ato não anda com o fuso de quem lê). */
create or replace function interno.rede_ato_serie_inicio(p_inicio timestamptz, p_frequencia text, p_n integer) returns timestamptz
language sql immutable set search_path = interno, pg_temp as $$
  select ((p_inicio at time zone 'America/Sao_Paulo') + case p_frequencia
           when 'semanal' then make_interval(days => 7 * p_n)
           when 'quinzenal' then make_interval(days => 14 * p_n)
           else make_interval(months => p_n) end) at time zone 'America/Sao_Paulo'
$$;

/**
 * Abre as datas da série que ainda não existem nos próximos 35 dias (até 6 por chamada). Cada data é uma cópia do post do modelo
 * (mesmo autor, texto, comunidade, público; a triagem do modelo vale para a cópia: modelo retido, cópia retida) e um chamado com a
 * hora deslocada. Os gatilhos de sempre de rede_posts rodam em cada cópia (a comunidade de avisos também recusa ali). Antes de
 * copiar, as mesmas conferências de quem publica: a autora banida da comunidade ou fora da comunidade fechada, a pessoa por trás da
 * identidade suspensa ou banida, ou a organização sem ninguém que a gira ENCERRA a série (nada mais é aberto em nome dela). Devolve
 * quantas abriu.
 */
create or replace function interno.rede_ato_serie_gerar(p_serie uuid) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  s rede_ato_series; c rede_chamados; m rede_posts; x rede_posts;
  v_n integer := 0; v_abertas integer := 0; v_inicio timestamptz; v_dia date;
begin
  select * into s from rede_ato_series where id = p_serie for update;
  if not found or s.encerrada_em is not null or s.ate < current_date then return 0; end if;
  select * into c from rede_chamados where post = s.modelo;
  select * into m from rede_posts where id = s.modelo;
  if not found or m.apagado_em is not null or m.autor is null or not interno.rede2_membro(m.autor)
     or exists (select 1 from perfis where id = m.autor and suspenso) then
    return 0;
  end if;
  if (m.comunidade is not null and (interno.rede3_com_situacao(m.comunidade, m.autor) = 'banido'
        or not exists (select 1 from rede_comunidades k where k.slug = m.comunidade)
        or (exists (select 1 from rede_comunidades k where k.slug = m.comunidade and k.tipo = 'fechada')
            and not interno.rede2_na_comunidade(m.comunidade, m.autor))))
     -- Identidade: quem está por trás dela suspensa ou banida da comunidade. Organização: sem ninguém que a gira.
     or exists (select 1 from rede_identidades i join perfis d on d.id = i.dono where i.identidade = m.autor
                 and (d.suspenso or (m.comunidade is not null and interno.rede3_com_situacao(m.comunidade, i.dono) = 'banido')))
     or (exists (select 1 from rede_orgs o where o.perfil = m.autor) and not exists (select 1 from rede_org_gestores g where g.org = m.autor)) then
    update rede_ato_series set encerrada_em = now() where id = s.id;
    return 0;
  end if;
  loop
    v_n := v_n + 1;
    exit when v_n > 400;
    v_inicio := interno.rede_ato_serie_inicio(c.inicio, s.frequencia, v_n);
    v_dia := (v_inicio at time zone 'America/Sao_Paulo')::date;
    exit when v_dia > s.ate or v_inicio > now() + interval '35 days' or v_abertas >= 6;
    continue when v_inicio <= now() or v_dia = any (s.excecoes)
      or exists (select 1 from rede_chamados k where k.serie = s.id and k.serie_data = v_dia);
    insert into rede_posts (autor, texto, comunidade, chamado, alcance, aviso, tipo, titulo, publico, nucleo, como, fora_do_fediverso,
                            nao_listado, oculto, retido, motivo)
    values (m.autor, m.texto, m.comunidade,
            jsonb_build_object('tipo', c.tipo, 'quando', v_inicio, 'onde', c.ponto),
            m.alcance, m.aviso, 'chamado', m.titulo, m.publico, m.nucleo, m.como, m.fora_do_fediverso,
            m.nao_listado, m.oculto, m.retido, m.motivo)
    returning * into x;
    insert into rede_chamados (post, inicio, fim, cidade, ponto, tipo, link, titulo, palavra, meta, link_apoio, serie, serie_data)
    values (x.id, v_inicio, case when c.fim is null then null else v_inicio + (c.fim - c.inicio) end, c.cidade, c.ponto, c.tipo, c.link,
            c.titulo, c.palavra, c.meta, c.link_apoio, s.id, v_dia);
    v_abertas := v_abertas + 1;
  end loop;
  return v_abertas;
end $$;

/** A série como a tela recebe: frequência, até quando, exceções e as próximas datas (as já abertas com o id do ato delas). */
create or replace function interno.rede_ato_serie_json(p_serie uuid, p_ato uuid, p_quem uuid) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare s rede_ato_series; c rede_chamados; v_lista jsonb := '[]'::jsonb; v_n integer := -1; v_inicio timestamptz; v_dia date; k rede_chamados; v_id uuid;
begin
  select * into s from rede_ato_series where id = p_serie;
  if not found then return null; end if;
  select * into c from rede_chamados where post = s.modelo;
  loop
    v_n := v_n + 1;
    exit when v_n > 400 or jsonb_array_length(v_lista) >= 6;
    v_inicio := interno.rede_ato_serie_inicio(c.inicio, s.frequencia, v_n);
    v_dia := (v_inicio at time zone 'America/Sao_Paulo')::date;
    exit when v_dia > s.ate or (s.encerrada_em is not null and v_inicio > s.encerrada_em);
    continue when v_inicio < now() - interval '6 hours';
    select * into k from rede_chamados where serie = s.id and serie_data = v_dia;
    v_id := k.post;
    -- Uma data aberta que esta pessoa não pode ver (apagada, retida) aparece só como data, sem link.
    if v_id is not null and not exists (select 1 from rede_posts p where p.id = v_id and p.apagado_em is null and interno.rede_ve(p, p_quem)) then v_id := null; end if;
    v_lista := v_lista || jsonb_build_object(
      'data', v_dia,
      'inicio', coalesce(k.inicio, v_inicio),
      'id', v_id,
      'situacao', case when v_dia = any (s.excecoes) then 'pulada' else coalesce(k.situacao, 'prevista') end,
      'atual', k.post is not null and k.post = p_ato);
  end loop;
  return jsonb_build_object('id', s.id, 'frequencia', s.frequencia, 'ate', s.ate, 'excecoes', to_jsonb(s.excecoes),
    'encerrada', s.encerrada_em is not null, 'modelo', s.modelo = p_ato, 'datas', v_lista);
end $$;

/** As organizações de um ato como a tela recebe: @ e nome (organizações são públicas; pessoas, nunca). */
create or replace function interno.rede_ato_org_json(p_org uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(f.id), 'selo', o.verificada_em is not null)
    from perfis f join rede_orgs o on o.perfil = f.id where f.id = p_org
$$;

/** O que a página do ato mostra além do ato: organizações, série, álbum e linha ao vivo (com o que esta pessoa pode fazer). */
create or replace function interno.rede_ato_mais_json(p interno.rede_posts, p_quem uuid) returns jsonb
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  c rede_chamados;
  v_org boolean := interno.rede_ato_organiza(p.id, p_quem);
  v_autor boolean := p_quem is not null and interno.rede_age_como(p_quem, p.autor);
  v_membro boolean := p_quem is not null and interno.rede2_membro(p_quem);
  v_vou boolean := p_quem is not null and exists (select 1 from rede_vou o where o.post = p.id and o.usuario = p_quem);
  v_aberto boolean;
begin
  select * into c from rede_chamados where post = p.id;
  v_aberto := c.situacao <> 'cancelado' and not p.oculto and not p.retido and p.apagado_em is null;
  return jsonb_build_object(
    'organiza', v_org,
    'chamou', v_autor,
    'coletivos', coalesce((select jsonb_agg(interno.rede_ato_org_json(k.org) order by k.aceito_em)
                             from rede_ato_coletivos k join perfis f on f.id = k.org
                            where k.ato = p.id and k.aceito_em is not null and not f.suspenso), '[]'::jsonb),
    'convites', case when v_autor then coalesce((select jsonb_agg(interno.rede_ato_org_json(k.org) order by k.convidado_em)
                             from rede_ato_coletivos k where k.ato = p.id and k.aceito_em is null), '[]'::jsonb) else '[]'::jsonb end,
    'meus_convites', case when p_quem is null then '[]'::jsonb else coalesce((select jsonb_agg(interno.rede_ato_org_json(k.org) order by k.convidado_em)
                             from rede_ato_coletivos k where k.ato = p.id and k.aceito_em is null and interno.rede_age_como(p_quem, k.org)), '[]'::jsonb) end,
    'minhas_orgs', case when p_quem is null then '[]'::jsonb else coalesce((select jsonb_agg(interno.rede_ato_org_json(k.org) order by k.aceito_em)
                             from rede_ato_coletivos k where k.ato = p.id and k.aceito_em is not null and interno.rede_age_como(p_quem, k.org)), '[]'::jsonb) end,
    'serie', case when c.serie is null then null else interno.rede_ato_serie_json(c.serie, p.id, p_quem) end,
    'pode_repetir', v_autor and c.serie is null and v_aberto and c.inicio > now(),
    'album', jsonb_build_object(
      'aprovadas', (select count(*) from rede_ato_album a where a.ato = p.id and a.estado = 'aprovada'),
      'pendentes', case when v_org then (select count(*) from rede_ato_album a where a.ato = p.id and a.estado = 'pendente') end,
      'pode_enviar', v_membro and v_aberto and (v_vou or v_org) and now() between c.inicio - interval '1 hour' and c.inicio + interval '7 days'),
    'linha', jsonb_build_object(
      'aberta', v_aberto and now() between c.inicio - interval '2 hours' and c.inicio + interval '24 hours',
      'pode_escrever', v_membro and v_aberto and now() between c.inicio - interval '2 hours' and c.inicio + interval '24 hours',
      'desde', c.inicio - interval '2 hours',
      'ate', c.inicio + interval '24 hours'));
end $$;

/** O post do ato, para quem escreve (existe, a pessoa vê, não foi apagado nem retido). */
create or replace function interno.rede_ato_vivo(p_ato uuid, p_quem uuid) returns interno.rede_posts
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare p rede_posts;
begin
  p := interno.rede_ato_achar(p_ato, p_quem);
  if p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  return p;
end $$;

-- ── 3. Ler o que vai além do ato ────────────────────────────────────────────────────────────────────────────────────────────

/** Organizações, série, álbum e linha ao vivo de um ato. Visitante só de ato público na internet (rede_ato_achar decide). */
create or replace function public.rede_ato_mais(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  return interno.rede_ato_mais_json(p, v);
end $$;

-- ── 4. Série ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Só quem chamou. p: {frequencia: semanal|quinzenal|mensal, ate: 'AAAA-MM-DD', excecoes?: ['AAAA-MM-DD', …]}. O ato não pode estar
 * cancelado, nem ter começado, nem já fazer parte de uma série. "ate" fica entre o dia seguinte ao ato e um ano depois dele.
 * Abre as próximas datas e devolve o rede_ato_mais.
 */
create or replace function public.rede_ato_serie_criar(p_ato uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; c rede_chamados; v_freq text; v_ate date; v_exc date[] := '{}'; v_dia date; e text; v_id uuid;
begin
  if p is null or jsonb_typeof(p) is distinct from 'object' then perform interno.erro('invalido:serie'); end if;
  x := interno.rede_ato_vivo(p_ato, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  select * into c from rede_chamados where post = p_ato for update;
  if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  if c.inicio <= now() then perform interno.erro('ato_passou'); end if;
  if c.serie is not null then perform interno.erro('serie_existe'); end if;
  v_freq := btrim(coalesce(p ->> 'frequencia', ''));
  if v_freq not in ('semanal', 'quinzenal', 'mensal') then perform interno.erro('invalido:frequencia'); end if;
  v_dia := (c.inicio at time zone 'America/Sao_Paulo')::date;
  begin
    v_ate := (p ->> 'ate')::date;
  exception when others then perform interno.erro('invalido:ate');
  end;
  if v_ate is null or v_ate <= v_dia or v_ate > v_dia + 365 then perform interno.erro('invalido:ate'); end if;
  if jsonb_typeof(p -> 'excecoes') = 'array' then
    if jsonb_array_length(p -> 'excecoes') > 24 then perform interno.erro('invalido:excecoes'); end if;
    for e in select jsonb_array_elements_text(p -> 'excecoes') loop
      begin
        v_exc := array_append(v_exc, e::date);
      exception when others then perform interno.erro('invalido:excecoes');
      end;
    end loop;
    select coalesce(array_agg(distinct d order by d), '{}') into v_exc from unnest(v_exc) d where d > v_dia and d <= v_ate;
  end if;
  insert into rede_ato_series (modelo, frequencia, ate, excecoes) values (p_ato, v_freq, v_ate, v_exc) returning id into v_id;
  update rede_chamados set serie = v_id, serie_data = v_dia where post = p_ato;
  perform interno.rede_ato_serie_gerar(v_id);
  select * into x from rede_posts where id = p_ato;
  return interno.rede_ato_mais_json(x, v);
end $$;

/**
 * Só quem chamou: pula uma data da série. A data entra nas exceções; se já estava aberta e ainda não começou, aquele ato é cancelado
 * pelo rede_ato_mudar de sempre (avisa só quem confirmou). p_ato é qualquer ato da série; devolve o rede_ato_mais dele.
 */
create or replace function public.rede_ato_serie_pular(p_ato uuid, p_data date) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; c rede_chamados; s rede_ato_series; k rede_chamados; m rede_posts;
begin
  x := interno.rede_ato_achar(p_ato, v);
  select * into c from rede_chamados where post = p_ato;
  if c.serie is null then perform interno.erro('nao_encontrado'); end if;
  select * into s from rede_ato_series where id = c.serie for update;
  select * into m from rede_posts where id = s.modelo;
  if not interno.rede_age_como(v, m.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  if p_data is null or p_data < current_date or p_data > s.ate then perform interno.erro('invalido:data'); end if;
  if cardinality(s.excecoes) >= 24 then perform interno.erro('invalido:excecoes'); end if;
  select * into k from rede_chamados where serie = s.id and serie_data = p_data;
  if k.post is not null and k.inicio <= now() then perform interno.erro('ato_passou'); end if;
  update rede_ato_series set excecoes = (select array_agg(distinct d order by d) from unnest(array_append(excecoes, p_data)) d) where id = s.id;
  if k.post is not null and k.situacao <> 'cancelado' then
    perform public.rede_ato_mudar(k.post, 'cancelado', null, 'Data pulada na série');
  end if;
  select * into x from rede_posts where id = p_ato;
  return interno.rede_ato_mais_json(x, v);
end $$;

/** Só quem chamou: encerra a série. As datas abertas que ainda não começaram são canceladas (avisa só quem confirmou). */
create or replace function public.rede_ato_serie_encerrar(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; c rede_chamados; s rede_ato_series; m rede_posts; r record;
begin
  x := interno.rede_ato_achar(p_ato, v);
  select * into c from rede_chamados where post = p_ato;
  if c.serie is null then perform interno.erro('nao_encontrado'); end if;
  select * into s from rede_ato_series where id = c.serie for update;
  select * into m from rede_posts where id = s.modelo;
  if not interno.rede_age_como(v, m.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_mudar', 20, 60);
  if s.encerrada_em is null then
    update rede_ato_series set encerrada_em = now() where id = s.id;
    for r in select k.post from rede_chamados k where k.serie = s.id and k.inicio > now() and k.situacao <> 'cancelado' loop
      perform public.rede_ato_mudar(r.post, 'cancelado', null, 'Série encerrada');
    end loop;
  end if;
  select * into x from rede_posts where id = p_ato;
  return interno.rede_ato_mais_json(x, v);
end $$;

/** A rodada das séries (pg_cron de hora em hora; só o dono do banco chama): abre as datas que entraram nos próximos 35 dias. */
create or replace function interno.rede_ato_series_rodar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v_n integer := 0; v_series integer := 0;
begin
  for r in select id from rede_ato_series where encerrada_em is null and ate >= current_date order by criado_em limit 2000 loop
    begin
      v_n := v_n + interno.rede_ato_serie_gerar(r.id);
      v_series := v_series + 1;
    exception when others then
      -- Uma série com problema (autor suspenso no meio, comunidade fechada) não para as outras.
      null;
    end;
  end loop;
  return jsonb_build_object('series', v_series, 'abertas', v_n);
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-atos-series', '7 * * * *', 'select interno.rede_ato_series_rodar()');
    perform cron.schedule('alumia-atos-album-faxina', '23 4 * * *', 'select interno.rede_ato_album_faxina()');
  end if;
exception when others then null;
end $$;

-- ── 5. Ato com mais de um coletivo ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Só quem chamou: convida uma organização pelo @ (perfil de organização, não suspenso, sem bloqueio entre as duas, que consegue ver
 * o ato). Cada pessoa que gere a organização recebe um aviso sem o nome de ninguém. Até 8 organizações por ato.
 */
create or replace function public.rede_ato_coletivo_convidar(p_ato uuid, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; c rede_chamados; v_org uuid; r record;
begin
  x := interno.rede_ato_vivo(p_ato, v);
  if not interno.rede_age_como(v, x.autor) then perform interno.erro('so_quem_organizou'); end if;
  perform interno.limite('alumia_ato_coletivo', 30, 60);
  select * into c from rede_chamados where post = p_ato;
  if c.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  if c.inicio < now() - interval '6 hours' then perform interno.erro('ato_passou'); end if;
  select f.id into v_org from perfis f join rede_orgs o on o.perfil = f.id
   where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not f.suspenso;
  if v_org is null or v_org = x.autor or interno.rede_bloqueado(v_org, x.autor) or not interno.rede_ve(x, v_org) then
    perform interno.erro('nao_encontrado');
  end if;
  if exists (select 1 from rede_ato_coletivos where ato = p_ato and org = v_org) then perform interno.erro('ja_convidada'); end if;
  if (select count(*) from rede_ato_coletivos where ato = p_ato) >= 8 then perform interno.erro('invalido:coletivos'); end if;
  insert into rede_ato_coletivos (ato, org) values (p_ato, v_org);
  for r in select g.gestor from rede_org_gestores g where g.org = v_org and g.gestor <> v loop
    if interno.rede2_membro(r.gestor) and interno.rede_ve(x, r.gestor) then
      perform interno.rede3_aviso_criar(r.gestor, 'chamado', p_ato, null, null, 'Uma organização que você gere foi convidada para chamar um ato junto. Aceite ou recuse na página do ato.');
    end if;
  end loop;
  return interno.rede_ato_mais_json(x, v);
end $$;

/** Quem gere a organização convidada aceita (ela passa a aparecer no ato) ou recusa (o convite some). */
create or replace function public.rede_ato_coletivo_responder(p_ato uuid, p_handle text, p_aceito boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; v_org uuid;
begin
  x := interno.rede_ato_achar(p_ato, v);
  perform interno.limite('alumia_ato_coletivo', 30, 60);
  select k.org into v_org from rede_ato_coletivos k join perfis f on f.id = k.org
   where k.ato = p_ato and k.aceito_em is null and f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_org is null or not interno.rede_age_como(v, v_org) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceito, false) then
    update rede_ato_coletivos set aceito_em = now() where ato = p_ato and org = v_org;
  else
    delete from rede_ato_coletivos where ato = p_ato and org = v_org;
  end if;
  return interno.rede_ato_mais_json(x, v);
end $$;

/** A organização sai do ato (quem a gere) ou quem chamou tira o convite/a organização. */
create or replace function public.rede_ato_coletivo_tirar(p_ato uuid, p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; v_org uuid;
begin
  x := interno.rede_ato_achar(p_ato, v);
  perform interno.limite('alumia_ato_coletivo', 30, 60);
  select k.org into v_org from rede_ato_coletivos k join perfis f on f.id = k.org
   where k.ato = p_ato and f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_org is null or not (interno.rede_age_como(v, v_org) or interno.rede_age_como(v, x.autor)) then perform interno.erro('nao_encontrado'); end if;
  delete from rede_ato_coletivos where ato = p_ato and org = v_org;
  return interno.rede_ato_mais_json(x, v);
end $$;

-- ── 6. Álbum coletivo ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Uma foto do álbum como a tela recebe. Nunca quem mandou: só `minha` (para a própria pessoa) e o estado (para ela e a moderação). */
create or replace function interno.rede_ato_album_foto_json(a interno.rede_ato_album, p_quem uuid, p_org boolean) returns jsonb
language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', a.id, 'largura', a.largura, 'altura', a.altura, 'legenda', a.legenda,
    'minha', p_quem is not null and a.quem = p_quem,
    'estado', case when p_org or a.quem = p_quem then a.estado else 'aprovada' end,
    'criado_em', date_trunc('hour', a.criado_em))
$$;

/**
 * O álbum de um ato: as fotos aprovadas (para quem vê o ato), mais as próprias pendentes (para quem mandou) e todas as pendentes
 * (para a moderação do ato). Ordem de chegada. Devolve {organiza, pode_enviar, fotos, pendentes}.
 */
create or replace function public.rede_ato_album(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; v_org boolean; v_mais jsonb;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  v_org := interno.rede_ato_organiza(p_ato, v);
  v_mais := interno.rede_ato_mais_json(p, v);
  return jsonb_build_object(
    'organiza', v_org,
    'pode_enviar', (v_mais -> 'album' ->> 'pode_enviar')::boolean,
    'fotos', coalesce((select jsonb_agg(interno.rede_ato_album_foto_json(a, v, v_org) order by a.criado_em, a.id)
                         from (select * from rede_ato_album where ato = p_ato and (estado = 'aprovada' or (estado = 'pendente' and quem = v))
                                order by criado_em, id limit 300) a), '[]'::jsonb),
    'pendentes', case when v_org then coalesce((select jsonb_agg(interno.rede_ato_album_foto_json(a, v, true) order by a.criado_em, a.id)
                         from (select * from rede_ato_album where ato = p_ato and estado = 'pendente' order by criado_em, id limit 100) a), '[]'::jsonb)
                      else '[]'::jsonb end);
end $$;

/**
 * Reserva o lugar de uma foto (a rota app/api/rede/album chama, com o token da pessoa, depois de tirar o metadado). Só quem
 * confirmou presença ou modera o ato; ato não cancelado; de 1 hora antes a 7 dias depois do começo. p_conferida = a pessoa declarou
 * que todo rosto foi borrado no aparelho (sem isso, recusa). Até 20 fotos por pessoa e 300 por ato. Devolve {id, caminho}.
 */
create or replace function public.rede_ato_album_reservar(p_ato uuid, p_ext text, p_largura integer, p_altura integer, p_legenda text, p_conferida boolean)
returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; v_mais jsonb; v_id uuid := gen_random_uuid(); v_cam text;
  v_leg text := regexp_replace(btrim(coalesce(p_legenda, '')), '\s+', ' ', 'g');
begin
  if not coalesce(p_conferida, false) then perform interno.erro('rostos_nao_conferidos'); end if;
  if p_ext is null or p_ext not in ('jpg', 'png', 'webp') then perform interno.erro('invalido:arquivo'); end if;
  if p_largura is not null and p_largura not between 1 and 8000 or p_altura is not null and p_altura not between 1 and 8000 then perform interno.erro('invalido:arquivo'); end if;
  if char_length(v_leg) > 140 or v_leg ~ '[<>]' then perform interno.erro('invalido:legenda'); end if;
  if interno.rede3_pub_dado_pessoal(v_leg) then perform interno.erro('dado_pessoal'); end if;
  x := interno.rede_ato_vivo(p_ato, v);
  v_mais := interno.rede_ato_mais_json(x, v);
  if not coalesce((v_mais -> 'album' ->> 'pode_enviar')::boolean, false) then perform interno.erro('album_fechado'); end if;
  perform interno.limite('alumia_ato_album', 40, 60);
  if (select count(*) from rede_ato_album where ato = p_ato and quem = v) >= 20 then perform interno.erro('invalido:fotos'); end if;
  if (select count(*) from rede_ato_album where ato = p_ato) >= 300 then perform interno.erro('invalido:fotos_do_ato'); end if;
  v_cam := p_ato::text || '/' || v_id::text || '.' || p_ext;
  insert into rede_ato_album (id, ato, quem, caminho, largura, altura, legenda) values (v_id, p_ato, v, v_cam, p_largura, p_altura, v_leg);
  return jsonb_build_object('id', v_id, 'caminho', v_cam);
end $$;

/**
 * A foto chegou ao depósito: vai para a fila da moderação do ato. Onde há depósito, confere que o arquivo existe (e só o servidor,
 * depois de limpar, grava lá). Nenhuma foto sai aprovada sozinha, nem a de quem organiza: a moderação do ato confere cada uma na
 * fila. Quem chamou o ato recebe um aviso (sem o nome de ninguém) quando a fila estava vazia.
 */
create or replace function public.rede_ato_album_enviada(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); a rede_ato_album; p rede_posts; v_ok boolean := true; v_fila boolean;
begin
  select * into a from rede_ato_album where id = p_id and quem = v and estado = 'reservada' for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''rede-album'' and name = $1)' into v_ok using a.caminho;
  end if;
  if not v_ok then perform interno.erro('invalido:arquivo'); end if;
  v_fila := exists (select 1 from rede_ato_album where ato = a.ato and estado = 'pendente');
  update rede_ato_album set estado = 'pendente' where id = p_id returning * into a;
  select * into p from rede_posts where id = a.ato;
  if not v_fila and p.autor is not null and p.autor <> v and interno.rede2_membro(p.autor) then
    perform interno.rede3_aviso_criar(p.autor, 'chamado', a.ato, null, null, 'Há fotos novas esperando a sua conferência no álbum de um ato.');
  end if;
  return interno.rede_ato_album_foto_json(a, v, false);
end $$;

/** A moderação do ato aprova (a foto aparece para quem vê o ato) ou recusa (o registro some). Vai a interno.auditoria, sem quem mandou. */
create or replace function public.rede_ato_album_decidir(p_id uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); a rede_ato_album;
begin
  select * into a from rede_ato_album where id = p_id and estado in ('pendente', 'aprovada') for update;
  if not found or not interno.rede_ato_organiza(a.ato, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_ato_album_mod', 300, 60);
  if coalesce(p_aprovar, false) then
    update rede_ato_album set estado = 'aprovada', decidido_em = now() where id = p_id;
  else
    delete from rede_ato_album where id = p_id;
    insert into auditoria (quem, nome, acao, alvo, detalhes)
    values (v, '', 'ato_foto_tirada', a.ato::text, jsonb_build_object('estava', a.estado));
  end if;
  return public.rede_ato_album(a.ato);
end $$;

/** Quem mandou apaga a própria foto (em qualquer estado). Devolve o álbum. */
create or replace function public.rede_ato_album_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); a rede_ato_album;
begin
  delete from rede_ato_album where id = p_id and quem = v returning * into a;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return public.rede_ato_album(a.ato);
end $$;

/** Onde está a foto (depósito e caminho), se esta pessoa pode vê-la: aprovada e o ato visível, ou dela, ou da moderação do ato. */
create or replace function public.rede_ato_album_caminho(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); a rede_ato_album;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_atos_ler', 300, 60);
  select * into a from rede_ato_album where id = p_id and estado <> 'reservada';
  if not found or not public.rede_ato_album_pode_ver(a.caminho) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('bucket', 'rede-album', 'caminho', a.caminho);
end $$;

/** Regra de leitura do depósito "rede-album": a mesma do caminho acima (a matriz decide; o caminho não diz nada de ninguém). */
create or replace function public.rede_ato_album_pode_ver(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (
    select 1 from rede_ato_album a join rede_posts p on p.id = a.ato
     where a.caminho = p_caminho and a.estado <> 'reservada' and p.apagado_em is null
       and ((a.estado = 'aprovada' and interno.rede_ve(p, auth.uid()))
            or a.quem = auth.uid()
            or interno.rede_ato_organiza(a.ato, auth.uid())))
$$;

/**
 * Antiga regra de envio do depósito. Não há mais regra de envio para quem tem conta (só o servidor grava, depois de limpar); a
 * função fica, respondendo sempre "não", para nenhuma política antiga que ainda a chame deixar passar.
 */
create or replace function public.rede_ato_album_pode_enviar(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select false and p_caminho is not null
$$;

/** Regra de remoção do depósito: a própria foto (para apagar antes de tirar o registro). */
create or replace function public.rede_ato_album_pode_apagar(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from rede_ato_album a where a.caminho = p_caminho and a.quem = auth.uid())
$$;

/**
 * Faxina (pg_cron; só o dono do banco): a reserva que nunca virou foto, depois de 1 dia. Se há arquivo órfão no álbum ou no acervo
 * do núcleo, chama a rota da faxina dos arquivos (a mesma de "Meus dados", pelo pg_net, com o mesmo endereço e segredo), que os tira
 * do depósito com a chave de serviço.
 */
create or replace function interno.rede_ato_album_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer; v_url text; v_segredo text; v_tem boolean;
begin
  delete from rede_ato_album where estado = 'reservada' and criado_em < now() - interval '1 day';
  get diagnostics v_n = row_count;
  v_tem := exists (select 1 from interno.rede_ato_album_orfas(1));
  if not v_tem and to_regprocedure('public.rede_acervo_orfaos(integer)') is not null then
    execute 'select exists (select 1 from public.rede_acervo_orfaos(1))' into v_tem;
  end if;
  if v_tem and exists (select 1 from pg_extension where extname = 'pg_net') then
    v_url := coalesce(nullif((select valor ->> 'faxina' from configuracoes where chave = 'meus_dados'), ''), interno.endereco() || '/api/rede/exportar/faxina');
    v_segredo := coalesce((select valor ->> 'segredo' from configuracoes where chave = 'meus_dados'), '');
    if v_url ~ '^https://[a-z0-9.-]+(:[0-9]+)?/api/rede/exportar/faxina$' then
      begin
        execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 60000)'
          using v_url, jsonb_build_object('Content-Type', 'application/json', 'x-lucia-segredo', v_segredo);
      exception when others then null;
      end;
    end if;
  end if;
  return v_n;
end $$;

/**
 * Para a faxina dos arquivos (só a chave de serviço): os arquivos de "rede-album" sem registro (recusados, apagados, de conta
 * apagada, reserva vencida) com mais de 1 dia. Sem depósito (banco local), lista vazia.
 */
create or replace function interno.rede_ato_album_orfas(p_limite integer default 500) returns setof text language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  return query execute 'select o.name from storage.objects o where o.bucket_id = ''rede-album'' and o.created_at < now() - interval ''1 day''
                          and not exists (select 1 from interno.rede_ato_album a where a.caminho = o.name) order by o.created_at limit $1'
    using least(greatest(coalesce(p_limite, 500), 1), 2000);
end $$;

/** A mesma lista para a rota da faxina (só a chave de serviço chama; o PostgREST só enxerga o esquema public). */
create or replace function public.rede_ato_album_orfas(p_limite integer default 500) returns setof text language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.rede_ato_album_orfas(p_limite)
$$;

-- O depósito do álbum: privado, só imagem, 3 MB. Sem Storage (teste local), nada.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('rede-album', 'rede-album', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    -- Sem regra de envio: só a rota do servidor grava, com a chave de serviço, o arquivo que ela mesma limpou.
    execute 'drop policy if exists "rede_album_envio" on storage.objects';
    execute 'drop policy if exists "rede_album_leitura" on storage.objects';
    execute 'create policy "rede_album_leitura" on storage.objects for select to anon, authenticated using (bucket_id = ''rede-album'' and public.rede_ato_album_pode_ver(name))';
    execute 'drop policy if exists "rede_album_remocao" on storage.objects';
    execute 'create policy "rede_album_remocao" on storage.objects for delete to authenticated using (bucket_id = ''rede-album'' and public.rede_ato_album_pode_apagar(name))';
  end if;
end $$;

-- ── 7. Linha ao vivo ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Escreve na linha ao vivo do ato: publica pelo rede_publicar de sempre (todas as conferências dele: membro 18+, codinome, limite,
 * dado pessoal, comunidade, triagem), na comunidade do ato, e marca o post com o ato na mesma transação. Só dentro da janela (2 h
 * antes a 24 h depois do começo) e com o ato não cancelado. Texto puro, sem prévia de link nem imagem (as fotos vão pelo álbum).
 */
create or replace function public.rede_ato_linha_publicar(p_ato uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); x rede_posts; v_mais jsonb; v_post jsonb; v_id uuid;
begin
  x := interno.rede_ato_vivo(p_ato, v);
  v_mais := interno.rede_ato_mais_json(x, v);
  if not coalesce((v_mais -> 'linha' ->> 'pode_escrever')::boolean, false) then perform interno.erro('linha_fechada'); end if;
  v_post := public.rede_publicar(jsonb_strip_nulls(jsonb_build_object('tipo', 'post', 'texto', p_texto, 'comunidade', x.comunidade)));
  v_id := (v_post ->> 'id')::uuid;
  update rede_posts set ato = p_ato where id = v_id and autor = v and resposta_a is null;
  if not found then perform interno.erro('invalido:post'); end if;
  return interno.rede_post_v2((select r from rede_posts r where r.id = v_id), v);
end $$;

/**
 * A linha ao vivo de um ato: os posts marcados com ele, em ORDEM DE CHEGADA (o mais antigo primeiro), só os que esta pessoa pode
 * ver (rede_ve, silenciados de fora). p_depois = cursor "<criado_em ISO>|<id>" para buscar só o que chegou depois. Até 40 por vez.
 * Devolve {itens, proximo} (proximo = cursor do último item; nulo quando a página veio vazia).
 */
create or replace function public.rede_ato_linha(p_ato uuid, p_depois text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); p rede_posts; v_t timestamptz; v_id uuid; v_itens jsonb; v_ult jsonb;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('alumia_atos_ler', 300, 60);
  p := interno.rede_ato_achar(p_ato, v);
  if nullif(p_depois, '') is not null then
    begin
      v_t := split_part(p_depois, '|', 1)::timestamptz;
      v_id := split_part(p_depois, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  select coalesce(jsonb_agg(interno.rede_post_v2(r, v) order by r.criado_em, r.id), '[]'::jsonb) into v_itens
    from rede_posts r where r.id in (
      select q.id from rede_posts q
       where q.ato = p_ato and q.resposta_a is null and q.apagado_em is null
         and (v_t is null or (q.criado_em, q.id) > (v_t, v_id))
         and interno.rede_ve(q, v) and not interno.rede_silenciado(q, v)
       order by q.criado_em, q.id limit 40);
  v_ult := v_itens -> (jsonb_array_length(v_itens) - 1);
  return jsonb_build_object('itens', v_itens,
    'proximo', case when v_ult is null then nullif(p_depois, '') else (v_ult ->> 'criado_em') || '|' || (v_ult ->> 'id') end);
end $$;

/** Tira um post da linha do ato (o post continua existindo): quem escreveu, ou a moderação do ato (vai a interno.auditoria). */
create or replace function public.rede_ato_linha_tirar(p_post uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_o10_membro(); q rede_posts;
begin
  select * into q from rede_posts where id = p_post and ato is not null for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_ato_linha_mod', 120, 60);
  if interno.rede_age_como(v, q.autor) then
    update rede_posts set ato = null where id = p_post;
  elsif interno.rede_ato_organiza(q.ato, v) then
    update rede_posts set ato = null where id = p_post;
    insert into auditoria (quem, nome, acao, alvo, detalhes) values (v, '', 'ato_linha_tirada', q.ato::text, jsonb_build_object('post', q.id));
  else
    perform interno.erro('nao_encontrado');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 8. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_ato_organiza(uuid, uuid), interno.rede_o10_membro(), interno.rede_ato_serie_inicio(timestamptz, text, integer),
  interno.rede_ato_serie_gerar(uuid), interno.rede_ato_serie_json(uuid, uuid, uuid), interno.rede_ato_org_json(uuid),
  interno.rede_ato_mais_json(interno.rede_posts, uuid), interno.rede_ato_vivo(uuid, uuid), interno.rede_ato_series_rodar(),
  interno.rede_ato_album_foto_json(interno.rede_ato_album, uuid, boolean), interno.rede_ato_album_faxina(), interno.rede_ato_album_orfas(integer) from public;
revoke all on function public.rede_ato_mais(uuid), public.rede_ato_serie_criar(uuid, jsonb), public.rede_ato_serie_pular(uuid, date),
  public.rede_ato_serie_encerrar(uuid), public.rede_ato_coletivo_convidar(uuid, text), public.rede_ato_coletivo_responder(uuid, text, boolean),
  public.rede_ato_coletivo_tirar(uuid, text), public.rede_ato_album(uuid),
  public.rede_ato_album_reservar(uuid, text, integer, integer, text, boolean), public.rede_ato_album_enviada(uuid),
  public.rede_ato_album_decidir(uuid, boolean), public.rede_ato_album_apagar(uuid), public.rede_ato_album_caminho(uuid),
  public.rede_ato_album_pode_ver(text), public.rede_ato_album_pode_enviar(text), public.rede_ato_album_pode_apagar(text),
  public.rede_ato_linha_publicar(uuid, text), public.rede_ato_linha(uuid, text), public.rede_ato_linha_tirar(uuid),
  public.rede_ato_album_orfas(integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_ato_series, interno.rede_ato_coletivos, interno.rede_ato_album from anon, authenticated;
    revoke all on function interno.rede_ato_organiza(uuid, uuid), interno.rede_o10_membro(), interno.rede_ato_serie_inicio(timestamptz, text, integer),
      interno.rede_ato_serie_gerar(uuid), interno.rede_ato_serie_json(uuid, uuid, uuid), interno.rede_ato_org_json(uuid),
      interno.rede_ato_mais_json(interno.rede_posts, uuid), interno.rede_ato_vivo(uuid, uuid), interno.rede_ato_series_rodar(),
      interno.rede_ato_album_foto_json(interno.rede_ato_album, uuid, boolean), interno.rede_ato_album_faxina(), interno.rede_ato_album_orfas(integer)
      from anon, authenticated;
    -- Ler: visitante também (só de ato público na internet; rede_ato_achar decide). As regras do depósito: anon e authenticated.
    grant execute on function public.rede_ato_mais(uuid), public.rede_ato_album(uuid), public.rede_ato_album_caminho(uuid),
      public.rede_ato_linha(uuid, text), public.rede_ato_album_pode_ver(text) to anon, authenticated, service_role;
    grant execute on function public.rede_ato_serie_criar(uuid, jsonb), public.rede_ato_serie_pular(uuid, date), public.rede_ato_serie_encerrar(uuid),
      public.rede_ato_coletivo_convidar(uuid, text), public.rede_ato_coletivo_responder(uuid, text, boolean), public.rede_ato_coletivo_tirar(uuid, text),
      public.rede_ato_album_reservar(uuid, text, integer, integer, text, boolean), public.rede_ato_album_enviada(uuid),
      public.rede_ato_album_decidir(uuid, boolean), public.rede_ato_album_apagar(uuid), public.rede_ato_album_pode_enviar(text),
      public.rede_ato_album_pode_apagar(text), public.rede_ato_linha_publicar(uuid, text), public.rede_ato_linha_tirar(uuid)
      to authenticated, service_role;
    revoke all on function public.rede_ato_serie_criar(uuid, jsonb), public.rede_ato_serie_pular(uuid, date), public.rede_ato_serie_encerrar(uuid),
      public.rede_ato_coletivo_convidar(uuid, text), public.rede_ato_coletivo_responder(uuid, text, boolean), public.rede_ato_coletivo_tirar(uuid, text),
      public.rede_ato_album_reservar(uuid, text, integer, integer, text, boolean), public.rede_ato_album_enviada(uuid),
      public.rede_ato_album_decidir(uuid, boolean), public.rede_ato_album_apagar(uuid), public.rede_ato_album_pode_enviar(text),
      public.rede_ato_album_pode_apagar(text), public.rede_ato_linha_publicar(uuid, text), public.rede_ato_linha_tirar(uuid) from anon;
    revoke all on function public.rede_ato_album_orfas(integer) from anon, authenticated;
    grant execute on function interno.rede_ato_album_orfas(integer), public.rede_ato_album_orfas(integer) to service_role;
  end if;
end $$;

-- As funções novas passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
select interno.alumia_trancar();
