# Modelo de aula

Toda aula nova segue o mesmo caminho, em nove partes: as seis de sempre (objetivo, explicação, exemplo resolvido, exercício, resumo e fontes) e três que ligam a aula à vida de quem estuda (**Na sua realidade**, **O outro lado** e **Agir**). Quem estuda sabe o que esperar; quem revisa sabe o que conferir. O modelo é um guia: as aulas que já existem continuam publicadas e vão sendo trazidas para ele aos poucos, na revisão. As três partes novas são opcionais nelas e obrigatórias nas aulas novas das trilhas de entrada (etapa fundamental e alfabetização) e de formação militante, que declaram `modelo: 9` no cabeçalho (veja "As três partes novas", mais abaixo).

| Parte | Onde fica | Para quê |
| --- | --- | --- |
| **Objetivo** | seção `## O que você vai aprender`, logo no começo | dizer em uma a três frases o que a pessoa vai saber fazer no fim |
| **Explicação** | uma ou mais seções `##` com o conteúdo (pelo menos umas 250 palavras) | ensinar, do que a pessoa já sabe para o novo, com exemplos do dia a dia |
| **Exemplo resolvido** | seção `## Exemplo resolvido` (ou um bloco `conta` passo a passo) | mostrar o caminho inteiro de um problema, com cada passo explicado |
| **Exercício** | `quiz` no cabeçalho (ao menos 3 questões), bloco `verificar` no meio do texto e, se houver, `content/exercicios/` | a pessoa conferir sozinha o que aprendeu |
| **Resumo** | seção `## Resumo` (ou `## Para lembrar`), no fim | o essencial em poucas linhas, para revisar depois |
| **Fontes** | `fontes` no cabeçalho (obrigatório) | de onde vem o que a aula afirma |
| **Na sua realidade** | bloco `suarealidade`, **antes** da explicação (pode ficar dentro da seção do objetivo) | uma pergunta sobre o trabalho ou o bairro de quem estuda, para pensar antes de ler |
| **O outro lado** | bloco `outrolado`, depois da explicação | o argumento mais forte de quem discorda, dito sem caricatura, e um treino de resposta |
| **Agir** | bloco `agir`, perto do fim | uma tarefa pequena e concreta; a aula seguinte da trilha pergunta "como foi?" |

`npm run pendencias -- <trilha>` mostra, aula por aula, o que falta. Os títulos aceitos para cada seção estão em `lib/modelo-de-aula.ts`.

## Esqueleto

````markdown
---
titulo: "Frações"
resumo: "O que é uma fração, como simplificar e como somar."
autores: ["Nome de quem escreveu"]
fontes:
  - titulo: "Nome da obra ou da página"
    autor: "Autor ou instituição"
    ano: "2020"
    url: "https://…"
quiz:
  - pergunta: "…"
    opcoes: ["…", "…", "…"]
    resposta: 1
    explicacao: "Por que esta é a certa."
---

## O que você vai aprender

Ao fim desta aula você vai saber o que o numerador e o denominador querem dizer, encontrar frações equivalentes e somar frações com denominadores diferentes.

## Partes de um todo

(explicação, do concreto para o geral; uma ideia por seção)

```verificar
Pergunta rápida para firmar a atenção.
- alternativa
+ alternativa certa
> pista para reler
```

## Exemplo resolvido

**Quanto é 1/3 + 1/4?**

1. Procure um número que seja múltiplo de 3 e de 4: 12.
2. Troque as duas frações por doze avos: 1/3 = 4/12 e 1/4 = 3/12.
3. Some os numeradores: 4/12 + 3/12 = 7/12.

Confira: 7/12 é um pouco mais que a metade, e 1/3 + 1/4 também é.

## Resumo

- A fração 3/8 quer dizer 3 partes de um todo dividido em 8 partes iguais.
- Multiplicar ou dividir em cima e embaixo pelo mesmo número dá uma fração equivalente.
- Para somar, primeiro iguale os denominadores.
````

## As três partes novas

São três blocos de código, escritos em texto simples como os da aula-experiência (no painel › Escrever, o menu **Bloco da aula** põe o esqueleto de cada um). No cabeçalho, a aula que adota as nove partes declara `modelo: 9`; `npm run pendencias` passa a exigir as três nela.

````markdown
---
titulo: "Título da aula"
modelo: 9
---

## O que você vai aprender

Ao fim desta aula você vai saber [o que a pessoa vai saber fazer].

```suarealidade
Uma pergunta sobre o trabalho ou o bairro de quem estuda: onde isso aparece na sua semana?
```

## Primeira ideia

(a explicação, com os blocos de sempre)

```outrolado
# O argumento mais forte de quem discorda
[O argumento de quem discorda, como essa pessoa o diria, com a fonte. Sem caricatura.]
---
Como você responderia a esse argumento, com respeito e com fatos?
---
[Uma resposta possível, com a fonte dos fatos. Aparece quando a pessoa pede.]
```

```agir
# Esta semana
Uma tarefa pequena, concreta, que dá para fazer num papel, em poucos minutos por dia.
```

## Resumo

- ...
````

Como cada parte funciona:

- **Na sua realidade** vem antes da explicação. Uma pergunta só, sobre o trabalho ou o bairro de quem estuda ("na sua rua", "no seu serviço"), sem pedir nome, endereço nem dado de ninguém. A pessoa pode escrever a resposta; ela fica só no aparelho dela.
- **O outro lado** tem até três partes, separadas por uma linha com `---`: (1) o argumento mais forte de quem discorda, como essa pessoa o diria, com fonte e sem caricatura; (2) a pergunta do treino ("como você responderia?"); (3) opcional, uma resposta possível, que aparece quando a pessoa pede. Sem a segunda parte, o treino conta como faltando. Opinião política e religiosa de pessoas vivas ou de partidos: só fatos documentados, em linguagem sóbria.
- **Agir** é uma tarefa pequena, concreta, que cabe numa semana, que dá para fazer sem computador e sem se expor a risco (nada de confrontar chefe, polícia ou vizinho sozinho; nada de fotografar ou gravar outras pessoas; nada de pedir dado pessoal). Na página, a pessoa pode marcar "Vou fazer isto". Na aula seguinte da trilha, o site pergunta "Como foi?": fiz, fiz em parte ou ainda não, com um campo de nota se a pessoa quiser. Tudo isso fica só no aparelho (`lucia:agir:<trilha>/<aula>`); o site não recebe a resposta, não conta quem fez e não cobra. A resposta "ainda não fiz" é tratada com respeito.

Escreva a tarefa de modo que a aula seguinte possa citá-la sozinha: a pergunta "como foi?" mostra o texto do bloco `agir` da aula anterior, e só ele. Sem aula anterior com `agir`, nada aparece. A primeira aula de uma trilha não tem pergunta de "como foi?".

## A aula-experiência

O instituto não é um site de aulas: é uma escola da vida. Uma aula boa não é um texto para decorar, é uma experiência que parte da vida de quem trabalha, mostra a quem serve o que costuma ficar escondido e termina com algo para levar ao bairro. Não há ponto, ranking nem sequência de dias: a pessoa estuda porque quer entender e mudar a própria realidade.

Além das partes acima, a aula pode (e deve, sempre que couber) usar os **blocos da aula-experiência**. Cada um é um bloco de código com o nome dele, escrito em texto simples. No painel › Escrever, o menu **Bloco da aula** põe o esqueleto de cada um no texto.

| Bloco | Para quê | Onde costuma ficar |
| --- | --- | --- |
| `provocacao` | Uma pergunta da vida real, que a aula vai responder. A pessoa pode escrever o que pensa antes de ler (fica só no aparelho dela). | No começo, antes da primeira seção |
| `navidareal` | A caixa preta: onde aquilo aparece no dia a dia, num caso concreto. | Logo depois da explicação |
| `formula` | A fórmula ou a regra em destaque. A primeira linha vai grande, numa caixa; as outras viram a legenda, em palavras. | No meio da explicação |
| `historia` | Uma história de luta ligada ao conteúdo, com lugar e ano no título (`# A greve de 1917, São Paulo`). | Onde ajudar a dar sentido |
| `escondido` | Por que isso te foi escondido: o que a escola e a mídia deixam de fora, e a quem isso serve. Sempre com fonte. | Perto do fim |
| `realidade` | Um exercício sobre a vida de quem estuda, com espaço para responder (fica só no aparelho). Não é a parte "Na sua realidade", que vem antes da explicação e usa `suarealidade`. | Antes do resumo |
| `leve` | Leve para a sua comunidade: como ensinar isso a outra pessoa, em passos curtos. | No fim |
| `roda` | Perguntas para discutir na sala da disciplina, com o link direto para ela. | No fim |
| `outrojeito` | Uma segunda explicação da mesma ideia, por outro caminho (outro exemplo, outra imagem, o passo a passo mais devagar). Opcional; fica fechada até a pessoa abrir. Não muda nenhum fato, número nem fonte. | Depois da explicação difícil |

Formato de cada um:

````markdown
```provocacao
Por que o ônibus te joga para a frente quando o motorista freia, se ninguém te empurrou?
```

```formula
F = m · a
força (em newtons) = massa (em quilogramas) × aceleração
```

```historia
# A greve geral de 1917, São Paulo
Texto da história, com **negrito** e *itálico* se precisar. Linha em branco separa parágrafos.
```

```leve
- Chame alguém da sua casa e faça o teste do carrinho.
- Termine com uma pergunta.
```
````

O `outrojeito` leva um título opcional na primeira linha e o texto da segunda explicação:

````markdown
```outrojeito
# Pensando de outro jeito
Imagine uma folha de papel dividida em quatro partes iguais. Cada parte é um quarto do papel.
```
````

Use quando uma ideia costuma travar quem estuda (é o que o botão "Não entendi" da Escola mostra). Não é um resumo: é outro caminho até a mesma conclusão. Na página aparece como "Não ficou claro? Veja de outro jeito", fechado; o assistente do "Não entendi" continua sendo o jeito de pedir uma explicação feita para o trabalho da pessoa, e só quando ela pede.

Dentro dos blocos vale texto simples: parágrafos (linha em branco entre eles), listas com `- ` ou `1. `, **negrito**, *itálico*, `código` e links para páginas do próprio site (`[Máquinas simples](/trilhas/fisica-fundamental/maquinas-simples)`). Uma primeira linha começando com `# ` vira o título do bloco.

Algumas regras para a experiência funcionar:

- **Comece pela vida, não pela definição.** A provocação vem antes do conceito.
- **Um caso concreto vale mais que três adjetivos.** Nada de panfleto vazio: toda afirmação política tem fonte.
- **Escreva para quem lê pouco.** Frases curtas, uma ideia por frase, palavra difícil explicada na primeira vez (ou ligada ao glossário).
- **Feche com ação.** `realidade`, `leve` e `roda` fazem a aula sair da tela.
- **Sem gamificação.** Nada de pontos, prêmios, sequência de dias ou competição.

Veja a aula `content/trilhas/fisica-fundamental/forca-e-as-leis-de-newton.md`, que usa os blocos.

Na página, a aula ainda tem, sem que quem escreve precise fazer nada: a margem com a anotação da pessoa, a palavra do glossário e o laboratório da disciplina; o teste de uma pergunta por vez; ouvir a aula em voz alta; a largura do texto e o modo foco.

## Revisão e créditos

Cada aula leva os créditos de quem escreveu (`autores`) e, depois de revisada, de quem revisou:

```yaml
revisoes:
  - funcao: "educador de matemática"   # a função de quem revisou; o nome é opcional
    nome: "Fulana de Tal"
    data: "2026-10-20"
    nota: "Contas conferidas; exemplo trocado por um do dia a dia."
```

- **Nada recebe "revisada" sozinho.** Sem `revisoes`, a aula aparece como "Em revisão". Só quem revisou acrescenta a linha, depois de seguir `docs/CHECKLIST-DE-REVISAO.md`. Uma nova revisão é uma linha a mais: o histórico fica.
- Ninguém revisa a própria aula.
- As aulas aprovadas pelo painel chegam com `revisada: true` (o painel exige o parecer de outro educador da disciplina); elas aparecem como "Aprovada pela equipe" até alguém registrar a revisão com função e data.

A etiqueta aparece no site com o recurso `revisoes` ligado (veja `docs/RECURSOS.md`).
