-- ───────────────────────────── Alumia, integração: o resumo só oferece comunidade que pode dar título ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Sobra 4 da onda 13. O resumo semanal das comunidades (20261119-alumia-o13-pontes.sql) só leva títulos do que pode sair da
-- Alumia, pela mesma regra do RSS (interno.alumia_alc_sai): público de fato "internet", e isso só existe nas comunidades das
-- disciplinas (interno.rede2_publico), abertas e fora das "fechado-*". Mesmo assim, a escolha oferecia qualquer comunidade aberta
-- da pessoa, e as das lutas nunca iam dar título nenhum. Agora:
--   · a lista para escolher só traz as comunidades que podem dar título (a tela diz quando não há nenhuma, em vez de lista vazia);
--   · o que já estava escolhido e não pode dar título some da escolha devolvida (e da próxima gravação);
--   · gravar comunidade que não pode dar título é recusado ("invalido:comunidades"), como já era com a fechada.
-- As duas funções são redefinidas inteiras (o corpo de hoje, da o13-pontes, com o filtro). Nada guardado muda; nenhuma tabela nova.
-- Rodar depois da onda 14 (ou em qualquer ponto depois da o13-pontes): só redefine, e termina passando a porta.

/** O que a pessoa escolheu e as comunidades que podem dar título (para escolher): das disciplinas, abertas, fora das "fechado-*". Só dela. */
create or replace function public.alumia_pontes_resumo_ver() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); r rede_pontes_resumo;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  select * into r from rede_pontes_resumo where usuario = v;
  return jsonb_build_object('ligado', coalesce(r.ligado, false),
    'escolhidas', coalesce((select jsonb_agg(c.slug order by c.slug) from rede_comunidades c
      where c.slug = any (coalesce(r.comunidades, '{}')) and c.tipo = 'aberta' and c.categoria = 'disciplinas' and c.slug not like 'fechado-%'), '[]'::jsonb),
    'opcoes', coalesce((select jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) order by c.nome)
      from rede_comunidades c where c.tipo = 'aberta' and c.categoria = 'disciplinas' and c.slug not like 'fechado-%'
        and (exists (select 1 from rede_comunidade_membros m where m.comunidade = c.slug and m.usuario = v and m.situacao = 'ativo') or c.slug = any (coalesce(r.comunidades, '{}')))), '[]'::jsonb));
end $$;

/** Liga ou desliga o resumo e escolhe até 10 comunidades que podem dar título. Desligar apaga a escolha (LGPD art. 18, IX). */
create or replace function public.alumia_pontes_resumo_salvar(p_ligado boolean, p_comunidades text[]) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.eu(); v_lista text[];
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  perform interno.limite('alumia_pontes_resumo', 30, 60);
  if not coalesce(p_ligado, false) then
    delete from rede_pontes_resumo where usuario = v;
    return public.alumia_pontes_resumo_ver();
  end if;
  select coalesce(array_agg(distinct s), '{}') into v_lista from unnest(coalesce(p_comunidades, '{}')) s where s is not null;
  if cardinality(v_lista) = 0 then perform interno.erro('invalido:comunidades'); end if;
  if cardinality(v_lista) > 10 then perform interno.erro('limite'); end if;
  if exists (select 1 from unnest(v_lista) s where not exists (select 1 from rede_comunidades c
               where c.slug = s and c.tipo = 'aberta' and c.categoria = 'disciplinas' and c.slug not like 'fechado-%')) then
    perform interno.erro('invalido:comunidades');
  end if;
  insert into rede_pontes_resumo (usuario, ligado, comunidades) values (v, true, v_lista)
  on conflict (usuario) do update set ligado = true, comunidades = excluded.comunidades;
  return public.alumia_pontes_resumo_ver();
end $$;

-- A porta em toda função de pessoa (as duas já tinham; create or replace troca o corpo, e a porta volta aqui).
select interno.alumia_trancar();
