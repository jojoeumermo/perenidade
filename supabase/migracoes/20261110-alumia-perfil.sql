-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- ═══════════════════════════ Alumia · Perfil livre (10/11/2026) ═══════════════════════════
-- docs/plano-2026-11/ALUMIA-ATE-O-FIM.md (A5) e ALUMIA-FUNCOES-E-IDEIAS.md §3.1 e §6 (Onda A, F4). "Liberdade pro usuário editar o
-- perfil dele como quiser", com segurança: a aparência do perfil é um jsonb em perfis.rede_aparencia em que CADA chave é uma
-- escolha entre valores conhecidos ou um valor conferido por expressão regular (cor "#rrggbb", rosto de 64 dígitos, palavra A–Z).
-- Nunca CSS, HTML ou URL livre: o link de "tocando agora" é https, sem usuário/senha e sem parâmetro de rastreio. Também: campos
-- do perfil até 6 (eram 4), posts fixados (até 3, só da própria pessoa), destaques (post ou ato da própria pessoa, até 6) e
-- organizações que a pessoa ESCOLHE mostrar (só com selo). E o Tear de encaminhamentos das organizações (Onda A, F4): cada
-- deliberação vira um fio com uma FUNÇÃO responsável (nunca uma pessoa), prazo e estado; o público vê só o agregado.
--
-- Idempotente: scripts/testar-alumia-perfil.mjs roda duas vezes no banco local. Depende da F4 (20261109-alumia-f4.sql). NÃO rodar
-- em produção sem o Jonathan.
--
-- Leis (conferidas no texto, leis-do-brasil):
--  - LGPD (Lei 13.709/2018) art. 5º, II e art. 11: filiação a organização política é dado SENSÍVEL. Por isso "organizações no
--    perfil" é opt-in, a pessoa escreve uma a uma, e nada é deduzido de seguir, de núcleo ou de voto.
--  - LGPD art. 6º, III (necessidade): a aparência não guarda nada sobre a pessoa além do que ela escolheu mostrar; "tocando agora" é
--    só texto e um link, a Alumia não liga em serviço de música (sem rastreio) e o texto some sozinho no prazo.
--  - LGPD art. 46 (segurança): RLS ligada, nenhuma permissão direta nas tabelas; acesso só por função security definer.
--  - ECA Digital (Lei 15.211/2025) art. 9º § 1º: editar exige ser membro da Rede (18+ e consentimento), como o resto da F4.

-- ── 1. Colunas e tabelas ──────────────────────────────────────────────────────────────────────────────────────────────────
alter table interno.perfis add column if not exists rede_aparencia jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_rede_aparencia_tamanho') then
    alter table interno.perfis add constraint perfis_rede_aparencia_tamanho check (pg_column_size(rede_aparencia) <= 8192);
  end if;
  -- Campos do perfil: até 6 (o Mastodon dá 4; aqui a pessoa pediu mais liberdade).
  if exists (select 1 from pg_constraint where conname = 'rede_perfil_campos_ordem_check') then
    alter table interno.rede_perfil_campos drop constraint rede_perfil_campos_ordem_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rede_perfil_campos_ordem_6') then
    alter table interno.rede_perfil_campos add constraint rede_perfil_campos_ordem_6 check (ordem between 1 and 6);
  end if;
end $$;

-- O Tear de encaminhamentos: um fio por deliberação. `funcao` é o NOME DA FUNÇÃO (tesouraria, comunicação), nunca uma pessoa.
create table if not exists interno.rede_org_encaminhamentos (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 3 and 200),
  funcao text not null check (char_length(btrim(funcao)) between 2 and 40),
  prazo date not null,
  estado text not null default 'aberto' check (estado in ('aberto', 'cumprido', 'retirado')),
  -- Só o dia (LGPD art. 6º, III): nada de hora nem de quem marcou.
  criado_dia date not null default current_date,
  cumprido_dia date
);
create index if not exists rede_org_encaminhamentos_org on interno.rede_org_encaminhamentos (org, criado_dia desc);
alter table interno.rede_org_encaminhamentos enable row level security;
do $$
begin
  revoke all on table interno.rede_org_encaminhamentos from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_org_encaminhamentos from anon, authenticated;
  end if;
end $$;

-- ── 2. A aparência: conferir e arrumar ────────────────────────────────────────────────────────────────────────────────────

/**
 * Confere a aparência pedida por `p_dono` e devolve a forma guardada. Recusa (erro 'invalido:<chave>') o que não for um dos
 * valores conhecidos; chave desconhecida também é recusada (ninguém guarda nada fora da lista). Espelho de lib/rede/aparencia.ts.
 */
create or replace function interno.alumia_aparencia_valida(p jsonb, p_dono uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  k text; r jsonb := '{}'::jsonb; x jsonb; v text; i integer; n integer;
  paleta constant text[] := array['vermelho', 'dourado', 'azul', 'verde', 'rosa', 'laranja', 'turquesa', 'roxo'];
  abas constant text[] := array['posts', 'respostas', 'midia', 'atos', 'destaques', 'organizacoes', 'escola'];
  rastreio constant text := '(^|[?&])(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_[a-z]+|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|yclid|twclid|ttclid|s_cid|mkt_tok)=';
  vistos text[];
begin
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:aparencia'); end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('acento', 'tema', 'layout', 'faixa', 'rosto', 'capa', 'abas', 'fixados', 'destaques', 'orgs', 'tocando') then
      perform interno.erro('invalido:aparencia');
    end if;
  end loop;

  -- Cor: nome da paleta ou "#rrggbb" (o contraste é garantido na tela, que clareia ou escurece até 4,5:1 em cada fundo).
  if p ? 'acento' then
    v := p ->> 'acento';
    if v is null or not (v = any (paleta) or v ~ '^#[0-9a-f]{6}$') then perform interno.erro('invalido:acento'); end if;
    r := r || jsonb_build_object('acento', v);
  end if;
  if p ? 'tema' then
    if coalesce(p ->> 'tema', '') not in ('brasa', 'tingido', 'papel', 'noite') then perform interno.erro('invalido:tema'); end if;
    r := r || jsonb_build_object('tema', p ->> 'tema');
  end if;
  if p ? 'layout' then
    if coalesce(p ->> 'layout', '') not in ('classico', 'centro', 'cartaz') then perform interno.erro('invalido:layout'); end if;
    r := r || jsonb_build_object('layout', p ->> 'layout');
  end if;
  -- Faixa: 11 fios, cada um um índice de 0 a 9.
  if p ? 'faixa' then
    x := p -> 'faixa';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) <> 11 then perform interno.erro('invalido:faixa'); end if;
    for i in 0 .. 10 loop
      if jsonb_typeof(x -> i) <> 'number' or (x ->> i) !~ '^[0-9]$' then perform interno.erro('invalido:faixa'); end if;
    end loop;
    r := r || jsonb_build_object('faixa', x);
  end if;
  -- Rosto de pixels: 64 dígitos, ao menos 6 cheios; ou nulo.
  if p ? 'rosto' then
    if jsonb_typeof(p -> 'rosto') = 'null' then r := r || jsonb_build_object('rosto', null);
    else
      v := p ->> 'rosto';
      if jsonb_typeof(p -> 'rosto') <> 'string' or v !~ '^[0-9]{64}$' or char_length(replace(v, '0', '')) < 6 then perform interno.erro('invalido:rosto'); end if;
      r := r || jsonb_build_object('rosto', v);
    end if;
  end if;
  -- Capa em mosaico: palavra A–Z/0–9/espaço até 10 e semente 0..9999; ou nula.
  if p ? 'capa' then
    x := p -> 'capa';
    if jsonb_typeof(x) = 'null' then r := r || jsonb_build_object('capa', null);
    else
      if jsonb_typeof(x) <> 'object' or (x ->> 'tipo') is distinct from 'mosaico' or coalesce(x ->> 'palavra', '~') !~ '^[A-Z0-9 ]{0,10}$'
         or jsonb_typeof(x -> 'semente') <> 'number' or (x ->> 'semente') !~ '^[0-9]{1,4}$'
         or (select count(*) from jsonb_object_keys(x)) <> 3 then
        perform interno.erro('invalido:capa');
      end if;
      r := r || jsonb_build_object('capa', jsonb_build_object('tipo', 'mosaico', 'palavra', x ->> 'palavra', 'semente', (x ->> 'semente')::integer));
    end if;
  end if;
  -- Abas: só as conhecidas, sem repetir, com "posts".
  if p ? 'abas' then
    x := p -> 'abas';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 7 then perform interno.erro('invalido:abas'); end if;
    vistos := '{}';
    for v in select value #>> '{}' from jsonb_array_elements(x) loop
      if v is null or not (v = any (abas)) or v = any (vistos) then perform interno.erro('invalido:abas'); end if;
      vistos := vistos || v;
    end loop;
    if not ('posts' = any (vistos)) then perform interno.erro('invalido:abas'); end if;
    r := r || jsonb_build_object('abas', to_jsonb(vistos));
  end if;
  -- Fixados: até 3 posts DA PRÓPRIA PESSOA, que não sejam repost nem estejam retidos/ocultos.
  if p ? 'fixados' then
    x := p -> 'fixados';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 3 then perform interno.erro('invalido:fixados'); end if;
    vistos := '{}';
    for v in select value #>> '{}' from jsonb_array_elements(x) loop
      if v is null or v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or v = any (vistos)
         or not exists (select 1 from rede_posts where id = v::uuid and autor = p_dono and repost_de is null and not oculto and not retido) then
        perform interno.erro('invalido:fixados');
      end if;
      vistos := vistos || v;
    end loop;
    r := r || jsonb_build_object('fixados', to_jsonb(vistos));
  end if;
  -- Destaques: até 6, post ou ato da própria pessoa, título 1..40, cor da paleta.
  if p ? 'destaques' then
    x := p -> 'destaques';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 6 then perform interno.erro('invalido:destaques'); end if;
    vistos := '{}';
    for i in 0 .. jsonb_array_length(x) - 1 loop
      if jsonb_typeof(x -> i) <> 'object' or (select count(*) from jsonb_object_keys(x -> i)) <> 4
         or coalesce(x -> i ->> 'tipo', '') not in ('post', 'ato') or coalesce(x -> i ->> 'cor', '') <> all (paleta)
         or char_length(btrim(coalesce(x -> i ->> 'titulo', ''))) not between 1 and 40 or (x -> i ->> 'titulo') ~ '[\x00-\x1f<>]'
         or coalesce(x -> i ->> 'ref', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (x -> i ->> 'ref') = any (vistos)
         or not exists (select 1 from rede_posts where id = (x -> i ->> 'ref')::uuid and autor = p_dono and not oculto and not retido
                        and ((x -> i ->> 'tipo') = 'post' or chamado is not null)) then
        perform interno.erro('invalido:destaques');
      end if;
      vistos := vistos || (x -> i ->> 'ref');
    end loop;
    r := r || jsonb_build_object('destaques', (select coalesce(jsonb_agg(jsonb_build_object('tipo', e ->> 'tipo', 'ref', e ->> 'ref', 'titulo', btrim(e ->> 'titulo'), 'cor', e ->> 'cor') order by o), '[]'::jsonb) from jsonb_array_elements(x) with ordinality as t(e, o)));
  end if;
  -- Organizações que a pessoa escolhe mostrar: até 6 @ de organizações COM SELO (opt-in, LGPD art. 11).
  if p ? 'orgs' then
    x := p -> 'orgs';
    if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 6 then perform interno.erro('invalido:orgs'); end if;
    vistos := '{}';
    for v in select value #>> '{}' from jsonb_array_elements(x) loop
      if v is null or v !~ '^[a-z0-9_]{3,20}$' or v = any (vistos)
         or not exists (select 1 from rede_orgs o join perfis f on f.id = o.perfil where f.rede_handle = v and o.verificada_em is not null) then
        perform interno.erro('invalido:orgs');
      end if;
      vistos := vistos || v;
    end loop;
    r := r || jsonb_build_object('orgs', to_jsonb(vistos));
  end if;
  -- "Tocando agora": texto até 80, link https limpo (ou nulo) e prazo entre agora e 30 dias.
  if p ? 'tocando' then
    x := p -> 'tocando';
    if jsonb_typeof(x) = 'null' then r := r || jsonb_build_object('tocando', null);
    else
      if jsonb_typeof(x) <> 'object' or char_length(btrim(coalesce(x ->> 'texto', ''))) not between 1 and 80 or (x ->> 'texto') ~ '[\x00-\x1f<>]' then
        perform interno.erro('invalido:tocando');
      end if;
      v := nullif(x ->> 'link', '');
      if v is not null and (char_length(v) > 200 or v !~ '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s<>"''`]*)?$' or v ~* rastreio) then
        perform interno.erro('invalido:tocando');
      end if;
      begin
        if (x ->> 'ate')::timestamptz <= now() or (x ->> 'ate')::timestamptz > now() + interval '30 days 1 minute' then perform interno.erro('invalido:tocando'); end if;
      exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then perform interno.erro('invalido:tocando');
      end;
      r := r || jsonb_build_object('tocando', jsonb_build_object('texto', btrim(x ->> 'texto'), 'link', v, 'ate', (x ->> 'ate')::timestamptz));
    end if;
  end if;
  return r;
end $$;

-- ── 3. Ler e editar ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A aparência do perfil de alguém: a mesma matriz de rede_perfil_extras (invisível, bloqueado ou suspenso = nulo; visitante só
 * vê de organização com selo). "Tocando agora" vencido some; fixados e destaques que não servem mais (post apagado, retido,
 * oculto) somem; organizações que perderam o selo somem. Os fixados vão só como id: o post vem por rede_post, que confere quem vê.
 */
create or replace function public.rede_perfil_aparencia(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; a jsonb;
begin
  select * into f from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if not found or f.suspenso or ((f.rede_modo = 'invisivel' or f.rede_invisivel) and f.id is distinct from v) or interno.rede_bloqueado(v, f.id) then return null; end if;
  if v is null and not exists (select 1 from rede_orgs where perfil = f.id and verificada_em is not null) then return null; end if;
  a := coalesce(f.rede_aparencia, '{}'::jsonb);
  if a ? 'tocando' and jsonb_typeof(a -> 'tocando') = 'object' and (a -> 'tocando' ->> 'ate')::timestamptz <= now() then
    a := a || jsonb_build_object('tocando', null);
  end if;
  if jsonb_typeof(a -> 'fixados') = 'array' then
    a := a || jsonb_build_object('fixados', (select coalesce(jsonb_agg(e order by o), '[]'::jsonb) from jsonb_array_elements_text(a -> 'fixados') with ordinality as t(e, o)
      where exists (select 1 from rede_posts p where p.id = e::uuid and p.autor = f.id and not p.oculto and not p.retido)));
  end if;
  if jsonb_typeof(a -> 'destaques') = 'array' then
    a := a || jsonb_build_object('destaques', (select coalesce(jsonb_agg(e order by o), '[]'::jsonb) from jsonb_array_elements(a -> 'destaques') with ordinality as t(e, o)
      where exists (select 1 from rede_posts p where p.id = (e ->> 'ref')::uuid and p.autor = f.id and not p.oculto and not p.retido)));
  end if;
  if jsonb_typeof(a -> 'orgs') = 'array' then
    a := a || jsonb_build_object('orgs', (select coalesce(jsonb_agg(jsonb_build_object('handle', g.rede_handle, 'codinome', coalesce(g.rede_codinome, g.rede_handle)) order by o), '[]'::jsonb)
      from jsonb_array_elements_text(a -> 'orgs') with ordinality as t(e, o) join perfis g on g.rede_handle = e join rede_orgs ro on ro.perfil = g.id and ro.verificada_em is not null));
  end if;
  return a;
end $$;

/** Editar a minha aparência: só as chaves que vierem mudam (as outras ficam). Devolve a aparência inteira guardada. */
create or replace function public.rede_perfil_aparencia_editar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r jsonb;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_aparencia', 40, 60);
  r := interno.alumia_aparencia_valida(p, v);
  update perfis set rede_aparencia = coalesce(rede_aparencia, '{}'::jsonb) || r where id = v;
  return public.rede_perfil_aparencia((select rede_handle from perfis where id = v));
end $$;

/** Editar os meus extras (troca a da F4): campos até 6 (substitui todos). Status: some sozinho depois de `horas` (1 a 720). */
create or replace function public.rede_perfil_extras_editar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c jsonb; i integer := 0;
begin
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_perfil_extras', 30, 60);
  if p ? 'status' then
    if jsonb_typeof(p -> 'status') = 'object' then
      if coalesce(p -> 'status' ->> 'tipo', '') not in ('greve', 'ato', 'estudando', 'cuidando', 'ferias')
         or char_length(coalesce(p -> 'status' ->> 'texto', '')) > 60
         or coalesce(p -> 'status' ->> 'horas', '') !~ '^[0-9]{1,3}$' or (p -> 'status' ->> 'horas')::integer not between 1 and 720 then
        perform interno.erro('invalido:status');
      end if;
      update perfis set rede_status_tipo = p -> 'status' ->> 'tipo', rede_status_texto = btrim(coalesce(p -> 'status' ->> 'texto', '')),
        rede_status_ate = now() + make_interval(hours => (p -> 'status' ->> 'horas')::integer) where id = v;
    else
      update perfis set rede_status_tipo = null, rede_status_texto = null, rede_status_ate = null where id = v;
    end if;
  end if;
  if p ? 'pronomes' then
    if char_length(coalesce(p ->> 'pronomes', '')) > 30 then perform interno.erro('invalido:pronomes'); end if;
    update perfis set rede_pronomes = nullif(btrim(coalesce(p ->> 'pronomes', '')), '') where id = v;
  end if;
  if jsonb_typeof(p -> 'campos') = 'array' then
    if jsonb_array_length(p -> 'campos') > 6 then perform interno.erro('invalido:campos'); end if;
    delete from rede_perfil_campos where usuario = v;
    for c in select value from jsonb_array_elements(p -> 'campos') loop
      i := i + 1;
      -- Link no campo: só https e sem parâmetro de rastreio (o resto é texto).
      if coalesce(c ->> 'valor', '') ~* '^https?://' and (coalesce(c ->> 'valor', '') !~ '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s<>"''`]*)?$'
         or (c ->> 'valor') ~* '(^|[?&])(utm_[a-z_]+|fbclid|gclid|msclkid|igshid|igsh|si|mc_[a-z]+)=') then
        perform interno.erro('invalido:campos');
      end if;
      begin
        insert into rede_perfil_campos (usuario, ordem, rotulo, valor) values (v, i, btrim(coalesce(c ->> 'rotulo', '')), btrim(coalesce(c ->> 'valor', '')));
      exception when check_violation then perform interno.erro('invalido:campos');
      end;
    end loop;
  end if;
  return public.rede_perfil_extras((select rede_handle from perfis where id = v));
end $$;

-- ── 4. Tear de encaminhamentos (organização) ──────────────────────────────────────────────────────────────────────────────

/**
 * O tear de uma organização com selo. Todos veem o texto das deliberações e o agregado ("decidimos 12, cumprimos 9"); a FUNÇÃO
 * responsável e o prazo só quem gerencia ou é de um núcleo da organização vê (o público vê o agregado e o texto).
 */
create or replace function public.rede_org_tear(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); o uuid; dentro boolean;
begin
  select ro.perfil into o from rede_orgs ro join perfis f on f.id = ro.perfil where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and ro.verificada_em is not null;
  if o is null or interno.rede_bloqueado(v, o) then return null; end if;
  dentro := v is not null and (interno.alumia_org_gere(v, o) or exists (
    select 1 from rede_nucleos n join rede_nucleo_membros m on m.nucleo = n.id where n.org = o and m.usuario = v));
  return jsonb_build_object(
    'decididos', (select count(*) from rede_org_encaminhamentos where org = o and estado <> 'retirado'),
    'cumpridos', (select count(*) from rede_org_encaminhamentos where org = o and estado = 'cumprido'),
    'dentro', dentro,
    'gerencio', v is not null and interno.alumia_org_gere(v, o),
    'fios', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'texto', e.texto, 'estado', e.estado, 'criado', e.criado_dia,
        'funcao', case when dentro then e.funcao end, 'prazo', case when dentro then e.prazo end,
        'vencido', e.estado = 'aberto' and e.prazo < current_date, 'cumprido', e.cumprido_dia) order by e.criado_dia desc, e.id), '[]'::jsonb)
      from (select * from rede_org_encaminhamentos where org = o and estado <> 'retirado' order by criado_dia desc, id limit 60) e));
end $$;

/** Quem gerencia tece um fio novo (texto, função, prazo) ou muda o estado de um (aberto, cumprido, retirado). */
create or replace function public.rede_org_tear_fio(p_handle text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); o uuid;
begin
  perform interno.rede3_perfil_exige_membro(v);
  o := interno.alumia_org_gestor(p_handle, 'alumia_org_tear', 60, 60);
  if p ? 'id' then
    if coalesce(p ->> 'estado', '') not in ('aberto', 'cumprido', 'retirado') then perform interno.erro('invalido:estado'); end if;
    update rede_org_encaminhamentos set estado = p ->> 'estado', cumprido_dia = case when p ->> 'estado' = 'cumprido' then current_date end
      where id = (p ->> 'id')::uuid and org = o;
    if not found then perform interno.erro('nao_encontrado'); end if;
  else
    begin
      if (p ->> 'prazo')::date < current_date or (p ->> 'prazo')::date > current_date + 730 then perform interno.erro('invalido:prazo'); end if;
    exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then perform interno.erro('invalido:prazo');
    end;
    if (select count(*) from rede_org_encaminhamentos where org = o and estado = 'aberto') >= 200 then perform interno.erro('limite'); end if;
    begin
      insert into rede_org_encaminhamentos (org, texto, funcao, prazo) values (o, btrim(coalesce(p ->> 'texto', '')), btrim(coalesce(p ->> 'funcao', '')), (p ->> 'prazo')::date);
    exception when check_violation then perform interno.erro('invalido:fio');
    end;
  end if;
  return public.rede_org_tear(p_handle);
end $$;

-- ── 5. Permissões das funções ─────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  revoke all on function interno.alumia_aparencia_valida(jsonb, uuid) from public;
  foreach f in array array['public.rede_perfil_aparencia(text)', 'public.rede_perfil_aparencia_editar(jsonb)', 'public.rede_perfil_extras_editar(jsonb)',
    'public.rede_org_tear(text)', 'public.rede_org_tear_fio(text, jsonb)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_aparencia_valida(jsonb, uuid) from anon, authenticated;
    grant execute on function public.rede_perfil_aparencia(text), public.rede_org_tear(text) to anon;
    grant execute on function public.rede_perfil_aparencia(text), public.rede_perfil_aparencia_editar(jsonb), public.rede_perfil_extras_editar(jsonb),
      public.rede_org_tear(text), public.rede_org_tear_fio(text, jsonb) to authenticated;
  end if;
end $$;
