# Vozes naturais do "Ouvir a aula"

O "Ouvir a aula" lê a aula frase a frase e destaca a frase lida. Tem pausar, voltar e avançar frase e a velocidade
(de 0,75× a 2×). A pessoa escolhe a voz:

- **Voz do aparelho · leve**: a do próprio celular ou computador (speechSynthesis). Não baixa nada. É o padrão e a reserva.
- **Voz 1 · feminina** e **Voz 2 · masculina**: Kokoro-82M v1.0 (vozes pf_dora e pm_alex), que rodam no aparelho de
  quem ouve. Baixam uma vez (cerca de 105 MB; a segunda voz acrescenta só 0,5 MB, porque as duas dividem o mesmo modelo) e ficam guardadas no navegador
  (Cache Storage "lucia-vozes"). Depois funcionam sem internet.

Nada sai do aparelho: o texto não vai para servidor nenhum, e todo arquivo vem do próprio site (/vozes/ e
/workers/voz.js). Os modelos **não** vão para o Git: o build da Vercel os baixa (`npm run vozes:baixar`, no prebuild).

## Trocar de voz agora troca de verdade (T04, 06/11/2026)

Queixa: "escolho uma voz nas aulas, volto, escolho outra, e o site não troca". Medido no site no ar (Chrome, este
notebook, Voz 2 baixada e depois Voz 1), espiando as mensagens para o Worker:

- Depois da troca, as frases ainda pedidas da voz antiga continuavam na fila do Worker (a troca usava `parar(false)`,
  que não abre sessão nova). Cada frase leva de 10 a 25 s no CPU, então a voz nova esperava atrás delas.
- Enquanto isso a voz do aparelho lia. Como ela anda mais rápido que a geração, o som da voz natural nunca estava
  pronto no começo de um trecho, e a regra "a natural só entra no começo de um trecho com o som pronto" nunca se
  cumpria: em 20 frases seguidas, todas saíram pela voz do aparelho. Qualquer voz escolhida soava igual.
- Também: abrir o seletor aquece a voz guardada; se a pessoa trocava antes de o modelo abrir, o aquecimento terminava
  depois e devolvia a voz antiga ao leitor; e "Baixar e usar" a segunda voz, com o modelo já aberto pela primeira, não
  guardava o arquivo dela (aparecia "já está neste aparelho" sem estar).

Conserto (lib/vozes/leitor.ts, lib/vozes/trechos.ts, lib/vozes/catalogo.ts, public/workers/voz.js):

- `trocarVoz` esvazia a fila (`parar(true)`: sessão nova, o Worker descarta as frases da voz antiga) e a voz escolhida
  entra **já na frase atual**, esperando o som se preciso (aparece "Preparando a próxima frase…"). Clicar de novo na
  voz que ainda não entrou também a força a entrar.
- A voz do aparelho cede no máximo **um trecho** depois que a natural fica pronta; no começo do trecho seguinte a
  natural entra mesmo que precise esperar o som (`trechosDoAparelho` em `escolherVoz`, testado em `npm run testar:vozes`).
- O aquecimento confere se a escolha ainda é a mesma antes de mexer no leitor.
- O Worker ganhou a mensagem `guardar`: baixa e guarda o estilo da outra voz sem fechar o modelo aberto.

## Começa na hora (03/11/2026)

- **Sem espera no clique**: com a voz natural escolhida mas ainda abrindo (ou baixando), a voz do aparelho já começa
  a ler. A natural abre ao fundo e entra **no começo do próximo trecho** (parágrafo, item de lista, título), quando o
  som dela já está pronto; nunca troca no meio de um parágrafo. O tocador mostra "Trecho X de Y · Frase N de M" e avisa
  que a voz do aparelho lê enquanto a natural carrega. As regras estão em `lib/vozes/trechos.ts` (testadas em
  `npm run testar:vozes`).
- **Não trava**: a fala do aparelho fica guardada (o Chrome recolhia a fala da memória e o fim nunca chegava); um vigia
  confere se a fala começou (senão tenta de novo e, depois, passa para a voz natural ou avisa "não deu para ler em voz
  alta neste aparelho") e se ela acabou sem avisar (segue para a próxima frase). Se a voz natural falha numa frase, a do
  aparelho continua a leitura.
- O texto preparado para a voz (números, siglas, léxico) é montado frase a frase, na hora de falar: aula longa não
  atrasa o começo.

## Novidades de 02/11/2026 (tarde)

- **Modo de leitura** (no seletor, guardado em "lucia:voz"): "Ler frase por frase", com respiro, destaque, voltar e
  avançar; ou "Ler a aula toda direto", que emenda as frases sem pausa.
- **Idioma por trecho**: cada frase sai no idioma dela (o `lang` da aula ou do trecho; o conteúdo ainda não traduzido
  usa a marca `data-content-lang`). Um trecho em inglês de 3 palavras ou mais, numa aula em português, vira frase
  própria e é lido pela voz inglesa. A voz em português é a que a pessoa escolhe. Nos outros idiomas, a voz é escolhida
  sozinha, do mesmo gênero: inglês af_heart (f) e am_michael (m); espanhol ef_dora (f) e em_alex (m); francês ff_siwis
  (só há voz feminina em francês no Kokoro v1.0). Todas são Apache-2.0, do mesmo modelo. Cada uma acrescenta 0,5 MB, e
  o espeak passou a levar os dicionários de inglês, espanhol e francês (o pacote de dados foi de 0,9 para 1,2 MB).
- **Outros idiomas sem regra brasileira**: só o português passa pelo normalizador. Em inglês, espanhol e francês, o
  espeak do idioma lê números e siglas, e em inglês os anos saem em pares ("18 22"). Idioma sem voz natural (russo,
  chinês) usa a voz do aparelho naquela frase.
- **Espera menor**:
  - ao passar o mouse no "Ouvir", focar o botão ou abrir o seletor, o modelo já abre e as duas primeiras frases
    começam a ser geradas, se a voz já estiver baixada;
  - a primeira frase longa é partida em 6 a 10 palavras;
  - enquanto uma frase toca, as três seguintes são geradas, uma de cada vez;
  - frases longas são partidas em até 180 caracteres;
  - o modelo fica aberto entre as frases e entre as aulas;
  - se a próxima frase ainda não estiver pronta, aparece "Preparando a próxima frase…".
- **Troca de aula**: ao navegar para outra página (ou ao desmontar o leitor), o som para, a fila de frases prontas é
  esvaziada e o Worker descarta o que estava gerando. Cada leitura tem um número de sessão. Teste em e2e/vozes.spec.ts
  ("trocar de aula no meio da leitura…").
- **Prévias da Vercel sem vozes**: o `vozes:baixar` só baixa quando `VERCEL_ENV` é `production` (ou fora da Vercel, no
  build local). Cada deploy guardava uma cópia de cerca de 105 MB, e o armazenamento de deploys chegou a 35,6 GB de 10 GB.
  Nas prévias não existe /vozes/vozes.json, e o seletor mostra só a voz do aparelho, sem erro.

### Tempo até o primeiro som e pausas entre frases (Chrome, este notebook, voz já guardada, mesma aula)

| | Antes | Depois |
| --- | --- | --- |
| Do clique em "Ouvir" ao primeiro som (página recém-aberta, modelo fechado) | 23,7 s | 27,5 s (sem mudança: o tempo é o de abrir o modelo, 92 MB, uma vez por página aberta) |
| Pausas entre as frases 2 a 5 | 26,6 / 12,1 / 11,1 / 71,7 s | 0,3 / 0,2 / 1,9 / 23,5 s |

Medido com `VOZES_REAL=kokoro-f npx playwright test e2e/vozes.spec.ts -g verdade`, com o servidor de desenvolvimento
rodando ao lado, o que deixa a máquina mais lenta: na primeira medida da manhã, sem essa carga, o primeiro som saía em
8 s. O primeiro som só fica rápido quando o modelo já está aberto, porque a pessoa passou o mouse no botão, abriu o
seletor ou já ouviu outra aula na mesma visita. No CPU, o Kokoro gera menos de meio segundo de fala por segundo; por
isso, numa frase longa, ainda pode haver espera, e aí aparece o aviso.

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

## Hospedagem: Vercel com o Cloudflare na frente (decisão de 02/11/2026)

- **Build**: o `prebuild` do package.json roda `node scripts/vozes-baixar.mjs` depois do EPUB. Na Vercel, o build
  baixa cerca de 93 MB do Hugging Face (alguns segundos) e põe tudo em public/vozes/. O que o build gera em public/
  entra no deploy como arquivo estático. A documentação da Vercel (vercel.com/docs/limits, consultada em 02/11/2026)
  limita a 100 MB, no Hobby, só o *upload* de código-fonte pela linha de comando. Para os arquivos gerados no build,
  ela diz que "não há limite superior", só o prazo de 45 min do build. O maior arquivo nosso tem 92,4 MB.
- **Se o Hugging Face cair na hora do build**: o script avisa e o build segue sem vozes naturais. O site mostra só a
  voz do aparelho, sem erro.
- **Cache**: o next.config manda `Cache-Control: public, max-age=31536000, immutable` em /vozes/<pasta>/<arquivo>. A
  versão está no nome da pasta (kokoro-1939ad2/, ort-1.22.0/, espeak-<hash>/), então trocar de versão muda o
  endereço e nada velho fica preso. A lista /vozes/vozes.json fica sem cache longo, para a troca de versão chegar.
- **Modelo**: o Kokoro em 8 bits (model_quantized, 92,4 MB) é o menor que roda no WebAssembly e soa bem. O q8f16
  (86 MB) só economizaria 6 MB e usa contas em 16 bits, que o WebAssembly não faz bem. O 32 bits (326 MB) e o 16 bits
  (163 MB) ficam fora pelo peso.

### Tráfego esperado (estimativa; a conta da Vercel já foi pausada por tráfego)

Quem baixa: só quem clica em "Baixar e usar", uma vez por navegador, cerca de 106 MB.

Sem o Cloudflare guardando, cada download sai da Vercel: 100 pessoas dão 10,6 GB, e 1.000 pessoas dão 106 GB por mês.
Isso é acima dos 100 GB de transferência do plano Hobby (confirmar no plano atual).

Com a regra de cache abaixo, a Vercel só entrega o arquivo quando um ponto do Cloudflare ainda não o tem:

- **Por ponto do Cloudflare**: 106 MB na primeira vez, para as duas vozes. Os arquivos não mudam, então o ponto só
  busca de novo se o Cloudflare tirar o arquivo do cache por falta de uso (pode acontecer em semanas sem pedido;
  o Cloudflare não garante o prazo).
- **Por mês**: o Brasil é atendido por cerca de 15 a 25 pontos do Cloudflare (número aproximado, varia). Sem o
  Tiered Cache: de 106 MB × 20 = cerca de 2,1 GB, até umas 3 vezes isso se houver remoções, ou seja, **2 a 6 GB por
  mês saindo da Vercel**, quase independente do número de pessoas. Com o Tiered Cache (camada intermediária, grátis):
  **cerca de 0,1 a 0,5 GB por mês**, porque só a camada de cima busca na Vercel.
- **Do Cloudflare para as pessoas**: não é cobrado no plano gratuito.

Isto é estimativa, não medida. Depois de uma semana no ar, confira na Vercel (Usage → Fast Data Transfer e Fast Origin
Transfer, filtrando /vozes) e no Cloudflare (Analytics → Cache, taxa de acerto em /vozes/).

### Regra de cache que o dono precisa criar no Cloudflare

1. Entre no painel do Cloudflare e abra o domínio institutolucia.org.
2. **Caching → Cache Rules → Create rule**. Nome: `vozes naturais`.
3. Em "When incoming requests match", escolha **Custom filter expression → Edit expression** e cole:
   `(starts_with(http.request.uri.path, "/vozes/") and http.request.uri.path ne "/vozes/vozes.json") or starts_with(http.request.uri.path, "/vozes-amostras/")`
4. Em "Then": **Cache eligibility → Eligible for cache**.
5. **Edge TTL → Use cache-control header if present**, com o padrão de 1 year (1 ano).
6. **Browser TTL → Respect origin**. Salve com **Deploy**.
7. **Caching → Tiered Cache → Smart Tiered Caching Topology → Enable** (grátis).
8. Teste: `curl -sI https://institutolucia.org/vozes/ort-1.22.0/ort.wasm.min.js` duas vezes. Na segunda, a linha
   `cf-cache-status` deve dizer `HIT`.

Sem essa regra, o Cloudflare não guarda .onnx, .bin e .data (não estão na lista padrão dele) e tudo sai da Vercel.

### Se um dia a Vercel não puder servir

A alternativa mais barata é pôr só /vozes/* num depósito R2 do Cloudflare (10 GB grátis, saída sem custo) e levar o
caminho /vozes/* do domínio para lá com um Worker do Cloudflare (o plano grátis tem cota diária de pedidos; confirmar). Assim o endereço continua o mesmo e a
política de segurança (connect-src 'self') não muda. O Cloudflare Pages não serve: ele recusa arquivos acima de 25 MiB.

## Passo a passo para o dono

1. Crie a regra de cache e ligue o Tiered Cache no Cloudflare (seção acima).
2. Nada a fazer na Vercel: o build já baixa as vozes.
3. Para trocar de versão, mude a revisão e os sha256 em scripts/vozes-baixar.mjs. Rode
   `npm run vozes:baixar -- --amostras`, ouça as amostras e rode o teste de verdade
   (`VOZES_REAL=kokoro-f npx playwright test e2e/vozes.spec.ts`).
4. Decida sobre o Piper (seção de licenças).
