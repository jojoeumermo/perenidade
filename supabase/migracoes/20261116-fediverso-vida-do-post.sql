-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Fediverso: a vida do post (pedido BLOQUEANTE da Faixa 1, onda 9, em docs/rede/PEDIDOS-ENTRE-FAIXAS.md). Documento:
-- docs/rede/FEDIVERSO.md ("O que sai, e o que nunca sai").
--
-- interno.rede_fed_federavel passa a começar pela vida do post (interno.rede_vida_federa, da onda 9 da Faixa 1): não sai no
-- Fediverso o post não listado, o arquivado (nem depois de desarquivar: a Faixa 1 marca fora_do_fediverso), o que some sozinho
-- (24 h ou 7 dias) nem o da roda. O "membros" que sai é só o "internet" do perfil rebaixado pela matriz (decisão D3); com a vida do
-- post conferida antes, o não listado e o que some sozinho não escapam mais por esse caminho.
--
-- ORDEM: depois de 20261115-alumia-o9-publicar.sql (que cria interno.rede_vida_federa). Rodando antes, a vida do post só não é
-- conferida (a função ainda não existe) e o resto vale. Pode rodar de novo.

create or replace function interno.rede_fed_federavel(p interno.rede_posts, p_nivel integer default 0) returns boolean
language plpgsql stable security definer set search_path = interno, pg_temp as $$
declare a rede_fed_atores; pai rede_posts; v_pub text;
begin
  if p.id is null or p.autor is null or p_nivel > 8 then return false; end if;
  -- A vida do post (não listado, arquivado, some sozinho, roda): nada disso sai. A chamada fica num "if" próprio: o plpgsql só a
  -- prepara quando a função existe.
  if to_regprocedure('interno.rede_vida_federa(interno.rede_posts)') is not null then
    if not interno.rede_vida_federa(p) then return false; end if;
  end if;
  select * into a from rede_fed_atores where perfil = p.autor;
  if not found or not a.ligado or a.ligado_em is null or p.criado_em < a.ligado_em then return false; end if;
  if interno.rede_fed_impedimento(p.autor) is not null then return false; end if;
  if (select rede_handle from perfis where id = p.autor) is distinct from a.handle then return false; end if;
  if p.tipo = 'aviso' or p.nucleo is not null or p.repost_de is not null then return false; end if;
  if interno.rede_fed_total() and coalesce(a.consentimento_versao, 0) >= 2 then
    if p.oculto or p.retido or p.apagado_em is not null then return false; end if;
    if p.comunidade is not null and p.comunidade like 'fechado-%' then return false; end if;
    -- A escolha da pessoa (o mesmo cálculo de interno.rede2_publico antes do rebaixamento): só "internet" sai.
    if coalesce(p.publico, case p.alcance when 'seguidores' then 'seguidores' when 'equipe' then 'equipe' else 'internet' end) <> 'internet' then
      return false;
    end if;
    -- O "internet" do perfil rebaixado para "membros" pela matriz sai (decisão D3, docs/rede/FEDIVERSO.md); o "membros" escolhido
    -- de propósito já parou acima. O "membros" não passa por rede_ve (quem não entrou não o vê, por definição): o que o protege é
    -- a vida do post, conferida no começo.
    v_pub := interno.rede2_publico(p);
    if v_pub not in ('internet', 'membros') then return false; end if;
    if v_pub = 'internet' and not interno.rede_ve(p, null) then return false; end if;
    if p.comunidade is not null and not interno.rede_fed_comunidade_ok(p.comunidade) then return false; end if;
  else
    if coalesce(p.publico, 'internet') <> 'internet' then return false; end if;
    if interno.rede2_publico(p) <> 'internet' or not interno.rede_ve(p, null) then return false; end if;
  end if;
  if p.resposta_a is not null then
    select * into pai from rede_posts where id = p.resposta_a;
    if not found or not interno.rede_fed_federavel(pai, p_nivel + 1) then return false; end if;
  end if;
  return true;
end $$;

revoke all on function interno.rede_fed_federavel(interno.rede_posts, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function interno.rede_fed_federavel(interno.rede_posts, integer) from anon, authenticated;
  end if;
end $$;
