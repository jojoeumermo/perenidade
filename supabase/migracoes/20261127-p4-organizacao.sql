-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · organização e ação coletiva (itens 52 a 67 e 122; os itens 59 em parte e 67 inteiro rodam no aparelho).
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17) e das migrações 20261127-p4-* das duas primeiras junções; quem junta põe
-- antes do 20261127-p4-fim.sql. Não mexe em rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso.
-- Não redefine nenhuma função que já existia: todas as funções daqui são novas (interno.rede_p4_or_* e public.rede_p4_or_*). Lê, sem
-- mudar, interno.alumia_org_de, alumia_org_gere, alumia_org_dentro, alumia_pessoas, alumia_sem_dado_pessoal, rede_ato_organiza,
-- rede_ve, rede2_membro, rede2_na_comunidade, rede3_com_modera, rede3_perfil_exige_membro, rede_bloqueado e a fila do Vale o
-- Escrito (interno.vale_envios e vale_fila, só inserção, como o envio público já faz).
--
-- Tudo atrás do interruptor "alumia-p4-organizacao" (catálogo, só pelo nome, desligado): desligado, toda função daqui recusa com
-- "desligado".
--
-- Quem é "de dentro" de uma organização, para o servidor: quem a gerencia e quem ocupa hoje uma função dela (mandato aceito). Desde a
-- R2 o servidor não sabe quem é de qual núcleo (os membros ficam no grupo cifrado): o quadro, a enquete, o consenso, a meta e o
-- inventário "do núcleo" ficam para o chat de grupo (pendência [P2]); aqui eles são da organização.
--
--   52/122. QUADRO DA ORGANIZAÇÃO (interno.rede_p4_or_cartoes e rede_p4_or_cartao_eu). Colunas a fazer, fazendo e feito; o cartão
--       pode apontar um ato que a organização chama e uma função (nunca uma pessoa). "Eu assumo" guarda só que a pessoa assumiu: os
--       outros veem "tem quem leve" e, só a partir de 3, quantas pessoas. Rodízio (122): o cartão recorrente (semanal, quinzenal ou
--       mensal) que vai para "feito" nasce de novo com o prazo seguinte e a próxima função da escala.
--   53. ENQUETE DE HORÁRIO (rede_p4_or_horarios, rede_p4_or_horario_votantes e rede_p4_or_horario_somas). Quem vota marca os horários
--       em que pode; o banco guarda que a pessoa votou (para não votar duas vezes) e soma as marcas num contador por horário, sem
--       linha por voto. O resultado só aparece depois de fechada, e cada total só a partir de 3.
--   54. REUNIÕES RECORRENTES (rede_p4_or_reunioes). Semanal, quinzenal ou mensal (o n-ésimo dia da semana do mês), com o lembrete
--       escolhido. As datas e o .ics (com RRULE e alarme) são feitos no aparelho (lib/rede/organizacao/regras.ts): o lembrete fica
--       no calendário de quem baixou, sem aviso nenhum do servidor.
--   55/63. MURAL "OFEREÇO / PRECISO" E VAGAS E BICOS (rede_p4_or_mural). Da comunidade, sob o codinome de quem pôs, combinado por
--       mensagem; o texto recusa CPF, telefone, e-mail e endereço com número (interno.alumia_sem_dado_pessoal). Vaga e bico sem perfil
--       profissional: só a descrição e, se quiser, um link https. Some sozinho em 30 dias.
--   56. BANCO DE TEMPO (rede_p4_or_horas). Quem recebeu o serviço registra as horas e quem deu confirma; o saldo de cada pessoa só ela
--       vê. Nenhuma função lista as trocas de outra pessoa nem soma o saldo de ninguém para terceiros.
--   57. INVENTÁRIO SOLIDÁRIO (rede_p4_or_coisas). Coisas da organização (megafone, faixa, som), quantas e se estão disponíveis;
--       nunca com quem estão.
--   58. MAPA DE PONTOS DE APOIO (rede_p4_or_pontos). Só lugares públicos (quem propõe declara), aprovados pela mediação da
--       comunidade; o "como chegar" é o mesmo link do ato (lib/rede/atos/chegar.ts), sem pedir a posição do aparelho.
--   59. ROTA DO ATO (rede_p4_or_rotas). Quem chama o ato desenha a rota (pontos com latitude e longitude) e os pontos de apoio; quem
--       vê o ato baixa tudo no aparelho antes de sair e vê a rota sem internet e sem pedir a posição.
--   60. CONSENSO POR POSIÇÕES (rede_p4_or_consensos e rede_p4_or_posicoes). Concordo, com ressalva, abstenho, bloqueio: cada total
--       (e o total geral) só a partir de 3; quem bloqueou, nunca.
--   61. ORÇAMENTO PARTICIPATIVO (rede_p4_or_orcamentos, rede_p4_or_propostas e rede_p4_or_apoios). Propor o uso da caixa, apoiar (o
--       total só a partir de 3) e votar pela consulta que já existe (rede_consultas), sem mexer no voto: o orçamento só aponta a
--       consulta da mesma organização.
--   62. META COLETIVA (rede_p4_or_metas). A soma e o número de contribuições são dois contadores, sem linha por pessoa; a soma só
--       aparece a partir de 3 contribuições. Sem ranking.
--   64. TERMÔMETRO DO TERRITÓRIO (rede_p4_or_lugares, rede_p4_or_lugar_avaliadores, rede_p4_or_lugar_somas e rede_p4_or_lugar_problemas).
--       Nota de 1 a 5 e os problemas de UBS, escola, linha de ônibus e iluminação, por município, uma vez por semestre: da pessoa, só
--       que avaliou; a nota e os problemas vão para contadores, sem linha por avaliação. O agregado só a partir de 3 avaliações; com
--       ele, o aparelho monta a denúncia coletiva para a ouvidoria.
--   65. APOIO DIRETO A QUEM PRODUZ (rede_p4_or_apoio_direto). A própria pessoa põe uma chave Pix aleatória (nunca CPF, telefone ou
--       e-mail) ou um link https; a Alumia não guarda dinheiro nem cobra taxa e não conta quem apoiou.
--   66. PEDIR CHECAGEM AO INSTITUTO. O post (só pelo endereço, sem o texto) entra na fila do Vale o Escrito como um envio do público,
--       com o motivo escrito por quem pede; a fila não recebe quem pediu nem endereço de rede.
--   67. ATA ASSISTIDA. Só no aparelho: o áudio é transcrito pelo navegador no modo local (o mesmo de lib/rede/midia/reconhecer.ts) e
--       vira um rascunho de ata. Nada vai ao banco nem a terceiros.
--
-- Privacidade: nenhuma função devolve lista de pessoas de uma organização ou comunidade, nem quem assumiu, votou, apoiou, contribuiu,
-- propôs ou avaliou; nenhum número de pessoas abaixo de 3; nenhuma coluna de endereço de rede (os limites são pela conta,
-- interno.limite). Pode rodar mais de uma vez.
-- Lei: LGPD art. 6º, III (necessidade: o banco guarda o mínimo para não votar duas vezes ou confirmar a troca), art. 11 (opinião
-- política e filiação são dados sensíveis: nada de quem votou o quê nem de quem é de dentro), art. 18, VI (a pessoa apaga o que pôs)
-- e art. 46 (segurança); Lei 12.527/2011 (a denúncia coletiva do termômetro vai pelos canais de ouvidoria) e Resolução BCB 1/2020 (a
-- chave Pix aleatória, sem custódia nem intermediação de pagamento).

-- ── 0. O interruptor e as peças comuns ─────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-organizacao', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com a Alumia nova e o interruptor ligado no painel (recursos_vivos). */
create or replace function interno.rede_p4_or_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-organizacao'), false);
end $$;

/** Confere o interruptor e a conta (membro da Alumia, 18+, codinome conferido). Devolve quem chama. */
create or replace function interno.rede_p4_or_membro() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede_p4_or_ligado() then perform interno.erro('desligado'); end if;
  perform interno.rede3_perfil_exige_membro(v);
  return v;
end $$;

/** Um texto limpo: sem caracteres de controle, sem espaço sobrando, cortado em p_max. */
create or replace function interno.rede_p4_or_texto(p text, p_max integer) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

/** O texto entre p_min e p_max letras, sem dado pessoal (CPF, telefone, e-mail, endereço com número); fora disso, invalido:<campo>. */
create or replace function interno.rede_p4_or_campo(p text, p_min integer, p_max integer, p_campo text) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := interno.rede_p4_or_texto(p, p_max + 1);
begin
  if char_length(v) < p_min or char_length(v) > p_max then perform interno.erro('invalido:' || p_campo); end if;
  return interno.alumia_sem_dado_pessoal(v, p_campo);
end $$;

/** Um link https sem senha na frente, até 300; vazio vira nulo; outra coisa, invalido:link. */
create or replace function interno.rede_p4_or_link(p text) returns text language plpgsql immutable as $$
declare v text := nullif(btrim(coalesce(p, '')), '');
begin
  if v is null then return null; end if;
  if v !~ '^https://[^\s/@]{3,}(/[^\s]*)?$' or char_length(v) > 300 then perform interno.erro('invalido:link'); end if;
  return v;
end $$;

/** Uma data AAAA-MM-DD (ou nula). */
create or replace function interno.rede_p4_or_data(p text) returns date language plpgsql immutable as $$
begin
  if nullif(btrim(coalesce(p, '')), '') is null then return null; end if;
  if p !~ '^\d{4}-\d{2}-\d{2}$' then perform interno.erro('invalido:data'); end if;
  return p::date;
exception when datetime_field_overflow or invalid_datetime_format then
  perform interno.erro('invalido:data');
  return null;
end $$;

/** A organização pelo @ (sem suspensão nem bloqueio com quem chama), ou nao_encontrado. */
create or replace function interno.rede_p4_or_org(p_handle text, p_quem uuid) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_org_de(p_handle);
begin
  if v is null or not interno.alumia_org_vista(v, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return v;
end $$;

/** De dentro da organização: gerencia ou ocupa hoje uma função (mandato aceito). Os núcleos não contam (o servidor não sabe). */
create or replace function interno.rede_p4_or_dentro(p_org uuid, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and p_org is not null and (interno.alumia_org_dentro(p_quem, p_org) or exists (
    select 1 from rede_org_mandatos m join rede_org_funcoes f on f.id = m.funcao
     where f.org = p_org and m.pessoa = p_quem and m.aceito and m.encerrado_dia is null and m.fim >= current_date))
$$;

/** A organização pelo @, para quem é de dentro (senão, nao_encontrado: quem é de fora nem fica sabendo que o quadro existe). */
create or replace function interno.rede_p4_or_org_dentro(p_handle text, p_quem uuid) returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_p4_or_org(p_handle, p_quem);
begin
  if not interno.rede_p4_or_dentro(v, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return v;
end $$;

/** A pessoa vê o que é desta comunidade? Aberta: qualquer membro da Alumia; restrita ou fechada: só quem é da comunidade. */
create or replace function interno.rede_p4_or_ve_comunidade(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and exists (
    select 1 from rede_comunidades c where c.slug = p_slug
       and ((c.tipo = 'aberta' and c.slug not like 'fechado-%' and interno.rede2_membro(p_quem)) or interno.rede2_na_comunidade(c.slug, p_quem)))
$$;

/** A mediação desta comunidade (ou a equipe de cuidado). */
create or replace function interno.rede_p4_or_modera(p_slug text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.rede3_com_modera(p_slug, p_quem), false)
$$;

/**
 * As organizações de que a própria pessoa é de dentro e as comunidades dela, para a tela escolher onde trabalhar. Só as dela: não diz
 * quem mais está em cada uma nem quantas pessoas são.
 */
create or replace function public.rede_p4_or_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  return jsonb_build_object(
    'orgs', coalesce((select jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'nome', coalesce(f.rede_codinome, f.rede_handle), 'gerencio', interno.alumia_org_gere(v, o.perfil)) order by f.rede_handle)
                        from rede_orgs o join perfis f on f.id = o.perfil
                       where not f.suspenso and f.rede_handle is not null and interno.rede_p4_or_dentro(o.perfil, v)), '[]'::jsonb),
    'comunidades', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome, 'modero', interno.rede_p4_or_modera(c.slug, v)) order by c.nome)
                               from rede_comunidades c where interno.rede2_na_comunidade(c.slug, v)), '[]'::jsonb));
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_ligado()', 'rede_p4_or_membro()', 'rede_p4_or_texto(text, integer)', 'rede_p4_or_campo(text, integer, integer, text)',
    'rede_p4_or_link(text)', 'rede_p4_or_data(text)', 'rede_p4_or_org(text, uuid)', 'rede_p4_or_dentro(uuid, uuid)', 'rede_p4_or_org_dentro(text, uuid)',
    'rede_p4_or_ve_comunidade(text, uuid)', 'rede_p4_or_modera(text, uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  revoke all on function public.rede_p4_or_minhas() from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_p4_or_minhas() from anon;
    grant execute on function public.rede_p4_or_minhas() to authenticated, service_role;
  end if;
end $$;

-- ── 52. Quadro da organização ────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_p4_or_cartoes (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  notas text not null default '' check (char_length(notas) <= 500),
  coluna text not null default 'a_fazer' check (coluna in ('a_fazer', 'fazendo', 'feito')),
  prazo date,
  -- O ato que a organização chama (o cartão estende as tarefas do ato) e a função responsável: nunca uma pessoa.
  ato uuid references interno.rede_chamados (post) on delete set null,
  funcao uuid references interno.rede_org_funcoes (id) on delete set null,
  criado_em timestamptz not null default now(),
  movido_dia date not null default current_date
);
-- 122. Rodízio: o cartão recorrente e a escala de funções (ids de rede_org_funcoes da mesma organização, na ordem da escala).
alter table interno.rede_p4_or_cartoes add column if not exists recorrencia text;
alter table interno.rede_p4_or_cartoes add column if not exists rodizio uuid[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rede_p4_or_cartoes_recorrencia') then
    alter table interno.rede_p4_or_cartoes add constraint rede_p4_or_cartoes_recorrencia
      check ((recorrencia is null or recorrencia in ('semanal', 'quinzenal', 'mensal')) and cardinality(rodizio) <= 9);
  end if;
end $$;
create index if not exists rede_p4_or_cartoes_org on interno.rede_p4_or_cartoes (org, coluna, prazo);
alter table interno.rede_p4_or_cartoes enable row level security;
-- "Eu assumo": só para a própria pessoa saber e para o total (a partir de 3). Nunca volta a ninguém quem assumiu.
create table if not exists interno.rede_p4_or_cartao_eu (
  cartao uuid not null references interno.rede_p4_or_cartoes (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  primary key (cartao, pessoa)
);
create index if not exists rede_p4_or_cartao_eu_pessoa on interno.rede_p4_or_cartao_eu (pessoa);
alter table interno.rede_p4_or_cartao_eu enable row level security;
revoke all on table interno.rede_p4_or_cartoes, interno.rede_p4_or_cartao_eu from public;

/** Um cartão para quem é de dentro: "eu" (assumi), "tem_quem" (alguém assumiu) e quantas pessoas só a partir de 3. */
create or replace function interno.rede_p4_or_cartao_json(c interno.rede_p4_or_cartoes, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', c.id, 'titulo', c.titulo, 'notas', c.notas, 'coluna', c.coluna, 'prazo', c.prazo,
    'ato', (select jsonb_build_object('id', k.post, 'titulo', coalesce(nullif(k.titulo, ''), 'Ato'), 'inicio', k.inicio)
              from rede_chamados k join rede_posts p on p.id = k.post where k.post = c.ato and coalesce(interno.rede_ve(p, p_quem), false)),
    'funcao', (select jsonb_build_object('id', f.id, 'nome', f.nome) from rede_org_funcoes f where f.id = c.funcao),
    'recorrencia', c.recorrencia,
    'rodizio', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by r.n)
                           from unnest(c.rodizio) with ordinality r(id, n) join rede_org_funcoes f on f.id = r.id), '[]'::jsonb),
    'eu', exists (select 1 from rede_p4_or_cartao_eu e where e.cartao = c.id and e.pessoa = p_quem),
    'tem_quem', exists (select 1 from rede_p4_or_cartao_eu e where e.cartao = c.id),
    'assumidas', interno.alumia_pessoas((select count(*) from rede_p4_or_cartao_eu e where e.cartao = c.id)))
$$;

/** O cartão pelo id, para quem é de dentro da organização dele (senão, nao_encontrado). */
create or replace function interno.rede_p4_or_cartao_de(p_id uuid, p_quem uuid) returns interno.rede_p4_or_cartoes language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_p4_or_cartoes;
begin
  select * into c from rede_p4_or_cartoes where id = p_id;
  if not found or not interno.rede_p4_or_dentro(c.org, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return c;
end $$;

/** Um id que veio da tela (texto), ou nulo; outra coisa, invalido:<campo>. */
create or replace function interno.rede_p4_or_id(p text, p_campo text) returns uuid language plpgsql immutable as $$
begin
  if nullif(btrim(coalesce(p, '')), '') is null then return null; end if;
  if p !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then perform interno.erro('invalido:' || p_campo); end if;
  return p::uuid;
end $$;

/**
 * O quadro da organização (só para quem é de dentro): os cartões, as funções (para escolher a responsável) e os atos que a
 * organização chama e ainda não passaram (para ligar o cartão a um ato).
 */
create or replace function public.rede_p4_or_quadro(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object(
    'gerencio', interno.alumia_org_gere(v, v_org),
    'cartoes', coalesce((select jsonb_agg(interno.rede_p4_or_cartao_json(c, v) order by c.prazo nulls last, c.criado_em)
                           from rede_p4_or_cartoes c where c.org = v_org), '[]'::jsonb),
    'funcoes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome) order by f.nome) from rede_org_funcoes f where f.org = v_org), '[]'::jsonb),
    'atos', coalesce((select jsonb_agg(jsonb_build_object('id', k.post, 'titulo', coalesce(nullif(k.titulo, ''), 'Ato'), 'inicio', k.inicio) order by k.inicio)
                        from rede_chamados k where not coalesce(k.cancelado, false) and k.inicio > now() - interval '1 day'
                         and interno.rede_ato_organiza(k.post, v_org)), '[]'::jsonb));
end $$;

/** Quem é de dentro põe um cartão: título, notas, prazo, o ato da organização e a função responsável (os dois opcionais). */
create or replace function public.rede_p4_or_cartao_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_ato uuid; v_funcao uuid; v_rec text := nullif(btrim(coalesce(p ->> 'recorrencia', '')), ''); v_rodizio uuid[] := '{}'; x rede_p4_or_cartoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  v_ato := interno.rede_p4_or_id(p ->> 'ato', 'ato');
  if v_ato is not null and not interno.rede_ato_organiza(v_ato, v_org) then perform interno.erro('invalido:ato'); end if;
  v_funcao := interno.rede_p4_or_id(p ->> 'funcao', 'funcao');
  if v_funcao is not null and not exists (select 1 from rede_org_funcoes f where f.id = v_funcao and f.org = v_org) then perform interno.erro('invalido:funcao'); end if;
  -- 122. A escala: funções da mesma organização, sem repetir, até 9; só com recorrência. Sem função escolhida, começa pela primeira.
  if v_rec is not null and v_rec not in ('semanal', 'quinzenal', 'mensal') then perform interno.erro('invalido:recorrencia'); end if;
  if jsonb_typeof(p -> 'rodizio') = 'array' and jsonb_array_length(p -> 'rodizio') > 0 then
    if v_rec is null then perform interno.erro('invalido:rodizio'); end if;
    select coalesce(array_agg(interno.rede_p4_or_id(e.valor, 'rodizio') order by e.n), '{}') into v_rodizio
      from jsonb_array_elements_text(p -> 'rodizio') with ordinality e(valor, n);
    if cardinality(v_rodizio) > 9 or cardinality(v_rodizio) <> (select count(distinct u) from unnest(v_rodizio) u)
       or exists (select 1 from unnest(v_rodizio) u where not exists (select 1 from rede_org_funcoes f where f.id = u and f.org = v_org)) then
      perform interno.erro('invalido:rodizio');
    end if;
    if v_funcao is null then v_funcao := v_rodizio[1]; end if;
  end if;
  perform interno.limite('alumia_p4_or_cartao', 60, 60);
  insert into rede_p4_or_cartoes (org, titulo, notas, prazo, ato, funcao, recorrencia, rodizio)
  values (v_org, interno.rede_p4_or_campo(p ->> 'titulo', 3, 120, 'titulo'), interno.rede_p4_or_campo(p ->> 'notas', 0, 500, 'notas'),
          coalesce(interno.rede_p4_or_data(p ->> 'prazo'), case when v_rec is not null then current_date end), v_ato, v_funcao, v_rec, v_rodizio)
  returning * into x;
  return interno.rede_p4_or_cartao_json(x, v);
end $$;

/** 122. A próxima função da escala: a que vem depois da atual (volta ao começo); sem escala, a mesma. */
create or replace function interno.rede_p4_or_proxima_funcao(p_rodizio uuid[], p_atual uuid) returns uuid language sql immutable as $$
  select case when cardinality(p_rodizio) = 0 then p_atual
              when array_position(p_rodizio, p_atual) is null then p_rodizio[1]
              else p_rodizio[(array_position(p_rodizio, p_atual) % cardinality(p_rodizio)) + 1] end
$$;

/** 122. O prazo seguinte do cartão recorrente. */
create or replace function interno.rede_p4_or_proximo_prazo(p_prazo date, p_rec text) returns date language sql immutable as $$
  select (coalesce(p_prazo, current_date) + case p_rec when 'semanal' then interval '7 days' when 'quinzenal' then interval '14 days' else interval '1 month' end)::date
$$;

/**
 * Quem é de dentro move o cartão de coluna. 122: o cartão recorrente que vai para "feito" nasce de novo em "a fazer", com o prazo
 * seguinte e a próxima função da escala (sem copiar quem assumiu); o que foi feito deixa de ser recorrente, para não nascer duas vezes.
 */
create or replace function public.rede_p4_or_cartao_mover(p_id uuid, p_coluna text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_or_cartoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  c := interno.rede_p4_or_cartao_de(p_id, v);
  if p_coluna is null or p_coluna not in ('a_fazer', 'fazendo', 'feito') then perform interno.erro('invalido:coluna'); end if;
  perform interno.limite('alumia_p4_or_mover', 300, 60);
  if p_coluna = 'feito' and c.coluna <> 'feito' and c.recorrencia is not null then
    insert into rede_p4_or_cartoes (org, titulo, notas, prazo, ato, funcao, recorrencia, rodizio)
    values (c.org, c.titulo, c.notas, interno.rede_p4_or_proximo_prazo(c.prazo, c.recorrencia), null,
            interno.rede_p4_or_proxima_funcao(c.rodizio, c.funcao), c.recorrencia, c.rodizio);
    update rede_p4_or_cartoes set coluna = p_coluna, movido_dia = current_date, recorrencia = null where id = c.id returning * into c;
  else
    update rede_p4_or_cartoes set coluna = p_coluna, movido_dia = current_date where id = c.id returning * into c;
  end if;
  return interno.rede_p4_or_cartao_json(c, v);
end $$;

/** "Eu assumo" (ou desfaz). Só guarda que a pessoa assumiu; ninguém mais fica sabendo quem. */
create or replace function public.rede_p4_or_cartao_assumir(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_or_cartoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  c := interno.rede_p4_or_cartao_de(p_id, v);
  perform interno.limite('alumia_p4_or_assumir', 120, 60);
  if coalesce(p_sim, false) then
    insert into rede_p4_or_cartao_eu (cartao, pessoa) values (c.id, v) on conflict do nothing;
  else
    delete from rede_p4_or_cartao_eu where cartao = c.id and pessoa = v;
  end if;
  return interno.rede_p4_or_cartao_json(c, v);
end $$;

/** Quem gerencia apaga o cartão. */
create or replace function public.rede_p4_or_cartao_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_or_cartoes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  c := interno.rede_p4_or_cartao_de(p_id, v);
  if not interno.alumia_org_gere(v, c.org) then perform interno.erro('sem_permissao'); end if;
  delete from rede_p4_or_cartoes where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_cartao_json(interno.rede_p4_or_cartoes, uuid)', 'rede_p4_or_cartao_de(uuid, uuid)', 'rede_p4_or_id(text, text)',
    'rede_p4_or_proxima_funcao(uuid[], uuid)', 'rede_p4_or_proximo_prazo(date, text)'];
  v_pessoa text[] := array['rede_p4_or_quadro(text)', 'rede_p4_or_cartao_criar(jsonb)', 'rede_p4_or_cartao_mover(uuid, text)', 'rede_p4_or_cartao_assumir(uuid, boolean)', 'rede_p4_or_cartao_apagar(uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 53. Enquete de horário para reunião ─────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_p4_or_horarios (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  opcoes timestamptz[] not null check (cardinality(opcoes) between 2 and 12),
  fecha_em timestamptz not null,
  fechada boolean not null default false,
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_or_horarios_org on interno.rede_p4_or_horarios (org, criada_em desc);
alter table interno.rede_p4_or_horarios enable row level security;
-- Só para ninguém votar duas vezes: quem votou, nunca o quê.
create table if not exists interno.rede_p4_or_horario_votantes (
  enquete uuid not null references interno.rede_p4_or_horarios (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  primary key (enquete, pessoa)
);
alter table interno.rede_p4_or_horario_votantes enable row level security;
-- O voto vira um contador por horário: nenhuma linha por voto, nenhuma hora do voto (não dá para casar com quem votou).
create table if not exists interno.rede_p4_or_horario_somas (
  enquete uuid not null references interno.rede_p4_or_horarios (id) on delete cascade,
  opcao smallint not null check (opcao between 1 and 12),
  total integer not null default 0 check (total >= 0),
  primary key (enquete, opcao)
);
alter table interno.rede_p4_or_horario_somas enable row level security;
revoke all on table interno.rede_p4_or_horarios, interno.rede_p4_or_horario_votantes, interno.rede_p4_or_horario_somas from public;

/**
 * Uma enquete para quem é de dentro. Aberta: só os horários e se a própria pessoa já votou (nada de parcial, que deixaria ver o voto
 * de quem acabou de votar). Fechada: cada total só a partir de 3, o total de quem votou só a partir de 3 e o melhor horário (o de
 * mais marcas, só se tiver pelo menos 3; empate, o mais cedo).
 */
create or replace function interno.rede_p4_or_horario_json(h interno.rede_p4_or_horarios, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with fechada as (select h.fechada or h.fecha_em <= now() as f),
       somas as (select o.n, o.quando, coalesce(s.total, 0) as total
                   from unnest(h.opcoes) with ordinality o(quando, n) left join rede_p4_or_horario_somas s on s.enquete = h.id and s.opcao = o.n)
  select jsonb_build_object('id', h.id, 'titulo', h.titulo, 'opcoes', to_jsonb(h.opcoes), 'fecha_em', h.fecha_em, 'fechada', (select f from fechada),
    'votei', exists (select 1 from rede_p4_or_horario_votantes v where v.enquete = h.id and v.pessoa = p_quem),
    'posso_fechar', interno.alumia_org_mesa(p_quem, h.org),
    'resultado', case when (select f from fechada) then jsonb_build_object(
        'votantes', interno.alumia_pessoas((select count(*) from rede_p4_or_horario_votantes v where v.enquete = h.id)),
        'totais', (select jsonb_agg(interno.alumia_pessoas(s.total) order by s.n) from somas s),
        'melhor', (select s.n from somas s where s.total >= 3 order by s.total desc, s.quando limit 1))
      end)
$$;

create or replace function interno.rede_p4_or_horario_de(p_id uuid, p_quem uuid) returns interno.rede_p4_or_horarios language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare h rede_p4_or_horarios;
begin
  select * into h from rede_p4_or_horarios where id = p_id;
  if not found or not interno.rede_p4_or_dentro(h.org, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return h;
end $$;

/** As enquetes de horário da organização (as 30 mais novas), só para quem é de dentro. */
create or replace function public.rede_p4_or_horarios(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object('posso_criar', interno.alumia_org_mesa(v, v_org),
    'enquetes', coalesce((select jsonb_agg(interno.rede_p4_or_horario_json(h, v) order by h.criada_em desc)
                            from (select * from rede_p4_or_horarios x where x.org = v_org order by x.criada_em desc limit 30) h), '[]'::jsonb));
end $$;

/** Quem conduz a mesa (gerencia ou tem a permissão "mesa") abre a enquete: 2 a 12 horários no futuro e quando ela fecha. */
create or replace function public.rede_p4_or_horario_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_opcoes timestamptz[]; v_fecha timestamptz; x rede_p4_or_horarios;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  if not interno.alumia_org_mesa(v, v_org) then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p -> 'opcoes') <> 'array' then perform interno.erro('invalido:opcoes'); end if;
  begin
    select array_agg(distinct e::timestamptz order by e::timestamptz) into v_opcoes from jsonb_array_elements_text(p -> 'opcoes') e;
    v_fecha := (p ->> 'fecha_em')::timestamptz;
  exception when others then
    perform interno.erro('invalido:opcoes');
  end;
  if coalesce(cardinality(v_opcoes), 0) not between 2 and 12 or v_opcoes[1] <= now() then perform interno.erro('invalido:opcoes'); end if;
  if v_fecha is null or v_fecha <= now() or v_fecha > v_opcoes[1] then perform interno.erro('invalido:fecha_em'); end if;
  perform interno.limite('alumia_p4_or_horario', 20, 1440);
  insert into rede_p4_or_horarios (org, titulo, opcoes, fecha_em) values (v_org, interno.rede_p4_or_campo(p ->> 'titulo', 3, 120, 'titulo'), v_opcoes, v_fecha)
  returning * into x;
  return interno.rede_p4_or_horario_json(x, v);
end $$;

/**
 * Quem é de dentro vota uma vez: os horários em que pode (índices 1..n; vazio vale "não posso em nenhum"). O banco guarda que a pessoa
 * votou e soma 1 no contador de cada horário marcado, sem nada que ligue um ao outro.
 */
create or replace function public.rede_p4_or_horario_votar(p_id uuid, p_opcoes integer[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; h rede_p4_or_horarios; v_n integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  h := interno.rede_p4_or_horario_de(p_id, v);
  if h.fechada or h.fecha_em <= now() then perform interno.erro('fechada'); end if;
  if exists (select 1 from unnest(coalesce(p_opcoes, '{}')) o where o is null or o < 1 or o > cardinality(h.opcoes)) then perform interno.erro('invalido:opcoes'); end if;
  insert into rede_p4_or_horario_votantes (enquete, pessoa) values (h.id, v) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then perform interno.erro('ja_votou'); end if;
  insert into rede_p4_or_horario_somas (enquete, opcao, total)
  select h.id, o::smallint, 1 from (select distinct o from unnest(coalesce(p_opcoes, '{}')) o) d
  on conflict (enquete, opcao) do update set total = rede_p4_or_horario_somas.total + 1;
  return interno.rede_p4_or_horario_json(h, v);
end $$;

/** Quem conduz a mesa fecha antes da hora. */
create or replace function public.rede_p4_or_horario_fechar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; h rede_p4_or_horarios;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  h := interno.rede_p4_or_horario_de(p_id, v);
  if not interno.alumia_org_mesa(v, h.org) then perform interno.erro('sem_permissao'); end if;
  update rede_p4_or_horarios set fechada = true where id = h.id returning * into h;
  return interno.rede_p4_or_horario_json(h, v);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_horario_json(interno.rede_p4_or_horarios, uuid)', 'rede_p4_or_horario_de(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_or_horarios(text)', 'rede_p4_or_horario_criar(jsonb)', 'rede_p4_or_horario_votar(uuid, integer[])', 'rede_p4_or_horario_fechar(uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 54. Reuniões recorrentes ────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists interno.rede_p4_or_reunioes (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  frequencia text not null check (frequencia in ('semanal', 'quinzenal', 'mensal')),
  -- 0 = domingo ... 6 = sábado. No mensal, a semana do mês (1 a 4, ou 5 = a última).
  dia_semana smallint not null check (dia_semana between 0 and 6),
  semana_do_mes smallint check (semana_do_mes is null or semana_do_mes between 1 and 5),
  hora time not null,
  duracao_min smallint not null default 90 check (duracao_min between 15 and 480),
  local_tipo text not null check (local_tipo in ('praca', 'biblioteca', 'sindicato', 'escola', 'universidade', 'associacao', 'online', 'outro')),
  local_texto text not null default '' check (char_length(local_texto) <= 140),
  inicio date not null,
  fim date,
  -- O lembrete vai no .ics feito no aparelho (alarme do calendário de quem baixou): o servidor não manda aviso nenhum.
  lembrete_min smallint not null default 60 check (lembrete_min in (0, 15, 60, 1440)),
  criada_em timestamptz not null default now(),
  check ((frequencia = 'mensal') = (semana_do_mes is not null)),
  check (fim is null or fim >= inicio)
);
create index if not exists rede_p4_or_reunioes_org on interno.rede_p4_or_reunioes (org);
alter table interno.rede_p4_or_reunioes enable row level security;
revoke all on table interno.rede_p4_or_reunioes from public;

create or replace function interno.rede_p4_or_reuniao_json(r interno.rede_p4_or_reunioes) returns jsonb language sql stable as $$
  select jsonb_build_object('id', r.id, 'titulo', r.titulo, 'frequencia', r.frequencia, 'dia_semana', r.dia_semana, 'semana_do_mes', r.semana_do_mes,
    'hora', to_char(r.hora, 'HH24:MI'), 'duracao_min', r.duracao_min, 'local_tipo', r.local_tipo, 'local_texto', r.local_texto, 'inicio', r.inicio, 'fim', r.fim,
    'lembrete_min', r.lembrete_min)
$$;

/** As reuniões recorrentes da organização, só para quem é de dentro. As datas e o .ics saem no aparelho. */
create or replace function public.rede_p4_or_reunioes(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object('posso_criar', interno.alumia_org_mesa(v, v_org),
    'reunioes', coalesce((select jsonb_agg(interno.rede_p4_or_reuniao_json(r) order by r.dia_semana, r.hora) from rede_p4_or_reunioes r where r.org = v_org), '[]'::jsonb));
end $$;

/** Quem conduz a mesa marca a reunião recorrente (até 20 por organização). */
create or replace function public.rede_p4_or_reuniao_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_freq text := coalesce(p ->> 'frequencia', ''); v_semana smallint; v_dia smallint; v_hora time; v_dur smallint; v_lem smallint; x rede_p4_or_reunioes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  if not interno.alumia_org_mesa(v, v_org) then perform interno.erro('sem_permissao'); end if;
  if v_freq not in ('semanal', 'quinzenal', 'mensal') then perform interno.erro('invalido:frequencia'); end if;
  if coalesce(p ->> 'dia_semana', '') !~ '^[0-6]$' then perform interno.erro('invalido:dia_semana'); end if;
  v_dia := (p ->> 'dia_semana')::smallint;
  if v_freq = 'mensal' then
    if coalesce(p ->> 'semana_do_mes', '') !~ '^[1-5]$' then perform interno.erro('invalido:semana_do_mes'); end if;
    v_semana := (p ->> 'semana_do_mes')::smallint;
  end if;
  if coalesce(p ->> 'hora', '') !~ '^([01]\d|2[0-3]):[0-5]\d$' then perform interno.erro('invalido:hora'); end if;
  v_hora := (p ->> 'hora')::time;
  v_dur := case when coalesce(p ->> 'duracao_min', '') ~ '^\d{2,3}$' then (p ->> 'duracao_min')::smallint else 90 end;
  if v_dur not between 15 and 480 then perform interno.erro('invalido:duracao_min'); end if;
  v_lem := case when coalesce(p ->> 'lembrete_min', '') ~ '^\d{1,4}$' then (p ->> 'lembrete_min')::smallint else 60 end;
  if v_lem not in (0, 15, 60, 1440) then perform interno.erro('invalido:lembrete_min'); end if;
  if coalesce(p ->> 'local_tipo', '') not in ('praca', 'biblioteca', 'sindicato', 'escola', 'universidade', 'associacao', 'online', 'outro') then perform interno.erro('invalido:local_tipo'); end if;
  if (select count(*) from rede_p4_or_reunioes r where r.org = v_org) >= 20 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_or_reuniao', 20, 1440);
  insert into rede_p4_or_reunioes (org, titulo, frequencia, dia_semana, semana_do_mes, hora, duracao_min, local_tipo, local_texto, inicio, fim, lembrete_min)
  values (v_org, interno.rede_p4_or_campo(p ->> 'titulo', 3, 120, 'titulo'), v_freq, v_dia, v_semana, v_hora, v_dur, p ->> 'local_tipo',
          interno.rede_p4_or_texto(p ->> 'local_texto', 140), coalesce(interno.rede_p4_or_data(p ->> 'inicio'), current_date), interno.rede_p4_or_data(p ->> 'fim'), v_lem)
  returning * into x;
  return interno.rede_p4_or_reuniao_json(x);
exception when check_violation then
  perform interno.erro('invalido:fim');
  return null;
end $$;

/** Quem conduz a mesa tira a reunião recorrente. */
create or replace function public.rede_p4_or_reuniao_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; r rede_p4_or_reunioes;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into r from rede_p4_or_reunioes where id = p_id;
  if not found or not interno.rede_p4_or_dentro(r.org, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_org_mesa(v, r.org) then perform interno.erro('sem_permissao'); end if;
  delete from rede_p4_or_reunioes where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_or_reunioes(text)', 'rede_p4_or_reuniao_criar(jsonb)', 'rede_p4_or_reuniao_apagar(uuid)'];
begin
  revoke all on function interno.rede_p4_or_reuniao_json(interno.rede_p4_or_reunioes) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_or_reuniao_json(interno.rede_p4_or_reunioes) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 55. Mural "ofereço / preciso" da comunidade ───────────────────────────────────────────────────────────────────────────
-- O pedido é como um post da comunidade: sai sob o codinome de quem pôs (por escolha dela, para combinar por mensagem). Sem endereço,
-- telefone, e-mail nem CPF no texto; some sozinho em 30 dias.
create table if not exists interno.rede_p4_or_mural (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade,
  autor uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null,
  categoria text not null default 'outro',
  titulo text not null check (char_length(btrim(titulo)) between 3 and 100),
  texto text not null default '' check (char_length(texto) <= 600),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days'
);
do $$ begin
  -- 63. Vagas e bicos entram no mesmo mural (a regra é trocada inteira, para valer também por cima da versão de antes).
  alter table interno.rede_p4_or_mural drop constraint if exists rede_p4_or_mural_tipo;
  alter table interno.rede_p4_or_mural add constraint rede_p4_or_mural_tipo check (tipo in ('ofereco', 'preciso', 'vaga', 'bico'));
  if not exists (select 1 from pg_constraint where conname = 'rede_p4_or_mural_categoria') then
    alter table interno.rede_p4_or_mural add constraint rede_p4_or_mural_categoria
      check (categoria in ('doacao', 'emprestimo', 'aula', 'cuidado', 'mudanca', 'outro'));
  end if;
end $$;
-- 63. A vaga ou o bico pode levar um link https (o anúncio da cooperativa, o formulário): sem perfil profissional de ninguém.
alter table interno.rede_p4_or_mural add column if not exists link text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rede_p4_or_mural_link') then
    alter table interno.rede_p4_or_mural add constraint rede_p4_or_mural_link
      check (link is null or (tipo in ('vaga', 'bico') and link ~ '^https://[^\s/@]{3,}(/[^\s]*)?$' and char_length(link) <= 300));
  end if;
end $$;
create index if not exists rede_p4_or_mural_comunidade on interno.rede_p4_or_mural (comunidade, expira_em desc);
create index if not exists rede_p4_or_mural_autor on interno.rede_p4_or_mural (autor);
alter table interno.rede_p4_or_mural enable row level security;
revoke all on table interno.rede_p4_or_mural from public;

/** Um pedido do mural: o codinome e o @ de quem pôs (para combinar por mensagem) e se é da própria pessoa. Nunca quem respondeu. */
create or replace function interno.rede_p4_or_mural_json(m interno.rede_p4_or_mural, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', m.id, 'tipo', m.tipo, 'categoria', m.categoria, 'titulo', m.titulo, 'texto', m.texto,
    'link', m.link, 'criado_em', m.criado_em, 'expira_em', m.expira_em, 'meu', m.autor = p_quem,
    'autor', (select jsonb_build_object('codinome', coalesce(f.rede_codinome, f.rede_handle), 'handle', f.rede_handle) from perfis f where f.id = m.autor))
$$;

/**
 * O mural da comunidade (os 100 mais novos que ainda valem), para quem vê a comunidade; sem os pedidos de quem a pessoa bloqueou ou
 * de quem a bloqueou, nem de conta suspensa. Filtra por tipo, se vier.
 */
create or replace function public.rede_p4_or_mural(p_slug text, p_tipo text default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if not interno.rede_p4_or_ve_comunidade(p_slug, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'posso_por', interno.rede2_na_comunidade(p_slug, v),
    'modero', interno.rede_p4_or_modera(p_slug, v),
    'itens', coalesce((select jsonb_agg(interno.rede_p4_or_mural_json(m, v) order by m.criado_em desc)
                         from (select x.* from rede_p4_or_mural x join perfis f on f.id = x.autor
                                where x.comunidade = p_slug and x.expira_em > now() and not f.suspenso
                                  and (p_tipo is null or x.tipo = p_tipo) and not interno.rede_bloqueado(v, x.autor)
                                order by x.criado_em desc limit 100) m), '[]'::jsonb));
end $$;

/**
 * Quem é da comunidade põe um pedido (até 5 valendo por comunidade). O texto passa pela conferência de dado pessoal. 63: a vaga ou o
 * bico não tem categoria (fica "outro") e pode levar um link https; nada de perfil profissional (formação, experiência, currículo).
 */
create or replace function public.rede_p4_or_mural_por(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := p ->> 'comunidade'; v_tipo text := coalesce(p ->> 'tipo', ''); v_cat text := coalesce(nullif(p ->> 'categoria', ''), 'outro'); x rede_p4_or_mural;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if v_slug is null or not interno.rede2_na_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  if v_tipo not in ('ofereco', 'preciso', 'vaga', 'bico') then perform interno.erro('invalido:tipo'); end if;
  if v_tipo in ('vaga', 'bico') then v_cat := 'outro'; end if;
  if v_cat not in ('doacao', 'emprestimo', 'aula', 'cuidado', 'mudanca', 'outro') then perform interno.erro('invalido:categoria'); end if;
  if (select count(*) from rede_p4_or_mural m where m.autor = v and m.comunidade = v_slug and m.expira_em > now()) >= 5 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_or_mural', 10, 1440);
  insert into rede_p4_or_mural (comunidade, autor, tipo, categoria, titulo, texto, link)
  values (v_slug, v, v_tipo, v_cat, interno.rede_p4_or_campo(p ->> 'titulo', 3, 100, 'titulo'), interno.rede_p4_or_campo(p ->> 'texto', 0, 600, 'texto'),
          case when v_tipo in ('vaga', 'bico') then interno.rede_p4_or_link(p ->> 'link') end)
  returning * into x;
  return interno.rede_p4_or_mural_json(x, v);
end $$;

/** Quem pôs tira o pedido; a mediação da comunidade também. */
create or replace function public.rede_p4_or_mural_tirar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_or_mural;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into m from rede_p4_or_mural where id = p_id;
  if not found or not interno.rede_p4_or_ve_comunidade(m.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if m.autor <> v and not interno.rede_p4_or_modera(m.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  delete from rede_p4_or_mural where id = m.id;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_or_mural(text, text)', 'rede_p4_or_mural_por(jsonb)', 'rede_p4_or_mural_tirar(uuid)'];
begin
  revoke all on function interno.rede_p4_or_mural_json(interno.rede_p4_or_mural, uuid) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_or_mural_json(interno.rede_p4_or_mural, uuid) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 56. Banco de tempo da comunidade ──────────────────────────────────────────────────────────────────────────────────────
-- Troca de horas de serviço, sem dinheiro. Quem recebeu registra e quem deu confirma (sem a confirmação, a troca não conta; some em 14
-- dias). Cada pessoa vê só as trocas de que participou e o próprio saldo; nenhuma função soma o saldo de outra pessoa, lista as trocas
-- de alguém para terceiros ou faz ranking. Só a data (sem hora).
create table if not exists interno.rede_p4_or_horas (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade,
  deu uuid not null references interno.perfis (id) on delete cascade,
  recebeu uuid not null references interno.perfis (id) on delete cascade,
  minutos smallint not null check (minutos between 30 and 480 and minutos % 30 = 0),
  servico text not null check (char_length(btrim(servico)) between 3 and 120),
  estado text not null default 'pendente' check (estado in ('pendente', 'confirmada', 'recusada')),
  dia date not null default current_date,
  check (deu <> recebeu)
);
create index if not exists rede_p4_or_horas_deu on interno.rede_p4_or_horas (deu, estado);
create index if not exists rede_p4_or_horas_recebeu on interno.rede_p4_or_horas (recebeu, estado);
alter table interno.rede_p4_or_horas enable row level security;
revoke all on table interno.rede_p4_or_horas from public;

/** Uma troca vista por quem participou: o papel dela, a outra pessoa (codinome e @, que ela já conhece) e se pode confirmar. */
create or replace function interno.rede_p4_or_hora_json(h interno.rede_p4_or_horas, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', h.id, 'servico', h.servico, 'minutos', h.minutos, 'estado', h.estado, 'dia', h.dia,
    'papel', case when h.deu = p_quem then 'dei' else 'recebi' end,
    'pode_responder', h.deu = p_quem and h.estado = 'pendente',
    'outra', (select jsonb_build_object('codinome', coalesce(f.rede_codinome, f.rede_handle), 'handle', f.rede_handle)
                from perfis f where f.id = case when h.deu = p_quem then h.recebeu else h.deu end))
$$;

/**
 * O banco de tempo da própria pessoa nesta comunidade: o saldo (minutos dados menos recebidos, só os confirmados) e as trocas de que
 * ela participou. Só dela: não há como pedir o de outra pessoa.
 */
create or replace function public.rede_p4_or_banco_de_tempo(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if p_slug is null or not interno.rede2_na_comunidade(p_slug, v) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'saldo_min', coalesce((select sum(case when h.deu = v then h.minutos else -h.minutos end) from rede_p4_or_horas h
                            where h.comunidade = p_slug and h.estado = 'confirmada' and v in (h.deu, h.recebeu)), 0),
    'trocas', coalesce((select jsonb_agg(interno.rede_p4_or_hora_json(h, v) order by h.dia desc)
                          from (select * from rede_p4_or_horas x where x.comunidade = p_slug and v in (x.deu, x.recebeu)
                                   and (x.estado <> 'pendente' or x.dia > current_date - 14) order by x.dia desc limit 100) h), '[]'::jsonb));
end $$;

/** Quem recebeu o serviço registra: de quem (o @, que também é da comunidade), quantos minutos e o quê. Fica pendente até confirmar. */
create or replace function public.rede_p4_or_hora_registrar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := p ->> 'comunidade'; v_deu uuid; v_min integer; x rede_p4_or_horas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if v_slug is null or not interno.rede2_na_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  select f.id into v_deu from perfis f where f.rede_handle = lower(btrim(coalesce(p ->> 'de', ''), ' @')) and not f.suspenso;
  if v_deu is null or v_deu = v or not interno.rede2_na_comunidade(v_slug, v_deu) or interno.rede_bloqueado(v, v_deu) then perform interno.erro('invalido:de'); end if;
  if coalesce(p ->> 'minutos', '') !~ '^\d{2,3}$' then perform interno.erro('invalido:minutos'); end if;
  v_min := (p ->> 'minutos')::integer;
  if v_min not between 30 and 480 or v_min % 30 <> 0 then perform interno.erro('invalido:minutos'); end if;
  perform interno.limite('alumia_p4_or_hora', 20, 1440);
  insert into rede_p4_or_horas (comunidade, deu, recebeu, minutos, servico)
  values (v_slug, v_deu, v, v_min, interno.rede_p4_or_campo(p ->> 'servico', 3, 120, 'servico'))
  returning * into x;
  return interno.rede_p4_or_hora_json(x, v);
end $$;

/** Quem deu confirma (ou recusa) a troca pendente. */
create or replace function public.rede_p4_or_hora_responder(p_id uuid, p_sim boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_or_horas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into x from rede_p4_or_horas h where h.id = p_id and v in (h.deu, h.recebeu);
  if not found then perform interno.erro('nao_encontrado'); end if;
  if x.deu <> v or x.estado <> 'pendente' or x.dia <= current_date - 14 then perform interno.erro('sem_permissao'); end if;
  update rede_p4_or_horas set estado = case when coalesce(p_sim, false) then 'confirmada' else 'recusada' end where id = x.id returning * into x;
  return interno.rede_p4_or_hora_json(x, v);
end $$;

/** Quem participou apaga a troca: a pendente some; a confirmada também (e sai do saldo das duas pessoas). */
create or replace function public.rede_p4_or_hora_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  delete from rede_p4_or_horas h where h.id = p_id and v in (h.deu, h.recebeu);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_or_banco_de_tempo(text)', 'rede_p4_or_hora_registrar(jsonb)', 'rede_p4_or_hora_responder(uuid, boolean)', 'rede_p4_or_hora_apagar(uuid)'];
begin
  revoke all on function interno.rede_p4_or_hora_json(interno.rede_p4_or_horas, uuid) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_or_hora_json(interno.rede_p4_or_horas, uuid) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 57. Inventário solidário da organização ───────────────────────────────────────────────────────────────────────────────
-- Lista coisas, não pessoas: o megafone, a faixa, o som, quantos são e quantos estão emprestados. Quem é de dentro marca que pegou ou
-- que devolveu; o banco só soma e subtrai, sem guardar com quem está nem quando saiu.
create table if not exists interno.rede_p4_or_coisas (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 3 and 80),
  notas text not null default '' check (char_length(notas) <= 200),
  quantidade smallint not null default 1 check (quantidade between 1 and 99),
  emprestadas smallint not null default 0 check (emprestadas >= 0),
  check (emprestadas <= quantidade)
);
create index if not exists rede_p4_or_coisas_org on interno.rede_p4_or_coisas (org, nome);
alter table interno.rede_p4_or_coisas enable row level security;
revoke all on table interno.rede_p4_or_coisas from public;

create or replace function interno.rede_p4_or_coisa_json(c interno.rede_p4_or_coisas) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', c.id, 'nome', c.nome, 'notas', c.notas, 'quantidade', c.quantidade, 'emprestadas', c.emprestadas,
    'disponiveis', c.quantidade - c.emprestadas)
$$;

/** O inventário da organização, só para quem é de dentro. */
create or replace function public.rede_p4_or_inventario(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object('gerencio', interno.alumia_org_gere(v, v_org),
    'coisas', coalesce((select jsonb_agg(interno.rede_p4_or_coisa_json(c) order by c.nome) from rede_p4_or_coisas c where c.org = v_org), '[]'::jsonb));
end $$;

/** Quem gerencia põe uma coisa no inventário (até 50 por organização). */
create or replace function public.rede_p4_or_coisa_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_q integer; x rede_p4_or_coisas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  if not interno.alumia_org_gere(v, v_org) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'quantidade', '1') !~ '^\d{1,2}$' then perform interno.erro('invalido:quantidade'); end if;
  v_q := coalesce(nullif(p ->> 'quantidade', ''), '1')::integer;
  if v_q not between 1 and 99 then perform interno.erro('invalido:quantidade'); end if;
  if (select count(*) from rede_p4_or_coisas c where c.org = v_org) >= 50 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_or_coisa', 60, 60);
  insert into rede_p4_or_coisas (org, nome, notas, quantidade)
  values (v_org, interno.rede_p4_or_campo(p ->> 'nome', 3, 80, 'nome'), interno.rede_p4_or_campo(p ->> 'notas', 0, 200, 'notas'), v_q)
  returning * into x;
  return interno.rede_p4_or_coisa_json(x);
end $$;

/** Quem é de dentro pega (p_pegar verdadeiro) ou devolve uma unidade. Só a conta muda: ninguém fica sabendo com quem está. */
create or replace function public.rede_p4_or_coisa_emprestar(p_id uuid, p_pegar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_or_coisas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into x from rede_p4_or_coisas where id = p_id;
  if not found or not interno.rede_p4_or_dentro(x.org, v) then perform interno.erro('nao_encontrado'); end if;
  perform interno.limite('alumia_p4_or_emprestar', 120, 60);
  if coalesce(p_pegar, false) then
    update rede_p4_or_coisas set emprestadas = emprestadas + 1 where id = x.id and emprestadas < quantidade returning * into x;
    if not found then perform interno.erro('esgotado'); end if;
  else
    update rede_p4_or_coisas set emprestadas = emprestadas - 1 where id = x.id and emprestadas > 0 returning * into x;
    if not found then perform interno.erro('invalido:devolver'); end if;
  end if;
  return interno.rede_p4_or_coisa_json(x);
end $$;

/** Quem gerencia tira a coisa do inventário. */
create or replace function public.rede_p4_or_coisa_apagar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_or_coisas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into x from rede_p4_or_coisas where id = p_id;
  if not found or not interno.rede_p4_or_dentro(x.org, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.alumia_org_gere(v, x.org) then perform interno.erro('sem_permissao'); end if;
  delete from rede_p4_or_coisas where id = x.id;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_or_inventario(text)', 'rede_p4_or_coisa_criar(jsonb)', 'rede_p4_or_coisa_emprestar(uuid, boolean)', 'rede_p4_or_coisa_apagar(uuid)'];
begin
  revoke all on function interno.rede_p4_or_coisa_json(interno.rede_p4_or_coisas) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function interno.rede_p4_or_coisa_json(interno.rede_p4_or_coisas) from anon, authenticated; end if;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 58. Mapa de pontos de apoio da comunidade ─────────────────────────────────────────────────────────────────────────────
-- Cozinha solidária, biblioteca, plantão jurídico, ponto de água: só lugares públicos (quem propõe declara), e só aparecem depois que a
-- mediação da comunidade aprova. O endereço é o do lugar público (pode ter número); telefone, e-mail e CPF não entram. Não se guarda
-- quem propôs. O "como chegar" é o mesmo link do ato (lib/rede/atos/chegar.ts), sem pedir a posição do aparelho.
create table if not exists interno.rede_p4_or_pontos (
  id uuid primary key default gen_random_uuid(),
  comunidade text not null references interno.rede_comunidades (slug) on delete cascade,
  tipo text not null check (tipo in ('cozinha', 'biblioteca', 'juridico', 'agua', 'saude', 'abrigo', 'outro')),
  nome text not null check (char_length(btrim(nome)) between 3 and 100),
  endereco text not null check (char_length(btrim(endereco)) between 3 and 160),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  horario text not null default '' check (char_length(horario) <= 120),
  aprovado boolean not null default false,
  criado_dia date not null default current_date
);
create index if not exists rede_p4_or_pontos_comunidade on interno.rede_p4_or_pontos (comunidade, aprovado, tipo);
alter table interno.rede_p4_or_pontos enable row level security;
revoke all on table interno.rede_p4_or_pontos from public;

/** Texto de um lugar público: entre p_min e p_max, sem CPF, telefone nem e-mail (o número do endereço do lugar público pode). */
create or replace function interno.rede_p4_or_sem_contato(p text, p_min integer, p_max integer, p_campo text) returns text language plpgsql immutable set search_path = interno, pg_temp as $$
declare v text := interno.rede_p4_or_texto(p, p_max + 1);
begin
  if char_length(v) < p_min or char_length(v) > p_max then perform interno.erro('invalido:' || p_campo); end if;
  if v ~ '(^|[^0-9])\d{3}\.?\d{3}\.?\d{3}-?\d{2}([^0-9]|$)' or v ~ '\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}' or v ~ '@' then perform interno.erro('dado_pessoal'); end if;
  return v;
end $$;

create or replace function interno.rede_p4_or_ponto_json(x interno.rede_p4_or_pontos) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', x.id, 'tipo', x.tipo, 'nome', x.nome, 'endereco', x.endereco, 'cidade', x.cidade, 'horario', x.horario, 'aprovado', x.aprovado)
$$;

/** Os pontos aprovados da comunidade, para quem a vê; a mediação vê também os que esperam aprovação. */
create or replace function public.rede_p4_or_pontos(p_slug text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_modera boolean;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if not interno.rede_p4_or_ve_comunidade(p_slug, v) then perform interno.erro('nao_encontrado'); end if;
  v_modera := interno.rede_p4_or_modera(p_slug, v);
  return jsonb_build_object('posso_propor', interno.rede2_na_comunidade(p_slug, v), 'modero', v_modera,
    'pontos', coalesce((select jsonb_agg(interno.rede_p4_or_ponto_json(x) order by x.tipo, x.nome) from rede_p4_or_pontos x where x.comunidade = p_slug and x.aprovado), '[]'::jsonb),
    'pendentes', case when v_modera then coalesce((select jsonb_agg(interno.rede_p4_or_ponto_json(x) order by x.criado_dia) from rede_p4_or_pontos x where x.comunidade = p_slug and not x.aprovado), '[]'::jsonb) end);
end $$;

/** Quem é da comunidade propõe um ponto, declarando que é um lugar público. Fica esperando a mediação. */
create or replace function public.rede_p4_or_ponto_propor(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_slug text := p ->> 'comunidade'; x rede_p4_or_pontos;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if v_slug is null or not interno.rede2_na_comunidade(v_slug, v) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p ->> 'publico', '') <> 'true' then perform interno.erro('invalido:publico'); end if;
  if coalesce(p ->> 'tipo', '') not in ('cozinha', 'biblioteca', 'juridico', 'agua', 'saude', 'abrigo', 'outro') then perform interno.erro('invalido:tipo'); end if;
  if (select count(*) from rede_p4_or_pontos y where y.comunidade = v_slug and not y.aprovado) >= 50 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_or_ponto', 10, 1440);
  insert into rede_p4_or_pontos (comunidade, tipo, nome, endereco, cidade, horario)
  values (v_slug, p ->> 'tipo', interno.rede_p4_or_sem_contato(p ->> 'nome', 3, 100, 'nome'), interno.rede_p4_or_sem_contato(p ->> 'endereco', 3, 160, 'endereco'),
          interno.rede_p4_or_sem_contato(p ->> 'cidade', 2, 80, 'cidade'), interno.rede_p4_or_sem_contato(p ->> 'horario', 0, 120, 'horario'))
  returning * into x;
  return interno.rede_p4_or_ponto_json(x);
end $$;

/** A mediação aprova (o ponto aparece) ou recusa (o pedido some). Também tira um ponto já aprovado (p_aprovar falso). */
create or replace function public.rede_p4_or_ponto_decidir(p_id uuid, p_aprovar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_p4_or_pontos;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into x from rede_p4_or_pontos where id = p_id;
  if not found or not interno.rede_p4_or_ve_comunidade(x.comunidade, v) then perform interno.erro('nao_encontrado'); end if;
  if not interno.rede_p4_or_modera(x.comunidade, v) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_aprovar, false) then
    update rede_p4_or_pontos set aprovado = true where id = x.id returning * into x;
    return interno.rede_p4_or_ponto_json(x);
  end if;
  delete from rede_p4_or_pontos where id = x.id;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_sem_contato(text, integer, integer, text)', 'rede_p4_or_ponto_json(interno.rede_p4_or_pontos)'];
  v_pessoa text[] := array['rede_p4_or_pontos(text)', 'rede_p4_or_ponto_propor(jsonb)', 'rede_p4_or_ponto_decidir(uuid, boolean)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 59. Rota do ato para ver sem internet ─────────────────────────────────────────────────────────────────────────────────
-- Quem chama o ato (interno.rede_ato_organiza) desenha a rota (até 300 pontos com latitude e longitude, por exemplo de um GPX feito
-- num mapa livre) e os pontos de apoio do percurso (até 30). Quem vê o ato baixa tudo no aparelho antes de sair e vê a rota sem internet;
-- nada pede a posição do aparelho e o servidor não fica sabendo quem baixou (a leitura não grava nada).
create table if not exists interno.rede_p4_or_rotas (
  ato uuid primary key references interno.rede_chamados (post) on delete cascade,
  pontos jsonb not null check (jsonb_typeof(pontos) = 'array' and jsonb_array_length(pontos) between 2 and 300),
  apoios jsonb not null default '[]'::jsonb check (jsonb_typeof(apoios) = 'array' and jsonb_array_length(apoios) <= 30),
  atualizada_dia date not null default current_date
);
alter table interno.rede_p4_or_rotas enable row level security;
revoke all on table interno.rede_p4_or_rotas from public;

/** Uma coordenada válida (número entre os limites), arredondada a 5 casas (cerca de 1 m); fora disso, invalido:<campo>. */
create or replace function interno.rede_p4_or_coord(p jsonb, p_lim numeric, p_campo text) returns numeric language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) <> 'number' or abs((p #>> '{}')::numeric) > p_lim then perform interno.erro('invalido:' || p_campo); end if;
  return round((p #>> '{}')::numeric, 5);
end $$;

/** O ato (o post do chamado) que quem chama pode ver, ou nao_encontrado. */
create or replace function interno.rede_p4_or_ato_que_ve(p_ato uuid, p_quem uuid) returns interno.rede_chamados language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare k rede_chamados;
begin
  select c.* into k from rede_chamados c join rede_posts p on p.id = c.post where c.post = p_ato and coalesce(interno.rede_ve(p, p_quem), false);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return k;
end $$;

/** A rota do ato, para quem vê o ato: o ato (título, início, cidade, ponto), a rota (ou nula) e se a pessoa pode desenhar. */
create or replace function public.rede_p4_or_rota(p_ato uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; k rede_chamados; r rede_p4_or_rotas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  k := interno.rede_p4_or_ato_que_ve(p_ato, v);
  select * into r from rede_p4_or_rotas where ato = k.post;
  return jsonb_build_object(
    'ato', jsonb_build_object('id', k.post, 'titulo', coalesce(nullif(k.titulo, ''), 'Ato'), 'inicio', k.inicio, 'cidade', k.cidade, 'ponto', k.ponto, 'cancelado', coalesce(k.cancelado, false)),
    'posso_desenhar', interno.rede_ato_organiza(k.post, v),
    'rota', case when r.ato is not null then jsonb_build_object('pontos', r.pontos, 'apoios', r.apoios, 'atualizada_dia', r.atualizada_dia) end);
end $$;

/**
 * Os atos para a aba da rota: os que a pessoa chama (para desenhar) e os que ela marcou "vou" (o "vou" é dela e continua privado), que
 * ainda não passaram e têm rota. Só os dela: nada de quem mais vai.
 */
create or replace function public.rede_p4_or_rota_atos() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.post, 'titulo', coalesce(nullif(k.titulo, ''), 'Ato'), 'inicio', k.inicio, 'cidade', k.cidade,
                                                      'chamo', interno.rede_ato_organiza(k.post, v), 'tem_rota', exists (select 1 from rede_p4_or_rotas r where r.ato = k.post))
                                   order by k.inicio)
                     from rede_chamados k join rede_posts p on p.id = k.post
                    where k.inicio > now() - interval '1 day' and not coalesce(k.cancelado, false) and coalesce(interno.rede_ve(p, v), false)
                      and (interno.rede_ato_organiza(k.post, v)
                           or (exists (select 1 from rede_vou u where u.post = k.post and u.usuario = v) and exists (select 1 from rede_p4_or_rotas r where r.ato = k.post)))), '[]'::jsonb);
end $$;

/** Quem chama o ato salva a rota (troca a anterior inteira). */
create or replace function public.rede_p4_or_rota_salvar(p_ato uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; k rede_chamados; v_pontos jsonb; v_apoios jsonb;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  k := interno.rede_p4_or_ato_que_ve(p_ato, v);
  if not interno.rede_ato_organiza(k.post, v) then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(p -> 'pontos') <> 'array' or jsonb_array_length(p -> 'pontos') not between 2 and 300 then perform interno.erro('invalido:pontos'); end if;
  if exists (select 1 from jsonb_array_elements(p -> 'pontos') e where jsonb_typeof(e) <> 'array' or jsonb_array_length(e) <> 2) then perform interno.erro('invalido:pontos'); end if;
  select jsonb_agg(jsonb_build_array(interno.rede_p4_or_coord(e -> 0, 90, 'pontos'), interno.rede_p4_or_coord(e -> 1, 180, 'pontos')) order by n)
    into v_pontos from jsonb_array_elements(p -> 'pontos') with ordinality x(e, n);
  if coalesce(jsonb_typeof(p -> 'apoios'), 'null') not in ('array', 'null') or coalesce(jsonb_array_length(p -> 'apoios'), 0) > 30 then perform interno.erro('invalido:apoios'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('lat', interno.rede_p4_or_coord(e -> 'lat', 90, 'apoios'), 'lon', interno.rede_p4_or_coord(e -> 'lon', 180, 'apoios'),
                                               'tipo', case when e ->> 'tipo' in ('agua', 'saude', 'banheiro', 'juridico', 'encontro', 'dispersao', 'outro') then e ->> 'tipo' else 'outro' end,
                                               'nome', interno.rede_p4_or_sem_contato(e ->> 'nome', 2, 80, 'apoios')) order by n), '[]'::jsonb)
    into v_apoios from jsonb_array_elements(coalesce(p -> 'apoios', '[]'::jsonb)) with ordinality x(e, n);
  perform interno.limite('alumia_p4_or_rota', 30, 60);
  insert into rede_p4_or_rotas (ato, pontos, apoios, atualizada_dia) values (k.post, v_pontos, v_apoios, current_date)
  on conflict (ato) do update set pontos = excluded.pontos, apoios = excluded.apoios, atualizada_dia = current_date;
  return public.rede_p4_or_rota(k.post);
end $$;

/** Quem chama o ato apaga a rota. */
create or replace function public.rede_p4_or_rota_apagar(p_ato uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; k rede_chamados;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  k := interno.rede_p4_or_ato_que_ve(p_ato, v);
  if not interno.rede_ato_organiza(k.post, v) then perform interno.erro('sem_permissao'); end if;
  delete from rede_p4_or_rotas where ato = k.post;
  return jsonb_build_object('ok', true);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_coord(jsonb, numeric, text)', 'rede_p4_or_ato_que_ve(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_or_rota(uuid)', 'rede_p4_or_rota_atos()', 'rede_p4_or_rota_salvar(uuid, jsonb)', 'rede_p4_or_rota_apagar(uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 60. Consenso por posições ─────────────────────────────────────────────────────────────────────────────────────────────
-- Quem conduz a mesa põe uma proposta; cada pessoa de dentro marca uma posição (concordo, concordo com ressalva, me abstenho, bloqueio),
-- uma vez. Como na enquete de horário: o banco guarda que a pessoa se posicionou e soma num contador por posição, sem linha por voto
-- e sem hora. Aberto, ninguém vê parcial. Fechado: cada total só a partir de 3, o total de quem se posicionou só a partir de 3 e, com
-- 3 ou mais, se houve bloqueio (nunca quem bloqueou).
create table if not exists interno.rede_p4_or_consensos (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  proposta text not null check (char_length(btrim(proposta)) between 5 and 500),
  fecha_em timestamptz not null,
  fechado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists rede_p4_or_consensos_org on interno.rede_p4_or_consensos (org, criado_em desc);
alter table interno.rede_p4_or_consensos enable row level security;
-- Quem já se posicionou no consenso (item 60): só para não votar duas vezes; a posição vira contador, sem ligação com a pessoa.
create table if not exists interno.rede_p4_or_consenso_votantes (
  consenso uuid not null references interno.rede_p4_or_consensos (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  primary key (consenso, pessoa)
);
alter table interno.rede_p4_or_consenso_votantes enable row level security;
create table if not exists interno.rede_p4_or_consenso_somas (
  consenso uuid not null references interno.rede_p4_or_consensos (id) on delete cascade,
  posicao text not null check (posicao in ('concordo', 'ressalva', 'abstenho', 'bloqueio')),
  total integer not null default 0 check (total >= 0),
  primary key (consenso, posicao)
);
alter table interno.rede_p4_or_consenso_somas enable row level security;
revoke all on table interno.rede_p4_or_consensos, interno.rede_p4_or_consenso_votantes, interno.rede_p4_or_consenso_somas from public;

create or replace function interno.rede_p4_or_consenso_json(c interno.rede_p4_or_consensos, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with fechado as (select c.fechado or c.fecha_em <= now() as f),
       votantes as (select count(*) as n from rede_p4_or_consenso_votantes v where v.consenso = c.id),
       somas as (select o.posicao, coalesce(s.total, 0) as total
                   from unnest(array['concordo', 'ressalva', 'abstenho', 'bloqueio']) o(posicao) left join rede_p4_or_consenso_somas s on s.consenso = c.id and s.posicao = o.posicao)
  select jsonb_build_object('id', c.id, 'proposta', c.proposta, 'fecha_em', c.fecha_em, 'fechado', (select f from fechado),
    'votei', exists (select 1 from rede_p4_or_consenso_votantes v where v.consenso = c.id and v.pessoa = p_quem),
    'posso_fechar', interno.alumia_org_mesa(p_quem, c.org),
    'resultado', case when (select f from fechado) then jsonb_build_object(
        'votantes', interno.alumia_pessoas((select n from votantes)),
        'totais', (select jsonb_object_agg(s.posicao, interno.alumia_pessoas(s.total)) from somas s),
        'houve_bloqueio', case when (select n from votantes) >= 3 then (select s.total > 0 from somas s where s.posicao = 'bloqueio') end,
        'consenso', case when (select n from votantes) >= 3 then (select coalesce(sum(s.total) filter (where s.posicao = 'bloqueio'), 0) = 0
                                                                          and coalesce(sum(s.total) filter (where s.posicao in ('concordo', 'ressalva')), 0) > 0 from somas s) end)
      end)
$$;

create or replace function interno.rede_p4_or_consenso_de(p_id uuid, p_quem uuid) returns interno.rede_p4_or_consensos language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare c rede_p4_or_consensos;
begin
  select * into c from rede_p4_or_consensos where id = p_id;
  if not found or not interno.rede_p4_or_dentro(c.org, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return c;
end $$;

/** Os consensos da organização (os 30 mais novos), só para quem é de dentro. */
create or replace function public.rede_p4_or_consensos(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object('posso_criar', interno.alumia_org_mesa(v, v_org),
    'consensos', coalesce((select jsonb_agg(interno.rede_p4_or_consenso_json(c, v) order by c.criado_em desc)
                             from (select * from rede_p4_or_consensos x where x.org = v_org order by x.criado_em desc limit 30) c), '[]'::jsonb));
end $$;

/** Quem conduz a mesa põe a proposta e quando fecha (de 1 hora a 30 dias). */
create or replace function public.rede_p4_or_consenso_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_fecha timestamptz; x rede_p4_or_consensos;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  if not interno.alumia_org_mesa(v, v_org) then perform interno.erro('sem_permissao'); end if;
  begin
    v_fecha := (p ->> 'fecha_em')::timestamptz;
  exception when others then
    perform interno.erro('invalido:fecha_em');
  end;
  if v_fecha is null or v_fecha < now() + interval '1 hour' or v_fecha > now() + interval '30 days' then perform interno.erro('invalido:fecha_em'); end if;
  perform interno.limite('alumia_p4_or_consenso', 20, 1440);
  insert into rede_p4_or_consensos (org, proposta, fecha_em) values (v_org, interno.rede_p4_or_campo(p ->> 'proposta', 5, 500, 'proposta'), v_fecha)
  returning * into x;
  return interno.rede_p4_or_consenso_json(x, v);
end $$;

/** Quem é de dentro marca a posição, uma vez: guarda que se posicionou e soma 1 no contador da posição, sem nada que ligue um ao outro. */
create or replace function public.rede_p4_or_consenso_posicao(p_id uuid, p_posicao text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_or_consensos; v_n integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  c := interno.rede_p4_or_consenso_de(p_id, v);
  if c.fechado or c.fecha_em <= now() then perform interno.erro('fechada'); end if;
  if coalesce(p_posicao, '') not in ('concordo', 'ressalva', 'abstenho', 'bloqueio') then perform interno.erro('invalido:posicao'); end if;
  insert into rede_p4_or_consenso_votantes (consenso, pessoa) values (c.id, v) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then perform interno.erro('ja_votou'); end if;
  insert into rede_p4_or_consenso_somas (consenso, posicao, total) values (c.id, p_posicao, 1)
  on conflict (consenso, posicao) do update set total = rede_p4_or_consenso_somas.total + 1;
  return interno.rede_p4_or_consenso_json(c, v);
end $$;

/** Quem conduz a mesa fecha antes da hora. */
create or replace function public.rede_p4_or_consenso_fechar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; c rede_p4_or_consensos;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  c := interno.rede_p4_or_consenso_de(p_id, v);
  if not interno.alumia_org_mesa(v, c.org) then perform interno.erro('sem_permissao'); end if;
  update rede_p4_or_consensos set fechado = true where id = c.id returning * into c;
  return interno.rede_p4_or_consenso_json(c, v);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_consenso_json(interno.rede_p4_or_consensos, uuid)', 'rede_p4_or_consenso_de(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_or_consensos(text)', 'rede_p4_or_consenso_criar(jsonb)', 'rede_p4_or_consenso_posicao(uuid, text)', 'rede_p4_or_consenso_fechar(uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 61. Orçamento participativo da organização ────────────────────────────────────────────────────────────────────────────
-- Três fases pelo relógio: propostas (quem é de dentro propõe o uso de um valor da caixa, sem o nome de quem propôs), apoio (cada pessoa
-- de dentro apoia, uma vez, até 3 propostas; o banco guarda que ela apoiou e soma num contador por proposta, sem linha por apoio) e
-- votação, que é a consulta que já existe (rede_consultas, voto secreto do prompt 2): quem conduz a mesa abre a consulta com as
-- propostas mais apoiadas e o orçamento só aponta para ela. Este grupo não mexe no voto. Os apoios só aparecem depois do fim do apoio,
-- e cada total só a partir de 3.
create table if not exists interno.rede_p4_or_orcamentos (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  caixa uuid references interno.rede_org_caixas (id) on delete set null,
  centavos bigint not null check (centavos between 100 and 100000000000),
  propostas_ate timestamptz not null,
  apoio_ate timestamptz not null,
  consulta uuid references interno.rede_consultas (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (apoio_ate > propostas_ate)
);
create index if not exists rede_p4_or_orcamentos_org on interno.rede_p4_or_orcamentos (org, criado_em desc);
alter table interno.rede_p4_or_orcamentos enable row level security;
create table if not exists interno.rede_p4_or_orc_propostas (
  id uuid primary key default gen_random_uuid(),
  orcamento uuid not null references interno.rede_p4_or_orcamentos (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  descricao text not null default '' check (char_length(descricao) <= 600),
  centavos bigint not null check (centavos > 0)
);
create index if not exists rede_p4_or_orc_propostas_orcamento on interno.rede_p4_or_orc_propostas (orcamento);
alter table interno.rede_p4_or_orc_propostas enable row level security;
-- Quem já apoiou no orçamento participativo (item 61): só para apoiar uma vez; o apoio vira contador por proposta.
create table if not exists interno.rede_p4_or_orc_apoiadores (
  orcamento uuid not null references interno.rede_p4_or_orcamentos (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  primary key (orcamento, pessoa)
);
alter table interno.rede_p4_or_orc_apoiadores enable row level security;
create table if not exists interno.rede_p4_or_orc_apoios (
  proposta uuid primary key references interno.rede_p4_or_orc_propostas (id) on delete cascade,
  total integer not null default 0 check (total >= 0)
);
alter table interno.rede_p4_or_orc_apoios enable row level security;
revoke all on table interno.rede_p4_or_orcamentos, interno.rede_p4_or_orc_propostas, interno.rede_p4_or_orc_apoiadores, interno.rede_p4_or_orc_apoios from public;

/** A fase pelo relógio: propostas, apoio ou votacao. */
create or replace function interno.rede_p4_or_orc_fase(o interno.rede_p4_or_orcamentos) returns text language sql stable as $$
  select case when now() < o.propostas_ate then 'propostas' when now() < o.apoio_ate then 'apoio' else 'votacao' end
$$;

create or replace function interno.rede_p4_or_orcamento_json(o interno.rede_p4_or_orcamentos, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', o.id, 'titulo', o.titulo, 'centavos', o.centavos, 'propostas_ate', o.propostas_ate, 'apoio_ate', o.apoio_ate,
    'fase', interno.rede_p4_or_orc_fase(o),
    'caixa', (select jsonb_build_object('id', k.id, 'nome', k.nome) from rede_org_caixas k where k.id = o.caixa),
    'consulta', (select jsonb_build_object('id', c.id, 'pergunta', c.pergunta, 'prazo', c.prazo) from rede_consultas c where c.id = o.consulta),
    'apoiei', exists (select 1 from rede_p4_or_orc_apoiadores a where a.orcamento = o.id and a.pessoa = p_quem),
    'apoiadores', case when interno.rede_p4_or_orc_fase(o) = 'votacao' then interno.alumia_pessoas((select count(*) from rede_p4_or_orc_apoiadores a where a.orcamento = o.id)) end,
    'posso_conduzir', interno.alumia_org_mesa(p_quem, o.org),
    'propostas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'descricao', x.descricao, 'centavos', x.centavos,
                                     'apoios', case when interno.rede_p4_or_orc_fase(o) = 'votacao' then interno.alumia_pessoas(coalesce((select s.total from rede_p4_or_orc_apoios s where s.proposta = x.id), 0)) end)
                                   order by x.titulo)
                             from rede_p4_or_orc_propostas x where x.orcamento = o.id), '[]'::jsonb))
$$;

create or replace function interno.rede_p4_or_orcamento_de(p_id uuid, p_quem uuid) returns interno.rede_p4_or_orcamentos language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare o rede_p4_or_orcamentos;
begin
  select * into o from rede_p4_or_orcamentos where id = p_id;
  if not found or not interno.rede_p4_or_dentro(o.org, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return o;
end $$;

/** Os orçamentos da organização (os 10 mais novos) e as caixas dela (para escolher), só para quem é de dentro. */
create or replace function public.rede_p4_or_orcamentos(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object('posso_criar', interno.alumia_org_mesa(v, v_org),
    'caixas', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nome', k.nome) order by k.nome) from rede_org_caixas k where k.org = v_org), '[]'::jsonb),
    'consultas', case when interno.alumia_org_mesa(v, v_org) then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'pergunta', c.pergunta, 'prazo', c.prazo) order by c.prazo desc)
                                                                             from (select * from rede_consultas x where x.org = v_org order by x.prazo desc limit 10) c), '[]'::jsonb) end,
    'orcamentos', coalesce((select jsonb_agg(interno.rede_p4_or_orcamento_json(o, v) order by o.criado_em desc)
                              from (select * from rede_p4_or_orcamentos x where x.org = v_org order by x.criado_em desc limit 10) o), '[]'::jsonb));
end $$;

/** Quem conduz a mesa abre o orçamento: o valor, a caixa (da mesma organização, se quiser) e o fim das propostas e do apoio. */
create or replace function public.rede_p4_or_orcamento_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_caixa uuid; v_prop timestamptz; v_apoio timestamptz; x rede_p4_or_orcamentos;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  if not interno.alumia_org_mesa(v, v_org) then perform interno.erro('sem_permissao'); end if;
  v_caixa := interno.rede_p4_or_id(p ->> 'caixa', 'caixa');
  if v_caixa is not null and not exists (select 1 from rede_org_caixas k where k.id = v_caixa and k.org = v_org) then perform interno.erro('invalido:caixa'); end if;
  begin
    v_prop := (p ->> 'propostas_ate')::timestamptz;
    v_apoio := (p ->> 'apoio_ate')::timestamptz;
  exception when others then
    perform interno.erro('invalido:prazo');
  end;
  if v_prop is null or v_apoio is null or v_prop < now() + interval '1 hour' or v_apoio <= v_prop or v_apoio > now() + interval '120 days' then perform interno.erro('invalido:prazo'); end if;
  perform interno.limite('alumia_p4_or_orcamento', 10, 1440);
  insert into rede_p4_or_orcamentos (org, titulo, caixa, centavos, propostas_ate, apoio_ate)
  values (v_org, interno.rede_p4_or_campo(p ->> 'titulo', 3, 120, 'titulo'), v_caixa, coalesce(interno.alumia_o13_centavos(p -> 'centavos', 'centavos'), 0), v_prop, v_apoio)
  returning * into x;
  return interno.rede_p4_or_orcamento_json(x, v);
exception when check_violation then
  perform interno.erro('invalido:centavos');
  return null;
end $$;

/** Quem é de dentro propõe, na fase das propostas: o quê, por quê e quanto (até o valor do orçamento). Não guarda quem propôs. */
create or replace function public.rede_p4_or_orcamento_propor(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; o rede_p4_or_orcamentos; v_c bigint;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  o := interno.rede_p4_or_orcamento_de(p_id, v);
  if interno.rede_p4_or_orc_fase(o) <> 'propostas' then perform interno.erro('fora_da_fase'); end if;
  v_c := interno.alumia_o13_centavos(p -> 'centavos', 'centavos');
  if v_c is null or v_c < 1 or v_c > o.centavos then perform interno.erro('invalido:centavos'); end if;
  if (select count(*) from rede_p4_or_orc_propostas x where x.orcamento = o.id) >= 40 then perform interno.erro('limite'); end if;
  perform interno.limite('alumia_p4_or_orc_propor', 5, 1440);
  insert into rede_p4_or_orc_propostas (orcamento, titulo, descricao, centavos)
  values (o.id, interno.rede_p4_or_campo(p ->> 'titulo', 3, 120, 'titulo'), interno.rede_p4_or_campo(p ->> 'descricao', 0, 600, 'descricao'), v_c);
  return interno.rede_p4_or_orcamento_json(o, v);
end $$;

/** Quem é de dentro apoia, uma vez e na fase do apoio, de 1 a 3 propostas deste orçamento. */
create or replace function public.rede_p4_or_orcamento_apoiar(p_id uuid, p_propostas uuid[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; o rede_p4_or_orcamentos; v_n integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  o := interno.rede_p4_or_orcamento_de(p_id, v);
  if interno.rede_p4_or_orc_fase(o) <> 'apoio' then perform interno.erro('fora_da_fase'); end if;
  if coalesce(cardinality(p_propostas), 0) not between 1 and 3
     or exists (select 1 from unnest(p_propostas) u where u is null or not exists (select 1 from rede_p4_or_orc_propostas x where x.id = u and x.orcamento = o.id)) then
    perform interno.erro('invalido:propostas');
  end if;
  insert into rede_p4_or_orc_apoiadores (orcamento, pessoa) values (o.id, v) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then perform interno.erro('ja_votou'); end if;
  insert into rede_p4_or_orc_apoios (proposta, total) select distinct u, 1 from unnest(p_propostas) u
  on conflict (proposta) do update set total = rede_p4_or_orc_apoios.total + 1;
  return interno.rede_p4_or_orcamento_json(o, v);
end $$;

/** Quem conduz a mesa liga o orçamento à consulta (da mesma organização) em que se vota. A votação é a da consulta, sem mudança. */
create or replace function public.rede_p4_or_orcamento_consulta(p_id uuid, p_consulta uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; o rede_p4_or_orcamentos;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  o := interno.rede_p4_or_orcamento_de(p_id, v);
  if not interno.alumia_org_mesa(v, o.org) then perform interno.erro('sem_permissao'); end if;
  if p_consulta is not null and not exists (select 1 from rede_consultas c where c.id = p_consulta and c.org = o.org) then perform interno.erro('invalido:consulta'); end if;
  update rede_p4_or_orcamentos set consulta = p_consulta where id = o.id returning * into o;
  return interno.rede_p4_or_orcamento_json(o, v);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_orc_fase(interno.rede_p4_or_orcamentos)', 'rede_p4_or_orcamento_json(interno.rede_p4_or_orcamentos, uuid)', 'rede_p4_or_orcamento_de(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_or_orcamentos(text)', 'rede_p4_or_orcamento_criar(jsonb)', 'rede_p4_or_orcamento_propor(uuid, jsonb)',
    'rede_p4_or_orcamento_apoiar(uuid, uuid[])', 'rede_p4_or_orcamento_consulta(uuid, uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 62. Meta coletiva da organização ──────────────────────────────────────────────────────────────────────────────────────
-- "500 panfletos até sexta": quem é de dentro soma o que fez. A soma é um contador na própria meta; à parte, sem quanto nem quando,
-- fica só que a pessoa já somou (para contar quantas pessoas são). Não dá para saber quem somou quanto, e não há ranking. A soma só
-- aparece com 3 pessoas ou mais.
create table if not exists interno.rede_p4_or_metas (
  id uuid primary key default gen_random_uuid(),
  org uuid not null references interno.rede_orgs (perfil) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  unidade text not null check (char_length(btrim(unidade)) between 2 and 30),
  alvo integer not null check (alvo between 1 and 10000000),
  prazo date,
  soma bigint not null default 0 check (soma >= 0),
  encerrada boolean not null default false,
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_or_metas_org on interno.rede_p4_or_metas (org, criada_em desc);
alter table interno.rede_p4_or_metas enable row level security;
-- Quem já somou na meta coletiva (item 62): só que somou, para contar pessoas distintas; o quanto vira contador.
create table if not exists interno.rede_p4_or_meta_pessoas (
  meta uuid not null references interno.rede_p4_or_metas (id) on delete cascade,
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  primary key (meta, pessoa)
);
alter table interno.rede_p4_or_meta_pessoas enable row level security;
revoke all on table interno.rede_p4_or_metas, interno.rede_p4_or_meta_pessoas from public;

create or replace function interno.rede_p4_or_meta_json(m interno.rede_p4_or_metas, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with n as (select count(*) as n from rede_p4_or_meta_pessoas x where x.meta = m.id)
  select jsonb_build_object('id', m.id, 'titulo', m.titulo, 'unidade', m.unidade, 'alvo', m.alvo, 'prazo', m.prazo,
    'encerrada', m.encerrada or (m.prazo is not null and m.prazo < current_date),
    'pessoas', interno.alumia_pessoas((select n from n)),
    'somei', exists (select 1 from rede_p4_or_meta_pessoas x where x.meta = m.id and x.pessoa = p_quem),
    'soma', case when (select n from n) >= 3 then m.soma end,
    'atingida', case when (select n from n) >= 3 then m.soma >= m.alvo end,
    'posso_encerrar', interno.alumia_org_mesa(p_quem, m.org))
$$;

create or replace function interno.rede_p4_or_meta_de(p_id uuid, p_quem uuid) returns interno.rede_p4_or_metas language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare m rede_p4_or_metas;
begin
  select * into m from rede_p4_or_metas where id = p_id;
  if not found or not interno.rede_p4_or_dentro(m.org, p_quem) then perform interno.erro('nao_encontrado'); end if;
  return m;
end $$;

/** As metas da organização (as 20 mais novas), só para quem é de dentro. */
create or replace function public.rede_p4_or_metas(p_org text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p_org, v);
  return jsonb_build_object('posso_criar', interno.alumia_org_mesa(v, v_org),
    'metas', coalesce((select jsonb_agg(interno.rede_p4_or_meta_json(m, v) order by m.criada_em desc)
                         from (select * from rede_p4_or_metas x where x.org = v_org order by x.criada_em desc limit 20) m), '[]'::jsonb));
end $$;

/** Quem conduz a mesa põe a meta: o quê, a unidade, o alvo e o prazo (opcional). */
create or replace function public.rede_p4_or_meta_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_org uuid; v_prazo date; x rede_p4_or_metas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  v_org := interno.rede_p4_or_org_dentro(p ->> 'org', v);
  if not interno.alumia_org_mesa(v, v_org) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'alvo', '') !~ '^\d{1,8}$' or (p ->> 'alvo')::integer not between 1 and 10000000 then perform interno.erro('invalido:alvo'); end if;
  v_prazo := interno.rede_p4_or_data(p ->> 'prazo');
  if v_prazo is not null and v_prazo < current_date then perform interno.erro('invalido:prazo'); end if;
  perform interno.limite('alumia_p4_or_meta', 20, 1440);
  insert into rede_p4_or_metas (org, titulo, unidade, alvo, prazo)
  values (v_org, interno.rede_p4_or_campo(p ->> 'titulo', 3, 120, 'titulo'), interno.rede_p4_or_campo(p ->> 'unidade', 2, 30, 'unidade'), (p ->> 'alvo')::integer, v_prazo)
  returning * into x;
  return interno.rede_p4_or_meta_json(x, v);
end $$;

/** Quem é de dentro soma o que fez (de 1 até o alvo de uma vez). O contador sobe; da pessoa fica só que já somou, nunca quanto. */
create or replace function public.rede_p4_or_meta_somar(p_id uuid, p_quanto integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_or_metas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  m := interno.rede_p4_or_meta_de(p_id, v);
  if m.encerrada or (m.prazo is not null and m.prazo < current_date) then perform interno.erro('fechada'); end if;
  if p_quanto is null or p_quanto < 1 or p_quanto > m.alvo then perform interno.erro('invalido:quanto'); end if;
  perform interno.limite('alumia_p4_or_somar', 30, 60);
  update rede_p4_or_metas set soma = soma + p_quanto where id = m.id returning * into m;
  insert into rede_p4_or_meta_pessoas (meta, pessoa) values (m.id, v) on conflict do nothing;
  return interno.rede_p4_or_meta_json(m, v);
end $$;

/** Quem conduz a mesa encerra a meta. */
create or replace function public.rede_p4_or_meta_encerrar(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; m rede_p4_or_metas;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  m := interno.rede_p4_or_meta_de(p_id, v);
  if not interno.alumia_org_mesa(v, m.org) then perform interno.erro('sem_permissao'); end if;
  update rede_p4_or_metas set encerrada = true where id = m.id returning * into m;
  return interno.rede_p4_or_meta_json(m, v);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_meta_json(interno.rede_p4_or_metas, uuid)', 'rede_p4_or_meta_de(uuid, uuid)'];
  v_pessoa text[] := array['rede_p4_or_metas(text)', 'rede_p4_or_meta_criar(jsonb)', 'rede_p4_or_meta_somar(uuid, integer)', 'rede_p4_or_meta_encerrar(uuid)'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 64. Termômetro do território ───────────────────────────────────────────────────────────────────────────────────────────
-- UBS, escola, linha de ônibus e iluminação de um município, avaliados de 1 a 5 com os problemas de uma lista fechada. Como na enquete:
-- da pessoa, só que avaliou o lugar no semestre (para avaliar uma vez); a nota e os problemas vão para contadores por lugar e semestre,
-- sem linha por avaliação e sem hora. O agregado só aparece com 3 avaliações ou mais, e cada problema só a partir de 3. Com ele, o
-- aparelho monta o texto da denúncia coletiva para a ouvidoria (lib/rede/organizacao/regras.ts); nada vai a terceiros pelo servidor.
create table if not exists interno.rede_p4_or_lugares (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ubs', 'escola', 'onibus', 'iluminacao')),
  nome text not null check (char_length(btrim(nome)) between 3 and 100),
  municipio text not null check (char_length(municipio) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  criado_dia date not null default current_date
);
create unique index if not exists rede_p4_or_lugares_unico on interno.rede_p4_or_lugares (tipo, municipio, uf, lower(nome));
alter table interno.rede_p4_or_lugares enable row level security;
-- Quem já avaliou o lugar no semestre (item 64): só para avaliar uma vez; a nota vira soma, sem ligação com a pessoa.
create table if not exists interno.rede_p4_or_lugar_avaliadores (
  lugar uuid not null references interno.rede_p4_or_lugares (id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-[12]$'),
  pessoa uuid not null references interno.perfis (id) on delete cascade,
  primary key (lugar, periodo, pessoa)
);
alter table interno.rede_p4_or_lugar_avaliadores enable row level security;
create table if not exists interno.rede_p4_or_lugar_somas (
  lugar uuid not null references interno.rede_p4_or_lugares (id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-[12]$'),
  avaliacoes integer not null default 0 check (avaliacoes >= 0),
  soma_notas integer not null default 0 check (soma_notas >= 0),
  primary key (lugar, periodo)
);
alter table interno.rede_p4_or_lugar_somas enable row level security;
create table if not exists interno.rede_p4_or_lugar_problemas (
  lugar uuid not null references interno.rede_p4_or_lugares (id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-[12]$'),
  problema text not null check (problema ~ '^[a-z_]{3,30}$'),
  total integer not null default 0 check (total >= 0),
  primary key (lugar, periodo, problema)
);
alter table interno.rede_p4_or_lugar_problemas enable row level security;
revoke all on table interno.rede_p4_or_lugares, interno.rede_p4_or_lugar_avaliadores, interno.rede_p4_or_lugar_somas, interno.rede_p4_or_lugar_problemas from public;

/** O semestre de hoje ("2026-2"): a avaliação vale por semestre, para o termômetro não ficar velho. */
create or replace function interno.rede_p4_or_periodo() returns text language sql stable as $$
  select to_char(current_date, 'YYYY') || '-' || case when extract(month from current_date) <= 6 then '1' else '2' end
$$;

/** Os problemas que valem para cada tipo de lugar (a lista fechada). */
create or replace function interno.rede_p4_or_problemas_do_tipo(p_tipo text) returns text[] language sql immutable as $$
  select case p_tipo
    when 'ubs' then array['falta_medico', 'falta_remedio', 'demora', 'fechada', 'atendimento']
    when 'escola' then array['falta_professor', 'estrutura', 'merenda', 'seguranca', 'vagas']
    when 'onibus' then array['atraso', 'lotacao', 'pouca_frota', 'seguranca', 'acessibilidade']
    when 'iluminacao' then array['apagada', 'piscando', 'ausente', 'risco']
    else '{}'::text[] end
$$;

/** Um lugar com o agregado do semestre: só com 3 avaliações ou mais; cada problema só a partir de 3. */
create or replace function interno.rede_p4_or_lugar_json(l interno.rede_p4_or_lugares, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  with s as (select coalesce(x.avaliacoes, 0) as n, coalesce(x.soma_notas, 0) as soma from (select 1) um left join rede_p4_or_lugar_somas x on x.lugar = l.id and x.periodo = interno.rede_p4_or_periodo())
  select jsonb_build_object('id', l.id, 'tipo', l.tipo, 'nome', l.nome, 'municipio', l.municipio, 'uf', l.uf, 'periodo', interno.rede_p4_or_periodo(),
    'avaliei', exists (select 1 from rede_p4_or_lugar_avaliadores a where a.lugar = l.id and a.periodo = interno.rede_p4_or_periodo() and a.pessoa = p_quem),
    'resultado', case when (select n from s) >= 3 then jsonb_build_object(
        'avaliacoes', (select n from s),
        'nota', round((select soma from s)::numeric / (select n from s), 1),
        'problemas', coalesce((select jsonb_object_agg(p.problema, p.total) from rede_p4_or_lugar_problemas p
                                where p.lugar = l.id and p.periodo = interno.rede_p4_or_periodo() and p.total >= 3), '{}'::jsonb))
      end)
$$;

/** Os lugares de um município (a cidade escrita, normalizada como a dos atos, e a UF), com o agregado do semestre. */
create or replace function public.rede_p4_or_lugares(p_municipio text, p_uf text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_mun text := left(interno.rede_ato_cidade(p_municipio), 80);
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if v_mun is null or char_length(v_mun) < 2 or coalesce(p_uf, '') !~ '^[A-Z]{2}$' then perform interno.erro('invalido:municipio'); end if;
  return jsonb_build_object('municipio', v_mun, 'uf', p_uf,
    'lugares', coalesce((select jsonb_agg(interno.rede_p4_or_lugar_json(l, v) order by l.tipo, l.nome)
                           from (select * from rede_p4_or_lugares x where x.municipio = v_mun and x.uf = p_uf order by x.tipo, x.nome limit 200) l), '[]'::jsonb));
end $$;

/** Quem tem conta põe um lugar público para avaliar (a UBS, a escola, a linha, a rua). Não guarda quem pôs. */
create or replace function public.rede_p4_or_lugar_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_mun text := left(interno.rede_ato_cidade(p ->> 'municipio'), 80); v_nome text; x rede_p4_or_lugares;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if coalesce(p ->> 'tipo', '') not in ('ubs', 'escola', 'onibus', 'iluminacao') then perform interno.erro('invalido:tipo'); end if;
  if v_mun is null or char_length(v_mun) < 2 or coalesce(p ->> 'uf', '') !~ '^[A-Z]{2}$' then perform interno.erro('invalido:municipio'); end if;
  v_nome := interno.rede_p4_or_sem_contato(p ->> 'nome', 3, 100, 'nome');
  select * into x from rede_p4_or_lugares l where l.tipo = p ->> 'tipo' and l.municipio = v_mun and l.uf = p ->> 'uf' and lower(l.nome) = lower(v_nome);
  if found then return interno.rede_p4_or_lugar_json(x, v); end if;
  perform interno.limite('alumia_p4_or_lugar', 10, 1440);
  insert into rede_p4_or_lugares (tipo, nome, municipio, uf) values (p ->> 'tipo', v_nome, v_mun, p ->> 'uf') returning * into x;
  return interno.rede_p4_or_lugar_json(x, v);
end $$;

/** Quem tem conta avalia o lugar uma vez por semestre: a nota (1 a 5) e os problemas da lista do tipo. Só os contadores sobem. */
create or replace function public.rede_p4_or_lugar_avaliar(p_id uuid, p_nota integer, p_problemas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; l rede_p4_or_lugares; v_per text := interno.rede_p4_or_periodo(); v_n integer;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select * into l from rede_p4_or_lugares where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_nota is null or p_nota not between 1 and 5 then perform interno.erro('invalido:nota'); end if;
  if exists (select 1 from unnest(coalesce(p_problemas, '{}')) u where u is null or not (u = any (interno.rede_p4_or_problemas_do_tipo(l.tipo)))) then perform interno.erro('invalido:problemas'); end if;
  perform interno.limite('alumia_p4_or_avaliar', 30, 60);
  insert into rede_p4_or_lugar_avaliadores (lugar, periodo, pessoa) values (l.id, v_per, v) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then perform interno.erro('ja_votou'); end if;
  insert into rede_p4_or_lugar_somas (lugar, periodo, avaliacoes, soma_notas) values (l.id, v_per, 1, p_nota)
  on conflict (lugar, periodo) do update set avaliacoes = rede_p4_or_lugar_somas.avaliacoes + 1, soma_notas = rede_p4_or_lugar_somas.soma_notas + p_nota;
  insert into rede_p4_or_lugar_problemas (lugar, periodo, problema, total) select l.id, v_per, u, 1 from (select distinct u from unnest(coalesce(p_problemas, '{}')) u) d
  on conflict (lugar, periodo, problema) do update set total = rede_p4_or_lugar_problemas.total + 1;
  return interno.rede_p4_or_lugar_json(l, v);
end $$;

do $$
declare f text;
  v_internas text[] := array['rede_p4_or_periodo()', 'rede_p4_or_problemas_do_tipo(text)', 'rede_p4_or_lugar_json(interno.rede_p4_or_lugares, uuid)'];
  v_pessoa text[] := array['rede_p4_or_lugares(text, text)', 'rede_p4_or_lugar_criar(jsonb)', 'rede_p4_or_lugar_avaliar(uuid, integer, text[])'];
begin
  foreach f in array v_internas loop
    execute format('revoke all on function interno.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function interno.%s from anon, authenticated', f); end if;
  end loop;
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 65. Apoio direto a quem produz ────────────────────────────────────────────────────────────────────────────────────────
-- A própria pessoa põe, por escolha, uma chave Pix aleatória (o formato de 32 algarismos com hífens; nunca CPF, telefone ou e-mail, que
-- seriam dado pessoal no perfil) ou um link https (a vaquinha, a página da artista). Aparece no perfil dela para quem tem conta. A Alumia
-- não guarda dinheiro, não cobra taxa e não registra quem abriu, copiou ou apoiou: a leitura não grava nada.
create table if not exists interno.rede_p4_or_apoio_direto (
  pessoa uuid primary key references interno.perfis (id) on delete cascade,
  pix text check (pix is null or pix ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  link text check (link is null or (link ~ '^https://[^\s/@]{3,}(/[^\s]*)?$' and char_length(link) <= 300)),
  texto text not null default '' check (char_length(texto) <= 140),
  atualizado_dia date not null default current_date,
  check (pix is not null or link is not null)
);
alter table interno.rede_p4_or_apoio_direto enable row level security;
revoke all on table interno.rede_p4_or_apoio_direto from public;

/** O jeito de apoiar da própria pessoa (ou nulo). */
create or replace function public.rede_p4_or_apoio_meu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  return (select jsonb_build_object('pix', a.pix, 'link', a.link, 'texto', a.texto) from rede_p4_or_apoio_direto a where a.pessoa = v);
end $$;

/**
 * A pessoa põe (ou troca) o jeito de apoiar: a chave Pix aleatória e/ou o link https, com uma frase curta. Os dois vazios tiram tudo.
 * A chave que parece CPF, telefone ou e-mail é recusada como dado pessoal.
 */
create or replace function public.rede_p4_or_apoio_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_pix text := lower(nullif(btrim(coalesce(p ->> 'pix', '')), '')); v_link text;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  -- A chave aleatória passa direto; o resto é recusado (como dado pessoal, se parecer CPF, telefone ou e-mail).
  if v_pix is not null and v_pix !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform interno.alumia_o13_pix(v_pix);
    perform interno.erro('invalido:pix');
  end if;
  v_link := interno.rede_p4_or_link(p ->> 'link');
  perform interno.limite('alumia_p4_or_apoio', 20, 1440);
  if v_pix is null and v_link is null then
    delete from rede_p4_or_apoio_direto where pessoa = v;
    return null;
  end if;
  insert into rede_p4_or_apoio_direto (pessoa, pix, link, texto) values (v, v_pix, v_link, interno.rede_p4_or_campo(p ->> 'texto', 0, 140, 'texto'))
  on conflict (pessoa) do update set pix = excluded.pix, link = excluded.link, texto = excluded.texto, atualizado_dia = current_date;
  return public.rede_p4_or_apoio_meu();
end $$;

/** O jeito de apoiar de uma pessoa, pelo @, para quem tem conta (sem bloqueio entre as duas; conta suspensa não aparece). Não grava nada. */
create or replace function public.rede_p4_or_apoio_de(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_dono uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  select f.id into v_dono from perfis f where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @')) and not f.suspenso;
  if v_dono is null or interno.rede_bloqueado(v, v_dono) then return null; end if;
  return (select jsonb_build_object('pix', a.pix, 'link', a.link, 'texto', a.texto, 'meu', a.pessoa = v) from rede_p4_or_apoio_direto a where a.pessoa = v_dono);
end $$;

do $$
declare f text;
  v_pessoa text[] := array['rede_p4_or_apoio_meu()', 'rede_p4_or_apoio_salvar(jsonb)', 'rede_p4_or_apoio_de(text)'];
begin
  foreach f in array v_pessoa loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon', f);
      execute format('grant execute on function public.%s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ── 66. Pedir checagem ao Instituto ───────────────────────────────────────────────────────────────────────────────────────
-- Quem tem conta manda um post para a fila da Checagem do site (o Vale o Escrito), como um envio do público: vai só o endereço do post e
-- o motivo escrito por quem pede, sem o texto do post, sem quem pediu e sem endereço de rede (a marca de origem é fixa, "alumia"). Só
-- post que qualquer visitante pode ler (interno.rede_ve com visitante): o que é de membros, de comunidade, de núcleo ou cifrado não sai
-- daqui. O mesmo post pedido nos últimos 7 dias não entra de novo (a fila já tem).
create or replace function public.rede_p4_or_checagem_pedir(p_post uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; x rede_posts; v_url text; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.rede_p4_or_membro();
  if to_regclass('interno.vale_envios') is null or to_regclass('interno.vale_fila') is null then perform interno.erro('desligado'); end if;
  select * into x from rede_posts where id = p_post;
  if not found or not coalesce(interno.rede_ve(x, v), false) then perform interno.erro('nao_encontrado'); end if;
  if x.apagado_em is not null or x.oculto or x.retido or x.nucleo is not null or not coalesce(interno.rede_ve(x, null), false) then perform interno.erro('so_aberto'); end if;
  v_url := 'https://alumia.institutolucia.org/pt/p/' || x.id::text;
  perform interno.limite('alumia_p4_or_checagem', 5, 1440);
  if exists (select 1 from vale_envios e where e.url = v_url and e.criado_em > now() - interval '7 days') then
    return jsonb_build_object('ok', true, 'ja_na_fila', true);
  end if;
  insert into vale_envios (url, descricao, origem_hash) values (v_url, interno.rede_p4_or_campo(p_motivo, 10, 500, 'motivo'), 'alumia') returning id into v_id;
  insert into vale_fila (origem, envio) values ('publico', v_id);
  update vale_envios set estado = 'na_fila' where id = v_id;
  return jsonb_build_object('ok', true, 'ja_na_fila', false);
end $$;

do $$ begin
  revoke all on function public.rede_p4_or_checagem_pedir(uuid, text) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_p4_or_checagem_pedir(uuid, text) from anon;
    grant execute on function public.rede_p4_or_checagem_pedir(uuid, text) to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
