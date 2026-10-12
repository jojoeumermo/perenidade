---
titulo: "Margem de erro"
resumo: "O que significam os 'dois pontos para mais ou para menos', o que é empate técnico e o que a margem não cobre."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 8.3, A Population Proportion"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/8-3-a-population-proportion"
  - titulo: "Lei nº 9.504, de 30 de setembro de 1997, artigo 33 (registro das pesquisas eleitorais)"
    autor: "Brasil"
    ano: "1997"
    url: "https://www.planalto.gov.br/ccivil_03/leis/l9504.htm"
quiz:
  - pergunta: "Uma pesquisa com margem de erro de 2 pontos dá 40% a um candidato. O que isso indica?"
    opcoes: ["Que ele tem exatamente 40%", "Que, muito provavelmente, ele tem entre 38% e 42%", "Que a pesquisa errou 2%"]
    resposta: 1
    explicacao: "A margem define um intervalo em torno do resultado, dentro do qual o valor real deve estar, com o nível de confiança informado."
  - pergunta: "Com margem de 3 pontos, o candidato A tem 36% e o B tem 33%. Como descrever a situação?"
    opcoes: ["A está na frente com certeza", "Empate técnico: os intervalos se sobrepõem", "B está na frente"]
    resposta: 1
    explicacao: "A pode ter de 33% a 39%; B, de 30% a 36%. Não dá para afirmar quem lidera."
  - pergunta: "Para reduzir a margem de erro à metade, o tamanho da amostra precisa ser, aproximadamente:"
    opcoes: ["o dobro", "quatro vezes maior", "dez vezes maior"]
    resposta: 1
    explicacao: "A margem diminui com a raiz quadrada do tamanho da amostra. Metade da margem custa quatro vezes mais entrevistas."
---

## Por que existe margem

Uma amostra, por melhor que seja, não é a população. Se dois institutos sortearem duas amostras no mesmo dia, com o mesmo método, os resultados sairão um pouco diferentes, só porque as pessoas sorteadas foram outras. Essa oscilação natural é o **erro amostral**.

A **margem de erro** é o tamanho máximo esperado dessa oscilação. Ela não é um defeito da pesquisa nem uma confissão de erro: é a informação honesta sobre a precisão do resultado.

## Como ler

"O candidato tem 40%, com margem de erro de 2 pontos percentuais para mais ou para menos" significa que o valor real, na população, deve estar no **intervalo** entre 38% e 42%.

"Deve estar" com que certeza? A resposta é o **nível de confiança**, quase sempre de 95%. Ele quer dizer o seguinte: se a mesma pesquisa fosse repetida cem vezes, com cem amostras diferentes, em cerca de 95 delas o intervalo conteria o valor real. Em cerca de 5, não. Ou seja: mesmo uma pesquisa perfeitamente bem-feita erra por mais que a margem, de vez em quando.

Repare que a margem é dada em **pontos percentuais**: 40% com margem de 2 pontos vai de 38% a 42%.

## De onde vem o número

Para pesquisas com sorteio e confiança de 95%, há uma aproximação simples para a margem máxima:

**margem ≈ 1 ÷ √n**

em que n é o número de entrevistados.

| Entrevistados | Margem aproximada |
| --- | --- |
| 100 | 10 pontos |
| 400 | 5 pontos |
| 1.000 | 3,2 pontos |
| 2.000 | 2,2 pontos |
| 10.000 | 1 ponto |

Duas coisas chamam a atenção nessa tabela.

**A precisão custa caro.** Para cortar a margem pela metade, é preciso **quadruplicar** a amostra. Passar de 2.000 para 10.000 entrevistas multiplica o custo por cinco e melhora a margem em pouco mais de um ponto. Por isso a maioria das pesquisas nacionais fica entre mil e poucos milhares de entrevistas.

**O tamanho da população quase não importa.** A fórmula não tem o número de habitantes. Uma amostra de 2.000 pessoas dá praticamente a mesma margem para uma cidade de 500 mil habitantes e para um país de 200 milhões. É a colher de sopa: o que conta é o tamanho da colher e se a sopa foi bem mexida, e não o tamanho da panela.

## Empate técnico

Com margem de 3 pontos, o candidato A tem 36% e o candidato B tem 33%.

```conta
A: entre 33% e 39%
B: entre 30% e 36%
= os intervalos se sobrepõem: não dá para afirmar quem está na frente
```

Isso é o **empate técnico**. A manchete "A lidera" seria um exagero. Mas "estão empatados" também diz demais: o mais provável continua sendo que A esteja um pouco à frente. A leitura correta é que a diferença está dentro da margem.

O mesmo cuidado vale para comparar duas pesquisas seguidas. Se um candidato vai de 30% para 32% com margem de 2 pontos, a notícia "candidato cresce" pode ser só o sorteio de outra amostra. Uma tendência só aparece em **várias** pesquisas apontando na mesma direção.

```verificar
Uma pesquisa com 2.000 entrevistados tem margem de cerca de 2 pontos. O resultado só entre os jovens de 16 a 24 anos, que foram 300 dos entrevistados, tem margem:
- igual, de 2 pontos
- menor, porque o grupo é menor
+ maior, de quase 6 pontos
> A margem depende do número de entrevistados no grupo: 1 ÷ √300.
```

## A margem dos pedaços

A margem divulgada vale para o **total** da amostra. Quando a pesquisa é fatiada (só mulheres, só o Nordeste, só quem ganha até dois salários mínimos), cada fatia tem menos entrevistados e, portanto, margem **maior**. Em um grupo de 300 pessoas, ela chega perto de 6 pontos. Diferenças pequenas dentro de subgrupos quase nunca significam alguma coisa.

## O que a margem não cobre

A margem de erro mede **apenas** a oscilação do sorteio. Ela supõe que todo o resto foi bem-feito. Ficam de fora:

- uma amostra que deixou de alcançar parte da população;
- pessoas que se recusam a responder ou que não dizem o que pensam;
- perguntas mal redigidas ou tendenciosas;
- quem muda de ideia entre a pesquisa e o dia da eleição;
- quem responde, mas não vai votar.

Por isso uma pesquisa pode errar bem mais que a margem sem ter havido fraude: o erro veio de um desses pontos, e não do sorteio. E por isso uma pesquisa eleitoral é um retrato do momento em que foi feita, e não uma previsão do resultado.

## Para praticar

1. Calcule a margem aproximada de uma pesquisa com 1.600 entrevistados.
2. Com margem de 2 pontos, A tem 45% e B tem 40%. Há empate técnico?
3. Com margem de 3 pontos, A tem 28% e B tem 24%. E agora?
4. Um candidato tinha 18% e aparece com 19% na pesquisa seguinte, ambas com margem de 2 pontos. O que se pode dizer?
5. Quantas entrevistas são necessárias para uma margem de cerca de 2,5 pontos?

**Respostas:** 1) 1 ÷ 40 = 2,5 pontos. 2) Não: A fica entre 43% e 47%; B, entre 38% e 42%. 3) Sim: A pode ter de 25% a 31%; B, de 21% a 27%. 4) Que ele está estável; a variação está dentro da margem. 5) Cerca de 1.600.
