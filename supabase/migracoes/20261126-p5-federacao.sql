-- ───────────────────────────── Prompt 5 (A7): o que falta para a federação andar, no painel ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez.
-- Teste: npm run testar:p5-federacao.
--
-- A coordenação viu o painel dizer "Fediverso: ligada" e a tela da Alumia dizer "a federação ainda não está ligada no servidor".
-- O painel mostra a decisão do recurso (fediverso-total), que é só uma das peças. As outras: o segredo da federação no servidor
-- que está no ar e o SHA-256 dele com o endereço de entrega guardados no banco (interno.configuracoes, chave "fediverso"). Esta
-- função diz à Saúde do painel (app/api/alumia/painel/saude) quais peças do banco existem: só sim ou não, nunca o valor nem o
-- endereço. Só a coordenação com o segundo fator (interno.alumia_admin_exige).
--
-- Função nova: public.alumia_admin_federacao. Nenhuma função existente é redefinida. Endereço de rede: nada. Não mexe em
-- rede_alumia_versao nem na lista de exceções da porta. Termina trancando tudo na porta.

create or replace function public.alumia_admin_federacao() returns jsonb language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := interno.alumia_admin_exige(); c jsonb := (select valor from configuracoes where chave = 'fediverso');
begin
  return jsonb_build_object(
    'total', interno.rede_fed_total(),
    'grupos', interno.rede_fed_grupos_ligado(),
    'segredo_guardado', coalesce(c ->> 'segredo_hash', '') ~ '^[0-9a-f]{64}$',
    'url_entrega', coalesce(c ->> 'url_entrega', '') ~ '^https://[a-z0-9.-]+/api/fediverso/entregar$');
end $$;

revoke all on function public.alumia_admin_federacao() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.alumia_admin_federacao() from anon;
    grant execute on function public.alumia_admin_federacao() to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
