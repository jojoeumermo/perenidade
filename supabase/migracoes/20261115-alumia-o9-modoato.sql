-- ───────────────────────────── Alumia: modo ato e depois do ato, onda 9, frente 9C ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- O que o banco guarda para o dia do ato. O modo ato em si (tela simplificada, sem números, aviso antes de foto com gente, placa no
-- aviso de dado pessoal) mora só no aparelho (lib/rede/modoato/aparelho.ts); aqui ficam os recados que precisam chegar a outra
-- pessoa, e nada além disso:
--
--   Contatos de segurança   interno.alumia_ato_contatos: cada pessoa escolhe até 10 contas, e a contato ACEITA antes de receber
--                           qualquer recado (quem não aceitou não recebe nada, e ninguém recebe recado de quem não escolheu).
--                           Ninguém vê de quem a pessoa é contato além dela mesma; a moderação não lê esta tabela.
--   "Estou bem"             public.alumia_ato_estou_bem(): um recado fixo para os contatos que aceitaram. Sem texto livre, sem
--                           localização, sem lista de quem voltou: cada contato vê só o recado que recebeu. Some em 24 horas
--                           (interno.alumia_ato_faxina, pg_cron a cada 15 minutos; as leituras já escondem o vencido).
--   "Fui detido"            public.alumia_ato_fui_detido(org): atrás do interruptor "alumia-fui-detido", que só vale ligado
--                           pelo painel (interno.recursos_vivos), depois do parecer do advogado. Recado fixo para os contatos e,
--                           se a pessoa escolher, para a assessoria jurídica que uma organização com selo cadastrou (quem
--                           gere a organização recebe). Nenhuma localização. Some em 72 horas.
--   Assessoria jurídica     interno.alumia_assessorias: o texto do plantão (até 400 letras) que a organização com selo publica.
--                           É público para quem tem conta, porque é serviço da organização, não dado de pessoa.
--
-- Nenhum endereço de rede é lido nem guardado. Tabelas em interno, RLS ligada e sem política, nenhuma permissão direta; acesso só
-- pelas funções abaixo (security definer, search_path fixo), todas atrás da porta da entrada. Pode rodar mais de uma vez.
-- Roda DEPOIS de 20261114-alumia-onda8-fim.sql. Teste: npm run testar:alumia-o9-modoato.

-- 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Os contatos de segurança. Só a data do pedido (a hora ajudaria a ligar a conta a um ato).
create table if not exists interno.alumia_ato_contatos (
  dono uuid not null references interno.perfis (id) on delete cascade,
  contato uuid not null references interno.perfis (id) on delete cascade,
  aceito boolean not null default false,
  pedido_em date not null default current_date,
  primary key (dono, contato),
  check (dono <> contato)
);
create index if not exists alumia_ato_contatos_contato on interno.alumia_ato_contatos (contato);

-- Os recados ("estou bem" e "fui detido"), cada um com prazo para sumir. Sem texto livre: o texto é o da tela, no idioma de quem lê.
create table if not exists interno.alumia_ato_sinais (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references interno.perfis (id) on delete cascade,
  para uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('estou_bem', 'detido')),
  -- A organização cuja assessoria a pessoa escolheu (só no "fui detido" que chega a quem gere a organização).
  via_org uuid references interno.rede_orgs (perfil) on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  check (de <> para),
  check (expira_em > criado_em and expira_em <= criado_em + interval '72 hours')
);
create index if not exists alumia_ato_sinais_para on interno.alumia_ato_sinais (para, expira_em);
create index if not exists alumia_ato_sinais_expira on interno.alumia_ato_sinais (expira_em);

-- O plantão jurídico de uma organização com selo.
create table if not exists interno.alumia_assessorias (
  org uuid primary key references interno.rede_orgs (perfil) on delete cascade,
  texto text not null check (char_length(texto) between 10 and 400),
  atualizado_em date not null default current_date
);

do $$
declare t text;
begin
  foreach t in array array['alumia_ato_contatos', 'alumia_ato_sinais', 'alumia_assessorias'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Os dois tipos novos de aviso (o sino e o aviso no celular). A regra é refeita a partir da que está no banco, para não apagar o
-- tipo de ninguém (o mesmo jeito de 20261110-alumia-b1-comunidade.sql).
do $$
declare v_def text; v_tipos text[]; v_novos text[] := array['estou_bem', 'detido'];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conrelid = 'interno.avisos'::regclass and conname = 'avisos_tipo';
  if v_def is null then return; end if;
  -- A regra aparece de dois jeitos: tipo = any ('{a,b}'::text[]) (depois de 20261110-alumia-b1-comunidade.sql) ou tipo in ('a', 'b').
  -- Lê os dois: ler só o segundo perdia os tipos da federação, os da B1 e a marcação.
  select coalesce(array_agg(distinct x), '{}') into v_tipos from (
    select unnest(string_to_array(m[1], ',')) as x from regexp_matches(v_def, '''\{([a-z_,]*)\}''', 'g') m
    union all
    select m[1] from regexp_matches(v_def, '''([a-z_]+)''', 'g') m) z
  where x <> '';
  if v_tipos @> v_novos then return; end if;
  -- Leitura que não achou os tipos de sempre: não mexe (melhor sem os dois avisos novos do que sem os outros).
  if not v_tipos @> array['resposta', 'mencao', 'citacao'] then return; end if;
  v_tipos := array(select distinct unnest(v_tipos || v_novos || array['resposta', 'mencao', 'citacao', 'seguidor', 'chamado', 'nucleo', 'moderacao', 'apoio']) order by 1);
  alter table interno.avisos drop constraint if exists avisos_tipo;
  execute format('alter table interno.avisos add constraint avisos_tipo check (tipo is null or tipo = any (%L::text[]))', v_tipos);
end $$;

-- A lista de avisos da Alumia passa a mostrar o texto fixo destes dois tipos (nunca há trecho de post neles). Remendo no lugar,
-- como o da B1, para não reescrever o que as outras frentes já remendaram. Se a função mudou de forma, o remendo não entra e
-- a tela mostra o texto de reserva do sino (o recado continua inteiro em Modo ato).
do $$
declare v_def text; v_novo text;
begin
  if to_regprocedure('public.rede_aviso_listar(text, integer)') is null then return; end if;
  v_def := pg_get_functiondef('public.rede_aviso_listar(text, integer)'::regprocedure);
  if position('''estou_bem''' in v_def) > 0 then return; end if;
  v_novo := regexp_replace(v_def, '(when n\.tipo is null or n\.tipo in \(''chamado''[^)]*)\) then n\.texto end', '\1, ''estou_bem'', ''detido'') then n.texto end');
  if v_novo = v_def then
    raise notice 'public.rede_aviso_listar mudou de forma: o texto de estou_bem e detido fica de fora do sino';
    return;
  end if;
  execute v_novo;
end $$;

-- O interruptor do "Fui detido" no catálogo dos recursos (lib/recursos.ts): só pelo nome, como os outros da Alumia.
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-fui-detido', true) on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

-- 2. As peças de dentro ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** O modo ato está aberto no banco? Fecha se a coordenação desligou no painel a Alumia nova ou o modo ato. */
create or replace function interno.alumia_ato_aberto() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return true; end if;
  return not exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-modo-ato') and not ligado);
end $$;

/**
 * O "Fui detido" está ligado? Só com decisão explícita do painel (interno.recursos_vivos, que para recurso "só pelo nome" pede a
 * confirmação de uma segunda pessoa da coordenação). A variável de montagem do site mostra o botão; quem libera o envio é o banco.
 */
create or replace function interno.alumia_ato_detido_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v boolean;
begin
  if not interno.alumia_ato_aberto() or to_regclass('interno.recursos_vivos') is null then return false; end if;
  select ligado into v from recursos_vivos where nome = 'alumia-fui-detido';
  return coalesce(v, false);
end $$;

/** Quem chama, conferido: sessão, conta ativa, membro da Alumia e o modo ato aberto. */
create or replace function interno.alumia_ato_eu() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  if not interno.alumia_ato_aberto() then perform interno.erro('desligado'); end if;
  return v;
end $$;

/**
 * A conta de um @ que pode entrar nesta conversa com `p_eu`: existe, é membro, não está suspensa e nenhuma das duas bloqueou a
 * outra. Qualquer outro caso é "não encontrada" (o mesmo erro para quem não existe e para quem bloqueou: não diz qual).
 */
create or replace function interno.alumia_ato_conta(p_handle text, p_eu uuid) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_h text := lower(btrim(coalesce(p_handle, ''), ' @')); v uuid;
begin
  if v_h !~ '^[a-z0-9_]{3,20}$' then perform interno.erro('nao_encontrado'); end if;
  select f.id into v from perfis f where f.rede_handle = v_h and not f.suspenso;
  if v is null or v = p_eu or not interno.rede2_membro(v) or interno.rede_bloqueado(p_eu, v) then perform interno.erro('nao_encontrado'); end if;
  return v;
end $$;

/** Uma pessoa como a tela mostra num contato: o @ e o codinome (as duas pontas aceitaram se conhecer por aqui). */
create or replace function interno.alumia_ato_pessoa(p uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(f.id)) from perfis f where f.id = p
$$;

/** Grava o aviso do sino (e do celular) de um recado. O texto é fixo; o nome de quem mandou vai em `ator`. */
create or replace function interno.alumia_ato_avisar(p_para uuid, p_tipo text, p_de uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  insert into avisos (para, texto, categoria, tipo, ator)
  values (p_para,
    case p_tipo
      when 'estou_bem' then 'Recado de um contato de segurança: está bem. O recado some em 24 horas.'
      when 'detido' then 'Recado urgente de um contato de segurança: foi detido. Abra o Modo ato para ver o que fazer.'
      else 'Alguém pediu você como contato de segurança para dia de ato. Responda no Modo ato.' end,
    'rede', case when p_tipo in ('estou_bem', 'detido') then p_tipo end, p_de);
end $$;

/**
 * A faxina: some o recado vencido (e o aviso dele: "estou bem" depois de 24 horas, "fui detido" depois de 72) e o pedido de
 * contato que ninguém respondeu em 30 dias. Roda pelo agendador do banco; as leituras já escondem o vencido.
 */
create or replace function interno.alumia_ato_faxina() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer; v_m integer;
begin
  delete from alumia_ato_sinais where expira_em <= now();
  get diagnostics v_n = row_count;
  delete from avisos where (tipo = 'estou_bem' and criado_em <= now() - interval '24 hours')
                        or (tipo = 'detido' and criado_em <= now() - interval '72 hours');
  get diagnostics v_m = row_count;
  delete from alumia_ato_contatos where not aceito and pedido_em < current_date - 30;
  return v_n + v_m;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-ato-faxina', '*/15 * * * *', 'select interno.alumia_ato_faxina()');
  end if;
exception when others then null;
end $$;

/** Tudo o que a tela do modo ato precisa de uma vez (o que é desta pessoa e nada de mais ninguém). */
create or replace function interno.alumia_ato_situacao_de(v uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'contatos', coalesce((select jsonb_agg(interno.alumia_ato_pessoa(c.contato) || jsonb_build_object('aceito', c.aceito) order by c.aceito desc, f.rede_handle)
                            from alumia_ato_contatos c join perfis f on f.id = c.contato where c.dono = v and not f.suspenso), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(interno.alumia_ato_pessoa(c.dono) order by f.rede_handle)
                           from alumia_ato_contatos c join perfis f on f.id = c.dono
                          where c.contato = v and not c.aceito and not f.suspenso and not interno.rede_bloqueado(v, c.dono)), '[]'::jsonb),
    'sou_contato_de', coalesce((select jsonb_agg(interno.alumia_ato_pessoa(c.dono) order by f.rede_handle)
                                  from alumia_ato_contatos c join perfis f on f.id = c.dono
                                 where c.contato = v and c.aceito and not f.suspenso), '[]'::jsonb),
    'recados', coalesce((select jsonb_agg(interno.alumia_ato_pessoa(s.de) || jsonb_build_object(
                             'id', s.id, 'tipo', s.tipo, 'criado_em', s.criado_em, 'expira_em', s.expira_em,
                             'via_org', case when s.via_org is not null then interno.rede_nome(s.via_org) end)
                           order by s.criado_em desc)
                           from alumia_ato_sinais s where s.para = v and s.expira_em > now() and not interno.rede_bloqueado(v, s.de)), '[]'::jsonb),
    'detido_ligado', interno.alumia_ato_detido_ligado(),
    'minhas_orgs', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil), 'texto', a.texto) order by f.rede_handle)
                               from rede_org_gestores g join rede_orgs o on o.perfil = g.org join perfis f on f.id = o.perfil
                               left join alumia_assessorias a on a.org = o.perfil
                              where g.gestor = v and o.verificada_em is not null and not f.suspenso), '[]'::jsonb))
$$;

-- 3. As funções da tela ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A situação do modo ato de quem chama: contatos, pedidos, de quem é contato, recados que valem, o interruptor e as organizações. */
create or replace function public.alumia_ato_situacao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu();
begin
  perform interno.limite('alumia_ato_ler', 240, 60);
  return interno.alumia_ato_situacao_de(v);
end $$;

/** Pede uma conta como contato de segurança. Ela recebe um aviso sem o nome de quem pediu e responde no Modo ato. Até 10. */
create or replace function public.alumia_ato_contato_pedir(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); v_c uuid; v_novo boolean;
begin
  perform interno.limite('alumia_ato_contato', 20, 60);
  v_c := interno.alumia_ato_conta(p_handle, v);
  if not exists (select 1 from alumia_ato_contatos where dono = v and contato = v_c)
     and (select count(*) from alumia_ato_contatos where dono = v) >= 10 then
    perform interno.erro('limite_de_contatos');
  end if;
  insert into alumia_ato_contatos (dono, contato) values (v, v_c) on conflict do nothing returning true into v_novo;
  if coalesce(v_novo, false) then perform interno.alumia_ato_avisar(v_c, 'pedido', null); end if;
  return interno.alumia_ato_situacao_de(v);
end $$;

/** Quem foi pedido aceita (passa a receber os recados) ou recusa (o pedido some, sem aviso a quem pediu). */
create or replace function public.alumia_ato_contato_responder(p_handle text, p_aceito boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); v_d uuid;
begin
  perform interno.limite('alumia_ato_contato', 20, 60);
  v_d := interno.alumia_ato_conta(p_handle, v);
  if not exists (select 1 from alumia_ato_contatos where dono = v_d and contato = v and not aceito) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_aceito, false) then
    update alumia_ato_contatos set aceito = true where dono = v_d and contato = v;
  else
    delete from alumia_ato_contatos where dono = v_d and contato = v;
  end if;
  return interno.alumia_ato_situacao_de(v);
end $$;

/** Desfaz o laço com um @, nas duas direções (tirar um contato meu, ou deixar de ser contato de alguém), e os recados entre as duas. */
create or replace function public.alumia_ato_contato_tirar(p_handle text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); v_h text := lower(btrim(coalesce(p_handle, ''), ' @')); v_x uuid;
begin
  perform interno.limite('alumia_ato_contato', 20, 60);
  -- Aqui vale até conta bloqueada ou suspensa: desfazer um laço nunca depende da outra ponta.
  select f.id into v_x from perfis f where f.rede_handle = v_h;
  if v_x is null then perform interno.erro('nao_encontrado'); end if;
  delete from alumia_ato_contatos where (dono = v and contato = v_x) or (dono = v_x and contato = v);
  delete from alumia_ato_sinais where (de = v and para = v_x) or (de = v_x and para = v);
  return interno.alumia_ato_situacao_de(v);
end $$;

/**
 * "Estou bem": um recado fixo para cada contato que aceitou (o de antes, se houver, é trocado pelo novo). Some em 24 horas.
 * Devolve só quantos contatos receberam (são os da própria pessoa).
 */
create or replace function public.alumia_ato_estou_bem() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); r record; v_n integer := 0;
begin
  perform interno.limite('alumia_ato_estou_bem', 6, 60);
  for r in select c.contato from alumia_ato_contatos c join perfis f on f.id = c.contato
           where c.dono = v and c.aceito and not f.suspenso and not interno.rede_bloqueado(v, c.contato) loop
    delete from alumia_ato_sinais where de = v and para = r.contato and tipo = 'estou_bem';
    delete from avisos where para = r.contato and tipo = 'estou_bem' and ator = v;
    insert into alumia_ato_sinais (de, para, tipo, expira_em) values (v, r.contato, 'estou_bem', now() + interval '24 hours');
    perform interno.alumia_ato_avisar(r.contato, 'estou_bem', v);
    v_n := v_n + 1;
  end loop;
  if v_n = 0 then perform interno.erro('sem_contatos'); end if;
  return jsonb_build_object('avisados', v_n);
end $$;

/**
 * "Fui detido" (atrás do interruptor): um recado fixo para os contatos que aceitaram e, com `p_org`, para quem gere a organização
 * com selo que cadastrou assessoria jurídica. Nenhuma localização, nenhum texto livre. Some em 72 horas.
 */
create or replace function public.alumia_ato_fui_detido(p_org text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); v_org uuid; r record; v_n integer := 0; v_a integer := 0;
begin
  if not interno.alumia_ato_detido_ligado() then perform interno.erro('desligado'); end if;
  perform interno.limite('alumia_ato_detido', 3, 60);
  if nullif(btrim(coalesce(p_org, ''), ' @'), '') is not null then
    select o.perfil into v_org from rede_orgs o join perfis f on f.id = o.perfil join alumia_assessorias a on a.org = o.perfil
     where f.rede_handle = lower(btrim(p_org, ' @')) and o.verificada_em is not null and not f.suspenso;
    if v_org is null then perform interno.erro('nao_encontrado'); end if;
  end if;
  for r in
    select distinct on (q.para) q.para, q.via from (
      select c.contato as para, null::uuid as via, 0 as ordem from alumia_ato_contatos c where c.dono = v and c.aceito
      union all
      select g.gestor, v_org, 1 from rede_org_gestores g where v_org is not null and g.org = v_org
    ) q join perfis f on f.id = q.para
    where q.para <> v and not f.suspenso and not interno.rede_bloqueado(v, q.para)
    order by q.para, q.ordem
  loop
    delete from alumia_ato_sinais where de = v and para = r.para and tipo = 'detido';
    insert into alumia_ato_sinais (de, para, tipo, via_org, expira_em) values (v, r.para, 'detido', r.via, now() + interval '72 hours');
    perform interno.alumia_ato_avisar(r.para, 'detido', v);
    v_n := v_n + 1;
    if r.via is not null then v_a := v_a + 1; end if;
  end loop;
  if v_n = 0 then perform interno.erro('sem_contatos'); end if;
  return jsonb_build_object('avisados', v_n, 'assessoria', v_a > 0);
end $$;

/** Quem recebeu tira um recado da própria tela antes do prazo. */
create or replace function public.alumia_ato_recado_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); v_de uuid; v_tipo text;
begin
  perform interno.limite('alumia_ato_contato', 20, 60);
  delete from alumia_ato_sinais where id = p_id and para = v returning de, tipo into v_de, v_tipo;
  if v_de is not null then delete from avisos where para = v and tipo = v_tipo and ator = v_de; end if;
  return interno.alumia_ato_situacao_de(v);
end $$;

/** As organizações com selo que têm plantão jurídico (o @, o nome e o texto do plantão). São serviço público delas. */
create or replace function public.alumia_ato_assessorias() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu();
begin
  perform interno.limite('alumia_ato_ler', 240, 60);
  return coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', interno.rede_nome(o.perfil), 'texto', a.texto) order by interno.rede_nome(o.perfil))
                     from (select * from alumia_assessorias order by org limit 300) a
                     join rede_orgs o on o.perfil = a.org join perfis f on f.id = o.perfil
                    where o.verificada_em is not null and not f.suspenso and v is not null), '[]'::jsonb);
end $$;

/** Quem gere uma organização com selo publica (ou, com texto vazio, tira) o plantão jurídico dela. */
create or replace function public.alumia_ato_assessoria_guardar(p_org text, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_ato_eu(); v_org uuid; v_t text := btrim(regexp_replace(coalesce(p_texto, ''), '[[:cntrl:]]+', ' ', 'g'));
begin
  perform interno.limite('alumia_ato_assessoria', 10, 60);
  select o.perfil into v_org from rede_orgs o join perfis f on f.id = o.perfil join rede_org_gestores g on g.org = o.perfil and g.gestor = v
   where f.rede_handle = lower(btrim(coalesce(p_org, ''), ' @')) and o.verificada_em is not null;
  if v_org is null then perform interno.erro('sem_permissao'); end if;
  if v_t = '' then
    delete from alumia_assessorias where org = v_org;
  else
    if char_length(v_t) not between 10 and 400 or v_t ~ '[<>]' then perform interno.erro('invalido:texto'); end if;
    insert into alumia_assessorias (org, texto) values (v_org, v_t)
    on conflict (org) do update set texto = excluded.texto, atualizado_em = current_date;
  end if;
  return interno.alumia_ato_situacao_de(v);
end $$;

-- 4. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

revoke all on function interno.alumia_ato_aberto(), interno.alumia_ato_detido_ligado(), interno.alumia_ato_eu(), interno.alumia_ato_conta(text, uuid),
  interno.alumia_ato_pessoa(uuid), interno.alumia_ato_avisar(uuid, text, uuid), interno.alumia_ato_faxina(), interno.alumia_ato_situacao_de(uuid) from public;
revoke all on function public.alumia_ato_situacao(), public.alumia_ato_contato_pedir(text), public.alumia_ato_contato_responder(text, boolean),
  public.alumia_ato_contato_tirar(text), public.alumia_ato_estou_bem(), public.alumia_ato_fui_detido(text), public.alumia_ato_recado_apagar(uuid),
  public.alumia_ato_assessorias(), public.alumia_ato_assessoria_guardar(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_ato_aberto(), interno.alumia_ato_detido_ligado(), interno.alumia_ato_eu(), interno.alumia_ato_conta(text, uuid),
      interno.alumia_ato_pessoa(uuid), interno.alumia_ato_avisar(uuid, text, uuid), interno.alumia_ato_faxina(), interno.alumia_ato_situacao_de(uuid) from anon, authenticated;
    revoke all on function public.alumia_ato_situacao(), public.alumia_ato_contato_pedir(text), public.alumia_ato_contato_responder(text, boolean),
      public.alumia_ato_contato_tirar(text), public.alumia_ato_estou_bem(), public.alumia_ato_fui_detido(text), public.alumia_ato_recado_apagar(uuid),
      public.alumia_ato_assessorias(), public.alumia_ato_assessoria_guardar(text, text) from anon;
    grant execute on function public.alumia_ato_situacao(), public.alumia_ato_contato_pedir(text), public.alumia_ato_contato_responder(text, boolean),
      public.alumia_ato_contato_tirar(text), public.alumia_ato_estou_bem(), public.alumia_ato_fui_detido(text), public.alumia_ato_recado_apagar(uuid),
      public.alumia_ato_assessorias(), public.alumia_ato_assessoria_guardar(text, text) to authenticated;
    grant execute on function interno.alumia_ato_faxina() to service_role;
  end if;
end $$;

-- As funções novas passam pela porta da entrada, como toda função da rede (20261112-alumia-portas.sql).
select interno.alumia_trancar();
