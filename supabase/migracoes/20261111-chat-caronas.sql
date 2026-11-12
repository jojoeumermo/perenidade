-- ───────────────────────────── Alumia: "Combinar pelo chat" das caronas do ato ─────────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Roda DEPOIS de 20261106-t19-rede-chat-privado.sql
-- (o chat) e de 20261110-alumia-b1-atos.sql (a tabela interno.rede_ato_caronas, da Faixa 1). Sem a tabela, recusa rodar.
-- Pedido da Faixa 1 em docs/rede/PEDIDOS-ENTRE-FAIXAS.md (10/11/2026). Documento: docs/rede/CHAT-PRIVADO.md. Teste:
-- npm run testar:rede-chat.
--
-- O que faz: public.rede_dm_abrir_carona(p_carona) abre (ou acha) a conversa privada cifrada com quem publicou a carona. A
-- pessoa sai de interno.rede_ato_caronas.quem AQUI, no servidor: a tela das caronas nunca recebe o id nem o codinome de quem
-- ofereceu. Só depois que a conversa existe, quem pediu vê com quem está falando (como em qualquer conversa).
--
-- As mesmas regras de rede_dm_abrir, sem exceção: membro 18+ dos dois lados, bloqueio, perfil invisível, recusa recente, a
-- preferência "quem pode me chamar" da outra pessoa (pedidos, seguidos, ninguém) e o limite de pedidos novos por dia. Oferecer
-- carona NÃO abre o chat de ninguém à força: se a pessoa só aceita conversa de quem ela segue, a carona dela não abre conversa.
-- Toda recusa por causa da pessoa é o mesmo "dm_fechada", sem dizer o motivo. Antes disso, o ato precisa valer para quem chama
-- (a regra de interno.rede_ato_aberto da Faixa 1: vê o ato, não oculto, retido nem apagado, não cancelado, não passou). Nada disto
-- grava quem combinou com quem fora da própria conversa: nenhuma lista.
--
-- Privacidade (LGPD, Lei 13.709/2018, art. 5º, II e art. 11: pedir ou oferecer carona para um ato revela opinião política;
-- art. 6º, III, necessidade): a função devolve só a conversa, no formato de sempre (interno.rede_dm_json). O limite próprio
-- ("rede_dm_carona", 30 por dia) vale para TODA tentativa sobre uma carona que existe num ato que vale: acerto, conversa que já
-- existia e recusa (a recusa sai como resposta, não como exceção, para o limite não ser desfeito). Assim ninguém descobre de
-- graça, uma carona por vez, de quem é cada uma. Depois do ato (cancelado, ou passou há mais de 6 horas), nada mais se abre.

do $$
begin
  if to_regclass('interno.rede_ato_caronas') is null then
    raise exception 'Rode antes supabase/migracoes/20261110-alumia-b1-atos.sql (a tabela interno.rede_ato_caronas não existe).';
  end if;
  if to_regprocedure('public.rede_dm_abrir(text)') is null then
    raise exception 'Rode antes supabase/migracoes/20261106-t19-rede-chat-privado.sql (o chat privado).';
  end if;
end $$;

/**
 * Abre (ou acha) a conversa com quem publicou a carona `p_carona`. Devolve a conversa, como rede_dm_abrir; ou {erro: "dm_fechada"}.
 *
 * A recusa por causa da PESSOA (bloqueio, "quem pode me chamar", própria carona...) não é exceção, de propósito: exceção desfaz o
 * limite junto, e cada recusa precisa gastar o limite como um acerto (senão daria para testar de graça, carona por carona, de quem
 * cada uma é). O limite é gasto antes de olhar quem publicou.
 */
create or replace function public.rede_dm_abrir_carona(p_carona uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare
  v uuid := interno.eu(); k rede_ato_caronas; p rede_posts; ch rede_chamados; f perfis; c rede_dm_conversas;
  v_pode text; v_segue boolean; v_a uuid; v_b uuid; v_prazo smallint;
  fechada constant jsonb := jsonb_build_object('erro', 'dm_fechada');
begin
  perform interno.aberta('comunidade');
  if not interno.rede2_membro(v) then perform interno.erro('consentimento'); end if;
  select * into k from rede_ato_caronas where id = p_carona;
  if not found then perform interno.erro('nao_encontrado'); end if;
  -- O ato precisa valer para quem escreve nele (a mesma regra de interno.rede_ato_aberto, da Faixa 1): quem não vê o ato não fica
  -- sabendo nem que a carona existe, e depois do ato (cancelado, ou passou há mais de 6 horas) não se combina mais nada.
  p := interno.rede_ato_achar(k.ato, v);
  if p.oculto or p.retido or p.apagado_em is not null then perform interno.erro('nao_encontrado'); end if;
  select * into ch from rede_chamados where post = k.ato;
  if ch.situacao = 'cancelado' then perform interno.erro('ato_cancelado'); end if;
  if ch.inicio < now() - interval '6 hours' then perform interno.erro('ato_passou'); end if;
  perform interno.limite('rede_dm_carona', 30, 1440);
  if k.quem = v then return fechada; end if;
  select * into f from perfis where id = k.quem;
  if not found then return fechada; end if;
  v_a := least(v, f.id); v_b := greatest(v, f.id);
  select * into c from rede_dm_conversas where a = v_a and b = v_b;
  if found then
    if interno.rede_bloqueado(v, f.id) then return fechada; end if;
    return interno.rede_dm_json(c, v);
  end if;
  if not interno.rede2_membro(f.id) or interno.rede_bloqueado(v, f.id) or f.rede_invisivel or f.rede_modo = 'invisivel'
     or exists (select 1 from rede_dm_recusas r where r.quem = f.id and r.de = v and r.ate > now()) then
    return fechada;
  end if;
  v_pode := coalesce((select quem_pode from rede_dm_prefs where usuario = f.id), 'pedidos');
  v_segue := exists (select 1 from rede_seguindo s where s.quem = f.id and s.segue = v and not s.pendente);
  if v_pode = 'ninguem' or (v_pode = 'seguidos' and not v_segue) then return fechada; end if;
  perform interno.rede_dm_limite('pedir');
  v_prazo := coalesce((select prazo_dias from rede_dm_prefs where usuario = v), 7);
  insert into rede_dm_conversas (a, b, situacao, pediu, prazo_dias) values (v_a, v_b, case when v_segue then 'aberta' else 'pedido' end, v, v_prazo)
  returning * into c;
  return interno.rede_dm_json(c, v);
end $$;

-- ── Permissões: só quem entrou na conta chama; visitante (anon) nunca ─────────────────────────────────────────────────────
revoke all on function public.rede_dm_abrir_carona(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_dm_abrir_carona(uuid) from anon;
    grant execute on function public.rede_dm_abrir_carona(uuid) to authenticated;
  end if;
end $$;
