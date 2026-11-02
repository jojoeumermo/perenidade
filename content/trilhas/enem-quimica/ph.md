---
titulo: "pH e indicadores"
resumo: "O que o pH mede, por que cada unidade da escala vale dez vezes, como pH e pOH se somam, como funcionam os indicadores e por que alguns sais deixam a água ácida ou básica."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Chemistry 2e, seção 14.2, pH and pOH"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-2-ph-and-poh"
  - titulo: "Chemistry 2e, seção 14.3, Relative Strengths of Acids and Bases"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-3-relative-strengths-of-acids-and-bases"
  - titulo: "Chemistry 2e, seção 14.7, Acid-Base Titrations"
    autor: "Paul Flowers, Klaus Theopold, Richard Langley, William R. Robinson (OpenStax)"
    ano: "2019"
    url: "https://openstax.org/books/chemistry-2e/pages/14-7-acid-base-titrations"
  - titulo: "Provas e gabaritos do Enem (as provas de 2022 e 2023, base da contagem do instituto)"
    autor: "Inep"
    url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
quiz:
  - pergunta: "Uma solução de pH 9, a 25 °C, é"
    opcoes: ["neutra","básica","impossível","ácida"]
    resposta: 1
    explicacao: "A 25 °C, pH menor que 7 é ácido, igual a 7 é neutro e maior que 7 é básico."
  - pergunta: "O suco de limão tem pH perto de 2 e o tomate, perto de 4. Em quantas vezes a concentração de H⁺ do limão é maior?"
    opcoes: ["2 vezes","20 vezes","4 vezes","100 vezes"]
    resposta: 3
    explicacao: "Cada unidade de pH a menos é dez vezes mais H⁺. Duas unidades: 10 × 10 = 100 vezes."
  - pergunta: "Se [H⁺] = 10⁻⁵ mol/L, o pH é"
    opcoes: ["10","0,5","5","−5"]
    resposta: 2
    explicacao: "pH = −log [H⁺]. Com [H⁺] = 10⁻⁵, o pH é 5: o pH é o expoente com o sinal trocado."
  - pergunta: "Uma solução tem pH 11. O pOH dela, a 25 °C, é"
    opcoes: ["3","25","−3","11"]
    resposta: 0
    explicacao: "A 25 °C, pH + pOH = 14. Então pOH = 14 − 11 = 3."
---

```provocacao
A chuva limpa o ar, mas os técnicos dizem que até a chuva de um lugar sem poluição é um pouco ácida. Como uma água que cai do céu pode ser ácida?
```

## O que você vai aprender

Ao fim desta aula você vai saber o que o pH mede, usar a escala sabendo que cada unidade vale dez vezes, somar pH e pOH, entender como funcionam os indicadores de cor e prever se um sal deixa a água ácida ou básica.

## A água também se separa um pouquinho

Mesmo a água pura tem alguns íons. Uma fração mínima das moléculas se separa: H₂O ⇌ H⁺ + OH⁻. A 25 °C, na água pura, [H⁺] = [OH⁻] = 10⁻⁷ mol/L. É um número muito pequeno: 0,0000001.

O produto das duas concentrações é constante a 25 °C: [H⁺] · [OH⁻] = 10⁻¹⁴. Se um ácido aumenta o H⁺, o OH⁻ diminui na mesma proporção, e vice-versa.

## O pH: um jeito curto de escrever números pequenos

Escrever 0,0000001 cansa. O pH é um atalho: ele diz o expoente da concentração de H⁺, com o sinal trocado.

```formula
pH = −log [H⁺]
se [H⁺] = 10⁻ˣ mol/L, então pH = x
a 25 °C: pH < 7 ácido; pH = 7 neutro; pH > 7 básico
```

```formula
pH + pOH = 14
pOH = −log [OH⁻]; a 25 °C, pH e pOH sempre somam 14
```

O pH é uma escala **logarítmica**. Isso quer dizer: cada unidade a menos é dez vezes mais H⁺. Uma solução de pH 3 tem dez vezes mais H⁺ que uma de pH 4 e cem vezes mais que uma de pH 5.

Alguns valores de referência: suco gástrico perto de 1 a 2; limão perto de 2; vinagre perto de 3; café perto de 5; água pura 7; sangue entre 7,35 e 7,45; água sanitária e soda cáustica acima de 11.

Diluir um ácido forte dez vezes sobe o pH em uma unidade. Diluir cem vezes, duas unidades. Mas diluir nunca passa do 7: um ácido diluído chega perto do neutro, não vira base.

## Indicadores: substâncias que mudam de cor

Um **indicador** é uma substância que tem uma cor numa faixa de pH e outra cor noutra faixa. Na prática, ele também é um ácido fraco, e a forma com H⁺ e a forma sem H⁺ têm cores diferentes.

- **Fenolftaleína:** incolor em meio ácido e neutro; rosa em meio básico (a partir de cerca de pH 8,2).
- **Papel de tornassol:** fica vermelho em ácido e azul em base.
- **Repolho roxo:** o caldo é um indicador caseiro. Fica avermelhado em ácido, roxo perto do neutro, verde ou amarelado em base forte.

## Sais que mudam o pH: a hidrólise

Nem todo sal é neutro. Quando um sal vem de um ácido fraco e uma base forte, como o bicarbonato de sódio, o ânion do ácido fraco pega H⁺ da água e sobra OH⁻: a solução fica básica. Quando o sal vem de um ácido forte e uma base fraca, como o cloreto de amônio, a solução fica ácida. Sal de ácido forte com base forte, como o NaCl, fica neutro.

## Protonado ou não: a regra do pKa

Um grupo ácido numa molécula pode estar com o H⁺ (protonado) ou sem ele. Cada grupo tem seu pKa. A regra é simples: se o pH do meio é **menor** que o pKa, o grupo fica com o H⁺; se é **maior**, ele perde o H⁺. Essa regra explica por que alguns remédios se dissolvem melhor no estômago e outros no intestino.

```navidareal
Volte à chuva da provocação. O ar tem gás carbônico. Ao cair, a chuva dissolve um pouco dele e forma ácido carbônico, que é fraco. Por isso a chuva limpa costuma ter pH perto de 5,6.

A chuva ácida é a que fica abaixo disso, por causa de óxidos de enxofre e de nitrogênio lançados por motores, caldeiras e indústrias. Eles formam ácidos fortes, que baixam muito o pH e atacam plantas, rios, pedras e metais.
```

```verificar
Um ácido forte de pH 2 é diluído dez vezes com água. O novo pH é
- 1
+ 3
- 20
> Diluir dez vezes divide o [H⁺] por 10. Um expoente a mais: o pH sobe uma unidade, de 2 para 3.
```

## Exemplo resolvido

**Uma solução de limpeza tem [OH⁻] = 10⁻³ mol/L, a 25 °C. Qual é o pH? Ela é ácida ou básica?**

1. pOH = −log [OH⁻] = 3.
2. pH = 14 − pOH = 14 − 3 = 11.
3. pH 11 é maior que 7: a solução é básica.

Confira: [H⁺] = 10⁻¹⁴ ÷ 10⁻³ = 10⁻¹¹. pH = 11. Bate pelos dois caminhos.

## Como isso cai no ENEM

- **Formatos:** tabela de pH de produtos, gráfico de pH ao longo do tempo, indicador caseiro, remédio com grupos ácidos e pKa, solo, chuva, sangue. A questão pede se o meio é ácido ou básico, quantas vezes um é mais ácido que outro, a cor de um indicador ou a forma de uma molécula num pH.
- **O que mais cai:** nas provas de 2022 e 2023, classificadas pelo instituto, o equilíbrio (Le Chatelier e pH) teve 3 das 89 questões classificadas de Ciências da Natureza (3,4%). Este tópico teve 1 delas, em 2022: um remédio com três grupos ácidos e seus pKa, e a pergunta era a forma da molécula na urina, de pH entre 5 e 7. São só duas edições: é tendência, não promessa.
- **Habilidades:** H24 (usar a linguagem e a nomenclatura da química), a habilidade de Natureza que mais apareceu nessa base, com 11 das 89 questões (12,4%), e H17 (relacionar informações em texto, tabela ou fórmula), com 6.
- **Armadilhas:**
  - Achar que pH 4 é "duas vezes" mais ácido que pH 8. Cada unidade é dez vezes.
  - Achar que pH maior é mais ácido. É o contrário.
  - Diluir um ácido e achar que ele vira base.
  - Achar que todo sal é neutro.
  - Trocar a regra do pKa: pH menor que o pKa, o grupo fica com o H⁺.

## Questão comentada

**Texto-base.** Uma cooperativa de pesca monitora a água de dois açudes. No açude I, o pH medido foi 5. No açude II, que recebe a água de uma mineração abandonada, o pH foi 3. Os técnicos disseram que a água do açude II é "muito mais ácida".

**Comando.** Em relação ao açude I, a concentração de íons H⁺ no açude II é

A) 100 vezes maior.
B) 2 vezes maior.
C) 2 vezes menor.
D) 100 vezes menor.
E) 15 vezes maior.

**Resolução.**

1. pH 5: [H⁺] = 10⁻⁵ mol/L. pH 3: [H⁺] = 10⁻³ mol/L.
2. Divida: 10⁻³ ÷ 10⁻⁵ = 10² = 100.
3. A água do açude II tem 100 vezes mais H⁺.

**Gabarito: A.**

**Por que as outras não:**

- B) Você subtraiu os pH (5 − 3 = 2) e leu como "duas vezes". Cada unidade de pH é um fator de dez.
- C) pH menor é mais H⁺, não menos. E a diferença não é de 2 vezes.
- D) O sentido está trocado: o açude II, de pH menor, é o mais ácido.
- E) Você dividiu 5 por 3 e multiplicou por 10, sem lógica de escala. O fator é 10 elevado à diferença de pH.

```realidade
Ferva folhas de repolho roxo em um pouco de água, coe e use o caldo frio como indicador. Pingue em vinagre, água, sabão e bicarbonato. Anote a cor em cada um e coloque os quatro em ordem do mais ácido ao mais básico.
```

## Resumo

- A 25 °C, [H⁺] · [OH⁻] = 10⁻¹⁴; água pura tem pH 7.
- pH = −log [H⁺]; pH + pOH = 14.
- Menor que 7, ácido; maior que 7, básico. Cada unidade vale dez vezes.
- Diluir dez vezes um ácido forte sobe o pH em uma unidade, sem passar de 7.
- Indicadores mudam de cor com o pH: fenolftaleína fica rosa em base.
- Sal de ácido fraco com base forte é básico; de ácido forte com base fraca, ácido.
- pH menor que o pKa: grupo protonado; maior: desprotonado.

## Para aprofundar

- [pH](/trilhas/quimica-medio/ph)
- [Ácidos e bases em casa](/trilhas/quimica-fundamental/acidos-e-bases-em-casa)
- [Funções inorgânicas](/trilhas/quimica-medio/funcoes-inorganicas)
- [Ácidos, bases, sais e óxidos](/trilhas/enem-quimica/funcoes-inorganicas)
- [Equilíbrio químico e Le Chatelier](/trilhas/enem-quimica/le-chatelier)
- [Formulário de química](/trilhas/enem-reta-final/formulario-de-quimica)
