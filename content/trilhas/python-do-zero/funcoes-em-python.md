---
titulo: "Funções em Python"
resumo: "Como dar nome a um trecho de código, passar valores para ele e receber uma resposta."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "O tutorial de Python: mais ferramentas de controle de fluxo (definindo funções)"
    autor: "Python Software Foundation"
    url: "https://docs.python.org/pt-br/3/tutorial/controlflow.html"
  - titulo: "Pense em Python (2ª edição)"
    autor: "Allen B. Downey"
    ano: "2016"
    url: "https://penseallen.github.io/PensePython2e/"
quiz:
  - pergunta: "Qual palavra cria uma função em Python?"
    opcoes: ["function", "def", "func"]
    resposta: 1
    explicacao: "def, de 'definir'. Depois vêm o nome, os parênteses com os parâmetros e dois-pontos."
  - pergunta: "Qual é a diferença entre print e return dentro de uma função?"
    opcoes: ["Nenhuma", "print mostra na tela; return devolve o valor para quem chamou a função", "return mostra na tela; print devolve o valor"]
    resposta: 1
    explicacao: "Um valor devolvido com return pode ser guardado em uma variável e usado em outras contas. O que foi só impresso, não."
  - pergunta: "Uma variável criada dentro de uma função pode ser usada fora dela?"
    opcoes: ["Sim, sempre", "Não: ela existe só enquanto a função está sendo executada", "Só se tiver nome em maiúsculas"]
    resposta: 1
    explicacao: "É uma variável local. Para levar um valor para fora, use return."
---

## Por que criar funções

Você já usa funções prontas: `print`, `input`, `len`, `sum`. Agora vai criar as suas. Uma função é um **trecho de código com nome**, que pode ser usado quantas vezes for preciso. As vantagens:

- escrever uma vez e usar muitas;
- consertar em um lugar só;
- dividir um problema grande em partes pequenas, cada uma com um nome que explica o que faz.

## Definir e chamar

```python
def saudacao():
    print("Bom dia!")
    print("Seja bem-vinda ao Instituto Lúcia.")

saudacao()
saudacao()
```

`def` **define** a função: ensina ao Python o que ela faz, mas não executa nada. É a **chamada**, `saudacao()`, que faz o bloco rodar. Aqui ele roda duas vezes.

## Parâmetros

Entre os parênteses ficam os **parâmetros**: valores que a função recebe para trabalhar.

```python
def saudacao(nome):
    print(f"Bom dia, {nome}!")

saudacao("Marta")
saudacao("João")
```

## Devolvendo um resultado com return

Mostrar na tela e **devolver** um valor são coisas diferentes. `return` entrega o resultado a quem chamou a função, que pode guardá-lo e usá-lo:

```python
def area_retangulo(largura, altura):
    return largura * altura

sala = area_retangulo(4, 5)
quarto = area_retangulo(3, 3)
print("Área total:", sala + quarto)
```

Se a função apenas imprimisse a área, não daria para somar as duas depois. Regra prática: funções que **calculam** devem usar `return`; quem decide o que mostrar é o programa principal.

Assim que o `return` é executado, a função termina.

```verificar
O que mostra este programa? def dobro(n): return n * 2 … print(dobro(dobro(3)))
- 6
+ 12
- 9
> Resolva de dentro para fora: primeiro dobro(3), depois o dobro do resultado.
```

## Valor padrão

Um parâmetro pode ter um valor que vale quando nada é informado:

```python
def preco_final(valor, desconto=0):
    return valor - valor * desconto / 100

print(preco_final(200))
print(preco_final(200, 10))
```

## Variáveis locais

O que é criado dentro da função fica dentro da função:

```python
def calcula():
    resultado = 10 * 2
    return resultado

print(calcula())
```

Tentar usar `resultado` fora da função causa um `NameError`. Isso é bom: cada função tem a sua própria mesa de trabalho e não bagunça a das outras.

## Um exemplo completo

```python
def media(valores):
    return sum(valores) / len(valores)

def situacao(nota):
    if nota >= 6:
        return "aprovado"
    return "recuperação"

notas = [7.5, 4.0, 6.5]
m = media(notas)
print(f"Média {m:.1f}: {situacao(m)}")
```

Cada função faz uma coisa só e tem um nome que diz o que é. Ler o programa principal fica quase como ler uma frase.

## Para praticar

1. Escreva `eh_par(n)`, que devolve `True` se o número for par.
2. Escreva `maior(a, b)`, que devolve o maior de dois números, sem usar `max`.
3. Escreva `celsius_para_fahrenheit(c)`. A fórmula é F = C × 9 / 5 + 32.
