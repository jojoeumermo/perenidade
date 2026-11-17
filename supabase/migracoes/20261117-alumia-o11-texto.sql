-- ───────────────────────────── Alumia · Onda 11 · texto formatado e banco de questões (novembro de 2026) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Frente 11A (texto formatado e questões). O que entra:
--
--   1. A limpeza do texto formatado NO SERVIDOR (interno.rede_texto_limpo), a mesma regra que o aparelho usa (lib/rede/texto/limpar.ts;
--      o teste compara os dois): tira caracteres de controle e os que invertem a direção do texto; imagem só do próprio post
--      ("![descrição](imagem:1)" a "(imagem:4)", as imagens anexadas, que já passaram pela limpeza de metadados de app/api/rede/midia);
--      imagem de qualquer outro endereço vira só a descrição; link só para http(s) ou caminho do site, o resto vira "#". Um gatilho
--      aplica a regra ao texto e ao corpo de todo post, antes de qualquer outro gatilho (o nome começa por "a0"), ao publicar e ao
--      editar. HTML nunca é interpretado em tela nenhuma (o texto é desenhado só com os nós conhecidos, lib/rede/texto/desenhar.ts).
--   2. O banco de questões (L2-45): questões escritas por quem é membro, por matéria (lista fechada) e tema, com 2 a 5 alternativas,
--      a certa e a explicação. A LISTA nunca leva a certa nem a explicação: elas só saem de rede_questao_responder, depois que a
--      pessoa escolhe uma alternativa. Nada da resposta fica no banco (nem quem respondeu, nem o quê, nem se acertou): os acertos
--      ficam só no aparelho da pessoa (components/rede/estudo/questoes/regras.ts). Sem ranking, sem contagem de quem respondeu.
--      A questão não mostra quem escreveu (só "sua", para a própria pessoa). A denúncia de questão não guarda quem denunciou; a
--      mediação (interno.cuida) retira ou devolve.
--
-- Endereço de rede: nada daqui lê ou guarda (decisão de 13/11). Tabelas em interno, RLS ligada e sem política, nenhuma permissão
-- direta; acesso só pelas funções security definer abaixo (search_path fixo), que passam pela porta da Alumia (interno.alumia_trancar
-- no fim). Pode rodar mais de uma vez, sem apagar dado nenhum. Roda depois das migrações da Onda 10.
-- Teste: scripts/testar-alumia-o11-texto.mjs.

-- 1. A limpeza do texto formatado ─────────────────────────────────────────────────────────────────────────────────────────────

/** O texto como o banco guarda (a mesma regra de lib/rede/texto/limpar.ts, limparFonte). */
create or replace function interno.rede_texto_limpo(p text) returns text language sql immutable set search_path = interno, pg_temp as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(regexp_replace(coalesce(p, ''), '\r\n?', E'\n', 'g'),
               '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]', '', 'g'),
             '!\[([^]\n]{0,255})\]\((?!imagem:[1-4]\))(?:[^()\n]|\([^()\n]*\))*\)', '\1', 'g'),
           '\]\(\s*(?!https?://[^\s()/@\\]+(?:[/?#](?:[^\s()\\]|\([^\s()\\]*\))*)?\)|/(?![/\\])(?:[^\s()\\]|\([^\s()\\]*\))*\)|imagem:[1-4]\)|#\))(?:[^()\n]|\([^()\n]*\))*\)', '](#)', 'gi')
$$;

/** O gatilho: o texto e o corpo de todo post passam pela limpeza (publicar, editar, agendar, Fediverso de entrada). */
create or replace function interno.rede_texto_limpo_no_post() returns trigger language plpgsql set search_path = interno, pg_temp as $$
begin
  if new.texto is not null then new.texto := interno.rede_texto_limpo(new.texto); end if;
  if new.corpo is not null then new.corpo := interno.rede_texto_limpo(new.corpo); end if;
  return new;
end $$;

drop trigger if exists a0_rede_texto_limpo on interno.rede_posts;
create trigger a0_rede_texto_limpo before insert or update of texto, corpo on interno.rede_posts for each row execute function interno.rede_texto_limpo_no_post();

-- 2. Tabelas do banco de questões ──────────────────────────────────────────────────────────────────────────────────────────────

-- A questão. A pessoa que escreveu fica guardada só para poder editar e apagar a própria (nenhuma função a mostra a outra pessoa).
create table if not exists interno.rede_questoes (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references interno.perfis (id) on delete cascade,
  materia text not null check (materia in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues', 'literatura', 'redacao', 'ingles',
    'espanhol', 'artes', 'historia', 'geografia', 'filosofia', 'sociologia', 'economia-politica', 'programacao', 'outras')),
  tema text not null check (char_length(tema) between 2 and 60),
  enunciado text not null check (char_length(enunciado) between 10 and 4000),
  alternativas jsonb not null check (jsonb_typeof(alternativas) = 'array' and jsonb_array_length(alternativas) between 2 and 5),
  certa smallint not null check (certa between 0 and 4),
  explicacao text not null check (char_length(explicacao) between 10 and 4000),
  retirada_em timestamptz,
  criado_em timestamptz not null default now(),
  mudou_em timestamptz not null default now(),
  check (certa < jsonb_array_length(alternativas))
);
create index if not exists rede_questoes_materia on interno.rede_questoes (materia, criado_em desc, id desc) where retirada_em is null;
create index if not exists rede_questoes_autor on interno.rede_questoes (autor, criado_em desc);

-- A denúncia de uma questão: só o motivo e quando. Não guarda quem denunciou.
create table if not exists interno.rede_questoes_denuncias (
  id uuid primary key default gen_random_uuid(),
  questao uuid not null references interno.rede_questoes (id) on delete cascade,
  motivo text not null check (motivo in ('errada', 'ofensiva', 'dado_pessoal', 'spam', 'outro')),
  criado_em timestamptz not null default now()
);
create index if not exists rede_questoes_denuncias_questao on interno.rede_questoes_denuncias (questao);

alter table interno.rede_questoes enable row level security;
alter table interno.rede_questoes_denuncias enable row level security;

-- 3. Peças internas ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A questão como a lista entrega: SEM a certa e sem a explicação. "minha" só diz se é de quem pergunta. */
create or replace function interno.rede_questao_json(q interno.rede_questoes, p_quem uuid) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', q.id, 'materia', q.materia, 'tema', q.tema, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
                            'minha', q.autor = p_quem, 'criado_em', q.criado_em, 'editada', q.mudou_em > q.criado_em + interval '1 minute')
$$;

/** A questão visível (não retirada) pelo id; a retirada só a própria autora vê. Senão, "nao_encontrado". */
create or replace function interno.rede_questao_ver(p_id uuid, p_quem uuid) returns interno.rede_questoes language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare q rede_questoes;
begin
  select * into q from rede_questoes where id = p_id;
  if not found or (q.retirada_em is not null and q.autor is distinct from p_quem) then perform interno.erro('nao_encontrado'); end if;
  return q;
end $$;

/** Quem lê e escreve questões: membro da Alumia (a porta e interno.rede2_membro). */
create or replace function interno.rede_questoes_quem() returns uuid language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  return v;
end $$;

/** Um campo de texto formatado: tamanho, limpeza do servidor e nada de dado pessoal (CPF, telefone, e-mail, endereço com número). */
create or replace function interno.rede_questao_campo(p_valor text, p_campo text, p_min integer, p_max integer) returns text language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v text := interno.rede_texto_limpo(interno.txt(p_valor, p_campo, p_min, p_max));
begin
  if char_length(btrim(v)) < p_min then perform interno.erro('invalido:' || p_campo); end if;
  if interno.rede3_pub_dado_pessoal(v) then perform interno.erro('dado_pessoal'); end if;
  return v;
end $$;

-- 4. Ler ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** As matérias, cada uma com quantas questões tem (número de questões, nunca de pessoas), e se quem pergunta é da mediação. */
create or replace function public.rede_questoes_materias() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  return jsonb_build_object(
    'materias', coalesce((select jsonb_agg(jsonb_build_object('materia', materia, 'questoes', n) order by materia)
                          from (select materia, count(*)::int as n from rede_questoes where retirada_em is null group by materia) x), '[]'::jsonb),
    'minhas', (select count(*)::int from rede_questoes where autor = v),
    'modera', interno.cuida());
end $$;

/** Os temas de uma matéria (o nome do tema como foi escrito pela primeira vez; igual sem maiúscula e sem acento conta junto). */
create or replace function public.rede_questoes_temas(p_materia text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  return jsonb_build_object('materia', p_materia, 'temas', coalesce((
    select jsonb_agg(jsonb_build_object('tema', tema, 'questoes', n) order by tema)
    from (select (array_agg(tema order by criado_em))[1] as tema, count(*)::int as n
          from rede_questoes where materia = p_materia and retirada_em is null group by interno.normal(tema)) x), '[]'::jsonb));
end $$;

/**
 * As questões de uma matéria (e, se pedido, de um tema), das mais novas para as mais velhas: a regra é só essa, escrita e igual para
 * todo mundo. Página de até 30; o cursor é "data|id" da última. Nunca leva a certa nem a explicação.
 */
create or replace function public.rede_questoes(p_materia text, p_tema text default null, p_cursor text default null, p_limite integer default 20) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.rede_questoes_quem();
  v_lim integer := least(greatest(coalesce(p_limite, 20), 1), 30);
  v_data timestamptz; v_id uuid; v_itens jsonb; v_ultimo rede_questoes; v_n integer;
begin
  if nullif(p_cursor, '') is not null then
    begin
      v_data := split_part(p_cursor, '|', 1)::timestamptz;
      v_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then perform interno.erro('invalido:cursor');
    end;
  end if;
  select coalesce(jsonb_agg(interno.rede_questao_json(q, v) order by q.criado_em desc, q.id desc), '[]'::jsonb), count(*)::int
    into v_itens, v_n
  from rede_questoes q
  where q.id in (
    select x.id from rede_questoes x
    where x.materia = p_materia and x.retirada_em is null
      and (nullif(btrim(coalesce(p_tema, '')), '') is null or interno.normal(x.tema) = interno.normal(p_tema))
      and (v_data is null or (x.criado_em, x.id) < (v_data, v_id))
    order by x.criado_em desc, x.id desc
    limit v_lim + 1);
  if v_n > v_lim then
    v_itens := v_itens - v_lim;
    select * into v_ultimo from rede_questoes where id = (v_itens -> (v_lim - 1) ->> 'id')::uuid;
    return jsonb_build_object('itens', v_itens, 'proximo', to_char(v_ultimo.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || v_ultimo.id);
  end if;
  return jsonb_build_object('itens', v_itens, 'proximo', null);
end $$;

/** Uma questão (para o link direto). Sem a certa e sem a explicação. */
create or replace function public.rede_questao(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  return interno.rede_questao_json(interno.rede_questao_ver(p_id, v), v);
end $$;

/**
 * Responder: devolve se acertou, a certa e a explicação. NÃO guarda nada (nem quem respondeu, nem o quê): o acerto fica só no
 * aparelho. O limite de chamadas é o freio contra robô (uma janela que some sozinha, sem o conteúdo da resposta).
 */
create or replace function public.rede_questao_responder(p_id uuid, p_escolha integer) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem(); q rede_questoes;
begin
  q := interno.rede_questao_ver(p_id, v);
  if p_escolha is null or p_escolha < 0 or p_escolha >= jsonb_array_length(q.alternativas) then perform interno.erro('invalido:escolha'); end if;
  perform interno.limite('alumia_questao_responder', 600, 60);
  return jsonb_build_object('id', q.id, 'acertou', p_escolha = q.certa, 'certa', q.certa, 'explicacao', q.explicacao);
end $$;

/** As questões da própria pessoa, com a certa e a explicação (para editar). Inclui as retiradas pela mediação, marcadas. */
create or replace function public.rede_questoes_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(interno.rede_questao_json(q, v) || jsonb_build_object('certa', q.certa, 'explicacao', q.explicacao, 'retirada', q.retirada_em is not null)
                     order by q.criado_em desc)
    from rede_questoes q where q.autor = v), '[]'::jsonb));
end $$;

-- 5. Escrever ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cria (p_id nulo) ou edita a própria questão. Cada campo passa pela limpeza do servidor e pela recusa de dado pessoal. Até 200
 * questões por pessoa e 20 por hora. Editar não devolve uma questão retirada pela mediação ao banco.
 */
create or replace function public.rede_questao_salvar(p_id uuid, p_materia text, p_tema text, p_enunciado text, p_alternativas jsonb, p_certa integer, p_explicacao text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.rede_questoes_quem();
  v_tema text; v_enunciado text; v_explicacao text; v_alts jsonb := '[]'::jsonb; a jsonb; v_id uuid; q rede_questoes;
begin
  if p_materia is null or p_materia not in ('matematica', 'fisica', 'quimica', 'biologia', 'portugues', 'literatura', 'redacao', 'ingles',
    'espanhol', 'artes', 'historia', 'geografia', 'filosofia', 'sociologia', 'economia-politica', 'programacao', 'outras') then
    perform interno.erro('invalido:materia');
  end if;
  v_tema := interno.txt(regexp_replace(coalesce(p_tema, ''), '\s+', ' ', 'g'), 'tema', 2, 60);
  if interno.rede3_pub_dado_pessoal(v_tema) then perform interno.erro('dado_pessoal'); end if;
  v_enunciado := interno.rede_questao_campo(p_enunciado, 'enunciado', 10, 4000);
  v_explicacao := interno.rede_questao_campo(p_explicacao, 'explicacao', 10, 4000);
  if p_alternativas is null or jsonb_typeof(p_alternativas) <> 'array' or jsonb_array_length(p_alternativas) not between 2 and 5 then
    perform interno.erro('invalido:alternativas');
  end if;
  for a in select x from jsonb_array_elements(p_alternativas) x loop
    if jsonb_typeof(a) <> 'string' then perform interno.erro('invalido:alternativas'); end if;
    v_alts := v_alts || to_jsonb(interno.rede_questao_campo(a #>> '{}', 'alternativa', 1, 500));
  end loop;
  if (select count(distinct interno.normal(x)) from jsonb_array_elements_text(v_alts) x) < jsonb_array_length(v_alts) then
    perform interno.erro('invalido:repetida');
  end if;
  if p_certa is null or p_certa < 0 or p_certa >= jsonb_array_length(v_alts) then perform interno.erro('invalido:certa'); end if;
  perform interno.limite('alumia_questao_salvar', 20, 60);
  if p_id is null then
    if (select count(*) from rede_questoes where autor = v) >= 200 then perform interno.erro('invalido:muitas'); end if;
    insert into rede_questoes (autor, materia, tema, enunciado, alternativas, certa, explicacao)
      values (v, p_materia, v_tema, v_enunciado, v_alts, p_certa, v_explicacao) returning id into v_id;
    return jsonb_build_object('id', v_id, 'criada', true);
  end if;
  select * into q from rede_questoes where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  update rede_questoes set materia = p_materia, tema = v_tema, enunciado = v_enunciado, alternativas = v_alts, certa = p_certa,
    explicacao = v_explicacao, mudou_em = now() where id = q.id;
  return jsonb_build_object('id', q.id, 'criada', false);
end $$;

/** Apaga a própria questão (some de vez, com as denúncias dela). */
create or replace function public.rede_questao_apagar(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  delete from rede_questoes where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('apagada', true);
end $$;

-- 6. Denunciar e mediar ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Denuncia uma questão (gabarito errado, ofensa, dado pessoal, propaganda). Não guarda quem denunciou. */
create or replace function public.rede_questao_denunciar(p_id uuid, p_motivo text) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem(); q rede_questoes;
begin
  q := interno.rede_questao_ver(p_id, v);
  if p_motivo is null or p_motivo not in ('errada', 'ofensiva', 'dado_pessoal', 'spam', 'outro') then perform interno.erro('invalido:motivo'); end if;
  if q.autor = v then perform interno.erro('invalido:propria'); end if;
  perform interno.limite('alumia_questao_denunciar', 10, 60);
  insert into rede_questoes_denuncias (questao, motivo) values (q.id, p_motivo);
  return jsonb_build_object('denunciada', true);
end $$;

/** Para a mediação: as questões denunciadas (as mais denunciadas primeiro), com a certa e a explicação, sem quem escreveu nem quem denunciou. */
create or replace function public.rede_questoes_denunciadas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('itens', coalesce((
    select jsonb_agg(interno.rede_questao_json(q, v) || jsonb_build_object('certa', q.certa, 'explicacao', q.explicacao, 'retirada', q.retirada_em is not null,
                       'denuncias', d.n, 'motivos', d.motivos) order by d.n desc, d.ultima desc)
    from (select questao, count(*)::int as n, max(criado_em) as ultima, jsonb_agg(distinct motivo) as motivos from rede_questoes_denuncias group by questao) d
    join rede_questoes q on q.id = d.questao), '[]'::jsonb));
end $$;

/** A mediação retira (p_retirar) ou devolve a questão; as denúncias dela saem da fila nos dois casos. */
create or replace function public.rede_questao_mediar(p_id uuid, p_retirar boolean) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.rede_questoes_quem();
begin
  if not interno.cuida() then perform interno.erro('sem_permissao'); end if;
  update rede_questoes set retirada_em = case when coalesce(p_retirar, true) then coalesce(retirada_em, now()) end where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  delete from rede_questoes_denuncias where questao = p_id;
  perform interno.registrar(case when coalesce(p_retirar, true) then 'alumia_questao_retirada' else 'alumia_questao_devolvida' end, p_id::text);
  return jsonb_build_object('id', p_id, 'retirada', coalesce(p_retirar, true));
end $$;

-- 7. Permissões ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'interno.rede_texto_limpo(text)', 'interno.rede_texto_limpo_no_post()',
    'interno.rede_questao_json(interno.rede_questoes, uuid)', 'interno.rede_questao_ver(uuid, uuid)', 'interno.rede_questoes_quem()',
    'interno.rede_questao_campo(text, text, integer, integer)',
    'public.rede_questoes_materias()', 'public.rede_questoes_temas(text)', 'public.rede_questoes(text, text, text, integer)',
    'public.rede_questao(uuid)', 'public.rede_questao_responder(uuid, integer)', 'public.rede_questoes_minhas()',
    'public.rede_questao_salvar(uuid, text, text, text, jsonb, integer, text)', 'public.rede_questao_apagar(uuid)',
    'public.rede_questao_denunciar(uuid, text)', 'public.rede_questoes_denunciadas()', 'public.rede_questao_mediar(uuid, boolean)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    -- Tudo só com conta (questões são para quem é membro; nenhuma abre para visitante).
    foreach f in array array[
      'public.rede_questoes_materias()', 'public.rede_questoes_temas(text)', 'public.rede_questoes(text, text, text, integer)',
      'public.rede_questao(uuid)', 'public.rede_questao_responder(uuid, integer)', 'public.rede_questoes_minhas()',
      'public.rede_questao_salvar(uuid, text, text, text, jsonb, integer, text)', 'public.rede_questao_apagar(uuid)',
      'public.rede_questao_denunciar(uuid, text)', 'public.rede_questoes_denunciadas()', 'public.rede_questao_mediar(uuid, boolean)'] loop
      execute format('grant execute on function %s to authenticated, service_role', f);
    end loop;
  end if;
end $$;

-- 8. A porta em todas as funções novas de membro ─────────────────────────────────────────────────────────────────────────────
do $$
declare v jsonb := interno.alumia_trancar();
begin
  if jsonb_array_length(v -> 'abertas') > 0 then
    raise warning 'alumia_trancar: função sem porta: %', v -> 'abertas';
  end if;
end $$;
