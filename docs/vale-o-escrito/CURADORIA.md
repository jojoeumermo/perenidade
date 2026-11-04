# Vale o Escrito: curadoria (pacote do painel)

Função "Vale o Escrito: curadoria" no painel (grupo Produção), para os papéis `curadoria` e `coordenacao`. O banco confere o
papel de novo em cada função (`interno.curador()`).

| O quê | Onde |
|---|---|
| Tela: fila, entrada manual, publicadas, correções | `components/painel/ValeOEscrito.tsx` |
| Editor da entrada (fontes, pessoas, organizações, ligações, mesclar, aprovar) | `components/painel/ValeOEscritoEditor.tsx` |
| Lógica pura (conferência, atualizar situação, mesclar, exportação, prazos) | `lib/vale-o-escrito/curadoria.ts` |
| Pedido de arquivo no Internet Archive (Save Page Now) | `app/api/vale-o-escrito/arquivar/route.ts` |
| Exportador para o cache do site | `scripts/vale-o-escrito/exportar.mjs` (`npm run vale-o-escrito:exportar`) |
| SQL novo (seção 16 da migração): `vale_fila_salvar`, `vale_historico_listar`, `vale_arquivo_pedir` | `supabase/migracoes/2026-11-vale-o-escrito.sql` e `install.sql` |
| Teste | `npm run testar:vale-o-escrito-curadoria` |

## Regras aplicadas

- Aprovar só passa se `conferirDoc` passar (fonte, trecho de 20 a 400 letras, data, situação, "segundo [fonte]", pessoa com a marca
  "pública no caso" e fonte, nunca vítima, criança, adolescente ou testemunha: ECA arts. 17, 143 e 247; LGPD art. 14).
- Ao aprovar, a rota `/api/vale-o-escrito/arquivar` chama `https://web.archive.org/save/<url>` (só links públicos; limite de 40 por hora por
  pessoa no banco e 30 por minuto por instância) e guarda o link da cópia em `fonte.arquivoUrl`. Se falhar, a fonte leva
  `arquivoFalhou: true` e a curadoria refaz em Publicadas.
- Atualizar situação (absolvição, arquivamento, nova decisão) exige fonte nova e nota com "segundo [fonte]"; grava em `doc.historico`
  (visível na ficha, sem nome de ninguém) e `atualizadoEm`. O histórico interno (`vale_historico`) guarda quem fez; só a curadoria o lê.
- Curadoria anônima: `docPublico` só deixa passar os campos da `Entrada`; a ficha mostra "curadoria do Vale o Escrito".
- Correções: meta de 7 dias do pedido, o prazo do **art. 5º da Lei 13.188/2015** (conferido em planalto.gov.br em 04/11/2026). Também: art. 2º
  (resposta gratuita e proporcional ao agravo), art. 3º (decadência de 60 dias para pedir), art. 7º (juiz decide em 24 h da citação).
  O Instituto não sabe se é "veículo de comunicação social" e cumpre por boa-fé (ESPEC, 5.1). Direito de resposta aceito entra em
  `doc.respostas`, ao lado da ficha.
- Confirmação: o painel ainda usa `window.confirm` (AoVivo, Apoio...), então publicar, recusar, devolver, mesclar e retirar usam o mesmo padrão.

## Exportador

`npm run vale-o-escrito:exportar [-- --seco] [-- --de linhas.json]` lê `public.vale_publicadas()` (função de leitura pública, chave anônima; a tabela é `interno.vale_entradas`), confere cada
entrada com `regras.ts` e grava `content/vale-o-escrito/entradas/<slug>.json`. Sai com código 1 se barrou alguma entrada e 2 se não leu.
Rodar `node scripts/conferir-rastreio.mjs` depois de leituras novas de disco no site (este script não roda no site).

## Pendências

- SQL novo não executado em Postgres (sem Postgres no ambiente). Rodar em projeto de teste.
- Interface testada só por conferência estática, tipos e eslint; não foi aberta no navegador com um banco real.
- Pedido de arquivo depende de o Internet Archive aceitar o servidor (sem chave, com limite deles); a curadoria pode refazer.
