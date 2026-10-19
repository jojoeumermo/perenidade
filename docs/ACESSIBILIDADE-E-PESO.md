# Acessibilidade e peso das páginas de aula

Auditoria feita em 19/10/2026 no ramo `estudo-no-aparelho`, com o critério WCAG 2.1 nível AA. Escopo: a página de aula (com os recursos novos desligados e ligados), os exercícios com explicação, Meu estudo, Praticar, Modo turma, Nivelamento e as páginas para professores.

## Como foi feito

- **Varredura no navegador** de cada página, em tamanho de celular (375 px) e de computador: ordem dos títulos, campos sem rótulo, botões e links sem nome, imagens sem texto alternativo, ids repetidos, regiões que anunciam mudanças (`role="status"`), rolagem para o lado.
- **Contraste** calculado para todas as combinações de cor dos temas claro e escuro (tabela abaixo).
- **Teclado**: todos os controles novos são botões, campos e seletores nativos; o foco aparece com o contorno dourado global (`:focus-visible`, 2 px). Nos filtros em forma de pílula (rádio escondido), o contorno aparece na pílula inteira.
- **Leitor de tela**: o retorno dos exercícios fica numa região `role="status"`; o estado de cada alternativa ("resposta certa", "não era esta") é dito em texto, não só com ✓/✗ e cor; o campo de resposta numérica tem rótulo e o formato aceito ligado a ele (`aria-describedby`); conteúdo em português nas páginas de outros idiomas leva `lang="pt-BR"`.
- **Modos do site**: alto contraste, tinta eletrônica (Kindle e parecidos), aplicativo e tema escuro, simulados com os mesmos atributos que o site liga sozinho.

## Contraste (texto normal precisa de 4,5:1)

| Combinação | Claro | Escuro |
| --- | --- | --- |
| texto sobre pergaminho | 14,67 | 14,62 |
| texto suave sobre pergaminho / sobre fundo escuro do cartão | 6,89 / 5,96 | 7,60 / 6,94 |
| **dourado sobre pergaminho / sobre fundo do cartão** | 4,78 / **4,13** | 7,99 / 7,30 |
| bordô sobre pergaminho / fundo do cartão | 9,52 / 8,23 | 6,78 / 6,19 |
| verde (acerto) sobre pergaminho / fundo do cartão | 6,52 / 5,64 | 9,49 / 8,67 |
| pergaminho sobre botão escuro / bordô | 14,67 / 9,52 | 14,62 / 6,78 |

## Achados

| # | Achado | Onde | O que foi feito |
| --- | --- | --- | --- |
| 1 | Dourado sobre o fundo dos cartões, no tema claro, fica em 4,13:1 (abaixo de 4,5:1) | peças novas e várias antigas (o "Continue de onde parou" da página inicial, rótulos em letra mono dentro de cartões) | **Corrigido nas peças novas** (texto escuro ou bordô; o dourado ficou só em bordas). Nas antigas, **não mexi** (é cor do site). Recomendação: escurecer `--gold` do tema claro para `#7f5718` (dá ≥ 4,5:1 nos dois fundos) ou trocar esses rótulos por `text-ink-soft`. Decisão de identidade visual. |
| 2 | No teste de fim de aula, o ✓ e o ✗ das alternativas eram só visuais | todas as aulas | **Corrigido**: o leitor de tela agora ouve "(Correto.)" e "(Ainda não.)" ao lado da alternativa, com frases que já existiam traduzidas nos seis idiomas. |
| 3 | O título da trilha (h2, no índice lateral) vem antes do título da aula (h1) na ordem do documento | todas as aulas | Registrado. Recomendação: no índice lateral, trocar o h2 por um parágrafo com o mesmo estilo, ou mover o índice para depois do artigo no documento (o visual pode continuar igual com `order`). |
| 4 | "a confirmar" em letra de 10 px | mapa curricular (novo) | **Corrigido** para 12 px. |
| 5 | Blocos de conta (`pre`) com rolagem para o lado no modo de tinta eletrônica | aulas com contas, no Kindle | Registrado. Recomendação: no modo `data-eink`, quebrar as linhas desses blocos (`white-space: pre-wrap`). |
| 6 | VLibras: o botão e a janela são do próprio serviço | botão de acessibilidade (recurso `vlibras`) | O botão do VLibras tem nome acessível. O avatar roda num quadro à parte e **não foi conferido num aparelho de verdade** nesta rodada: conferir antes de ligar. |
| 7 | No modo de leitor digital (Kindle), os links com fundo escuro ficavam preto no preto, sem texto visível | "Começar pela primeira aula" de cada trilha, "Enviar questão", "Buscar" da página não encontrada e outros | **Corrigido** com uma regra que só vale nesse modo (fundo branco com borda), em `app/globals.css`. |
| 8 | Com a pessoa logada, a saudação "Olá, [nome] · Painel →" alarga o cabeçalho em 8 px num celular de 375 px, no navegador (no aplicativo já havia regra para isso) | cabeçalho, para quem tem conta | Registrado. Recomendação: estender ao navegador a regra que, no aplicativo, esconde o nome do instituto quando a saudação aparece em telas estreitas. |

Nas páginas novas a varredura não achou campo sem rótulo, botão sem nome, imagem sem texto alternativo, título fora de ordem nem rolagem para o lado (Meu estudo, Praticar, Turma nas duas vistas, Nivelamento, Professores, plano de aula, mapa).

## Peso da página de aula

Medido na aula "Frações" (`/pt/trilhas/matematica-fundamental/fracoes`), sem compressão, com os recursos novos desligados.

| | Antes (master `fb90a5c`) | Depois (este ramo, recursos desligados) |
| --- | --- | --- |
| HTML | 147 KB | 147 KB |
| JavaScript inicial | 12 arquivos, 717 KB (220 KB com gzip) | 12 arquivos, **685 KB (211 KB com gzip)** |
| Fontes pré-carregadas | 12 arquivos, 385 KB | 12 arquivos, 385 KB (sem mudança) |

Medido nos arquivos do build de produção (sem compressão e com gzip). Mesmo com as seis fases no código, a aula ficou 32 KB mais leve.

O que entrou:

- A prática das aulas de idioma (com voz e reconhecimento de fala) ia no JavaScript de **todas** as aulas, inclusive as de matemática. Agora vai num arquivo à parte, baixado só nas aulas que têm prática (`components/estudo/PraticaSobDemanda.tsx`).
- As peças novas da aula (exercícios, "Isso ajudou?", registros do Meu estudo) e a lista de chaves usada pela limpeza automática de Meus dados também ficam em arquivos à parte, baixados só quando usados (`components/estudo/NaAula.tsx`). Com os recursos desligados, nada novo vai para as páginas.

A página é montada no servidor do mesmo jeito; nada muda na tela.

O que ficou como recomendação (mexe em regra da casa):

- **Fontes**: a aula pré-carrega 12 arquivos de fonte (385 KB), mas uma página em português usa só os do alfabeto latino básico (~112 KB). Os de latim estendido (217 KB) e cirílico (56 KB) vêm à toa. Com `preload: false` nas três fontes de `app/[lang]/layout.tsx`, o navegador baixaria só os pedaços que a página usa; o custo é que, na primeira visita, o texto pode aparecer por um instante na fonte de reserva antes da definitiva. As opções de fonte do Next precisam ser fixas no código (não dá para pôr atrás de uma flag), e o guia da casa pede para não mexer em fontes: fica para a sua decisão.
- **Textos que vão para todas as páginas**: cerca de 100 KB do HTML de cada aula são dados embutidos, em boa parte os textos da interface que todas as páginas carregam (`i18n/core.ts`). Enxugar isso mexe em muitos componentes; não é "fácil e seguro".
