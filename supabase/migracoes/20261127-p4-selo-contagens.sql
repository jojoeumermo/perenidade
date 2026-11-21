-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Alumia · Prompt 4 · itens 3 e 5: o selo de verificado para pessoas, o nome reservado e as contagens públicas por escolha.
--
-- Roda depois de 20261126-p5-fim.sql (banco na versão 17). Não mexe em rede_alumia_versao nem na lista de exceções da porta: o
-- 20261127-p4-fim.sql faz isso. Pode rodar mais de uma vez, sem apagar dado nenhum.
--
-- O que faz (tudo atrás do interruptor "alumia-p4-selo-contagens", só pelo nome e desligado):
--   0. O interruptor no catálogo.
--   1. Selo de verificado para pessoas (item 3), no mesmo desenho do selo das organizações (20261109-alumia-f4.sql): a pessoa pede
--      e diz só POR QUAL canal oficial a coordenação pode conferir (e-mail institucional, perfil oficial em outra rede, gabinete);
--      não se guarda documento, endereço nem prova. Só a coordenação (o papel no banco, com o segundo fator: interno.alumia_coordenacao
--      do Prompt 5) decide; só a decisão, quem decidiu e quando entram num registro só de inserção (interno.rede_p4_selo_registro). O
--      pedido some quando é decidido. Tirar o selo pede motivo. O selo é gratuito e não existe outro jeito de ter um. Tipos: pessoa
--      pública, educadora; "organização" é o selo que já existe (rede_orgs), e o perfil mostra os dois do mesmo jeito.
--      Estende o Prompt 5, sem duplicar: quem tem o selo de pessoa conta como verificada em interno.alumia_verificada (a denúncia
--      automática de nome parecido passa a proteger também essas pessoas); o bloqueio de símbolos parecidos com o selo continua sendo
--      o do Prompt 5 (interno.nome_sem_selo_falso), e a comparação de nomes usa o mesmo esqueleto (interno.nome_esqueleto).
--   2. Nome reservado (item 3): a coordenação mantém, no painel, os nomes e @ de figuras públicas. Com o interruptor ligado, um
--      gatilho em interno.perfis recusa ('nome_reservado') cadastro ou troca de codinome, de codinome reserva ou de @ parecido com um
--      nome reservado, venha de qual função vier, a não ser para a pessoa a quem a coordenação ligou aquele nome ao dar o selo. A
--      comparação é a do esqueleto do Prompt 5 (sem acento, maiúscula, espaço e sinais; 0 por o, 1 por l, 3 por e, 4 e @ por a...;
--      sem letra repetida), mais i por l, com e sem os números, sem os enfeites comuns do começo e do fim ("oficial", "real", "br");
--      recusa o nome que começa ou termina pelo reservado e, para nome reservado de 6 letras ou mais, também o que o tem no meio.
--   3. Contagens públicas por escolha (item 5): duas chaves por pessoa, desligadas por padrão ("mostrar quantas pessoas me seguem"
--      e "mostrar o número de apoios nos meus posts"). Ligadas, o número sai só a partir de 3 e pelo marco de 15 minutos (quem
--      entrou depois do marco ainda não conta). Abaixo de 3: nulo ("menos de 3" na tela). Nunca a lista de quem segue ou apoiou.
--      Desligadas, nenhuma função devolve o número a outra pessoa.
-- Funções que já existiam e são redefinidas aqui (a última definição, completa, tirada do banco montado com o install.sql):
--   interno.alumia_verificada e interno.nome_esqueleto (as duas de 20261126-p5-avisos.sql; o esqueleto tinha as trocas fora de ordem).
-- Nenhuma lista de pessoas sai para quem não é da coordenação; nenhum endereço de rede é lido ou guardado.
-- Teste: scripts/testar-p4-selo-contagens.mjs.
-- Lei: LGPD art. 6º, III (necessidade: o selo não guarda documento nem prova) e VI (transparência: quem verificou e o que o selo
-- quer dizer), art. 7º, I (as contagens só aparecem por consentimento de cada pessoa) e art. 46 (segurança).

-- ── 0. O interruptor ──────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('interno.recursos_catalogo') is not null then
    insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('alumia-p4-selo-contagens', true)
      on conflict (nome) do update set so_pelo_nome = true;
  end if;
end $$;

/** O selo das pessoas, o nome reservado e as contagens por escolha estão ligados? Só com a decisão do painel e a Alumia ligada. */
create or replace function interno.rede_p4_selo_ligado() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if to_regclass('interno.recursos_vivos') is null then return false; end if;
  if exists (select 1 from recursos_vivos where nome in ('rede-v2', 'alumia-2') and not ligado) then return false; end if;
  return coalesce((select ligado from recursos_vivos where nome = 'alumia-p4-selo-contagens'), false);
end $$;

/** Recusa com "desligado" quando o interruptor está desligado. */
create or replace function interno.rede_p4_selo_exige() returns void language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if not interno.rede_p4_selo_ligado() then perform interno.erro('desligado'); end if;
end $$;

-- ── 1. As tabelas ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** O selo de cada pessoa verificada. Só o tipo e desde quando; quem deu fica no registro, nunca na tela. */
create table if not exists interno.rede_p4_selos (
  perfil uuid primary key references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('pessoa_publica', 'educadora')),
  dado_em timestamptz not null default now()
);

/** O pedido esperando a coordenação. Só o tipo e o canal pelo qual conferir: nenhum documento, endereço ou prova. Some ao ser decidido. */
create table if not exists interno.rede_p4_selo_pedidos (
  id uuid primary key default gen_random_uuid(),
  perfil uuid not null references interno.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('pessoa_publica', 'educadora')),
  canal text not null check (canal in ('email_institucional', 'perfil_oficial', 'gabinete')),
  criado_em timestamptz not null default now()
);
create unique index if not exists rede_p4_selo_pedidos_um on interno.rede_p4_selo_pedidos (perfil);

/**
 * O registro do selo: só inserção (o gatilho abaixo recusa alterar e apagar). A decisão, o tipo, o motivo (de recusa ou de
 * retirada), quem decidiu e quando. Sem chave estrangeira de propósito: apagar uma conta não reescreve o registro.
 */
create table if not exists interno.rede_p4_selo_registro (
  id bigint generated always as identity primary key,
  alvo uuid not null,
  acao text not null check (acao in ('dado', 'recusado', 'tirado')),
  tipo text not null default '' check (char_length(tipo) <= 20),
  motivo text not null default '' check (char_length(motivo) <= 500),
  por uuid,
  em timestamptz not null default now()
);
create index if not exists rede_p4_selo_registro_alvo on interno.rede_p4_selo_registro (alvo, em desc);

create or replace function interno.rede_p4_so_insercao() returns trigger language plpgsql as $$
begin
  raise exception 'O registro do selo não se altera nem se apaga.' using errcode = 'P0001';
end $$;
drop trigger if exists rede_p4_so_insercao on interno.rede_p4_selo_registro;
create trigger rede_p4_so_insercao before update or delete on interno.rede_p4_selo_registro for each row execute function interno.rede_p4_so_insercao();
drop trigger if exists rede_p4_so_insercao_truncate on interno.rede_p4_selo_registro;
create trigger rede_p4_so_insercao_truncate before truncate on interno.rede_p4_selo_registro for each statement execute function interno.rede_p4_so_insercao();

/** Os nomes e @ reservados (figuras públicas), mantidos pela coordenação. `dono`: a pessoa verificada que pode usar o nome. */
create table if not exists interno.rede_p4_nomes_reservados (
  id bigint generated always as identity primary key,
  rotulo text not null check (char_length(rotulo) between 3 and 80),
  chave text not null unique check (char_length(chave) >= 3),
  dono uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

/** As duas chaves das contagens públicas. Sem linha = as duas desligadas (o padrão). */
create table if not exists interno.rede_p4_contagens (
  perfil uuid primary key references interno.perfis (id) on delete cascade,
  seguidores boolean not null default false,
  apoios boolean not null default false,
  em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['rede_p4_selos', 'rede_p4_selo_pedidos', 'rede_p4_selo_registro', 'rede_p4_nomes_reservados', 'rede_p4_contagens'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on table interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

/**
 * A pessoa tem o selo de verificado? A equipe e a coordenação (o papel, do Prompt 5) e, agora, quem recebeu o selo de pessoa da
 * coordenação. Com isso, a denúncia automática de nome parecido (interno.nome_parecido_avisar) protege também essas pessoas, e elas
 * mesmas não a disparam. Definição anterior: 20261126-p5-avisos.sql. Com a flag desligada, o selo de pessoa não vale (nem aqui):
 * fica só a regra do Prompt 5 (auditoria do P4, B2).
 */
create or replace function interno.alumia_verificada(p_id uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.voluntario_e(p_id) or (interno.rede_p4_selo_ligado() and exists (select 1 from interno.rede_p4_selos s where s.perfil = p_id))
$$;

-- ── 2. O nome reservado ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O esqueleto de um nome (do Prompt 5), com as trocas na ordem certa: a lista de 20261126-p5-avisos.sql tinha uma letra a mais
 * ("oleaastbasli"), e daí o 5 virava a, o 7 virava s, o 8 virava t, o @ virava b e o $ virava a. Agora: 0→o, 1→l, 3→e, 4→a, 5→s,
 * 7→t, 8→b, @→a, $→s, |→l, !→i, como o comentário de lá já dizia. Ninguém guarda o esqueleto: ele é calculado na hora da conferência.
 */
create or replace function interno.nome_esqueleto(p text) returns text language sql immutable as $$
  select regexp_replace(
           replace(replace(regexp_replace(translate(interno.rede_chave(p), '0134578@$|!', 'oleastbasli'), '[^a-z]', '', 'g'), 'rn', 'm'), 'vv', 'w'),
           '(.)\1+', '\1', 'g')
$$;

/**
 * Uma chave de comparação: o esqueleto do Prompt 5 (interno.nome_esqueleto: sem acento, maiúscula e sinais, as trocas comuns, sem
 * letra repetida), mais i por l (o "1" já vira l; assim "mar1elle" e "marielle" dão o mesmo). Com `p_tira_numero`, os números saem
 * antes ("lula2026" dá "lula").
 */
create or replace function interno.rede_p4_chave(p text, p_tira_numero boolean default false) returns text language sql immutable as $$
  select regexp_replace(translate(interno.nome_esqueleto(case when p_tira_numero then regexp_replace(coalesce(p, ''), '[0-9]+', '', 'g') else p end), 'i', 'l'),
                        '(.)\1+', '\1', 'g')
$$;

/** As chaves de um nome que se compara: com e sem os números, e com os enfeites comuns do começo e do fim tirados. */
create or replace function interno.rede_p4_chaves(p text) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct k) filter (where char_length(k) >= 3), '{}')
  from (select unnest(array[a, regexp_replace(regexp_replace(a, '^(o|a|eu|sou|real|oflclal)+', ''), '(oflclal|real|br|ofc|of|verdadelr[oa]|fa)+$', '')]) as k
        from unnest(array[interno.rede_p4_chave(p, false), interno.rede_p4_chave(p, true)]) as a) x
$$;

/**
 * O nome `p` é parecido com a chave reservada? Igual (por qualquer das chaves); começando ou terminando por ela ("lula_sp", "sou_lula");
 * ou, para chave de 6 letras ou mais, com ela em qualquer lugar ("marielle_franco_rj"). Chave curta no meio de outra palavra passa
 * ("tallulah" não é "lula").
 */
create or replace function interno.rede_p4_parecido(p_chaves text[], p_reservada text) returns boolean language sql immutable as $$
  select exists (select 1 from unnest(p_chaves) k
                 where k = p_reservada or starts_with(k, p_reservada) or right(k, char_length(p_reservada)) = p_reservada
                    or (char_length(p_reservada) >= 6 and position(p_reservada in k) > 0))
$$;

/** O gatilho: com o interruptor ligado, codinome ou @ novo parecido com um nome reservado é recusado (menos para quem o tem). */
create or replace function interno.rede_p4_nome_reservado_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_handle text[] := '{}'; v_codinome text[] := '{}';
begin
  if not interno.rede_p4_selo_ligado() then return new; end if;
  if new.rede_handle is not null and (tg_op = 'INSERT' or new.rede_handle is distinct from old.rede_handle) then
    v_handle := interno.rede_p4_chaves(new.rede_handle);
  end if;
  if new.rede_codinome is not null and (tg_op = 'INSERT' or new.rede_codinome is distinct from old.rede_codinome) then
    v_codinome := interno.rede_p4_chaves(new.rede_codinome);
  end if;
  if new.rede_codinome_reserva is not null and (tg_op = 'INSERT' or new.rede_codinome_reserva is distinct from old.rede_codinome_reserva) then
    v_codinome := v_codinome || interno.rede_p4_chaves(new.rede_codinome_reserva);
  end if;
  if cardinality(v_handle) = 0 and cardinality(v_codinome) = 0 then return new; end if;
  if exists (select 1 from rede_p4_nomes_reservados r
             where r.dono is distinct from new.id and (interno.rede_p4_parecido(v_handle, r.chave) or interno.rede_p4_parecido(v_codinome, r.chave))) then
    perform interno.erro('nome_reservado');
  end if;
  return new;
end $$;
drop trigger if exists p4_nome_reservado on interno.perfis;
create trigger p4_nome_reservado before insert or update of rede_handle, rede_codinome, rede_codinome_reserva on interno.perfis
  for each row execute function interno.rede_p4_nome_reservado_gatilho();

/** Os nomes reservados (só a coordenação): o nome escrito e se já está ligado a uma pessoa verificada (nunca qual). */
create or replace function public.rede_p4_reservados() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.eu();
  if not interno.alumia_coordenacao() then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.rotulo, 'verificado', r.dono is not null) order by r.rotulo)
                   from rede_p4_nomes_reservados r), '[]'::jsonb);
end $$;

/** Reservar um nome ou @ (só a coordenação). O mesmo nome por outra grafia ("Lul4", "LULA") não duplica. Registrado. */
create or replace function public.rede_p4_reservado_salvar(p_nome text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_rotulo text := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')); v_chave text; v_id bigint;
begin
  perform interno.alumia_porta();
  perform interno.eu();
  if not interno.alumia_coordenacao() then perform interno.erro('sem_permissao'); end if;
  v_rotulo := btrim(v_rotulo, ' @');
  v_chave := interno.rede_p4_chave(v_rotulo);
  if char_length(v_rotulo) not between 3 and 80 or char_length(v_chave) < 3 then perform interno.erro('invalido:nome'); end if;
  insert into rede_p4_nomes_reservados (rotulo, chave) values (v_rotulo, v_chave) on conflict (chave) do nothing returning id into v_id;
  if v_id is null then select id into v_id from rede_p4_nomes_reservados where chave = v_chave; end if;
  perform interno.registrar('alumia_p4_reservar', v_id::text, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'nome', (select rotulo from rede_p4_nomes_reservados where id = v_id));
end $$;

/** Tirar um nome da lista (só a coordenação). Registrado. */
create or replace function public.rede_p4_reservado_tirar(p_id bigint) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.eu();
  if not interno.alumia_coordenacao() then perform interno.erro('sem_permissao'); end if;
  delete from rede_p4_nomes_reservados where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('alumia_p4_reservado_tirar', p_id::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

-- ── 3. O selo de verificado para pessoas ──────────────────────────────────────────────────────────────────────────────────

/** Pedir o selo (pessoa pública ou educadora). Só o tipo e o canal oficial pelo qual a coordenação confere. Um pedido por vez. */
create or replace function public.rede_p4_selo_pedir(p_tipo text, p_canal text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_selo_exige();
  perform interno.rede3_perfil_exige_membro(v);
  if exists (select 1 from rede_orgs where perfil = v) or coalesce(p_tipo, '') = 'organizacao' then perform interno.erro('usar_selo_org'); end if;
  if coalesce(p_tipo, '') not in ('pessoa_publica', 'educadora') then perform interno.erro('invalido:tipo'); end if;
  if coalesce(p_canal, '') not in ('email_institucional', 'perfil_oficial', 'gabinete') then perform interno.erro('invalido:canal'); end if;
  perform interno.limite('alumia_p4_selo', 3, 1440);
  if exists (select 1 from rede_p4_selos where perfil = v) then perform interno.erro('ja_verificada'); end if;
  if exists (select 1 from rede_p4_selo_pedidos where perfil = v) then perform interno.erro('ja_pedido'); end if;
  insert into rede_p4_selo_pedidos (perfil, tipo, canal) values (v, p_tipo, p_canal);
  return jsonb_build_object('situacao', 'esperando');
end $$;

/** Desistir do pedido que ainda espera. */
create or replace function public.rede_p4_selo_desistir() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  delete from rede_p4_selo_pedidos where perfil = v;
  return jsonb_build_object('ok', true);
end $$;

/** O meu selo, o meu pedido e as minhas duas chaves de contagem (para a tela de editar o perfil). Desligado: só {ligado: false}. */
create or replace function public.rede_p4_meu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.rede_p4_selo_ligado() then return jsonb_build_object('ligado', false); end if;
  return jsonb_build_object(
    'ligado', true,
    'org', exists (select 1 from rede_orgs where perfil = v),
    'selo', (select jsonb_build_object('tipo', s.tipo, 'desde', s.dado_em::date) from rede_p4_selos s where s.perfil = v),
    'pedido', (select jsonb_build_object('tipo', q.tipo, 'canal', q.canal, 'desde', q.criado_em::date) from rede_p4_selo_pedidos q where q.perfil = v),
    'seguidores', coalesce((select c.seguidores from rede_p4_contagens c where c.perfil = v), false),
    'apoios', coalesce((select c.apoios from rede_p4_contagens c where c.perfil = v), false));
end $$;

/** A fila do selo (só a coordenação): codinome, @, tipo e canal. Nenhum documento, porque nenhum é guardado. */
create or replace function public.rede_p4_selo_fila() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.alumia_porta();
  perform interno.eu();
  if not interno.alumia_coordenacao() then perform interno.erro('sem_permissao'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'codinome', f.rede_codinome, 'handle', f.rede_handle, 'tipo', q.tipo, 'canal', q.canal,
                                        'criadoEm', q.criado_em::date) order by q.criado_em)
    from (select * from rede_p4_selo_pedidos order by criado_em limit 100) q join perfis f on f.id = q.perfil), '[]'::jsonb);
end $$;

/**
 * Dar ou recusar o selo (só a coordenação; recusar pede motivo de 10 letras). Dando, `p_reservado` liga um nome reservado a esta
 * pessoa (ela passa a poder usá-lo). O pedido some; a decisão fica no registro só de inserção; a pessoa recebe o aviso.
 */
create or replace function public.rede_p4_selo_decidir(p_id uuid, p_aceitar boolean, p_motivo text, p_reservado bigint default null) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; q rede_p4_selo_pedidos; v_motivo text := left(btrim(coalesce(p_motivo, '')), 500); v_aceitar boolean := coalesce(p_aceitar, false);
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.alumia_coordenacao() then perform interno.erro('sem_permissao'); end if;
  select * into q from rede_p4_selo_pedidos where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not v_aceitar and char_length(v_motivo) < 10 then perform interno.erro('invalido:motivo'); end if;
  if v_aceitar then
    insert into rede_p4_selos (perfil, tipo) values (q.perfil, q.tipo) on conflict (perfil) do update set tipo = excluded.tipo, dado_em = now();
    if p_reservado is not null then
      update rede_p4_nomes_reservados set dono = q.perfil where id = p_reservado;
      if not found then perform interno.erro('nao_encontrado'); end if;
    end if;
  end if;
  insert into rede_p4_selo_registro (alvo, acao, tipo, motivo, por) values (q.perfil, case when v_aceitar then 'dado' else 'recusado' end, q.tipo, v_motivo, v);
  delete from rede_p4_selo_pedidos where id = q.id;
  perform interno.avisar_em(q.perfil, case when v_aceitar then 'Seu perfil recebeu o selo de verificado da Alumia.'
    else format('O pedido do selo de verificado não foi aceito: %s', v_motivo) end, 'rede');
  perform interno.registrar(case when v_aceitar then 'alumia_p4_selo_dar' else 'alumia_p4_selo_recusar' end, q.perfil::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end $$;

/** Tirar o selo de uma pessoa (só a coordenação, com motivo). O nome reservado ligado a ela volta a ficar bloqueado. Registrado. */
create or replace function public.rede_p4_selo_tirar(p_handle text, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid; v_alvo uuid; v_tipo text; v_motivo text := left(btrim(coalesce(p_motivo, '')), 500);
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.alumia_coordenacao() then perform interno.erro('sem_permissao'); end if;
  if char_length(v_motivo) < 10 then perform interno.erro('invalido:motivo'); end if;
  select id into v_alvo from perfis where rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'));
  delete from rede_p4_selos where perfil = v_alvo returning tipo into v_tipo;
  if v_tipo is null then perform interno.erro('nao_encontrado'); end if;
  update rede_p4_nomes_reservados set dono = null where dono = v_alvo;
  insert into rede_p4_selo_registro (alvo, acao, tipo, motivo, por) values (v_alvo, 'tirado', v_tipo, v_motivo, v);
  perform interno.avisar_em(v_alvo, format('O selo de verificado do seu perfil foi retirado: %s', v_motivo), 'rede');
  perform interno.registrar('alumia_p4_selo_tirar', v_alvo::text, jsonb_build_object('motivo', v_motivo));
  return jsonb_build_object('ok', true);
end $$;

/** O perfil `p_handle` se vê agora? A mesma regra de rede_perfil_de: invisível, suspenso ou bloqueio = não. */
create or replace function interno.rede_p4_perfil_visivel(p_handle text, p_quem uuid) returns uuid language sql stable security definer set search_path = interno, pg_temp as $$
  select f.id from perfis f
  where f.rede_handle = lower(btrim(coalesce(p_handle, ''), ' @'))
    and (f.id = p_quem or not (f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso or interno.rede_bloqueado(p_quem, f.id)))
$$;

/**
 * O selo no perfil de alguém: tipo, desde quando e quem verificou (sempre "coordenação", nunca o nome de quem decidiu). O selo das
 * organizações (rede_orgs) sai do mesmo jeito, com tipo "organizacao". Sem selo, desligado ou perfil que não se vê: nulo.
 */
create or replace function public.rede_p4_selo_de(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.rede_p4_selo_ligado() then return null; end if;
  v_id := interno.rede_p4_perfil_visivel(p_handle, v);
  if v_id is null then return null; end if;
  return coalesce(
    (select jsonb_build_object('tipo', s.tipo, 'desde', s.dado_em::date, 'por', 'coordenacao') from rede_p4_selos s where s.perfil = v_id),
    (select jsonb_build_object('tipo', 'organizacao', 'desde', o.verificada_em::date, 'por', 'coordenacao') from rede_orgs o where o.perfil = v_id and o.verificada_em is not null));
end $$;

-- ── 4. As contagens públicas por escolha ──────────────────────────────────────────────────────────────────────────────────

/** As duas chaves (desligadas por padrão). As duas desligadas apagam a linha. */
create or replace function public.rede_p4_contagens_salvar(p_seguidores boolean, p_apoios boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  perform interno.rede_p4_selo_exige();
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_p4_contagens', 30, 60);
  if coalesce(p_seguidores, false) or coalesce(p_apoios, false) then
    insert into rede_p4_contagens (perfil, seguidores, apoios) values (v, coalesce(p_seguidores, false), coalesce(p_apoios, false))
      on conflict (perfil) do update set seguidores = excluded.seguidores, apoios = excluded.apoios, em = now();
  else
    delete from rede_p4_contagens where perfil = v;
  end if;
  return jsonb_build_object('seguidores', coalesce(p_seguidores, false), 'apoios', coalesce(p_apoios, false));
end $$;

/** Um total publicado: o número a partir de 3; abaixo, nulo. */
create or replace function interno.rede_p4_piso(p_n bigint) returns integer language sql immutable as $$
  select case when p_n >= 3 then p_n::integer end
$$;

/**
 * Quantas pessoas seguem `p_handle`, se a pessoa escolheu mostrar: {mostra: true, total: n ou nulo (menos de 3)}. Conta no marco
 * de 15 minutos. Sem a escolha, desligado ou perfil que não se vê: {mostra: false}, sem número. Nunca a lista.
 */
create or replace function public.rede_p4_seguidores_de(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid; v_id uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.rede_p4_selo_ligado() then return jsonb_build_object('mostra', false); end if;
  v_id := interno.rede_p4_perfil_visivel(p_handle, v);
  if v_id is null or not coalesce((select c.seguidores from rede_p4_contagens c where c.perfil = v_id), false) then
    return jsonb_build_object('mostra', false);
  end if;
  return jsonb_build_object('mostra', true, 'total', interno.rede_p4_piso(
    (select count(*) from rede_seguindo s where s.segue = v_id and not s.pendente and s.criado_em <= interno.rede_contagem_marco())));
end $$;

/**
 * Os apoios publicados dos posts pedidos (até 100), só dos que quem chama vê e cuja autora escolheu mostrar: {post: n ou nulo}.
 * Post fora da resposta = sem número público. Os posts de quem chama ficam de fora (ela já vê o total pelo cartão).
 */
create or replace function public.rede_p4_apoios_de(p_posts uuid[]) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid;
begin
  perform interno.alumia_porta();
  v := interno.eu();
  if not interno.rede_p4_selo_ligado() then return '{}'::jsonb; end if;
  if cardinality(coalesce(p_posts, '{}')) > 100 then perform interno.erro('invalido:posts'); end if;
  return coalesce((
    select jsonb_object_agg(p.id::text, to_jsonb(interno.rede_p4_piso(
      (select count(*) from (select r.usuario from rede_reacoes r where r.post = p.id and r.tipo = 'apoio' and r.criado_em <= interno.rede_contagem_marco()
                             union select a.usuario from rede_apoios a where a.post = p.id) z))))
    from rede_posts p join rede_p4_contagens c on c.perfil = p.autor and c.apoios
    where p.id = any (p_posts) and p.autor <> v and p.apagado_em is null and interno.rede_ve(p, v)), '{}'::jsonb);
end $$;

-- ── 5. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.rede_p4_selo_ligado(), interno.rede_p4_selo_exige(), interno.rede_p4_so_insercao(), interno.rede_p4_chave(text, boolean),
  interno.rede_p4_chaves(text), interno.rede_p4_parecido(text[], text), interno.rede_p4_nome_reservado_gatilho(), interno.rede_p4_perfil_visivel(text, uuid),
  interno.rede_p4_piso(bigint) from public;
revoke all on function public.rede_p4_reservados(), public.rede_p4_reservado_salvar(text), public.rede_p4_reservado_tirar(bigint),
  public.rede_p4_selo_pedir(text, text), public.rede_p4_selo_desistir(), public.rede_p4_meu(), public.rede_p4_selo_fila(),
  public.rede_p4_selo_decidir(uuid, boolean, text, bigint), public.rede_p4_selo_tirar(text, text), public.rede_p4_selo_de(text),
  public.rede_p4_contagens_salvar(boolean, boolean), public.rede_p4_seguidores_de(text), public.rede_p4_apoios_de(uuid[]) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.rede_p4_reservados(), public.rede_p4_reservado_salvar(text), public.rede_p4_reservado_tirar(bigint),
      public.rede_p4_selo_pedir(text, text), public.rede_p4_selo_desistir(), public.rede_p4_meu(), public.rede_p4_selo_fila(),
      public.rede_p4_selo_decidir(uuid, boolean, text, bigint), public.rede_p4_selo_tirar(text, text), public.rede_p4_selo_de(text),
      public.rede_p4_contagens_salvar(boolean, boolean), public.rede_p4_seguidores_de(text), public.rede_p4_apoios_de(uuid[]) to authenticated;
  end if;
end $$;

select interno.alumia_trancar();
