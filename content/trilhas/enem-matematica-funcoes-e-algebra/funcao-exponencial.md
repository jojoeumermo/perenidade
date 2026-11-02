---
titulo: "Função exponencial"
resumo: "Quando uma grandeza é multiplicada pelo mesmo fator a cada período: crescimento que dispara, decaimento pela metade, juros compostos e o gráfico de cada um."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem"
    autor: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (Inep)"
  - titulo: "Algebra and Trigonometry 2e, seção 6.1, Exponential Functions"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/6-1-exponential-functions"
  - titulo: "Algebra and Trigonometry 2e, seção 13.3, Geometric Sequences"
    autor: "Jay Abramson e outros (OpenStax)"
    ano: "2021"
    url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/13-3-geometric-sequences"
quiz:
  - pergunta: "Se f(x) = 3 · 2ˣ, quanto vale f(4)?"
    opcoes: ["24", "1.296", "48", "14"]
    resposta: 2
    explicacao: "Primeiro a potência: 2⁴ = 16. Depois a multiplicação: 3 × 16 = 48. Quem marca 24 fez 3 × 2 × 4; quem marca 1.296 fez (3 × 2)⁴."
  - pergunta: "Qual destas leis descreve uma grandeza que diminui 20% a cada ano?"
    opcoes: ["f(x) = 100 · 0,8ˣ", "f(x) = 100 · 1,2ˣ", "f(x) = 100 − 0,2x", "f(x) = 0,8 · 100ˣ"]
    resposta: 0
    explicacao: "Perder 20% é ficar com 80%: a cada ano, multiplica-se por 0,8. Então f(x) = 100 · 0,8ˣ. O fator 1,2 seria aumento de 20%."
  - pergunta: "Qual é o valor de x em 2ˣ = 64?"
    opcoes: ["32", "6", "8", "5"]
    resposta: 1
    explicacao: "Escreva 64 como potência de 2: 2, 4, 8, 16, 32, 64. São seis fatores 2: 64 = 2⁶, então x = 6."
  - pergunta: "Uma aplicação de R$ 2.000,00 rende 10% ao ano, a juros compostos. Quanto haverá depois de 2 anos?"
    opcoes: ["R$ 2.400,00", "R$ 2.200,00", "R$ 2.020,00", "R$ 2.420,00"]
    resposta: 3
    explicacao: "Juros compostos multiplicam: 2.000 × 1,1 × 1,1 = 2.000 × 1,21 = 2.420. Quem marca R$ 2.400 usou juros simples."
---

```provocacao
Num lago, uma planta aquática cobre uma área que dobra todo dia. No 30º dia, ela cobre o lago inteiro. Em que dia ela cobria a metade do lago?
```

## O que você vai aprender

Ao fim desta aula você vai reconhecer uma função exponencial, separar crescimento de decaimento pelo fator, calcular juros compostos e meias-vidas, ler o gráfico pela tabela e resolver equações exponenciais simples, igualando as bases.

## Somar ou multiplicar

Compare duas pessoas que começam com R$ 100. A primeira ganha R$ 50 por mês. A segunda tem o dinheiro multiplicado por 1,5 a cada mês.

| mês | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| soma 50 (R$) | 100 | 150 | 200 | 250 | 300 | 350 |
| multiplica por 1,5 (R$) | 100 | 150 | 225 | 337,50 | 506,25 | 759,38 |

No primeiro mês, as duas estão iguais. Depois, a segunda dispara. A primeira é uma função afim: soma sempre o mesmo. A segunda é uma **função exponencial**: multiplica sempre pelo mesmo. (O último valor foi arredondado para centavos.)

```formula
f(x) = a · bˣ
a é o valor inicial, quanto a grandeza vale quando x = 0
b é o fator: o número pelo qual se multiplica a cada período; ele é positivo e diferente de 1
se b > 1, a grandeza cresce; se b está entre 0 e 1, ela diminui
```

Na tabela, a = 100 e b = 1,5: f(x) = 100 · 1,5ˣ. Atenção à ordem das contas: primeiro a potência, depois a multiplicação. Com x = 2, f(2) = 100 × 2,25 = 225.

## Taxa em porcentagem vira fator

Na vida real, o fator quase sempre vem disfarçado de porcentagem.

- Crescer 20% por período: multiplicar por 1 + 0,2 = 1,2.
- Diminuir 20% por período: multiplicar por 1 − 0,2 = 0,8.
- Dobrar: multiplicar por 2. Cair pela metade: multiplicar por 0,5.

É por isso que os **juros compostos** são uma função exponencial. Um valor C aplicado à taxa i por período vira, depois de t períodos:

```formula
M = C · (1 + i)ᵗ
o montante é o capital vezes um mais a taxa, elevado ao número de períodos
a taxa vai em número decimal: 3% ao mês vira 0,03
```

Nos juros simples, o juro de cada mês é sempre calculado sobre o valor inicial. Nos compostos, é calculado sobre o valor que já cresceu. Por isso, com o tempo, os compostos ficam muito maiores.

## Decaimento e meia-vida

Quando o fator está entre 0 e 1, a grandeza diminui, mas nunca chega exatamente a zero. Isso descreve, por exemplo, o valor de um carro que perde uma porcentagem por ano, ou uma substância que o corpo elimina aos poucos.

A **meia-vida** é o tempo para a quantidade cair pela metade. Se uma substância tem meia-vida de 6 horas (é um exemplo), a cada 6 horas ela é multiplicada por 1/2. Com 80 mg no começo:

| horas | 0 | 6 | 12 | 18 | 24 |
| --- | --- | --- | --- | --- | --- |
| quantidade (mg) | 80 | 40 | 20 | 10 | 5 |

Em palavras: o gráfico começa em 80, cai muito no começo e depois cada vez menos, chegando perto do eixo horizontal sem nunca tocá-lo. A lei é Q(t) = 80 · (1/2)^(t/6). O expoente é t ÷ 6 porque o fator vale a cada 6 horas, não a cada hora.

```verificar
Uma substância tem meia-vida de 6 horas. Havia 80 mg. Quanto resta depois de 18 horas?
- 40 mg
+ 10 mg
- 20 mg
> 18 horas são 3 meias-vidas: 80 → 40 → 20 → 10. Quem marca 20 parou em 12 horas.
```

## O gráfico da exponencial

Três fatos ajudam a reconhecer o gráfico:

1. Ele corta o eixo vertical no valor inicial a, porque b⁰ = 1.
2. Com b > 1, a curva sobe devagar e depois cada vez mais rápido. Com b entre 0 e 1, ela desce rápido e depois cada vez mais devagar.
3. Ela nunca toca o eixo horizontal: multiplicar um número positivo nunca dá zero.

Uma reta sobe sempre o mesmo tanto a cada passo. A exponencial sobe sempre a mesma **proporção** a cada passo. Na tabela, isso aparece assim: na afim, as diferenças são iguais; na exponencial, os quocientes são iguais.

## Equações exponenciais

Para achar o tempo numa exponencial, a ideia é escrever os dois lados como potências da mesma base. Se 2ˣ = 32, como 32 = 2⁵, então x = 5.

Exemplo: um vídeo teve 500 visualizações no primeiro dia e o número dobra a cada dia: V(d) = 500 · 2ᵈ. Quando chega a 16.000? Divida: 16.000 ÷ 500 = 32 = 2⁵. Então d = 5 dias. Quando não dá para igualar as bases, entra o logaritmo, assunto da próxima aula.

```navidareal
Volte ao lago da provocação. Se a planta dobra todo dia e cobre o lago no 30º dia, então no 29º dia ela cobria a metade. O lago passa de "metade" para "cheio" em um único dia.

É assim com uma dívida que cresce por juros compostos, com uma doença que se espalha sem controle ou com um boato nas redes: durante muito tempo parece pouco, e de repente vira muito. Quem só olha os primeiros dias acha que dá tempo. A matemática da exponencial mostra que agir cedo faz toda a diferença.
```

## Exemplo resolvido

**Uma pessoa deixou de pagar uma dívida de R$ 1.000,00 que cresce 10% ao mês, a juros compostos (é um exemplo de taxa). Quanto ela deve depois de 3 meses? E quanto deveria se os juros fossem simples?**

1. O fator mensal é 1 + 0,1 = 1,1.
2. Mês a mês: 1.000 × 1,1 = 1.100; 1.100 × 1,1 = 1.210; 1.210 × 1,1 = 1.331.
3. Pela fórmula: M = 1.000 × 1,1³ = 1.000 × 1,331 = R$ 1.331,00.
4. Com juros simples, cada mês teria R$ 100 de juros: 1.000 + 3 × 100 = R$ 1.300,00.

Confira: a diferença, R$ 31,00, são os juros sobre os juros. Em 3 meses parece pouco; em 12 meses, 1,1¹² passa de 3: a dívida mais que triplica.

## Como isso cai no ENEM

- **Formatos:** crescimento de populações, de bactérias ou de usuários; juros compostos e depreciação; meia-vida de medicamentos e de substâncias radioativas; comparação entre um crescimento linear e um exponencial; uma tabela ou um gráfico para reconhecer o tipo de crescimento. Muitas vezes o enunciado dá o valor de uma potência para a conta sair sem calculadora.
- **Habilidades:** H21 (resolver problemas cuja modelagem pede álgebra), H19 (identificar a expressão algébrica que traduz a relação entre grandezas), H20 (interpretar gráficos cartesianos que relacionam grandezas), H22 (usar álgebra para construir argumentos) e H23 (avaliar propostas de intervenção usando álgebra). Nas provas de 2022 e 2023, classificadas pelo instituto, a função exponencial foi o tópico de 1 das 81 questões de Matemática (1,2%). Na área inteira, a H21 apareceu em 7 dessas 81 questões. São só duas provas: é tendência, não promessa, e o assunto também aparece dentro de juros compostos e progressões.
- **Armadilhas:**
  - Multiplicar antes de fazer a potência: 3 · 2⁴ é 3 × 16, não 6⁴.
  - Somar a taxa em vez de multiplicar pelo fator (usar juros simples quando são compostos).
  - Usar 0,2 em vez de 0,8 para uma queda de 20%.
  - Esquecer que o período pode não ser 1: se dobra a cada 5 dias, o expoente é t ÷ 5.
  - Contar um período a mais ou a menos. Faça a tabela dos primeiros períodos para conferir.

## Questão comentada

**Texto-base.** Num laboratório de uma universidade pública, uma cultura começou com 500 bactérias. Nas condições do experimento, o número de bactérias triplica a cada 2 horas, de modo que, depois de t horas, há N(t) = 500 · 3^(t/2) bactérias.

**Comando.** Depois de 8 horas de experimento, o número de bactérias na cultura será

A) 12.000.
B) 40.500.
C) 3.280.500.
D) 13.500.
E) 6.000.

**Resolução.**

1. Em 8 horas há 8 ÷ 2 = 4 períodos de triplicação. O expoente é 4.
2. 3⁴ = 3 × 3 × 3 × 3 = 81.
3. N(8) = 500 × 81 = 40.500.
4. Conferência pela tabela: 500 (0 h), 1.500 (2 h), 4.500 (4 h), 13.500 (6 h), 40.500 (8 h).

**Gabarito: B.**

**Por que as outras não:**

- A) 12.000: foi feito 500 × 3 × 8, multiplicando pelo tempo. Na exponencial, o número de períodos vai no expoente.
- C) 3.280.500: o expoente ficou 8, sem dividir por 2. Mas a triplicação acontece a cada 2 horas: 500 × 3⁸ seria triplicar toda hora.
- D) 13.500: esse é o número depois de 6 horas, com 3 períodos. Em 8 horas são 4.
- E) 6.000: foi feito 500 × 3 × 4, multiplicando pelo número de períodos. Cada período multiplica por 3 de novo: 3 × 3 × 3 × 3.

```realidade
Procure no seu carnê, na fatura do cartão ou num contrato de empréstimo a taxa de juros ao mês. Calcule quanto uma dívida de R$ 100 viraria em 3 meses com essa taxa, a juros compostos. Compare com o que seria a juros simples.
```

## Resumo

- Função exponencial: f(x) = a · bˣ. O a é o valor inicial; o b é o fator por período.
- b > 1, crescimento; b entre 0 e 1, decaimento. Aumentar i% é multiplicar por (1 + i); diminuir, por (1 − i).
- Juros compostos: M = C · (1 + i)ᵗ.
- Meia-vida: a cada período, a quantidade é multiplicada por 1/2.
- O gráfico corta o eixo vertical em a e nunca toca o eixo horizontal.
- Na tabela: afim tem diferenças iguais; exponencial tem quocientes iguais.
- Equação exponencial: escreva os dois lados com a mesma base e iguale os expoentes.

## Para aprofundar

- [Exponencial e logaritmo](/trilhas/matematica-medio/exponencial-e-logaritmo)
- [Juros simples e compostos](/trilhas/matematica-medio/juros-simples-e-compostos)
- [Potências e raízes](/trilhas/matematica-fundamental/potencias-e-raizes)
- [Progressões aritméticas e geométricas](/trilhas/enem-matematica-funcoes-e-algebra/progressoes)
- [Logaritmos e escalas logarítmicas](/trilhas/enem-matematica-funcoes-e-algebra/logaritmos)
