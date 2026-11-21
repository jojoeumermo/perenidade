-- ───────────────────────────── Prompt 5 (A16): a mídia do story só chega a outra pessoa depois de conferida no servidor ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez.
-- Teste: npm run testar:p5-stories.
--
-- A foto e o vídeo do story são refeitos no aparelho antes de sair (lib/rede/stories/imagem.ts e midia.ts: sem GPS, sem modelo da
-- câmera, sem data), e o servidor confere de novo (supabase/functions/faxina-stories/faxina.mjs: tira EXIF, XMP, IPTC e o texto do
-- PNG; vídeo com caixa de lugar sai do ar). Mas a conferência do servidor rodava de 15 em 15 minutos, e até lá o arquivo do jeito
-- que chegou já podia ser aberto por quem vê o story: um aparelho alterado mandaria a foto com o GPS, e ela ficaria à vista até a
-- faxina passar. Agora:
--   1. public.rede_story_pode (a regra de leitura do depósito rede-stories) só deixa outra pessoa abrir o arquivo depois de
--      conferido (rede_stories.conferido). A autora vê o próprio arquivo na hora, como antes.
--   2. Para não esperar a faxina, o site confere logo depois de publicar (app/api/rede/stories/conferir): o aparelho pede, o
--      banco diz o caminho só para a autora e só enquanto não foi conferido (public.rede_story_conferir_pedir), e o servidor do
--      site baixa, limpa, sobe de novo e marca com a chave de serviço (public.rede_story_faxina_feito, a mesma da faxina). Se
--      isso falhar, a faxina de 15 em 15 minutos continua sendo a segunda trava.
--
-- Redefine (a definição COMPLETA, tirada do banco montado com o install.sql deste ramo, mais a condição do conferido):
-- public.rede_story_pode(text). Função nova: public.rede_story_conferir_pedir(uuid). Endereço de rede: nada. Não mexe em
-- rede_alumia_versao nem na lista de exceções da porta. Termina trancando tudo na porta.

create or replace function public.rede_story_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and exists (select 1 from rede_stories s where s.midia_caminho = p_caminho
                 and (s.conferido or s.autor = auth.uid())
                 and (interno.rede5_story_ve(s, auth.uid()) or interno.rede5_story_ve_destaque(s, auth.uid())))
$$;

/** O caminho da mídia do próprio story ainda não conferido (nulo: já conferido, sem mídia, ou não é da pessoa). */
create or replace function public.rede_story_conferir_pedir(p_id uuid) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v uuid := auth.uid(); s rede_stories;
begin
  if v is null then perform interno.erro('entre_primeiro'); end if;
  perform interno.limite('rede_story_conferir', 30, 10);
  select * into s from rede_stories where id = p_id and autor = v;
  if not found then perform interno.erro('nao_encontrado'); end if;
  return jsonb_build_object('id', s.id, 'caminho', case when s.midia_caminho is not null and not s.conferido then s.midia_caminho end);
end $$;

revoke all on function public.rede_story_conferir_pedir(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.rede_story_conferir_pedir(uuid) from anon;
    grant execute on function public.rede_story_conferir_pedir(uuid) to authenticated, service_role;
  end if;
end $$;

select interno.alumia_trancar();
