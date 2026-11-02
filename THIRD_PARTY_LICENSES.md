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

## Vozes naturais do "Ouvir a aula" (public/vozes, fora do Git)

Baixadas por `npm run vozes:baixar` (scripts/vozes-baixar.mjs), em revisão fixa e com sha256 conferido. Rodam no
aparelho de quem ouve; o site não envia texto para lugar nenhum. Licenças conferidas em 02/11/2026 nas páginas
oficiais (detalhes em docs/VOZES.md).

| O quê | Versão | Origem | Licença | Observação |
| --- | --- | --- | --- | --- |
| onnxruntime-web | 1.22.0 (npm) | https://github.com/microsoft/onnxruntime | MIT | Roda os modelos (WebAssembly; WebGPU onde houver). Copiado do node_modules sem alteração. |
| piper_phonemize em WebAssembly (pacote @diffusionstudio/piper-wasm) | 1.0.0 (npm) | https://github.com/diffusion-studio/piper-wasm, compilado de https://github.com/wide-video/piper-phonemize (MIT) e https://github.com/rhasspy/espeak-ng | MIT (piper-phonemize) + GPL-3.0-or-later (espeak-ng) | O binário junta os dois: vale a GPL-3.0, compatível com a AGPL-3.0 do site. Do pacote de dados do espeak-ng ficam só os arquivos do português (os outros saem; nenhum arquivo é mudado). Código-fonte correspondente: os dois repositórios acima e o roteiro de compilação no README do pacote. |
| Kokoro-82M v1.0, em ONNX (model_quantized.onnx, tokenizer.json) | Hugging Face onnx-community/Kokoro-82M-v1.0-ONNX, revisão 1939ad2a8e416c0acfeecc08a694d14ef25f2231 | https://huggingface.co/hexgrad/Kokoro-82M | Apache-2.0 | Pesos treinados só com áudio de licença permissiva ou sem direitos, segundo o cartão do modelo. |
| Vozes pf_dora e pm_alex do Kokoro | mesma revisão | idem | Apache-2.0 | Mostradas como "Voz 1" e "Voz 2". A pm_santa ficou de fora (nome de personagem). |
| Piper (código) | — | https://github.com/rhasspy/piper | MIT | O site não usa o programa, só o formato dos modelos. |
| Vozes pt_BR do Piper (faber, cadu, jeff, edresson) | rhasspy/piper-voices, revisão b4e358ffcb232591bf73a540e70f7de528e4174a | https://huggingface.co/rhasspy/piper-voices | Incerta: FORA do site | Dados em português CC0 (CC BY 4.0 na edresson), mas cada modelo foi ajustado a partir de uma voz inglesa cuja base não permite uso comercial (lessac: Blizzard 2013, só pesquisa; ryan: CC BY-NC-SA 4.0). Só baixa com --com-bloqueadas, para teste local. |
