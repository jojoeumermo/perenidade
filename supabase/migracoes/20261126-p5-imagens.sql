-- ───────────────────────────── Prompt 5 (A20): imagens do post no tamanho de cada tela ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16) e das migrações do Prompt 5 que vêm antes no install.sql; o
-- 20261126-p5-fim.sql vem por último. Pode rodar mais de uma vez.
-- Teste: npm run testar:p5-imagens.
--
-- Sem serviço pago de imagens: no envio, o aparelho faz versões menores da imagem do post (640 e 1080 px de largura), sempre da
-- imagem final, já reencodada e borrada, e o servidor tira o metadado de novo e guarda ao lado da principal, na pasta da própria
-- pessoa (app/api/rede/midia, lib/rede/publicar/versoes.ts): "<pessoa>/<id>.<ext>" ganha "<pessoa>/<id>.<ext>.v640" e ".v1080".
-- Nenhuma tabela nova e nenhuma linha a mais: a versão é só um arquivo que segue a principal.
--   1. public.rede_pub_midia_pode (a regra de leitura do depósito rede-midia): a versão abre para quem a principal abre, e só.
--   2. public.rede_midia_faxina_lista (a faxina da mídia órfã): a versão de uma principal em uso não é órfã; a de uma principal que
--      saiu (post apagado, conta apagada, envio que não virou post) é, e sai junto.
--
-- Redefine (a definição COMPLETA, tirada do banco montado com o install.sql deste ramo, mais a versão): public.rede_pub_midia_pode
-- (text) e public.rede_midia_faxina_lista(integer). Função nova: nenhuma. Endereço de rede: nada. Não mexe em rede_alumia_versao
-- nem na lista de exceções da porta. Termina trancando tudo na porta.

create or replace function public.rede_pub_midia_pode(p_caminho text) returns boolean language sql stable security definer set search_path = interno, pg_temp as $$
  select interno.alumia_passa() and (
         exists (select 1 from rede_midia m join rede_posts p on p.id = m.post
                  where m.caminho = regexp_replace(p_caminho, '\.v(640|1080)$', '') and interno.rede_ve(p, auth.uid()))
      or exists (select 1 from rede_audios a join rede_posts p on p.id = a.post where a.caminho = p_caminho and interno.rede_ve(p, auth.uid())))
$$;

create or replace function public.rede_midia_faxina_lista(p_limite integer default 200) returns jsonb language plpgsql security definer set search_path = interno, pg_temp as $$
declare v_lim integer := greatest(1, least(coalesce(p_limite, 200), 1000)); v jsonb := '[]'::jsonb;
begin
  if not interno.servico() then perform interno.erro('sem_permissao'); end if;
  if to_regclass('storage.objects') is null then return v; end if;
  execute 'select coalesce(jsonb_agg(o.name), ''[]''::jsonb) from (
             select name from storage.objects o
              where o.bucket_id = ''rede-midia'' and o.created_at < now() - interval ''24 hours''
                and not exists (select 1 from interno.rede_midia m where m.caminho = regexp_replace(o.name, ''\.v(640|1080)$'', ''''))
                and not exists (select 1 from interno.rede_audios a where a.caminho = o.name)
              order by o.created_at limit $1) o'
    into v using v_lim;
  return v;
end $$;

select interno.alumia_trancar();
