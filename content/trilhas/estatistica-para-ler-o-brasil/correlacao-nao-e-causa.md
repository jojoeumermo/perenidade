---
titulo: "Correlação não é causa"
resumo: "Duas coisas que andam juntas nem sempre têm relação de causa e efeito: como reconhecer a armadilha e o que é preciso para provar uma causa."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Introductory Statistics 2e, capítulo 12, Linear Regression and Correlation"
    autor: "Barbara Illowsky, Susan Dean e outros (OpenStax)"
    ano: "2023"
    url: "https://openstax.org/books/introductory-statistics-2e/pages/12-introduction"
  - titulo: "Como mentir com estatística"
    autor: "Darrell Huff"
    ano: "1954"
  - titulo: "Spurious Correlations"
    autor: "Tyler Vigen"
    url: "https://www.tylervigen.com/spurious-correlations"
  - titulo: "Smoking and Carcinoma of the Lung: Preliminary Report (British Medical Journal)"
    autor: "Richard Doll e Austin Bradford Hill"
    ano: "1950"
quiz:
  - pergunta: "Nos meses em que se vende mais sorvete, há mais afogamentos. Qual é a explicação mais provável?"
    opcoes: ["Sorvete causa afogamento", "Uma terceira causa, o calor, aumenta as duas coisas", "Afogamento faz vender sorvete"]
    resposta: 1
    explicacao: "No verão, mais gente toma sorvete e mais gente entra na água. As duas coisas têm uma causa comum."
  - pergunta: "Bairros com mais viaturas de polícia registram mais crimes. Pode-se concluir que a polícia causa crime?"
    opcoes: ["Sim", "Não: é mais provável que as viaturas sejam enviadas aonde há mais ocorrências", "Sim, se a correlação for forte"]
    resposta: 1
    explicacao: "A relação de causa pode correr no sentido contrário ao que a frase sugere."
  - pergunta: "Qual é o método mais seguro para mostrar que um tratamento causa um efeito?"
    opcoes: ["Perguntar a quem usou se melhorou", "Sortear quem recebe e quem não recebe o tratamento e comparar os dois grupos", "Ver se as vendas do tratamento aumentaram"]
    resposta: 1
    explicacao: "O sorteio faz com que os dois grupos sejam parecidos em tudo, menos no tratamento."
---

## Andar junto

Duas grandezas têm **correlação** quando variam juntas. Quando uma sobe e a outra também sobe, a correlação é positiva (altura e peso). Quando uma sobe e a outra desce, é negativa (preço e quantidade vendida).

Os estatísticos medem a força dessa ligação com o **coeficiente de correlação**, um número que vai de −1 a 1. Perto de 1 ou de −1, os pontos de um gráfico se alinham quase perfeitamente; perto de 0, formam uma nuvem sem direção.

A correlação é um fato sobre os dados. A armadilha é o passo seguinte: concluir que **uma coisa causa a outra**. Há pelo menos quatro outras explicações possíveis.

## 1. A terceira causa

Nos meses em que se vende mais sorvete, há mais afogamentos. Ninguém conclui que sorvete afoga: é o **calor** que leva as pessoas à sorveteria e à praia. Um fator escondido que move as duas coisas é chamado de **variável de confusão**.

Outros exemplos:

- Crianças com pés maiores leem melhor. A terceira causa é a idade.
- Cidades com mais igrejas têm mais bares. A terceira causa é o tamanho da população.
- Quem toma café da manhã tem notas melhores. Pode ser o café; pode ser que as famílias com mais renda e mais tempo sirvam café da manhã **e** deem mais apoio escolar.

O último caso mostra por que isso importa. Quase tudo o que acompanha a renda (saúde, escolaridade, tipo de bairro, alimentação) aparece correlacionado entre si. Sem considerar a renda, qualquer hábito das famílias mais ricas parece "causar" bons resultados.

## 2. A causa ao contrário

Bairros com mais viaturas de polícia registram mais crimes. A polícia causa crime? É mais razoável o contrário: as viaturas são enviadas aonde há mais ocorrências.

Pessoas que fazem dieta pesam mais que a média. A dieta engorda? Quem está acima do peso é quem mais faz dieta.

Sempre que ouvir "A causa B", teste a frase invertida: **será que B causa A?**

## 3. A coincidência

Com dados suficientes, sempre se acham duas séries que sobem e descem juntas por puro acaso. O americano Tyler Vigen mantém uma coleção delas, *Spurious Correlations* ("correlações espúrias"), feita com dados reais: séries sem nenhuma relação entre si, como o consumo de um alimento e o número de diplomas em uma área, que coincidem quase perfeitamente durante anos.

Quanto mais variáveis se cruzam, mais coincidências aparecem. Quem procura uma correlação em um banco de dados enorme, sem ter uma hipótese antes, sempre encontra alguma.

## 4. A seleção

Às vezes a correlação é criada pelo modo como os casos foram escolhidos.

"Todos os empresários de sucesso que entrevistei largaram a faculdade." Faltou entrevistar os que largaram a faculdade e não tiveram sucesso: eles não dão palestra. Olhar só para os que "sobreviveram" a um filtro é o **viés de sobrevivência**. É a base de boa parte dos discursos sobre mérito e esforço.

```verificar
Um estudo mostra que pessoas que frequentam academia têm salários maiores. Um anúncio conclui: 'Malhe e ganhe mais!'. Qual é a falha mais provável?
+ Quem ganha mais tem dinheiro e tempo para pagar academia
- A amostra é pequena
- Academia diminui o salário
> Teste a causa ao contrário e procure uma terceira causa.
```

## Então, como se prova uma causa?

O método mais seguro é o **experimento com sorteio**. Para testar um remédio, sorteia-se quem recebe o remédio e quem recebe uma substância sem efeito (o placebo). Como o sorteio distribui ao acaso a idade, a renda, os hábitos e tudo o mais, os dois grupos ficam parecidos em tudo, menos no tratamento. Se o resultado for diferente, a causa é o tratamento.

Nem sempre dá para sortear. Não se pode obrigar um grupo a fumar por trinta anos, nem sortear quais crianças serão pobres. Nesses casos, a causa é estabelecida aos poucos, reunindo indícios:

- a correlação aparece em **muitos estudos**, com populações e métodos diferentes;
- quanto maior a dose, maior o efeito;
- a causa vem **antes** do efeito;
- as outras explicações (renda, idade, ocupação) foram consideradas e descartadas;
- existe um **mecanismo** que explica como uma coisa produz a outra.

Foi assim com o cigarro. Em 1950, os pesquisadores britânicos Richard Doll e Austin Bradford Hill publicaram um estudo mostrando forte associação entre o fumo e o câncer de pulmão. A indústria do tabaco respondeu, durante décadas, exatamente com o argumento desta aula: "correlação não prova causa". Os estudos se acumularam, a relação entre dose e efeito ficou clara, o mecanismo foi descrito, e hoje a causa está estabelecida.

## A frase serve para os dois lados

Esse caso deixa uma lição dupla.

"Correlação não é causa" é uma defesa contra conclusões apressadas: a manchete de saúde baseada em um único estudo, o político que atribui a si a queda de um índice que caía em todo o país, o guru que vende o hábito dos ricos como receita de riqueza.

Mas a mesma frase é usada para **fabricar dúvida** sobre o que já está bem demonstrado, do cigarro ao aquecimento global. Quando há muitos estudos independentes, relação entre dose e efeito e mecanismo conhecido, pedir "mais provas" deixa de ser cautela e passa a ser tática.

A pergunta útil não é "isso é só correlação?", e sim: **que outras explicações existem, e elas foram examinadas?**

## Para praticar

Para cada frase, proponha uma explicação que não seja a de causa direta.

1. "Países que consomem mais chocolate ganham mais prêmios científicos."
2. "Alunos que têm aula particular tiram notas piores que os outros."
3. "Cidades com mais hospitais têm mais mortes."
4. "Depois que o técnico foi trocado, o time parou de perder."
5. "Pessoas que usam o cartão de crédito gastam mais."

**Respostas possíveis:** 1) Terceira causa: riqueza do país, que permite consumir mais e financiar mais pesquisa. 2) Causa ao contrário: quem vai mal é quem procura aula particular. 3) Terceira causa: tamanho da população; e os doentes graves são levados para onde há hospital. 4) Coincidência, ou o time estava em uma fase ruim que passaria de qualquer modo. 5) Pode haver causa, mas também o contrário: quem pretende gastar mais é quem usa o cartão; e a renda influencia as duas coisas.
