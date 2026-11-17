-- ───────────────────────────── Alumia · Onda 12 · assinar junto e reagir (novembro de 2026) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 12C. O que entra:
--
--   1. Assinar junto (colaboração em post, L2-34): a autora convida até 3 pessoas para assinar o post com ela. O nome de cada uma
--      só aparece no post DEPOIS do aceite dela; até lá, só a autora sabe a quem convidou (foi ela que escreveu o @). Qualquer
--      coautora sai quando quiser, sem aviso a ninguém, e não é convidada de novo para aquele post; quem recusou também não. O
--      convite sem resposta vence em 7 dias e some (a autora não distingue o vencido do recusado: ninguém fica pressionado). Só
--      post de abertura (não resposta), e a escolha "quem pode me mencionar" de quem é convidada vale para o convite. Federar a
--      coautoria é da Faixa 2: nada daqui toca a federação.
--   2. "Fonte?" (L2-35): quem lê pede a fonte à autora com um toque. Ninguém vê quem pediu (a tabela guarda a pessoa só para ela
--      poder desfazer e para avisar quando a fonte chegar). O total de pedidos aparece só para a autora e a mediação, e o número
--      só a partir de 3 (abaixo disso, "pediram a fonte"). A autora responde pondo a fonte no post (um link ou uma checagem do
--      Vale o Escrito); aí os pedidos se apagam e quem pediu recebe um aviso. As outras reações (a lista fechada de emojis com
--      nome) continuam como estão.
--   3. Marcar pessoas em foto (L2-29, com a troca): a marcação é a da onda 9 (20261115-alumia-o9-protecao.sql: padrão "ninguém me
--      marca", aprovar antes de aparecer, proibido em post de ato, quem foi marcada tira quando quiser, sem reconhecimento facial).
--      Aqui entra o que faltava: também é PROIBIDA em post de comunidade de luta (categoria 'lutas'), por um gatilho na própria
--      tabela (vale para qualquer caminho que grave), e as que já existiam nesses posts saem.
--   4. Notas da comunidade ligadas ao Vale o Escrito (L1-8): a nota de contexto pode citar uma checagem do Vale o Escrito. Guarda
--      só o identificador do caso (o link é interno, montado pela tela: /vale-o-escrito/caso/<id>); caso retirado do ar não
--      entra e, se sair depois, deixa de aparecer. Ligar ou trocar a checagem zera os votos da nota (a nota é outra).
--
-- Endereço de rede: nada daqui lê ou guarda (decisão de 13/11). Nenhuma lista de pessoas: quem pediu a fonte e quem avaliou nunca
-- voltam; os coautores que aparecem são só os que aceitaram. Tabelas em interno, RLS ligada e sem política, nenhuma permissão
-- direta; acesso só pelas funções security definer abaixo (search_path fixo), que passam pela porta da Alumia
-- (interno.alumia_trancar no fim). Nenhuma função recebe linha de tabela com valor padrão. Pode rodar mais de uma vez, sem apagar
-- dado nenhum (fora as marcações em post de comunidade de luta, que a regra nova proíbe). Roda depois das migrações da Onda 11.
-- Teste: scripts/testar-alumia-o12-coautoria.mjs.

-- 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- Quem foi convidada a assinar junto e em que pé está. A autora é a do post (não há coluna de "quem convidou").
create table if not exists interno.rede_coautorias (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  coautora uuid not null references interno.perfis (id) on delete cascade,
  estado text not null default 'convite' check (estado in ('convite', 'aceita', 'recusada', 'saiu')),
  convidada_em timestamptz not null default now(),
  decidida_em timestamptz,
  primary key (post, coautora)
);
create index if not exists rede_coautorias_coautora on interno.rede_coautorias (coautora, estado, convidada_em desc);

-- Os pedidos de fonte ainda sem resposta. A pessoa fica guardada só para desfazer o próprio pedido e receber o aviso da fonte.
create table if not exists interno.rede_fonte_pedidos (
  post uuid not null references interno.rede_posts (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (post, usuario)
);
create index if not exists rede_fonte_pedidos_usuario on interno.rede_fonte_pedidos (usuario);

-- Quando a autora foi avisada dos pedidos pela última vez (um aviso por dia, no máximo; sem quem pediu).
create table if not exists interno.rede_fonte_avisos (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  avisada_em timestamptz not null default now()
);

-- A fonte que a autora pôs no post: um link http(s), uma checagem do Vale o Escrito, ou os dois.
create table if not exists interno.rede_fontes (
  post uuid primary key references interno.rede_posts (id) on delete cascade,
  link text check (link is null or (char_length(link) between 10 and 500 and link ~* '^https?://[^/@\s]+(/\S*)?$')),
  vale text check (vale is null or vale ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  dada_em timestamptz not null default now(),
  check (link is not null or vale is not null)
);

-- A checagem do Vale o Escrito que uma nota de contexto cita.
create table if not exists interno.rede_nota_vale (
  nota uuid primary key references interno.rede_alumia_notas (id) on delete cascade,
  vale text not null check (vale ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  ligada_em timestamptz not null default now()
);

alter table interno.rede_coautorias enable row level security;
alter table interno.rede_fonte_pedidos enable row level security;
alter table interno.rede_fonte_avisos enable row level security;
alter table interno.rede_fontes enable row level security;
alter table interno.rede_nota_vale enable row level security;
revoke all on table interno.rede_coautorias, interno.rede_fonte_pedidos, interno.rede_fonte_avisos, interno.rede_fontes, interno.rede_nota_vale from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.rede_coautorias, interno.rede_fonte_pedidos, interno.rede_fonte_avisos, interno.rede_fontes, interno.rede_nota_vale
      from anon, authenticated;
  end if;
end $$;

-- 2. Regras de apoio ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A frente está ligada? Só com decisão explícita do painel ("alumia-coautoria" em interno.recursos_vivos, só pelo nome) e sem a
 * Alumia nova desligada lá. Desligada, nada se grava nem se avisa e o cartão não devolve nada; tirar (o convite, a coautora, a
 * fonte, o pedido) continua valendo. A regra da marcação na comunidade de luta (o gatilho) vale sempre.
 */
create or replace function interno.rede_o12c_ligada() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-coautoria'), false);
end $$;

/** O convite ainda vale? Aceita sempre vale; convite, por 7 dias. Recusada e saiu não contam. */
create or replace function interno.rede_coautoria_viva(p_estado text, p_convidada_em timestamptz) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_estado = 'aceita' or (p_estado = 'convite' and p_convidada_em > now() - interval '7 days')
$$;

/** O post, se p_quem pode vê-lo e ele não está oculto, retido nem apagado; senão, o erro 'nao_encontrado'. */
create or replace function interno.rede_coautoria_post(p_post uuid, p_quem uuid) returns interno.rede_posts language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  select * into x from rede_posts where id = p_post;
  if not found or not interno.rede_ve(x, p_quem) or x.oculto or x.retido or x.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  return x;
end $$;

/** A comunidade do post é de luta (categoria 'lutas')? */
create or replace function interno.rede_post_de_luta(p_comunidade text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_comunidade is not null and exists (select 1 from rede_comunidades c where c.slug = p_comunidade and c.categoria = 'lutas')
$$;

/** Marcar pessoas neste post é permitido (fora quem marca e quem é marcada)? Não em resposta, ato, chamado nem comunidade de luta. */
create or replace function interno.rede_marcar_cabe(p_post uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (
    select 1 from rede_posts x
    where x.id = p_post and x.resposta_a is null and x.chamado is null and x.ato is null and not interno.rede_post_de_luta(x.comunidade)
      and not exists (select 1 from rede_chamados c where c.post = x.id))
$$;

/** A checagem do Vale o Escrito pode ser citada: forma certa e não retirada do ar (o caso pode estar nos arquivos do site). */
create or replace function interno.rede_vale_citavel(p_vale text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_vale ~ '^[a-z0-9][a-z0-9-]{1,79}$'
    and not exists (select 1 from vale_entradas e where e.id = p_vale and e.retirado_em is not null)
$$;

/** Quem lê é da mediação deste post (a equipe que cuida ou a moderação da comunidade dele)? */
create or replace function interno.rede_media_do_post(p_comunidade text, p_quem uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_quem is not null and (interno.cuida() or (p_comunidade is not null and interno.rede3_com_modera(p_comunidade, p_quem)))
$$;

-- 3. Marcação: proibida em comunidade de luta ─────────────────────────────────────────────────────────────────────────────

/** Gatilho: a marcação só entra em post onde ela cabe (a regra acima), seja qual for o caminho que grava. */
create or replace function interno.rede_marcacao_confere() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare x rede_posts;
begin
  select * into x from rede_posts where id = new.post;
  if found and (x.chamado is not null or x.ato is not null or exists (select 1 from rede_chamados c where c.post = x.id)) then perform interno.erro('marcar_ato'); end if;
  if found and interno.rede_post_de_luta(x.comunidade) then perform interno.erro('marcar_luta'); end if;
  return new;
end $$;
drop trigger if exists rede_marcacao_confere on interno.rede_o9_marcacoes;
create trigger rede_marcacao_confere before insert or update of post on interno.rede_o9_marcacoes for each row execute function interno.rede_marcacao_confere();

-- As que já existiam em post de comunidade de luta saem (a regra nova não deixa nenhuma aparecer).
delete from interno.rede_o9_marcacoes m using interno.rede_posts x
where x.id = m.post and interno.rede_post_de_luta(x.comunidade);

-- 4. Assinar junto ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A autora convida uma pessoa (pelo @) para assinar junto o próprio post. Recusa: resposta, mais de 3 (aceitas e convites vivos),
 * e a própria autora. Quem já foi convidada naquele post (aceitou, espera, recusou, saiu ou deixou vencer) não é convidada de novo:
 * a função devolve 'feita' sem dizer qual. Quem não pode receber o convite (não vê o post, bloqueio, não é membro, não aceita menção
 * de quem convida) também não é convidada, mas a resposta é a mesma de um convite feito: a autora não fica sabendo da escolha dela.
 * Avisa a convidada (o nome dela só aparece no post se aceitar). Devolve {estado}.
 */
create or replace function public.rede_coautoria_convidar(p_post uuid, p_handle text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_alvo uuid; c rede_coautorias;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_o12c_ligada() then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  x := interno.rede_coautoria_post(p_post, v);
  if x.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if x.resposta_a is not null then perform interno.erro('invalido:resposta'); end if;
  select id into v_alvo from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null then perform interno.erro('nao_encontrado'); end if;
  if v_alvo = v then perform interno.erro('invalido:propria'); end if;
  select * into c from rede_coautorias where post = x.id and coautora = v_alvo;
  if found then return jsonb_build_object('estado', 'feita'); end if; -- o convite vencido conta como resposta: não se refaz
  if (select count(*) from rede_coautorias k where k.post = x.id and interno.rede_coautoria_viva(k.estado, k.convidada_em)) >= 3 then
    perform interno.erro('invalido:muitas');
  end if;
  perform interno.rede2_limite('convidar');
  if interno.rede_bloqueado(v, v_alvo) or not interno.rede2_membro(v_alvo) or not interno.rede_ve(x, v_alvo)
     or not interno.rede_o9_protecao_permite(v_alvo, v, 'mencionar') then
    return jsonb_build_object('estado', 'convite'); -- nada se grava e ninguém é avisado
  end if;
  insert into rede_coautorias (post, coautora) values (x.id, v_alvo);
  begin
    insert into avisos (para, texto, categoria, post, alvo, ator)
    values (v_alvo, left(format('%s convidou você para assinar junto um post na Alumia. Seu nome só aparece no post se você aceitar.', interno.rede_nome(v)), 500),
            'rede', x.id, x.id, v);
  exception when others then null; -- o aviso nunca derruba o convite
  end;
  return jsonb_build_object('estado', 'convite');
end $$;

/** A convidada aceita (p_aceitar) ou recusa o convite vivo. Aceitar avisa a autora; recusar não avisa ninguém. Devolve {estado}. */
create or replace function public.rede_coautoria_decidir(p_post uuid, p_aceitar boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_coautorias; x rede_posts;
begin
  perform interno.aberta('comunidade');
  if p_aceitar is null then perform interno.erro('invalido:decisao'); end if;
  if p_aceitar and not interno.rede_o12c_ligada() then perform interno.erro('desligado'); end if;
  select * into c from rede_coautorias where post = p_post and coautora = v for update;
  if not found or c.estado <> 'convite' or not interno.rede_coautoria_viva(c.estado, c.convidada_em) then perform interno.erro('nao_encontrado'); end if;
  x := interno.rede_coautoria_post(p_post, v);
  if p_aceitar and not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede2_limite('editar');
  update rede_coautorias set estado = case when p_aceitar then 'aceita' else 'recusada' end, decidida_em = now() where post = c.post and coautora = v;
  if p_aceitar and x.autor is not null and not interno.rede_bloqueado(v, x.autor) then
    perform interno.avisar_em(x.autor, format('%s aceitou assinar junto o seu post “%s” na Alumia.', interno.rede_nome(v), left(coalesce(x.titulo, x.texto), 80)), 'rede');
  end if;
  return jsonb_build_object('estado', case when p_aceitar then 'aceita' else 'recusada' end);
end $$;

/** A coautora sai (de um convite ou de uma coautoria aceita). Sem aviso a ninguém; não é convidada de novo naquele post. */
create or replace function public.rede_coautoria_sair(p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  update rede_coautorias set estado = 'saiu', decidida_em = now() where post = p_post and coautora = v and estado in ('convite', 'aceita');
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('estado', 'saiu');
end $$;

/** A autora tira um convite ou uma coautora do próprio post (pelo @). Quem recusou ou saiu continua fora. Devolve {tirada}. */
create or replace function public.rede_coautoria_tirar(p_post uuid, p_handle text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_alvo uuid;
begin
  perform interno.aberta('comunidade');
  select * into x from rede_posts where id = p_post;
  if not found or x.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  select id into v_alvo from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  if v_alvo is null then perform interno.erro('nao_encontrado'); end if;
  -- Só o convite vivo e a coautoria aceita saem; o convite vencido fica (como a recusa), para não virar um jeito de convidar de novo.
  delete from rede_coautorias where post = x.id and coautora = v_alvo and (estado = 'aceita' or interno.rede_coautoria_viva(estado, convidada_em));
  return jsonb_build_object('tirada', true);
end $$;

/** Os convites vivos que esperam a resposta de quem chama: post, codinome e @ da autora, um trecho e a data. Até 50. */
create or replace function public.rede_coautoria_convites() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede_o12c_ligada() then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('post', z.id, 'codinome', interno.rede_nome(z.autor), 'handle', z.handle,
                   'trecho', left(coalesce(z.titulo, z.texto), 140), 'convidada_em', z.convidada_em) order by z.convidada_em desc, z.id), '[]'::jsonb)
          from (select p.id, p.autor, p.titulo, p.texto, f.rede_handle as handle, k.convidada_em
                from rede_coautorias k join rede_posts p on p.id = k.post left join perfis f on f.id = p.autor
                where k.coautora = v and k.estado = 'convite' and interno.rede_coautoria_viva(k.estado, k.convidada_em)
                  and p.apagado_em is null and not p.oculto and not p.retido and interno.rede_ve(p, v) and not interno.rede_bloqueado(v, p.autor)
                order by k.convidada_em desc limit 50) z);
end $$;

-- 5. "Fonte?" ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pede (p_sim) ou desfaz o pedido da fonte. Só membro que vê o post, nunca no próprio, sem bloqueio, fora de comunidade de onde
 * foi banida, e só enquanto o post não tem fonte. O primeiro pedido do dia avisa a autora, sem dizer quem pediu nem quantas
 * pessoas. Devolve {minha} (nunca o total).
 */
create or replace function public.rede_fonte_pedir(p_post uuid, p_sim boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_avisada timestamptz;
begin
  perform interno.aberta('comunidade');
  if coalesce(p_sim, false) and not interno.rede_o12c_ligada() then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  x := interno.rede_coautoria_post(p_post, v);
  if interno.rede_bloqueado(v, x.autor) then perform interno.erro('nao_encontrado'); end if;
  if x.autor = v then perform interno.erro('invalido:propria'); end if;
  if x.comunidade is not null and interno.rede3_com_situacao(x.comunidade, v) = 'banido' then perform interno.erro('sem_permissao'); end if;
  perform interno.rede2_limite('reagir');
  if not coalesce(p_sim, true) then
    delete from rede_fonte_pedidos where post = x.id and usuario = v;
    return jsonb_build_object('minha', false);
  end if;
  if exists (select 1 from rede_fontes where post = x.id) then perform interno.erro('fonte_ja_dada'); end if;
  insert into rede_fonte_pedidos (post, usuario) values (x.id, v) on conflict do nothing;
  select avisada_em into v_avisada from rede_fonte_avisos where post = x.id;
  if x.autor is not null and (v_avisada is null or v_avisada < now() - interval '1 day') then
    insert into rede_fonte_avisos (post, avisada_em) values (x.id, now()) on conflict (post) do update set avisada_em = now();
    begin
      insert into avisos (para, texto, categoria, post, alvo)
      values (x.autor, left(format('Pediram a fonte do seu post “%s” na Alumia. Quem pediu não aparece; você responde pondo a fonte no post.',
                                   left(coalesce(x.titulo, x.texto), 80)), 500), 'rede', x.id, x.id);
    exception when others then null;
    end;
  end if;
  return jsonb_build_object('minha', true);
end $$;

/**
 * A autora põe (ou troca) a fonte do post: um link http(s), uma checagem do Vale o Escrito (o identificador do caso), ou os dois.
 * Os pedidos se apagam e cada pessoa que pediu recebe um aviso (sem saber quem mais pediu). Devolve {link, vale}.
 */
create or replace function public.rede_fonte_dar(p_post uuid, p_link text, p_vale text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts; v_link text := nullif(btrim(coalesce(p_link, '')), ''); v_vale text := nullif(lower(btrim(coalesce(p_vale, ''))), '');
begin
  perform interno.aberta('comunidade');
  if not interno.rede_o12c_ligada() then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  x := interno.rede_coautoria_post(p_post, v);
  if x.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  if v_link is null and v_vale is null then perform interno.erro('invalido:fonte'); end if;
  if v_link is not null and (char_length(v_link) < 10 or char_length(v_link) > 500 or v_link !~* '^https?://[^/@\s]+(/\S*)?$'
     -- sem parâmetro de rastreio (a mesma lista dos links do perfil, 20261118-alumia-o12-perfil.sql)
     or v_link ~* '[?&](utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_[a-z]+|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|yclid|twclid|ttclid|s_cid|mkt_tok)=') then
    perform interno.erro('invalido:fonte');
  end if;
  if v_vale is not null and not interno.rede_vale_citavel(v_vale) then perform interno.erro('invalido:vale'); end if;
  perform interno.rede2_limite('editar');
  insert into rede_fontes (post, link, vale) values (x.id, v_link, v_vale)
  on conflict (post) do update set link = excluded.link, vale = excluded.vale, dada_em = now();
  begin
    insert into avisos (para, texto, categoria, post, alvo)
    select p.usuario, left(format('A autora pôs a fonte no post “%s” que você pediu.', left(coalesce(x.titulo, x.texto), 80)), 500), 'rede', x.id, x.id
    from rede_fonte_pedidos p
    where p.post = x.id and not interno.rede_bloqueado(p.usuario, v)
    limit 500;
  exception when others then null;
  end;
  delete from rede_fonte_pedidos where post = x.id;
  delete from rede_fonte_avisos where post = x.id;
  return jsonb_build_object('link', v_link, 'vale', v_vale);
end $$;

/** A autora tira a fonte do post (dá para pedir de novo). Devolve {tirada}. */
create or replace function public.rede_fonte_tirar(p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); x rede_posts;
begin
  perform interno.aberta('comunidade');
  select * into x from rede_posts where id = p_post;
  if not found or x.autor is distinct from v then perform interno.erro('sem_permissao'); end if;
  delete from rede_fontes where post = x.id;
  return jsonb_build_object('tirada', true);
end $$;

-- 6. O que o cartão precisa saber, por lote ──────────────────────────────────────────────────────────────────────────────

/**
 * Para cada post (até 50) que quem pergunta pode ver:
 *   coautores           as que ACEITARAM (@ e codinome), sem quem quem lê bloqueou;
 *   meu_convite         'convite' ou 'aceita' quando quem lê foi convidada (nulo nos outros casos);
 *   convites            só para a autora: os convites vivos sem resposta (@ e codinome, que ela mesma escreveu);
 *   pode_convidar       a autora ainda pode convidar (post de abertura, menos de 3);
 *   fonte               a fonte que a autora pôs ({link, vale}), para todo mundo que vê o post;
 *   pedi_fonte          quem lê pediu a fonte;
 *   pode_pedir_fonte    quem lê pode pedir (membro, não é a autora, o post não tem fonte);
 *   pedidos_fonte       só para a autora e a mediação: {ha, total} (total nulo abaixo de 3);
 *   marcar_pode         só para a autora: o post aceita marcação (tem imagem e não é ato, resposta nem comunidade de luta);
 *   marcacoes_esperando só para a autora: as marcações que ela fez e ainda esperam o aceite (@ e codinome).
 * Nunca a lista de quem pediu a fonte, de quem recusou ou de quem saiu.
 */
create or replace function public.rede_coautoria_cartoes(p_ids uuid[]) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); r jsonb := '{}'::jsonb; x rede_posts; v_membro boolean; v_n integer; v_autora boolean; v_fonte jsonb;
begin
  perform interno.aberta('comunidade');
  if p_ids is null or not interno.rede_o12c_ligada() then return r; end if;
  if v is not null and exists (select 1 from perfis f where f.id = v and f.suspenso) then perform interno.erro('conta_suspensa'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  v_membro := v is not null and interno.rede2_membro(v);
  for x in select * from rede_posts where id = any (p_ids[1:50]) and apagado_em is null and not oculto and not retido loop
    continue when not interno.rede_ve(x, v);
    v_autora := v is not null and x.autor = v;
    select jsonb_build_object('link', f.link, 'vale', case when interno.rede_vale_citavel(f.vale) then f.vale end) into v_fonte from rede_fontes f where f.post = x.id;
    select count(*)::integer into v_n from rede_fonte_pedidos where post = x.id;
    r := r || jsonb_build_object(x.id::text, jsonb_build_object(
      'coautores', (select coalesce(jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'codinome', interno.rede_nome(f.id)) order by k.decidida_em, f.rede_handle), '[]'::jsonb)
                    from rede_coautorias k join perfis f on f.id = k.coautora
                    where k.post = x.id and k.estado = 'aceita' and not f.suspenso and not interno.rede_bloqueado(v, f.id)),
      'meu_convite', case when v is not null then (select k.estado from rede_coautorias k where k.post = x.id and k.coautora = v
                                                     and interno.rede_coautoria_viva(k.estado, k.convidada_em)) end,
      'convites', case when v_autora then (select coalesce(jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'codinome', interno.rede_nome(f.id)) order by k.convidada_em), '[]'::jsonb)
                                            from rede_coautorias k join perfis f on f.id = k.coautora
                                            where k.post = x.id and k.estado = 'convite' and interno.rede_coautoria_viva(k.estado, k.convidada_em)) end,
      'pode_convidar', v_autora and v_membro and x.resposta_a is null
                       and (select count(*) from rede_coautorias k where k.post = x.id and interno.rede_coautoria_viva(k.estado, k.convidada_em)) < 3,
      'fonte', v_fonte,
      'pedi_fonte', v is not null and exists (select 1 from rede_fonte_pedidos p where p.post = x.id and p.usuario = v),
      'pode_pedir_fonte', v_membro and not v_autora and v_fonte is null and not interno.rede_bloqueado(v, x.autor),
      'pedidos_fonte', case when v_autora or interno.rede_media_do_post(x.comunidade, v) then
                         jsonb_build_object('ha', v_n > 0, 'total', case when v_n >= 3 then v_n end) end,
      'marcar_pode', v_autora and interno.rede_marcar_cabe(x.id) and exists (select 1 from rede_midia m where m.post = x.id),
      'marcacoes_esperando', case when v_autora then (select coalesce(jsonb_agg(jsonb_build_object('handle', f.rede_handle, 'codinome', interno.rede_nome(f.id)) order by m.criado_em), '[]'::jsonb)
                                                       from rede_o9_marcacoes m join perfis f on f.id = m.marcado
                                                       where m.post = x.id and m.estado = 'pendente') end));
    v_fonte := null;
  end loop;
  return r;
end $$;

-- 7. Notas da comunidade ligadas ao Vale o Escrito ───────────────────────────────────────────────────────────────────────

/**
 * A autora da nota liga (ou troca) a checagem do Vale o Escrito que a nota cita; vazio desliga. Ligar ou trocar zera os votos e a
 * nota volta a "proposta" (é outra nota); desligar não muda os votos. Nota oculta pela moderação não muda. Devolve {vale}.
 */
create or replace function public.rede_nota_vale_ligar(p_nota uuid, p_vale text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n rede_alumia_notas; v_vale text := nullif(lower(btrim(coalesce(p_vale, ''))), ''); v_antes text;
begin
  perform interno.aberta('comunidade');
  if v_vale is not null and not interno.rede_o12c_ligada() then perform interno.erro('desligado'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into n from rede_alumia_notas where id = p_nota for update;
  if not found or n.autora is distinct from v then perform interno.erro('nao_encontrado'); end if;
  if n.situacao = 'oculta' then perform interno.erro('sem_permissao'); end if;
  perform interno.rede_alumia_nota_post(n.post, v);
  if v_vale is not null and not interno.rede_vale_citavel(v_vale) then perform interno.erro('invalido:vale'); end if;
  perform interno.limite('alumia_nota_vale', 20, 60);
  select vale into v_antes from rede_nota_vale where nota = n.id;
  if v_vale is null then
    delete from rede_nota_vale where nota = n.id;
  elsif v_antes is distinct from v_vale then
    insert into rede_nota_vale (nota, vale) values (n.id, v_vale) on conflict (nota) do update set vale = excluded.vale, ligada_em = now();
    delete from rede_alumia_nota_votos where nota = n.id;
    update rede_alumia_notas set situacao = 'proposta', mudou_em = now() where id = n.id;
  end if;
  return jsonb_build_object('vale', v_vale);
end $$;

/**
 * As checagens do Vale o Escrito citadas pelas notas de um post, só das notas que quem lê já vê pela função das notas: as que
 * aparecem (para todo mundo), as propostas que a pessoa pode avaliar, a dela e, para a mediação, as ocultas. {<nota>: <caso>}.
 */
create or replace function public.rede_notas_vale(p_post uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); x rede_posts; v_aval boolean := false; v_mod boolean;
begin
  perform interno.aberta('comunidade');
  if not interno.rede_o12c_ligada() then return '{}'::jsonb; end if;
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  x := interno.rede_alumia_nota_post(p_post, v);
  perform interno.limite('rede2_ler', 600, 60);
  if v is not null then v_aval := interno.rede2_membro(v) and interno.rede3_mod_nivel(v) >= 1; end if;
  v_mod := interno.rede_media_do_post(x.comunidade, v);
  return (select coalesce(jsonb_object_agg(n.id::text, l.vale), '{}'::jsonb)
          from rede_alumia_notas n join rede_nota_vale l on l.nota = n.id
          where n.post = x.id and interno.rede_vale_citavel(l.vale)
            and ((n.situacao = 'mostrada' and not interno.rede_bloqueado(v, n.autora))
                 or (v_aval and n.situacao <> 'oculta' and not interno.rede_bloqueado(v, n.autora))
                 or (v is not null and n.autora = v)
                 or v_mod));
end $$;

-- 8. Permissões ──────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['interno.rede_o12c_ligada()', 'interno.rede_coautoria_viva(text, timestamptz)', 'interno.rede_coautoria_post(uuid, uuid)', 'interno.rede_post_de_luta(text)',
    'interno.rede_marcar_cabe(uuid)', 'interno.rede_vale_citavel(text)', 'interno.rede_media_do_post(text, uuid)', 'interno.rede_marcacao_confere()',
    'public.rede_coautoria_convidar(uuid, text)', 'public.rede_coautoria_decidir(uuid, boolean)', 'public.rede_coautoria_sair(uuid)',
    'public.rede_coautoria_tirar(uuid, text)', 'public.rede_coautoria_convites()', 'public.rede_fonte_pedir(uuid, boolean)',
    'public.rede_fonte_dar(uuid, text, text)', 'public.rede_fonte_tirar(uuid)', 'public.rede_coautoria_cartoes(uuid[])',
    'public.rede_nota_vale_ligar(uuid, text)', 'public.rede_notas_vale(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    -- Leitura do que é aberto (coautoras aceitas, a fonte, a checagem da nota que aparece): com ou sem conta; a função confere quem vê.
    foreach f in array array['public.rede_coautoria_cartoes(uuid[])', 'public.rede_notas_vale(uuid)'] loop
      execute format('grant execute on function %s to anon, authenticated, service_role', f);
    end loop;
    -- O resto: só com conta.
    foreach f in array array['public.rede_coautoria_convidar(uuid, text)', 'public.rede_coautoria_decidir(uuid, boolean)', 'public.rede_coautoria_sair(uuid)',
      'public.rede_coautoria_tirar(uuid, text)', 'public.rede_coautoria_convites()', 'public.rede_fonte_pedir(uuid, boolean)',
      'public.rede_fonte_dar(uuid, text, text)', 'public.rede_fonte_tirar(uuid)', 'public.rede_nota_vale_ligar(uuid, text)'] loop
      execute format('grant execute on function %s to authenticated, service_role', f);
    end loop;
  end if;
end $$;

-- 9. A porta em todas as funções novas de membro ───────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
