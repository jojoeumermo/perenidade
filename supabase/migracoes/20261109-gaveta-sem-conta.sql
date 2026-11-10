-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
-- Gaveta Aberta sem conta (09/11/2026): qualquer pessoa envia por link; o envio cai na fila de aprovação do painel. O PDF
-- no depósito continua pedindo conta. Quem enviou sem conta não recebe aviso (não há para quem avisar).

alter table interno.gaveta alter column autor drop not null;

create or replace function public.gaveta_enviar(p jsonb) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid; v_id uuid; v_tipo text := coalesce(p ->> 'tipo', ''); v_licenca text := coalesce(nullif(p ->> 'licenca', ''), 'CC BY 4.0');
  v_link text := btrim(coalesce(p ->> 'link', '')); v_arquivo text := btrim(coalesce(p ->> 'arquivo', '')); v_ano smallint;
  v_titulo text; v_comentario text; v_curso text; v_instituicao text; v_credito text; v_termo_nome text; v_disciplina text;
  v_exercicio uuid;
begin
  perform interno.aberta('gaveta');
  -- Sem conta também se envia (09/11/2026), só por link: o PDF no depósito continua pedindo conta (a pasta é da pessoa).
  -- Sem conta, o limite é por origem e menor; tudo cai na mesma fila de aprovação do painel.
  if auth.uid() is null then
    if btrim(coalesce(p ->> 'arquivo', '')) <> '' then perform interno.erro('entre_primeiro'); end if;
    perform interno.limite('gaveta_sem_conta', 2, 1440);
  else
    v := interno.eu();
    perform interno.limite('gaveta', 5, 1440);
  end if;
  if not coalesce((p ->> 'termo')::boolean, false) or coalesce(p ->> 'termo_versao', '') <> interno.gaveta_termo_versao() then perform interno.erro('falta_termo'); end if;
  if v_tipo not in ('tcc', 'monografia', 'dissertacao', 'artigo', 'projeto', 'relatorio', 'apostila', 'codigo', 'apresentacao', 'outro') then perform interno.erro('invalido:tipo'); end if;
  if v_licenca not in ('CC BY 4.0', 'CC BY-SA 4.0', 'CC0 1.0') then perform interno.erro('invalido:licenca'); end if;
  v_disciplina := interno.disciplina_ok(p ->> 'disciplina');
  if v_disciplina is null then perform interno.erro('invalido:disciplina'); end if;
  v_titulo := interno.txt(p ->> 'titulo', 'titulo', 5, 160);
  v_comentario := interno.txt(p ->> 'comentario', 'comentario', 40, 2000);
  v_curso := interno.txt(p ->> 'curso', 'curso', 0, 120);
  v_instituicao := interno.txt(p ->> 'instituicao', 'instituicao', 0, 160);
  v_credito := interno.txt(p ->> 'credito', 'credito', 2, 120);
  v_termo_nome := interno.txt(p ->> 'termo_nome', 'termo_nome', 5, 160);
  if coalesce(p ->> 'ano', '') <> '' then
    if (p ->> 'ano') !~ '^[0-9]{4}$' or (p ->> 'ano')::int < 1950 or (p ->> 'ano')::int > extract(year from now())::int then perform interno.erro('invalido:ano'); end if;
    v_ano := (p ->> 'ano')::smallint;
  end if;
  if (v_link = '') = (v_arquivo = '') then perform interno.erro('invalido:arquivo'); end if;
  if v_link <> '' and (v_link !~ '^https://[^[:space:]]+$' or char_length(v_link) > 500) then perform interno.erro('invalido:link'); end if;
  -- O PDF tem de estar na pasta da própria pessoa; onde o depósito existe, confere que o arquivo chegou mesmo.
  if v_arquivo <> '' then
    if v_arquivo !~ ('^' || v::text || '/[0-9a-f-]{36}[.]pdf$') then perform interno.erro('invalido:arquivo'); end if;
    if to_regclass('storage.objects') is not null then
      if not exists (select 1 from storage.objects where bucket_id = 'gaveta' and name = v_arquivo) then perform interno.erro('invalido:arquivo'); end if;
    end if;
  end if;
  if interno.vetado(v_titulo || ' ' || v_comentario || ' ' || v_curso || ' ' || v_instituicao || ' ' || v_credito) then perform interno.erro('conteudo_recusado'); end if;
  -- Entrega de um exercício de prática: o exercício tem de existir, estar ativo e ser da mesma disciplina.
  if coalesce(p ->> 'exercicio', '') <> '' then
    if (p ->> 'exercicio') !~ '^[0-9a-f-]{36}$' then perform interno.erro('invalido:exercicio'); end if;
    v_exercicio := (p ->> 'exercicio')::uuid;
    if not exists (select 1 from exercicios_pratica where id = v_exercicio and ativo and disciplina = v_disciplina) then perform interno.erro('invalido:exercicio'); end if;
  end if;
  insert into gaveta (autor, titulo, tipo, disciplina, curso, instituicao, ano, comentario, link, arquivo, licenca, credito, termo_nome, termo_versao, exercicio)
  values (v, v_titulo, v_tipo, v_disciplina, v_curso, v_instituicao, v_ano, v_comentario, v_link, v_arquivo, v_licenca, v_credito, v_termo_nome, interno.gaveta_termo_versao(), v_exercicio)
  returning id into v_id;
  if v_exercicio is not null then
    perform interno.avisar(p2.usuario, 'Chegou uma entrega do exercício "' || left(x.titulo, 80) || '". Veja em Exercícios de prática.')
    from exercicios_pratica x join papeis p2 on p2.papel in ('educacao', 'educacao_secundaria') and p2.disciplina = x.disciplina
    where x.id = v_exercicio;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.gaveta_decidir(p_id uuid, p_aprovar boolean, p_nota text default '') returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); g gaveta; v_nota text := interno.txt(p_nota, 'nota', 0, 1000); v_aprovar boolean := coalesce(p_aprovar, false);
begin
  if not interno.media() then perform interno.erro('sem_permissao'); end if;
  select * into g from gaveta where id = p_id for update;
  if not found then perform interno.erro('nao_encontrado'); end if;
  if g.status not in ('pendente', 'aprovado', 'recusado') then perform interno.erro('ja_decidida'); end if;
  if not v_aprovar and char_length(v_nota) < 5 then perform interno.erro('invalido:nota'); end if;
  update gaveta set status = case when v_aprovar then 'aprovado' else 'recusado' end, nota = v_nota, decidido_por = v, decidido_em = now() where id = p_id;
  perform interno.registrar(case when v_aprovar then 'gaveta_aprovada' else 'gaveta_recusada' end, g.titulo);
  if g.autor is not null then perform interno.avisar(g.autor, case when v_aprovar then 'Seu trabalho "' || left(g.titulo, 80) || '" foi publicado na Gaveta Aberta.'
    else 'Seu trabalho "' || left(g.titulo, 80) || '" não foi publicado na Gaveta Aberta: ' || left(v_nota, 300) end); end if;
  return jsonb_build_object('ok', true);
end $$;
