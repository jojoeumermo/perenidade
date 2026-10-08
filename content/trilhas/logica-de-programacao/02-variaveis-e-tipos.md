---
titulo: "Variáveis e tipos"
resumo: "Como o programa guarda informações e por que o tipo de cada uma importa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Lógica de programação: a construção de algoritmos e estruturas de dados"
    autor: "André Forbellone e Henri Eberspächer"
    ano: "2005"
  - titulo: "O tutorial de Python"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/"
quiz:
  - pergunta: "Depois de executar x = 5 e, em seguida, x = x + 2, quanto vale x?"
    opcoes: ["5", "7", "A linha dá erro"]
    resposta: 1
    explicacao: "O sinal = guarda um valor. Primeiro calcula-se x + 2 (que dá 7) e depois o resultado é guardado em x."
  - pergunta: "Qual é o resultado de \"2\" + \"3\" em Python?"
    opcoes: ["5", "\"23\"", "Um erro"]
    resposta: 1
    explicacao: "Entre aspas, 2 e 3 são textos. Somar textos junta um ao outro."
  - pergunta: "Qual destes é um bom nome de variável?"
    opcoes: ["x1", "preco_total", "2valor"]
    resposta: 1
    explicacao: "preco_total diz o que a variável guarda. Além disso, nomes não podem começar com número."
---

## Uma caixa com etiqueta

**Variável** é um espaço na memória do computador onde o programa guarda um valor. Pense em uma caixa com uma etiqueta: a etiqueta é o **nome** e o que está dentro é o **valor**.

```python
nome = "Ana"
idade = 20
```

O sinal `=` aqui não significa "é igual a". Ele significa **"guarde"**: guarde o texto "Ana" na variável `nome`. Por isso ele se chama **atribuição**.

O valor pode mudar ao longo do programa, e daí vem o nome "variável":

```python
pontos = 10
pontos = pontos + 5
print(pontos)   # mostra 15
```

Na segunda linha, o computador primeiro calcula `pontos + 5` (que dá 15) e depois guarda o resultado de volta em `pontos`.

O que vem depois de `#` é um **comentário**: uma anotação para quem lê o código. O computador ignora.

## Tipos de dados

Cada valor tem um tipo, e o tipo define o que se pode fazer com ele.

| Tipo | O que guarda | Exemplos |
| --- | --- | --- |
| Inteiro (`int`) | Números sem vírgula | `7`, `-3`, `2024` |
| Real (`float`) | Números com casas decimais | `3.14`, `-0.5` |
| Texto (`str`) | Letras, palavras, frases | `"Ana"`, `"Olá, mundo"` |
| Lógico (`bool`) | Verdadeiro ou falso | `True`, `False` |

Dois detalhes do Python:

- Os números decimais usam **ponto**, não vírgula: `3.14`.
- Texto sempre vai **entre aspas**.

## Por que o tipo importa

```python
print(2 + 3)       # mostra 5
print("2" + "3")   # mostra 23
```

Na primeira linha, `2` e `3` são números, e `+` soma. Na segunda, estão entre aspas, então são textos, e `+` junta um no outro.

Tudo o que o usuário digita chega ao programa como texto. Para fazer contas, é preciso converter:

```python
idade = int(input("Sua idade: "))
```

`input` lê o que a pessoa digitou e `int` transforma o texto em número inteiro.

## Bons nomes

- Use nomes que digam o que a variável guarda: `preco_total` é melhor que `x`.
- Não use espaços. Separe as palavras com `_`.
- O nome não pode começar com número.
- Maiúsculas e minúsculas fazem diferença: `Idade` e `idade` são variáveis diferentes.

## Pratique

Sem usar o computador, diga o que este programa mostra na tela:

```python
a = 4
b = a * 2
a = b - 1
print(a, b)
```

A resposta é `7 8`. Se você chegou a outro resultado, refaça linha por linha, anotando o valor de cada variável.
