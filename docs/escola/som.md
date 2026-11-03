# Som do campus (E4-06)

Pacote da onda 3 da Etapa 4 (Escola Lúcia Maria). Quatro ideias: a rádio que continua depois de recarregar (D1-3), o
som para estudar (R1-70), o cordel da aula (R1-71) e o Hoje no campus (R1-74). Tudo o que é novo para o visitante fica
atrás do recurso `escola` (`ligado("escola")`); desligado, a rádio, o tocador e a aula ficam como eram e a rota do
cordel responde "não encontrado".

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `lib/radio-retomar.ts` | Puro: a forma do que fica em `lucia:radio-retomar`, a leitura com prazo de 24 h e a conferência da forma |
| `lib/radio.ts` | `retomada` (ler, gravar, descartar, retomar) e `radio.soltar()`; `radio.close()` descarta o "Continuar" |
| `components/RadioPlayer.tsx` | grava o "Continuar", mostra o aviso recolhido e a barra do som para estudar |
| `lib/som-de-estudo.ts` | gera os sons no aparelho (Web Audio) e guarda o estado fora dos componentes |
| `components/radio/SomDeEstudo.tsx` | o canal "Para estudar (sem fala)" em `/radio` |
| `lib/hoje-no-campus.ts` | puro: `montarRoteiro({data, fatos, aulaDaSemana, idioma, frases})` |
| `components/radio/HojeNoCampus.tsx` | o roteiro do dia em `/radio`, na tela e com "Ouvir" |
| `components/radio/OuvirComLeitor.tsx` | o botão "Ouvir" com o leitor das aulas (pergunta antes de baixar voz) |
| `components/radio/textos-do-som.ts` | o tocador baixa só os textos do idioma da página, e só quando precisa |
| `lib/cordel.ts` | lê, valida e lista os folhetos de `content/cordel/` |
| `app/[lang]/trilhas/[track]/[lesson]/cordel/page.tsx` | o folheto (só em português; 308 nos outros idiomas) |
| `content/cordel/LEIA-ME.md` | como os educadores escrevem e revisam |
| `i18n/escola/som/{pt,en,es,fr,ru,zh}.json` e `index.ts` | os textos, nos 6 idiomas |
| `styles/escola-som.css` | o roteiro, os botões do canal e o folheto (com a impressão em A5) |
| `scripts/testar-som.mjs` | `npm run testar:som` |
| `e2e/escola-som.spec.ts` | Playwright (precisa do site no ar com `NEXT_PUBLIC_RECURSOS=todos,escola`) |

`app/[lang]/radio/page.tsx` ganhou o Hoje no campus e o canal "Para estudar". O `next.config.ts` não mudou: a regra
`"/*/trilhas/**"` do `outputFileTracingIncludes` já leva `content/**` para a função da rota do cordel.

## D1-3, rádio que continua

- **Entre páginas** já funcionava: o estado mora na memória de módulo de `lib/radio.ts` e o `RadioPlayer` fica no layout.
  O e2e toca uma emissora (interceptada, silêncio em WAV), navega por 3 páginas pelo roteador e confere que o `<audio>`
  segue tocando.
- **Depois de recarregar:** o tocador grava em `lucia:radio-retomar`
  `{canal | episodio, faixa, posicao, titulo, artista, url, aoVivo, em, podcast?}` logo ao tocar, a cada 10 s tocando,
  ao pausar ou trocar de faixa e no `pagehide`. Só o que já é público: endereço https (ou caminho do próprio site) do
  som, título, nome da emissora, posição e hora. Episódio leva a capa, o link e a duração (públicos), não a forma da
  onda nem os capítulos.
- **Ao abrir o site**, se a gravação tem menos de 24 h e a forma está certa, o tocador mostra recolhido
  "Continuar: <título> · 12:30" (a posição só para episódio). Um toque retoma; **nunca toca sozinho**. O "✕" descarta
  (apaga a chave). Fechar o tocador também descarta. Forma errada, endereço `http:`, `javascript:` ou `//outro-site`,
  canal e episódio juntos: a gravação é ignorada.
- **Sem duplicar a posição:** quem faz o som voltar ao ponto certo continua sendo `positions` (`lucia:radio`, que a conta
  também guarda). Retomar é tocar de novo a mesma faixa; a posição da gravação só serve para o texto do aviso.
- A chave já está na lista "só apagar" de `lib/estudo.ts` (fora da cópia de segurança; sai no "apagar meus dados").

## R1-70, som para estudar

Não há no repositório música com licença conferida (`content/radios.json` só tem rádios ao vivo), então não há música.
Três sons gerados no aparelho com a Web Audio API, **sem baixar arquivo nenhum**: ruído marrom, ruído rosa e chuva
(o rosa com um pouco de branco, entre um passa-alta e um passa-baixa, com o volume subindo e descendo devagar por duas
ondas lentas, mais gotas esparsas num laço de outro tamanho). As amostras saem de um sorteio de semente fixa e o laço
emenda o fim no começo sem estalo.

- Em `/radio`, o canal "Para estudar (sem fala)", com o texto honesto: "Sons feitos no seu aparelho. Músicas livres
  entram quando a curadoria conferir a licença."
- Ligado, o som aparece no tocador do rodapé (nome, volume e parar), em qualquer página.
- Um canal de cada vez: ligar o som tira a rádio do tocador (o "Continuar" da próxima visita fica gravado); tocar a
  rádio desliga o som.
- Quando a voz de uma aula começa a ler (evento `lucia:voz-falou`, de `lib/vozes/leitor.ts`), o som baixa para 30% e
  volta uns segundos depois da última frase (a duração vem no evento; para a voz do aparelho, a conta é de uns 14
  caracteres por segundo).
- O volume escolhido fica em `lucia:escola:som-volume` (prefixo da Escola: entra na cópia e sai no "apagar").
- Nada toca sozinho: o som só liga num toque (o navegador também só libera o áudio assim).

## R1-71, cordel da aula

Formato, métrica, revisão e autoria estão em `content/cordel/LEIA-ME.md`. Em resumo: `content/cordel/<trilha>/<aula>.md`;
cabeçalho `{aula, titulo, autoria: "rascunho, em revisão", revisado: false, revisadoPor: "", baseado_em, xilogravura}`;
corpo em sextilhas (6 versos de 7 sílabas, rima ABCBDB).

- `lib/cordel.ts` valida: a aula do cabeçalho bate com o caminho; 6 versos por estrofe; nenhum verso sem letra;
  `baseado_em` é o arquivo de uma aula da mesma trilha e existe; enquanto `revisado: false`, a autoria é exatamente
  "rascunho, em revisão" e não há `revisadoPor`; com `revisado: true`, o nome de quem revisou é obrigatório; a vinheta
  existe em `lib/xilogravuras.ts`. A rima é só aviso (`avisosDeRima`), não erro.
- Folheto inválido não aparece no site; o teste aponta o erro.
- A página mostra a faixa "Rascunho em revisão: confira na aula" com o link da aula, a xilogravura, as estrofes, o
  "Ouvir" (o leitor das aulas: voz do aparelho, ou a voz natural já baixada; se faltar baixar, pergunta e diz o tamanho)
  e "Imprimir o folheto (A5)" (página nomeada `folheto-cordel`, A5). Rascunho não vai para os buscadores (noindex).
- Só em português, no padrão da zine: `nosIdiomasDoTexto` gera só `pt` e os outros idiomas redirecionam (308).
- O link "Ouvir em cordel" na aula é do E4-03 e aparece quando o arquivo existe.
- **Folhetos escritos neste pacote (2, ambos em rascunho):** `o-que-e-o-capitalismo/o-que-e-o-capitalismo` e
  `educacao-popular-fundamental/quem-foi-paulo-freire`, das aulas de `content/comecar.json`. Resumem só o que a aula diz;
  a métrica foi contada à mão e precisa da revisão de um educador antes de sair do rascunho.

## R1-74, Hoje no campus

`montarRoteiro` devolve um roteiro de cerca de 2 minutos (**no máximo 300 palavras**; em chinês cada ideograma conta
0,6 palavra): a saudação com a data por extenso (fuso de Brasília); de 1 a 3 fatos do dia, cada um terminando com a
fonte dita em voz alta ("Segundo a Wikipédia."); a aula da semana (`lib/aula-da-semana.ts`); e o fechamento.

- Em português, os fatos vêm da lista curada `content/neste-dia.json` (a página já a traz; nenhuma consulta). Nos outros
  idiomas, do nosso `/api/neste-dia` (Wikipédia no idioma), só os da data de hoje.
- Fato sem endereço https não entra. Sem fato, o roteiro fala só da aula; sem aula, só dos fatos. Passando de 300
  palavras, sai o último fato e, se precisar, o resumo da aula é encurtado.
- A tela mostra o texto (acessível, com `lang`), as fontes com link, o link da aula e o "Ouvir" pelo leitor do aparelho.
  Não há servidor de voz.
- O HTML do servidor é o mesmo para todo mundo (título e "Montando o roteiro de hoje…"); a data e o roteiro entram depois
  da hidratação.

## Testes

- `npm run testar:som` (158 conferências): retomar (24 h, futuro, 17 formas erradas, endereço público, ao vivo e
  episódio, o tocador grava no `pagehide` e a cada 10 s); som (amostras finitas e sem estouro, laço sem estalo, 30% com
  a voz, sem arquivo baixado); roteiro (300 palavras nos 6 idiomas, nenhum fato sem fonte, sem fatos, sem aula, fuso de
  Brasília); cordel (folhetos reais válidos, no máximo 5, todos do "Por onde começar", e os casos de erro de estrofe,
  `baseado_em`, autoria e revisão); textos completos nos 6 idiomas.
- `e2e/escola-som.spec.ts`: o rádio continua entre 3 páginas; recarregar mostra "Continuar" e não toca sozinho; o "✕"
  descarta; gravação de mais de 24 h não aparece; o som de estudo liga, aparece no tocador, baixa para 30% com a voz e
  desliga; `/pt/trilhas/<t>/<a>/cordel` abre com a faixa de rascunho e `/en/...` vai para o português; `/radio` mostra
  o Hoje no campus; 360 px sem rolagem lateral.

## Pendências da coordenação

- **Revisar os 2 folhetos** (`content/cordel/`): conferir cada estrofe com a aula, a métrica e a rima, e então pôr
  `revisado: true`, a autoria e `revisadoPor` (passo a passo no LEIA-ME). Até lá ficam como "rascunho, em revisão".
- **Música livre** no canal "Para estudar": só depois de a curadoria conferir a licença de cada faixa. Nada foi posto.
