---
titulo: "Funções"
resumo: "Como dar nome a um trecho de código para usá-lo quantas vezes quiser."
autores: ["Equipe Projeto Lucia"]
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
