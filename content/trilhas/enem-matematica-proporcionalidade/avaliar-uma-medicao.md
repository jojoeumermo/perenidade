---
titulo: "Avaliar uma medição: precisão, erro e arredondamento"
resumo: "Como saber se uma medida é confiável: a menor divisão do instrumento, o erro absoluto e o relativo, a média de várias medidas e o arredondamento que faz sentido, para usar um resultado medido num argumento, do jeito que a prova cobra."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Matriz de Referência do Enem (página de outros documentos do Enem)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos"
  - titulo: "Provas e gabaritos do Enem"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
  - titulo: "Erro de medição"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Erro_de_medi%C3%A7%C3%A3o"
quiz:
  - pergunta: "Uma régua comum tem marcas de milímetro em milímetro. A menor divisão dela é:"
    opcoes: ["1 cm", "1 mm", "0,1 mm", "1 m"]
    resposta: 1
    explicacao: "A menor divisão é a distância entre duas marcas vizinhas: 1 mm. Medir décimos de milímetro com ela é chute."
  - pergunta: "Um erro de 1 cm é mais grave ao medir:"
    opcoes: ["a largura de uma rua", "o comprimento de um campo de futebol", "a largura de um parafuso", "a altura de um prédio"]
    resposta: 2
    explicacao: "O que pesa é o erro relativo: 1 cm num parafuso é enorme; numa rua, quase nada."
  - pergunta: "Três medidas de uma mesa deram 120,2 cm, 119,8 cm e 120,0 cm. A melhor estimativa é:"
    opcoes: ["119,8 cm", "120,2 cm", "120,0 cm", "360,0 cm"]
    resposta: 2
    explicacao: "A média é (120,2 + 119,8 + 120,0) ÷ 3 = 120,0 cm."
---

```provocacao
Duas balanças da feira pesam o mesmo saco de feijão. Uma marca 1 kg. A outra, 1,04 kg. O feirante diz que a diferença "não é nada". Para quem compra um saco, talvez não seja. E para quem compra cem sacos por mês? Quando um erro de medida importa?
```

## O que você vai aprender

Ao fim desta aula você vai saber avaliar se uma medida é confiável: reconhecer a precisão do instrumento, calcular o erro absoluto e o relativo, usar a média de várias medidas e arredondar de um jeito que faça sentido. E vai usar isso para decidir se um argumento baseado numa medida se sustenta.

## Toda medida tem uma margem

Nenhuma medida é exata. Ela depende do **instrumento**, de **quem mede** e das **condições**. Por isso, avaliar uma medição é perguntar:

1. **Qual a menor divisão do instrumento?** Uma régua milimetrada não mede décimos de milímetro; uma balança de cozinha que vai de 5 em 5 gramas não mede 1 grama.
2. **De quanto foi o erro?** A diferença entre o valor medido e o valor de referência.
3. **O erro é grande em relação ao que se mede?** É o erro relativo.

```formula
erro absoluto = |valor medido − valor de referência|
erro relativo = erro absoluto ÷ valor de referência (em porcentagem: × 100)
média de n medidas = soma das medidas ÷ n
```

## Erro absoluto e erro relativo

Um erro de 2 cm pode ser enorme ou desprezível. Compare:

- medir uma folha de 20 cm e errar 2 cm: erro relativo de 2 ÷ 20 = 0,10, ou **10%**;
- medir uma sala de 500 cm e errar 2 cm: erro relativo de 2 ÷ 500 = 0,004, ou **0,4%**.

O erro absoluto é o mesmo; o relativo é 25 vezes maior na folha. É o erro relativo que diz se a medida serve.

```verificar
Uma balança marcou 1,04 kg para um saco que tem 1 kg. Qual o erro relativo?
- 0,04%
+ 4%
- 40%
> Erro absoluto: 0,04 kg. Erro relativo: 0,04 ÷ 1 = 0,04, ou 4%.
```

## Várias medidas e a média

Quando se mede a mesma coisa várias vezes, os resultados variam um pouco. A **média** costuma ser a melhor estimativa. E uma medida muito diferente das outras pede atenção: pode ser um erro de leitura, que se descarta com justificativa, não por gosto.

## Arredondar com sentido

O resultado de uma conta não pode ter mais precisão que as medidas que o geraram. Se você mediu com régua milimetrada e dividiu por 3, não faz sentido escrever 12,3333 cm: escreva 12,3 cm. E, ao arredondar, olhe o algarismo seguinte: 5 ou mais, sobe; menos de 5, mantém.

Também é preciso arredondar **na direção certa** para o problema. Se cada caixa leva 12 garrafas e há 50 garrafas, são 50 ÷ 12 ≈ 4,17 caixas: precisa de **5** caixas, não de 4.

```navidareal
# A conta de luz e o medidor
A conta de luz é calculada pela diferença entre duas leituras do medidor, em quilowatt-hora. Se uma leitura foi feita errada, a conta do mês vem alta, e a do mês seguinte, baixa. Por isso vale anotar a leitura do relógio no mesmo dia em que o leiturista passa: é uma segunda medida, que permite conferir a primeira.
```

## Exemplo resolvido

**Um aluno mediu a largura de um caderno cinco vezes com uma régua milimetrada e obteve: 20,1 cm; 20,0 cm; 20,2 cm; 22,0 cm; 20,1 cm. O comando pergunta qual valor representa melhor a largura e por quê.**

1. Olhe os valores: quatro estão entre 20,0 e 20,2. O 22,0 está muito longe.
2. Uma diferença de quase 2 cm numa régua milimetrada indica erro de leitura. Descarte-o, com essa justificativa.
3. Média dos quatro: (20,1 + 20,0 + 20,2 + 20,1) ÷ 4 = 80,4 ÷ 4 = 20,1 cm.
4. A régua mede milímetros, então uma casa decimal em centímetros é a precisão certa.

Resposta: 20,1 cm, a média das medidas coerentes.

## Como isso cai no ENEM

- **Formatos:** tabela com várias medições, comparação de instrumentos, propaganda que anuncia uma medida, laudo que compara um valor medido com um limite. O comando pede a medida mais confiável, o erro, se uma afirmação se sustenta ou que arredondamento faz sentido.
- **Habilidades:** esta aula trabalha a H13 (avaliar o resultado de uma medição na construção de um argumento consistente). Nas provas de 2022 e 2023, classificadas pelo instituto, nenhuma questão ficou nesta habilidade, mas ela se apoia nas vizinhas H10 a H12, de grandezas e medidas.
- **Armadilhas:**
  - Comparar erros pelo valor absoluto, quando o problema pede o relativo.
  - Dar ao resultado mais casas decimais do que o instrumento permite.
  - Arredondar para baixo quando o problema exige cobrir tudo (caixas, ônibus, latas de tinta).
- **Na prova:** Matemática cai no segundo dia, {{enem:aplicacao-dia-2}}.

## Questão comentada

**Texto-base.** *Texto original do Instituto Lúcia, escrito para esta aula.*

Uma fiscalização conferiu duas bombas de um posto. Em cada uma, pediu 20 litros de combustível e mediu o volume entregue num recipiente-padrão. A bomba 1 entregou 19,90 litros. A bomba 2 entregou 19,70 litros. Para o teste desta questão, considere aceitável um erro relativo de até 0,5% para menos.

**Comando.** Com base nessa regra, conclui-se que

A) as duas bombas estão dentro do limite.
B) só a bomba 1 está dentro do limite.
C) só a bomba 2 está dentro do limite.
D) nenhuma das duas está dentro do limite.
E) não é possível avaliar sem saber o preço do litro.

**Resolução.**

1. Limite: 0,5% de 20 L = 0,005 × 20 = 0,1 L. A bomba pode entregar no mínimo 19,9 L.
2. Bomba 1: faltaram 0,10 L, erro relativo de 0,10 ÷ 20 = 0,5%. Está no limite, portanto aceitável.
3. Bomba 2: faltaram 0,30 L, erro relativo de 0,30 ÷ 20 = 1,5%. Passa do limite.

**Gabarito: B.**

**Por que as outras não:**

- A) A bomba 2 errou 1,5%, três vezes o limite.
- C) Inverte as bombas: a que errou mais é a 2.
- D) A bomba 1 está exatamente no limite, que é aceito ("até 0,5%").
- E) O preço não entra na avaliação do erro de volume.

```realidade
Meça três vezes a largura da sua mesa ou da porta do seu quarto, com o que tiver (régua, fita, trena). Calcule a média e diga quantas casas decimais fazem sentido para o seu instrumento.
```

## Resumo

- Toda medida tem margem: depende do instrumento, de quem mede e das condições.
- A menor divisão do instrumento limita a precisão do resultado.
- Erro absoluto = |medido − referência|; erro relativo = erro absoluto ÷ referência.
- O erro relativo é que diz se a medida serve.
- Várias medidas: use a média e descarte, com justificativa, a que destoa por erro de leitura.
- Arredonde com o número de casas que o instrumento permite, e na direção que o problema exige.

## Para aprofundar

- [Unidades de medida](/trilhas/enem-matematica-proporcionalidade/unidades-de-medida)
- [Arredondamento e estimativa](/trilhas/enem-matematica-fundamentos/arredondamento-e-estimativa)
- [Porcentagem](/trilhas/enem-matematica-proporcionalidade/porcentagem)
