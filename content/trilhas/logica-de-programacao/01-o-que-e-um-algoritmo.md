---
titulo: "O que é um algoritmo"
resumo: "Uma sequência de passos claros para resolver um problema."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Lógica de programação: a construção de algoritmos e estruturas de dados"
    autor: "André Forbellone e Henri Eberspächer"
    ano: "2005"
  - titulo: "Introduction to Computer Science"
    autor: "Jean-Claude Franchitti e outros (OpenStax)"
    ano: "2024"
    url: "https://openstax.org/details/books/introduction-computer-science"
quiz:
  - pergunta: "O que é um algoritmo?"
    opcoes: ["Um tipo de computador", "Uma sequência finita de passos para resolver um problema", "Uma linguagem de programação"]
    resposta: 1
    explicacao: "Algoritmo é a receita. A linguagem de programação é só o idioma em que a receita é escrita."
  - pergunta: "Por que \"tempere a gosto\" é uma instrução ruim para um computador?"
    opcoes: ["Porque é ambígua", "Porque é longa demais", "Porque está em português"]
    resposta: 0
    explicacao: "O computador segue instruções ao pé da letra. Ele precisa saber exatamente quanto e quando."
  - pergunta: "O que o comando print(\"Olá\") faz em Python?"
    opcoes: ["Imprime em papel", "Mostra o texto Olá na tela", "Cria uma variável chamada Olá"]
    resposta: 1
    explicacao: "print exibe na tela o que estiver entre os parênteses."
modelo: 9
---

## O que você vai aprender

Ao fim desta aula você vai saber dizer o que é um algoritmo, nomear as suas três partes (entrada, processamento e saída) e escrever um em pseudocódigo.

```suarealidade
Que tarefa do seu trabalho ou da sua casa você faz sempre na mesma ordem, quase sem pensar (abrir a loja, lavar a roupa, arrumar o material)? Quais são os passos, um por um?
```

## Uma receita para resolver problemas

**Algoritmo** é uma sequência finita de passos, claros e ordenados, que leva à solução de um problema. Você já segue algoritmos o tempo todo: uma receita de bolo, as instruções para montar um móvel, o caminho até a padaria.

Todo algoritmo tem três partes:

1. **Entrada**: o que ele recebe (os ingredientes).
2. **Processamento**: o que ele faz (o modo de preparo).
3. **Saída**: o que ele entrega (o bolo).

## O computador não adivinha

Uma pessoa entende instruções vagas. Se a receita diz "asse até dourar", você usa o bom senso. O computador não tem bom senso: ele executa exatamente o que foi escrito, na ordem em que foi escrito.

Por isso, um bom algoritmo precisa ser:

- **Preciso**: cada passo só pode ser entendido de um jeito.
- **Ordenado**: a ordem dos passos importa.
- **Finito**: em algum momento ele termina.

## Um exemplo

Problema: descobrir se uma pessoa pode votar no Brasil, onde o voto é permitido a partir dos 16 anos.

```
1. Pergunte a idade da pessoa.
2. Se a idade for maior ou igual a 16, responda "Pode votar".
3. Caso contrário, responda "Ainda não pode votar".
```

Esse jeito de escrever, em português organizado, é chamado de **pseudocódigo**. Ele serve para pensar na solução antes de se preocupar com a linguagem.

## O mesmo algoritmo em Python

```python
idade = int(input("Qual é a sua idade? "))

if idade >= 16:
    print("Pode votar")
else:
    print("Ainda não pode votar")
```

Não se preocupe em entender cada detalhe agora. Repare só que a estrutura é a mesma do pseudocódigo: uma entrada, uma decisão e uma saída. As próximas aulas explicam cada peça.

## Seu primeiro programa

O programa mais simples que existe mostra uma mensagem na tela:

```python
print("Olá, mundo!")
```

`print` é o comando que exibe na tela o que estiver entre os parênteses.

## Exemplo resolvido

**Como escrever o algoritmo "pode votar?" (voto a partir dos 16 anos)?**

1. **Entrada**: a idade da pessoa. Passo 1: *Pergunte a idade da pessoa.*
2. **Processamento**: uma decisão. Passo 2: *Se a idade for maior ou igual a 16, responda "Pode votar".*
3. Passo 3, o caminho contrário: *Caso contrário, responda "Ainda não pode votar".*
4. **Saída**: a resposta dada.

Confira: cada passo só pode ser entendido de um jeito (preciso), a ordem importa (ordenado) e o algoritmo termina (finito). Em Python, a mesma estrutura é `if idade >= 16:` e `else:`.

```outrolado
# O argumento de quem acha que não precisa aprender isso
"Hoje o computador e o celular já fazem tudo sozinhos. Eu só uso os aplicativos. Para que aprender a escrever passo a passo?"
---
Como você responderia a esse argumento, com respeito e com fatos?
---
Ninguém é obrigado a programar. Mas a aula mostra uma ideia útil mesmo para quem só usa aplicativos: o computador não tem bom senso e executa exatamente o que alguém escreveu, na ordem em que foi escrito. Saber que todo programa é uma sequência de passos precisos ajuda a entender o que um aplicativo está fazendo e por que ele erra quando o passo foi escrito de um jeito que não previu o seu caso.
```

```agir
# Esta semana
Escolha uma tarefa simples e sem risco da sua casa (arrumar a cama ou lavar as mãos) e escreva o passo a passo num papel, como um algoritmo. Peça a alguém de casa para ler e seguir só o que está escrito, sem completar nada com bom senso. Anote os passos que ficaram vagos.
```

## Pratique

Escreva em pseudocódigo o algoritmo para atravessar uma rua com semáforo. Depois releia e pergunte: algum passo pode ser entendido de dois jeitos? O algoritmo sempre termina?

## Resumo

- Algoritmo é uma sequência finita de passos claros e ordenados que leva à solução de um problema.
- Tem três partes: entrada, processamento e saída.
- Um bom algoritmo é preciso, ordenado e finito; o computador não tem bom senso.
- Pseudocódigo é o jeito de escrever o algoritmo em português organizado, antes de usar uma linguagem.
- `print("Olá, mundo!")` mostra uma mensagem na tela.
