-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- T32 (Alumia), itens 2b e 3: a vitrine das comunidades e o painel da semeadura.
--
-- Vitrine (rede_com_lista, redefinida): cada comunidade traz agora só contagens AGREGADAS e anônimas da última semana: quantos
-- posts e quantas pessoas escreveram ali nos últimos 7 dias. Nunca nome, nunca lista de quem é membro. Pessoas só aparecem a
-- partir de 3 (abaixo disso volta nulo, "poucas"), para que um número pequeno não aponte alguém numa comunidade de luta, que
-- pode revelar opinião política (dado sensível, LGPD, art. 5º, II e art. 11; minimização, art. 6º, III). Quem visita sem conta
-- passa a ver também uma AMOSTRA das lutas e do Instituto: só nome, descrição e regras (sem posts, sem contagens), para conhecer
-- antes de entrar. A ordem é pública e escrita na tela: mais posts na semana primeiro, depois a ordem alfabética.
--
-- Semeadura (rede_painel_semeadura, nova): para a coordenação, por comunidade, quantos posts reais existem (no total e na
-- semana) e quantas pessoas moderam (a meta do docs/rede/SEMEAR.md é 2). Só números; nenhum script publica nada.
--
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 2026-11-rede-comunidades.sql.
-- O mesmo bloco está no fim do install.sql.

create or replace function public.rede_com_lista() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid();
begin
  perform interno.aberta('comunidade');
  return jsonb_build_object('regra', 'atividade_7d', 'itens', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'slug', x.slug, 'nome', x.nome, 'descricao', x.descricao, 'categoria', x.categoria, 'tipo', x.tipo, 'icone', x.icone, 'cor', x.cor,
      'situacao', interno.rede3_com_situacao(x.slug, v),
      'amostra', x.amostra,
      'posts_7d', case when x.amostra then null else x.posts end,
      'pessoas_7d', case when x.amostra or x.pessoas < 3 then null else x.pessoas end,
      'regras', case when x.amostra then (select coalesce(jsonb_agg(jsonb_build_object('numero', r.numero, 'titulo', r.titulo, 'texto', r.texto) order by r.numero), '[]'::jsonb)
                                          from rede_comunidade_regras r where r.comunidade = x.slug) end)
      order by case x.categoria when 'lutas' then 1 when 'disciplinas' then 2 else 3 end, x.posts desc, x.nome), '[]'::jsonb)
    from (
      select c.*, (v is null and c.categoria <> 'disciplinas') as amostra,
        (select count(*)::integer from rede_posts p where p.comunidade = c.slug and p.criado_em > now() - interval '7 days' and not p.oculto and not p.retido) as posts,
        (select count(distinct p.autor)::integer from rede_posts p where p.comunidade = c.slug and p.criado_em > now() - interval '7 days' and not p.oculto and not p.retido) as pessoas
      from rede_comunidades c
      where c.slug not like 'fechado-%'
        and (c.tipo <> 'fechada' or interno.rede2_na_comunidade(c.slug, v))
        -- Visitante: as disciplinas, inteiras; das lutas e do Instituto, só a amostra das abertas e restritas (nunca a fechada).
        and (v is not null or c.categoria = 'disciplinas' or c.tipo in ('aberta', 'restrita'))) x));
end $$;

/** O roteiro da semeadura em números, para a coordenação: posts reais por comunidade e se há 2 pessoas moderando. */
create or replace function public.rede_painel_semeadura() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
begin
  perform interno.eu();
  if not interno.coord() then perform interno.erro('sem_permissao'); end if;
  return jsonb_build_object('itens', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'nome', c.nome, 'categoria', c.categoria, 'tipo', c.tipo,
      'posts', (select count(*)::integer from rede_posts p where p.comunidade = c.slug and not p.oculto and not p.retido),
      'posts_7d', (select count(*)::integer from rede_posts p where p.comunidade = c.slug and not p.oculto and not p.retido and p.criado_em > now() - interval '7 days'),
      'moderacao', (select count(*)::integer from rede_comunidade_membros m where m.comunidade = c.slug and m.papel = 'moderacao' and m.situacao = 'ativo'))
      order by case c.categoria when 'lutas' then 1 when 'instituto' then 2 else 3 end, c.nome), '[]'::jsonb)
    from rede_comunidades c where c.slug not like 'fechado-%'));
end $$;

revoke all on function public.rede_painel_semeadura() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_painel_semeadura() from anon;
    grant execute on function public.rede_com_lista() to anon, authenticated, service_role;
    grant execute on function public.rede_painel_semeadura() to authenticated, service_role;
  end if;
end $$;
