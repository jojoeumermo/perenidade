---
titulo: "Funções"
modelo: 9
resumo: "Como dar nome a um trecho de código para usá-lo quantas vezes quiser."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Lógica de programação: a construção de algoritmos e estruturas de dados"
    autor: "André Forbellone e Henri Eberspächer"
    ano: "2005"
  - titulo: "O tutorial de Python"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/"
quiz:
  - pergunta: "O que a palavra return faz dentro de uma função?"
    opcoes: ["Mostra um valor na tela", "Devolve um valor para quem chamou a função", "Repete a função desde o início"]
    resposta: 1
    explicacao: "return entrega o resultado e encerra a função. Quem mostra na tela é o print."
  - pergunta: "Na definição def dobro(n):, o que é n?"
    opcoes: ["O nome da função", "Um parâmetro: o valor que a função recebe", "O resultado da função"]
    resposta: 1
    explicacao: "O parâmetro é a entrada. Ao chamar dobro(4), n passa a valer 4 dentro da função."
  - pergunta: "Qual é a principal vantagem de usar funções?"
    opcoes: ["O programa roda mais rápido", "Evita repetir código e facilita corrigir erros", "O programa ocupa menos espaço na tela"]
    resposta: 1
    explicacao: "O código fica em um só lugar: se houver um erro, você corrige uma vez e vale para todas as chamadas."
---

## O que você vai aprender

Ao fim desta aula você vai saber criar funções com `def`, passar parâmetros, devolver resultados com `return` e dizer por que usar funções.

```suarealidade
Que tarefa você repete todo dia, sempre do mesmo jeito, que poderia ter um nome, como "abrir o caixa" ou "preparar o café"? Quais seriam os passos?
```

## Dar nome a um conjunto de passos

**Função** é um bloco de código com nome, que só é executado quando alguém o chama. Você já usou duas: `print` e `input`. Agora vai criar as suas.

```python
def saudacao():
    print("Olá!")
    print("Bem-vindo à biblioteca.")

saudacao()
saudacao()
```

- `def` (de *define*) cria a função.
- `saudacao` é o nome dela.
- As linhas recuadas são o **corpo**: o que ela faz.
- `saudacao()` é a **chamada**. Cada chamada executa o corpo inteiro. O programa acima mostra as duas mensagens duas vezes.

Definir uma função não a executa. Sem a chamada, nada acontece.

## Parâmetros: a entrada da função

Uma função fica muito mais útil quando recebe valores para trabalhar.

```python
def saudacao(nome):
    print("Olá, " + nome + "!")

saudacao("Ana")     # mostra Olá, Ana!
saudacao("Pedro")   # mostra Olá, Pedro!
```

`nome` é um **parâmetro**: uma variável que só existe dentro da função e que recebe o valor passado na chamada.

## Retorno: a saída da função

Muitas vezes você não quer que a função mostre algo na tela, e sim que ela **devolva** um resultado para ser usado depois. Para isso existe o `return`.

```python
def media(a, b):
    return (a + b) / 2

resultado = media(7, 9)
print(resultado)   # mostra 8.0
```

Ao chegar em `return`, a função termina e entrega o valor a quem a chamou. Aqui, o valor é guardado na variável `resultado`.

A diferença entre `print` e `return` confunde muita gente no início:

- `print` **mostra** um valor para a pessoa que está usando o programa.
- `return` **entrega** um valor para o resto do programa.

```simulador
execucao-python
# Veja a função entrar e sair da pilha
def dobro(n):
    return n * 2

a = dobro(4)
b = dobro(a)
print(a, b)
```

## Por que usar funções

- **Evitar repetição.** Escreva uma vez, use quantas vezes quiser.
- **Corrigir em um lugar só.** Se a conta estiver errada, você conserta na função e todas as chamadas ficam certas.
- **Organizar.** Um programa grande vira um conjunto de peças pequenas, cada uma com um nome que diz o que faz.

## Juntando tudo

Este programa usa quase tudo o que você viu na trilha: variáveis, condição, laço e função.

```python
def e_par(numero):
    return numero % 2 == 0

for n in range(1, 6):
    if e_par(n):
        print(n, "é par")
    else:
        print(n, "é ímpar")
```

O operador `%` dá o **resto da divisão**. Se o resto da divisão por 2 for zero, o número é par.

## Próximos passos

Com algoritmos, variáveis, condições, laços e funções, você já conhece a base de toda linguagem de programação. Para continuar, o acervo indica dois livros gratuitos: [Think Python](/acervo/think-python) e [Automate the Boring Stuff with Python](/acervo/automate-the-boring-stuff).

```outrolado
# O argumento mais forte de quem discorda
Há quem diga: "Função é complicação a mais. Basta copiar e colar o código onde precisar, que funciona do mesmo jeito." É uma ideia de quem quer terminar rápido.
---
Como você responderia a esse argumento, com respeito e com fatos?
---
A aula explica por que usar funções: uma função é um bloco de código com nome, que só roda quando alguém o chama, e que evita repetir os mesmos passos em vários lugares. Com parâmetros, a mesma função serve para entradas diferentes, e com return ela devolve um resultado. Copiar e colar funciona no começo, mas quando é preciso mudar um passo, é preciso mudar em todos os lugares onde foi copiado.
```

## Exemplo resolvido

**Como criar uma função que calcula a média de dois números?**

```python
def media(a, b):
    return (a + b) / 2

resultado = media(7, 9)
print(resultado)
```

1. `def media(a, b):` cria a função com dois **parâmetros**.
2. `return (a + b) / 2` calcula (7 + 9) / 2 = 8 e **devolve** o valor.
3. `resultado = media(7, 9)` chama a função e guarda o valor.
4. `print(resultado)` mostra `8.0`.

Confira: `return` entrega o valor para o resto do programa; `print` apenas o mostra na tela. Definir a função não a executa: é preciso chamá-la.

```agir
# Esta semana
Escolha uma tarefa de rotina e escreva os passos no papel, dando um nome a ela, como uma função. Depois diga em voz alta, para alguém de confiança, quando você "chama" essa função.
```

## Resumo

- Função é um bloco com nome, executado quando chamado; já foram usadas `print` e `input`.
- `def` cria; parâmetros são a entrada; `return` é a saída.
- `print` mostra para a pessoa; `return` entrega para o programa.
- Funções evitam repetição, permitem corrigir em um lugar só e organizam o programa.
