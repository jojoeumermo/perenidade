-- ───────────────────────────── Back-end novo, parte 2 (Etapa 8, pacote backend-2) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Ainda NÃO está no install.sql (a integração junta).
-- Texto do pacote, base legal e como ligar cada item: docs/backend-2.md.
--
-- Oito itens, cada um com função SQL, tela e teste:
--   1. Operação do site: pedir limpeza do cache, ver publicação e ver backup (o banco confere quem pode e segura o ritmo;
--      quem fala com a Vercel, o GitHub e o Cloudflare é a rota app/api/painel/operacao, com os tokens só no servidor).
--   2. Regras do Mural de Saúde ajustáveis: a coordenação só ACRESCENTA termos ao filtro e PAUSA categorias; nunca afrouxa o
--      que está em content/saude/regras.json (a publicidade de profissional de saúde segue as regras dos conselhos).
--   3. Aviso de vencimento do token do Instagram: guarda SÓ a data de vencimento, nunca o token.
--   4. Lacunas da disciplina no banco: o que falta cobrir em cada disciplina, por quem ensina.
--   5. Resultado das aulas para quem ensina: somas anônimas por aula (já existentes em contagens), escondendo o que tem
--      menos de 5 testes e mostrando a tendência.
--   6. Caixa de imprensa para o porta-voz: pedidos de jornalistas, com consentimento e prazo de guarda.
--   7. Prévia com dados de exemplo: telas novas mostradas com dados inventados e marcados como exemplo.
--   8. Resumo diário opcional por e-mail: só contagens, só para quem ligou, pela fila de e-mails de sempre.
--
-- Base legal do item 6 (Lei 13.709/2018, conferida no planalto.gov.br): art. 6º, I e III (finalidade e necessidade: só nome,
-- veículo, e-mail e o pedido), art. 7º, I (consentimento marcado no formulário) e arts. 15, I, e 16 (acabado o atendimento,
-- o dado é eliminado: 180 dias depois de respondido ou arquivado). Nada de telefone, documento nem rede social.
--
-- Nenhuma tabela no esquema public; acesso só pelas funções public.* (security definer, search_path = interno, pg_temp).
-- Nenhuma função interna é executável por anon nem por authenticated.

-- ───────────────────────────── Tabelas (esquema interno) ─────────────────────────────

create table if not exists interno.operacao_registro (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  quem uuid references interno.perfis (id) on delete set null,
  acao text not null check (acao in ('limpar_cache', 'ver_publicacao', 'ver_backup')),
  fase text not null check (fase in ('pedida', 'ok', 'falhou')),
  detalhe text not null default '' check (char_length(detalhe) <= 300)
);
create index if not exists operacao_registro_quando on interno.operacao_registro (acao, quando desc);

create table if not exists interno.saude_regras_extra (
  id boolean primary key default true check (id),
  grupos jsonb not null default '[]'::jsonb check (jsonb_typeof(grupos) = 'array'),
  categorias_pausadas text[] not null default '{}',
  por uuid references interno.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
insert into interno.saude_regras_extra (id) values (true) on conflict do nothing;

create table if not exists interno.disciplina_lacunas (
  id uuid primary key default gen_random_uuid(),
  disciplina text not null check (disciplina ~ '^[a-z0-9-]{2,40}$'),
  titulo text not null check (char_length(titulo) between 3 and 160),
  descricao text not null default '' check (char_length(descricao) <= 1500),
  aula text not null default '' check (char_length(aula) <= 120),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'coberta', 'descartada')),
  criado_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists disciplina_lacunas_disc on interno.disciplina_lacunas (disciplina, status);

create table if not exists interno.imprensa_pedidos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 100),
  veiculo text not null default '' check (char_length(veiculo) <= 100),
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and char_length(email) <= 200),
  assunto text not null check (char_length(assunto) between 3 and 150),
  mensagem text not null check (char_length(mensagem) between 10 and 3000),
  prazo date,
  status text not null default 'novo' check (status in ('novo', 'em_andamento', 'respondido', 'arquivado')),
  nota text not null default '' check (char_length(nota) <= 1000),
  responsavel uuid references interno.perfis (id) on delete set null,
  consentimento_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  apagar_em timestamptz
);
create index if not exists imprensa_pedidos_status on interno.imprensa_pedidos (status, criado_em desc);

create table if not exists interno.resumo_diario (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  ativo boolean not null default true,
  ultimo date
);

do $$
declare t text;
begin
  foreach t in array array['operacao_registro', 'saude_regras_extra', 'disciplina_lacunas', 'imprensa_pedidos', 'resumo_diario'] loop
    execute format('alter table interno.%I enable row level security', t);
    execute format('revoke all on interno.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on interno.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ───────────────────────────── Ajudas internas ─────────────────────────────

/** A pessoa (qualquer uma, não só quem chama) tem um destes papéis e não está suspensa? Para o resumo diário. */
create or replace function interno.backend2_papel_de(p_usuario uuid, p_papeis text[]) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = p_usuario and not f.suspenso and p.papel = any (p_papeis))
$$;
revoke all on function interno.backend2_papel_de(uuid, text[]) from public;

/** Quem lida com a imprensa: porta-voz, coordenação e vice-coordenação. */
create or replace function interno.imprensa_pode() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.coord() or interno.tem('porta_voz')
$$;
revoke all on function interno.imprensa_pode() from public;

/** Quem ensina esta disciplina: educação (e secundária) da disciplina, ou a curadoria e a coordenação. */
create or replace function interno.ensina(p_disciplina text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.curador() or interno.tem('educacao', p_disciplina)
$$;
revoke all on function interno.ensina(text) from public;

-- ───────────────────────────── 1. Operação do site ─────────────────────────────

/**
 * Antes de a rota falar com a Vercel, o GitHub ou o Cloudflare: só a coordenação, e a limpeza do cache no máximo 3 vezes por
 * hora (limpar tudo obriga a Vercel a refazer o site para os robôs). Anota o pedido.
 */
create or replace function public.operacao_pedir(p_acao text) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_acao not in ('limpar_cache', 'ver_publicacao', 'ver_backup') then perform interno.erro('invalido:acao'); end if;
  perform interno.limite('operacao_' || p_acao, case p_acao when 'limpar_cache' then 3 else 30 end, 60);
  insert into operacao_registro (quem, acao, fase) values (auth.uid(), p_acao, 'pedida');
  if p_acao = 'limpar_cache' then perform interno.registrar('operacao_limpar_cache', '', '{}'::jsonb); end if;
  if random() < 0.02 then delete from operacao_registro where quando < now() - interval '180 days'; end if;
  return true;
end $$;

/** Depois da chamada: o que deu (só uma frase curta, nunca token nem corpo de resposta). */
create or replace function public.operacao_resultado(p_acao text, p_ok boolean, p_detalhe text default '') returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_acao not in ('limpar_cache', 'ver_publicacao', 'ver_backup') then perform interno.erro('invalido:acao'); end if;
  insert into operacao_registro (quem, acao, fase, detalhe) values (auth.uid(), p_acao, case when coalesce(p_ok, false) then 'ok' else 'falhou' end, left(coalesce(p_detalhe, ''), 300));
  return true;
end $$;

/** O que a tela de operação mostra do banco: os últimos 20 registros (sem nome de ninguém) e a situação do token do Instagram. */
create or replace function public.operacao_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object(
    'registros', (select coalesce(jsonb_agg(jsonb_build_object('quando', r.quando, 'acao', r.acao, 'fase', r.fase, 'detalhe', r.detalhe) order by r.id desc), '[]'::jsonb)
                  from (select * from operacao_registro order by id desc limit 20) r),
    'ultima_limpeza', (select max(quando) from operacao_registro where acao = 'limpar_cache' and fase = 'ok'),
    'instagram', interno.instagram_token_estado());
end $$;

-- ───────────────────────────── 3. Aviso de vencimento do token do Instagram ─────────────────────────────

/** {definido, expira, dias, nivel}: nivel é ok (mais de 14 dias), aviso (14 ou menos), urgente (3 ou menos) ou vencido. */
create or replace function interno.instagram_token_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_expira date; v_dias integer;
begin
  select (valor ->> 'expira')::date into v_expira from configuracoes where chave = 'instagram_token';
  if v_expira is null then return jsonb_build_object('definido', false, 'nivel', 'indefinido'); end if;
  v_dias := v_expira - (now() at time zone 'America/Sao_Paulo')::date;
  return jsonb_build_object('definido', true, 'expira', v_expira, 'dias', v_dias,
    'nivel', case when v_dias < 0 then 'vencido' when v_dias <= 3 then 'urgente' when v_dias <= 14 then 'aviso' else 'ok' end);
end $$;
revoke all on function interno.instagram_token_estado() from public;

/** A coordenação e quem divulga leem a situação (nunca o token: ele só existe na Vercel). */
create or replace function public.instagram_token_situacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.divulga() then perform interno.erro('sem_permissao'); end if;
  return interno.instagram_token_estado();
end $$;

/** A coordenação anota até quando o token vale (a data que a Meta mostra ao gerá-lo). Entre hoje e 400 dias. */
create or replace function public.instagram_token_validade_salvar(p_expira date) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if p_expira is null or p_expira < v_hoje or p_expira > v_hoje + 400 then perform interno.erro('invalido:expira'); end if;
  insert into configuracoes (chave, valor) values ('instagram_token', jsonb_build_object('expira', p_expira, 'avisado', 999))
  on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar('instagram_token_validade', '', jsonb_build_object('expira', p_expira));
  return interno.instagram_token_estado();
end $$;

/**
 * Diária: quando faltam 14, 7, 3 ou 1 dia (ou venceu), manda UM e-mail à coordenação por faixa. "avisado" guarda a menor faixa
 * já avisada; ao anotar uma data nova, volta a valer tudo.
 */
create or replace function interno.instagram_token_vigiar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare e jsonb := interno.instagram_token_estado(); v_dias integer; v_faixa integer; v_ult integer;
begin
  if not coalesce((e ->> 'definido')::boolean, false) then return 0; end if;
  v_dias := (e ->> 'dias')::integer;
  v_faixa := case when v_dias < 0 then 0 when v_dias <= 1 then 1 when v_dias <= 3 then 3 when v_dias <= 7 then 7 when v_dias <= 14 then 14 else 999 end;
  if v_faixa = 999 then return 0; end if;
  select coalesce((valor ->> 'avisado')::integer, 999) into v_ult from configuracoes where chave = 'instagram_token';
  if v_faixa >= v_ult then return 0; end if;
  perform interno.email_lideranca('instagram_token', 'O token do Instagram ' || case when v_dias < 0 then 'venceu' else 'vence em ' || v_dias || ' dia(s)' end,
    'O token usado pelo estúdio de design para publicar no Instagram ' || case when v_dias < 0 then 'já venceu: as publicações agendadas vão falhar.' else 'vence em ' || v_dias || ' dia(s).' end ||
    E'\n\nGere um novo na Meta, troque INSTAGRAM_TOKEN na Vercel e anote a data nova em Painel, Operação do site. O passo a passo está em docs/ESTUDIO-INSTAGRAM.md.');
  update configuracoes set valor = valor || jsonb_build_object('avisado', v_faixa) where chave = 'instagram_token';
  return 1;
end $$;
revoke all on function interno.instagram_token_vigiar() from public;

-- ───────────────────────────── 2. Regras do Mural de Saúde ─────────────────────────────

/** O que a coordenação vê: as categorias do arquivo de regras (só nome, conselho e se está ligada) e os ajustes feitos no banco. */
create or replace function public.saude_regras_ajustes_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare x saude_regras_extra%rowtype; r jsonb := interno.saude_regras();
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  select * into x from saude_regras_extra where id;
  return jsonb_build_object(
    'termo_versao', r ->> 'termoVersao',
    'sobre_maximo', (r ->> 'sobreMaximo')::int,
    'grupos_do_arquivo', jsonb_array_length(coalesce(r -> 'bloqueio', '[]'::jsonb)),
    'categorias', (select coalesce(jsonb_agg(jsonb_build_object('id', c.key, 'conselho', c.value ->> 'conselho', 'ligada_no_arquivo', coalesce((c.value ->> 'ligada')::boolean, false),
                     'pausada', c.key = any (x.categorias_pausadas)) order by c.key), '[]'::jsonb) from jsonb_each(r -> 'categorias') c),
    'grupos', x.grupos, 'atualizado_em', x.atualizado_em);
end $$;

/**
 * Salva os ajustes: grupos de termos a mais no filtro ([{grupo, termos[], motivo, sugestao}]) e as categorias pausadas. Só aperta
 * a regra: não existe jeito de tirar um termo do arquivo nem de ligar uma categoria que o arquivo deixa desligada.
 */
create or replace function public.saude_regras_ajustes_salvar(p_grupos jsonb, p_pausadas text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare g jsonb; t text; v_grupos jsonb := '[]'::jsonb; v_termos text[]; v_pausadas text[] := '{}'; k text; r jsonb := interno.saude_regras();
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(coalesce(p_grupos, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_grupos, '[]'::jsonb)) > 30 then perform interno.erro('invalido:grupos'); end if;
  for g in select x from jsonb_array_elements(coalesce(p_grupos, '[]'::jsonb)) x loop
    if jsonb_typeof(g -> 'termos') <> 'array' or jsonb_array_length(g -> 'termos') not between 1 and 30 then perform interno.erro('invalido:termos'); end if;
    v_termos := '{}';
    for t in select jsonb_array_elements_text(g -> 'termos') loop
      t := btrim(t);
      if char_length(t) not between 2 and 60 then perform interno.erro('invalido:termos'); end if;
      v_termos := v_termos || t;
    end loop;
    v_grupos := v_grupos || jsonb_build_object('grupo', interno.txt(g ->> 'grupo', 'grupo', 2, 40), 'termos', to_jsonb(v_termos),
      'motivo', interno.txt(g ->> 'motivo', 'motivo', 5, 200), 'sugestao', interno.txt(coalesce(g ->> 'sugestao', ''), 'sugestao', 0, 200));
  end loop;
  foreach k in array coalesce(p_pausadas, '{}') loop
    if not (r -> 'categorias') ? k then perform interno.erro('invalido:categoria'); end if;
    v_pausadas := v_pausadas || k;
  end loop;
  update saude_regras_extra set grupos = v_grupos, categorias_pausadas = v_pausadas, por = auth.uid(), atualizado_em = now() where id;
  perform interno.registrar('saude_regras_ajustes', '', jsonb_build_object('grupos', jsonb_array_length(v_grupos), 'pausadas', to_jsonb(v_pausadas)));
  return public.saude_regras_ajustes_ver();
end $$;

-- O filtro e a chave de categoria passam a enxergar os ajustes. Só se o mural já existe neste banco; as duas funções ficam
-- "stable" (leem uma tabela). Ao juntar no install.sql, estas duas definições substituem as do bloco do Mural de Saúde.
do $$
begin
  if to_regprocedure('interno.saude_conferir(jsonb)') is not null and to_regprocedure('interno.saude_regras()') is not null then
    execute $f$
      create or replace function interno.saude_conferir(p_campos jsonb) returns jsonb language plpgsql stable set search_path = interno, pg_temp as $g$
      declare r jsonb := interno.saude_regras(); c record; e jsonb; g jsonb; t text; cru text; n1 text; n2 text; pad text; x jsonb;
      begin
        select coalesce(grupos, '[]'::jsonb) into x from saude_regras_extra where id;
        for c in select key, value from jsonb_each_text(coalesce(p_campos, '{}'::jsonb)) loop
          continue when coalesce(btrim(c.value), '') = '';
          cru := interno.saude_sem_acento(c.value);
          for e in select y from jsonb_array_elements(r -> 'padroesEspeciais') y loop
            if cru ~ (e ->> 'regex') then return jsonb_build_object('grupo', e ->> 'grupo', 'campo', c.key, 'motivo', e ->> 'motivo', 'sugestao', e ->> 'sugestao'); end if;
          end loop;
          n1 := interno.saude_normalizar(c.value, false);
          n2 := interno.saude_normalizar(c.value, true);
          for g in select y from jsonb_array_elements((r -> 'bloqueio') || coalesce(x, '[]'::jsonb)) y loop
            for t in select jsonb_array_elements_text(g -> 'termos') loop
              pad := interno.saude_padrao(t);
              if n1 ~ pad or n2 ~ pad then return jsonb_build_object('grupo', g ->> 'grupo', 'campo', c.key, 'motivo', g ->> 'motivo', 'sugestao', g ->> 'sugestao'); end if;
            end loop;
          end loop;
        end loop;
        return null;
      end $g$
    $f$;
    execute $f$
      create or replace function interno.saude_categoria_ligada(p_conselho text) returns boolean language sql stable set search_path = interno, pg_temp as $g$
        select coalesce((interno.saude_regras() -> 'categorias' -> interno.saude_categoria(p_conselho) ->> 'ligada')::boolean, false)
          and not coalesce(interno.saude_categoria(p_conselho) = any (select unnest(categorias_pausadas) from saude_regras_extra where id), false)
      $g$
    $f$;
  end if;
end $$;

-- ───────────────────────────── 4. Lacunas da disciplina ─────────────────────────────

create or replace function public.lacunas_listar(p_disciplina text default null) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_disc text := interno.disciplina_ok(nullif(btrim(coalesce(p_disciplina, '')), ''));
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if v_disc is not null and not interno.ensina(v_disc) then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'disciplina', l.disciplina, 'titulo', l.titulo, 'descricao', l.descricao, 'aula', l.aula,
            'prioridade', l.prioridade, 'status', l.status, 'atualizado_em', l.atualizado_em)
            order by (l.status in ('coberta', 'descartada')), case l.prioridade when 'alta' then 0 when 'media' then 1 else 2 end, l.atualizado_em desc), '[]'::jsonb)
          from (select * from disciplina_lacunas d
                where (v_disc is null or d.disciplina = v_disc)
                  and (interno.curador() or interno.tem('educacao', d.disciplina))
                order by d.atualizado_em desc limit 300) l);
end $$;

create or replace function public.lacunas_salvar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_prio text := coalesce(nullif(p ->> 'prioridade', ''), 'media');
  v_status text := coalesce(nullif(p ->> 'status', ''), 'aberta');
  v_antiga text;
begin
  if v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if not interno.ensina(v_disc) then perform interno.erro('sem_permissao'); end if;
  if v_prio not in ('baixa', 'media', 'alta') then perform interno.erro('invalido:prioridade'); end if;
  if v_status not in ('aberta', 'em_andamento', 'coberta', 'descartada') then perform interno.erro('invalido:status'); end if;
  if v_id is null then
    insert into disciplina_lacunas (disciplina, titulo, descricao, aula, prioridade, status, criado_por)
    values (v_disc, interno.txt(p ->> 'titulo', 'titulo', 3, 160), interno.txt(coalesce(p ->> 'descricao', ''), 'descricao', 0, 1500), interno.txt(coalesce(p ->> 'aula', ''), 'aula', 0, 120), v_prio, v_status, v)
    returning id into v_id;
  else
    select disciplina into v_antiga from disciplina_lacunas where id = v_id;
    if not found then perform interno.erro('nao_encontrado'); end if;
    -- Mudar de disciplina exige poder nas duas.
    if v_antiga <> v_disc and not interno.ensina(v_antiga) then perform interno.erro('sem_permissao'); end if;
    update disciplina_lacunas set disciplina = v_disc, titulo = interno.txt(p ->> 'titulo', 'titulo', 3, 160), descricao = interno.txt(coalesce(p ->> 'descricao', ''), 'descricao', 0, 1500),
      aula = interno.txt(coalesce(p ->> 'aula', ''), 'aula', 0, 120), prioridade = v_prio, status = v_status, atualizado_em = now() where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

/** Só a coordenação apaga de vez; quem ensina marca como "descartada". */
create or replace function public.lacunas_apagar(p_id uuid) returns boolean language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from disciplina_lacunas where id = p_id;
  get diagnostics n = row_count;
  perform interno.registrar('lacuna_apagada', p_id::text, '{}'::jsonb);
  return n > 0;
end $$;

/** A coordenação vê, por disciplina, quantas lacunas estão abertas, em andamento e cobertas. */
create or replace function public.lacunas_resumo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.curador() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('disciplina', disciplina, 'abertas', abertas, 'em_andamento', andamento, 'cobertas', cobertas, 'altas', altas) order by abertas desc, disciplina), '[]'::jsonb)
          from (select disciplina, count(*) filter (where status = 'aberta') abertas, count(*) filter (where status = 'em_andamento') andamento,
                       count(*) filter (where status = 'coberta') cobertas, count(*) filter (where status in ('aberta', 'em_andamento') and prioridade = 'alta') altas
                from disciplina_lacunas group by disciplina) x);
end $$;

-- ───────────────────────────── 5. Resultado das aulas para quem ensina ─────────────────────────────

/** As disciplinas (trilhas) que esta pessoa pode ver: "todas" para curadoria, coordenação e quem tem a função sem disciplina. */
create or replace function public.aulas_resultado_minhas() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if interno.curador() or exists (select 1 from papeis p where p.usuario = auth.uid() and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina is null) then
    return jsonb_build_object('todas', true, 'disciplinas', '[]'::jsonb);
  end if;
  return jsonb_build_object('todas', false, 'disciplinas',
    (select coalesce(jsonb_agg(distinct p.disciplina), '[]'::jsonb) from papeis p where p.usuario = auth.uid() and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina is not null));
end $$;

/**
 * Por aula de UMA trilha: testes e acertos (70% ou mais) nos últimos p_dias, e a tendência dos últimos 30 dias contra os 30
 * anteriores. Soma de contagens anônimas (tabela contagens, sem conta nem aparelho). Aula com menos de 5 testes aparece sem os
 * números ("poucos testes"), para um número pequeno não apontar ninguém.
 */
create or replace function public.aulas_resultado_ensino(p_trilha text, p_dias integer default 90) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_dias integer := least(greatest(coalesce(p_dias, 90), 30), 400);
begin
  perform interno.eu();
  if coalesce(p_trilha, '') !~ '^[a-z0-9-]{1,80}$' then perform interno.erro('invalido:trilha'); end if;
  if not interno.ensina(p_trilha) then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('minimo', 5, 'dias', v_dias, 'aulas', (
    select coalesce(jsonb_agg(case when x.testes < 5
        then jsonb_build_object('alvo', x.alvo, 'poucos', true)
        else jsonb_build_object('alvo', x.alvo, 'poucos', false, 'testes', x.testes, 'acertos', x.acertos, 'pct', round(100.0 * x.acertos / x.testes),
          'dificil', x.testes >= 10 and 100.0 * x.acertos / x.testes < 40,
          'recente_testes', x.t_rec, 'recente_pct', case when x.t_rec >= 5 then round(100.0 * x.a_rec / x.t_rec) end,
          'anterior_testes', x.t_ant, 'anterior_pct', case when x.t_ant >= 5 then round(100.0 * x.a_ant / x.t_ant) end) end order by x.alvo), '[]'::jsonb)
    from (
      select alvo,
        coalesce(sum(total) filter (where tipo = 'aula_teste'), 0)::bigint testes,
        coalesce(sum(total) filter (where tipo = 'aula_acertou'), 0)::bigint acertos,
        coalesce(sum(total) filter (where tipo = 'aula_teste' and dia > v_hoje - 30), 0)::bigint t_rec,
        coalesce(sum(total) filter (where tipo = 'aula_acertou' and dia > v_hoje - 30), 0)::bigint a_rec,
        coalesce(sum(total) filter (where tipo = 'aula_teste' and dia <= v_hoje - 30 and dia > v_hoje - 60), 0)::bigint t_ant,
        coalesce(sum(total) filter (where tipo = 'aula_acertou' and dia <= v_hoje - 30 and dia > v_hoje - 60), 0)::bigint a_ant
      from contagens
      where tipo in ('aula_teste', 'aula_acertou') and left(alvo, length(p_trilha) + 1) = p_trilha || '/' and dia > v_hoje - v_dias
      group by alvo
    ) x));
end $$;

-- ───────────────────────────── 6. Caixa de imprensa ─────────────────────────────

/**
 * Qualquer pessoa (jornalista) pede uma resposta ou entrevista. Exige o consentimento marcado; segura spam (3 por hora por
 * origem, 3 por dia por e-mail, campo-isca "site" vazio). Avisa quem lida com a imprensa por e-mail, SEM dado do pedido.
 */
create or replace function public.imprensa_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_prazo date := nullif(p ->> 'prazo', '')::date;
  v_id uuid; r record;
begin
  -- Campo-isca preenchido: finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('ok', true); end if;
  perform interno.limite('imprensa_enviar', 3, 60);
  if coalesce((p ->> 'consentimento')::boolean, false) is not true then perform interno.erro('invalido:consentimento'); end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  if v_prazo is not null and (v_prazo < (now() at time zone 'America/Sao_Paulo')::date or v_prazo > (now() at time zone 'America/Sao_Paulo')::date + 365) then perform interno.erro('invalido:prazo'); end if;
  if (select count(*) from imprensa_pedidos where email = v_email and criado_em > now() - interval '1 day') >= 3 then perform interno.erro('muitos_pedidos'); end if;
  if (select count(*) from imprensa_pedidos where status = 'novo') >= 300 then perform interno.erro('caixa_cheia'); end if;
  insert into imprensa_pedidos (nome, veiculo, email, assunto, mensagem, prazo)
  values (interno.txt(p ->> 'nome', 'nome', 2, 100), interno.txt(coalesce(p ->> 'veiculo', ''), 'veiculo', 0, 100), v_email,
          interno.txt(p ->> 'assunto', 'assunto', 3, 150), interno.txt(p ->> 'mensagem', 'mensagem', 10, 3000), v_prazo)
  returning id into v_id;
  for r in select distinct u.email from papeis pp join auth.users u on u.id = pp.usuario join perfis f on f.id = pp.usuario
           where pp.papel in ('porta_voz', 'coordenacao', 'vice') and not f.suspenso and coalesce(u.email, '') <> '' loop
    perform interno.email(r.email, 'imprensa_nova', 'Novo pedido na caixa de imprensa', 'Chegou um pedido na caixa de imprensa. Abra o painel, em Caixa de imprensa, para ler e responder.' || case when v_prazo is not null then E'\nO pedido tem prazo.' else '' end, '', 10);
  end loop;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.imprensa_listar(p_status text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.imprensa_pode() then perform interno.erro('sem_permissao'); end if;
  perform interno.registrar_acesso('imprensa', '');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'veiculo', i.veiculo, 'email', i.email, 'assunto', i.assunto, 'mensagem', i.mensagem,
            'prazo', i.prazo, 'status', i.status, 'nota', i.nota, 'criado_em', i.criado_em, 'apagar_em', i.apagar_em,
            'responsavel', coalesce((select f.nome from perfis f where f.id = i.responsavel), ''))
            order by (i.status in ('respondido', 'arquivado')), i.prazo nulls last, i.criado_em desc), '[]'::jsonb)
          from (select * from imprensa_pedidos where coalesce(p_status, '') = '' or status = p_status order by criado_em desc limit 200) i);
end $$;

/** Muda o andamento e anota (só para a equipe). Respondido ou arquivado: marca a eliminação para daqui a 180 dias (LGPD, arts. 15, I, e 16). */
create or replace function public.imprensa_atender(p_id uuid, p_status text, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.imprensa_pode() then perform interno.erro('sem_permissao'); end if;
  if p_status not in ('novo', 'em_andamento', 'respondido', 'arquivado') then perform interno.erro('invalido:status'); end if;
  update imprensa_pedidos set status = p_status, nota = interno.txt(coalesce(p_nota, ''), 'nota', 0, 1000), responsavel = v, atualizado_em = now(),
    apagar_em = case when p_status in ('respondido', 'arquivado') then now() + interval '180 days' else null end
  where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('imprensa_atendida', p_id::text, jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true);
end $$;

/** Quantos pedidos novos esperam (para o número no menu e no resumo). */
create or replace function public.imprensa_contar() returns integer language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.imprensa_pode() then return 0; end if;
  return (select count(*)::integer from imprensa_pedidos where status = 'novo');
end $$;

/** Faxina diária: elimina o que passou do prazo, e o que ficou 365 dias sem ninguém olhar. */
create or replace function interno.imprensa_limpeza() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  delete from imprensa_pedidos where (apagar_em is not null and apagar_em < now()) or (status = 'novo' and criado_em < now() - interval '365 days');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function interno.imprensa_limpeza() from public;

-- ───────────────────────────── 7. Prévia com dados de exemplo ─────────────────────────────

/**
 * Dados inventados e marcados como exemplo, para a pessoa ver como a tela fica (e a coordenação testar o texto) sem tocar em dado
 * real. Telas: imprensa, lacunas, resultado_aulas, resumo_diario, operacao. Nenhum nome, e-mail ou número aqui existe de verdade.
 */
create or replace function public.previa_exemplo(p_tela text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  if auth.uid() is null then perform interno.erro('entre_primeiro'); end if;
  return jsonb_build_object('exemplo', true, 'tela', p_tela, 'dados', case p_tela
    when 'imprensa' then jsonb_build_array(
      jsonb_build_object('nome', 'Pessoa de Exemplo', 'veiculo', 'Jornal de Exemplo', 'assunto', 'Pedido de entrevista (exemplo)', 'mensagem', 'Texto inventado para mostrar a tela.', 'status', 'novo', 'prazo', '2099-01-10'),
      jsonb_build_object('nome', 'Outra Pessoa de Exemplo', 'veiculo', 'Rádio de Exemplo', 'assunto', 'Nota sobre um projeto (exemplo)', 'mensagem', 'Outro texto inventado.', 'status', 'respondido', 'prazo', null))
    when 'lacunas' then jsonb_build_array(
      jsonb_build_object('disciplina', 'disciplina-exemplo', 'titulo', 'Falta uma aula sobre um tema de exemplo', 'prioridade', 'alta', 'status', 'aberta'),
      jsonb_build_object('disciplina', 'disciplina-exemplo', 'titulo', 'Exercícios de revisão de exemplo', 'prioridade', 'media', 'status', 'em_andamento'))
    when 'resultado_aulas' then jsonb_build_array(
      jsonb_build_object('alvo', 'trilha-exemplo/aula-1', 'poucos', false, 'testes', 42, 'acertos', 31, 'pct', 74, 'dificil', false, 'recente_pct', 78, 'anterior_pct', 70),
      jsonb_build_object('alvo', 'trilha-exemplo/aula-2', 'poucos', false, 'testes', 18, 'acertos', 5, 'pct', 28, 'dificil', true, 'recente_pct', 25, 'anterior_pct', 33),
      jsonb_build_object('alvo', 'trilha-exemplo/aula-3', 'poucos', true))
    when 'resumo_diario' then jsonb_build_object('assunto', 'Seu resumo de hoje (exemplo)', 'texto', E'Bom dia.\n\n- 3 contribuições esperam revisão\n- 1 pedido novo na caixa de imprensa\n- O token do Instagram vence em 12 dia(s)\n\nAbra o painel para ver tudo.')
    when 'operacao' then jsonb_build_object('publicacao', jsonb_build_object('estado', 'pronta', 'ha_minutos', 25), 'backup', jsonb_build_object('conclusao', 'success', 'ha_dias', 3), 'instagram', jsonb_build_object('dias', 12, 'nivel', 'aviso'))
    else null end);
end $$;

-- ───────────────────────────── 8. Resumo diário opcional por e-mail ─────────────────────────────

create or replace function public.resumo_diario_estado() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('ativo', coalesce((select ativo from resumo_diario where usuario = v), false), 'ultimo', (select ultimo from resumo_diario where usuario = v));
end $$;

/** Opcional: começa desligado. Ligar e desligar é com cada pessoa. */
create or replace function public.resumo_diario_definir(p_ativo boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  insert into resumo_diario (usuario, ativo) values (v, coalesce(p_ativo, false)) on conflict (usuario) do update set ativo = excluded.ativo;
  return jsonb_build_object('ativo', coalesce(p_ativo, false));
end $$;

/**
 * O texto do resumo de uma pessoa: SÓ contagens do que as funções dela enxergam, nunca nome, e-mail nem conteúdo. Devolve null
 * quando não há nada a dizer (dia sem aviso, dia sem e-mail).
 */
create or replace function interno.resumo_diario_montar(p_usuario uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_linhas text[] := '{}'; n integer; e jsonb;
begin
  if interno.backend2_papel_de(p_usuario, array['coordenacao', 'vice', 'curadoria']) then
    select count(*) into n from contribuicoes where status = 'pendente';
    if n > 0 then v_linhas := v_linhas || (n || case when n = 1 then ' contribuição espera revisão' else ' contribuições esperam revisão' end); end if;
  end if;
  if interno.backend2_papel_de(p_usuario, array['coordenacao', 'vice', 'porta_voz']) then
    select count(*) into n from imprensa_pedidos where status = 'novo';
    if n > 0 then v_linhas := v_linhas || (n || case when n = 1 then ' pedido novo na caixa de imprensa' else ' pedidos novos na caixa de imprensa' end); end if;
  end if;
  if interno.backend2_papel_de(p_usuario, array['coordenacao', 'vice', 'curadoria', 'educacao', 'educacao_secundaria']) then
    select count(*) into n from disciplina_lacunas d where d.status = 'aberta' and d.prioridade = 'alta'
      and (interno.backend2_papel_de(p_usuario, array['coordenacao', 'vice', 'curadoria'])
           or exists (select 1 from papeis p where p.usuario = p_usuario and p.papel in ('educacao', 'educacao_secundaria') and (p.disciplina is null or p.disciplina = d.disciplina)));
    if n > 0 then v_linhas := v_linhas || (n || case when n = 1 then ' lacuna de prioridade alta aberta' else ' lacunas de prioridade alta abertas' end); end if;
  end if;
  if interno.backend2_papel_de(p_usuario, array['coordenacao', 'vice']) then
    e := interno.instagram_token_estado();
    if e ->> 'nivel' in ('aviso', 'urgente') then v_linhas := v_linhas || ('O token do Instagram vence em ' || (e ->> 'dias') || ' dia(s)'); end if;
    if e ->> 'nivel' = 'vencido' then v_linhas := v_linhas || 'O token do Instagram venceu'; end if;
  end if;
  if coalesce(array_length(v_linhas, 1), 0) = 0 then return null; end if;
  return jsonb_build_object('assunto', 'Seu resumo de hoje no painel', 'texto',
    E'Bom dia.\n\n- ' || array_to_string(v_linhas, E'\n- ') || E'\n\nAbra o painel para ver tudo: ' || interno.endereco() || E'/pt/painel\n\nVocê recebe este resumo porque ligou a opção em Painel, Resumo diário. Desligue lá quando quiser.');
end $$;
revoke all on function interno.resumo_diario_montar(uuid) from public;

/** Diária: um e-mail por pessoa que ligou, no máximo um por dia, pela fila de sempre (a rotina de envio é a mesma). Devolve quantos entraram na fila. */
create or replace function interno.resumo_diario_enviar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v jsonb; v_email text; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_n integer := 0;
begin
  for r in select d.usuario from resumo_diario d join perfis f on f.id = d.usuario
           where d.ativo and not f.suspenso and d.ultimo is distinct from v_hoje order by d.usuario limit 500 loop
    if not interno.voluntario_e(r.usuario) then continue; end if;
    v_email := lower(coalesce(interno.email_da_conta(r.usuario), ''));
    if v_email = '' then continue; end if;
    v := interno.resumo_diario_montar(r.usuario);
    if v is null then continue; end if;
    if interno.email(v_email, 'resumo_diario', v ->> 'assunto', v ->> 'texto', '', 1) then
      v_n := v_n + 1;
      update resumo_diario set ultimo = v_hoje where usuario = r.usuario;
    end if;
  end loop;
  perform interno.instagram_token_vigiar();
  perform interno.imprensa_limpeza();
  return v_n;
end $$;
revoke all on function interno.resumo_diario_enviar() from public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 10h UTC = 7h em Brasília.
    perform cron.schedule('lucia-resumo-diario', '0 10 * * *', 'select interno.resumo_diario_enviar()');
  end if;
exception when others then null;
end $$;

-- ───────────────────────────── Acesso ─────────────────────────────

-- Só quem entrou (authenticated) chama; a caixa de imprensa também aceita visitante (anon), com a proteção acima.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('operacao_pedir', 'operacao_resultado', 'operacao_situacao', 'instagram_token_situacao', 'instagram_token_validade_salvar',
             'saude_regras_ajustes_ver', 'saude_regras_ajustes_salvar', 'lacunas_listar', 'lacunas_salvar', 'lacunas_apagar', 'lacunas_resumo',
             'aulas_resultado_minhas', 'aulas_resultado_ensino', 'imprensa_enviar', 'imprensa_listar', 'imprensa_atender', 'imprensa_contar',
             'previa_exemplo', 'resumo_diario_estado', 'resumo_diario_definir') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
      if f.proname = 'imprensa_enviar' then execute format('grant execute on function %s to anon', f.assinatura); end if;
    end if;
  end loop;
end $$;
