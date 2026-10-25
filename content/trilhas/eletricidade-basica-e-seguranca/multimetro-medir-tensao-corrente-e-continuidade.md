---
titulo: "Multímetro: medir tensão, corrente e continuidade"
resumo: "Como escolher a escala, onde encaixar as pontas de prova, como medir tensão em paralelo e corrente em série, como testar continuidade e por que testar o próprio multímetro antes de confiar nele."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Multímetro"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Mult%C3%ADmetro"
  - titulo: "College Physics 2e, seção 21.4, DC Voltmeters and Ammeters"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/21-4-dc-voltmeters-and-ammeters"
  - titulo: "NR-10: Segurança em instalações e serviços em eletricidade (texto de 2004, atualizado em 2019)"
    autor: "Ministério do Trabalho e Emprego"
    ano: "2019"
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-10-atualizada-2019-1.pdf"
glossario:
  - termo: "continuidade"
    definicao: "Teste que diz se existe um caminho elétrico fechado entre dois pontos. O multímetro apita quando há."
quiz:
  - pergunta: "Para medir a tensão de uma tomada, o multímetro é ligado:"
    opcoes: ["Em paralelo, com uma ponta em cada furo", "Em série, cortando o fio", "Só com uma ponta"]
    resposta: 0
    explicacao: "A tensão é a diferença entre dois pontos: as pontas vão nos dois pontos, em paralelo com o circuito."
  - pergunta: "Qual escala se usa para medir a tensão da tomada de casa?"
    opcoes: ["Tensão contínua (V com traço reto)", "Tensão alternada (V com o sinal ~)", "Resistência (Ω)"]
    resposta: 1
    explicacao: "A rede é de corrente alternada. A escala de tensão alternada é marcada com V~ ou VAC."
  - pergunta: "O teste de continuidade deve ser feito:"
    opcoes: ["Com o circuito ligado", "Com o circuito desligado", "Tanto faz"]
    resposta: 1
    explicacao: "Continuidade e resistência são medidas com o circuito sem energia. Com tensão, o aparelho pode queimar e a pessoa pode se ferir."
  - pergunta: "Antes de confiar que um fio está sem tensão, o que se faz com o multímetro?"
    opcoes: ["Nada, basta ver o visor", "Testa-se o aparelho numa tomada que se sabe estar ligada, mede-se o fio e testa-se de novo na tomada ligada", "Troca-se a bateria"]
    resposta: 1
    explicacao: "Se o multímetro estiver com defeito, ele marca zero num fio energizado. Testar antes e depois num ponto ligado mostra que ele funciona."
---

```provocacao
Se o multímetro marcou zero no fio, você pode encostar a mão? Como ter certeza de que é o fio que está desligado, e não o aparelho que está quebrado?
```

## O que você vai aprender

Ao fim desta aula você vai saber escolher a função e a escala do multímetro, medir tensão alternada numa tomada, entender por que a corrente se mede em série, testar continuidade e fazer a verificação de ausência de tensão do jeito seguro.

## Um aparelho, vários instrumentos

O **multímetro** junta num aparelho só o **voltímetro** (mede tensão), o **amperímetro** (mede corrente) e o **ohmímetro** (mede resistência). Muitos modelos também testam continuidade, com um apito. Há os de ponteiro (analógicos) e os de visor (digitais); hoje os digitais são os mais comuns.

## As partes do aparelho

- **Chave seletora**: escolhe o que medir e em que escala.
- **Bornes** (os furos para as pontas): o **COM** recebe sempre a ponta preta; o marcado com **V Ω** recebe a vermelha para tensão, resistência e continuidade; o marcado com **A** (às vezes **10 A**) recebe a vermelha para medir corrente.
- **Pontas de prova**: os fios com as pontas de metal. Devem estar sem rachaduras e com a proteção para os dedos.

Os símbolos que aparecem na chave:

| Símbolo | O que mede |
| --- | --- |
| V~ ou VAC | tensão alternada (a da tomada) |
| V⎓ ou VDC | tensão contínua (pilha, bateria, fonte) |
| A | corrente |
| Ω | resistência |
| um alto-falante ou um diodo | continuidade |

## Medir tensão: em paralelo

Tensão é a diferença entre dois pontos. Por isso, para medir tensão, as pontas vão **nos dois pontos**, sem cortar nada: o multímetro fica **em paralelo** com o circuito.

Para medir a tomada:

1. Ponta preta no COM, vermelha no V.
2. Chave em **tensão alternada**, numa escala maior que a esperada (por exemplo, 750 V~ ou a escala automática).
3. Segure as pontas só pela parte isolada, atrás da proteção para os dedos, e não encoste em nada metálico enquanto mede.
4. Encoste uma ponta em cada furo da tomada e leia o visor: 127 V ou 220 V, conforme a casa, com alguma variação.

## Medir corrente: em série

A corrente é o que passa pelo fio. Para medi-la, ela precisa **passar por dentro do multímetro**: é preciso abrir o circuito e pôr o aparelho no meio do caminho, **em série**. Por isso a medição de corrente com as pontas é mais arriscada e quase não se faz em instalação de casa. Quando se precisa saber a corrente de um circuito ligado, usa-se o **alicate amperímetro**, que mede pelo campo magnético, abraçando um único fio, sem cortar nada.

Nunca encoste as pontas numa tomada com a ponta vermelha no borne de corrente (A): o multímetro vira um curto-circuito.

## Continuidade e resistência: sem energia

O teste de **continuidade** responde: existe caminho entre estes dois pontos? Com o circuito **desligado**, encoste as pontas nas duas extremidades de um fio. Se o aparelho apitar, o fio está inteiro; se ficar calado, está partido no meio. O mesmo teste mostra se um fusível está queimado ou se a resistência de um chuveiro rompeu.

Resistência e continuidade **só se medem sem tensão**. Com o circuito ligado, a leitura não vale e o aparelho pode ser danificado.

## Categoria de segurança

Os multímetros digitais trazem a marcação de uma **categoria de sobretensão**, de I a IV. A categoria II é para aparelhos ligados na tomada; a III, para a instalação fixa (quadros, circuitos); a IV, para a origem da instalação, como o medidor da distribuidora. Para trabalhar no quadro de uma casa, use um multímetro com a categoria adequada, marcada no próprio aparelho.

```verificar
Você quer saber se o fio de uma extensão está partido por dentro. Qual função usa e como?
+ Continuidade, com a extensão fora da tomada, uma ponta em cada ponta do mesmo fio
- Tensão alternada, com a extensão ligada
- Corrente, cortando o fio
> Caminho inteiro ou partido é teste de continuidade, e continuidade se faz sempre sem energia.
```

## Exemplo resolvido: conferir que o circuito está desligado

A NR-10 põe a "constatação da ausência de tensão" como passo obrigatório depois de desligar e travar o circuito (item 10.5.1). O jeito seguro de fazer com o multímetro tem três tempos:

1. **Teste o aparelho**: meça uma tomada que você sabe que está ligada. O visor tem de mostrar a tensão da rede.
2. **Meça o ponto de trabalho**: com o disjuntor desligado, meça entre fase e neutro e entre fase e terra. O visor deve mostrar zero (ou quase).
3. **Teste o aparelho de novo** na tomada ligada. Se ele continua funcionando, o zero do passo 2 era verdadeiro.

Sem o primeiro e o terceiro passos, um multímetro com bateria fraca ou ponta partida mostraria zero num fio ligado.

## Resumo

- Ponta preta no **COM**; vermelha no **V Ω** para tensão, resistência e continuidade; no **A** só para corrente.
- **Tensão** se mede em paralelo; a da tomada é na escala **V~**.
- **Corrente** se mede em série; no dia a dia, use o alicate amperímetro.
- **Continuidade e resistência**: só com o circuito desligado.
- Para confiar no zero: teste o aparelho antes e depois num ponto ligado.

```leve
- Com o multímetro, meça uma pilha nova e uma usada (escala de tensão contínua) e mostre a diferença.
- Ensine a alguém os três tempos para conferir que um circuito está desligado.
```
