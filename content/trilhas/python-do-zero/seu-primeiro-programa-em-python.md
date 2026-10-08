---
titulo: "Seu primeiro programa em Python"
resumo: "O que é Python, como executar um programa sem instalar nada e como ler as primeiras mensagens de erro."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: uma introdução informal ao Python"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/introduction.html"
  - titulo: "Pense em Python (2ª edição)"
    autor: "Allen B. Downey"
    ano: "2016"
    url: "https://penseallen.github.io/PensePython2e/"
quiz:
  - pergunta: "O que a função print faz?"
    opcoes: ["Imprime no papel", "Mostra um valor na tela", "Lê o que a pessoa digita"]
    resposta: 1
    explicacao: "print escreve na saída do programa. Quem lê o que a pessoa digita é a função input, assunto da próxima aula."
  - pergunta: "O que acontece com uma linha que começa com #?"
    opcoes: ["É executada duas vezes", "É ignorada pelo Python: serve de anotação para quem lê", "Gera um erro"]
    resposta: 1
    explicacao: "Tudo o que vem depois de # na linha é comentário."
  - pergunta: "O programa print(Olá) dá erro. Por quê?"
    opcoes: ["Porque faltam as aspas em volta do texto", "Porque print não aceita palavras", "Porque falta ponto e vírgula"]
    resposta: 0
    explicacao: "Sem aspas, o Python entende Olá como o nome de uma variável, que não existe, e avisa com um NameError."
---

## O que é Python

Python é uma linguagem de programação criada pelo holandês Guido van Rossum e lançada em 1991. O nome é uma homenagem ao grupo de humor britânico Monty Python, e não à cobra. Ela é gratuita, tem o código aberto e é usada em escolas, em pesquisas científicas, em análise de dados e em sites.

Escolhemos Python para começar porque o código se parece com frases, e você pode se concentrar no raciocínio. Se ainda não fez a trilha [Lógica de programação](/trilhas/logica-de-programacao), comece por ela: tudo o que foi visto lá em português estruturado vai aparecer aqui, agora de verdade.

## Onde executar

Você não precisa instalar nada. Abra a ferramenta [Python no navegador](/ferramentas/python), escreva o código e aperte **Executar**. Nas aulas, todo exemplo tem o link "Testar este código".

## O primeiro programa

```python
print("Olá, mundo!")
```

Uma linha só. `print` é uma **função**: um comando pronto que faz alguma coisa. Entre os parênteses vai aquilo que ela deve mostrar. O texto fica entre **aspas**, para o Python saber onde ele começa e onde termina.

Um programa é uma lista de instruções executadas **de cima para baixo, uma por vez**:

```python
print("Bom dia!")
print("Hoje vamos aprender Python.")
print(2 + 3)
```

A terceira linha não tem aspas: é uma conta, e o Python mostra o resultado, 5.

```verificar
O que print("2 + 3") mostra na tela?
- 5
+ 2 + 3
- Um erro
> Olhe as aspas: o que está entre aspas é texto, e texto é mostrado do jeito que foi escrito.
```

## Comentários

Tudo o que vem depois de `#` é ignorado pelo Python. Serve para você deixar explicações para quem vai ler o código, inclusive você mesmo daqui a um mês.

```python
# Calcula quantas horas há em uma semana
print(7 * 24)  # sete dias de 24 horas
```

## Errar faz parte

Tire as aspas de fechamento e execute:

```python
print("Olá, mundo!)
```

O Python para e mostra uma mensagem que termina com `SyntaxError`. É um **erro de sintaxe**: a frase foi escrita de um jeito que a linguagem não entende. A mensagem indica a linha do problema. Ler a mensagem com calma, em vez de se assustar, é a habilidade mais valiosa de quem programa.

Agora escreva `Print("oi")`, com P maiúsculo. Novo erro, desta vez `NameError`: Python diferencia maiúsculas de minúsculas, e `Print` não existe.

## Para praticar

1. Faça um programa que mostre o seu nome em uma linha e a sua cidade em outra.
2. Faça o Python calcular quantos minutos tem um dia.
3. Provoque de propósito um `SyntaxError` e um `NameError`, e leia as mensagens.
