-- ───────────────────────────── Auditoria de segurança T33 (07/11/2026) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado de ninguém além do que está dito em cada parte. O
-- mesmo bloco está no fim do install.sql (roda DEPOIS de todas as migrações de 6/11). Resumo: docs/AUDITORIA-2026-11-07.md.
--
--   1. O resumo do endereço de rede (interno.origem) deixa de ser md5 com sal público: passa a SHA-256 com um segredo
--      aleatório que fica só no banco (interno.origem_segredo, fora da cópia semanal) e que a API não lê. Os resumos
--      antigos (reversíveis) são apagados ou embaralhados de novo; perfis.origem some depois de 30 dias sem entrar.
--   2. Revolucionários (dado sensível, LGPD art. 11): a página do departamento, a contagem, os bastões, o quadro, os
--      pedidos, as listas da equipe e o registro de atividades deixam de mostrar quem participa ou representa, a quem
--      não é da coordenação nem do próprio departamento.
--   3. Inscrição militante: a supervisão não lê mais; pedido repetido não vira oráculo ("ja_pediu"); e a inscrição só
--      existe depois que a pessoa confirma o e-mail (link de uso único, 3 dias). Nenhum e-mail cita a Frente, e o aviso à
--      liderança não leva nome, e-mail nem Instagram.
--   4. Chat privado da Alumia: apagar a conversa sai só da lista de quem apaga (o outro lado guarda as provas até o prazo);
--      encurtar o prazo vale só para as mensagens novas; mensagem não se apaga depois de bloqueio ou denúncia; quem apaga
--      tudo não apaga as recusas que outras pessoas fizeram contra si; versão nova da chave tem limite.

-- ── 1. O resumo do endereço de rede ─────────────────────────────────────────────────────────────────────────────────

-- O segredo: uma linha só, fora do alcance da API (RLS sem política, nenhum privilégio) e fora da cópia semanal
-- (.github/workflows/backup.yml: --exclude-table-data). Restaurar uma cópia gera um segredo novo ao rodar o install.sql.
create table if not exists interno.origem_segredo (
  id boolean primary key default true check (id),
  segredo text not null check (char_length(segredo) >= 64),
  criado_em timestamptz not null default now()
);
alter table interno.origem_segredo enable row level security;
revoke all on interno.origem_segredo from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.origem_segredo from anon, authenticated; end if;
end $$;
insert into interno.origem_segredo (segredo)
values (replace(gen_random_uuid()::text || gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict do nothing;

/**
 * O endereço que a borda da rede informa (não pode ser forjado por quem chama; sem ele, vale o primeiro da fila), virado
 * resumo: SHA-256 do segredo do banco com o endereço. Sem o segredo, o resumo não volta ao endereço (o md5 com sal público
 * de antes voltava em segundos, testando os 4 bilhões de IPv4).
 */
create or replace function interno.origem() returns text language sql stable security definer set search_path = interno, pg_temp as $$
  select encode(sha256(convert_to(coalesce((select segredo from origem_segredo where id), '') || ':' || coalesce(
    nullif(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip', ''),
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'local'), 'UTF8')), 'hex')
$$;
revoke all on function interno.origem() from public;

-- Os resumos antigos (md5 de 32 letras) eram, na prática, o endereço: saem. Bloqueio de origem decidido antes desta data
-- deixa de valer (a conta banida continua suspensa); limites e tentativas de entrada recomeçam do zero.
update interno.perfis set origem = null where origem ~ '^[0-9a-f]{32}$';
update interno.banimentos set origem = null where origem ~ '^[0-9a-f]{32}$';
delete from interno.entradas_falhas where origem ~ '^[0-9a-f]{32}$';
delete from interno.limites where chave ~ ':[0-9a-f]{32}$';
-- O aceite do convidado do podcast guarda a origem como registro: fica, mas embaralhada de novo com o segredo.
update interno.podcast_convidados set aceite_origem = encode(sha256(convert_to((select segredo from interno.origem_segredo where id) || ':legado:' || aceite_origem, 'UTF8')), 'hex')
where aceite_origem ~ '^[0-9a-f]{32}$';
update interno.auditoria set detalhes = jsonb_set(detalhes, '{origem}', to_jsonb(encode(sha256(convert_to((select segredo from interno.origem_segredo where id) || ':legado:' || (detalhes ->> 'origem'), 'UTF8')), 'hex')))
where acao = 'armadilha' and detalhes ->> 'origem' ~ '^[0-9a-f]{32}$';

-- ── 2. Revolucionários: quem participa só aparece para a coordenação e para o próprio departamento ─────────────────────

/** Quem chama pode saber quem está nos Revolucionários? A coordenação e quem é do próprio departamento. */
create or replace function interno.ve_revolucionarios() returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(interno.coord() or interno.membro_direto(auth.uid(), 'revolucionarios'), false)
$$;

/** Um papel de outra pessoa pode aparecer para quem chama? O de representante dos Revolucionários, só para quem vê o departamento. */
create or replace function interno.papel_visivel(p_dono uuid, p_disciplina text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_disciplina is distinct from 'revolucionarios' or p_dono = auth.uid() or interno.ve_revolucionarios()
$$;

/** Uma linha do registro que revela quem está nos Revolucionários (ou se inscreveu como militante). */
create or replace function interno.auditoria_reservada(a interno.auditoria) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(a.detalhes ->> 'disciplina', '') in ('revolucionarios', 'reservado')
      or coalesce(a.detalhes ->> 'departamento', '') in ('revolucionarios', 'reservado')
      or (a.acao in ('inscricao_aceita', 'inscricao_recusada') and exists (select 1 from inscricoes i where i.tipo = 'militante' and i.nome = a.alvo))
$$;

/** Os pedidos entre departamentos: o nome de quem pediu pelos Revolucionários, ou de quem cuidou lá, só para quem vê o departamento. */
create or replace function interno.departamento_pedido_json(x interno.departamento_pedidos) returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select jsonb_build_object('id', x.id, 'de', x.de, 'para', x.para, 'titulo', x.titulo, 'detalhe', x.detalhe, 'prazo', x.prazo, 'status', x.status, 'resposta', x.resposta,
    'criado_em', x.criado_em, 'atualizado_em', x.atualizado_em, 'meu', x.autor = auth.uid(),
    'autor', case when x.de = 'revolucionarios' and x.autor is distinct from auth.uid() and not interno.ve_revolucionarios() then ''
                  else coalesce((select interno.nome_visto(nome) from perfis where id = x.autor), '') end,
    'responsavel', case when x.para = 'revolucionarios' and x.responsavel is distinct from auth.uid() and not interno.ve_revolucionarios() then ''
                  else coalesce((select interno.nome_visto(nome) from perfis where id = x.responsavel), '') end)
$$;

/** Confia uma função. Igual a antes; no registro, a representação dos Revolucionários aparece como "reservado". */
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
  perform interno.registrar('papel_confiado', p_usuario::text, jsonb_build_object('papel', p_papel, 'disciplina', case when p_disciplina = 'revolucionarios' then 'reservado' else p_disciplina end));
  return v_linhas > 0;
end $$;
revoke all on function interno.papel_conceder_um(uuid, text, text) from public;

/** Retirar um papel. Igual a antes; no registro, a representação dos Revolucionários aparece como "reservado". */
create or replace function public.papel_remover(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare r papeis;
begin
  perform interno.eu();
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  select * into r from papeis where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- A vice-coordenação não mexe na coordenação nem em outra vice-coordenação.
  if r.papel in ('coordenacao', 'vice') and not interno.lider() then perform interno.erro('sem_permissao'); end if;
  -- A supervisão de quem também é vice-coordenação, só a coordenação retira (a mesma regra da própria vice-coordenação).
  if r.papel = 'supervisao' and not interno.lider() and exists (select 1 from papeis where usuario = r.usuario and papel = 'vice') then perform interno.erro('sem_permissao'); end if;
  if r.papel = 'coordenacao' and (select count(*) from papeis where papel = 'coordenacao') <= 1 then perform interno.erro('ultima_coordenacao'); end if;
  if not interno.pode_mexer(r.usuario) then perform interno.erro('sem_permissao'); end if;
  -- Quem não vê os Revolucionários também não descobre quem os representa tentando retirar o papel.
  if r.disciplina = 'revolucionarios' and not interno.coord() then perform interno.erro('sem_permissao'); end if;
  delete from papeis where id = p_id;
  perform interno.registrar('papel_retirado', r.usuario::text, jsonb_build_object('papel', r.papel, 'disciplina', case when r.disciplina = 'revolucionarios' then 'reservado' else r.disciplina end));
  return jsonb_build_object('ok', true);
end $$;

/** O registro de atividades. Igual a antes; o que revela quem está nos Revolucionários só aparece para quem vê o departamento. */
create or replace function public.auditoria_listar(p_pagina integer default 0, p_acao text default null) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_ve boolean;
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  v_ve := interno.ve_revolucionarios();
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'acao', a.acao, 'alvo', a.alvo, 'detalhes', a.detalhes, 'criado_em', a.criado_em,
      'alvo_nome', coalesce((select f.nome from perfis f where f.id::text = a.alvo), '')) order by a.id desc), '[]'::jsonb)
    from (select * from auditoria x where (coalesce(p_acao, '') = '' or x.acao = p_acao) and (v_ve or not interno.auditoria_reservada(x))
          order by x.id desc limit 100 offset greatest(coalesce(p_pagina, 0), 0) * 100) a);
end $$;

/** Quem faz o site: nome escolhido e papéis. Igual a antes, sem a representação dos Revolucionários. */
create or replace function public.equipe() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome', f.nome, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, f.nome), '[]'::jsonb)
  from papeis p join perfis f on f.id = p.usuario where not f.suspenso and interno.papel_visivel(p.usuario, p.disciplina)
$$;

/** A equipe para a supervisão. Igual a antes, sem a representação dos Revolucionários para quem não vê o departamento. */
create or replace function public.equipe_supervisao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'suspenso', f.suspenso, 'suspensao', f.suspensao, 'visto_em', f.visto_em, 'eu', f.id = v,
      'protegida', exists (select 1 from papeis p where p.usuario = f.id and p.papel in ('coordenacao', 'vice', 'supervisao')),
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina) from papeis p where p.usuario = f.id and interno.papel_visivel(p.usuario, p.disciplina)), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f where exists (select 1 from papeis p where p.usuario = f.id and interno.papel_visivel(p.usuario, p.disciplina)));
end $$;

/** Quem faz parte da equipe, para a rede interna. Igual a antes, sem a representação dos Revolucionários para quem não vê o departamento. */
create or replace function public.equipe_membros() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.voluntario() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', interno.nome_visto(f.nome), 'bio', f.bio, 'avatar', f.avatar, 'eu', f.id = auth.uid(), 'por_aqui', f.visto_em > now() - interval '90 minutes',
      'privado', interno.privado_permitido(f.id),
      -- Quem esconde o "visto por último" não o mostra e não vê o dos outros.
      'online', case when f.presenca = 'invisivel' and f.id <> auth.uid() then false when f.id = auth.uid() or (f.chat_visto and coalesce((select p.chat_visto from perfis p where p.id = auth.uid()), true)) then f.visto_em > now() - interval '2 minutes' end,
      'presenca', case when f.presenca = 'invisivel' and f.id <> auth.uid() then 'online' else f.presenca end, 'frase', f.frase, 'capa', f.capa,
      'desde', (select min(p.criado_em) from papeis p where p.usuario = f.id),
      'visto_em', case when f.id = auth.uid() or (f.chat_visto and coalesce((select p.chat_visto from perfis p where p.id = auth.uid()), true)) then f.visto_em end,
      'papeis', (select jsonb_agg(jsonb_build_object('papel', p.papel, 'disciplina', p.disciplina) order by p.papel, p.disciplina) from papeis p where p.usuario = f.id and interno.papel_visivel(p.usuario, p.disciplina)),
      'ferias_ate', case when f.ferias_ate >= current_date then f.ferias_ate end, 'oficios', to_jsonb(f.oficios))
      order by f.nome), '[]'::jsonb)
    from perfis f where not f.suspenso and exists (select 1 from papeis p where p.usuario = f.id and interno.papel_visivel(p.usuario, p.disciplina)));
end $$;

/** A equipe para quem gere cargos. Igual a antes; a representação dos Revolucionários some junto com o departamento. */
create or replace function public.voluntarios_listar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_coord boolean := interno.coord();
begin
  if not interno.gere_cargos() then perform interno.erro('sem_permissao'); end if;
  if interno.lider() then perform interno.registrar_acesso('emails_da_equipe'); end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', interno.nome_visto(f.nome), 'bio', f.bio, 'email', case when interno.lider() then u.email else '' end, 'suspenso', f.suspenso, 'suspensao', f.suspensao, 'trocar_senha', f.trocar_senha,
      'criado_em', f.criado_em, 'visto_em', f.visto_em, 'nivel', interno.nivel_de(f.id),
      'papeis', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'papel', p.papel, 'disciplina', p.disciplina) order by interno.nivel(p.papel) desc, p.papel, p.disciplina) from papeis p where p.usuario = f.id and interno.papel_visivel(p.usuario, p.disciplina)), '[]'::jsonb),
      'departamentos', coalesce((select jsonb_agg(m.departamento order by m.departamento) from departamento_membros m where m.usuario = f.id and (v_coord or m.departamento <> 'revolucionarios')), '[]'::jsonb))
      order by f.nome), '[]'::jsonb)
    from perfis f join auth.users u on u.id = f.id);
end $$;

/**
 * Tudo de um departamento. Igual a antes, com dois cuidados: nos Revolucionários, quem não é da coordenação nem do
 * departamento vê só a descrição (nem pessoas, nem quadro, nem bastões, nem pedidos, que trazem nomes); nos outros, a
 * representação dos Revolucionários não aparece nos papéis de ninguém, e quem só representa os Revolucionários não
 * aparece entre os Representantes.
 */
create or replace function public.departamento_ver(p_id text) returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare d departamentos_info; v_ve_pessoas boolean;
begin
  perform interno.eu();
  -- Quem só participa do departamento (sem função de trabalho, como um militante ou um coletivo parceiro) também abre o dele.
  if not (interno.voluntario() or ((interno.aal2() or not interno.tem_fator()) and interno.membro_direto(auth.uid(), p_id))) then perform interno.erro('sem_permissao'); end if;
  select * into d from departamentos_info where id = p_id;
  if not found then perform interno.erro('nao_encontrado'); end if;
  v_ve_pessoas := d.id <> 'revolucionarios' or interno.coord() or interno.membro_direto(auth.uid(), d.id);
  if not v_ve_pessoas then
    return jsonb_build_object(
      'id', d.id, 'descricao', d.descricao, 'como', d.como, 'meta_titulo', d.meta_titulo, 'meta_alvo', d.meta_alvo, 'meta_feito', d.meta_feito, 'atualizado_em', d.atualizado_em,
      'meu', false, 'respondo', false, 'reservado', true, 'pessoas', '[]'::jsonb, 'recebidos', '[]'::jsonb, 'enviados', '[]'::jsonb,
      'quadro', '[]'::jsonb, 'feitos_no_mes', 0, 'bastoes', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'id', d.id, 'descricao', d.descricao, 'como', d.como, 'meta_titulo', d.meta_titulo, 'meta_alvo', d.meta_alvo, 'meta_feito', d.meta_feito, 'atualizado_em', d.atualizado_em,
    'meu', interno.membro_direto(auth.uid(), d.id), 'respondo', interno.responde_departamento(d.id), 'reservado', false,
    'pessoas', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', interno.nome_visto(f.nome), 'avatar', f.avatar,
                  'responde', exists (select 1 from papeis r where r.usuario = f.id and r.papel = 'representante' and r.disciplina = d.id),
                  'ferias_ate', case when f.ferias_ate >= current_date then f.ferias_ate end,
                  'oficios', to_jsonb(f.oficios),
                  -- Desde quando a pessoa está neste departamento (para o rodízio: depois de um ano, ensinar alguém).
                  'desde', least((select min(p.criado_em) from papeis p where p.usuario = f.id and (p.papel = d.id or p.disciplina = d.id or (d.id = 'jornalismo' and p.papel = 'marketing')
                                   or (d.id = 'coordenacao' and p.papel in ('coordenacao', 'vice')) or (d.id = 'representantes' and p.papel = 'representante' and interno.papel_visivel(p.usuario, p.disciplina)))),
                                 (select m.criado_em from departamento_membros m where m.usuario = f.id and m.departamento = d.id)),
                  'papeis', (select jsonb_agg(jsonb_build_object('papel', p.papel, 'disciplina', p.disciplina)) from papeis p where p.usuario = f.id and interno.papel_visivel(p.usuario, p.disciplina)))
                  order by exists (select 1 from papeis r where r.usuario = f.id and r.papel = 'representante' and r.disciplina = d.id) desc, f.nome), '[]'::jsonb)
                from perfis f where interno.membro_direto(f.id, d.id)
                  and (d.id <> 'representantes' or interno.ve_revolucionarios()
                       or exists (select 1 from departamento_membros m where m.usuario = f.id and m.departamento = 'representantes')
                       or exists (select 1 from papeis r where r.usuario = f.id and r.papel = 'representante' and r.disciplina is distinct from 'revolucionarios'))),
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

/** A lista dos departamentos. Igual a antes; quantas pessoas há nos Revolucionários (e quem só os representa), só para quem vê o departamento. */
create or replace function public.departamentos_resumo() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v_equipe boolean; v_ve boolean;
begin
  perform interno.eu();
  v_equipe := interno.voluntario();
  if not v_equipe and not ((interno.aal2() or not interno.tem_fator()) and exists (select 1 from departamento_membros where usuario = auth.uid())) then perform interno.erro('sem_permissao'); end if;
  v_ve := interno.ve_revolucionarios();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'descricao', d.descricao,
            'pessoas', case when d.id = 'revolucionarios' and not v_ve then null
                            else (select count(*) from perfis f where interno.membro_direto(f.id, d.id)
                                    and (d.id <> 'representantes' or v_ve
                                         or exists (select 1 from departamento_membros m where m.usuario = f.id and m.departamento = 'representantes')
                                         or exists (select 1 from papeis r where r.usuario = f.id and r.papel = 'representante' and r.disciplina is distinct from 'revolucionarios'))) end,
            'pedidos', (select count(*) from departamento_pedidos p where p.para = d.id and p.status in ('aberto', 'aceito')),
            'meu', interno.membro_direto(auth.uid(), d.id), 'respondo', interno.responde_departamento(d.id)) order by d.id), '[]'::jsonb)
          from departamentos_info d where v_equipe or interno.membro_direto(auth.uid(), d.id));
end $$;

-- ── 3. Inscrições: militante só com e-mail confirmado, sem oráculo, sem nada sensível em e-mail ───────────────────────

/** Os pedidos de voluntariado que esperam a coordenação, para a supervisão acompanhar. A inscrição militante, não (dado sensível). */
create or replace function public.pedidos_supervisao() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.supervisor() then perform interno.erro('sem_permissao'); end if;
  return (
    select coalesce(jsonb_agg(x.j order by x.criado_em), '[]'::jsonb) from (
      select i.criado_em, jsonb_build_object('id', i.id, 'origem', 'formulario', 'nome', i.nome, 'papel', i.papel, 'disciplina', i.disciplina, 'mensagem', i.mensagem, 'criado_em', i.criado_em) as j
      from inscricoes i where i.status = 'pendente' and i.tipo <> 'militante'
      union all
      select c.criado_em, jsonb_build_object('id', c.id, 'origem', 'painel', 'nome', coalesce(f.nome, ''), 'papel', c.papel, 'disciplina', c.disciplina, 'mensagem', c.mensagem, 'criado_em', c.criado_em)
      from candidaturas c left join perfis f on f.id = c.usuario where c.status = 'pendente') x);
end $$;

-- A inscrição militante esperando a confirmação do e-mail. Só o resumo do código (interno.selo) fica guardado; some em 3
-- dias se ninguém confirmar. Sem consentimento_em: o consentimento só vale de quem provou ser dona do endereço.
create table if not exists interno.inscricoes_a_confirmar (
  id uuid primary key default gen_random_uuid(),
  selo text not null unique,
  nome text not null,
  email text not null,
  papel text not null,
  disciplina text,
  mensagem text not null,
  instagram text,
  criado_em timestamptz not null default now()
);
create index if not exists inscricoes_a_confirmar_email on interno.inscricoes_a_confirmar (email, criado_em);
alter table interno.inscricoes_a_confirmar enable row level security;
revoke all on interno.inscricoes_a_confirmar from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on interno.inscricoes_a_confirmar from anon, authenticated; end if;
end $$;

/**
 * Quem quer ser voluntário (ou militante, T15) preenche o formulário, sem conta. Igual a antes, com três mudanças (T33):
 *  - pedido repetido, ou e-mail que já recebeu dois pedidos no dia, recebe a MESMA resposta de sucesso e nada é gravado
 *    nem enviado (antes, "ja_pediu" dizia a qualquer um se um e-mail tinha inscrição militante);
 *  - a inscrição militante fica esperando a confirmação do e-mail: vai só um e-mail neutro com o link (sem citar a Frente
 *    nem militância), e nada chega à coordenação antes do clique (public.inscricao_confirmar);
 *  - o aviso à liderança de inscrição militante não leva os dados da pessoa no corpo do e-mail (o de voluntariado segue igual).
 */
create or replace function public.voluntariar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_papel text := coalesce(p ->> 'papel', '');
  v_disc text := interno.disciplina_ok(p ->> 'disciplina');
  v_tipo text := coalesce(nullif(p ->> 'tipo', ''), 'voluntario');
  v_militante boolean;
  v_nome text; v_mensagem text; v_id uuid; v_codigo text;
  v_instagram text := nullif(regexp_replace(btrim(coalesce(p ->> 'instagram', '')), '^@', ''), '');
begin
  perform interno.aberta('voluntariado');
  -- Campo-isca: gente não vê, robô preenche. Finge que deu certo e não guarda nada.
  if coalesce(p ->> 'site', '') <> '' then return jsonb_build_object('id', gen_random_uuid()); end if;
  perform interno.limite('voluntariar', 3, 1440);
  if v_tipo not in ('voluntario', 'militante') then perform interno.erro('invalido:tipo'); end if;
  v_militante := v_tipo = 'militante';
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or char_length(v_email) > 200 then perform interno.erro('invalido:email'); end if;
  if v_papel not in ('curadoria', 'mediacao', 'educacao', 'educacao_secundaria', 'revisao', 'traducao', 'jornalismo', 'mentoria', 'design', 'marketing', 'desenvolvimento', 'porta_voz', 'saude') then perform interno.erro('invalido:papel'); end if;
  if v_papel in ('educacao', 'educacao_secundaria', 'mentoria') and v_disc is null then perform interno.erro('invalido:disciplina'); end if;
  if v_papel not in ('educacao', 'educacao_secundaria', 'mentoria') then v_disc := null; end if;
  -- Militante: consentimento destacado para o dado sensível (LGPD, art. 11, I) e 18 anos ou mais (LGPD, art. 14).
  if v_militante and coalesce(p ->> 'consentimento', '') <> 'true' then perform interno.erro('invalido:consentimento'); end if;
  if v_militante and coalesce(p ->> 'maior_idade', '') <> 'true' then perform interno.erro('invalido:idade'); end if;
  v_nome := interno.txt(p ->> 'nome', 'nome', 5, 120);
  -- Nome e sobrenome: a coordenação precisa saber quem está pedindo acesso.
  if array_length(regexp_split_to_array(btrim(v_nome), '\s+'), 1) < 2 then perform interno.erro('invalido:nome'); end if;
  if v_instagram is not null and v_instagram !~ '^[A-Za-z0-9._]{1,30}$' then perform interno.erro('invalido:instagram'); end if;
  v_mensagem := interno.txt(p ->> 'mensagem', 'mensagem', 30, 2000);
  if interno.vetado(v_nome || ' ' || v_mensagem) then perform interno.erro('conteudo_recusado'); end if;
  if random() < 0.05 then delete from inscricoes_a_confirmar where criado_em < now() - interval '3 days'; end if;
  -- Repetido, ou o mesmo e-mail com pedidos demais no dia: a resposta é igual à de sucesso, e nada é gravado nem enviado.
  if exists (select 1 from inscricoes where email = v_email and papel = v_papel and tipo = v_tipo and status = 'pendente')
     or (v_militante and exists (select 1 from inscricoes_a_confirmar where email = v_email and papel = v_papel and criado_em > now() - interval '3 days'))
     or (select count(*) from inscricoes where email = v_email and criado_em > now() - interval '1 day')
        + (select count(*) from inscricoes_a_confirmar where email = v_email and criado_em > now() - interval '1 day') >= 2 then
    return jsonb_build_object('id', gen_random_uuid());
  end if;
  if v_militante then
    v_codigo := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into inscricoes_a_confirmar (selo, nome, email, papel, disciplina, mensagem, instagram)
      values (interno.selo(v_codigo), v_nome, v_email, v_papel, v_disc, v_mensagem, v_instagram)
      returning id into v_id;
    -- Neutro de propósito: a caixa de e-mail pode ser do trabalho ou da família, e o endereço pode nem ser de quem preencheu.
    perform interno.email(v_email, 'inscricao_recebida', 'Confirme o seu e-mail no Instituto Lúcia',
      E'Olá.\n\nEste endereço foi informado num formulário do Instituto Lúcia. Para confirmar que foi você, abra o endereço abaixo (ele vale por 3 dias e só funciona uma vez):\n\n'
      || interno.endereco() || '/pt/voluntarios?confirmar=' || v_codigo
      || E'\n\nSe não foi você, é só ignorar esta mensagem: nada fica guardado, e o pedido some sozinho em 3 dias.');
    return jsonb_build_object('id', v_id);
  end if;
  insert into inscricoes (nome, email, papel, disciplina, mensagem, instagram, tipo)
    values (v_nome, v_email, v_papel, v_disc, v_mensagem, v_instagram, 'voluntario')
    returning id into v_id;
  perform interno.email(v_email, 'inscricao_recebida', 'Recebemos seu pedido de voluntariado',
    'Olá, ' || coalesce(nullif(left(split_part(interno.sem_link(v_nome), ' ', 1), 40), ''), 'tudo bem') || E'.\n\nRecebemos seu pedido para atuar como voluntário(a) no Instituto Lúcia, na função de ' || interno.nome_papel(v_papel) || E'.\n\n'
    || E'A coordenação lê cada pedido e responde por este mesmo endereço. Se o pedido for aceito, chega aqui o link para você criar a sua conta e entrar no painel da equipe.\n\n'
    || 'Se não foi você quem enviou este pedido, é só ignorar esta mensagem.');
  perform interno.email_lideranca('inscricao_nova', 'Novo pedido de voluntariado: ' || left(interno.sem_link(v_nome), 60),
    interno.sem_link(v_nome) || ' (' || v_email || coalesce(', Instagram @' || v_instagram, '') || ') quer atuar na função de ' || interno.nome_papel(v_papel) || E'.\n\nLeia o pedido e decida no painel: ' || interno.endereco() || '/pt/painel?aba=pessoas');
  return jsonb_build_object('id', v_id);
end $$;

/**
 * O clique no link do e-mail: a inscrição militante passa a existir, com o consentimento registrado agora (de quem provou
 * ser dona do endereço), e a liderança recebe um aviso sem dado nenhum da pessoa. Código errado, vencido ou já usado:
 * "nao_encontrado", sem dizer qual.
 */
create or replace function public.inscricao_confirmar(p_codigo text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare c inscricoes_a_confirmar;
begin
  perform interno.aberta('voluntariado');
  perform interno.limite('inscricao_confirmar', 20, 60);
  if coalesce(p_codigo, '') !~ '^[0-9a-f]{64}$' then perform interno.erro('nao_encontrado'); end if;
  delete from inscricoes_a_confirmar where selo = interno.selo(p_codigo) returning * into c;
  if c.id is null or c.criado_em < now() - interval '3 days' then perform interno.erro('nao_encontrado'); end if;
  if not exists (select 1 from inscricoes where email = c.email and papel = c.papel and tipo = 'militante' and status = 'pendente') then
    insert into inscricoes (nome, email, papel, disciplina, mensagem, instagram, tipo, consentimento_em, maior_idade)
      values (c.nome, c.email, c.papel, c.disciplina, c.mensagem, c.instagram, 'militante', now(), true);
    perform interno.email_lideranca('inscricao_nova', 'Há uma inscrição nova no painel',
      E'Há uma inscrição nova esperando no painel. Leia e decida em: ' || interno.endereco() || '/pt/painel?aba=pessoas');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 4. Chat privado da Alumia: provas guardadas, recusas respeitadas, versões com limite ─────────────────────────────

-- Quando cada participante apagou a conversa da própria lista. Mensagem anterior a essa hora some só para quem apagou; a
-- outra pessoa continua com ela até o prazo (e pode denunciar). Quando os dois apagam, o que os dois apagaram some de vez.
alter table interno.rede_dm_conversas add column if not exists a_apagou_em timestamptz;
alter table interno.rede_dm_conversas add column if not exists b_apagou_em timestamptz;

/** Limites do chat, por pessoa. Igual a antes, mais "versao" (versão nova da chave da conversa): 20 por hora. */
create or replace function interno.rede_dm_limite(p_acao text) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v_teto integer; v_minutos integer := 60;
  v_nova boolean := exists (select 1 from auth.users u where u.id = auth.uid() and u.created_at > now() - interval '3 days');
begin
  v_teto := case p_acao when 'enviar' then 120 when 'pedir' then 20 when 'ler' then 1200 when 'chave' then 10 when 'denunciar' then 10 when 'apagar' then 200 when 'versao' then 20 else null end;
  if v_teto is null then perform interno.erro('acao_desconhecida'); end if;
  if p_acao in ('pedir', 'chave', 'denunciar') then v_minutos := 1440; end if;
  if v_nova and p_acao <> 'ler' then v_teto := greatest(1, v_teto / 2); end if;
  perform interno.limite('rede_dm_' || p_acao, v_teto, v_minutos);
end $$;

/** O que os dois participantes apagaram some de vez; a conversa que os dois apagaram e ficou vazia também. */
create or replace function interno.rede_dm_podar(p_conversa uuid) returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_dm_mensagens m using rede_dm_conversas c
  where c.id = m.conversa and (p_conversa is null or c.id = p_conversa)
    and c.a_apagou_em is not null and c.b_apagou_em is not null and m.criado_em <= least(c.a_apagou_em, c.b_apagou_em);
  delete from rede_dm_conversas c
  where (p_conversa is null or c.id = p_conversa) and c.a_apagou_em is not null and c.b_apagou_em is not null
    and not exists (select 1 from rede_dm_mensagens m where m.conversa = c.id);
end $$;

/** A faxina do chat. Igual a antes, mais a poda do que os dois participantes apagaram. */
create or replace function interno.rede_dm_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  delete from rede_dm_mensagens where expira_em <= now();
  delete from rede_dm_conversas where situacao = 'pedido' and criado_em < now() - interval '30 days';
  delete from rede_dm_recusas where ate <= now();
  perform interno.rede_dm_podar(null);
  -- Embrulhos de versões antigas, sem nenhuma mensagem viva que precise deles (a versão atual fica sempre).
  delete from rede_dm_embrulhos e using rede_dm_conversas c
  where c.id = e.conversa and e.versao < c.versao
    and not exists (select 1 from rede_dm_mensagens m where m.conversa = e.conversa and m.versao = e.versao);
end $$;

/** Minhas conversas e pedidos. Igual a antes; a conversa que apaguei só volta à lista se chegar mensagem nova. */
create or replace function public.rede_dm_conversas() returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_dm_limite('ler');
  perform interno.rede_dm_talvez_faxina();
  return coalesce((
    select jsonb_agg(interno.rede_dm_json(c, v) order by c.ultima_em desc)
    from rede_dm_conversas c
    where (c.a = v or c.b = v) and not (c.situacao = 'pedido' and interno.rede_bloqueado(v, interno.rede_dm_outro(c, v)))
      and not (case when c.a = v then c.a_apagou_em else c.b_apagou_em end is not null and c.ultima_em <= case when c.a = v then c.a_apagou_em else c.b_apagou_em end)
  ), '[]'::jsonb);
end $$;

/** As mensagens (cifradas). Igual a antes; quem apagou a conversa não vê mais o que veio antes de apagar. */
create or replace function public.rede_dm_mensagens(p_conversa uuid, p_antes timestamptz default null, p_limite integer default 50) returns jsonb language plpgsql volatile security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas; v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100); v_desde timestamptz;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.rede_dm_limite('ler');
  c := interno.rede_dm_minha(p_conversa, v);
  if c.situacao <> 'aberta' then perform interno.erro('dm_fechada'); end if;
  v_desde := coalesce(case when c.a = v then c.a_apagou_em else c.b_apagou_em end, '-infinity'::timestamptz);
  if p_antes is null then
    update rede_dm_conversas set a_leu_em = case when a = v then now() else a_leu_em end, b_leu_em = case when b = v then now() else b_leu_em end where id = c.id;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'autor', x.autor, 'versao', x.versao, 'corpo', x.corpo, 'criado_em', x.criado_em, 'expira_em', x.expira_em) order by x.criado_em desc)
    from (select * from rede_dm_mensagens m where m.conversa = c.id and m.expira_em > now() and m.criado_em > v_desde and (p_antes is null or m.criado_em < p_antes)
          order by m.criado_em desc limit v_limite) x
  ), '[]'::jsonb);
end $$;

/**
 * Apaga uma mensagem minha, para os dois. Depois de bloqueio (de qualquer lado) ou com denúncia aberta da outra pessoa
 * contra mim, não: a mensagem é prova (ECA art. 241-D; Marco Civil art. 10) e some sozinha no prazo da conversa.
 */
create or replace function public.rede_dm_apagar_mensagem(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); m rede_dm_mensagens; c rede_dm_conversas; o uuid;
begin
  perform interno.rede_dm_limite('apagar');
  select * into m from rede_dm_mensagens where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  select * into c from rede_dm_conversas where id = m.conversa;
  o := interno.rede_dm_outro(c, v);
  if interno.rede_bloqueado(v, o)
     or exists (select 1 from rede_denuncias d where d.quem = o and d.alvo_tipo = 'perfil' and d.alvo = v::text and d.situacao in ('aberta', 'em_analise')) then
    perform interno.erro('dm_fechada');
  end if;
  delete from rede_dm_mensagens where id = m.id;
  return jsonb_build_object('ok', true);
end $$;

/**
 * Apaga a conversa da MINHA lista (LGPD art. 18, VI): o que veio antes some para mim. A outra pessoa continua com as
 * mensagens até o prazo da conversa, e pode denunciar; quando ela também apagar, tudo some de vez. Pedido sem resposta: some.
 */
create or replace function public.rede_dm_apagar(p_conversa uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas;
begin
  perform interno.rede_dm_limite('apagar');
  c := interno.rede_dm_minha(p_conversa, v);
  if c.situacao = 'pedido' then
    delete from rede_dm_conversas where id = c.id;
    return jsonb_build_object('ok', true);
  end if;
  update rede_dm_conversas set
    a_apagou_em = case when a = v then now() else a_apagou_em end, b_apagou_em = case when b = v then now() else b_apagou_em end,
    a_leu_em = case when a = v then now() else a_leu_em end, b_leu_em = case when b = v then now() else b_leu_em end
  where id = c.id;
  perform interno.rede_dm_podar(c.id);
  return jsonb_build_object('ok', true);
end $$;

/** Prazo das mensagens desta conversa (1, 7 ou 30 dias). Vale para as mensagens NOVAS: encurtar não apaga o que já foi escrito. */
create or replace function public.rede_dm_prazo(p_conversa uuid, p_dias integer) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); c rede_dm_conversas;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  if coalesce(p_dias, 0) not in (1, 7, 30) then perform interno.erro('invalido:prazo'); end if;
  c := interno.rede_dm_minha(p_conversa, v);
  update rede_dm_conversas set prazo_dias = p_dias where id = c.id;
  return jsonb_build_object('prazo_dias', p_dias);
end $$;

/**
 * Apaga tudo o que é meu no chat (chave, preferências, as recusas que EU fiz) e tira todas as conversas da minha lista,
 * sem apagar a conta (LGPD art. 18, VI). As recusas que outras pessoas fizeram contra mim ficam (são delas, até vencer),
 * e as mensagens ficam com a outra pessoa até o prazo de cada conversa.
 */
create or replace function public.rede_dm_apagar_tudo() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); n integer;
begin
  perform interno.rede_dm_limite('apagar');
  select count(*) into n from rede_dm_conversas where a = v or b = v;
  delete from rede_dm_conversas where (a = v or b = v) and situacao = 'pedido';
  update rede_dm_conversas set
    a_apagou_em = case when a = v then now() else a_apagou_em end, b_apagou_em = case when b = v then now() else b_apagou_em end,
    a_leu_em = case when a = v then now() else a_leu_em end, b_leu_em = case when b = v then now() else b_leu_em end
  where a = v or b = v;
  perform interno.rede_dm_podar(null);
  delete from rede_dm_chaves where usuario = v;
  delete from rede_dm_prefs where usuario = v;
  delete from rede_dm_recusas where quem = v;
  return jsonb_build_object('conversas', n);
end $$;

/**
 * Uma versão nova da chave da conversa. Igual a antes, com freio: 20 por hora por pessoa, e nenhuma versão nova enquanto a
 * atual tem menos de 5 minutos e já está embrulhada para a chave atual dos dois (trocar de aparelho continua valendo na hora).
 */
create or replace function public.rede_dm_nova_versao(p_conversa uuid, p_versao integer, p_embrulhos jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); c rede_dm_conversas; o uuid; minha rede_dm_chaves; e jsonb; k rede_dm_chaves; v_para uuid; n integer := 0;
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into c from rede_dm_conversas where id = p_conversa and (a = v or b = v) for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  o := interno.rede_dm_outro(c, v);
  if c.situacao <> 'aberta' or interno.rede_bloqueado(v, o) or not interno.rede2_membro(o) then perform interno.erro('dm_fechada'); end if;
  if p_versao is distinct from c.versao + 1 then perform interno.erro('versao_desatualizada'); end if;
  if c.versao > 0 and c.versao_em > now() - interval '5 minutes'
     and (select count(*) from rede_dm_embrulhos x join rede_dm_chaves kk on kk.usuario = x.para and kk.versao = x.chave_versao
          where x.conversa = c.id and x.versao = c.versao) = 2 then
    perform interno.erro('versao_desatualizada');
  end if;
  perform interno.rede_dm_limite('versao');
  select * into minha from rede_dm_chaves where usuario = v;
  if not found then perform interno.erro('dm_sem_chave'); end if;
  if jsonb_typeof(p_embrulhos) <> 'array' or jsonb_array_length(p_embrulhos) <> 2 then perform interno.erro('invalido:embrulhos'); end if;
  for e in select * from jsonb_array_elements(p_embrulhos) loop
    begin v_para := (e ->> 'para')::uuid; exception when others then perform interno.erro('invalido:embrulhos'); end;
    if v_para not in (c.a, c.b) then perform interno.erro('invalido:embrulhos'); end if;
    select * into k from rede_dm_chaves where usuario = v_para;
    if not found then perform interno.erro('dm_sem_chave'); end if;
    if (e ->> 'chave_versao')::integer is distinct from k.versao then perform interno.erro('versao_desatualizada'); end if;
    if coalesce(e ->> 'embrulho', '') !~ '^w1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' then perform interno.erro('invalido:embrulho'); end if;
    insert into rede_dm_embrulhos (conversa, versao, para, chave_versao, embrulho, de, de_publica, de_certificado)
    values (c.id, p_versao, v_para, k.versao, e ->> 'embrulho', v, minha.publica, minha.certificado);
    n := n + 1;
  end loop;
  if n <> 2 or (select count(distinct para) from rede_dm_embrulhos where conversa = c.id and versao = p_versao) <> 2 then perform interno.erro('invalido:embrulhos'); end if;
  update rede_dm_conversas set versao = p_versao, versao_em = now() where id = c.id;
  perform interno.rede_dm_talvez_faxina();
  return jsonb_build_object('versao', p_versao);
end $$;

-- ── 5. Faxina e permissões ──────────────────────────────────────────────────────────────────────────────────────────

/** A faxina desta auditoria: origem de quem não entra há 30 dias e inscrições militantes não confirmadas em 3 dias. */
create or replace function interno.t33_faxina() returns void language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  update perfis set origem = null where origem is not null and (visto_em is null or visto_em < now() - interval '30 days');
  delete from inscricoes_a_confirmar where criado_em < now() - interval '3 days';
end $$;
select interno.t33_faxina();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lucia-t33-faxina', '47 5 * * *', 'select interno.t33_faxina()');
  end if;
exception when others then null;
end $$;

revoke all on function interno.ve_revolucionarios(), interno.papel_visivel(uuid, text), interno.auditoria_reservada(interno.auditoria),
  interno.departamento_pedido_json(interno.departamento_pedidos), interno.rede_dm_podar(uuid), interno.rede_dm_limite(text),
  interno.rede_dm_faxina(), interno.t33_faxina() from public;
do $$
declare f record;
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.ve_revolucionarios(), interno.papel_visivel(uuid, text), interno.auditoria_reservada(interno.auditoria),
      interno.departamento_pedido_json(interno.departamento_pedidos), interno.rede_dm_podar(uuid), interno.rede_dm_limite(text),
      interno.rede_dm_faxina(), interno.t33_faxina(), interno.origem() from anon, authenticated;
  end if;
  -- As funções da API redefinidas aqui: as mesmas permissões de antes.
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('papel_remover', 'auditoria_listar', 'equipe', 'equipe_supervisao', 'equipe_membros', 'voluntarios_listar',
             'departamento_ver', 'departamentos_resumo', 'pedidos_supervisao', 'voluntariar', 'inscricao_confirmar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated, service_role', f.assinatura);
    end if;
  end loop;
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rede_dm_conversas', 'rede_dm_mensagens', 'rede_dm_apagar_mensagem', 'rede_dm_apagar', 'rede_dm_prazo',
             'rede_dm_apagar_tudo', 'rede_dm_nova_versao') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.assinatura);
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;
