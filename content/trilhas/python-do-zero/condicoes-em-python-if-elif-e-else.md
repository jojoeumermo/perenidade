---
titulo: "Condições em Python: if, elif e else"
resumo: "Como fazer o programa escolher um caminho, e por que o recuo do texto faz parte da linguagem."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: mais ferramentas de controle de fluxo"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/controlflow.html"
  - titulo: "Pense em Python (2ª edição)"
    autor: "Allen B. Downey"
    ano: "2016"
    url: "https://penseallen.github.io/PensePython2e/"
quiz:
  - pergunta: "Em Python, como o computador sabe quais linhas pertencem ao if?"
    opcoes: ["Pelas chaves { }", "Pelo recuo (indentação) das linhas", "Pela palavra fim"]
    resposta: 1
    explicacao: "As linhas recuadas logo abaixo do if formam o bloco dele. O recuo é obrigatório."
  - pergunta: "Em uma sequência if / elif / elif / else, quantos blocos são executados?"
    opcoes: ["Todos os verdadeiros", "No máximo um", "Sempre dois"]
    resposta: 1
    explicacao: "O Python testa de cima para baixo e executa só o primeiro bloco cuja condição for verdadeira; se nenhuma for, executa o else."
  - pergunta: "O que falta nesta linha: if nota >= 6"
    opcoes: ["Um ponto e vírgula", "Dois-pontos no final", "Parênteses"]
    resposta: 1
    explicacao: "Toda linha de if, elif e else termina com dois-pontos."
---

## Se… então…

Na trilha de lógica você viu a estrutura "se… então… senão…". Em Python ela se escreve com `if` e `else`:

```python
idade = 17
if idade >= 16:
    print("Pode votar.")
else:
    print("Ainda não pode votar.")
```

Três detalhes que não podem faltar:

1. depois da condição vêm **dois-pontos**;
2. as linhas que pertencem ao `if` ficam **recuadas** (quatro espaços é o costume);
3. o `else` volta para a margem e também termina com dois-pontos.

## O recuo é parte da linguagem

Em muitas linguagens o recuo é só capricho. Em Python, não: é ele que diz onde o bloco começa e termina.

```python
saldo = 30
if saldo < 50:
    print("Saldo baixo.")
    print("Evite gastos.")
print("Fim da consulta.")
```

As duas linhas recuadas só são executadas se a condição for verdadeira. A última, na margem, é executada sempre. Troque o saldo para 80 e veja.

```verificar
No exemplo acima, com saldo = 80, o que aparece na tela?
- Saldo baixo. / Evite gastos. / Fim da consulta.
+ Só "Fim da consulta."
- Nada
> A condição 80 < 50 é falsa. Quais linhas estão fora do bloco do if?
```

## Mais de dois caminhos: elif

`elif` é a abreviação de "else if" ("senão, se"). O Python testa as condições de cima para baixo e executa **apenas o primeiro** bloco verdadeiro:

```python
nota = float(input("Nota: "))
if nota >= 9:
    print("Excelente")
elif nota >= 6:
    print("Aprovado")
elif nota >= 4:
    print("Recuperação")
else:
    print("Reprovado")
```

A ordem importa. Se o teste `nota >= 6` viesse primeiro, uma nota 9,5 cairia nele e nunca chegaria ao "Excelente".

## Condições compostas

Use `and`, `or` e `not`, vistos na aula anterior:

```python
idade = int(input("Idade: "))
if idade >= 18 and idade <= 70:
    print("Voto obrigatório.")
elif idade >= 16:
    print("Voto facultativo.")
else:
    print("Ainda não vota.")
```

(No Brasil, o voto é obrigatório dos 18 aos 70 anos e facultativo para quem tem 16 ou 17 anos ou mais de 70.)

## Um if dentro do outro

```python
tem_ingresso = True
idade = 15
if tem_ingresso:
    if idade >= 14:
        print("Pode entrar.")
    else:
        print("Só com responsável.")
else:
    print("Compre o ingresso primeiro.")
```

Cada nível ganha mais quatro espaços. Se os níveis passarem de três, o código fica difícil de ler: é sinal de que vale reorganizar.

## Para praticar

1. Peça um número e diga se ele é par ou ímpar.
2. Peça dois números e mostre o maior (ou avise que são iguais).
3. Peça o valor de uma compra: acima de R$ 200, dê 10% de desconto; acima de R$ 100, 5%; abaixo disso, nenhum. Mostre o valor final.
