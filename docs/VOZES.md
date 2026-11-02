# Vozes naturais do "Ouvir a aula"

O "Ouvir a aula" lê a aula frase a frase e destaca a frase lida. Tem pausar, voltar e avançar frase e a velocidade
(de 0,75× a 2×). A pessoa escolhe a voz:

- **Voz do aparelho · leve**: a do próprio celular ou computador (speechSynthesis). Não baixa nada. É o padrão e a reserva.
- **Voz 1 · feminina** e **Voz 2 · masculina**: Kokoro-82M v1.0 (vozes pf_dora e pm_alex), que rodam no aparelho de
  quem ouve. Baixam uma vez (cerca de 105 MB; a segunda voz acrescenta só 0,5 MB, porque as duas dividem o mesmo modelo) e ficam guardadas no navegador
  (Cache Storage "lucia-vozes"). Depois funcionam sem internet.

Nada sai do aparelho: o texto não vai para servidor nenhum, e todo arquivo vem do próprio site (/vozes/ e
/workers/voz.js). Os modelos **não** vão para o Git: `npm run vozes:baixar` os baixa no servidor.

## Como funciona

| Peça | Onde |
| --- | --- |
| Normalizador (números, dinheiro, datas, siglas, unidades, símbolos, fórmulas) | lib/vozes/normalizar.ts (testes: `npm run testar:vozes`) |
| Léxico de pronúncia | content/vozes/lexico.yml (lido pela página da aula; validado no build e nos testes) |
| Leitor (frases, destaque, controles, voz do aparelho e natural) | lib/vozes/leitor.ts; lib/speech.ts mantém os nomes antigos |
| Lista de vozes, escolha ("lucia:voz"), download e motor no Worker | lib/vozes/catalogo.ts |
| Seletor e controles | components/aula/SeletorDeVoz.tsx, components/aula/TocadorDaVoz.tsx, components/aula/OuvirAula.tsx |
| Motor (texto → fonemas → ONNX → som), igual no navegador e no Node | public/workers/voz-motor.js e public/workers/voz.js |
| Download e conferência (revisão fixa, sha256) | scripts/vozes-baixar.mjs → public/vozes/ e public/vozes/vozes.json |
| Amostras curtas (5 s, WAV, vão para o Git) | public/vozes-amostras/ (`npm run vozes:baixar -- --amostras`) |
| Teste de verdade com os modelos | `node --import ./scripts/carregar-ts.mjs scripts/testar-vozes-real.mjs` e `VOZES_REAL=kokoro-f npx playwright test e2e/vozes.spec.ts` |

O Worker fica em /workers/ porque só ali a política de segurança do site deixa compilar WebAssembly. Não foi preciso
mexer no next.config.

Sem `public/vozes/vozes.json`, o seletor mostra só a voz do aparelho e diz que as naturais ainda não estão
disponíveis. Não aparece erro nenhum. No modo leitor (Kindle e tinta eletrônica), nada disso aparece.

## Licenças (conferidas em 02/11/2026, nas páginas oficiais)

| Peça | Licença | Situação |
| --- | --- | --- |
| Kokoro-82M v1.0 (hexgrad), ONNX de onnx-community, revisão 1939ad2a | Apache-2.0. O cartão do modelo diz que o treino usou só áudio permissivo ou sem direitos, inclusive áudio sintético de serviços fechados. | **No site** (Voz 1 = pf_dora, Voz 2 = pm_alex). A pm_santa ficou de fora: nome de personagem. |
| onnxruntime-web 1.22.0 | MIT | No site |
| piper_phonemize em WebAssembly (@diffusionstudio/piper-wasm 1.0.0) | MIT (piper-phonemize) + GPL-3.0-or-later (espeak-ng, fork rhasspy) | No site. O conjunto vale como GPL-3.0, que é compatível com a AGPL-3.0 do site. |
| Piper pt_BR faber, cadu, jeff (medium) | Dados CC0, mas cada modelo foi ajustado a partir da voz inglesa "lessac", cuja base (Blizzard 2013, CSTR Edimburgo) só permite pesquisa e proíbe uso comercial | **Fora do site**: licença incerta |
| Piper pt_BR edresson (low) | Dados CC BY 4.0, mas ajustado a partir da voz inglesa "ryan", que é CC BY-NC-SA 4.0 (não comercial) | **Fora do site**: licença incerta |
| Chatterbox multilíngue | MIT | Não roda bem no navegador. Fica para os vídeos pré-gravados (outra frente). |

Sobre o Piper: não há consenso sobre se a licença da base de treino "passa" para o modelo ajustado. Por isso ele não
entrou. O motor já sabe ler Piper e o teste local passou com a faber. Para ligar uma voz Piper, o dono decide e muda
`liberada: false` para `true` em scripts/vozes-baixar.mjs. É a voz mais rápida das três: num notebook sem placa de
vídeo, gera 3 a 4,5 vezes mais rápido que o tempo de fala, contra 0,4 a 0,5 vez do Kokoro.

Nenhuma voz imita pessoa real. Na tela, os nomes são neutros ("Voz 1", "Voz 2"), e o crédito diz que a voz é sintética
e qual é o modelo.

## Tamanhos (o que cada pessoa baixa uma vez)

| Arquivo | Tamanho |
| --- | --- |
| Modelo Kokoro (8 bits) | 92,4 MB |
| Estilo de cada voz (pf_dora, pm_alex) | 0,5 MB cada |
| onnxruntime-web (WebAssembly) | 11,2 MB |
| espeak-ng com só o português | 0,6 MB (programa) + 0,9 MB (dados; o pacote original tem 18 MB) |
| **Total da Voz 1 ou da Voz 2** | **cerca de 105 MB** (a segunda voz acrescenta só 0,5 MB) |
| Amostras (no Git) | cerca de 250 KB cada |

## Tempo para começar a falar (medido)

Notebook desta máquina (Intel i5, sem placa de vídeo, Chrome, WebAssembly numa linha só):

| Voz | Baixar e abrir (servidor local, sem rede de verdade) | Do clique em "Ouvir" até a 1ª frase soar | Já guardada (página recarregada) | Velocidade de geração |
| --- | --- | --- | --- | --- |
| Voz 1 (Kokoro, pf_dora) | 7,4 s | 8,1 s | 9,0 s | 0,40 a 0,45 vez o tempo de fala |
| Piper faber (fora do site, só teste) | 7,8 s | 0,9 s | 2,5 s | 3 a 4,5 vezes o tempo de fala |

Medido com o Playwright (e2e/vozes.spec.ts, `VOZES_REAL=kokoro-f`) e com scripts/testar-vozes-real.mjs no Node, em
02/11/2026. A velocidade de geração do Kokoro abaixo de 1 quer dizer que a voz **faz pausas entre as frases**: uma
frase de 5 s leva cerca de 12 s para ficar pronta. O leitor já prepara as duas frases seguintes enquanto uma toca,
mas isso não basta para tirar as pausas neste notebook.

Numa rede de verdade, soma-se o download: 105 MB levam cerca de 1,5 min a 10 Mbit/s e cerca de 15 s a 60 Mbit/s.
Isso acontece só uma vez.

Celular médio: não havia celular para medir. Pela conta, um celular médio (4 a 6 GB de memória, processador de 2021
a 2023) é 2 a 3 vezes mais lento que este notebook no WebAssembly. A primeira frase do Kokoro levaria de 20 a 40 s,
com pausas longas entre as frases. Isto é **estimativa, não medida**. Por isso o seletor marca o Kokoro como "pesada
para aparelhos simples" e avisa quando o aparelho tem menos de 4 GB de memória ou está economizando dados.

O que deixaria o Kokoro mais rápido, nesta ordem:

1. **Placa de vídeo (WebGPU)**: o motor sabe usar, mas está desligado (`webgpu: false` em scripts/vozes-baixar.mjs). No teste, o modelo de 8 bits travou no WebGPU do Chrome. O WebGPU pede o modelo em 16 bits (163 MB) ou em 32 bits (326 MB), pesado demais para baixar.
2. **Várias linhas de execução**: o WebAssembly só usa mais de um núcleo quando a página está "isolada"
   (cabeçalhos COOP `same-origin` e COEP `require-corp` ou `credentialless`). O COOP já existe; falta o COEP no
   next.config, que eu não mexi. Atenção: o COEP afeta os quadros de fora (YouTube, PhET, Jitsi). Precisa ser testado
   só nas páginas de aula antes de ligar.
3. Uma voz Piper liberada, se o dono aceitar a licença (veja acima).

## Tráfego (atenção: a conta da Vercel já foi pausada por tráfego)

Cada pessoa que escolhe uma voz natural baixa cerca de 105 MB **uma vez** por navegador. Com 100 pessoas, são cerca
de 10,5 GB. Com 1.000 pessoas, cerca de 105 GB. O plano Hobby da Vercel tem 100 GB por mês de transferência (confirmar no plano atual): cerca
de mil downloads esgotam o mês. O download só começa depois do clique em "Baixar e usar", que mostra o tamanho
antes. Ninguém baixa sem querer.

Hoje, **na Vercel, as vozes naturais ficam desligadas**: o build de lá (vercel.json) não roda `vozes:baixar`, então não
existe /vozes/vozes.json e o seletor mostra só a voz do aparelho. Foi de propósito.

Onde servir os modelos, do melhor para o pior:

1. **No servidor da Oracle (Coolify)**, que tem 10 TB por mês de saída no plano gratuito (confirmar na página da Oracle): comando de build
   `npm run vozes:baixar && npm run build`. Os arquivos ficam em public/vozes/ e saem pelo `next start`.
2. **Cloudflare na frente**, guardando /vozes/* no cache dela. Os nomes das pastas levam a revisão
   (kokoro-1939ad2/, ort-1.22.0/, espeak-xxxxxxxx/), então os arquivos nunca mudam e podem ser guardados para sempre.
   Regra de cache para `/vozes/*` e `/vozes-amostras/*`: "Eligible for cache", Edge TTL de 1 ano, e
   `Cache-Control: public, max-age=31536000, immutable` (por Transform Rule, já que o next.config não foi mexido).
   Atenção: o plano gratuito da Cloudflare não guarda arquivos acima de 512 MB (os nossos têm até 92 MB, então
   cabem). O Cloudflare Pages recusa arquivos acima de 25 MiB, então o modelo não cabe lá. R2 aceitaria, mas aí o
   endereço muda e esbarra na política de segurança (connect-src 'self').
3. Na Vercel, só se o plano for pago, e mesmo assim com a regra da Cloudflare na frente.

O que precisa mudar no next.config, quando quem cuida da hospedagem puder (anotado aqui, não feito):

- `{ source: "/(vozes|vozes-amostras)/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }`
- O COEP só nas páginas de aula, se for testar as várias linhas de execução (item 2 da seção anterior).

## Passo a passo para o dono

1. No Coolify, o comando de build passa a ser `npm run vozes:baixar && npm run build`. O `vozes:baixar` leva de 1 a
   6 min, conforme a rede do servidor (baixa cerca de 93 MB do Hugging Face). Se o Hugging Face estiver fora do ar, ele
   avisa e o build segue, só sem as vozes naturais. Com `-- --estrito`, ele derruba o build.
2. Na Cloudflare, faça a regra de cache de /vozes/* descrita acima.
3. Na Vercel, não mude nada: lá as vozes ficam desligadas.
4. Para trocar de versão: mude a revisão e os sha256 em scripts/vozes-baixar.mjs. Depois rode
   `npm run vozes:baixar -- --amostras`, ouça as amostras e rode o teste de verdade.
