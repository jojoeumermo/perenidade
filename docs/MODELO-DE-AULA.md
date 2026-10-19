# Modelo de aula

Toda aula nova segue o mesmo caminho, em seis partes. Quem estuda sabe o que esperar; quem revisa sabe o que conferir. O modelo é um guia: as aulas que já existem continuam publicadas e vão sendo trazidas para ele aos poucos, na revisão.

| Parte | Onde fica | Para quê |
| --- | --- | --- |
| **Objetivo** | seção `## O que você vai aprender`, logo no começo | dizer em uma a três frases o que a pessoa vai saber fazer no fim |
| **Explicação** | uma ou mais seções `##` com o conteúdo (pelo menos umas 250 palavras) | ensinar, do que a pessoa já sabe para o novo, com exemplos do dia a dia |
| **Exemplo resolvido** | seção `## Exemplo resolvido` (ou um bloco `conta` passo a passo) | mostrar o caminho inteiro de um problema, com cada passo explicado |
| **Exercício** | `quiz` no cabeçalho (ao menos 3 questões), bloco `verificar` no meio do texto e, se houver, `content/exercicios/` | a pessoa conferir sozinha o que aprendeu |
| **Resumo** | seção `## Resumo` (ou `## Para lembrar`), no fim | o essencial em poucas linhas, para revisar depois |
| **Fontes** | `fontes` no cabeçalho (obrigatório) | de onde vem o que a aula afirma |

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
