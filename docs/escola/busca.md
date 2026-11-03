# Busca viva, Por onde andei, estados vazios e modo seguro (E4-05)

Pacote da onda 1 da Etapa 4. Ideias R1-15, R1-16, R1-21, R1-22 e R1-94. Tudo o que é novo para o visitante fica atrás de
`ligado("escola")`. O modo seguro é a exceção: ele fica sempre disponível, com ou sem a Escola, porque é uma página de segurança.

## O que cada parte faz

| Parte | Onde | Com a flag desligada |
| --- | --- | --- |
| Busca que entende pergunta (R1-15) | `lib/intencoes.ts`, `content/busca-intencoes.json`, `components/busca/MelhorCaminho.tsx` | não aparece; a busca fica como era |
| Índice da Escola | `lib/escola/indice.ts`, acrescentado em `lib/indice-de-busca.ts` | só a entrada do modo seguro |
| Busca por voz (R1-16) | `components/busca/BuscaPorVoz.tsx`, no campo do alto e em `/busca` | não aparece |
| Por onde andei (R1-21) | `lib/historico-local.ts`, `components/RegistroDeVisita.tsx`, `components/PorOndeAndei.tsx`, `/por-onde-andei` | não grava; a página dá 404 |
| Estados vazios que ensinam (R1-22) | `components/estudo/ComecoEmTresPassos.tsx` no Meu estudo, no Praticar, em Minhas turmas e no caderno (revisão e erros) | o vazio de antes |
| Modo seguro (R1-94) | `lib/modo-seguro.ts`, `components/SaidaRapida.tsx`, `/modo-seguro`, link no rodapé | **sempre ligado** |

Os textos ficam em `i18n/escola/busca/{pt,en,es,fr,ru,zh}.json`. O layout (`app/[lang]/layout.tsx`) escolhe o idioma no
servidor e passa por `components/busca/TextosDaBusca.tsx` (um contexto), para os componentes de cliente espalhados pelo site
não precisarem de props novas nem baixarem os 6 dicionários.

## Busca que entende pergunta

- `normalizar(q)` tira acento, maiúscula, pontuação e o jeito de perguntar ("como faço para", "o que é", "onde").
- `palavras()` tira as palavras vazias ("de", "para", "quero"…) dos dois lados e o plural simples.
- `pontuar(q, padrão)` = palavras em comum ÷ tamanho do maior dos dois. Assim "golpe de 1964" não casa com "golpe" (0,5),
  e "eja" casa com "eja" (1).
- `casar(q, intenções)` exige pelo menos **0,6** e devolve até **3** destinos, sem repetir, começando pela intenção que melhor casou.
- A caixa "Melhor caminho" usa os títulos do índice da busca no idioma da página. Páginas e ferramentas fora do índice têm o
  título em `paginas` e `ferramentas` de `i18n/escola/busca` (o teste confere que todo destino desse tipo tem título nos 6 idiomas).
- As intenções são baixadas só quando a busca abre e a Escola está ligada. A pergunta não sai do aparelho.

`content/busca-intencoes.json` tem 51 intenções (direitos, contas, ENEM, EJA, ler e escrever, golpes no celular, saúde,
moradia e começar a estudar). Todo destino existe hoje: o teste confere cada aula em `content/trilhas`, cada trilha, cada
ferramenta em `lib/areas.ts` e cada página em `app/[lang]`, e recusa página que some sem uma flag (como `/enem`).

**Rescisão, a parte que falta.** "Como faço rescisão" leva à aula da CLT, à ferramenta **Direitos do trabalhador**
(`/ferramentas/direitos-trabalhistas`, que já existe e calcula férias, 13º, aviso prévio, FGTS e rescisão) e ao guia
de direitos (seguro-desemprego e Defensoria). O roteiro passo a passo da rescisão é da Etapa 3 e não entrou. Quando ele
existir, basta acrescentar o destino na intenção `rescisao`.

Para acrescentar uma intenção: padrões em português, sem acento, sem maiúscula e sem pontuação; de 1 a 3 destinos que já
existem; uma `nota` dizendo o que cobre. Rode `npm run testar:busca-viva`.

## Busca por voz

O microfone só aparece quando o navegador tem `SpeechRecognition` ou `webkitSpeechRecognition`. No primeiro uso, o aviso:
"A voz é transcrita pelo serviço do seu navegador (Google ou Apple), não pelo Instituto. Nada é gravado aqui." Só segue
depois do "Entendi", guardado em `lucia:escola-privado:aviso-da-voz` (fora da cópia; o "apagar meus dados" apaga).
A língua segue a página (`htmlLang`). Ao terminar, o campo é preenchido e a busca roda. Falta de permissão, silêncio, falta
de rede e erro viram frases simples.

**Para o E4-10 e o E4-16:** `useAvisoDaVoz()` (de `components/busca/BuscaPorVoz.tsx`) devolve o texto do aviso no idioma
da página, os rótulos dos botões, se a pessoa já aceitou e `aceitar()`. `useTemVoz()` diz se há reconhecimento de fala.

## Por onde andei

- Chaves: `lucia:historico` (lista `[{caminho, titulo, em}]`) e `lucia:historico-ligado`. As duas estão em `SO_APAGAR` de
  `lib/estudo.ts` (fora da cópia de segurança, saem no "apagar meus dados").
- **Começa desligado.** Liga pelo convite na busca vazia (`/busca`) e no fim do Meu estudo: "Quer que este aparelho lembre
  as páginas que você viu nesta semana? Fica só aqui." O convite diz o risco antes de pedir.
- Até 60 itens, só os últimos 7 dias. A mesma página vista de novo sobe para o topo.
- Nunca grava com o modo seguro ligado, nem `/painel`, `/entrar`, `/modo-seguro` e `/por-onde-andei`. Grava o caminho sem
  o idioma e **sem a consulta**: a pergunta da busca nunca entra.
- `/por-onde-andei` agrupa em Hoje e Esta semana, com "Apagar tudo" e "Não guardar mais" (desliga e apaga).
- Com o histórico ligado, a busca vazia (a do alto e `/busca`) mostra "Você viu estas páginas hoje".

## Estados vazios que ensinam

Três passos: 1) descobrir por onde começar (`/nivelamento`, ou `/comecar` com o nivelamento desligado); 2) abrir a primeira
aula de `content/comecar.json`; 3) voltar ao Meu estudo para ver o progresso (só vira link quando o Meu estudo existe e a
pessoa não está nele). Cada lugar tem a sua frase: Meu estudo vazio, Praticar sem exercícios, Minhas turmas sem turma (os
passos só aparecem para quem já estudou algo, porque o Meu estudo vazio já os mostra logo acima), baralho de revisão
vazio e caderno de erros vazio.

**Revisar esta aula.** O botão do fim da aula (E4-03) grava `{aula}` em `sessionStorage` na chave `lucia:praticar-aula`.
O Praticar lê, apaga a chave e abre uma sessão com os exercícios daquela aula primeiro (depois os da mesma trilha), com o
aviso "Primeiro, os exercícios da aula …" e o link para os cartões da aula no baralho (os cartões cuja origem é o título da
aula). Aula sem exercício com explicação: o aviso diz isso e a escolha livre continua.

## Modo seguro

- Marca `lucia-seguro` no `sessionStorage`: some sozinha ao fechar a aba. `estaLigado()` é o que o histórico, o passaporte
  (E4-09), o acompanhante (E4-10) e os agentes (E4-16) consultam antes de gravar.
- Com o modo ligado: botão "Sair" discreto e fixo (canto de baixo à esquerda, acima do "voltar ao topo" e da barra de abas,
  44 px) e Esc três vezes em 1 segundo (na fase de captura, para nenhum campo engolir a tecla).
- `sairRapido()`: esconde a página na hora; apaga toda chave que começa com `lucia` no `localStorage` e no
  `sessionStorage`; apaga as bases IndexedDB `lucia-*` que não são de voz (`lucia-busca`, `lucia-sigilo`,
  `lucia-explicacoes` e as que o navegador listar); apaga os caches `lucia-*` do service worker (páginas e arquivos guardados
  para ler sem internet) e **mantém** `lucia-vozes` (modelos de voz, iguais para todo mundo); põe
  `<meta name="referrer" content="no-referrer">` e faz `location.replace` para a busca do Google por "previsão do tempo".
  Espera no máximo 700 ms pelas bases e pelos caches. O "Voltar" não volta para a página de onde se saiu.
- `/modo-seguro` diz com honestidade o que a saída faz e o que o site não consegue: apagar o histórico do navegador (só a
  janela anônima evita, e a página ensina a abrir uma), esconder o que a rede já viu e proteger de programa espião. Antes
  de ligar, oferece "Baixar minha cópia antes" (`montarCopia` de `lib/estudo.ts`) para quem tem estudo guardado.
- Link no rodapé (linha das regras) e entrada no índice da busca, sempre.

**Atenção da coordenação: chaves das conversas cifradas.** A regra do desenho é apagar todas as bases `lucia-*` que não
sejam de voz. Isso inclui `lucia-sigilo`, o chaveiro das conversas cifradas do painel. Para quem é da equipe e usa as
conversas neste aparelho, a saída obriga a aprovar o aparelho de novo e, se ele for o único aprovado, as conversas antigas
podem ficar ilegíveis. A página `/modo-seguro` avisa isso. Se a coordenação preferir manter o chaveiro, basta tirar
`lucia-sigilo` de `basesParaApagar` (e ajustar o teste e o aviso).

## Testes

- `npm run testar:busca-viva` (`scripts/testar-busca-viva.mjs`): `normalizar`, `casar` (positivos, negativos, limite de
  0,6, no máximo 3), todo destino de `busca-intencoes.json` existe, índice da Escola só com a flag e modo seguro sempre,
  histórico (desligado por padrão, 7 dias, 60 itens, "não guardar mais", modo seguro, consulta nunca guardada), chaves
  fora da cópia e no "apagar", e a regra da saída (só `lucia*`, vozes ficam, Esc três vezes em 1 s).
- `e2e/escola-busca.spec.ts`: Melhor caminho em `/pt/busca?q=como faço para estudar na EJA`; o microfone some sem
  reconhecimento de fala (e, com um reconhecedor falso, o aviso e o preenchimento); sem ligar, nada é gravado; ligar,
  visitar 3 páginas e vê-las em `/por-onde-andei`; Meu estudo vazio com os 3 passos; "Revisar esta aula" abre o Praticar
  com a aula; modo seguro + Esc três vezes deixa o `localStorage` sem `lucia*`; sem rolagem lateral em 360 px. Suba o
  servidor com `NEXT_PUBLIC_RECURSOS=escola,meu-estudo,exercicios`.

## O que não faz

- Não manda a pergunta nem o histórico a servidor nenhum (o índice é baixado e a busca roda no aparelho).
- Não liga o histórico por padrão.
- Não promete que o modo seguro apaga o histórico do navegador.
- Não cria destino de busca para página inexistente.
