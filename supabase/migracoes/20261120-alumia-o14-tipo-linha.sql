-- ───────────────────────────── Alumia: onda 14, antes das colunas da onda 9 (Postgres do Supabase) ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fica no install.sql LOGO ANTES de 20261115-alumia-o9-publicar.sql (e no SQL da onda 9 no mesmo lugar), porque é ali que a primeira
-- coluna com valor padrão entra em interno.rede_posts. Conferido no Postgres 17.12 do Supabase com o Auth e o Storage de verdade.
--
-- No Postgres do Supabase, uma função com parâmetro do tipo linha de uma tabela E valor padrão impede acrescentar coluna com valor
-- padrão nessa tabela ("cannot alter table ... because function ... uses its row type"). A única assim é a entrega das menções da
-- federação (20261109-fediverso-total.sql, p_antes interno.rede_posts default null), que já está no banco. Ela passa a ter os quatro
-- parâmetros sem valor padrão, e uma de três chama a de quatro com null (quem chama continua igual). Roda duas vezes sem mudar nada.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.oid = to_regprocedure('interno.rede_fed_entregar_mencionados(interno.rede_posts, text, uuid, interno.rede_posts)')
     and p.pronargdefaults > 0;
  if v_def is not null then
    drop function interno.rede_fed_entregar_mencionados(interno.rede_posts, text, uuid, interno.rede_posts);
    execute regexp_replace(v_def, '\s+DEFAULT\s+NULL::interno\.rede_posts', '', 'i');
    revoke all on function interno.rede_fed_entregar_mencionados(interno.rede_posts, text, uuid, interno.rede_posts) from public, anon, authenticated;
  end if;
  if to_regprocedure('interno.rede_fed_entregar_mencionados(interno.rede_posts, text, uuid, interno.rede_posts)') is not null then
    execute $f$
      create or replace function interno.rede_fed_entregar_mencionados(p interno.rede_posts, p_tipo text, p_perfil uuid) returns integer
      language sql security definer set search_path = interno, pg_temp as
      $b$ select interno.rede_fed_entregar_mencionados(p, p_tipo, p_perfil, null::interno.rede_posts) $b$
    $f$;
    revoke all on function interno.rede_fed_entregar_mencionados(interno.rede_posts, text, uuid) from public, anon, authenticated;
  end if;
end $$;

select interno.alumia_trancar();
