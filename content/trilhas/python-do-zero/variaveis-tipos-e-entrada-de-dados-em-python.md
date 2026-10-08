---
titulo: "Variáveis, tipos e entrada de dados em Python"
resumo: "Como guardar valores, como o Python diferencia números de textos e como ler o que a pessoa digita."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: uma introdução informal ao Python"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/introduction.html"
  - titulo: "Funções embutidas: input, int, float, str, type"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/library/functions.html"
quiz:
  - pergunta: "Depois de executar idade = 20 e, em seguida, idade = idade + 1, quanto vale idade?"
    opcoes: ["20", "21", "Dá erro"]
    resposta: 1
    explicacao: "O lado direito é calculado primeiro (20 + 1) e o resultado é guardado de volta na variável."
  - pergunta: "Qual é o tipo do valor devolvido por input()?"
    opcoes: ["Sempre texto (str)", "Número inteiro (int)", "Depende do que a pessoa digitar"]
    resposta: 0
    explicacao: "input sempre devolve texto. Para fazer contas, é preciso converter com int() ou float()."
  - pergunta: "O que mostra print('3' + '4')?"
    opcoes: ["7", "34", "Um erro"]
    resposta: 1
    explicacao: "Entre textos, o sinal + junta um ao outro. Para somar, os valores precisam ser números."
---

## Variáveis: caixas com etiqueta

Uma **variável** é um nome que aponta para um valor guardado na memória. Cria-se uma variável com o sinal de igual:

```python
nome = "Marta"
idade = 34
print(nome)
print(idade)
```

Leia `idade = 34` como "idade **recebe** 34". Não é uma igualdade de matemática: é uma ordem para guardar. Por isso isto faz sentido em programação:

```python
contador = 10
contador = contador + 1
print(contador)
```

O Python calcula primeiro o lado direito (10 + 1) e guarda o resultado na mesma variável.

Regras para os nomes: letras, números e sublinhado; não podem começar com número nem ter espaço. Use nomes que expliquem o conteúdo: `preco_total` é melhor que `x`.

## Tipos

Todo valor tem um tipo. Os quatro primeiros:

| Tipo | O que guarda | Exemplo |
| --- | --- | --- |
| `int` | número inteiro | `42` |
| `float` | número com casas decimais | `3.75` |
| `str` | texto | `"bom dia"` |
| `bool` | verdadeiro ou falso | `True`, `False` |

Atenção: em Python, a parte decimal é separada por **ponto**, não por vírgula. A função `type` mostra o tipo de um valor:

```python
print(type(42))
print(type(3.75))
print(type("42"))
```

O último é texto: tem aspas. `42` e `"42"` são coisas diferentes para o computador.

## Lendo o que a pessoa digita

A função `input` mostra uma pergunta, espera a resposta e a devolve **como texto**:

```python
nome = input("Qual é o seu nome? ")
print("Olá,", nome)
```

Na ferramenta do site, escreva as respostas no campo "Entradas", uma por linha, antes de executar.

Para fazer contas com o que foi digitado, converta o texto em número com `int()` (inteiros) ou `float()` (decimais):

```python
ano = int(input("Em que ano você nasceu? "))
idade = 2026 - ano
print("Você faz", idade, "anos em 2026.")
```

```verificar
A pessoa digita 5. O que mostra print(input() * 2)?
- 10
+ 55
- Um erro
> input devolve texto. O que acontece com um texto multiplicado por 2?
```

## Montando frases com f-strings

Coloque um `f` antes das aspas e escreva as variáveis entre chaves. O Python troca cada uma pelo seu valor:

```python
produto = "arroz"
preco = 6.5
print(f"O {produto} custa R$ {preco:.2f}.")
```

O `:.2f` pede duas casas decimais.

## Para praticar

1. Peça o nome e a cidade da pessoa e mostre: "Fulana mora em Tal lugar."
2. Peça dois números e mostre a soma.
3. Peça o valor de uma hora de trabalho e quantas horas foram trabalhadas, e mostre o total a receber com duas casas decimais.
