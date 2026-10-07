---
titulo: "Laços de repetição"
resumo: "Como mandar o computador repetir uma tarefa sem reescrever o código."
autores: ["Equipe Projeto Lucia"]
quiz:
  - pergunta: "Quais números o comando for i in range(3) percorre?"
    opcoes: ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3"]
    resposta: 1
    explicacao: "range(3) começa em 0 e para antes do 3: são três números, 0, 1 e 2."
  - pergunta: "O que causa um laço infinito?"
    opcoes: ["Uma condição que nunca se torna falsa", "Usar for em vez de while", "Repetir mais de 100 vezes"]
    resposta: 0
    explicacao: "Se nada dentro do laço muda o que a condição testa, ela continua verdadeira para sempre."
  - pergunta: "Quando o while é mais indicado que o for?"
    opcoes: ["Quando se sabe exatamente quantas repetições haverá", "Quando não se sabe de antemão quantas repetições serão necessárias", "Nunca, os dois são idênticos"]
    resposta: 1
    explicacao: "O while repete enquanto uma condição valer, por exemplo, até a pessoa acertar a senha."
---

Computadores são ótimos em repetir tarefas sem cansar e sem errar. Os **laços** (em inglês, *loops*) dizem ao programa para executar um bloco várias vezes.

## Enquanto: `while`

O `while` repete o bloco **enquanto** a condição for verdadeira.

```python
contador = 1

while contador <= 5:
    print(contador)
    contador = contador + 1
```

Esse programa mostra os números de 1 a 5. Acompanhe:

1. `contador` começa valendo 1.
2. A condição `contador <= 5` é verdadeira, então o bloco roda: mostra 1 e o contador passa a valer 2.
3. O programa volta e testa a condição de novo.
4. Quando o contador chega a 6, a condição fica falsa e o laço termina.

## Cuidado com o laço infinito

Se você esquecer a linha `contador = contador + 1`, o contador vale 1 para sempre, a condição nunca fica falsa e o programa nunca para. Isso se chama **laço infinito**.

Sempre que escrever um `while`, pergunte: o que, dentro do bloco, vai fazer a condição ficar falsa em algum momento?

## Para cada: `for`

Quando você sabe quantas vezes quer repetir, o `for` é mais simples:

```python
for numero in range(1, 6):
    print(numero)
```

`range(1, 6)` gera os números de 1 a 5. O primeiro valor entra, o último **não**: a contagem para antes do 6. Com um só valor, `range(3)` começa do zero e gera 0, 1 e 2.

A cada volta, a variável `numero` recebe o próximo valor da sequência.

## Um exemplo útil: somar de 1 a 100

```python
soma = 0

for numero in range(1, 101):
    soma = soma + numero

print(soma)   # mostra 5050
```

A variável `soma` começa em zero e vai **acumulando** os valores a cada volta. Esse padrão, chamado de acumulador, aparece em quase todo programa.

## Qual usar

- Use `for` quando souber quantas repetições serão, ou quando for percorrer uma sequência.
- Use `while` quando a repetição depender de algo que acontece durante o programa, como "repita até a pessoa digitar a senha certa".

## Pratique

Escreva um laço que mostre a tabuada do 7, de 7 × 1 até 7 × 10. Dica: dentro do laço, multiplique 7 pela variável que conta as voltas.
