-- ───────────────────────── Assistente em todo o site (T03, 06/11/2026) ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Rode DEPOIS de 2026-11-backend-1.sql
-- (que cria interno.recursos_catalogo). Texto: docs/RECURSOS.md, seção "assistente-publico", e docs/privacidade-assistente.md.
--
-- O que faz: põe o recurso "assistente-publico" no catálogo dos recursos que a coordenação liga e desliga pelo painel
-- (Site › Controles avançados › Recursos). No código ele está em PADRAO (lib/recursos.ts): nasce LIGADO, a pedido da
-- coordenação ("eu quero ligar o assistente em todo o site"). Desligar pelo painel vale na hora, sem segunda pessoa.
--
-- Não grava decisão em interno.recursos_vivos: sem decisão, vale o padrão do código (ligado).
--
-- O assistente aberto NÃO usa o banco: o limite por pessoa fica na memória do servidor do site, com um resumo do IP com
-- sal do dia (app/api/assistente/route.ts, lib/assistente/limite.ts). Nenhuma tabela, função ou permissão nova; nenhum dado
-- pessoal (LGPD, Lei 13.709/2018, art. 6º, III: necessidade).

insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('assistente-publico', false)
on conflict (nome) do update set so_pelo_nome = excluded.so_pelo_nome;
