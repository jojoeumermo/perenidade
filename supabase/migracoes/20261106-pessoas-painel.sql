-- ───────────────────────────── Pessoas no painel: várias funções, departamentos de hoje e troca de e-mail (T28, T29, T30) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Vai no fim do install.sql.
-- Documentação: docs/DEPARTAMENTOS-TERMOS.md (seção "Novembro, 6: pessoas no painel").
--
-- T28. Várias funções e várias disciplinas de uma vez. As funções já moram numa tabela de ligação (interno.papeis: uma linha
--      por pessoa, função e disciplina), então nada precisa migrar: o que muda é que a coordenação confia tudo numa ação
--      só (public.papeis_conceder_varios), com as mesmas regras de nível de public.papel_conceder, e a pessoa recebe um
--      recado só. O convite pessoal também passa a levar mais de uma função e departamentos (convites.extras).
-- T29. Convites: a lista diz a situação de cada um (valendo, usado, vencido, cancelado) e quem usou. Troca do e-mail de uma
--      conta (public.usuario_email_trocar): só a coordenação comunitária, com motivo, registro no histórico (com o
--      e-mail mascarado) e aviso por e-mail ao endereço antigo e ao novo. Feita dentro do banco, como a redefinição de
--      senha: a chave de serviço não fica no servidor do site (veja .env.example), e nenhuma chave nova foi criada.
-- T30. Os departamentos de hoje (os grupos do instituto): entram Parcerias (coletivos parceiros), Influenciadores,
--      Representantes, RH (Recursos Humanos) e Revolucionários (militantes da Frente Revolucionária Lúcia). Os que já
--      existiam mantêm o id interno (nada se perde); só o nome que aparece muda, na tela. A participação nesses
--      departamentos fica numa tabela de ligação própria (interno.departamento_membros): uma pessoa pode estar em vários.
--
-- Dado sensível: participar do departamento Revolucionários revela opinião e filiação política, dado pessoal sensível
-- (LGPD, art. 5º, II, e art. 11). Por isso a lista de quem participa só aparece para a coordenação (comunitária e
-- pedagógica) e para quem é do próprio departamento; a supervisão não entra no grupo de conversa dele, e só a
-- coordenação põe ou tira alguém dele.

-- 1. Os departamentos novos ──────────────────────────────────────────────────────────────────────────────────
alter table interno.departamentos_info drop constraint if exists departamentos_info_id_check;
alter table interno.departamentos_info add constraint departamentos_info_id_check check (id in
  ('jornalismo', 'design', 'educacao', 'mentoria', 'curadoria', 'revisao', 'traducao', 'mediacao', 'desenvolvimento', 'saude', 'coordenacao',
   'parcerias', 'influenciadores', 'representantes', 'rh', 'revolucionarios'));

insert into interno.departamentos_info (id, descricao) values
  ('parcerias', 'Os coletivos parceiros do instituto: quem constrói junto com a gente, cada um no seu território.'),
  ('influenciadores', 'Quem leva o instituto para as redes com a própria voz: criadores de conteúdo e perfis parceiros.'),
  ('representantes', 'Os representantes de todos os departamentos juntos: combinar o que é de mais de um departamento e levar as questões à coordenação.'),
  ('rh', 'Recursos Humanos: acolher quem chega, acompanhar os voluntários (termos, horas, férias) e cuidar da equipe.'),
  ('revolucionarios', 'Os militantes da Frente Revolucionária Lúcia. Quem participa só aparece para a coordenação e para o próprio departamento.')
on conflict (id) do nothing;

/** Os departamentos em que se entra por participação (não por uma função de trabalho). */
create or replace function interno.departamentos_de_participacao() returns text[] language sql immutable as $$
  select array['parcerias', 'influenciadores', 'representantes', 'rh', 'revolucionarios']
$$;

-- A tabela de ligação pessoa ↔ departamento (a participação). Uma linha por pessoa e departamento.
create table if not exists interno.departamento_membros (
  departamento text not null references interno.departamentos_info (id) on delete cascade,
  usuario uuid not null references interno.perfis (id) on delete cascade,
  incluido_por uuid references interno.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (departamento, usuario)
);
create index if not exists departamento_membros_usuario on interno.departamento_membros (usuario);
-- Trancada duas vezes, como as outras: sem permissões e com segurança por linha ligada (sem regra = ninguém passa).
-- Só as funções do banco (security definer) leem e escrevem.
alter table interno.departamento_membros enable row level security;
revoke all on interno.departamento_membros from public, anon, authenticated;

/** O departamento existe e aceita representante (uma função, um grupo de disciplinas ou um departamento de participação). */
create or replace function interno.departamento_valido(p text) returns boolean language sql immutable as $$
  select coalesce(p, '') in ('educacao', 'curadoria', 'mediacao', 'revisao', 'traducao', 'jornalismo', 'marketing', 'mentoria', 'design', 'desenvolvimento', 'saude',
                             'parcerias', 'influenciadores', 'representantes', 'rh', 'revolucionarios')
      or coalesce(p, '') ~ '^grupo-(percursos|linguagens|ciencias|tecnologia|humanidades|teoria|lutas|oficios|hobbies)$'
$$;

/** Quem é do departamento de fato (sem a coordenação e a supervisão, que entram em todos). Agora também pela participação. */
create or replace function interno.membro_direto(p_usuario uuid, p_departamento text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = p_usuario and not f.suspenso and (
    p.papel = p_departamento or (p.papel = 'representante' and p.disciplina = p_departamento)
    or (p_departamento = 'jornalismo' and p.papel = 'marketing') or (p_departamento = 'design' and p.papel = 'marketing')
    or (p_departamento = 'educacao' and p.papel = 'educacao_secundaria') or (p_departamento = 'coordenacao' and p.papel in ('coordenacao', 'vice'))
    -- Quem representa algum departamento é do departamento dos Representantes.
    or (p_departamento = 'representantes' and p.papel = 'representante')))
  or exists (select 1 from departamento_membros m join perfis f on f.id = m.usuario where m.usuario = p_usuario and m.departamento = p_departamento and not f.suspenso)
$$;

-- Os grupos de conversa dos departamentos novos. O install.sql já aceita estes ids nos grupos fixos (conversas_departamento_check).
alter table interno.conversas drop constraint if exists conversas_departamento_check;
alter table interno.conversas add constraint conversas_departamento_check check (departamento is null or departamento in
  ('geral', 'coordenacao', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'desenvolvimento', 'marketing',
   'parcerias', 'influenciadores', 'representantes', 'rh', 'revolucionarios'));

/** Quem entra no grupo de conversa do departamento: as regras de antes, mais a participação e os Representantes. */
create or replace function interno.no_departamento(p_usuario uuid, p_departamento text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select exists (select 1 from papeis p join perfis f on f.id = p.usuario
                 where p.usuario = p_usuario and not f.suspenso
                   and ((p_departamento = 'geral' and p.papel <> 'saude') or p.papel in ('coordenacao', 'vice') or p.papel = p_departamento or (p.papel = 'representante' and p.disciplina = p_departamento)
                        -- Representante de um grupo de disciplinas (Tecnologia, Ciências…) é do departamento de educação.
                        or (p_departamento = 'educacao' and p.papel = 'representante' and p.disciplina like 'grupo-%')
                        -- A educação secundária conversa com a educação; o marketing, com o design (como no resto do painel).
                        or (p_departamento = 'educacao' and p.papel = 'educacao_secundaria') or (p_departamento = 'design' and p.papel = 'marketing')
                        -- O marketing faz parte do Departamento de Comunicação (o grupo "jornalismo", nome interno que não muda).
                        or (p_departamento = 'jornalismo' and p.papel = 'marketing')
                        or (p_departamento = 'jornalismo' and p.papel = 'representante' and p.disciplina = 'marketing')
                        -- Todo representante conversa no grupo dos Representantes.
                        or (p_departamento = 'representantes' and p.papel = 'representante')
                        -- A supervisão acompanha os grupos das funções para manter a conversa em ordem; o da coordenação e o dos
                        -- Revolucionários (dado sensível, LGPD art. 11), não.
                        or (p.papel = 'supervisao' and p_departamento not in ('coordenacao', 'revolucionarios'))))
  or exists (select 1 from departamento_membros m join perfis f on f.id = m.usuario where m.usuario = p_usuario and m.departamento = p_departamento and not f.suspenso)
$$;

insert into interno.conversas (tipo, nome, departamento) values
  ('departamento', 'Parcerias', 'parcerias'), ('departamento', 'Influenciadores', 'influenciadores'), ('departamento', 'Representantes', 'representantes'),
  ('departamento', 'RH · Recursos Humanos', 'rh'), ('departamento', 'Revolucionários', 'revolucionarios')
on conflict (departamento) do nothing;

-- Entrar ou sair de um departamento põe ou tira a pessoa do grupo de conversa dele (como já acontece com as funções).
drop trigger if exists lucia_departamentos on interno.departamento_membros;
create trigger lucia_departamentos after insert or update or delete on interno.departamento_membros for each row execute function interno.departamentos_gatilho();

-- Quem já representa algum departamento entra no grupo dos Representantes. Rodar de novo não muda nada.
do $$
declare u uuid;
begin
  for u in select distinct usuario from interno.papeis where papel in ('representante', 'supervisao', 'coordenacao', 'vice') loop
    perform interno.departamentos_sincronizar(u);
  end loop;
end $$;

-- 2. Confiar várias funções de uma vez ─────────────────────────────────────────────────────────────────────────
/**
 * Confia uma função (já conferido quem confia e a quem). As regras são as de sempre de public.papel_conceder: só papel de
 * nível menor que o de quem confia; educação, educação secundária e reforço exigem disciplina; o representante, um
 * departamento. Devolve true quando a função é nova para a pessoa.
 */
create or replace function interno.papel_conceder_um(p_usuario uuid, p_papel text, p_disciplina text) returns boolean
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_linhas integer;
begin
  if coalesce(p_papel, '') not in ('vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'representante', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  if p_papel = 'representante' and not interno.departamento_valido(p_disciplina) then perform interno.erro('invalido:departamento'); end if;
  -- Representar os Revolucionários é saber quem são: só a coordenação nomeia (LGPD, art. 11).
  if p_papel = 'representante' and p_disciplina = 'revolucionarios' and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  if not interno.pode_conceder(p_papel) then perform interno.erro('sem_permissao'); end if;
  -- Educação, educação secundária e reforço são por disciplina: sem ela, a pessoa enxergaria a fila de todas.
  if p_papel in ('educacao', 'educacao_secundaria', 'mentoria') and coalesce(p_disciplina, '') = '' then perform interno.erro('invalido:disciplina'); end if;
  insert into papeis (usuario, papel, disciplina, concedido_por)
  values (p_usuario, p_papel, case when p_papel in ('vice', 'supervisao', 'marketing') then null else interno.disciplina_ok(p_disciplina) end, auth.uid()) on conflict do nothing;
  get diagnostics v_linhas = row_count;
  perform interno.registrar('papel_confiado', p_usuario::text, jsonb_build_object('papel', p_papel, 'disciplina', p_disciplina));
  return v_linhas > 0;
end $$;

/**
 * Confiar um papel (uma função). Mesmo comportamento de antes; agora também aceita representante dos departamentos novos.
 * Coordenação, vice-coordenação e supervisão confiam papéis de nível menor que o próprio (interno.pode_conceder), só a
 * quem está abaixo de si na hierarquia (interno.pode_mexer). Uma pessoa acumula quantos papéis forem confiados.
 */
create or replace function public.papel_conceder(p_usuario uuid, p_papel text, p_disciplina text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if not interno.pode_mexer(p_usuario) then perform interno.erro('sem_permissao'); end if;
  perform interno.papel_conceder_um(p_usuario, p_papel, p_disciplina);
  perform interno.avisar(p_usuario, 'Você recebeu um novo papel no instituto. Abra o painel para ver as ferramentas dele.');
  return jsonb_build_object('ok', true);
end $$;

/** Pôr a pessoa num departamento de participação (já conferido a quem). Devolve true quando é nova nele. */
create or replace function interno.departamento_membro_por(p_usuario uuid, p_departamento text) returns boolean
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_linhas integer;
begin
  if not (coalesce(p_departamento, '') = any(interno.departamentos_de_participacao())) then perform interno.erro('invalido:departamento'); end if;
  if p_departamento = 'revolucionarios' and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  insert into departamento_membros (departamento, usuario, incluido_por) values (p_departamento, p_usuario, auth.uid()) on conflict do nothing;
  get diagnostics v_linhas = row_count;
  -- No registro, o departamento sensível não aparece pelo nome (quem lê o registro nem sempre é da coordenação).
  perform interno.registrar('departamento_incluido', p_usuario::text, jsonb_build_object('departamento', case when p_departamento = 'revolucionarios' then 'reservado' else p_departamento end));
  return v_linhas > 0;
end $$;

/**
 * Várias funções, várias disciplinas e vários departamentos para a mesma pessoa, numa ação só (T28). p_itens é uma lista
 * de {papel, disciplina}; p_departamentos, os departamentos de participação. Tudo ou nada: se uma função for recusada,
 * nenhuma entra (a tela diz qual). A pessoa recebe um recado só.
 */
create or replace function public.papeis_conceder_varios(p_usuario uuid, p_itens jsonb, p_departamentos text[] default '{}') returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare x jsonb; v_novas integer := 0; v_deps integer := 0; d text;
begin
  perform interno.eu();
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 60 then perform interno.erro('invalido:itens'); end if;
  if cardinality(coalesce(p_departamentos, '{}')) > 20 then perform interno.erro('invalido:departamentos'); end if;
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) + cardinality(coalesce(p_departamentos, '{}')) = 0 then perform interno.erro('invalido:itens'); end if;
  if not exists (select 1 from perfis where id = p_usuario) then perform interno.erro('nao_encontrado'); end if;
  if not interno.pode_mexer(p_usuario) then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('papeis_varios', 120, 60);
  for x in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    if jsonb_typeof(x) <> 'object' then perform interno.erro('invalido:itens'); end if;
    if interno.papel_conceder_um(p_usuario, x ->> 'papel', nullif(x ->> 'disciplina', '')) then v_novas := v_novas + 1; end if;
  end loop;
  foreach d in array coalesce(p_departamentos, '{}') loop
    if interno.departamento_membro_por(p_usuario, d) then v_deps := v_deps + 1; end if;
  end loop;
  if v_novas + v_deps > 0 then
    perform interno.avisar(p_usuario, format('Você recebeu %s no instituto. Abra o painel para ver as ferramentas e os grupos.',
      concat_ws(' e ', case when v_novas = 1 then 'uma função nova' when v_novas > 1 then v_novas || ' funções novas' end,
                       case when v_deps = 1 then 'um departamento' when v_deps > 1 then v_deps || ' departamentos' end)));
  end if;
  return jsonb_build_object('ok', true, 'novas', v_novas, 'departamentos', v_deps);
end $$;

/** Tirar a pessoa de um departamento de participação: a própria pessoa sai quando quiser; os outros, quem gere cargos. */
create or replace function public.departamento_membro_remover(p_departamento text, p_usuario uuid) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if p_usuario is distinct from v then
    if not interno.gere_cargos() or not interno.pode_mexer(p_usuario) then perform interno.erro('sem_permissao'); end if;
    if p_departamento = 'revolucionarios' and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  end if;
  delete from departamento_membros where departamento = p_departamento and usuario = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  perform interno.registrar('departamento_retirado', p_usuario::text, jsonb_build_object('departamento', case when p_departamento = 'revolucionarios' then 'reservado' else p_departamento end));
  return jsonb_build_object('ok', true);
end $$;

/** A equipe para quem gere cargos: agora com os departamentos de participação de cada pessoa (Revolucionários, só para a coordenação). */
create or replace function public.voluntarios_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_coord boolean := interno.coord();
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  if interno.lider() then perform interno.registrar_acesso('emails_da_equipe'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', interno.nome_visto(f.nome), 'bio', f.bio, 'email', case when interno.lider() then u.email else '' end, 'suspenso', f.suspenso, 'suspensao', f.suspensao, 'trocar_senha', f.trocar_senha,
      'criado_em', f.criado_em, 'visto_em', f.visto_em, 'nivel', interno.nivel_de(f.id),
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by interno.nivel(p.papel) desc, p.papel, p.disciplina) from papeis p where p.usuario = f.id), '[]'::jsonb),
      'departamentos', coalesce((select jsonb_agg(m.departamento order by m.departamento) from departamento_membros m where m.usuario = f.id and (v_coord or m.departamento <> 'revolucionarios')), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f join auth.users u on u.id = f.id);
end $$;

/** Tudo de um departamento. Igual a antes; nos Revolucionários, quem participa só aparece para a coordenação e para o próprio departamento. */
create or replace function public.departamento_ver(p_id text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d departamentos_info; v_ve_pessoas boolean;
begin
  perform interno.eu();
  -- Quem só participa do departamento (sem função de trabalho, como um militante ou um coletivo parceiro) também abre o dele.
  if not (interno.voluntario() or ((interno.aal2() or not interno.tem_fator()) and interno.membro_direto(auth.uid(), p_id))) then perform interno.erro('sem_permissao'); end if;
  select * into d from departamentos_info where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  v_ve_pessoas := d.id <> 'revolucionarios' or interno.coord() or interno.membro_direto(auth.uid(), d.id);
  return jsonb_build_object(
    'id', d.id, 'descricao', d.descricao, 'como', d.como, 'meta_titulo', d.meta_titulo, 'meta_alvo', d.meta_alvo, 'meta_feito', d.meta_feito, 'atualizado_em', d.atualizado_em,
    'meu', interno.membro_direto(auth.uid(), d.id), 'respondo', interno.responde_departamento(d.id), 'reservado', not v_ve_pessoas,
    'pessoas', case when not v_ve_pessoas then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', interno.nome_visto(f.nome), 'avatar', f.avatar,
                  'responde', exists (select 1 from papeis r where r.usuario = f.id and r.papel = 'representante' and r.disciplina = d.id),
                  'ferias_ate', case when f.ferias_ate >= current_date then f.ferias_ate end,
                  'oficios', to_jsonb(f.oficios),
                  -- Desde quando a pessoa está neste departamento (para o rodízio: depois de um ano, ensinar alguém).
                  'desde', least((select min(p.criado_em) from papeis p where p.usuario = f.id and (p.papel = d.id or p.disciplina = d.id or (d.id = 'jornalismo' and p.papel = 'marketing')
                                   or (d.id = 'coordenacao' and p.papel in ('coordenacao', 'vice')) or (d.id = 'representantes' and p.papel = 'representante'))),
                                 (select m.criado_em from departamento_membros m where m.usuario = f.id and m.departamento = d.id)),
                  'papeis', (select jsonb_agg(jsonb_build_object('papel', p.papel, 'disciplina', p.disciplina)) from papeis p where p.usuario = f.id))
                  order by exists (select 1 from papeis r where r.usuario = f.id and r.papel = 'representante' and r.disciplina = d.id) desc, f.nome), '[]'::jsonb)
                from perfis f where interno.membro_direto(f.id, d.id)) end,
    'recebidos', (select coalesce(jsonb_agg(interno.departamento_pedido_json(x) order by x.status = 'aberto' desc, x.prazo nulls last, x.criado_em desc), '[]'::jsonb)
                  from (select * from departamento_pedidos where para = d.id and (status in ('aberto', 'aceito') or atualizado_em > now() - interval '30 days') limit 100) x),
    'enviados', (select coalesce(jsonb_agg(interno.departamento_pedido_json(x) order by x.criado_em desc), '[]'::jsonb)
                 from (select * from departamento_pedidos where de = d.id and (status in ('aberto', 'aceito') or atualizado_em > now() - interval '30 days') limit 100) x),
    'quadro', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'titulo', q.titulo, 'etiqueta', q.etiqueta, 'coluna', q.coluna, 'prazo', q.prazo, 'pedido', q.pedido,
                 'dono', q.dono, 'dono_nome', coalesce((select interno.nome_visto(nome) from perfis where id = q.dono), ''), 'atualizado_em', q.atualizado_em)
                 order by q.coluna, q.prazo nulls last, q.atualizado_em desc), '[]'::jsonb)
               from departamento_quadro q where q.departamento = d.id and (q.coluna <> 'feito' or q.atualizado_em > now() - interval '14 days')),
    'feitos_no_mes', (select count(*) from departamento_quadro q where q.departamento = d.id and q.coluna = 'feito' and q.atualizado_em >= date_trunc('month', now())),
    'bastoes', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'texto', b.texto, 'criado_em', b.criado_em, 'meu', b.autor = auth.uid(),
                  'autor', coalesce((select interno.nome_visto(nome) from perfis where id = b.autor), '')) order by b.criado_em desc), '[]'::jsonb)
                from (select * from departamento_bastoes where departamento = d.id order by criado_em desc limit 20) b));
end $$;

-- 3. Convites com várias funções e com departamentos ───────────────────────────────────────────────────────────
alter table interno.convites add column if not exists extras jsonb not null default '[]'::jsonb;
alter table interno.convites add column if not exists departamentos text[] not null default '{}';
alter table interno.convites drop constraint if exists convites_extras_check;
alter table interno.convites add constraint convites_extras_check check (jsonb_typeof(extras) = 'array' and jsonb_array_length(extras) <= 40 and cardinality(departamentos) <= 10);

/** Uma função que um convite pode trazer: valida e devolve a disciplina como fica guardada. */
create or replace function interno.convite_funcao_ok(p_papel text, p_disciplina text) returns text language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_disc text := interno.disciplina_ok(p_disciplina);
begin
  if coalesce(p_papel, '') not in ('vice', 'supervisao', 'curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  if p_papel in ('vice', 'curadoria') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  -- O convite confia o papel na entrada: valem as regras de nível de papel_conceder.
  if not interno.pode_conceder(p_papel) then perform interno.erro('sem_permissao'); end if;
  if p_papel in ('educacao', 'educacao_secundaria', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if p_papel not in ('educacao', 'educacao_secundaria', 'mentoria') then v_disc := null; end if;
  return v_disc;
end $$;

/**
 * A coordenação gera um convite e recebe o código uma única vez. Com e-mail, o convite é pessoal (um uso) e pode já trazer
 * uma ou mais funções (p.papel e p.extras: [{papel, disciplina}]) e departamentos de participação (p.departamentos). Sem
 * e-mail, é um convite da comunidade: vale para várias pessoas, sem função nenhuma.
 */
create or replace function public.convite_criar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu();
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_papel text := nullif(p ->> 'papel', '');
  v_disc text := nullif(p ->> 'disciplina', '');
  v_usos integer := coalesce(nullif(p ->> 'usos', '')::integer, 1);
  v_dias integer := coalesce(nullif(p ->> 'dias', '')::integer, 7);
  v_codigo text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_extras jsonb := '[]'::jsonb;
  v_deps text[] := '{}';
  v_nomes text[] := '{}';
  x jsonb; d text; v_id uuid;
begin
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('convite_criar', 60, 1440);
  if v_email <> '' and (v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200) then perform interno.erro('invalido:email'); end if;
  if jsonb_typeof(coalesce(p -> 'extras', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'extras', '[]'::jsonb)) > 40 then perform interno.erro('invalido:extras'); end if;
  if jsonb_typeof(coalesce(p -> 'departamentos', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p -> 'departamentos', '[]'::jsonb)) > 10 then perform interno.erro('invalido:departamentos'); end if;
  -- Sem função principal, a primeira das extras passa a ser a principal (a que o convite antigo já sabia guardar).
  if v_papel is null and jsonb_array_length(coalesce(p -> 'extras', '[]'::jsonb)) > 0 then
    v_papel := nullif(p -> 'extras' -> 0 ->> 'papel', '');
    v_disc := nullif(p -> 'extras' -> 0 ->> 'disciplina', '');
  end if;
  if v_papel is not null then
    if v_email = '' then perform interno.erro('invalido:email'); end if;
    v_disc := interno.convite_funcao_ok(v_papel, v_disc);
    v_nomes := v_nomes || (interno.nome_papel(v_papel) || coalesce(' (' || v_disc || ')', ''));
    for x in select * from jsonb_array_elements(coalesce(p -> 'extras', '[]'::jsonb)) loop
      if jsonb_typeof(x) <> 'object' then perform interno.erro('invalido:extras'); end if;
      if x ->> 'papel' = v_papel and interno.disciplina_ok(nullif(x ->> 'disciplina', '')) is not distinct from v_disc then continue; end if;
      v_extras := v_extras || jsonb_build_array(jsonb_build_object('papel', x ->> 'papel', 'disciplina', interno.convite_funcao_ok(x ->> 'papel', nullif(x ->> 'disciplina', ''))));
      v_nomes := v_nomes || (interno.nome_papel(x ->> 'papel') || coalesce(' (' || nullif(x ->> 'disciplina', '') || ')', ''));
    end loop;
  else
    v_disc := null;
  end if;
  for d in select jsonb_array_elements_text(coalesce(p -> 'departamentos', '[]'::jsonb)) loop
    if v_email = '' then perform interno.erro('invalido:email'); end if;
    if not (d = any(interno.departamentos_de_participacao())) then perform interno.erro('invalido:departamento'); end if;
    if not (d = any(v_deps)) then v_deps := v_deps || d; end if;
  end loop;
  if v_email <> '' then v_usos := 1; end if;
  if v_usos not between 1 and 200 then perform interno.erro('invalido:usos'); end if;
  if v_dias not between 1 and 30 then perform interno.erro('invalido:dias'); end if;
  insert into convites (selo, email, papel, disciplina, usos_max, nota, criado_por, expira_em, extras, departamentos)
  values (interno.selo(v_codigo), v_email, v_papel, v_disc, v_usos, interno.txt(p ->> 'nota', 'nota', 0, 120), v, now() + make_interval(days => v_dias), v_extras, v_deps)
  returning id into v_id;
  perform interno.registrar('convite_criado', v_id::text, jsonb_build_object('papel', v_papel, 'usos', v_usos, 'extras', jsonb_array_length(v_extras), 'departamentos', cardinality(v_deps)));
  -- Convite pessoal vai sozinho para o e-mail da pessoa; o da comunidade (sem e-mail) a coordenação espalha como quiser.
  -- O e-mail diz as funções, nunca os departamentos (o dos Revolucionários é dado sensível e o e-mail passa por terceiros).
  if v_email <> '' then
    perform interno.email(v_email, 'convite', 'Seu convite para o Instituto Lúcia',
      E'Olá.\n\nA coordenação do Instituto Lúcia convidou você para criar uma conta'
      || case when cardinality(v_nomes) = 1 then ' e atuar na função de ' || v_nomes[1] when cardinality(v_nomes) > 1 then ' e atuar nas funções de ' || array_to_string(v_nomes, ', ') else '' end
      || E'.\n\nAbra o endereço abaixo. Ele é pessoal, só funciona com este e-mail e vale por ' || v_dias || E' dia(s):\n\n'
      || interno.endereco() || '/pt/entrar?convite=' || v_codigo || E'\n\nSe você não esperava este convite, é só ignorar esta mensagem.', '', 5);
  end if;
  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'email_enviado', v_email <> '');
end $$;

/**
 * Ao nascer a conta de um convite (public.lucia_conta_nova grava o uso e depois o perfil), as funções extras e os
 * departamentos do convite entram junto. Fica num gatilho próprio para não mexer na criação de conta.
 */
create or replace function interno.convite_extras_gatilho() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
declare c convites; x jsonb; d text;
begin
  select k.* into c from convites_usos u join convites k on k.id = u.convite where u.usuario = new.id;
  if not found then return null; end if;
  for x in select * from jsonb_array_elements(coalesce(c.extras, '[]'::jsonb)) loop
    insert into papeis (usuario, papel, disciplina, concedido_por) values (new.id, x ->> 'papel', nullif(x ->> 'disciplina', ''), c.criado_por) on conflict do nothing;
  end loop;
  foreach d in array coalesce(c.departamentos, '{}') loop
    insert into departamento_membros (departamento, usuario, incluido_por) values (d, new.id, c.criado_por) on conflict do nothing;
  end loop;
  return null;
end $$;
drop trigger if exists lucia_convite_extras on interno.perfis;
create trigger lucia_convite_extras after insert on interno.perfis for each row execute function interno.convite_extras_gatilho();

/** A lista de convites, organizada: a situação de cada um, as funções extras, os departamentos e quem usou. */
create or replace function public.convites_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'email', c.email, 'papel', c.papel, 'disciplina', c.disciplina, 'usos', c.usos,
            'usos_max', c.usos_max, 'nota', c.nota, 'criado_em', c.criado_em, 'expira_em', c.expira_em, 'de', coalesce(f.nome, ''),
            'valido', not c.revogado and c.expira_em > now() and c.usos < c.usos_max, 'revogado', c.revogado,
            'situacao', case when c.usos >= c.usos_max then 'usado' when c.revogado then 'cancelado' when c.expira_em <= now() then 'vencido' else 'valendo' end,
            'extras', c.extras, 'departamentos', to_jsonb(c.departamentos),
            'usado_por', coalesce((select jsonb_agg(interno.nome_visto(p.nome) order by u.criado_em) from convites_usos u join perfis p on p.id = u.usuario where u.convite = c.id), '[]'::jsonb))
            order by c.criado_em desc), '[]'::jsonb)
          from (select * from convites order by criado_em desc limit 300) c left join perfis f on f.id = c.criado_por);
end $$;

-- 4. Trocar o e-mail de uma conta ──────────────────────────────────────────────────────────────────────────────
/** O e-mail com o meio escondido (j***@gmail.com), para o registro e para os avisos. */
create or replace function interno.email_mascarado(p text) returns text language sql immutable as $$
  select case when position('@' in coalesce(p, '')) > 1 then left(p, 1) || '***' || substr(p, position('@' in p)) else '***' end
$$;

/**
 * A coordenação comunitária troca o e-mail de uma conta, a pedido da pessoa (T29). Regras:
 *  - só a coordenação comunitária (é quem vê os e-mails da equipe), com o segundo fator quando exigido, nunca a própria
 *    conta nem a de outra coordenação (interno.ao_alcance), no máximo 10 trocas por dia;
 *  - o e-mail novo não pode ser de outra conta; o motivo é obrigatório e vai para o registro;
 *  - o registro guarda o e-mail mascarado, nunca o endereço inteiro (quem lê o registro não precisa dele);
 *  - o endereço antigo e o novo recebem um aviso por e-mail (o antigo fica sabendo, se não foi a pessoa que pediu);
 *  - a pessoa recebe também um recado no painel. A senha e as sessões não mudam.
 * É feito no banco, como a redefinição de senha (public.usuario_senha_redefinir), e não pela API administrativa do serviço:
 * a chave de serviço não fica no servidor do site. O e-mail é dado pessoal (LGPD, art. 6º, III e VII: o mínimo e com segurança).
 */
create or replace function public.usuario_email_trocar(p_usuario uuid, p_email text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_novo text := lower(btrim(coalesce(p_email, ''))); v_antigo text; v_motivo text := btrim(coalesce(p_motivo, '')); v_nome text;
begin
  perform interno.eu();
  if not interno.lider() then perform interno.erro('sem_permissao'); end if;
  perform interno.ao_alcance(p_usuario);
  if exists (select 1 from papeis where usuario = p_usuario and papel = 'coordenacao') then perform interno.erro('sem_permissao'); end if;
  if v_novo !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_novo) > 200 then perform interno.erro('invalido:email'); end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then perform interno.erro('invalido:motivo'); end if;
  perform interno.limite('email_trocar', 10, 1440);
  select lower(email) into v_antigo from auth.users where id = p_usuario;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if v_antigo = v_novo then perform interno.erro('email_igual'); end if;
  if exists (select 1 from auth.users where lower(email) = v_novo and id <> p_usuario) then perform interno.erro('email_em_uso'); end if;
  update auth.users set email = v_novo where id = p_usuario;
  -- Um pedido de troca que a pessoa tenha começado sozinha (e não confirmou) deixa de valer. As colunas existem no serviço real.
  begin
    execute 'update auth.users set email_change = '''', email_change_token_new = '''', email_change_token_current = '''', email_change_confirm_status = 0 where id = $1' using p_usuario;
  exception when others then null;
  end;
  begin
    if to_regclass('auth.identities') is not null then
      execute 'update auth.identities set identity_data = jsonb_set(coalesce(identity_data, ''{}''::jsonb), ''{email}'', to_jsonb($2::text)), updated_at = now() where user_id = $1 and provider = ''email'''
        using p_usuario, v_novo;
    end if;
  exception when others then null;
  end;
  select interno.nome_visto(nome) into v_nome from perfis where id = p_usuario;
  perform interno.registrar('email_trocado', p_usuario::text, jsonb_build_object('de', interno.email_mascarado(v_antigo), 'para', interno.email_mascarado(v_novo), 'motivo', left(v_motivo, 300)));
  perform interno.avisar_em(p_usuario, format('A coordenação trocou o e-mail da sua conta para %s. A senha continua a mesma. Se não foi você que pediu, fale com a coordenação.', interno.email_mascarado(v_novo)), 'conta');
  if v_antigo is not null and v_antigo <> '' then
    perform interno.email(v_antigo, 'conta_email', 'O e-mail da sua conta no Instituto Lúcia mudou',
      E'Olá.\n\nA pedido, a coordenação do Instituto Lúcia trocou o e-mail da sua conta para ' || interno.email_mascarado(v_novo)
      || E'. A partir de agora, entre com o endereço novo; a senha continua a mesma.\n\nSe não foi você que pediu, responda a coordenação por outro canal o quanto antes.', '', 5);
  end if;
  perform interno.email(v_novo, 'conta_email', 'Este é o novo e-mail da sua conta no Instituto Lúcia',
    E'Olá' || coalesce(', ' || v_nome, '') || E'.\n\nA coordenação do Instituto Lúcia pôs este endereço na sua conta. A partir de agora, entre no painel com ele; a senha continua a mesma.\n\n'
    || interno.endereco() || E'/pt/entrar\n\nSe você não conhece o Instituto Lúcia, ignore esta mensagem e, se quiser, avise a coordenação.', '', 5);
  return jsonb_build_object('ok', true, 'email', v_novo);
end $$;

-- Permissões: as funções novas da API, só pela API; as internas, ninguém de fora chama.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('papel_conceder', 'papeis_conceder_varios', 'departamento_membro_remover', 'voluntarios_listar', 'departamento_ver',
             'convite_criar', 'convites_listar', 'usuario_email_trocar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
  end loop;
end $$;
revoke all on function interno.departamentos_de_participacao() from public, anon, authenticated;
revoke all on function interno.departamento_valido(text) from public, anon, authenticated;
revoke all on function interno.papel_conceder_um(uuid, text, text) from public, anon, authenticated;
revoke all on function interno.departamento_membro_por(uuid, text) from public, anon, authenticated;
revoke all on function interno.convite_funcao_ok(text, text) from public, anon, authenticated;
revoke all on function interno.convite_extras_gatilho() from public, anon, authenticated;
revoke all on function interno.email_mascarado(text) from public, anon, authenticated;
