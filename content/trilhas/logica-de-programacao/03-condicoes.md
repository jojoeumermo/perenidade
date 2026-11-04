---
titulo: "Condições"
resumo: "Como fazer o programa tomar decisões com se, senão e os operadores de comparação."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Lógica de programação: a construção de algoritmos e estruturas de dados"
    autor: "André Forbellone e Henri Eberspächer"
    ano: "2005"
  - titulo: "O tutorial de Python"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/"
quiz:
  - pergunta: "Qual operador testa se dois valores são iguais?"
    opcoes: ["=", "==", "=>"]
    resposta: 1
    explicacao: "Um sinal de igual guarda um valor. Dois sinais de igual comparam."
  - pergunta: "Com idade = 15, quanto vale a expressão idade >= 12 and idade < 18?"
    opcoes: ["True", "False", "15"]
    resposta: 0
    explicacao: "As duas partes são verdadeiras (15 é pelo menos 12 e é menor que 18), então o and dá True."
  - pergunta: "Em Python, como o computador sabe quais linhas pertencem a um if?"
    opcoes: ["Pelas chaves { }", "Pelo recuo no começo das linhas", "Pela palavra end"]
    resposta: 1
    explicacao: "O recuo (indentação) define o bloco. Linhas alinhadas sob o if só rodam quando a condição é verdadeira."
---

## O que você vai aprender

Ao fim desta aula você vai saber escolher caminhos num programa com `if`, `elif` e `else`, usar os operadores de comparação e combinar condições com `and`, `or` e `not`.

Até aqui, os programas executavam todas as linhas, de cima para baixo. Com **condições**, o programa escolhe um caminho.

## Se... senão

```python
nota = 7

if nota >= 6:
    print("Aprovado")
else:
    print("Reprovado")
```

Lê-se: **se** a nota for maior ou igual a 6, mostre "Aprovado"; **senão**, mostre "Reprovado".

- `if` significa "se".
- `else` significa "senão".
- Os dois-pontos (`:`) abrem um bloco.
- As linhas do bloco ficam **recuadas** (em geral, 4 espaços). É pelo recuo que o Python sabe o que pertence ao `if` e o que pertence ao `else`.

## Comparações

Toda condição é uma pergunta cuja resposta é verdadeiro (`True`) ou falso (`False`).

| Operador | Significado | Exemplo | Resultado |
| --- | --- | --- | --- |
| `==` | igual a | `5 == 5` | `True` |
| `!=` | diferente de | `5 != 5` | `False` |
| `>` | maior que | `7 > 3` | `True` |
| `<` | menor que | `7 < 3` | `False` |
| `>=` | maior ou igual | `6 >= 6` | `True` |
| `<=` | menor ou igual | `4 <= 2` | `False` |

O erro mais comum de quem começa é confundir `=` com `==`. Um sinal **guarda** um valor. Dois sinais **comparam**.

## Mais de dois caminhos

Quando há várias possibilidades, use `elif` (abreviação de *else if*, "senão, se"):

```python
if nota >= 9:
    print("Excelente")
elif nota >= 6:
    print("Aprovado")
elif nota >= 4:
    print("Recuperação")
else:
    print("Reprovado")
```

O computador testa de cima para baixo e executa **apenas o primeiro** bloco cuja condição for verdadeira. Com nota 9,5, ele mostra "Excelente" e pula todo o resto, mesmo que 9,5 também seja maior que 6.

## Combinando condições

- `and` (e): verdadeiro só quando **as duas** partes são verdadeiras.
- `or` (ou): verdadeiro quando **pelo menos uma** é verdadeira.
- `not` (não): inverte o resultado.

```python
if idade >= 12 and idade < 18:
    print("Adolescente")

if dia == "sábado" or dia == "domingo":
    print("Fim de semana")
```

## Exemplo resolvido

**Qual caminho o programa toma com `nota = 9.5`?**

```python
if nota >= 9:
    print("Excelente")
elif nota >= 6:
    print("Aprovado")
elif nota >= 4:
    print("Recuperação")
else:
    print("Reprovado")
```

1. O computador testa de cima para baixo.
2. `9.5 >= 9` é `True`, então ele mostra "Excelente".
3. Ele executa **apenas o primeiro** bloco verdadeiro e pula o resto, mesmo que 9,5 também seja maior que 6.

Confira: com `nota = 5`, a primeira e a segunda condições são falsas e a terceira (`5 >= 4`) é verdadeira: mostra "Recuperação".

## Pratique

Escreva, em pseudocódigo ou em Python, um programa que recebe um número e diz se ele é positivo, negativo ou zero. Quantos caminhos ele precisa ter?

## Resumo

- `if` (se), `elif` (senão, se) e `else` (senão) escolhem um caminho; o recuo mostra o que pertence a cada bloco.
- Comparações dão `True` ou `False`: `==`, `!=`, `>`, `<`, `>=`, `<=`.
- Um `=` guarda um valor; dois `==` comparam.
- `and`, `or` e `not` combinam condições; só o primeiro bloco verdadeiro executa.
