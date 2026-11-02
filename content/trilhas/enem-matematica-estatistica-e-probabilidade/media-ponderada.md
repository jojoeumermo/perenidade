---
titulo: "Média ponderada"
resumo: "Quando cada valor pesa diferente: notas com peso, preço médio de compras, média de grupos de tamanhos diferentes e a nota que falta para chegar lá."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 2.5, Measures of the Center of the Data"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/2-5-measures-of-the-center-of-the-data"
  - titulo: "Índice Nacional de Preços ao Consumidor Amplo (IPCA): o que é"
    autor: "IBGE"
    url: "https://www.ibge.gov.br/explica/inflacao.php"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Você comprou 2 kg de feijão a R$ 8,00 o quilo e 3 kg a R$ 10,00 o quilo. Qual foi o preço médio do quilo?"
    opcoes: ["R$ 9,00", "R$ 9,20", "R$ 8,80", "R$ 18,00"]
    resposta: 1
    explicacao: "Gasto total: 2 × 8 + 3 × 10 = 16 + 30 = 46 reais por 5 kg. Preço médio: 46 ÷ 5 = R$ 9,20. Os R$ 9,00 da média simples esquecem que você comprou mais quilos do feijão caro."
  - pergunta: "Uma prova vale peso 1 e outra vale peso 2. Uma estudante tirou 6 na primeira e 9 na segunda. Qual é a média ponderada?"
    opcoes: ["7,5", "7", "9", "8"]
    resposta: 3
    explicacao: "(6 × 1 + 9 × 2) ÷ (1 + 2) = (6 + 18) ÷ 3 = 24 ÷ 3 = 8. A nota de peso maior puxou a média para perto dela."
  - pergunta: "Uma turma de 20 estudantes teve média 6 e outra, de 30 estudantes, teve média 8. Qual é a média das duas turmas juntas?"
    opcoes: ["7,2", "7", "7,5", "14"]
    resposta: 0
    explicacao: "Some os pontos: 20 × 6 = 120 e 30 × 8 = 240, total 360. Divida pelos 50 estudantes: 360 ÷ 50 = 7,2. A média das médias (7) esquece que a segunda turma é maior."
  - pergunta: "Numa média ponderada, o valor com o maior peso:"
    opcoes: ["vale menos na conta", "é ignorado se for o maior", "puxa a média para perto dele", "é dividido pelo próprio peso"]
    resposta: 2
    explicacao: "O peso diz quantas vezes o valor conta. Quanto maior o peso, mais a média se aproxima daquele valor."
---

```provocacao
No começo do mês você comprou 2 kg de feijão a R$ 8,00 o quilo. No fim do mês, o preço subiu, e você comprou mais 3 kg a R$ 10,00. Quanto você pagou, em média, por quilo? Será que é só fazer (8 + 10) ÷ 2?
```

## O que você vai aprender

Ao fim desta aula você vai saber calcular uma média ponderada, reconhecer quando ela é a média certa (notas com peso, compras em quantidades diferentes, grupos de tamanhos diferentes) e achar o valor que falta para chegar a uma média com pesos.

## Quando nem todo valor conta igual

Na média simples, cada valor conta uma vez. Mas há situações em que um valor deve contar mais que outro:

- uma prova vale mais que um trabalho;
- você comprou mais quilos de um produto que de outro;
- uma turma tem mais estudantes que a outra.

Nesses casos, cada valor ganha um **peso**: um número que diz quantas vezes ele conta. A média que leva os pesos em conta se chama **média ponderada**. "Ponderar" quer dizer pesar.

```formula
média ponderada = (v₁ · p₁ + v₂ · p₂ + …) ÷ (p₁ + p₂ + …)
multiplique cada valor pelo seu peso e some tudo
depois divida pela soma dos pesos, e não pela quantidade de valores
```

O erro mais comum é dividir pela quantidade de valores em vez da soma dos pesos. Se há três notas com pesos 2, 1 e 1, a divisão é por 4, não por 3.

## Peso como quantidade

Volte à provocação. Você não comprou "um feijão de 8 e um de 10". Você comprou 2 quilos de um e 3 quilos do outro. O peso de cada preço é a quantidade comprada.

Gasto total: 2 × 8 + 3 × 10 = 16 + 30 = 46 reais. Quilos comprados: 2 + 3 = 5. Preço médio: 46 ÷ 5 = R$ 9,20.

A média simples daria R$ 9,00. Ela erra porque trata as duas compras como iguais. Como você comprou mais quilos do feijão caro, o preço médio fica mais perto de 10.

Um teste rápido: a média ponderada sempre fica **entre** o menor e o maior valor, e **mais perto** do valor de peso maior. Se a sua conta der fora disso, algo saiu errado.

## Grupos de tamanhos diferentes

Duas turmas fizeram a mesma prova. A turma da manhã, com 10 estudantes, teve média 9. A da noite, com 40, teve média 6. Qual é a média de todos?

A tentação é fazer (9 + 6) ÷ 2 = 7,5. Mas a turma da noite tem quatro vezes mais gente. O peso de cada média é o tamanho da turma:

(10 × 9 + 40 × 6) ÷ 50 = (90 + 240) ÷ 50 = 330 ÷ 50 = 6,6.

**Média de médias só vale quando os grupos têm o mesmo tamanho.** Se não têm, volte às somas: média vezes quantidade dá a soma de cada grupo.

## Peso em porcentagem

Às vezes os pesos vêm em porcentagem e somam 100%. Escritos em decimal, eles somam 1. Então a divisão final é por 1, e a conta fica mais curta: basta multiplicar e somar.

É assim, por exemplo, que se pensa a inflação de uma família. Se 40% do gasto vai para comida, que subiu 5%, e 60% vai para o resto, que subiu 2%, o aumento médio é 0,4 × 5 + 0,6 × 2 = 2 + 1,2 = 3,2%.

O IBGE calcula o IPCA, o índice oficial de inflação do país, com essa ideia: cada grupo de produtos e serviços tem um peso, de acordo com quanto as famílias gastam com ele.

## O valor que falta

Uma pergunta frequente: "quanto preciso tirar na última prova para chegar à média?". O caminho é sempre o mesmo:

1. Escreva a média ponderada com a nota que falta como incógnita (um valor desconhecido, que se chama, por exemplo, x).
2. Multiplique a média desejada pela soma dos pesos. Isso dá a soma ponderada necessária.
3. Tire o que você já tem e divida pelo peso da nota que falta.

```navidareal
A média ponderada aparece em muitos processos seletivos: cada prova tem um peso, e o peso muda conforme o curso. Saber fazer essa conta ajuda a decidir onde concentrar o estudo. Uma prova de peso 3 vale três vezes mais que uma de peso 1.

Antes de se inscrever em qualquer seleção, procure no edital os pesos de cada prova e faça a conta com as suas notas de treino.
```

```verificar
Duas turmas fizeram a mesma prova. A da manhã tem 10 estudantes e média 9. A da noite tem 40 e média 6. Qual é a média das duas turmas juntas?
- 7,5
+ 6,6
- 8,4
> A média das médias (7,5) esquece que a noite tem quatro vezes mais gente. Some os pontos: 10 × 9 + 40 × 6 = 330. Divida por 50: 6,6.
```

## Exemplo resolvido

**Numa seleção para um curso técnico, a nota final é a média ponderada de três provas: português com peso 3, matemática com peso 2 e redação com peso 5. Uma candidata tirou 7, 5 e 8. Qual é a nota final dela?**

1. Multiplique cada nota pelo peso: português 7 × 3 = 21; matemática 5 × 2 = 10; redação 8 × 5 = 40.
2. Some: 21 + 10 + 40 = 71.
3. Some os pesos: 3 + 2 + 5 = 10.
4. Divida: 71 ÷ 10 = 7,1.

Confira: a média simples seria (7 + 5 + 8) ÷ 3, perto de 6,7. A ponderada ficou maior porque a redação, a melhor nota dela, tem o maior peso. E 7,1 está entre 5 e 8, como deve ser.

## Como isso cai no ENEM

- **Formatos:** notas com pesos num processo seletivo ou num concurso; preço médio de compras em quantidades diferentes; média de grupos de tamanhos diferentes; índices formados por partes com pesos. A questão pede a média, compara candidatos ou pede a nota que falta.
- **Habilidades:** H27 (calcular médias, moda, mediana ou dispersão de dados em tabelas de frequência ou gráficos) e H28 (resolver problemas de estatística e probabilidade).
- **O que mais caiu:** nas provas de 2022 e 2023, classificadas pelo instituto, de 81 questões de Matemática, 2 (2,5%) foram de média ponderada. A H27 teve 7 questões (8,6%), somando todas as medidas. São só duas provas: é uma tendência, não uma promessa.
- **Armadilhas:**
  - Dividir pela quantidade de valores, e não pela soma dos pesos.
  - Fazer média de médias com grupos de tamanhos diferentes.
  - Trocar os pesos entre os valores.
  - No preço médio, usar como peso o dinheiro gasto quando o certo é a quantidade comprada (ou o contrário). Pergunte: "média de quê, por quê?". Preço médio por quilo é o total gasto dividido pelo total de quilos.

## Questão comentada

**Texto-base.** Um curso técnico seleciona os candidatos por uma média ponderada: a prova objetiva tem peso 3 e a redação tem peso 2. É aprovado quem tem média igual ou maior que 6,0. Uma candidata tirou 5,0 na prova objetiva e ainda não sabe a nota da redação.

**Comando.** Para ser aprovada, a nota mínima que ela precisa tirar na redação é

A) 6,0.
B) 7,0.
C) 7,5.
D) 15,0.
E) 6,7.

**Resolução.**

1. Soma dos pesos: 3 + 2 = 5. Para a média ser 6,0, a soma ponderada precisa ser 6 × 5 = 30.
2. A prova objetiva já dá 5 × 3 = 15.
3. Falta 30 − 15 = 15, que precisa vir da redação. Como a redação tem peso 2, a nota é 15 ÷ 2 = 7,5.

Confira: (5 × 3 + 7,5 × 2) ÷ 5 = (15 + 15) ÷ 5 = 6,0.

**Gabarito: C.**

**Por que as outras não:**

- A) 6,0 é a própria média exigida. Como a nota da objetiva ficou abaixo de 6, a redação tem de compensar.
- B) 7,0 sai da média simples ((5 + x) ÷ 2 = 6). Mas a objetiva pesa mais, e a nota baixa dela pesa mais também.
- D) 15 é o que a redação precisa somar já multiplicada pelo peso. Falta dividir pelo peso 2.
- E) Perto de 6,7 é o que sai trocando os pesos (redação com peso 3). Confira no texto: a objetiva tem peso 3.

```realidade
Pense numa seleção que você quer fazer (um curso, um concurso, um vestibular). Procure no edital os pesos de cada prova. Com as suas notas de um simulado, calcule a sua média ponderada. Em que prova um ponto a mais faria mais diferença?
```

## Resumo

- Média ponderada: multiplique cada valor pelo peso, some e divida pela soma dos pesos.
- O resultado fica entre o menor e o maior valor, mais perto do valor de peso maior.
- Média de médias só vale para grupos do mesmo tamanho; senão, volte às somas.
- Preço médio = total gasto ÷ total de unidades compradas.
- Para o valor que falta: média desejada × soma dos pesos, menos o que já tem, dividido pelo peso que falta.

## Para aprofundar

- [Estatística: média, mediana e moda](/trilhas/matematica-medio/estatistica-media-mediana-e-moda)
- [Inflação: o que é o IPCA](/trilhas/estatistica-para-ler-o-brasil/inflacao-o-que-e-o-ipca)
- [Média, mediana e moda (para ler o Brasil)](/trilhas/estatistica-para-ler-o-brasil/media-mediana-e-moda)
- [Porcentagem](/trilhas/matematica-fundamental/porcentagem)
