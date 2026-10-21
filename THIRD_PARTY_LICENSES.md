# Licenças de terceiros

Bibliotecas, dados e fontes de terceiros que o site serve do próprio domínio, com a licença de cada um. A lista
completa, com links, está em /pt/creditos. O código do instituto é AGPL-3.0-or-later (LICENSE) e o conteúdo,
CC BY-SA 4.0 (LICENSE-CONTEUDO.md).

## Dados servidos em public/dados

| O quê | Onde | Origem | Licença | Observação |
| --- | --- | --- | --- | --- |
| CC-CEDICT | public/dados/chines/cedict.json.gzip | MDBG e colaboradores, https://www.mdbg.net/chinese/dictionary?page=cedict | CC BY-SA 4.0 | Convertido do formato texto para JSON por scripts/dados-chines.mjs; a conversão é distribuída sob a mesma licença. Versão e data da extração em public/dados/chines/meta.json. |
| Traços de caracteres (Make Me a Hanzi) | public/dados/chines/hanzi/ | pacote hanzi-writer-data 2.0.1, https://github.com/chanind/hanzi-writer-data, a partir das fontes AR PL da Arphic | Arphic Public License (public/dados/chines/hanzi/ARPHICPL.TXT) | Recorte de caracteres comuns copiado sem alteração do conteúdo; só o nome de cada arquivo passa a ser o código Unicode do caractere. |
| VERO, dicionário de português do Brasil | public/dados/ortografia/ | Raimundo Moura e equipe (LibreOffice), pelo pacote dictionary-pt 4.0.0 | LGPL-3.0 ou MPL-2.0 (public/dados/ortografia/LICENCA-VERO.txt) | Os arquivos .aff e .dic, sem alteração, comprimidos com gzip. |

## Bibliotecas novas

| O quê | Versão | Licença |
| --- | --- | --- |
| hanzi-writer | 3.7.3 | MIT |
| hanzi-writer-data (só para gerar os dados; não vai para o navegador) | 2.0.1 | Arphic Public License |
| dictionary-pt (só para copiar o dicionário) | 4.0.0 | LGPL-3.0 ou MPL-2.0 (dicionário), MIT (pacote) |
