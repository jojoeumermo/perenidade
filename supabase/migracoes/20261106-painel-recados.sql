-- ───────────────────────── Recados da Mesa em grupos (T27, 06/11/2026) ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Rode depois do install.sql (a coluna
-- interno.avisos.categoria já existe lá).
--
-- O que faz: public.avisos_meus() passa a devolver também a categoria do recado ('equipe', 'rede' ou 'conta'), para a
-- Mesa agrupar os recados por assunto (components/painel/recados-grupos.ts). Sem esta migração a Mesa agrupa só pelo texto,
-- então nada quebra se ela ainda não tiver rodado.
--
-- Mesma regra de antes: só os recados da própria pessoa (para = auth.uid()), os 40 mais novos. Nenhum dado novo é guardado
-- nem mostrado a outra pessoa (LGPD, Lei 13.709/2018, art. 6º, III: necessidade).

create or replace function public.avisos_meus() returns jsonb language sql stable security definer set search_path = interno, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'lido', a.lido, 'criado_em', a.criado_em, 'categoria', a.categoria) order by a.criado_em desc), '[]'::jsonb)
  from (select * from avisos where para = auth.uid() and auth.uid() is not null order by criado_em desc limit 40) a
$$;
