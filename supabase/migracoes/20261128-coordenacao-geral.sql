-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Coordenação geral liga recurso sem segunda pessoa (painel único).
-- Roda depois de 20261127-p4-fim.sql (banco na versão 18). Não mexe na versão nem na lista da porta.
--
-- Até aqui, ligar no painel único um recurso que só liga pelo nome abria um pedido que outra pessoa da coordenação confirmava.
-- A conta marcada como coordenação geral (interno.configuracoes, chave 'coordenacao_geral', {"usuario": "<uuid>"}) liga direto,
-- desde que continue com o papel de coordenação, sem suspensão e com o segundo fator nesta sessão (aal2). Ninguém fica marcado
-- por esta migração: a marca é gravada à parte, por SQL, por quem administra o banco. Sem a marca, tudo continua como antes.
-- Desligar continua valendo na hora para todo mundo; as outras pessoas da coordenação seguem pedindo a segunda pessoa.

create or replace function interno.alumia_coord_geral() returns boolean language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); v_geral uuid;
begin
  if v is null then return false; end if;
  select nullif(c.valor ->> 'usuario', '')::uuid into v_geral from configuracoes c where c.chave = 'coordenacao_geral';
  if v_geral is null or v_geral <> v then return false; end if;
  if not interno.aal2() then return false; end if;
  return exists (select 1 from papeis p join perfis f on f.id = p.usuario where p.usuario = v and p.papel = 'coordenacao' and not f.suspenso);
exception when invalid_text_representation then
  return false;
end $$;
revoke all on function interno.alumia_coord_geral() from public, anon, authenticated;

-- Os interruptores do lançamento valem direto para a coordenação; com a marca, todos valem direto para a coordenação geral.
create or replace function interno.alumia_admin_direto(p_nome text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select p_nome in ('alumia-aberta', 'alumia-convites', 'fediverso-total', 'fediverso-grupos') or interno.alumia_coord_geral()
$$;
revoke all on function interno.alumia_admin_direto(text) from public, anon, authenticated;

select interno.alumia_trancar();
