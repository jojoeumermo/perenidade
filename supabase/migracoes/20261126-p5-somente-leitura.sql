-- ───────────────────────────── Prompt 5: funções de leitura que contam pedidos deixam de ser "stable" ─────────────────────────────
-- Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
--
-- Roda depois de 20261125-r3-fim.sql (banco na versão 16). Fica no fim do install.sql. Pode rodar mais de uma vez.
-- Teste: npm run testar:p5-somente-leitura.
--
-- O problema: a API do banco roda toda função marcada "stable" (ou "immutable") numa transação SÓ DE LEITURA, mesmo chamada por
-- POST. Estas vinte funções de leitura são "stable", mas chamam interno.limite, que conta o pedido gravando numa tabela
-- (interno.limites). Na transação só de leitura a gravação cai ("cannot execute INSERT in a read-only transaction") e a tela
-- mostra "Algo deu errado". Foi o que a coordenação viu em Comunidades → Por cidade (alumia_estr_cidades). As outras dezenove
-- caem do mesmo jeito: a busca da Alumia, a aba Estrutura da comunidade, os Espaços e o diretório e o mapa das organizações, as
-- atas, o mural e as conquistas da Escola, a caixa da organização e "fui bloqueado" do Fediverso. Os testes locais não pegavam
-- porque chamam a função fora de transação só de leitura (interno.origem já se protegia disso; 20261114-alumia-o8-conta.sql).
--
-- O conserto: só a marca muda (alter function ... volatile). Nenhum corpo é redefinido, nenhuma permissão muda, a porta da entrada
-- continua em cada uma (o corpo é o mesmo). O limite de pedidos continua valendo. Função que não existir no banco é pulada.
-- Atenção a quem redefinir alguma destas depois: "create or replace" sem "volatile" volta a marca padrão (volatile, que serve);
-- com "stable" o erro volta. O teste confere que nenhuma função pública "stable" ou "immutable" chega a uma que grava.
-- Endereço de rede: nada daqui lê ou guarda.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.alumia_conquistas_de(text)',
    'public.alumia_estr_cidades()',
    'public.alumia_estr_da_cidade(text, text)',
    'public.alumia_estr_espacos(text)',
    'public.alumia_estr_origens(uuid[])',
    'public.alumia_estr_ver(text)',
    'public.alumia_mural(text, integer)',
    'public.rede_buscar(text)',
    'public.rede_fed_me_bloqueou(text)',
    'public.rede_org_ata(uuid)',
    'public.rede_org_atas(text)',
    'public.rede_org_atos(text)',
    'public.rede_org_boletim(text)',
    'public.rede_org_caixa(text)',
    'public.rede_org_caixa_nota(uuid)',
    'public.rede_org_diretorio(jsonb)',
    'public.rede_org_dominio(text)',
    'public.rede_org_funcoes(text)',
    'public.rede_org_mapa()',
    'public.rede_org_plenaria(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s volatile', f);
    end if;
  end loop;
end $$;
