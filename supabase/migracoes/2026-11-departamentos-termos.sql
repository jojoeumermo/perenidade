-- ───────────────────────────── Departamentos e termos, novembro de 2026 (etapa 8, B10 e B15) ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Vai no fim do install.sql (a integração junta).
-- Documentação: docs/DEPARTAMENTOS-TERMOS.md.
--
-- B10. "Design" e "Desenvolvimento" viram um departamento só: UI/UX e Desenvolvimento (o id interno continua
--      'desenvolvimento'). Arte e design gráfico passam a ser da Comunicação (marketing e divulgação):
--        - quem tinha a função 'design' passa a ter 'marketing' (que já valia por 'design': materiais, imagens, Estúdio
--          de design, podcast), com a mesma data de entrada; ninguém perde acesso e ninguém ganha acesso novo ao código;
--        - quem era representante do departamento 'design' passa a representar a Comunicação ('jornalismo');
--        - o quadro, os pedidos e as passagens de bastão do departamento Design vão para a Comunicação;
--        - o canal e o grupo "design" do mural e das conversas ficam como estão (o texto já cifrado só abre com a chave
--          do grupo), agora com o nome "Arte e design (Comunicação)", e quem é da Comunicação (marketing) segue dentro;
--        - pedido, convite, candidatura, inscrição e aviso endereçados a 'design' são mapeados para a Comunicação, também
--          quando chegarem depois, de um navegador ou de uma versão antiga do site (gatilho de apelido).
-- B15. Termo de voluntário: quem aceitou e tem o texto guardado (interno.termos_aceites) continua. Quem aceitou "sem o
--      texto" (só a data no perfil) volta a ver o termo ao abrir o painel, para ler e aceitar; o aceite passa a exigir o
--      texto guardado. Ninguém fica sem texto. O termo de adesão das Horas também diz quando não tem texto guardado.
--
-- Dado de pessoa: nenhum dado novo. Só muda o nome da função de quem já tinha uma, e o aviso único que a pessoa recebe.

-- 1. Apelido: o que ainda chegar como 'design' vira Comunicação ─────────────────────────────────────────────
/** 'design' (valor antigo) vale como 'marketing'. Qualquer outro valor passa como veio. */
create or replace function interno.papel_sem_design(p text) returns text language sql immutable as $$
  select case when p = 'design' then 'marketing' else p end
$$;
/** A lista de funções de um aviso, sem 'design' e sem repetição. */
create or replace function interno.lista_sem_design(p text[]) returns text[] language sql immutable as $$
  select coalesce(array(select distinct interno.papel_sem_design(x) from unnest(coalesce(p, '{}')) x), '{}')
$$;

create or replace function interno.unificar_design_gatilho() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'papeis' then
    new.papel := interno.papel_sem_design(new.papel);
    if new.papel = 'representante' and new.disciplina = 'design' then new.disciplina := 'jornalismo'; end if;
  elsif tg_table_name in ('candidaturas', 'inscricoes', 'convites') then
    new.papel := interno.papel_sem_design(new.papel);
  elsif tg_table_name = 'equipe_mensagens' then
    new.para := interno.papel_sem_design(new.para);
  elsif tg_table_name = 'avisos_gerais' then
    new.para := interno.lista_sem_design(new.para);
  end if;
  return new;
end $$;

drop trigger if exists lucia_unificar_design on interno.papeis;
create trigger lucia_unificar_design before insert or update on interno.papeis for each row execute function interno.unificar_design_gatilho();
drop trigger if exists lucia_unificar_design on interno.candidaturas;
create trigger lucia_unificar_design before insert or update on interno.candidaturas for each row execute function interno.unificar_design_gatilho();
drop trigger if exists lucia_unificar_design on interno.inscricoes;
create trigger lucia_unificar_design before insert or update on interno.inscricoes for each row execute function interno.unificar_design_gatilho();
drop trigger if exists lucia_unificar_design on interno.convites;
create trigger lucia_unificar_design before insert or update on interno.convites for each row execute function interno.unificar_design_gatilho();
drop trigger if exists lucia_unificar_design on interno.equipe_mensagens;
create trigger lucia_unificar_design before insert or update of para on interno.equipe_mensagens for each row execute function interno.unificar_design_gatilho();
drop trigger if exists lucia_unificar_design on interno.avisos_gerais;
create trigger lucia_unificar_design before insert or update of para on interno.avisos_gerais for each row execute function interno.unificar_design_gatilho();

-- 2. Os dados que já existem ───────────────────────────────────────────────────────────────────────────────
-- Funções: primeiro entra a nova, depois sai a antiga (a pessoa nunca fica sem função, e o lembrete de "saiu do painel"
-- não dispara). O histórico de cargos registra as duas linhas como feitas pelo sistema.
do $$
declare r record;
begin
  perform set_config('lucia.sistema', '1', true);
  for r in select * from interno.papeis where papel = 'design' order by criado_em loop
    insert into interno.papeis (usuario, papel, disciplina, concedido_por, criado_em)
    values (r.usuario, 'marketing', r.disciplina, r.concedido_por, r.criado_em) on conflict do nothing;
    delete from interno.papeis where id = r.id;
    perform interno.avisar(r.usuario, 'O departamento Design mudou: a arte e o design gráfico agora são da Comunicação (marketing e divulgação). Você continua com o Estúdio de design, os materiais e as imagens, e a sua data de entrada foi mantida. O design da interface (UI/UX) foi para o departamento UI/UX e Desenvolvimento: se quiser trabalhar nele, peça à coordenação.');
  end loop;
  for r in select * from interno.papeis where papel = 'representante' and disciplina = 'design' order by criado_em loop
    insert into interno.papeis (usuario, papel, disciplina, concedido_por, criado_em)
    values (r.usuario, 'representante', 'jornalismo', r.concedido_por, r.criado_em) on conflict do nothing;
    delete from interno.papeis where id = r.id;
  end loop;
end $$;

update interno.candidaturas set papel = 'marketing' where papel = 'design';
update interno.inscricoes set papel = 'marketing' where papel = 'design';
update interno.convites set papel = 'marketing' where papel = 'design';
update interno.equipe_mensagens set para = 'marketing' where para = 'design';
update interno.avisos_gerais set para = interno.lista_sem_design(para) where 'design' = any(para);

-- O departamento Design deixa de existir como página: o que era dele passa à Comunicação (os textos de ambos ficam).
do $$
begin
  if exists (select 1 from interno.departamentos_info where id = 'design') then
    update interno.departamento_quadro set departamento = 'jornalismo' where departamento = 'design';
    update interno.departamento_pedidos set para = 'jornalismo' where para = 'design';
    update interno.departamento_pedidos set de = 'jornalismo' where de = 'design';
    update interno.departamento_bastoes set departamento = 'jornalismo' where departamento = 'design';
    delete from interno.departamentos_info where id = 'design';
  end if;
end $$;

-- Os textos de apresentação, só onde ainda estão como no início (o que a coordenação editou não é tocado).
update interno.departamentos_info
   set descricao = 'O design da interface (UI/UX), o site e o painel: telas, acessibilidade, erros, melhorias e segurança.'
 where id = 'desenvolvimento' and descricao = 'O site e o painel: erros, melhorias e segurança.';
update interno.departamentos_info
   set descricao = descricao || ' Também a arte e o design gráfico: cartazes, capas, posts e a identidade do instituto, sempre com a marca de sempre.'
 where id = 'jornalismo' and descricao not like '%design gráfico%' and char_length(descricao) <= 200;
update interno.conversas set nome = 'Arte e design (Comunicação)' where tipo = 'departamento' and departamento = 'design' and nome = 'Design';
update interno.conversas set nome = 'UI/UX e Desenvolvimento' where tipo = 'departamento' and departamento = 'desenvolvimento' and nome = 'Desenvolvimento';

-- 3. Textos do banco ───────────────────────────────────────────────────────────────────────────────────────
create or replace function interno.nome_papel(p text) returns text language sql immutable as $$
  select case p when 'coordenacao' then 'coordenação' when 'vice' then 'coordenação pedagógica' when 'supervisao' then 'supervisão' when 'curadoria' then 'curadoria'
    when 'mediacao' then 'mediação' when 'educacao' then 'educação' when 'educacao_secundaria' then 'educação secundária' when 'revisao' then 'revisão'
    when 'traducao' then 'tradução' when 'jornalismo' then 'comunicação (jornal, rádio e podcast)' when 'mentoria' then 'aula de reforço'
    when 'design' then 'comunicação (arte e design gráfico)'
    when 'marketing' then 'comunicação (marketing, divulgação, arte e design gráfico)' when 'desenvolvimento' then 'UI/UX e desenvolvimento'
    when 'representante' then 'representante do departamento' when 'porta_voz' then 'porta-voz' when 'saude' then 'profissional de saúde'
    else coalesce(p, '') end
$$;

-- O pedido de arte do podcast agora avisa a Comunicação (quem faz arte), não mais uma função 'design' que não existe.
create or replace function public.podcast_design_pedir(p_episodio uuid, p_texto text) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_id uuid; v_titulo text; r record;
begin
  if not interno.podcaster() then perform interno.erro('sem_permissao'); end if;
  perform interno.limite('podcast_design', 20, 1440);
  select titulo into v_titulo from podcast_episodios where id = p_episodio;
  if not found then perform interno.erro('nao_encontrado'); end if;
  insert into podcast_pedidos (episodio, texto, pedido_por) values (p_episodio, interno.txt(p_texto, 'texto', 5, 1000), v) returning id into v_id;
  for r in select distinct usuario from papeis where papel in ('marketing', 'design') and usuario <> v loop
    perform interno.avisar(r.usuario, format('Pedido de arte para o podcast: episódio "%s". Veja em Podcast → Pedidos de arte.', v_titulo));
  end loop;
  return jsonb_build_object('id', v_id);
end $$;

-- 4. Termo de voluntário: ninguém fica sem texto ────────────────────────────────────────────────────────────
-- Quem aceitou sem o texto guardado (só a data no perfil, ou a versão vigente sem linha em termos_aceites) volta a ver o
-- termo ao abrir o painel. A versão "anterior" nunca é igual à vigente, então o painel pede o aceite; o aceite antigo
-- continua listado para a coordenação como "antigo" até a pessoa aceitar de novo (public.termos_aceites_listar).
update interno.perfis f set termo_voluntario_versao = 'anterior'
 where f.termo_voluntario_em is not null
   and (f.termo_voluntario_versao is null or f.termo_voluntario_versao = interno.termo_voluntario_vigente())
   and not exists (select 1 from interno.termos_aceites t
                    where t.usuario = f.id and t.termo = 'voluntario' and t.versao = interno.termo_voluntario_vigente());

/** Confirma que a pessoa está aqui como voluntária (Lei nº 9.608/1998). Só vale com o texto guardado da versão vigente. */
create or replace function public.termo_voluntario_aceitar() returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu();
begin
  if not exists (select 1 from termos_aceites t where t.usuario = v and t.termo = 'voluntario' and t.versao = interno.termo_voluntario_vigente()) then
    perform interno.erro('falta_termo');
  end if;
  update perfis set termo_voluntario_em = coalesce(termo_voluntario_em, now()), termo_voluntario_versao = interno.termo_voluntario_vigente() where id = v;
  perform interno.registrar('termo_voluntario', v::text, jsonb_build_object('versao', interno.termo_voluntario_vigente()));
  return jsonb_build_object('ok', true);
end $$;

/** O termo de adesão das Horas da pessoa; "sem_texto" quando o aceite é de antes de o texto ser guardado. */
create or replace function public.termo_meu() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select (select jsonb_build_object('nome_completo', t.nome_completo, 'versao', t.versao, 'aceito_em', t.aceito_em,
            'sem_texto', not exists (select 1 from termos_aceites a where a.usuario = t.usuario and a.termo = 'adesao' and a.versao = t.versao))
            from termos_adesao t where t.usuario = auth.uid())
$$;

revoke all on function interno.papel_sem_design(text) from public, anon, authenticated;
revoke all on function interno.lista_sem_design(text[]) from public, anon, authenticated;
revoke all on function interno.unificar_design_gatilho() from public, anon, authenticated;
revoke all on function public.podcast_design_pedir(uuid, text) from public;
grant execute on function public.podcast_design_pedir(uuid, text) to anon, authenticated, service_role;
revoke all on function public.termo_voluntario_aceitar() from public;
grant execute on function public.termo_voluntario_aceitar() to anon, authenticated, service_role;
revoke all on function public.termo_meu() from public;
grant execute on function public.termo_meu() to anon, authenticated, service_role;
