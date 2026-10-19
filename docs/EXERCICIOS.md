# Exercícios com explicação do erro

Os exercícios com explicação do erro moram em `content/exercicios/<trilha>/<aula>.yml`: um arquivo por aula, fora do arquivo da aula. Assim as aulas e o validador delas ficam como estão, e o recurso inteiro sai do ar desligando a flag `exercicios` (veja `docs/RECURSOS.md`).

Eles aparecem no fim da aula, abaixo do teste "O que você aprendeu", e na página **Meu estudo → Praticar**, com filtro por dificuldade e o modo "revisar meus erros".

## Regras

- **Nada nasce revisado.** Todo exercício novo entra com `revisao: { status: em-revisao }` e aparece para quem estuda com a etiqueta "Em revisão". Só uma pessoa da equipe, depois de conferir, troca para `revisada`, dizendo a função e a data. Nenhum roteiro faz isso sozinho.
- **Questões originais.** Não copie de outros sites, livros ou plataformas. Se adaptar um tipo de questão pública (do ENEM, por exemplo), diga de onde em `fonte`.
- **Conta conferida.** Toda questão de resposta numérica leva `conferir`: a conta que dá a resposta. `npm run testar:exercicios` refaz a conta e falha se a resposta não bater ou se uma alternativa errada tiver o mesmo valor da certa.
- **Cada erro explicado.** Toda alternativa errada diz qual é o engano mais comum que leva a ela e como corrigir. Sem humilhar: "você somou em cima e embaixo; os pedaços têm tamanhos diferentes…".

## Formato

```yaml
- id: fracoes-03                 # único no site inteiro, letras minúsculas, números e hífens; nunca mude depois de publicado
  tema: "Somar frações"          # agrupa o desempenho no Meu estudo
  dificuldade: 2                 # 1 (direto), 2 (um passo a mais) ou 3 (vários passos ou uma armadilha)
  nivelamento: true              # opcional: entra no teste curto de nivelamento da disciplina
  enunciado: "Quanto é 1/3 + 1/4?"
  alternativas:
    - texto: "7/12"
      certa: true
    - texto: "2/7"
      erro: "Você somou em cima e embaixo. Primeiro transforme os dois em doze avos…"
  explicacao: "Por que a certa é a certa, passo a passo."
  conferir: "1/3 + 1/4"          # a conta que dá a resposta
  fonte: "Questão original do Instituto Lúcia"
  revisao:
    status: em-revisao           # depois de conferido: status: revisada, por: "educador de matemática", em: "AAAA-MM-DD"
```

Questão de resposta aberta, com número:

```yaml
- id: porcentagem-01
  tipo: numero
  tema: "Porcentagem de um valor"
  dificuldade: 1
  enunciado: "Quanto é 15% de 80?"
  resposta: "12"                 # frações equivalentes e o mesmo valor em decimal também valem (12/1, 12,0)
  unidade: ""                    # opcional: o que aparece depois do campo ("reais", "%", "metros")
  erros_comuns:
    - resposta: "8"
      explicacao: "8 é 10% de 80. Falta somar os 5%…"
  dica: "Pista para qualquer outra resposta errada, sem entregar a resposta."
  explicacao: "…"
  conferir: "80 * 0.15"
  fonte: "Questão original do Instituto Lúcia"
  revisao:
    status: em-revisao
```

Na conta de `conferir` valem números com ponto decimal, `+ - * / ^`, `×`, `÷` e parênteses. Quando o texto da alternativa certa não começa pelo número (por exemplo, "2 horas e 15 minutos"), diga o valor em `valor: "135"` e escreva a conta na mesma unidade.

Quem estuda pode escrever a resposta como `3/4`, `0,75`, `0.75`, `1.080` (milhar), `R$ 12,50` ou `75%`. Resposta que não é número (letra, campo vazio) não conta como erro: a tela pede de novo.

## Conferir

```bash
npm run testar:exercicios
```

Confere cada arquivo (campos, uma única alternativa certa, explicação em toda errada, ids únicos), se a aula existe e refaz cada conta.

## Revisar

Siga `docs/CHECKLIST-DE-REVISAO.md`. Revisado, troque no arquivo:

```yaml
  revisao:
    status: revisada
    por: "educador de matemática"
    em: "2026-10-20"
```
