-- ───────────────────────────── Alumia, onda 11: ponte com a Escola ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 11E. O que liga o estudo da Escola à Alumia:
--
--   1. O TÓPICO DA AULA ("discutir na Alumia"): o botão da aula leva à comunidade de estudo da disciplina. O tópico daquela aula é
--      o PRIMEIRO post ligado a ela na comunidade (rede_com_ligar_aula), entre os que quem pede pode ver. Sem tabela nova: quem
--      chega primeiro abre o tópico pelo compositor de sempre (com os filtros de sempre), e quem chega depois cai nele.
--   2. CONQUISTAS E MEDALHAS, só pelo que a própria pessoa fez: terminar uma trilha (ela marca), corrigir redações e dar
--      monitoria (as frentes da redação entre pares e da monitoria contam por interno.alumia_o11_feito). Cada medalha nasce
--      ESCONDIDA e só aparece no perfil se a pessoa ligar aquela medalha. Não há placar, ranking, lista de quem tem uma medalha,
--      nem comparação entre pessoas; o progresso (quantas correções) só a dona vê.
--   3. REPUTAÇÃO EM FAIXAS (troca por princípio do L1-16): no lugar de um número, uma faixa escrita, contada pelas conversas em que
--      quem perguntou marcou a resposta da pessoa como a que ajudou (ou a aceitou), nos últimos 12 meses. Padrão DESLIGADO: só
--      aparece no perfil se a pessoa ligar. A primeira faixa só começa em 3 (número só a partir de 3); a tela escreve a regra.
--   4. MURAL DE APROVADOS: a pessoa se inscreve por vontade própria, com o nome do perfil (e o link dele) ou com um codinome só
--      para o mural (sem link), curso e instituição opcionais e um recado curto. Sai quando quiser (a linha some na hora). Só a
--      data do dia entra, para a ordem de chegada; o mural mostra só o mês. A mediação tira inscrição abusiva, com registro.
--
-- Nenhum endereço de rede é guardado. Tudo em interno, com RLS e sem política; o acesso é só por funções security definer com
-- search_path fixo. As de membro passam pela porta da entrada (interno.alumia_trancar, no fim). As tabelas começam com
-- "alumia_" e apontam para o perfil com "on delete cascade": apagar a conta e "sair só da Alumia" (interno.alumia_md_sair_de_vez)
-- levam tudo junto.
--
-- Pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261116-alumia-onda10-fim.sql.
-- Teste: scripts/testar-alumia-o11-escola.mjs.

-- ── 1. Tabelas ────────────────────────────────────────────────────────────────────────────────────────────────────────────

-- As medalhas de cada pessoa. 'trilha' tem o alvo (a trilha); 'redacao' e 'monitoria' contam o progresso, que só a dona vê.
create table if not exists interno.alumia_conquistas (
  usuario uuid not null references interno.perfis (id) on delete cascade,
  medalha text not null check (medalha in ('trilha', 'redacao', 'monitoria')),
  alvo text not null default '' check (alvo = '' or alvo ~ '^[a-z0-9-]{2,80}$'),
  progresso integer not null default 0 check (progresso between 0 and 100000),
  mostrar boolean not null default false,
  primary key (usuario, medalha, alvo),
  check ((medalha = 'trilha') = (alvo <> ''))
);
alter table interno.alumia_conquistas enable row level security;

-- Quem ligou a faixa de reputação no perfil. Sem linha = desligada (o padrão); desligar apaga a linha.
create table if not exists interno.alumia_reputacao (
  usuario uuid primary key references interno.perfis (id) on delete cascade
);
alter table interno.alumia_reputacao enable row level security;

-- O mural de aprovados. Uma inscrição por pessoa; sair apaga a linha.
create table if not exists interno.alumia_mural (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null unique references interno.perfis (id) on delete cascade,
  como text not null check (como in ('perfil', 'codinome')),
  codinome text check (codinome is null or char_length(codinome) between 2 and 40),
  curso text check (curso is null or char_length(curso) between 2 and 80),
  instituicao text check (instituicao is null or char_length(instituicao) between 2 and 80),
  recado text check (recado is null or char_length(recado) between 2 and 140),
  entrou_em date not null default current_date,
  check ((como = 'codinome') = (codinome is not null))
);
create index if not exists alumia_mural_ordem on interno.alumia_mural (entrou_em desc, id desc);
alter table interno.alumia_mural enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table interno.alumia_conquistas, interno.alumia_reputacao, interno.alumia_mural from anon, authenticated;
  end if;
end $$;

-- ── 2. Regras fixas (as mesmas da tela: components/rede/estudo/conquistas/regras.ts) ─────────────────────────────────────

/** O nível de uma medalha pelo progresso: 0 (ainda não ganhou), 1, 2 ou 3. A trilha é sempre 1. */
create or replace function interno.alumia_o11_nivel(p_medalha text, p_progresso integer) returns integer language sql immutable as $$
  select case p_medalha
    when 'trilha' then 1
    when 'redacao' then case when p_progresso >= 30 then 3 when p_progresso >= 10 then 2 when p_progresso >= 1 then 1 else 0 end
    when 'monitoria' then case when p_progresso >= 20 then 3 when p_progresso >= 5 then 2 when p_progresso >= 1 then 1 else 0 end
    else 0
  end
$$;

/** A faixa de reputação pelo número de conversas em que a pessoa ajudou. Abaixo de 3, nenhuma (número só a partir de 3). */
create or replace function interno.alumia_o11_faixa(p_n integer) returns text language sql immutable as $$
  select case when p_n >= 30 then 'referencia' when p_n >= 10 then 'apoio' when p_n >= 3 then 'semente' end
$$;

/**
 * Em quantas conversas (posts de abertura, de outra pessoa, dos últimos 12 meses, não apagados) quem perguntou marcou a resposta
 * de `p` como a que ajudou ou a aceitou. Cada conversa conta uma vez. Só serve para a faixa: o número nunca sai.
 */
create or replace function interno.alumia_o11_ajudas(p uuid) returns integer language sql stable security definer set search_path = interno, pg_temp as $$
  select count(distinct x.raiz)::integer
  from (
    select a.raiz from rede_ajudou a join rede_posts r on r.id = a.resposta where r.autor = p and r.apagado_em is null
    union
    select q.id from rede_posts q join rede_posts r on r.id = q.aceita where r.autor = p and r.apagado_em is null
  ) x
  join rede_posts raiz on raiz.id = x.raiz
  where raiz.autor is distinct from p and raiz.apagado_em is null and raiz.resposta_a is null and raiz.criado_em > now() - interval '365 days'
$$;

/**
 * Conta um feito da própria pessoa para a medalha ('redacao': uma correção devolvida; 'monitoria': uma monitoria dada). Quem
 * chama é a função da frente dona do feito, de dentro do banco (ninguém de fora chama). Devolve o progresso novo.
 */
create or replace function interno.alumia_o11_feito(p_usuario uuid, p_medalha text) returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_n integer;
begin
  if p_usuario is null or p_medalha is null or p_medalha not in ('redacao', 'monitoria') then return null; end if;
  if not exists (select 1 from perfis where id = p_usuario) then return null; end if;
  insert into alumia_conquistas (usuario, medalha, alvo, progresso) values (p_usuario, p_medalha, '', 1)
  on conflict (usuario, medalha, alvo) do update set progresso = least(alumia_conquistas.progresso + 1, 100000)
  returning progresso into v_n;
  return v_n;
end $$;

/** As medalhas mostradas de `p_dono`, como a tela pinta (sem progresso). */
create or replace function interno.alumia_o11_mostradas(p_dono uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('medalha', c.medalha, 'alvo', c.alvo, 'nivel', interno.alumia_o11_nivel(c.medalha, c.progresso))
    order by c.medalha, c.alvo), '[]'::jsonb)
  from alumia_conquistas c
  where c.usuario = p_dono and c.mostrar and interno.alumia_o11_nivel(c.medalha, c.progresso) > 0
$$;

-- ── 3. As minhas conquistas ───────────────────────────────────────────────────────────────────────────────────────────────

/** As minhas medalhas (todas, com o progresso e se aparecem) e a minha faixa (o nome dela, e se está ligada). */
create or replace function public.alumia_conquistas_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object(
    'medalhas', coalesce((select jsonb_agg(jsonb_build_object('medalha', c.medalha, 'alvo', c.alvo, 'progresso', c.progresso,
        'nivel', interno.alumia_o11_nivel(c.medalha, c.progresso), 'mostrar', c.mostrar) order by c.medalha, c.alvo)
      from alumia_conquistas c where c.usuario = v), '[]'::jsonb),
    'faixa', jsonb_build_object('mostrar', exists (select 1 from alumia_reputacao r where r.usuario = v), 'faixa', interno.alumia_o11_faixa(interno.alumia_o11_ajudas(v))));
end $$;

/** Mostra ou esconde UMA medalha no perfil. Só a medalha já ganha aparece. */
create or replace function public.alumia_conquista_mostrar(p_medalha text, p_alvo text, p_mostrar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c alumia_conquistas;
begin
  perform interno.aberta('comunidade');
  if p_mostrar is null then perform interno.erro('invalido:mostrar'); end if;
  perform interno.limite('alumia_conquistas', 120, 10);
  select * into c from alumia_conquistas where usuario = v and medalha = p_medalha and alvo = coalesce(p_alvo, '');
  if not found then perform interno.erro('nao_encontrado'); end if;
  if p_mostrar then perform interno.rede3_perfil_exige_membro(v); end if;
  if p_mostrar and interno.alumia_o11_nivel(c.medalha, c.progresso) = 0 then perform interno.erro('invalido:medalha'); end if;
  update alumia_conquistas set mostrar = p_mostrar where usuario = v and medalha = c.medalha and alvo = c.alvo;
  return jsonb_build_object('mostrar', p_mostrar);
end $$;

/**
 * Marca (p_ligar) ou desmarca uma trilha terminada. A pessoa marca: o servidor não confere o estudo, que mora no aparelho. Nasce
 * escondida. Até 60 trilhas.
 */
create or replace function public.alumia_conquista_trilha(p_trilha text, p_ligar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_t text := lower(btrim(coalesce(p_trilha, '')));
begin
  perform interno.aberta('comunidade');
  if v_t !~ '^[a-z0-9-]{2,80}$' then perform interno.erro('invalido:trilha'); end if;
  if p_ligar is null then perform interno.erro('invalido:ligar'); end if;
  perform interno.limite('alumia_conquistas', 120, 10);
  if p_ligar then
    perform interno.rede3_perfil_exige_membro(v);
    if not exists (select 1 from alumia_conquistas where usuario = v and medalha = 'trilha' and alvo = v_t) then
      if (select count(*) from alumia_conquistas where usuario = v and medalha = 'trilha') >= 60 then perform interno.erro('invalido:muitas'); end if;
      insert into alumia_conquistas (usuario, medalha, alvo) values (v, 'trilha', v_t) on conflict do nothing;
    end if;
  else
    delete from alumia_conquistas where usuario = v and medalha = 'trilha' and alvo = v_t;
  end if;
  return jsonb_build_object('trilha', v_t, 'ligada', p_ligar);
end $$;

/** Apaga uma medalha minha de vez (com o progresso dela). */
create or replace function public.alumia_conquista_apagar(p_medalha text, p_alvo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('alumia_conquistas', 120, 10);
  delete from alumia_conquistas where usuario = v and medalha = p_medalha and alvo = coalesce(p_alvo, '');
  get diagnostics v_n = row_count;
  return jsonb_build_object('apagada', v_n > 0);
end $$;

/** Liga ou desliga a faixa de reputação no meu perfil. Desligar apaga a linha (o padrão é não ter). */
create or replace function public.alumia_reputacao_mostrar(p_mostrar boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if p_mostrar is null then perform interno.erro('invalido:mostrar'); end if;
  perform interno.limite('alumia_conquistas', 120, 10);
  if p_mostrar then
    perform interno.rede3_perfil_exige_membro(v);
    insert into alumia_reputacao (usuario) values (v) on conflict do nothing;
  else
    delete from alumia_reputacao where usuario = v;
  end if;
  return jsonb_build_object('mostrar', p_mostrar);
end $$;

/**
 * O que o perfil de `p_handle` mostra: as medalhas que a pessoa ligou (sem progresso) e a faixa, se ela ligou e se já tem uma.
 * Mesma porta do perfil (rede_perfil_de): invisível, suspensa ou com bloqueio entre as duas, não existe.
 */
create or replace function public.alumia_conquistas_de(p_handle text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); f perfis; v_handle text := lower(btrim(coalesce(p_handle, ''), ' @'));
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  select * into f from perfis where rede_handle = v_handle;
  if not found or (f.id <> v and (f.rede_modo = 'invisivel' or f.rede_invisivel or f.suspenso or interno.rede_bloqueado(v, f.id))) then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object(
    'medalhas', interno.alumia_o11_mostradas(f.id),
    'faixa', case when exists (select 1 from alumia_reputacao r where r.usuario = f.id) then interno.alumia_o11_faixa(interno.alumia_o11_ajudas(f.id)) end,
    'meu', f.id = v);
end $$;

-- ── 4. O tópico da aula ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * O tópico de uma aula numa comunidade: o primeiro post ligado à aula ('trilha/aula') que quem pede pode ver, ou nulo (ainda não
 * há tópico: quem chega abre). Mesma porta da comunidade (rede_comunidade): fechada não existe para quem não é dela.
 */
create or replace function public.alumia_aula_topico(p_comunidade text, p_aula text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); c rede_comunidades; v_id uuid; v_titulo text;
begin
  perform interno.aberta('comunidade');
  if v is not null and exists (select 1 from perfis where id = v and suspenso) then perform interno.erro('conta_suspensa'); end if;
  if coalesce(p_aula, '') !~ '^[a-z0-9-]{2,80}/[a-z0-9-]{2,80}$' then perform interno.erro('invalido:aula'); end if;
  perform interno.limite('rede2_ler', 600, 60);
  perform public.rede_comunidade(p_comunidade);
  c := interno.rede3_com_achar(p_comunidade);
  select p.id, coalesce(nullif(p.titulo, ''), left(p.texto, 140)) into v_id, v_titulo
  from rede_posts p
  where p.comunidade = c.slug and p.resposta_a is null and p.apagado_em is null
    and p.cita ->> 'tipo' = 'aula' and p.cita ->> 'caminho' = '/trilhas/' || p_aula
    and interno.rede_ve(p, v) and not interno.rede_silenciado(p, v)
  order by p.criado_em, p.id
  limit 1;
  return jsonb_build_object('id', v_id, 'titulo', v_titulo, 'comunidade', c.slug);
end $$;

-- ── 5. O mural de aprovados ───────────────────────────────────────────────────────────────────────────────────────────────

/** Um texto opcional do mural: nulo se vazio; sem telefone, documento nem e-mail; e passa pela triagem de abuso. */
create or replace function interno.alumia_o11_texto(p_valor text, p_campo text, p_min integer, p_max integer, p_autor uuid) returns text
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_t text := nullif(interno.txt(coalesce(p_valor, ''), p_campo, 0, p_max), '');
begin
  if v_t is null then return null; end if;
  if char_length(v_t) < p_min then perform interno.erro('invalido:' || p_campo); end if;
  if v_t ~ '\d{3}\.?\d{3}\.?\d{3}-?\d{2}' or v_t ~ '\(?\d{2}\)?\s?9\d{4}[-\s]?\d{4}' or v_t ~* '[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}' then perform interno.erro('dado_pessoal'); end if;
  if (interno.veredito(v_t, false, p_autor) ->> 'veredito') <> 'publicar' then perform interno.erro('invalido:' || p_campo); end if;
  return v_t;
end $$;

/** Uma inscrição como o mural mostra. O link do perfil só vai quando a pessoa escolheu o perfil e ele pode ser visto. */
create or replace function interno.alumia_o11_inscricao(m interno.alumia_mural, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object(
    'id', m.id,
    'nome', case when m.como = 'codinome' then m.codinome else interno.rede_nome(m.usuario) end,
    'handle', case when m.como = 'perfil' then f.rede_handle end,
    'como', m.como, 'curso', m.curso, 'instituicao', m.instituicao, 'recado', m.recado,
    'mes', to_char(m.entrou_em, 'YYYY-MM'),
    'minha', m.usuario = p_quem)
  from perfis f where f.id = m.usuario
$$;

/**
 * O mural, do mais novo para o mais antigo (só a ordem de chegada; nenhum outro critério). Some quem está suspenso, quem tem
 * bloqueio com quem lê e, na forma "perfil", quem deixou o perfil invisível. O cursor é só o id da última inscrição da página: o
 * dia de entrada fica no banco (o mural mostra só o mês), e quem pede de uma em uma não fica sabendo o dia de ninguém.
 */
create or replace function public.alumia_mural(p_cursor text default null, p_limite integer default 30) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_limite integer := least(greatest(coalesce(p_limite, 30), 1), 60); v_d date; v_id uuid; v_itens jsonb; v_n integer; v_ultimo jsonb;
begin
  perform interno.aberta('comunidade');
  perform interno.limite('rede2_ler', 600, 60);
  if nullif(p_cursor, '') is not null then
    begin
      v_id := p_cursor::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
    select m.entrou_em into v_d from alumia_mural m where m.id = v_id;
    if v_d is null then perform interno.erro('invalido:cursor'); end if;
  end if;
  select coalesce(jsonb_agg(interno.alumia_o11_inscricao(x, v) || jsonb_build_object('_c', x.id::text) order by x.entrou_em desc, x.id desc), '[]'::jsonb), count(*)::integer
  into v_itens, v_n
  from (
    select m.* from alumia_mural m join perfis f on f.id = m.usuario
    where not f.suspenso and not interno.rede_bloqueado(v, m.usuario)
      and (m.usuario = v or m.como = 'codinome' or not (f.rede_modo = 'invisivel' or f.rede_invisivel))
      and (v_d is null or (m.entrou_em, m.id) < (v_d, v_id))
    order by m.entrou_em desc, m.id desc
    limit v_limite
  ) x;
  v_ultimo := case when v_n = v_limite then v_itens -> (v_n - 1) end;
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(i - '_c') from jsonb_array_elements(v_itens) i), '[]'::jsonb),
    'proximo', v_ultimo ->> '_c');
end $$;

/** A minha inscrição no mural (para editar), ou nulo. */
create or replace function public.alumia_mural_meu() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m alumia_mural;
begin
  perform interno.aberta('comunidade');
  select * into m from alumia_mural where usuario = v;
  if not found then return null; end if;
  return jsonb_build_object('como', m.como, 'codinome', m.codinome, 'curso', m.curso, 'instituicao', m.instituicao, 'recado', m.recado,
    'mes', to_char(m.entrou_em, 'YYYY-MM'));
end $$;

/**
 * Entra no mural (ou troca a inscrição): {como: 'perfil' | 'codinome', codinome, curso, instituicao, recado}. Só os campos
 * conhecidos; codinome só na forma "codinome". Trocar não muda a data de entrada.
 */
create or replace function public.alumia_mural_entrar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_como text; v_cod text; v_curso text; v_inst text; v_recado text; m alumia_mural;
begin
  perform interno.aberta('comunidade');
  if p is null or jsonb_typeof(p) <> 'object' or exists (select 1 from jsonb_object_keys(p) k where k not in ('como', 'codinome', 'curso', 'instituicao', 'recado')) then
    perform interno.erro('invalido:inscricao');
  end if;
  perform interno.rede3_perfil_exige_membro(v);
  perform interno.limite('alumia_mural', 20, 60);
  v_como := p ->> 'como';
  if v_como is null or v_como not in ('perfil', 'codinome') then perform interno.erro('invalido:como'); end if;
  if v_como = 'codinome' then
    v_cod := interno.alumia_o11_texto(p ->> 'codinome', 'codinome', 2, 40, v);
    if v_cod is null then perform interno.erro('invalido:codinome'); end if;
  elsif nullif(btrim(coalesce(p ->> 'codinome', '')), '') is not null then
    perform interno.erro('invalido:codinome');
  end if;
  v_curso := interno.alumia_o11_texto(p ->> 'curso', 'curso', 2, 80, v);
  v_inst := interno.alumia_o11_texto(p ->> 'instituicao', 'instituicao', 2, 80, v);
  v_recado := interno.alumia_o11_texto(p ->> 'recado', 'recado', 2, 140, v);
  insert into alumia_mural (usuario, como, codinome, curso, instituicao, recado) values (v, v_como, v_cod, v_curso, v_inst, v_recado)
  on conflict (usuario) do update set como = excluded.como, codinome = excluded.codinome, curso = excluded.curso,
    instituicao = excluded.instituicao, recado = excluded.recado
  returning * into m;
  return interno.alumia_o11_inscricao(m, v);
end $$;

/** Sai do mural: a linha some na hora. */
create or replace function public.alumia_mural_sair() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_n integer;
begin
  perform interno.aberta('comunidade');
  delete from alumia_mural where usuario = v;
  get diagnostics v_n = row_count;
  return jsonb_build_object('saiu', v_n > 0);
end $$;

/** A mediação (ou a coordenação) tira uma inscrição abusiva, com o motivo no registro. A pessoa recebe um aviso. */
create or replace function public.alumia_mural_tirar(p_id uuid, p_motivo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m alumia_mural; v_motivo text;
begin
  perform interno.aberta('comunidade');
  if not (interno.coord() or interno.tem('mediacao')) then perform interno.erro('sem_permissao'); end if;
  v_motivo := interno.txt(p_motivo, 'motivo', 3, 300);
  delete from alumia_mural where id = p_id returning * into m;
  if m.id is null then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('alumia_mural_tirar', m.id::text, jsonb_build_object('motivo', v_motivo));
  insert into avisos (para, texto, categoria) values (m.usuario, 'A sua inscrição no mural de aprovados foi tirada pela mediação: ' || v_motivo, 'rede');
  return jsonb_build_object('tirada', true);
end $$;

-- ── 6. Permissões ─────────────────────────────────────────────────────────────────────────────────────────────────────────
revoke all on function interno.alumia_o11_nivel(text, integer), interno.alumia_o11_faixa(integer), interno.alumia_o11_ajudas(uuid),
  interno.alumia_o11_feito(uuid, text), interno.alumia_o11_mostradas(uuid), interno.alumia_o11_texto(text, text, integer, integer, uuid),
  interno.alumia_o11_inscricao(interno.alumia_mural, uuid) from public;
revoke all on function public.alumia_conquistas_minhas(), public.alumia_conquista_mostrar(text, text, boolean), public.alumia_conquista_trilha(text, boolean),
  public.alumia_conquista_apagar(text, text), public.alumia_reputacao_mostrar(boolean), public.alumia_conquistas_de(text),
  public.alumia_aula_topico(text, text), public.alumia_mural(text, integer), public.alumia_mural_meu(), public.alumia_mural_entrar(jsonb),
  public.alumia_mural_sair(), public.alumia_mural_tirar(uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_o11_nivel(text, integer), interno.alumia_o11_faixa(integer), interno.alumia_o11_ajudas(uuid),
      interno.alumia_o11_feito(uuid, text), interno.alumia_o11_mostradas(uuid), interno.alumia_o11_texto(text, text, integer, integer, uuid),
      interno.alumia_o11_inscricao(interno.alumia_mural, uuid) from anon, authenticated;
    revoke all on function public.alumia_conquistas_minhas(), public.alumia_conquista_mostrar(text, text, boolean), public.alumia_conquista_trilha(text, boolean),
      public.alumia_conquista_apagar(text, text), public.alumia_reputacao_mostrar(boolean), public.alumia_conquistas_de(text),
      public.alumia_mural(text, integer), public.alumia_mural_meu(), public.alumia_mural_entrar(jsonb),
      public.alumia_mural_sair(), public.alumia_mural_tirar(uuid, text) from anon;
    grant execute on function public.alumia_conquistas_minhas(), public.alumia_conquista_mostrar(text, text, boolean), public.alumia_conquista_trilha(text, boolean),
      public.alumia_conquista_apagar(text, text), public.alumia_reputacao_mostrar(boolean), public.alumia_conquistas_de(text),
      public.alumia_mural(text, integer), public.alumia_mural_meu(), public.alumia_mural_entrar(jsonb),
      public.alumia_mural_sair(), public.alumia_mural_tirar(uuid, text) to authenticated, service_role;
    -- O tópico da aula abre como a linha da aula (rede_com_aula_linha): a comunidade decide o que sai.
    grant execute on function public.alumia_aula_topico(text, text) to anon, authenticated, service_role;
  end if;
end $$;

-- ── 7. A porta em todas as funções novas ──────────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
