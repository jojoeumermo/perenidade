-- ───────────────────────── Turmas em pausa (T08, 06/11/2026) ─────────────────────────
-- Migração acrescentável: pode rodar mais de uma vez, sem apagar dado nenhum. Rode DEPOIS de 2026-11-backend-1.sql
-- (que cria interno.recursos_catalogo e interno.recursos_vivos). Texto: docs/RECURSOS.md, seção "turmas".
--
-- O que faz: põe o recurso "turmas" no catálogo dos recursos que a coordenação liga e desliga pelo painel
-- (Site › Controles avançados › Recursos). As turmas (por curso, na Escola, e a Turma do mês) ficam em pausa por decisão
-- da coordenação ("não temos gente o suficiente"); no código, "turmas" está em EM_PAUSA (lib/recursos.ts): a variável
-- "todos" não o liga. Ligar pelo painel vale na hora, sem segunda pessoa (so_pelo_nome = false).
--
-- Também grava a decisão explícita "desligado", para o painel mostrar a chave desligada desde o primeiro dia. Só grava se
-- ainda não houver decisão (não desfaz uma escolha que a coordenação já tenha feito).
--
-- Nenhuma tabela, função ou permissão nova; nenhum dado pessoal (LGPD, Lei 13.709/2018, art. 6º, III: necessidade).

insert into interno.recursos_catalogo (nome, so_pelo_nome) values ('turmas', false)
on conflict (nome) do update set so_pelo_nome = excluded.so_pelo_nome;

insert into interno.recursos_vivos (nome, ligado, por) values ('turmas', false, null)
on conflict (nome) do nothing;
