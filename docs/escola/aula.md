# A aula por dentro (Etapa 4, pacote E4-03)

Controles novos dentro de **toda** aula (não só as da Escola Lúcia Maria), todos atrás do recurso `escola`
(`NEXT_PUBLIC_RECURSOS=escola`, ligado pela coordenação). Com o recurso desligado, nada é calculado nem aparece, e a
aula fica exatamente como era. Nada do que a pessoa faz aqui vai para o servidor: posição, partes, letra, modo uma mão
e o cartão do trecho ficam no aparelho. A única consulta ao servidor é a palavra que a pessoa pede no "O que é?"
(dicionário aberto, pela rota que já existia, `/api/dicionario`).

Textos nos 6 idiomas em `i18n/escola/aula/{pt,en,es,fr,zh,ru}.json`, escolhidos pela página e passados por props
(`i18n/escola/aula/index.ts` só roda no servidor). Estilo em `styles/escola-aula.css`, no visual do Caderno do Povo.
As peças de cliente entram por `components/aula/AulaVivaSobDemanda.tsx` (carga tardia), para não pesar no orçamento da
aula (`scripts/orcamento-peso.mjs`, 700 KiB).

| Ideia | O que faz | Onde |
| --- | --- | --- |
| R1-13 Próximo passo | No fim da aula, botão grande (56 px ou mais) "Próxima aula: …" e "Revisar esta aula", que grava `{aula}` em `sessionStorage` (`lucia:praticar-aula`) e abre `/meu-estudo/praticar` (quem lê é o E4-05). Na última aula: "Fazer a prova da trilha" (trilha com 10 questões ou mais) ou "Escolher a próxima trilha". Depois de 85% do texto, a barra compacta "Próxima" no pé da tela; some ao voltar e quando o fim da aula está na tela. A prop `proxima` fica aberta para o E4-07 trocar pela próxima do curso. | `components/Progress.tsx` (`CompleteButton`, prop `passo`), `components/aula/ProximoPasso.tsx` |
| R1-17 Aula em fatias | `fatiar(markdown)` divide pelos títulos `##`/`###` em partes de 540 a 900 palavras (3 a 5 minutos a 180 palavras por minuto, a conta de `minutesOf`). Seção longa demais é partida entre parágrafos de texto corrido. Aula de até 1080 palavras (6 minutos) fica inteira: partida, as duas metades teriam menos de 3 minutos. A página continua uma só (busca e offline). Índice das partes no topo, marca "Parte 2 de 5 · 4 min", "Parar aqui" no fim de cada parte, modo "uma parte por vez" lembrado em `lucia:aula-em-partes`. Cada bloco do texto ganha `data-parte` (o E4-10 lê). | `lib/fatias.ts`, `components/aula/Fatias.tsx` |
| R1-18 Retomar exatamente | `lucia:posicao-da-aula` guarda `{[aula]: {parte, paragrafo, trecho, em}}`, até 100 aulas (sai a mais antiga). Grava quando a rolagem para por 2 s, quando o áudio pausa e no `pagehide`. Ao voltar, o aviso "Voltar para onde parou (parte 3, parágrafo 12)", sem pular sozinho. `pontoDaAula(aula)` e `linkDoPonto(caminho, ponto)` ficam para o E4-09. | `lib/posicao-da-aula.ts`, `components/aula/RetomarAqui.tsx` |
| R1-19 Letra de verdade | A−, A, A+ (alvo de 48 px) em 5 passos: 100, 115, 130, 150, 175%. Grava o mesmo `prefs.scale` do painel de acessibilidade, pela API de `lib/prefs.ts`, e anuncia o tamanho em `aria-live`. Na faixa preta da aula (computador) e na folha da aula (celular). | `components/aula/TamanhoDaLetra.tsx` |
| R1-20 e R1-25 Barra de seleção | Uma palavra: "O que é?" procura primeiro no glossário (termos da aula e verbetes do site, pelo `/<idioma>/indice-leve.json` que a busca já usa) e depois no dicionário aberto (`/api/dicionario`), numa folha de baixo com fonte, licença e a linha "Consulta feita pelo servidor do Instituto a um dicionário aberto". Três palavras ou mais: "Compartilhar trecho", que desenha num canvas um PNG de 1080×1080 (até 280 caracteres, título da aula, endereço do site, cores do tema atual, fonte do sistema). Com `navigator.share` de arquivo, compartilha; sem, baixa a imagem e copia o link. Se o PNG passar de 80 KB, sai em JPEG. | `components/aula/BarraDeSelecao.tsx`, `components/aula/CartaoDoTrecho.tsx` |
| R1-23 Modo uma mão | Interruptor na folha da aula do celular, lembrado em `lucia:uma-mao`, que põe `data-uma-mao` no `<html>`: voltar, ouvir e a letra descem para uma faixa acima da barra de ações (onde já estão marcar feita e próxima) e a barra de cima fica só com o voltar e o título. Só abaixo de 768 px e nunca no leitor de tinta. | `components/celular/AcoesDaAula.tsx`, `styles/escola-aula.css` |
| R1-24 Tela desligada | Ver a seção abaixo. Fica neste pacote, e não na fase de campus do R1, porque este pacote é o dono de `lib/vozes/leitor.ts`. | `lib/vozes/leitor.ts`, `components/aula/TocadorDaVoz.tsx` |
| R1-87 Ouvir antes de ler | Nas aulas e na página das trilhas de alfabetização (a mesma regra do `data-letra-grande`: área `alfabetizacao`, etapa diferente de `superior`), cada parágrafo ganha "Ouvir", que lê só aquele parágrafo com o leitor do "Ouvir a aula". Os botões de navegação (anterior, próxima, marcar feita) ganham ícone de traço e `aria-label`. | `components/aula/OuvirParagrafo.tsx`, páginas da aula e da trilha |
| R1-88 Linguagem simples verificada | `contarSilabas` (regra aproximada, testada com palavras de divisão conferida à mão) e `indiceDeLeitura` (Flesch adaptado ao português). `npm run legibilidade` mede as aulas de entrada (etapa `fundamental` e área `alfabetizacao`), grava `docs/legibilidade.csv` e lista as candidatas a versão fácil (índice abaixo de 50). "Leitura: fácil / média / difícil" aparece nas aulas de entrada, calculado na montagem, com a explicação ali mesmo. Se existir `<aula>.facil.md` ao lado da aula, aparece "Ler versão fácil". | `lib/legibilidade.ts`, `scripts/legibilidade.mjs`, `components/aula/NivelDeLeitura.tsx`, `components/aula/VersaoFacil.tsx` |

## A fórmula de leitura e a fonte

`índice = 248,835 − 1,015 × (palavras/frases) − 84,6 × (sílabas/palavras)`, de 0 a 100. Faixas: 75 a 100 muito fácil,
50 a 75 fácil, 25 a 50 difícil, 0 a 25 muito difícil. Na aula, três palavras: fácil (50 ou mais), média (25 a 50) e
difícil (abaixo de 25).

Fonte: **adaptação ao português citada em Martins et al. (1996), não conferida.** A obra existe e está no repositório
da USP (Martins, T. B. F.; Ghiraldelo, C. M.; Nunes, M. G. V.; Oliveira Jr., O. N. "Readability formulas applied to
textbooks in Brazilian Portuguese". Notas do ICMSC-USP, Série Computação, n. 28, São Carlos, 1996), mas o arquivo de lá
é uma digitalização sem texto, e os números da fórmula e das faixas não puderam ser lidos nele em 03/11/2026. Quem
conferir no original troque a nota em `lib/legibilidade.ts`, nos 6 arquivos de textos (`nivel.fonteDaConta`) e aqui.

O índice só mede tamanho de frase e de palavra. Não diz se o assunto é fácil. Serve para apontar candidatas a uma
versão fácil, que é escrita e revisada por educadores (Etapa 3). **Este pacote não escreve nenhuma versão fácil.**

A versão fácil mora ao lado da aula: `content/trilhas/<trilha>/<aula>.facil.md` (só o texto; o cabeçalho é ignorado) e,
traduzida, `<aula>.facil.<idioma>.md`. Ela nunca vira aula nem idioma: `lib/content.ts` (`eOriginal`) e
`lib/pendencias.ts` a deixam de fora, e o filtro de `scripts/alvos-de-contagem.mjs` é do E4-02 (o teste deste pacote
só confere que ele existe).

## Tela desligada (R1-24)

Com o recurso ligado, ao tocar o "Ouvir a aula":

- a leitura se registra em `navigator.mediaSession` (título da aula, "Instituto Lúcia", ícones `/icone-192.png` e
  `/icone-512.png`; ações tocar, pausar, trecho anterior e seguinte, voltar e avançar frase), e os controles aparecem na
  tela de bloqueio, nos fones e no relógio;
- a voz natural toca por um elemento `<audio>` (um WAV por frase, montado no aparelho, com a frase seguinte já
  preparada), que o sistema deixa continuar com a tela apagada. O `AudioContext` fica de reserva quando o aparelho
  recusa o `<audio>`;
- a voz do aparelho (`speechSynthesis`) não passa por elemento de mídia: o sistema pode pará-la com a tela apagada. O
  tocador avisa isso enquanto ela lê.

O rádio (`RadioPlayer`) não foi mexido: é do E4-06.

**Passo manual (não dá para automatizar com a tela apagada):** num Android com Chrome, abra uma aula longa com o
recurso ligado, escolha uma voz natural (já baixada), toque em "Ouvir a aula", apague a tela pelo botão de energia e
espere um minuto: a leitura tem de continuar e os controles (pausar, próximo trecho) têm de aparecer na tela de
bloqueio. Repita com a voz do aparelho: se parar, o aviso do tocador está certo. No iPhone (Safari), o mesmo.

## Ganchos para outros pacotes

- **E4-06 (cordel):** se existir `content/cordel/<trilha>/<aula>.md`, a aula mostra "Ouvir em cordel", com link para
  `/trilhas/<trilha>/<aula>/cordel` (a rota é do E4-06).
- **E4-17 (Libras):** ponto de montagem `{/* E4-17: Libras */}` logo abaixo do título da aula, sem código.
- **E4-07:** `ProximoPasso` e `CompleteButton` aceitam a próxima aula por prop (`proxima`), para virar a próxima do curso.
- **E4-09:** `pontoDaAula(aula)` e `linkDoPonto(caminho, ponto)` em `lib/posicao-da-aula.ts`.
- **E4-10:** cada bloco do texto tem `data-parte` (e `data-p`, que já existia).

## Âncora dos parágrafos

Cada bloco do texto já sai do servidor com `data-p` (numerado em `components/Markdown.tsx`). O id `p-<n>`, que o link
do ponto usa, hoje é posto no navegador por `RetomarAqui`; o pedido para o `Markdown.tsx` também gravar `id="p-<n>"` no
servidor ficou registrado para o dono daquele arquivo.

## Testes

- `npm run testar:aula-viva`: fatias (aula curta, aula sem títulos, limites de palavras, bloco de código), posição
  (limite de 100, forma errada, link), sílabas e índice (frases de referência) e a exclusão de `.facil.md`.
- `e2e/escola-aula.spec.ts` (computador e celular, com `NEXT_PUBLIC_RECURSOS=escola`): botão grande, barra depois de
  85%, partes e "Parar aqui" com o aviso de retomar, A+, "O que é?", cartão do trecho, modo uma mão, ouvir na aula de
  ler e escrever, 360 px sem rolagem lateral e leitor de tinta sem animação.
- Depois: `npm run testar:estudo`, `npm run testar:vozes` e o orçamento de peso (`npm run orcamento:peso`, depois do build).
