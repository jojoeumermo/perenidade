-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · descoberta e estudo (Parte E, itens 45 a 51, e Parte G, itens 68 a 73 e 101 a 103).
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17) e das outras migrações 20261127-p4-*; quem junta põe antes do
-- 20261127-p4-fim.sql. Não mexe em rede_alumia_versao nem na lista de exceções da porta: o 20261127-p4-fim.sql faz isso. Não
-- redefine nenhuma função que já existia: todas as funções daqui são novas (as ajudantes interno.rede_p4_de_* e as públicas
-- public.rede_p4_de_*).
--
-- Tudo atrás do interruptor "alumia-p4-descoberta-estudo" (catálogo, só pelo nome, desligado): desligado, toda função daqui recusa
-- com "desligado" e a do visitante (o RSS do #tema) devolve nulo. Os itens que vivem só no aparelho (46 "Você está em dia", 47 pausa,
-- 48 ritmo de estudo, 70 baralhos, 72 estante de fontes, 73 trilha de segurança digital e 103 glossário ao toque) e o 101 (que usa a
-- agenda de provas da onda 11, interno.alumia_agenda_datas, que já pede a fonte oficial) não têm banco aqui.
--
--   45. ASSUNTOS EM MOVIMENTO (public.rede_p4_de_assuntos). Só #temas, nunca pessoas nem posts: o tema usado nas últimas 72 horas em
--       posts de primeiro nível de 3 COMUNIDADES diferentes ou mais, por 3 pessoas diferentes ou mais, nos posts que todo membro já
--       pode ver (a mesma base dos assuntos em alta: comunidade que não é fechada, sem retido, sem conta suspensa, sem tema retido
--       pela moderação). Sem número: só a faixa de comunidades ("algumas", "dezenas"). A regra inteira volta junto, para a tela
--       escrever "como contamos isso?". A lista é a mesma para todo mundo.
--   49. SEGUIR #TEMAS DO FEDIVERSO, SÓ DE SERVIDORES APROVADOS (interno.rede_p4_de_servidores). A coordenação aprova os servidores
--       de onde a Alumia lê o #tema (só o domínio e quando). O servidor do site (app/api/rede/fediverso-tema) busca o #tema público
--       nesses servidores, com cache, sem dizer quem pediu; o aparelho nunca fala com o servidor de fora. Os #temas de fora que a
--       pessoa segue ficam só no aparelho. A lista de servidores aprovados pode servir ao item 82 (federação só com servidores
--       aprovados), que não é deste lote.
--   50. RSS E ATOM POR #TEMA (public.rede_p4_de_rss_tag, chamada como visitante). O mesmo recorte do RSS da comunidade
--       (interno.alumia_alc_sai: só o que já sai da Alumia, aberto à internet, de comunidade aberta, de conta que sai), até 30 posts
--       dos últimos 120 dias. Com a trava da entrada ligada ou com "alumia-alcance" desligado, nulo. Nada restrito entra.
--   51. LINHAS COMPARTILHÁVEIS (interno.rede_p4_de_linhas). Uma regra de linha (até 5 #temas e até 5 comunidades abertas) que
--       outras pessoas seguem por um código. Quem segue guarda o código só no aparelho: o banco não tem a lista de quem segue nem
--       sabe quantas pessoas seguem. A linha não mostra quem a criou. Os posts vêm pela linha montada de sempre
--       (public.rede_roda_linha), com interno.rede_ve para quem lê.
--   68. REDAÇÃO: CORREÇÃO DE REFERÊNCIA (interno.rede_p4_de_redacao_ref). Para o tema de uma semana da roda de redação (onda 11),
--       uma educadora (selo de educadora do Prompt 4 ou o papel de educador) ou a coordenação escreve uma correção de referência nas
--       5 competências (a mesma ficha, interno.alumia_red_ficha) sobre o que cada nível pede. Não guarda quem escreveu. Quem está na
--       roda só a vê depois de corrigir ao menos uma redação daquela semana (para não copiar a régua) ou quando a roda fecha.
--   69. SIMULADO AO VIVO DA TURMA (interno.rede_p4_de_simulados e rede_p4_de_simulado_respostas). Quem cuida da turma (onda 11)
--       abre um simulado com 3 a 20 questões do banco de questões, por 15 a 180 minutos. Cada pessoa responde; quando o tempo
--       acaba, as respostas viram só a faixa de acerto de cada questão e SOMEM. A turma só vê o resultado em faixa ("a maioria
--       acertou", "cerca de metade", "a maioria errou") e só com 3 pessoas ou mais respondendo; a pessoa confere a dela no
--       aparelho, com o gabarito, que só sai depois do fim.
--   71. MENTORIA ENTRE PARES (interno.rede_p4_de_mentoras e rede_p4_de_mentorias). Veterana (conta com 90 dias ou mais) se oferece
--       numa trilha; caloura pede mentoria na mesma trilha e o banco sorteia uma veterana com vaga. Ninguém vê a lista de
--       veteranas nem quantas são: só "há mentoria nesta trilha". Feito o par, só as duas veem o codinome e o @ uma da outra, para
--       combinar por mensagem. Qualquer uma encerra; o par encerrado some.
--  102. MURAL DE EDITAIS E BOLSAS (interno.rede_p4_de_editais). Quem é da Alumia propõe (título, órgão, tipo, link oficial e prazo);
--       a coordenação ou o painel da Alumia confere e publica. O mural não diz quem propôs. Passado o prazo, sai do mural; 30 dias
--       depois, some.
--
-- Privacidade: nenhuma função devolve lista de pessoas, número de pessoas abaixo de 3 ou quem escreveu, propôs, respondeu ou segue;
-- nenhuma coluna de endereço de rede (os limites são pela conta, interno.limite). Pode rodar mais de uma vez.
-- Lei: LGPD art. 6º, I e III (finalidade e necessidade: cada tabela guarda só o que o item precisa, e o que é de uma pessoa some
-- quando deixa de servir), art. 14 (pessoas que estudam podem ser adolescentes: nada de perfil, ranking ou exposição), art. 18
-- (a pessoa apaga o que é dela) e Lei 9.610/1998 (a fonte do edital é o link oficial, sem cópia do texto).

-- ── 0. O interruptor e as ajudantes ───────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-descoberta-estudo', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** Ligado só com a Alumia nova e o interruptor ligado no painel (recursos_vivos). */
create or replace function interno.rede_p4_de_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-descoberta-estudo'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_p4_de_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_de_ligado() then perform interno.erro('desligado'); end if;
end $$;

/** Quem chama, membro da Alumia (18+, consentimento, aprovado quando a entrada exige). */
create or replace function interno.rede_p4_de_membro() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.rede2_membro(v) then perform interno.erro('sem_permissao'); end if;
  return v;
end $$;

/** A coordenação do Instituto ou o painel da Alumia (coordenação e admin). */
create or replace function interno.rede_p4_de_cuida() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select auth.uid() is not null and (interno.coord() or interno.alumia_painel_papel() is not null)
$$;

/** Um texto limpo: sem caracteres de controle, sem espaço sobrando, cortado no tamanho. */
create or replace function interno.rede_p4_de_texto(p text, p_max integer) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), p_max)
$$;

/** Um link aceito: https, sem espaço, sem usuário e senha no endereço, até 500 caracteres. Nulo quando vazio. */
create or replace function interno.rede_p4_de_link(p text) returns text language plpgsql immutable as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return null; end if;
  if char_length(v) > 500 or v !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?(/[^\s<>"]*)?$' or v ~ '^https://[^/]*@' then
    perform interno.erro('invalido:link');
  end if;
  return v;
end $$;

/** Educadora: o selo de educadora do Prompt 4 (interno.rede_p4_selos, quando existe), o papel de educador ou quem cuida. */
create or replace function interno.rede_p4_de_educadora() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  if interno.rede_p4_de_cuida() or interno.educador() then return true; end if;
  if to_regclass('interno.rede_p4_selos') is not null then
    return exists (select 1 from rede_p4_selos s where s.perfil = auth.uid() and s.tipo = 'educadora');
  end if;
  return false;
end $$;

/**
 * O começo das telas Descobrir e Estudar: se está ligado, se quem chama cuida (coordenação ou painel) ou é educadora, e as turmas
 * de estudo da PRÓPRIA pessoa (id, nome e se ela cuida). Nenhuma pessoa, nenhum número.
 */
create or replace function public.rede_p4_de_inicio() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  return jsonb_build_object(
    'cuido', interno.rede_p4_de_cuida(),
    'educadora', interno.rede_p4_de_educadora(),
    'turmas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'cuido', p.cuida) order by t.nome)
                          from alumia_turma_pessoas p join alumia_turmas t on t.id = p.turma where p.usuario = v), '[]'::jsonb));
end $$;

/** A tela sabe se o lote está ligado (sem recusar). */
create or replace function public.rede_p4_de_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  return interno.rede_p4_de_ligado();
end $$;

-- ── 1. Item 45: assuntos em movimento ─────────────────────────────────────────────────────────────────────────────────────

/** A regra dos assuntos em movimento, num lugar só (a tela "como contamos isso?" lê daqui). */
create or replace function interno.rede_p4_de_regra_assuntos() returns jsonb language sql immutable as $$
  select jsonb_build_object('horas', 72, 'comunidades', 3, 'pessoas', 3, 'maximo', 12)
$$;

/**
 * Os #temas em movimento: usados nas últimas 72 horas, em posts de primeiro nível, em 3 comunidades diferentes ou mais e por 3
 * pessoas diferentes ou mais. Só os posts que todo membro já pode ver (fora de comunidade fechada, sem retido, sem oculto, sem
 * conta suspensa) e fora dos temas que a moderação reteve. Sem número: só a faixa de comunidades. Igual para todo mundo.
 */
create or replace function public.rede_p4_de_assuntos() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; r jsonb := interno.rede_p4_de_regra_assuntos(); v_temas jsonb;
begin
  perform interno.alumia_porta();
  perform interno.aberta('comunidade');
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  select coalesce(jsonb_agg(jsonb_build_object('tag', t.tag, 'faixa', case when t.comunidades >= 10 then 'dezenas' else 'algumas' end)
                            order by t.comunidades desc, t.pessoas desc, t.tag), '[]'::jsonb) into v_temas
  from (
    select x.tag, count(distinct x.comunidade)::integer as comunidades, count(distinct x.autor)::integer as pessoas
    from (
      select p.autor, p.comunidade, unnest(interno.rede3_desc_tags(p.titulo, p.texto, p.corpo)) as tag
      from rede_posts p
      where p.resposta_a is null and p.apagado_em is null and not p.oculto and not p.retido and p.autor is not null
        and p.comunidade is not null and p.comunidade not like 'fechado-%'
        and p.criado_em > now() - make_interval(hours => (r ->> 'horas')::integer)
        and interno.rede2_publico(p) in ('internet', 'membros')
        and exists (select 1 from rede_comunidades c where c.slug = p.comunidade and c.tipo <> 'fechada')
        and not exists (select 1 from perfis s where s.id = p.autor and s.suspenso)
    ) x
    where not exists (select 1 from rede_o7_temas_retidos k where k.tag = x.tag)
    group by x.tag
    having count(distinct x.comunidade) >= (r ->> 'comunidades')::integer and count(distinct x.autor) >= (r ->> 'pessoas')::integer
    order by 2 desc, 3 desc, 1
    limit (r ->> 'maximo')::integer
  ) t;
  return jsonb_build_object('temas', v_temas, 'regra', r);
end $$;

-- ── 2. Item 49: os servidores aprovados para os #temas do Fediverso ───────────────────────────────────────────────────────

-- Os servidores de onde a Alumia lê #temas públicos. Só o domínio e quando foi aprovado: sem quem aprovou, sem quem lê.
create table if not exists interno.rede_p4_de_servidores (
  dominio text primary key check (dominio ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and char_length(dominio) <= 253),
  aprovado_em timestamptz not null default now()
);
alter table interno.rede_p4_de_servidores enable row level security;
revoke all on interno.rede_p4_de_servidores from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.rede_p4_de_servidores from anon, authenticated; end if;
end $$;

/** Os servidores aprovados que não estão bloqueados (o bloqueio do Fediverso vale sempre por cima da aprovação). */
create or replace function interno.rede_p4_de_servidores_ok() returns text[] language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(array_agg(s.dominio order by s.dominio), '{}')
  from rede_p4_de_servidores s
  where to_regclass('interno.rede_fed_bloqueados') is null
     or not exists (select 1 from rede_fed_bloqueados b where s.dominio = b.dominio or s.dominio like '%.' || b.dominio)
$$;

/** Os servidores aprovados, para a tela (só domínios), e se quem chama pode aprovar. */
create or replace function public.rede_p4_de_servidores() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  return jsonb_build_object('servidores', to_jsonb(interno.rede_p4_de_servidores_ok()), 'cuido', interno.rede_p4_de_cuida());
end $$;

/** A coordenação ou o painel da Alumia aprova (p_sim) ou tira um servidor. Servidor bloqueado não entra. Até 30 servidores. */
create or replace function public.rede_p4_de_servidor(p_dominio text, p_sim boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_dom text := lower(btrim(coalesce(p_dominio, ''), ' /'));
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  if not interno.rede_p4_de_cuida() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede_p4_de_cuidar', 60, 60);
  v_dom := regexp_replace(v_dom, '^https?://', '');
  if v_dom !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' or char_length(v_dom) > 253 then perform interno.erro('invalido:dominio'); end if;
  if coalesce(p_sim, false) then
    if to_regclass('interno.rede_fed_bloqueados') is not null
       and exists (select 1 from rede_fed_bloqueados b where v_dom = b.dominio or v_dom like '%.' || b.dominio) then
      perform interno.erro('bloqueado');
    end if;
    if (select count(*) from rede_p4_de_servidores) >= 30 and not exists (select 1 from rede_p4_de_servidores where dominio = v_dom) then
      perform interno.erro('muitos');
    end if;
    insert into rede_p4_de_servidores (dominio) values (v_dom) on conflict (dominio) do nothing;
  else
    delete from rede_p4_de_servidores where dominio = v_dom;
  end if;
  perform interno.registrar('rede_p4_de_servidor', v_dom, jsonb_build_object('aprovado', coalesce(p_sim, false)));
  return jsonb_build_object('servidores', to_jsonb(interno.rede_p4_de_servidores_ok()));
end $$;

/** Para o servidor do site (só a chave de serviço): os servidores aprovados, ou nulo com o interruptor desligado. */
create or replace function public.rede_p4_de_servidores_fora() returns text[] language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_de_ligado() then return null; end if;
  return interno.rede_p4_de_servidores_ok();
end $$;

-- ── 3. Item 50: o RSS (e o Atom) de um #tema ──────────────────────────────────────────────────────────────────────────────

/**
 * O canal de um #tema, com o mesmo recorte do RSS da comunidade (interno.alumia_alc_sai): só o que já sai da Alumia (primeiro nível,
 * aberto à internet, de comunidade aberta ou de fora de comunidade, de conta que sai), até 30 posts dos últimos 120 dias. Chamada
 * como visitante pelo servidor do site. Nulo com o interruptor desligado, com a trava da entrada ligada, com "alumia-alcance"
 * desligado ou com um #tema torto (a rota responde 404 igual).
 */
create or replace function public.rede_p4_de_rss_tag(p_tag text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_tag text; v_itens jsonb;
begin
  perform interno.alumia_porta();
  if not interno.rede_p4_de_ligado() or interno.alumia_exigida()
     or exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2', 'alumia-alcance') and not ligado) then
    return null;
  end if;
  begin
    v_tag := interno.rede3_desc_tag_norm(p_tag);
  exception when others then
    return null;
  end;
  select coalesce(jsonb_agg(interno.alumia_alc_item(y) order by y.criado_em desc), '[]'::jsonb) into v_itens
    from rede_posts y
   where y.id in (select p.id from rede_posts p
                   where p.resposta_a is null and p.apagado_em is null and p.criado_em > now() - interval '120 days'
                     and v_tag = any (interno.rede3_desc_tags(p.titulo, p.texto, p.corpo))
                     and interno.alumia_alc_sai(p)
                   order by p.criado_em desc limit 30);
  return jsonb_build_object('tipo', 'tag', 'nome', v_tag, 'titulo', '#' || v_tag, 'descricao', '', 'itens', v_itens);
end $$;

-- ── 4. Item 51: linhas compartilháveis ────────────────────────────────────────────────────────────────────────────────────

-- Uma regra de linha que outras pessoas seguem pelo código. A dona fica só para poder tirar a linha (nunca sai do banco). Não
-- existe tabela de quem segue: o código fica no aparelho de quem segue.
create table if not exists interno.rede_p4_de_linhas (
  codigo text primary key check (codigo ~ '^[a-f0-9]{12}$'),
  dona uuid not null references interno.perfis (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 40),
  filtro jsonb not null check (jsonb_typeof(filtro) = 'object'),
  criada_em timestamptz not null default now()
);
create index if not exists rede_p4_de_linhas_dona on interno.rede_p4_de_linhas (dona);
alter table interno.rede_p4_de_linhas enable row level security;
revoke all on interno.rede_p4_de_linhas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.rede_p4_de_linhas from anon, authenticated; end if;
end $$;

/** As comunidades da regra que ainda são abertas (a que fechou depois sai da linha na hora de ler). */
create or replace function interno.rede_p4_de_linha_comunidades(p jsonb) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome), '[]'::jsonb)
  from rede_comunidades c
  where c.slug in (select jsonb_array_elements_text(coalesce(p -> 'comunidades', '[]'::jsonb))) and c.tipo = 'aberta' and c.slug not like 'fechado-%'
$$;

/** A linha como sai: o nome, o filtro (só #temas e comunidades ainda abertas) e se é de quem chama. Nunca quem fez. */
create or replace function interno.rede_p4_de_linha_json(l interno.rede_p4_de_linhas, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('codigo', l.codigo, 'nome', l.nome, 'minha', l.dona = p_quem,
    'tags', coalesce(l.filtro -> 'tags', '[]'::jsonb), 'comunidades', interno.rede_p4_de_linha_comunidades(l.filtro))
$$;

/**
 * Publica uma regra de linha: até 5 #temas e até 5 comunidades ABERTAS (pelo menos um dos dois). Só isso: nada de cidade, núcleo
 * ou tipo, que dependem de quem lê. Até 10 linhas por pessoa. Devolve a linha com o código.
 */
create or replace function public.rede_p4_de_linha_publicar(p_nome text, p_filtro jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; f jsonb; k text; v_nome text; l rede_p4_de_linhas;
begin
  perform interno.alumia_porta();
  v_nome := interno.rede_p4_de_texto(p_nome, 40);
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_escrever', 30, 60);
  if char_length(v_nome) < 2 then perform interno.erro('invalido:nome'); end if;
  f := interno.rede_o7_filtro(p_filtro);
  for k in select jsonb_object_keys(f) loop
    if k not in ('tags', 'comunidades') then perform interno.erro('invalido:filtro'); end if;
  end loop;
  if jsonb_array_length(coalesce(f -> 'tags', '[]')) > 5 or jsonb_array_length(coalesce(f -> 'comunidades', '[]')) > 5 then perform interno.erro('invalido:filtro'); end if;
  if f = '{}'::jsonb then perform interno.erro('invalido:vazia'); end if;
  if jsonb_array_length(interno.rede_p4_de_linha_comunidades(f)) <> jsonb_array_length(coalesce(f -> 'comunidades', '[]')) then
    perform interno.erro('invalido:comunidade');
  end if;
  if (select count(*) from rede_p4_de_linhas where dona = v) >= 10 then perform interno.erro('muitas'); end if;
  insert into rede_p4_de_linhas (codigo, dona, nome, filtro) values (substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), v, v_nome, f) returning * into l;
  return interno.rede_p4_de_linha_json(l, v);
end $$;

/** Uma linha pelo código (para seguir ou abrir). "nao_encontrada" quando não existe ou foi tirada. */
create or replace function public.rede_p4_de_linha(p_codigo text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; l rede_p4_de_linhas;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  select * into l from rede_p4_de_linhas where codigo = lower(btrim(coalesce(p_codigo, '')));
  if not found then perform interno.erro('nao_encontrada'); end if;
  return interno.rede_p4_de_linha_json(l, v);
end $$;

/** As linhas que a própria pessoa publicou (para copiar o código ou tirar). */
create or replace function public.rede_p4_de_minhas_linhas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  return jsonb_build_object('itens', coalesce((select jsonb_agg(interno.rede_p4_de_linha_json(l, v) order by l.criada_em desc) from rede_p4_de_linhas l where l.dona = v), '[]'::jsonb));
end $$;

/** A dona tira a linha: quem seguia passa a receber "nao_encontrada". */
create or replace function public.rede_p4_de_linha_tirar(p_codigo text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  delete from rede_p4_de_linhas where codigo = lower(btrim(coalesce(p_codigo, ''))) and dona = v;
  if not found then perform interno.erro('nao_encontrada'); end if;
  return jsonb_build_object('tirada', true);
end $$;

-- ── 5. Item 68: a correção de referência da redação ───────────────────────────────────────────────────────────────────────

-- A correção de referência de uma semana da roda de redação: a ficha das 5 competências (a mesma da roda). Sem quem escreveu.
create table if not exists interno.rede_p4_de_redacao_ref (
  semana date primary key references interno.alumia_redacao_temas (semana) on delete cascade,
  ficha jsonb not null,
  escrita_em timestamptz not null default now()
);
alter table interno.rede_p4_de_redacao_ref enable row level security;
revoke all on interno.rede_p4_de_redacao_ref from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.rede_p4_de_redacao_ref from anon, authenticated; end if;
end $$;

/**
 * Uma educadora (ou a coordenação) escreve ou troca a correção de referência do tema de uma semana. A ficha passa pela mesma régua
 * da roda (interno.alumia_red_ficha: 5 competências, notas de 40 em 40, comentário de 20 a 800). Não guarda quem escreveu.
 */
create or replace function public.rede_p4_de_redacao_ref_salvar(p_semana date, p_ficha jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_ficha jsonb;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  if not interno.rede_p4_de_educadora() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede_p4_de_escrever', 30, 60);
  if not exists (select 1 from alumia_redacao_temas where semana = p_semana) then perform interno.erro('nao_encontrado'); end if;
  v_ficha := interno.alumia_red_ficha(p_ficha);
  insert into rede_p4_de_redacao_ref (semana, ficha) values (p_semana, v_ficha)
    on conflict (semana) do update set ficha = excluded.ficha, escrita_em = now();
  return jsonb_build_object('semana', p_semana, 'ficha', v_ficha);
end $$;

/**
 * A correção de referência de uma semana, para quem está na roda: só depois de corrigir ao menos uma redação daquela semana (para
 * não copiar a régua antes de ler) ou quando a roda já fechou. A educadora e a coordenação veem sempre. Devolve {existe, liberada,
 * ficha}; a ficha só vem liberada.
 */
create or replace function public.rede_p4_de_redacao_ref(p_semana date) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; r rede_p4_de_redacao_ref; v_libera boolean;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  select * into r from rede_p4_de_redacao_ref where semana = p_semana;
  if not found then return jsonb_build_object('existe', false, 'liberada', false, 'ficha', null); end if;
  v_libera := interno.rede_p4_de_educadora() or not interno.alumia_red_roda_aberta(p_semana) or interno.alumia_red_feitas(v, p_semana) > 0;
  return jsonb_build_object('existe', true, 'liberada', v_libera, 'ficha', case when v_libera then r.ficha end);
end $$;

/** As semanas com tema (as 8 mais recentes, até a próxima), e se cada uma já tem referência: para a tela escolher. */
create or replace function public.rede_p4_de_redacao_semanas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(jsonb_build_object('semana', t.semana, 'titulo', t.titulo, 'aberta', interno.alumia_red_roda_aberta(t.semana),
                                        'tem_ref', exists (select 1 from rede_p4_de_redacao_ref f where f.semana = t.semana)) order by t.semana desc)
    from (select * from alumia_redacao_temas where semana <= interno.semana_atual() + 7 order by semana desc limit 8) t), '[]'::jsonb));
end $$;

-- ── 6. Item 69: o simulado ao vivo da turma ───────────────────────────────────────────────────────────────────────────────

-- O simulado: as questões e o gabarito tirados do banco de questões na hora de abrir, e o prazo. Fechado, guarda só a faixa de
-- acerto de cada questão (e só com 3 pessoas ou mais respondendo); as respostas somem.
create table if not exists interno.rede_p4_de_simulados (
  id uuid primary key default gen_random_uuid(),
  turma uuid not null references interno.alumia_turmas (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 3 and 80),
  questoes uuid[] not null check (cardinality(questoes) between 3 and 20),
  gabarito smallint[] not null,
  abre timestamptz not null default now(),
  fecha timestamptz not null,
  fechado boolean not null default false,
  faixas jsonb,
  apagar_em timestamptz not null,
  check (cardinality(gabarito) = cardinality(questoes)),
  check (fecha > abre)
);
create index if not exists rede_p4_de_simulados_turma on interno.rede_p4_de_simulados (turma, abre desc);
create index if not exists rede_p4_de_simulados_fecha on interno.rede_p4_de_simulados (fecha) where not fechado;

-- As respostas, só enquanto o simulado está aberto (para a pessoa poder trocar até o fim). Some no fechamento.
create table if not exists interno.rede_p4_de_simulado_respostas (
  simulado uuid not null references interno.rede_p4_de_simulados (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  respostas smallint[] not null,
  primary key (simulado, usuario)
);
alter table interno.rede_p4_de_simulados enable row level security;
alter table interno.rede_p4_de_simulado_respostas enable row level security;
revoke all on interno.rede_p4_de_simulados, interno.rede_p4_de_simulado_respostas from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on interno.rede_p4_de_simulados, interno.rede_p4_de_simulado_respostas from anon, authenticated;
  end if;
end $$;

/** A pessoa está na turma? E cuida dela? */
create or replace function interno.rede_p4_de_na_turma(p_turma uuid, p_quem uuid, p_cuida boolean default false) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from alumia_turma_pessoas p where p.turma = p_turma and p.usuario = p_quem and (not p_cuida or p.cuida))
$$;

/**
 * Fecha um simulado: para cada questão, a faixa de acerto ("maioria_acertou": 2/3 ou mais; "maioria_errou": 1/3 ou menos;
 * "metade": entre os dois), só se 3 pessoas ou mais responderam (abaixo disso, nenhuma faixa). Depois, as respostas SOMEM.
 */
create or replace function interno.rede_p4_de_simulado_fechar(p_id uuid) returns void language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare s rede_p4_de_simulados; v_n integer; v_faixas jsonb := '[]'::jsonb; i integer; v_certas integer;
begin
  select * into s from rede_p4_de_simulados where id = p_id for update;
  if not found or s.fechado then return; end if;
  select count(*)::integer into v_n from rede_p4_de_simulado_respostas where simulado = p_id;
  if v_n >= 3 then
    for i in 1 .. cardinality(s.questoes) loop
      select count(*)::integer into v_certas from rede_p4_de_simulado_respostas r where r.simulado = p_id and r.respostas[i] = s.gabarito[i];
      v_faixas := v_faixas || to_jsonb(case when v_certas * 3 >= v_n * 2 then 'maioria_acertou' when v_certas * 3 <= v_n then 'maioria_errou' else 'metade' end);
    end loop;
  else
    v_faixas := null;
  end if;
  delete from rede_p4_de_simulado_respostas where simulado = p_id;
  update rede_p4_de_simulados set fechado = true, faixas = v_faixas, fecha = least(fecha, now()) where id = p_id;
end $$;

/** Fecha os simulados cujo prazo passou e apaga os vencidos (30 dias depois do fim). Chamada pelas funções daqui e pela faxina. */
create or replace function interno.rede_p4_de_simulados_em_dia() returns void language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare r record;
begin
  for r in select id from rede_p4_de_simulados where not fechado and fecha <= now() loop
    perform interno.rede_p4_de_simulado_fechar(r.id);
  end loop;
  delete from rede_p4_de_simulados where apagar_em < now();
end $$;

/** As questões do banco para montar o simulado (quem cuida escolhe): só o assunto e o começo do enunciado. */
create or replace function public.rede_p4_de_simulado_banco(p_materia text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'materia', q.materia, 'tema', q.tema, 'enunciado', left(q.enunciado, 160)) order by q.criado_em desc)
    from (select * from rede_questoes x where x.retirada_em is null and (p_materia is null or x.materia = p_materia) order by x.criado_em desc limit 60) q), '[]'::jsonb));
end $$;

/** Quem cuida da turma abre um simulado: 3 a 20 questões do banco, de 15 a 180 minutos. Um aberto por vez em cada turma. */
create or replace function public.rede_p4_de_simulado_abrir(p_turma uuid, p_titulo text, p_questoes uuid[], p_minutos integer) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_titulo text; v_ids uuid[]; v_gab smallint[]; v_id uuid;
begin
  perform interno.alumia_porta();
  v_titulo := interno.rede_p4_de_texto(p_titulo, 80);
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_escrever', 30, 60);
  perform interno.rede_p4_de_simulados_em_dia();
  if not interno.rede_p4_de_na_turma(p_turma, v, true) then perform interno.erro('sem_permissao'); end if;
  if char_length(v_titulo) < 3 then perform interno.erro('invalido:titulo'); end if;
  if p_minutos is null or p_minutos not between 15 and 180 then perform interno.erro('invalido:minutos'); end if;
  if p_questoes is null or cardinality(p_questoes) not between 3 and 20 or (select count(distinct x) from unnest(p_questoes) x) <> cardinality(p_questoes) then
    perform interno.erro('invalido:questoes');
  end if;
  select array_agg(q.id order by o.n), array_agg(q.certa order by o.n) into v_ids, v_gab
    from unnest(p_questoes) with ordinality o(id, n) join rede_questoes q on q.id = o.id and q.retirada_em is null;
  if coalesce(cardinality(v_ids), 0) <> cardinality(p_questoes) then perform interno.erro('invalido:questoes'); end if;
  if exists (select 1 from rede_p4_de_simulados where turma = p_turma and not fechado) then perform interno.erro('ja_aberto'); end if;
  insert into rede_p4_de_simulados (turma, titulo, questoes, gabarito, fecha, apagar_em)
    values (p_turma, v_titulo, v_ids, v_gab, now() + make_interval(mins => p_minutos), now() + make_interval(mins => p_minutos) + interval '30 days')
    returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

/**
 * Os simulados da turma (os 10 mais recentes), para quem está nela. Aberto: as questões SEM o gabarito, o prazo e se a pessoa já
 * respondeu. Fechado: o gabarito com a explicação e, com 3 pessoas ou mais, a faixa de cada questão. Nenhum número de pessoas.
 */
create or replace function public.rede_p4_de_simulados(p_turma uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  perform interno.rede_p4_de_simulados_em_dia();
  if not interno.rede_p4_de_na_turma(p_turma, v) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('cuido', interno.rede_p4_de_na_turma(p_turma, v, true), 'itens', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'titulo', s.titulo, 'abre', s.abre, 'fecha', s.fecha, 'fechado', s.fechado,
      'respondi', exists (select 1 from rede_p4_de_simulado_respostas r where r.simulado = s.id and r.usuario = v),
      'resultado', s.faixas is not null,
      'questoes', (select jsonb_agg(jsonb_build_object('id', q.id, 'materia', q.materia, 'enunciado', q.enunciado, 'alternativas', q.alternativas)
                     || case when s.fechado then jsonb_build_object('certa', s.gabarito[o.n], 'explicacao', q.explicacao, 'faixa', s.faixas -> (o.n::integer - 1)) else '{}'::jsonb end
                     order by o.n)
                   from unnest(s.questoes) with ordinality o(id, n) join rede_questoes q on q.id = o.id)
    ) order by s.abre desc)
    from (select * from rede_p4_de_simulados x where x.turma = p_turma order by x.abre desc limit 10) s), '[]'::jsonb));
end $$;

/** Responde (ou troca) enquanto o simulado está aberto. Uma alternativa por questão (0 a 4), ou -1 para deixar em branco. */
create or replace function public.rede_p4_de_simulado_responder(p_id uuid, p_respostas integer[]) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; s rede_p4_de_simulados;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_escrever', 60, 60);
  perform interno.rede_p4_de_simulados_em_dia();
  select * into s from rede_p4_de_simulados where id = p_id;
  if not found or not interno.rede_p4_de_na_turma(s.turma, v) then perform interno.erro('nao_encontrado'); end if;
  if s.fechado then perform interno.erro('encerrado'); end if;
  if p_respostas is null or cardinality(p_respostas) <> cardinality(s.questoes) or exists (select 1 from unnest(p_respostas) x where x is null or x not between -1 and 4) then
    perform interno.erro('invalido:respostas');
  end if;
  insert into rede_p4_de_simulado_respostas (simulado, usuario, respostas) values (p_id, v, p_respostas::smallint[])
    on conflict (simulado, usuario) do update set respostas = excluded.respostas;
  return jsonb_build_object('respondi', true);
end $$;

/** Quem cuida encerra antes do prazo (o resultado sai na hora, com a mesma regra). */
create or replace function public.rede_p4_de_simulado_encerrar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; s rede_p4_de_simulados;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  select * into s from rede_p4_de_simulados where id = p_id;
  if not found or not interno.rede_p4_de_na_turma(s.turma, v, true) then perform interno.erro('sem_permissao'); end if;
  perform interno.rede_p4_de_simulado_fechar(p_id);
  return jsonb_build_object('fechado', true);
end $$;

-- ── 7. Item 71: mentoria entre pares ──────────────────────────────────────────────────────────────────────────────────────

-- A veterana que se oferece numa trilha, com quantas calouras topa acompanhar ao mesmo tempo. Ninguém lê esta tabela de fora.
create table if not exists interno.rede_p4_de_mentoras (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  trilha text not null check (trilha ~ '^[a-z0-9-]{2,80}$'),
  vagas smallint not null check (vagas between 1 and 3),
  desde timestamptz not null default now(),
  primary key (usuario, trilha)
);
create index if not exists rede_p4_de_mentoras_trilha on interno.rede_p4_de_mentoras (trilha);

-- O par feito. Só as duas pessoas leem (o codinome e o @ uma da outra). Encerrado, a linha some.
create table if not exists interno.rede_p4_de_mentorias (
  id uuid primary key default gen_random_uuid(),
  trilha text not null check (trilha ~ '^[a-z0-9-]{2,80}$'),
  veterana uuid not null references interno.perfis (id) on delete cascade,
  caloura uuid not null references interno.perfis (id) on delete cascade,
  criada_em timestamptz not null default now(),
  unique (trilha, caloura),
  check (veterana <> caloura)
);
create index if not exists rede_p4_de_mentorias_veterana on interno.rede_p4_de_mentorias (veterana, trilha);
create index if not exists rede_p4_de_mentorias_caloura on interno.rede_p4_de_mentorias (caloura);
alter table interno.rede_p4_de_mentoras enable row level security;
alter table interno.rede_p4_de_mentorias enable row level security;
revoke all on interno.rede_p4_de_mentoras, interno.rede_p4_de_mentorias from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.rede_p4_de_mentoras, interno.rede_p4_de_mentorias from anon, authenticated; end if;
end $$;

/** Uma trilha aceita (o slug de content/trilhas). */
create or replace function interno.rede_p4_de_trilha(p text) returns text language plpgsql immutable as $$
declare v text := lower(btrim(coalesce(p, '')));
begin
  if v !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
  return v;
end $$;

/** As veteranas com vaga numa trilha para esta caloura (não ela mesma, ninguém que bloqueou ou foi bloqueado). */
create or replace function interno.rede_p4_de_com_vaga(p_trilha text, p_caloura uuid) returns setof uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select m.usuario from rede_p4_de_mentoras m
  where m.trilha = p_trilha and m.usuario <> p_caloura
    and not interno.rede_bloqueado(m.usuario, p_caloura) and not interno.rede_bloqueado(p_caloura, m.usuario)
    and not exists (select 1 from perfis s where s.id = m.usuario and s.suspenso)
    and (select count(*) from rede_p4_de_mentorias x where x.veterana = m.usuario and x.trilha = m.trilha) < m.vagas
$$;

/** A outra pessoa do par: só o codinome e o @ (para combinar por mensagem). */
create or replace function interno.rede_p4_de_par_json(x interno.rede_p4_de_mentorias, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', x.id, 'trilha', x.trilha, 'papel', case when x.veterana = p_quem then 'veterana' else 'caloura' end,
    'codinome', interno.rede_nome(case when x.veterana = p_quem then x.caloura else x.veterana end),
    'handle', (select f.rede_handle from perfis f where f.id = case when x.veterana = p_quem then x.caloura else x.veterana end))
$$;

/** A veterana (conta com 90 dias ou mais) se oferece numa trilha, para 1 a 3 calouras ao mesmo tempo; p_vagas nulo ou 0 tira a oferta. */
create or replace function public.rede_p4_de_mentoria_oferecer(p_trilha text, p_vagas integer) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_trilha text;
begin
  perform interno.alumia_porta();
  v_trilha := interno.rede_p4_de_trilha(p_trilha);
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_escrever', 30, 60);
  if coalesce(p_vagas, 0) = 0 then
    delete from rede_p4_de_mentoras where usuario = v and trilha = v_trilha;
    return jsonb_build_object('oferta', false);
  end if;
  if p_vagas not between 1 and 3 then perform interno.erro('invalido:vagas'); end if;
  if coalesce((select u.created_at from auth.users u where u.id = v), now()) > now() - interval '90 days' then perform interno.erro('cedo'); end if;
  if (select count(*) from rede_p4_de_mentoras where usuario = v) >= 3 and not exists (select 1 from rede_p4_de_mentoras where usuario = v and trilha = v_trilha) then
    perform interno.erro('muitas');
  end if;
  insert into rede_p4_de_mentoras (usuario, trilha, vagas) values (v, v_trilha, p_vagas)
    on conflict (usuario, trilha) do update set vagas = excluded.vagas;
  return jsonb_build_object('oferta', true, 'vagas', p_vagas);
end $$;

/** Há mentoria com vaga nesta trilha para quem pergunta? Só sim ou não: nunca quantas veteranas nem quem. */
create or replace function public.rede_p4_de_mentoria_ha(p_trilha text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_trilha text;
begin
  perform interno.alumia_porta();
  v_trilha := interno.rede_p4_de_trilha(p_trilha);
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  return jsonb_build_object('ha', exists (select 1 from interno.rede_p4_de_com_vaga(v_trilha, v)));
end $$;

/** A caloura pede mentoria: o banco sorteia uma veterana com vaga na trilha. Até 3 pares por caloura. */
create or replace function public.rede_p4_de_mentoria_pedir(p_trilha text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid; v_trilha text; v_vet uuid; x rede_p4_de_mentorias;
begin
  perform interno.alumia_porta();
  v_trilha := interno.rede_p4_de_trilha(p_trilha);
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_escrever', 10, 60);
  if exists (select 1 from rede_p4_de_mentorias where caloura = v and trilha = v_trilha) then perform interno.erro('ja_tem'); end if;
  if (select count(*) from rede_p4_de_mentorias where caloura = v) >= 3 then perform interno.erro('muitas'); end if;
  -- O sorteio usa o gerador de identificadores aleatórios do banco (não a ordem de chegada nem quem tem menos pares).
  select c into v_vet from interno.rede_p4_de_com_vaga(v_trilha, v) c order by gen_random_uuid() limit 1;
  if v_vet is null then return jsonb_build_object('par', null); end if;
  insert into rede_p4_de_mentorias (trilha, veterana, caloura) values (v_trilha, v_vet, v) returning * into x;
  return jsonb_build_object('par', interno.rede_p4_de_par_json(x, v));
end $$;

/** As ofertas da própria pessoa e os pares dela (a outra pessoa: só codinome e @). */
create or replace function public.rede_p4_de_mentorias() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  return jsonb_build_object(
    'ofertas', coalesce((select jsonb_agg(jsonb_build_object('trilha', m.trilha, 'vagas', m.vagas) order by m.trilha) from rede_p4_de_mentoras m where m.usuario = v), '[]'::jsonb),
    'pares', coalesce((select jsonb_agg(interno.rede_p4_de_par_json(x, v) order by x.criada_em desc) from rede_p4_de_mentorias x where v in (x.veterana, x.caloura)), '[]'::jsonb),
    'veterana', coalesce((select u.created_at from auth.users u where u.id = v), now()) <= now() - interval '90 days');
end $$;

/** Qualquer uma das duas encerra o par; a linha some. */
create or replace function public.rede_p4_de_mentoria_encerrar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  v := interno.rede_p4_de_membro();
  delete from rede_p4_de_mentorias where id = p_id and v in (veterana, caloura);
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('encerrada', true);
end $$;

-- ── 8. Item 102: mural de editais e bolsas ────────────────────────────────────────────────────────────────────────────────

-- Um edital, bolsa, prêmio, curso ou estágio. Sem quem propôs nem quem publicou. "proposto" espera a conferência; "publicado" está no
-- mural até o prazo; some 30 dias depois do prazo (ou 30 dias depois de proposto, se ninguém conferiu).
create table if not exists interno.rede_p4_de_editais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 5 and 160),
  orgao text not null check (char_length(orgao) between 2 and 80),
  tipo text not null check (tipo in ('edital', 'bolsa', 'premio', 'curso', 'estagio')),
  link text not null check (char_length(link) <= 500 and link ~ '^https://'),
  prazo date not null,
  resumo text not null default '' check (char_length(resumo) <= 400),
  situacao text not null default 'proposto' check (situacao in ('proposto', 'publicado')),
  criado_em date not null default current_date,
  apagar_em date not null
);
create index if not exists rede_p4_de_editais_mural on interno.rede_p4_de_editais (situacao, prazo);
alter table interno.rede_p4_de_editais enable row level security;
revoke all on interno.rede_p4_de_editais from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.rede_p4_de_editais from anon, authenticated; end if;
end $$;

create or replace function interno.rede_p4_de_edital_json(e interno.rede_p4_de_editais) returns jsonb language sql stable as $$
  select jsonb_build_object('id', e.id, 'titulo', e.titulo, 'orgao', e.orgao, 'tipo', e.tipo, 'link', e.link, 'prazo', e.prazo, 'resumo', e.resumo, 'situacao', e.situacao)
$$;

/** Quem é da Alumia propõe um edital com o link oficial e o prazo (de hoje até 2 anos). Vai para a conferência; não guarda quem propôs. */
create or replace function public.rede_p4_de_edital_propor(p jsonb) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_titulo text; v_orgao text; v_tipo text; v_link text; v_prazo date; v_resumo text; v_id uuid;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_edital', 5, 60);
  if p is null or jsonb_typeof(p) <> 'object' then perform interno.erro('invalido:edital'); end if;
  v_titulo := interno.rede_p4_de_texto(p ->> 'titulo', 160);
  v_orgao := interno.rede_p4_de_texto(p ->> 'orgao', 80);
  v_tipo := p ->> 'tipo';
  v_link := interno.rede_p4_de_link(p ->> 'link');
  v_resumo := interno.rede_p4_de_texto(p ->> 'resumo', 400);
  begin
    v_prazo := (p ->> 'prazo')::date;
  exception when others then
    perform interno.erro('invalido:prazo');
  end;
  if char_length(v_titulo) < 5 then perform interno.erro('invalido:titulo'); end if;
  if char_length(v_orgao) < 2 then perform interno.erro('invalido:orgao'); end if;
  if v_tipo is null or v_tipo not in ('edital', 'bolsa', 'premio', 'curso', 'estagio') then perform interno.erro('invalido:tipo'); end if;
  if v_link is null then perform interno.erro('invalido:link'); end if;
  if v_prazo is null or v_prazo < current_date or v_prazo > current_date + 730 then perform interno.erro('invalido:prazo'); end if;
  if (select count(*) from rede_p4_de_editais where situacao = 'proposto') >= 200 then perform interno.erro('fila_cheia'); end if;
  insert into rede_p4_de_editais (titulo, orgao, tipo, link, prazo, resumo, apagar_em)
    values (v_titulo, v_orgao, v_tipo, v_link, v_prazo, v_resumo, least(v_prazo, current_date + 30) + 30)
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'situacao', 'proposto');
end $$;

/** O mural: os publicados com prazo de hoje em diante, do prazo mais perto ao mais longe. Para quem cuida, também a fila. */
create or replace function public.rede_p4_de_editais(p_tipo text default null) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v_cuida boolean;
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  perform interno.limite('rede_p4_de_ler', 300, 60);
  v_cuida := interno.rede_p4_de_cuida();
  delete from rede_p4_de_editais where apagar_em < current_date;
  return jsonb_build_object('cuido', v_cuida,
    'itens', coalesce((select jsonb_agg(interno.rede_p4_de_edital_json(e) order by e.prazo, e.titulo) from rede_p4_de_editais e
                       where e.situacao = 'publicado' and e.prazo >= current_date and (p_tipo is null or e.tipo = p_tipo)), '[]'::jsonb),
    'fila', case when v_cuida then coalesce((select jsonb_agg(interno.rede_p4_de_edital_json(e) order by e.criado_em, e.prazo) from rede_p4_de_editais e
                       where e.situacao = 'proposto' and e.prazo >= current_date), '[]'::jsonb) else '[]'::jsonb end);
end $$;

/** A coordenação ou o painel da Alumia confere: publica (p_publicar) ou tira (do mural ou da fila). */
create or replace function public.rede_p4_de_edital_decidir(p_id uuid, p_publicar boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.rede_p4_de_exige();
  perform interno.rede_p4_de_membro();
  if not interno.rede_p4_de_cuida() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('rede_p4_de_cuidar', 120, 60);
  if coalesce(p_publicar, false) then
    update rede_p4_de_editais set situacao = 'publicado', apagar_em = prazo + 30 where id = p_id and prazo >= current_date;
  else
    delete from rede_p4_de_editais where id = p_id;
  end if;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('rede_p4_de_edital', p_id::text, jsonb_build_object('publicado', coalesce(p_publicar, false)));
  return jsonb_build_object('feito', true);
end $$;

-- ── 9. A faxina e as permissões ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A faxina do lote: fecha os simulados vencidos (as respostas somem), apaga os simulados 30 dias depois do fim e os editais vencidos.
 * Roda pelo pg_cron a cada 10 minutos (abaixo) e também a cada leitura das telas. Não passa pela porta (é do próprio banco).
 */
create or replace function interno.rede_p4_de_faxina() returns void language plpgsql volatile security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.rede_p4_de_simulados') is not null then perform interno.rede_p4_de_simulados_em_dia(); end if;
  if to_regclass('interno.rede_p4_de_editais') is not null then delete from rede_p4_de_editais where apagar_em < current_date; end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('alumia-p4-de-faxina', '*/10 * * * *', 'select interno.rede_p4_de_faxina()');
  end if;
exception when others then
  raise warning 'alumia-p4-de-faxina: a rotina não foi agendada (%).', sqlerrm;
end $$;

-- Pelo nome, para nenhuma função nova ficar de fora: as ajudantes (interno.rede_p4_de_*) só para o dono; as públicas
-- (public.rede_p4_de_*) para quem tem conta, menos o RSS do #tema (também o visitante, pela porta) e a lista de servidores
-- aprovados do servidor do site (só a chave de serviço).
do $$
declare f record;
  v_visitante text[] := array['rede_p4_de_rss_tag'];
  v_servico text[] := array['rede_p4_de_servidores_fora'];
begin
  for f in select p.oid::regprocedure::text as assinatura, n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('interno', 'public') and p.proname like 'rede\_p4\_de\_%' loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      if f.nspname = 'interno' then
        execute format('revoke all on function %s from anon, authenticated', f.assinatura);
      elsif f.proname = any (v_visitante) then
        execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
      elsif f.proname = any (v_servico) then
        execute format('revoke all on function %s from anon, authenticated', f.assinatura);
        execute format('grant execute on function %s to service_role', f.assinatura);
      else
        execute format('revoke all on function %s from anon', f.assinatura);
        execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
      end if;
    end if;
  end loop;
end $$;

select interno.alumia_trancar();
