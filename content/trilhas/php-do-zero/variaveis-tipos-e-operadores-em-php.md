---
titulo: "Variáveis, tipos e operadores em PHP"
resumo: "O cifrão das variáveis, os tipos básicos, o ponto que junta textos e a diferença entre == e ===."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual do PHP: tipos"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.types.php"
  - titulo: "Manual do PHP: um tutorial simples"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/tutorial.php"
quiz:
  - pergunta: "Como se escreve o nome de uma variável em PHP?"
    opcoes: ["Com um cifrão na frente: $nome", "Entre aspas: 'nome'", "Com a palavra var: var nome"]
    resposta: 0
    explicacao: "Toda variável em PHP começa com $."
  - pergunta: "Qual operador junta dois textos em PHP?"
    opcoes: ["O sinal de mais (+)", "O ponto (.)", "A vírgula (,)"]
    resposta: 1
    explicacao: "Em PHP o + é só para números. Textos são unidos com o ponto."
  - pergunta: "Qual é o resultado de 5 === \"5\"?"
    opcoes: ["true", "false", "Erro"]
    resposta: 1
    explicacao: "=== compara valor e tipo. Um é número inteiro, o outro é texto: são diferentes."
---

## Variáveis começam com cifrão

```php
<?php
$nome = "Marta";
$idade = 34;
echo $nome;
echo "\n";
echo $idade;
```

Como em outras linguagens, o sinal de igual **guarda** o valor da direita na variável da esquerda. Os nomes podem ter letras, números e sublinhado, não podem começar com número e diferenciam maiúsculas de minúsculas: `$Nome` e `$nome` são variáveis distintas.

## Tipos básicos

| Tipo | O que guarda | Exemplo |
| --- | --- | --- |
| `int` | número inteiro | `42` |
| `float` | número com casas decimais | `3.75` |
| `string` | texto | `"bom dia"` |
| `bool` | verdadeiro ou falso | `true`, `false` |
| `null` | ausência de valor | `null` |

A função `var_dump` mostra o tipo e o valor de qualquer coisa. É a melhor amiga de quem está procurando um erro:

```php
<?php
var_dump(42);
var_dump(3.75);
var_dump("42");
var_dump(true);
```

## Aspas simples e aspas duplas

Dentro de **aspas duplas**, o PHP troca as variáveis pelo seu valor. Dentro de **aspas simples**, não:

```php
<?php
$produto = "arroz";
echo "O $produto subiu.\n";
echo 'O $produto subiu.\n';
```

A primeira linha mostra "O arroz subiu." A segunda mostra o texto exatamente como foi escrito, com `$produto` e `\n`.

## Juntando textos com ponto

```php
<?php
$nome = "Marta";
$sobrenome = "Silva";
echo $nome . " " . $sobrenome . "\n";
```

Em PHP, o sinal de mais serve só para números. Para unir textos, usa-se o **ponto**.

## Operadores aritméticos

```php
<?php
echo 7 + 2, "\n";
echo 7 - 2, "\n";
echo 7 * 2, "\n";
echo 7 / 2, "\n";
echo 7 % 2, "\n";
echo 7 ** 2, "\n";
echo intdiv(7, 2), "\n";
```

`%` é o resto da divisão, `**` é a potência e `intdiv` faz a divisão inteira. Para arredondar e formatar dinheiro, use `number_format`:

```php
<?php
$preco = 1234.5;
echo "R$ " . number_format($preco, 2, ",", ".");
```

Sai `R$ 1.234,50`: duas casas, vírgula nos decimais e ponto nos milhares.

## Comparar: == e ===

- `==` pergunta se os **valores** são iguais, convertendo os tipos se for preciso;
- `===` pergunta se **valor e tipo** são iguais.

```php
<?php
var_dump(5 == "5");
var_dump(5 === "5");
```

O primeiro dá `true`; o segundo, `false`. Essa conversão automática do `==` já causou muitas falhas de segurança. **Use sempre `===` e `!==`**, a não ser que tenha um bom motivo para o contrário.

```verificar
Qual comparação é a mais segura para conferir se $senha é igual a $digitada?
- $senha == $digitada
+ $senha === $digitada
- $senha = $digitada
> Uma delas guarda em vez de comparar, e outra converte os tipos antes de comparar.
```

## Para praticar

1. Guarde o seu nome e o ano em que nasceu em variáveis e mostre: "Fulana faz X anos em 2026."
2. Calcule o preço de um produto de R$ 80 com 15% de desconto e mostre com `number_format`.
3. Use `var_dump` para descobrir o tipo de `10 / 2` e de `10 / 4`.
