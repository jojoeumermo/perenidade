# E4-04 · Acesso e confiança

Selo de privacidade com frases conferidas (R1-92), painel público de qualidade (R1-90), espelho (R1-93) e teste no
celular de entrada (R1-89). Vale para o site inteiro, não só para `/escola`.

## O que fica atrás do recurso `escola`

| Peça | Com `escola` desligado | Com `escola` ligado |
|---|---|---|
| Selo nas ferramentas da caixa (ToolView) | aparece | aparece |
| Painel de qualidade em `/status` | aparece | aparece |
| Selo no reforço, no VLibras e na prática com reconhecimento de fala | não aparece | aparece |
| "Se o site cair, leia aqui" (`/status` e página "fora do ar") | não aparece | aparece só se `NEXT_PUBLIC_ESPELHOS` tiver valor |

O selo das ferramentas e o painel são só informação; o resto segue a regra comum da Etapa 4. Enquanto o E4-01 não
juntar `escola` a `lib/recursos.ts`, as chamadas usam `ligado("escola" as Recurso)`, que devolve falso.

## R1-92 · Selo de privacidade

- `components/SeloDePrivacidade.tsx`: `SeloDePrivacidade({ tipo, servico?, naoGuarda?, parte?, ancora?, lang? })` e
  `SelosDePrivacidade({ item })` (o selo principal e os das partes). Ícone com `aria-hidden` e frase em texto real,
  com o rótulo "Privacidade" para leitor de tela e um link para `/privacidade#<seção>`. Os pacotes das ondas 2 a 4
  usam este componente.
- `lib/selos.ts`: o selo de cada uma das 52 ferramentas de `lib/areas.ts` (49 "fica no aparelho", 2 "passa pelo
  servidor", 1 "serviço de fora") e os selos de fora da caixa (`SELOS_DE_FORA`).
- Frases (`i18n/escola/acesso/<lang>.json`, grupo `selo`), escolhidas por `fraseDoSelo`:
  - `aparelho`: "Fica no seu aparelho".
  - `instituto`: "Passa pelo servidor do Instituto" (sem promessa sobre guarda).
  - `institutoNaoGuarda`: "…; o Instituto não guarda o que você mandou". Só com a rota lida e conferida.
  - `institutoConsulta`: "Passa pelo servidor do Instituto, que consulta {servico}; quem é consultado não fica sabendo
    quem você é". É a frase que a privacidade já usa para o dicionário e as frases traduzidas.
  - `externo`: "Usa um serviço de fora: {servico}".

### O que foi conferido no código

| Ferramenta ou recurso | Selo | Conferência |
|---|---|---|
| dicionario | instituto + consulta (Wikcionário, Dicionário Aberto, Free Dictionary API) | `app/api/dicionario/route.ts`: GET com a palavra no endereço, o servidor busca por `lib/externo.ts` com o nome do instituto; não grava nada. **Por ser GET, sem "não guarda"**: a hospedagem registra o endereço por pouco tempo (privacidade, "Registros técnicos"). |
| frases | instituto + consulta (Tatoeba) | `app/api/frases/route.ts`: mesmo caso, GET, sem "não guarda". |
| resolvedor | aparelho; a foto do exercício: instituto que não guarda + provedor de IA | A conta roda no aparelho (`lib/ferramentas/resolvedor.ts`). A foto vai por `askAssistant` à Edge Function `assistente` (POST); o arquivo diz que pergunta, foto e resposta não são guardadas, e o teste confere que nenhuma chamada ao banco nem registro leva o pedido. |
| simulacoes | externo (PhET) | `components/labs/Phet.tsx` abre a simulação em `<iframe>` de phet.colorado.edu. |
| silabario, pronuncia, palavras-geradoras, tons-do-mandarim, alfabetos, dicionario-chines, escrita-chinesa | aparelho; a voz: voz do navegador | `speechSynthesis`; a privacidade já diz que em alguns navegadores essa voz é gerada pela empresa do navegador. Os dicionários e traços do chinês e o corretor vêm de arquivos do próprio site. |
| python, php | aparelho | Pyodide e PHP em WebAssembly servidos do próprio site (`public/workers`, `/pyodide/`). |
| afinador | aparelho | O microfone é analisado no aparelho; nada é enviado. |
| Reforço (`components/Assistente.tsx`) | instituto que não guarda + provedor de IA, com servidores fora do Brasil | Mesma Edge Function. Os provedores listados nela (Anthropic, Groq, Cerebras, Gemini, OpenRouter) ficam fora do Brasil. |
| VLibras (`components/estudo/AtivarVLibras.tsx`) | externo: governo federal | `lib/vlibras.ts` carrega de vlibras.gov.br. |
| Prática com reconhecimento de fala (`components/Pratica.tsx`) | externo: serviço de voz do navegador | `SpeechRecognition` do navegador; em alguns navegadores o áudio vai para a empresa do navegador. |

`scripts/testar-acesso.mjs` refaz essa conferência a cada mudança: lê o componente de cada ferramenta (e o que ele
carrega), procura `fetch('/api/…')`, `askAssistant`, `speechSynthesis`/`falar(`, `SpeechRecognition` e `<iframe src=`, e
falha se o selo não bater com o que achou, se faltar selo, se a rota não existir, se o método for outro, se um GET
prometer "não guarda" ou se a rota gravar em tabela ou arquivo.

### Âncoras da privacidade

O renderizador (`components/Markdown.tsx`) usa `rehype-slug`, que dá id aos títulos. O selo "aparelho" leva a
`#se-você-só-estuda`; "instituto" e "externo" levam a `#os-serviços-que-mantêm-o-site-no-ar`. O teste confere que os
ids existem em `content/paginas/privacidade.md`; se o E4-02 trocar os títulos, o teste avisa.

## R1-90 · Painel público de qualidade

`lib/qualidade.ts` conta, na montagem (a página `/status` é estática), a partir dos mesmos arquivos e regras de
`lib/content.ts` (originais em português, sem `ativo: false`, sem trilhas desligadas) e da situação de revisão de
`lib/pendencias.ts` (o campo `revisoes`, o mesmo que `lib/revisoes-conteudo.ts` mostra na aula):

- **Revisadas**: com histórico de revisão (`revisoes`) ou aprovadas no painel (`revisada: true`).
- **Em revisão, com o modelo completo**: sem revisão, mas com todas as partes de `docs/MODELO-DE-AULA.md`.
- **Em revisão, faltam partes do modelo**: o que o desenho chamou de "sem revisão": a aula ainda precisa de trabalho
  antes de ir para quem revisa. O site chama toda aula não revisada de "Em revisão", e o painel mantém essa palavra.
- **Com fontes**, **com teste** (quiz no fim) e **com exercícios corrigidos** (arquivo em `content/exercicios`, com a
  explicação de cada erro).
- **Trilhas** com pelo menos uma aula e ainda sem aula (só a contagem; o catálogo é da Etapa 3).
- Data do cálculo, no horário de Brasília.

`components/QualidadeDoConteudo.tsx` mostra os números com barras simples (contorno no leitor de tinta e no alto
contraste), sem nome de pessoa, e o link para o guia de revisão (`/contribuir/guia#revisar`).

Medição de 03/11/2026 (pelo teste): 1.367 aulas; 0 revisadas; 757 em revisão com o modelo completo; 610 em revisão
faltando partes; 1.367 com fontes; 1.367 com teste; 235 com exercícios corrigidos; 318 trilhas, 198 com aula e 120
ainda sem aula.

## R1-93 · Espelho

- `.github/workflows/espelho.yml` já existia e continua igual; ganhou só o passo opcional "Publicar o espelho"
  (Cloudflare Pages, `wrangler@4.147.0` fixo), **inerte** sem `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e
  `ESPELHO_PROJETO`. Nada foi publicado.
- `components/EspelhosDoSite.tsx` lê `NEXT_PUBLIC_ESPELHOS` (só `https://`, sem usuário e senha, sem repetição, até
  cinco) e mostra "Se o site cair, leia aqui" em `/status` e na página "fora do ar" (`app/[lang]/fora-do-ar/route.ts`,
  em HTML puro, com `htmlDosEspelhos`).
- Passo a passo para a coordenação: `docs/ESPELHO-E-COPIAS.md`.

## R1-89 · Celular de entrada

- Projeto `entrada` no `playwright.config.ts`: 360 × 640, `deviceScaleFactor` 2, `isMobile`, `hasTouch`. No próprio
  teste, pelo protocolo do Chrome: CPU 4× mais lenta e rede 3G lenta (400 kbps, 400 ms). Os projetos `computador` e
  `celular` ignoram esse arquivo.
- `e2e/aparelho-de-entrada.spec.ts` mede o LCP, o JavaScript transferido e o total transferido em `/pt`, na primeira
  aula escrita de Ler e escrever e em `/pt/escola` (pulado se der 404), e confere que não há rolagem lateral.
- **Limites a calibrar.** Este pacote não pôde rodar `next build` nem Playwright, e não inventa número: os limites
  estão `null` no arquivo, e o teste mede e anota sem falhar até alguém gravar "medição + 10%" (instruções no topo do
  arquivo). Referência só para orientar, medida com `curl` em 03/11/2026 na produção: os 13 scripts do HTML inicial de
  `https://institutolucia.org/pt` somam 252.017 bytes comprimidos (cerca de 246 KB); não inclui os pedaços carregados
  depois nem o LCP.
- `docs/TESTE-EM-APARELHO-REAL.md`: a lista para o celular fixo do Núcleo (instalar, abrir sem rede, ouvir, modo leve,
  letra grande, tema escuro, gasto de dados e como relatar).

## Testes

- `npm run testar:acesso` (`scripts/testar-acesso.mjs`): selos × código, rotas, âncoras, seis idiomas, palavras
  proibidas, `lib/qualidade` contra uma contagem independente (lida com o `js-yaml` direto) e o espelho.
- `e2e/escola-acesso.spec.ts` (computador e celular): selo numa ferramenta da caixa e no reforço (pulado se o
  assistente estiver desligado no banco de teste), qualidade em `/status`, espelhos ausentes sem a variável, sem
  rolagem lateral em 360 px.
- `npm run testar:entrada`: `playwright test --project=entrada` (o script é reservado pelo E4-01).

## Pendências para a coordenação

1. Calibrar os limites de `e2e/aparelho-de-entrada.spec.ts` e o "X MB" de `docs/TESTE-EM-APARELHO-REAL.md` com uma
   rodada contra `next build && next start`.
2. Se quiser o espelho publicado sozinho: criar o projeto no Cloudflare Pages e os três valores do GitHub; depois pôr o
   endereço em `NEXT_PUBLIC_ESPELHOS` na Vercel.
3. A página de privacidade ainda não descreve o assistente de reforço (o texto pronto está em
   `docs/privacidade-assistente.md`, para o dia em que ele for ligado). O selo do reforço leva à seção de serviços,
   que hoje não fala dele.
