---
titulo: "Funções em PHP"
resumo: "Como criar funções, declarar os tipos do que entra e do que sai, e por que isso evita erros."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual do PHP: tipos"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/language.types.php"
  - titulo: "Manual do PHP: um tutorial simples"
    autor: "The PHP Group"
    url: "https://www.php.net/manual/pt_BR/tutorial.php"
quiz:
  - pergunta: "Qual palavra cria uma função em PHP?"
    opcoes: ["def", "function", "func"]
    resposta: 1
    explicacao: "function, seguida do nome, dos parâmetros entre parênteses e do bloco entre chaves."
  - pergunta: "Na declaração function area(float $l, float $a): float, o que significa o último float?"
    opcoes: ["O tipo do valor que a função devolve", "O tipo do primeiro parâmetro", "Nada: é um comentário"]
    resposta: 0
    explicacao: "Depois dos dois-pontos vem o tipo de retorno."
  - pergunta: "Uma variável criada fora da função pode ser usada dentro dela, sem mais nada?"
    opcoes: ["Sim", "Não: a função só enxerga os seus parâmetros e as variáveis criadas dentro dela", "Só se for um número"]
    resposta: 1
    explicacao: "Em PHP o escopo é fechado. O jeito certo de levar um valor para dentro da função é passá-lo como parâmetro."
---

## Definir e chamar

```php
<?php
function saudacao(string $nome): void
{
    echo "Bom dia, $nome!\n";
}

saudacao("Marta");
saudacao("João");
```

- `function` cria a função;
- `string $nome` é um **parâmetro**, com o tipo declarado;
- `: void` avisa que a função não devolve nada (ela só mostra algo).

A função só é executada quando é **chamada**, o que aqui acontece duas vezes.

## Devolvendo um resultado

`return` entrega o valor a quem chamou. A partir daí ele pode ser guardado, somado, comparado:

```php
<?php
function area_retangulo(float $largura, float $altura): float
{
    return $largura * $altura;
}

$sala = area_retangulo(4, 5);
$quarto = area_retangulo(3, 3);
echo "Área total: ", $sala + $quarto, " m²\n";
```

Regra prática: função que **calcula** devolve com `return`; quem decide o que mostrar na tela é o código que a chamou.

## Por que declarar os tipos

O PHP não obriga a declarar tipos, mas vale a pena. Com eles, um engano aparece na hora, com uma mensagem clara, em vez de produzir um resultado errado em silêncio:

```php
<?php
function dobro(int $n): int
{
    return $n * 2;
}

echo dobro(21), "\n";
echo dobro("abc");
```

A segunda chamada é interrompida com um `TypeError`: a função esperava um número inteiro e recebeu um texto.

```verificar
O que mostra echo dobro(dobro(3)); usando a função acima?
- 6
+ 12
- 9
> Resolva de dentro para fora: primeiro dobro(3).
```

## Valor padrão

```php
<?php
function preco_final(float $valor, float $desconto = 0): float
{
    return $valor - $valor * $desconto / 100;
}

echo preco_final(200), "\n";
echo preco_final(200, 10), "\n";
```

Se o segundo valor não for informado, vale o padrão (zero).

## Escopo: cada função na sua mesa

Diferente de outras linguagens, uma função em PHP **não enxerga** as variáveis de fora:

```php
<?php
$taxa = 10;

function com_taxa(float $valor, float $taxa): float
{
    return $valor + $valor * $taxa / 100;
}

echo com_taxa(50, $taxa);
```

O valor de `$taxa` entra na função porque foi passado como parâmetro. É o jeito certo: a função deixa claro tudo de que precisa.

## Um exemplo completo

```php
<?php
function media(array $valores): float
{
    return array_sum($valores) / count($valores);
}

function situacao(float $nota): string
{
    return $nota >= 6 ? "aprovado" : "recuperação";
}

$notas = [7.5, 4.0, 6.5];
$m = media($notas);
echo "Média ", number_format($m, 1, ","), ": ", situacao($m), "\n";
```

Cada função faz uma coisa só e tem um nome que explica o que é.

## Para praticar

1. Escreva `eh_par(int $n): bool`.
2. Escreva `maior(float $a, float $b): float` sem usar `max`.
3. Escreva `formata_reais(float $valor): string`, que devolve o valor no formato `R$ 1.234,50`.
