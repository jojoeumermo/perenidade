-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Painel interno · equipe (26/11/2026): o parceiro do instituto como função, a página do território editada pelo próprio parceiro,
-- as férias com começo e fim, a fila de revisão que corrige tudo (com histórico e aviso a quem enviou) e o e-mail das pendências.
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16). Pode rodar mais de uma vez. Não mexe na versão nem na lista de
-- exceções da porta: nenhuma função daqui começa com rede_ ou alumia_.
--
-- Funções que já existiam e são redefinidas aqui (a última definição, completa, tirada do banco montado com o install.sql):
--   interno.nome_papel, interno.pode_conceder, interno.papel_conceder_um, public.territorio_parceiro_definir,
--   public.contribuicao_editar.
-- Endereço de rede: nada daqui lê ou guarda. Texto de terceiros: o e-mail das pendências leva só contagens.

-- ── 1. Parceiro do instituto ──────────────────────────────────────────────────────────────────────────────────────────────
-- Os coletivos parceiros já tinham o vínculo com o território (20261109-territorios-parceiros.sql), mas não apareciam na lista
-- de funções. Agora "parceiro" é um papel, por território (a coluna disciplina guarda o endereço do território, como o
-- representante guarda o departamento). Só a coordenação confia. O papel e o vínculo andam juntos: confiar o papel liga o
-- território (e põe a pessoa em Parcerias); retirar o papel desliga.

do $$
begin
  alter table interno.papeis drop constraint if exists papeis_papel_check;
  alter table interno.papeis add constraint papeis_papel_check
    check (papel in ('coordenacao', 'vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'representante', 'porta_voz', 'saude', 'parceiro'));
end $$;

create or replace function interno.nome_papel(p text) returns text language sql immutable as $$
  select case p when 'coordenacao' then 'coordenação' when 'vice' then 'coordenação pedagógica' when 'supervisao' then 'supervisão' when 'curadoria' then 'curadoria'
    when 'mediacao' then 'mediação' when 'educacao' then 'educação' when 'educacao_secundaria' then 'educação secundária' when 'revisao' then 'revisão'
    when 'traducao' then 'tradução' when 'jornalismo' then 'comunicação (jornal, rádio e podcast)' when 'mentoria' then 'aula de reforço'
    when 'design' then 'comunicação (arte e design gráfico)'
    when 'marketing' then 'comunicação (marketing, divulgação, arte e design gráfico)' when 'desenvolvimento' then 'UI/UX e desenvolvimento'
    when 'representante' then 'representante do departamento' when 'porta_voz' then 'porta-voz' when 'saude' then 'profissional de saúde'
    when 'parceiro' then 'parceiro do instituto'
    else coalesce(p, '') end
$$;

/** Quem confia o papel: o de antes, e o parceiro só a coordenação (é ela quem liga um coletivo a um território). */
create or replace function interno.pode_conceder(p_papel text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.gere_cargos()
    and interno.nivel(p_papel) < interno.nivel_de(auth.uid())
    and (p_papel <> 'vice' or interno.lider())
    and (p_papel not in ('curadoria', 'mediacao', 'parceiro') or interno.coord())
$$;

create or replace function interno.papel_conceder_um(p_usuario uuid, p_papel text, p_disciplina text) returns boolean
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_linhas integer;
begin
  if coalesce(p_papel, '') not in ('vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'representante', 'porta_voz', 'saude', 'parceiro') then perform interno.erro('invalido:papel'); end if;
  if p_papel = 'representante' and not interno.departamento_valido(p_disciplina) then perform interno.erro('invalido:departamento'); end if;
  -- Representar os Revolucionários é saber quem são: só a coordenação nomeia (LGPD, art. 11).
  if p_papel = 'representante' and p_disciplina = 'revolucionarios' and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  -- O parceiro é sempre de um território (o endereço da página dele em Territórios).
  if p_papel = 'parceiro' and coalesce(p_disciplina, '') !~ '^[a-z0-9-]{2,40}$' then perform interno.erro('invalido:territorio'); end if;
  if not interno.pode_conceder(p_papel) then perform interno.erro('sem_permissao'); end if;
  -- Educação, educação secundária e reforço são por disciplina: sem ela, a pessoa enxergaria a fila de todas.
  if p_papel in ('educacao', 'educacao_secundaria', 'mentoria') and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  insert into papeis (usuario, papel, disciplina, concedido_por)
  values (p_usuario, p_papel, case when p_papel in ('vice', 'supervisao', 'marketing') then null else interno.disciplina_ok(p_disciplina) end, auth.uid()) on conflict do nothing;
  get diagnostics v_linhas = row_count;
  perform interno.registrar('papel_confiado', p_usuario::text, jsonb_build_object('papel', p_papel, 'disciplina', case when p_disciplina = 'revolucionarios' then 'reservado' else p_disciplina end));
  return v_linhas > 0;
end $$;

/** O papel de parceiro e o vínculo com o território andam juntos (os dois caminhos: Confiar funções e Parceiros dos territórios). */
create or replace function interno.parceiro_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if tg_op = 'INSERT' and new.papel = 'parceiro' and new.disciplina is not null then
    insert into territorio_parceiros (territorio, usuario, incluido_por) values (new.disciplina, new.usuario, new.concedido_por) on conflict do nothing;
    insert into departamento_membros (departamento, usuario, incluido_por) values ('parcerias', new.usuario, new.concedido_por) on conflict do nothing;
  elsif tg_op = 'DELETE' and old.papel = 'parceiro' and old.disciplina is not null then
    delete from territorio_parceiros where territorio = old.disciplina and usuario = old.usuario;
  end if;
  return null;
end $$;
revoke all on function interno.parceiro_gatilho() from public;
drop trigger if exists lucia_parceiro on interno.papeis;
create trigger lucia_parceiro after insert or delete on interno.papeis for each row execute function interno.parceiro_gatilho();

-- Quem já estava ligado a um território ganha o papel (uma vez; rodar de novo não duplica).
insert into interno.papeis (usuario, papel, disciplina, concedido_por)
select t.usuario, 'parceiro', t.territorio, t.incluido_por from interno.territorio_parceiros t where t.territorio ~ '^[a-z0-9-]{2,40}$'
on conflict do nothing;

/** Ligar (ou desligar) uma pessoa a um território. Só a coordenação. Agora o vínculo é o papel de parceiro. */
create or replace function public.territorio_parceiro_definir(p_usuario uuid, p_territorio text, p_ligar boolean default true) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_territorio, '') !~ '^[a-z0-9-]{2,40}$' then perform interno.erro('invalido:territorio'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if coalesce(p_ligar, true) then
    insert into papeis (usuario, papel, disciplina, concedido_por) values (p_usuario, 'parceiro', p_territorio, v) on conflict do nothing;
    -- O gatilho já liga; isto fica para o caso de o papel já existir sem o vínculo.
    insert into territorio_parceiros (territorio, usuario, incluido_por) values (p_territorio, p_usuario, v) on conflict do nothing;
    insert into departamento_membros (departamento, usuario, incluido_por) values ('parcerias', p_usuario, v) on conflict do nothing;
    perform interno.avisar(p_usuario, 'Você agora é parceiro do instituto: posta as novidades do seu território e edita a página dele. Abra o painel, em Minha página no território.');
  else
    delete from papeis where usuario = p_usuario and papel = 'parceiro' and disciplina = p_territorio;
    delete from territorio_parceiros where territorio = p_territorio and usuario = p_usuario;
  end if;
  perform interno.registrar(case when coalesce(p_ligar, true) then 'territorio_parceiro_ligado' else 'territorio_parceiro_desligado' end, p_usuario::text, jsonb_build_object('territorio', p_territorio));
  return jsonb_build_object('ok', true);
end $$;

-- A página do território, editada pelo parceiro dele (e só dele) ou pela coordenação. O que fica vazio volta ao texto do site
-- (content/territorios.json). Vai ao ar na hora, como as novidades; o filtro de palavras do site vale aqui também.
create table if not exists interno.territorio_paginas (
  territorio text primary key check (territorio ~ '^[a-z0-9-]{2,60}$'),
  linha text not null default '' check (char_length(linha) <= 200),
  sobre text not null default '' check (char_length(sobre) <= 1500),
  quem text not null default '' check (char_length(quem) <= 1500),
  instagram text not null default '' check (instagram = '' or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  temas text[] not null default '{}' check (cardinality(temas) <= 12),
  atualizado_por uuid references interno.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
alter table interno.territorio_paginas enable row level security;
revoke all on interno.territorio_paginas from public;

/** O que o parceiro mudou na página (público; null quando não mudou nada). Não diz quem mudou. */
create or replace function public.territorio_pagina(p_territorio text) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('linha', x.linha, 'sobre', x.sobre, 'quem', x.quem, 'instagram', x.instagram, 'temas', to_jsonb(x.temas), 'atualizado_em', x.atualizado_em)
  from territorio_paginas x where x.territorio = p_territorio
$$;

/** Guardar a página: só o parceiro daquele território ou a coordenação. Campo vazio = o texto do site. */
create or replace function public.territorio_pagina_salvar(p_territorio text, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_temas text[] := '{}'; v_tema text; v_insta text := btrim(coalesce(p ->> 'instagram', ''));
  v_linha text; v_sobre text; v_quem text;
begin
  if coalesce(p_territorio, '') !~ '^[a-z0-9-]{2,60}$' then perform interno.erro('invalido:territorio'); end if;
  if not (interno.coord() or exists (select 1 from territorio_parceiros where territorio = p_territorio and usuario = v)) then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(coalesce(p, '{}'::jsonb)) <> 'object' then perform interno.erro('invalido:pagina'); end if;
  perform interno.limite('territorio_pagina', 30, 1440);
  v_linha := interno.txt(coalesce(p ->> 'linha', ''), 'linha', 0, 200);
  v_sobre := interno.txt(coalesce(p ->> 'sobre', ''), 'sobre', 0, 1500);
  v_quem := interno.txt(coalesce(p ->> 'quem', ''), 'quem', 0, 1500);
  v_insta := regexp_replace(v_insta, '^@', '');
  if v_insta <> '' and v_insta !~ '^[A-Za-z0-9._]{1,30}$' then perform interno.erro('invalido:instagram'); end if;
  if jsonb_typeof(coalesce(p -> 'temas', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'temas', '[]'::jsonb)) > 12 then perform interno.erro('invalido:temas'); end if;
  for v_tema in select btrim(x) from jsonb_array_elements_text(coalesce(p -> 'temas', '[]'::jsonb)) x loop
    if v_tema = '' then continue; end if;
    v_temas := v_temas || interno.txt(v_tema, 'temas', 2, 40);
  end loop;
  if interno.vetado(concat_ws(' ', v_linha, v_sobre, v_quem, array_to_string(v_temas, ' '))) then perform interno.erro('conteudo_recusado'); end if;
  insert into territorio_paginas (territorio, linha, sobre, quem, instagram, temas, atualizado_por, atualizado_em)
  values (p_territorio, v_linha, v_sobre, v_quem, v_insta, v_temas, v, now())
  on conflict (territorio) do update set linha = excluded.linha, sobre = excluded.sobre, quem = excluded.quem, instagram = excluded.instagram,
    temas = excluded.temas, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em;
  perform interno.registrar('territorio_pagina_editada', p_territorio);
  return public.territorio_pagina(p_territorio);
end $$;

revoke all on function public.territorio_parceiro_definir(uuid, text, boolean), public.territorio_pagina(text), public.territorio_pagina_salvar(text, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.territorio_pagina_salvar(text, jsonb) from anon;
    grant execute on function public.territorio_parceiro_definir(uuid, text, boolean), public.territorio_pagina_salvar(text, jsonb) to authenticated, service_role;
    grant execute on function public.territorio_pagina(text) to anon, authenticated, service_role;
  end if;
end $$;

-- ── 2. Férias com começo e fim ────────────────────────────────────────────────────────────────────────────────────────────
-- Antes só havia o "até": as férias começavam na hora. Agora dá para marcar "de" e "até". Férias que começam depois ficam
-- guardadas à parte e passam a valer sozinhas no dia (a rotina diária, mais abaixo); tudo o que já olhava "ferias_ate" continua
-- igual. A pessoa volta sozinha no fim, como antes. Quem está de férias não recebe o e-mail das pendências.
alter table interno.perfis add column if not exists ferias_proxima_de date;
alter table interno.perfis add column if not exists ferias_proxima_ate date;

/** De férias hoje: as que já valem ou as marcadas que começam hoje (antes de a rotina do dia passar). */
create or replace function interno.de_ferias(p_usuario uuid) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from perfis where id = p_usuario
    and (ferias_ate >= current_date or (ferias_proxima_de <= current_date and ferias_proxima_ate >= current_date)))
$$;
revoke all on function interno.de_ferias(uuid) from public;

/** As férias marcadas que começam hoje (ou antes) passam a valer. Devolve quantas. */
create or replace function interno.ferias_comecar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare n integer;
begin
  update perfis set ferias_ate = case when ferias_proxima_ate >= current_date then ferias_proxima_ate else ferias_ate end,
    ferias_proxima_de = null, ferias_proxima_ate = null
  where ferias_proxima_de is not null and ferias_proxima_de <= current_date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function interno.ferias_comecar() from public;

/** As férias da própria pessoa: as de agora ("ferias_ate") e as marcadas para depois ("de" e "até"). */
create or replace function public.ferias_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare f perfis;
begin
  select * into f from perfis where id = interno.eu();
  return jsonb_build_object(
    'ferias_ate', case when f.ferias_proxima_de <= current_date and f.ferias_proxima_ate >= current_date then f.ferias_proxima_ate
                       when f.ferias_ate >= current_date then f.ferias_ate end,
    'proxima_de', case when f.ferias_proxima_de > current_date then f.ferias_proxima_de end,
    'proxima_ate', case when f.ferias_proxima_de > current_date then f.ferias_proxima_ate end);
end $$;

/**
 * Marcar férias de um dia até outro. Sem "de" (ou "de" hoje ou antes), valem já. "até" vazio cancela tudo (a volta antes da hora).
 * Até 120 dias de férias, marcadas com até um ano de antecedência. A versão antiga, ferias_marcar(p_ate), continua valendo.
 */
create or replace function public.ferias_marcar(p_de date, p_ate date) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_hoje date := current_date;
begin
  if p_ate is null then
    update perfis set ferias_ate = null, ferias_proxima_de = null, ferias_proxima_ate = null where id = v;
    return public.ferias_ver();
  end if;
  if p_ate < v_hoje then perform interno.erro('invalido:ate'); end if;
  if p_de is not null and (p_de > p_ate or p_de > v_hoje + 365) then perform interno.erro('invalido:de'); end if;
  if p_ate - greatest(coalesce(p_de, v_hoje), v_hoje) > 120 then perform interno.erro('invalido:ate'); end if;
  if p_de is null or p_de <= v_hoje then
    update perfis set ferias_ate = p_ate, ferias_proxima_de = null, ferias_proxima_ate = null where id = v;
  else
    update perfis set ferias_proxima_de = p_de, ferias_proxima_ate = p_ate where id = v;
  end if;
  return public.ferias_ver();
end $$;

revoke all on function public.ferias_ver(), public.ferias_marcar(date, date) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.ferias_ver(), public.ferias_marcar(date, date) from anon;
    grant execute on function public.ferias_ver(), public.ferias_marcar(date, date) to authenticated, service_role;
  end if;
end $$;

-- ── 3. Fila de revisão: quem revisa corrige tudo ──────────────────────────────────────────────────────────────────────────
-- Uma tradução para o espanhol chegou marcada como inglês, e quem revisava não tinha como corrigir: só a curadoria e a triagem
-- editavam, e só o título, o texto e as fontes. Agora quem decide sobre o envio (a revisão, o educador da disciplina, a
-- supervisão, a coordenação) também corrige, e corrige tudo: título, texto, fontes, os campos do envio (idioma, resumo…), a
-- disciplina e a página. Cada alteração entra no histórico do envio, com o valor de antes, e quem enviou recebe um aviso dizendo
-- quais campos mudaram (não o conteúdo).
create table if not exists interno.contribuicao_alteracoes (
  id bigint generated always as identity primary key,
  contribuicao uuid not null references interno.contribuicoes (id) on delete cascade,
  autor uuid references interno.perfis (id) on delete set null,
  campos text[] not null,
  antes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists contribuicao_alteracoes_envio on interno.contribuicao_alteracoes (contribuicao, criado_em desc);
alter table interno.contribuicao_alteracoes enable row level security;
revoke all on interno.contribuicao_alteracoes from public;

/** O nome de um campo para gente (o aviso e o histórico). */
create or replace function interno.campo_do_envio(p text) returns text language sql immutable as $$
  select case p when 'titulo' then 'título' when 'corpo' then 'texto' when 'fontes' then 'fontes' when 'disciplina' then 'disciplina'
    when 'alvo' then 'página' when 'idioma' then 'idioma' when 'resumo' then 'resumo' when 'trilha' then 'trilha' else coalesce(p, '') end
$$;

create or replace function public.contribuicao_editar(p_id uuid, p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes; v_corrige boolean;
  v_titulo text; v_corpo text; v_dados jsonb; v_fontes jsonb; v_disc text; v_alvo text; v_campos text[] := '{}'; v_antes jsonb := '{}'::jsonb; k text;
begin
  select * into c from contribuicoes where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if c.status <> 'pendente' then perform interno.erro('ja_decidida'); end if;
  -- Quem revisa (quem pode decidir) também edita, e é quem corrige disciplina e página: o autor mudar a disciplina mudaria quem decide.
  v_corrige := interno.curador() or interno.tria(c) or interno.decide(c);
  if not (coalesce(c.autor = v, false) or interno.colabora(c.id) or v_corrige) then perform interno.erro('sem_permissao'); end if;
  if coalesce(p ->> 'versao', '') <> '' then
    if (p ->> 'versao') !~ '^[0-9T:.+ Z-]{10,40}$' then perform interno.erro('invalido:versao'); end if;
    if (p ->> 'versao')::timestamptz is distinct from coalesce(c.editado_em, c.criado_em) then perform interno.erro('mudou_enquanto_editava'); end if;
  end if;
  if jsonb_typeof(coalesce(p -> 'dados', '{}'::jsonb)) <> 'object' or pg_column_size(coalesce(p -> 'dados', '{}'::jsonb)) > 20000 then perform interno.erro('invalido:dados'); end if;
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 3, 160);
  v_corpo := interno.txt(p ->> 'corpo', 'corpo', case when c.tipo in ('obra', 'video', 'frase', 'debate', 'verbete') then 0 else 20 end, 60000);
  v_dados := coalesce(p -> 'dados', '{}'::jsonb);
  v_fontes := interno.fontes_ok(p -> 'fontes', c.tipo in ('aula', 'artigo', 'checagem', 'debate', 'verbete', 'memorial', 'frase'));
  v_disc := case when p ? 'disciplina' then interno.disciplina_ok(nullif(btrim(coalesce(p ->> 'disciplina', '')), '')) else c.disciplina end;
  v_alvo := case when p ? 'alvo' then nullif(btrim(coalesce(p ->> 'alvo', '')), '') else c.alvo end;
  if (v_disc is distinct from c.disciplina or v_alvo is distinct from c.alvo) and not v_corrige then perform interno.erro('sem_permissao'); end if;
  if v_alvo is distinct from c.alvo and v_alvo is not null and (v_alvo !~ '^/[a-z0-9/_-]+$' or char_length(v_alvo) > 300) then perform interno.erro('invalido:alvo'); end if;
  if c.tipo = 'traducao' and (v_dados ->> 'idioma') is distinct from (c.dados ->> 'idioma') and coalesce(v_dados ->> 'idioma', '') not in ('en', 'es', 'zh', 'ru', 'fr') then
    perform interno.erro('invalido:idioma');
  end if;

  if v_titulo is distinct from c.titulo then v_campos := array_append(v_campos, 'titulo'); v_antes := v_antes || jsonb_build_object('titulo', c.titulo); end if;
  if v_corpo is distinct from c.corpo then v_campos := array_append(v_campos, 'corpo'); v_antes := v_antes || jsonb_build_object('corpo', c.corpo); end if;
  if v_fontes is distinct from c.fontes then v_campos := array_append(v_campos, 'fontes'); v_antes := v_antes || jsonb_build_object('fontes', c.fontes); end if;
  if v_disc is distinct from c.disciplina then v_campos := array_append(v_campos, 'disciplina'); v_antes := v_antes || jsonb_build_object('disciplina', c.disciplina); end if;
  if v_alvo is distinct from c.alvo then v_campos := array_append(v_campos, 'alvo'); v_antes := v_antes || jsonb_build_object('alvo', c.alvo); end if;
  for k in select x from (select jsonb_object_keys(c.dados) x union select jsonb_object_keys(v_dados)) t order by x loop
    if (c.dados -> k) is distinct from (v_dados -> k) then
      v_campos := array_append(v_campos, k);
      v_antes := jsonb_set(v_antes, '{dados}', coalesce(v_antes -> 'dados', '{}'::jsonb) || jsonb_build_object(k, c.dados -> k));
    end if;
  end loop;

  update contribuicoes set titulo = v_titulo, corpo = v_corpo, dados = v_dados, fontes = v_fontes, disciplina = v_disc, alvo = v_alvo,
    editado_em = clock_timestamp(), editado_por = v
  where id = p_id;
  if cardinality(v_campos) > 0 then
    insert into contribuicao_alteracoes (contribuicao, autor, campos, antes) values (p_id, v, v_campos, v_antes);
    delete from contribuicao_alteracoes where contribuicao = p_id
      and id not in (select id from contribuicao_alteracoes where contribuicao = p_id order by criado_em desc, id desc limit 30);
  end if;
  if c.autor is distinct from v then
    perform interno.registrar('contribuicao_editada', p_id::text, jsonb_build_object('campos', to_jsonb(v_campos)));
    if cardinality(v_campos) > 0 then
      perform interno.avisar(c.autor, format('Quem revisa alterou o seu envio "%s": %s. O que mudou fica no histórico do envio, no painel, em Meus envios.',
        left(v_titulo, 80), (select string_agg(interno.campo_do_envio(x), ', ') from unnest(v_campos) x)));
    end if;
  end if;
  return jsonb_build_object('ok', true, 'campos', to_jsonb(v_campos));
end $$;

/** O histórico de alterações de um envio: quem enviou, quem colabora e quem vê o envio na fila. */
create or replace function public.contribuicao_alteracoes(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c contribuicoes;
begin
  select * into c from contribuicoes where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if not (coalesce(c.autor = v, false) or interno.colabora(c.id) or interno.ve_item(c)) then perform interno.erro('sem_permissao'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('quando', a.criado_em, 'quem', case when a.autor = c.autor then 'quem enviou' else coalesce(interno.nome_visto(f.nome), 'alguém da equipe') end,
      'campos', to_jsonb(a.campos), 'antes', (a.antes - 'corpo') || case when a.antes ? 'corpo' then jsonb_build_object('corpo_tamanho', char_length(a.antes ->> 'corpo')) else '{}'::jsonb end)
    order by a.criado_em desc, a.id desc)
    from contribuicao_alteracoes a left join perfis f on f.id = a.autor where a.contribuicao = p_id), '[]'::jsonb);
end $$;

revoke all on function interno.campo_do_envio(text) from public;
revoke all on function public.contribuicao_editar(uuid, jsonb), public.contribuicao_alteracoes(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.contribuicao_alteracoes(uuid) from anon;
    grant execute on function public.contribuicao_editar(uuid, jsonb), public.contribuicao_alteracoes(uuid) to authenticated, service_role;
  end if;
end $$;

-- ── 4. E-mail das pendências ──────────────────────────────────────────────────────────────────────────────────────────────
-- Quando há tarefa esperando alguém no painel, a pessoa recebe um e-mail que só diz quantas e leva ao painel ("3 itens esperando
-- revisão"): as mesmas contagens da Mesa (public.painel_resumo, calculada como se fosse ela), nunca título, nome ou texto. Várias
-- pendências viram um resumo só, no máximo um por dia (ou um por semana, às segundas). Cada pessoa escolhe a frequência ou
-- desliga em Minha conta; quem está de férias não recebe. Tudo pronto e DESLIGADO: a coordenação liga a chave geral no painel
-- (e o envio usa a fila e o serviço de e-mail de sempre, supabase/functions/enviar-emails).
create table if not exists interno.pendencias_email (
  usuario uuid primary key references interno.perfis (id) on delete cascade,
  frequencia text not null default 'diario' check (frequencia in ('diario', 'semanal', 'desligado')),
  ultimo date
);
alter table interno.pendencias_email enable row level security;
revoke all on interno.pendencias_email from public;
insert into interno.configuracoes (chave, valor) values ('pendencias_email', '{"ligado": false}'::jsonb) on conflict (chave) do nothing;

create or replace function interno.pendencias_ligado() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce((select (valor ->> 'ligado')::boolean from configuracoes where chave = 'pendencias_email'), false)
$$;
revoke all on function interno.pendencias_ligado() from public;

/**
 * As linhas do resumo de uma pessoa: as contagens da Mesa dela (painel_resumo, com o "quem sou" trocado só durante a conta e
 * devolvido em seguida) e as aulas que faltam nas disciplinas em que ela é educadora. Só números; nada de nome, título ou texto.
 */
create or replace function interno.pendencias_linhas(p_usuario uuid) returns text[] language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_claims text := current_setting('request.jwt.claims', true); v_sub text := current_setting('request.jwt.claim.sub', true);
  r jsonb; v_linhas text[] := '{}'; n integer; x record;
begin
  if p_usuario is null then return v_linhas; end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform set_config('request.jwt.claim.sub', p_usuario::text, true);
  begin
    r := public.painel_resumo();
  exception when others then r := null;
  end;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  if r is null then return v_linhas; end if;
  for x in select * from (values
      (1, 'fila', 'item esperando revisão', 'itens esperando revisão'),
      (2, 'triagem', 'envio esperando a triagem', 'envios esperando a triagem'),
      (3, 'testemunhar', 'certificado esperando a sua assinatura', 'certificados esperando a sua assinatura'),
      (4, 'pedidos', 'pedido de certificado', 'pedidos de certificado'),
      (5, 'horas', 'registro de horas para conferir', 'registros de horas para conferir'),
      (6, 'candidaturas', 'pedido para entrar na equipe', 'pedidos para entrar na equipe'),
      (7, 'juntas', 'envio compartilhado com você em andamento', 'envios compartilhados com você em andamento'),
      (8, 'pedidos_ajuda', 'pedido de ajuda para a sua função', 'pedidos de ajuda para a sua função'),
      (9, 'reforco', 'pedido de reforço aberto', 'pedidos de reforço abertos'),
      (10, 'denuncias', 'denúncia aberta', 'denúncias abertas'),
      (11, 'anotacoes', 'anotação esperando decisão', 'anotações esperando decisão'),
      (12, 'retidos', 'mensagem retida na comunidade', 'mensagens retidas na comunidade'),
      (13, 'mural', 'anúncio do Mural dos Trabalhadores esperando decisão', 'anúncios do Mural dos Trabalhadores esperando decisão'),
      (14, 'gaveta', 'item na Gaveta esperando decisão', 'itens na Gaveta esperando decisão'),
      (15, 'divulgacao', 'post de divulgação pronto para sair', 'posts de divulgação prontos para sair'),
      (16, 'pedidos_supervisao', 'pedido da supervisão esperando a coordenação', 'pedidos da supervisão esperando a coordenação'),
      (17, 'publicacao_atrasada', 'envio aprovado esperando a publicação', 'envios aprovados esperando a publicação')) t(ordem, chave, um, varios)
    order by ordem loop
    n := coalesce((r ->> x.chave)::integer, 0);
    if n > 0 then v_linhas := v_linhas || (n || ' ' || case when n = 1 then x.um else x.varios end); end if;
  end loop;
  -- Aulas a fazer: as lacunas abertas nas disciplinas em que a pessoa é educadora.
  select count(*) into n from disciplina_lacunas d where d.status = 'aberta'
    and exists (select 1 from papeis p where p.usuario = p_usuario and p.papel in ('educacao', 'educacao_secundaria') and p.disciplina = d.disciplina);
  if n > 0 then v_linhas := v_linhas || (n || ' ' || case when n = 1 then 'aula a fazer na sua disciplina' else 'aulas a fazer nas suas disciplinas' end); end if;
  return v_linhas;
end $$;
revoke all on function interno.pendencias_linhas(uuid) from public;

/** O e-mail de uma pessoa (assunto e texto), ou null quando não há nada esperando por ela. */
create or replace function interno.pendencias_montar(p_usuario uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_linhas text[] := interno.pendencias_linhas(p_usuario); v_total integer := 0; l text;
begin
  if coalesce(array_length(v_linhas, 1), 0) = 0 then return null; end if;
  foreach l in array v_linhas loop v_total := v_total + split_part(l, ' ', 1)::integer; end loop;
  return jsonb_build_object('total', v_total, 'linhas', to_jsonb(v_linhas),
    'assunto', v_total || case when v_total = 1 then ' item esperando você no painel' else ' itens esperando você no painel' end,
    'texto', E'Olá.\n\nNo painel do Instituto Lúcia há:\n\n- ' || array_to_string(v_linhas, E'\n- ')
      || E'\n\nAbra o painel para ver: ' || interno.endereco() || E'/pt/painel\n\n'
      || E'Você recebe este resumo porque está na equipe e tem tarefa esperando. Para receber uma vez por semana ou desligar, abra o painel, Minha conta, aba Privacidade e avisos.');
end $$;
revoke all on function interno.pendencias_montar(uuid) from public;

/** Diária: as férias marcadas que começam hoje passam a valer; com a chave geral ligada, um resumo para cada pessoa com pendência. */
create or replace function interno.pendencias_enviar() returns integer language plpgsql security definer set search_path = interno, pg_temp as $$
declare r record; v jsonb; v_email text; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_segunda boolean; v_n integer := 0;
begin
  perform interno.ferias_comecar();
  if not interno.pendencias_ligado() then return 0; end if;
  v_segunda := extract(isodow from v_hoje) = 1;
  for r in select distinct on (p.usuario) p.usuario, coalesce(e.frequencia, 'diario') as frequencia, e.ultimo
           from papeis p join perfis f on f.id = p.usuario left join pendencias_email e on e.usuario = p.usuario
           where not f.suspenso and coalesce(e.frequencia, 'diario') <> 'desligado'
           order by p.usuario limit 2000 loop
    if r.ultimo is not null and r.ultimo >= v_hoje then continue; end if;
    if r.frequencia = 'semanal' and (not v_segunda or (r.ultimo is not null and r.ultimo > v_hoje - 6)) then continue; end if;
    if interno.de_ferias(r.usuario) then continue; end if;
    v_email := lower(coalesce(interno.email_da_conta(r.usuario), ''));
    if v_email = '' then continue; end if;
    v := interno.pendencias_montar(r.usuario);
    if v is null then continue; end if;
    if interno.email(v_email, 'pendencias', v ->> 'assunto', v ->> 'texto', '', 1) then
      v_n := v_n + 1;
      insert into pendencias_email (usuario, ultimo) values (r.usuario, v_hoje) on conflict (usuario) do update set ultimo = excluded.ultimo;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function interno.pendencias_enviar() from public;

/** A escolha da própria pessoa, a chave geral e a prévia do que ela receberia hoje (só contagens). */
create or replace function public.pendencias_email_ver() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_previa jsonb;
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  v_previa := interno.pendencias_montar(v);
  return jsonb_build_object('frequencia', coalesce((select frequencia from pendencias_email where usuario = v), 'diario'),
    'ultimo', (select ultimo from pendencias_email where usuario = v), 'ligado', interno.pendencias_ligado(), 'de_ferias', interno.de_ferias(v),
    'pode_ligar', interno.lider(), 'previa', v_previa);
end $$;

create or replace function public.pendencias_email_definir(p_frequencia text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  if coalesce(p_frequencia, '') not in ('diario', 'semanal', 'desligado') then perform interno.erro('invalido:frequencia'); end if;
  insert into pendencias_email (usuario, frequencia) values (v, p_frequencia) on conflict (usuario) do update set frequencia = excluded.frequencia;
  return jsonb_build_object('frequencia', p_frequencia);
end $$;

/** A chave geral: só a coordenação liga ou desliga, e fica no registro de ações. */
create or replace function public.pendencias_email_ligar(p_ligado boolean) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  insert into configuracoes (chave, valor) values ('pendencias_email', jsonb_build_object('ligado', coalesce(p_ligado, false)))
  on conflict (chave) do update set valor = excluded.valor;
  perform interno.registrar(case when coalesce(p_ligado, false) then 'pendencias_email_ligado' else 'pendencias_email_desligado' end);
  return jsonb_build_object('ligado', coalesce(p_ligado, false));
end $$;

revoke all on function public.pendencias_email_ver(), public.pendencias_email_definir(text), public.pendencias_email_ligar(boolean) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.pendencias_email_ver(), public.pendencias_email_definir(text), public.pendencias_email_ligar(boolean) from anon;
    grant execute on function public.pendencias_email_ver(), public.pendencias_email_definir(text), public.pendencias_email_ligar(boolean) to authenticated, service_role;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- 11h UTC = 8h em Brasília, depois do resumo diário opcional (7h).
    perform cron.schedule('lucia-pendencias', '0 11 * * *', 'select interno.pendencias_enviar()');
  end if;
exception when others then null;
end $$;
