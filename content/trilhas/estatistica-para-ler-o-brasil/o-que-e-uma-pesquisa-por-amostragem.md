---
titulo: "O que é uma pesquisa por amostragem"
resumo: "Como duas mil entrevistas podem falar por milhões de pessoas, e o que separa uma pesquisa de uma enquete."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, seção 1.2, Data, Sampling, and Variation in Data and Sampling"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/1-2-data-sampling-and-variation-in-data-and-sampling"
  - titulo: "Lei nº 9.504, de 30 de setembro de 1997, artigo 33 (registro das pesquisas eleitorais)"
    autor: "Brasil"
    ano: "1997"
    url: "https://www.planalto.gov.br/ccivil_03/leis/l9504.htm"
  - titulo: "Pesquisa Nacional por Amostra de Domicílios Contínua (PNAD Contínua): o que é"
    autor: "Instituto Brasileiro de Geografia e Estatística (IBGE)"
    url: "https://www.ibge.gov.br/estatisticas/sociais/trabalho/9171-pesquisa-nacional-por-amostra-de-domicilios-continua-mensal.html"
quiz:
  - pergunta: "O que mais importa para uma amostra representar bem a população?"
    opcoes: ["Ser muito grande", "Ser escolhida de modo que todos os tipos de pessoa tenham chance de entrar", "Ser feita pela internet"]
    resposta: 1
    explicacao: "Uma amostra enorme e enviesada erra com muita convicção. O modo de escolher pesa mais que o tamanho."
  - pergunta: "Por que uma enquete em rede social não é uma pesquisa?"
    opcoes: ["Porque tem poucas respostas", "Porque só responde quem viu, quis e pôde responder", "Porque é gratuita"]
    resposta: 1
    explicacao: "Os participantes escolhem a si mesmos. Não representam quem não segue aquele perfil nem quem não usa a rede."
  - pergunta: "Pela lei eleitoral, uma pesquisa eleitoral feita para divulgação precisa ser registrada na Justiça Eleitoral informando, entre outras coisas:"
    opcoes: ["quem contratou e quanto custou", "o nome dos entrevistados", "em quem o dono do instituto vota"]
    resposta: 0
    explicacao: "O artigo 33 da Lei nº 9.504 exige, entre outros itens, o contratante, o valor e a origem dos recursos, a metodologia e o plano amostral."
---

## A colher de sopa

Para saber se a sopa está boa de sal, ninguém toma a panela inteira. Mexe-se bem e prova-se uma colher. Se a sopa foi bem mexida, a colher basta, seja a panela pequena ou um caldeirão.

Uma **pesquisa por amostragem** faz o mesmo com gente:

- a **população** é o conjunto todo que se quer conhecer (os eleitores do país, os trabalhadores de uma cidade);
- a **amostra** é a parte que de fato é entrevistada;
- "mexer bem a sopa" é escolher a amostra de modo que ela se pareça com a população.

Entrevistar todo mundo é um **censo**: caro, demorado e feito raramente. O assunto da aula [O Censo](/trilhas/estatistica-para-ler-o-brasil/o-censo).

## Sorteio: o segredo

O melhor jeito de conseguir uma amostra parecida com a população é o **sorteio**. Em uma amostra aleatória, toda pessoa tem uma chance conhecida de ser escolhida, e ninguém entra porque quis ou porque era fácil de achar.

O sorteio tem uma vantagem que nenhum outro método tem: permite **calcular o tamanho provável do erro**. É de onde vem a [margem de erro](/trilhas/estatistica-para-ler-o-brasil/margem-de-erro).

Na prática, sortear pessoas uma a uma em um país inteiro é inviável. Os institutos sorteiam em etapas (municípios, depois setores, depois domicílios) e ajustam os resultados para que a amostra tenha as mesmas proporções da população em sexo, idade, escolaridade e região.

## Tamanho não é documento

Em 1936, a revista americana *Literary Digest* fez uma das maiores pesquisas eleitorais da história: enviou milhões de cédulas pelo correio e recebeu mais de dois milhões de respostas. Previu a vitória folgada de Alf Landon. Quem venceu, com larga vantagem, foi Franklin Roosevelt. No mesmo ano, o instituto de George Gallup acertou o vencedor com uma amostra de dezenas de milhares de pessoas, uma pequena fração daquela.

O erro da revista: os endereços vinham de listas de assinantes, de donos de telefone e de proprietários de automóvel, em plena crise econômica. A amostra era gigantesca e composta de gente mais rica que a média. Além disso, só respondeu quem quis.

A lição vale até hoje: **uma amostra grande e enviesada erra com muita convicção**. Aumentar o tamanho não corrige o viés.

## Os vieses mais comuns

- **Viés de seleção:** a amostra deixa de fora uma parte da população. Uma pesquisa por telefone fixo não alcança quem não tem telefone fixo; uma pesquisa feita às três da tarde em um shopping não alcança quem está trabalhando.
- **Autosseleção:** as pessoas decidem se participam. É o caso das enquetes de internet, de rádio e de televisão.
- **Não resposta:** quem se recusa a responder pode ser diferente de quem aceita.
- **A pergunta:** a redação muda a resposta. "Você é a favor de ajudar os mais pobres?" e "Você é a favor de aumentar os gastos do governo?" podem estar falando do mesmo programa.
- **A ordem:** perguntar sobre a violência antes de perguntar sobre o governo muda a avaliação do governo.

```verificar
Um portal de notícias publica: 'Enquete com 200 mil votos mostra que 80% dos brasileiros apoiam a medida'. Qual é o problema?
- Duzentos mil votos é pouco
+ Quem votou foram os leitores daquele portal que quiseram votar, e não uma amostra dos brasileiros
- Nenhum: com tantos votos, o resultado é confiável
> Lembre-se da revista de 1936.
```

## Uma pesquisa do IBGE por dentro

A taxa de desocupação que sai no noticiário vem da **PNAD Contínua**, a Pesquisa Nacional por Amostra de Domicílios Contínua, do IBGE. Ela existe em caráter definitivo desde janeiro de 2012 e tem o domicílio como unidade de investigação. É uma pesquisa por amostragem probabilística: os domicílios visitados são sorteados, e a amostra foi planejada para produzir resultados para o Brasil, as grandes regiões, os estados, as regiões metropolitanas das capitais e as próprias capitais. Os moradores respondem sobre trabalho, rendimento e outros temas.

Um detalhe útil para ler notícias: os números **mensais** da pesquisa não retratam um mês isolado, e sim o **trimestre móvel** que termina naquele mês. O resultado "de agosto" resume junho, julho e agosto.

## A pesquisa eleitoral e a lei

A Lei das Eleições (nº 9.504, de 1997), no artigo 33, obriga quem faz pesquisa eleitoral para divulgação a registrá-la na Justiça Eleitoral até cinco dias antes de divulgar. O registro tem de informar, entre outras coisas:

- quem contratou a pesquisa;
- o valor e a origem dos recursos;
- a metodologia e o período de realização;
- o plano amostral e a ponderação por sexo, idade, grau de instrução, nível econômico e área;
- o intervalo de confiança e a margem de erro;
- o questionário completo.

Esses registros são públicos e podem ser consultados no site da Justiça Eleitoral. Antes de confiar em uma pesquisa (ou de desconfiar dela), vale ver quem pagou, quantas pessoas foram ouvidas, quando, onde e com que perguntas.

## Para conversar

Organize uma pequena pesquisa no seu bairro, na sua escola ou no seu local de trabalho. Quem é a população? Como sortear a amostra em vez de perguntar só aos conhecidos? Que pergunta você faria, e de que outro jeito ela poderia ser redigida?

## Para praticar

1. Uma rádio pede que os ouvintes liguem para dizer se aprovam o prefeito. Que vieses há nesse método?
2. Um instituto entrevista 2.000 pessoas apenas nas capitais e divulga o resultado como "opinião dos brasileiros". Qual é o problema?
3. Reescreva de modo neutro: "Você concorda que os vândalos que fecharam a avenida devem ser punidos?"

**Respostas:** 1) Autosseleção (liga quem quer e quem pode) e seleção (só os ouvintes daquela rádio, naquele horário). 2) Viés de seleção: quem mora fora das capitais não teve chance de entrar. 3) Por exemplo: "Qual é a sua opinião sobre a manifestação que interrompeu o trânsito na avenida?"
