-- ───────────────────────────── Alumia, onda 11: o pedido de entrada com a rede conferida pelo passe da porta ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Com um banimento por rede em vigor, o pedido de entrada novo exigia que a CONTA tivesse uma impressão de rede registrada nos
-- últimos 30 minutos (interno.alumia_painel_pedido_com_rede, 20261113-alumia-o7-painel.sql). Isso obrigava a tela a guardar a
-- impressão de rede de toda conta no momento do pedido, e a linha (conta, impressão, hora) fica 30 dias no banco.
--
-- O passe da porta (20261114-alumia-o8-porta.sql, public.alumia_cadastro_passar) já prova a mesma coisa sem guardar a impressão
-- ao lado da conta: o servidor do site lê a rede do próprio pedido, recusa a rede barrada e só então dá o passe de 30 minutos.
-- Daqui em diante, o pedido com banimento por rede em vigor aceita: a porta ligada (o gatilho do passe, que roda antes deste, já
-- exigiu e gastou o passe), um passe ainda válido (porta desligada), ou a impressão recente de antes. Sem nenhum dos três, a mesma
-- recusa de antes ('alumia_rede'). Nenhuma tabela nem coluna nova.
--
-- Pode rodar mais de uma vez. Roda DEPOIS das migrações da onda 7 (painel) e da onda 8 (porta). Teste: scripts/testar-alumia-o11-porta.mjs.

/**
 * Com um banimento por rede em vigor, pedido de entrada novo só é aceito de conta cuja rede o servidor acabou de ver: pelo passe
 * da porta (que recusa a rede barrada) ou pela impressão registrada nos últimos 30 minutos. Sem isso, bastaria pular o servidor
 * para pedir a entrada de uma rede barrada.
 */
create or replace function interno.alumia_painel_pedido_com_rede() returns trigger language plpgsql security definer set search_path = interno, pg_temp as $$
begin
  if new.situacao <> 'em_analise' or auth.uid() is null or auth.uid() is distinct from new.usuario or interno.servico() then return new; end if;
  if tg_op = 'UPDATE' and old.situacao = 'em_analise' and new.pedido_em is not distinct from old.pedido_em then return new; end if;
  if not exists (select 1 from alumia_impressao_banimentos b where b.encerrado_em is null and b.ate > now()) then return new; end if;
  if interno.alumia_painel_da_casa(new.usuario) then return new; end if;
  -- O passe da porta: com a porta ligada, o gatilho do passe (alumia_cadastro_pedido_com_passe, que vem antes pela ordem do nome)
  -- já exigiu um passe válido; com ela desligada, o passe continua de pé até vencer.
  if to_regprocedure('interno.alumia_cadastro_ligada()') is not null then
    if interno.alumia_cadastro_ligada() then return new; end if;
    if exists (select 1 from alumia_cadastro_passes p where p.usuario = new.usuario and p.vence_em > now()) then return new; end if;
  end if;
  if not exists (select 1 from alumia_impressoes i where i.usuario = new.usuario and i.vista_em > now() - interval '30 minutes') then
    perform interno.erro('alumia_rede');
  end if;
  return new;
end $$;
revoke all on function interno.alumia_painel_pedido_com_rede() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.alumia_painel_pedido_com_rede() from anon, authenticated;
  end if;
end $$;
drop trigger if exists alumia_painel_pedido_com_rede on interno.alumia_entrada;
create trigger alumia_painel_pedido_com_rede before insert or update on interno.alumia_entrada for each row execute function interno.alumia_painel_pedido_com_rede();

select interno.alumia_trancar();
