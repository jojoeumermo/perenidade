---
titulo: "Curto-circuito e sobrecarga"
resumo: "A diferença entre curto e sobrecarga, como o disjuntor percebe cada um, por que o mau contato esquenta, como descobrir a causa quando o disjuntor desarma e o que nunca fazer."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Curto-circuito"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Curto-circuito"
  - titulo: "Disjuntor"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Disjuntor"
  - titulo: "Fusível"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Fus%C3%ADvel"
  - titulo: "Termografia"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Termografia"
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
glossario:
  - termo: "sobrecarga"
    definicao: "Corrente um pouco acima do que o circuito aguenta, durante um tempo. Esquenta os fios aos poucos."
  - termo: "curto-circuito"
    definicao: "Um caminho quase sem resistência entre pontos com tensões diferentes, como fase e neutro encostados. A corrente sobe de repente e muito."
  - termo: "mau contato"
    definicao: "Uma ligação frouxa ou oxidada num borne ou emenda. Tem resistência maior que o normal e esquenta no ponto."
quiz:
  - pergunta: "Qual parte do disjuntor desliga numa sobrecarga?"
    opcoes: ["A térmica, com a lâmina bimetálica", "A magnética, com a bobina", "Nenhuma"]
    resposta: 0
    explicacao: "Na sobrecarga a corrente fica um pouco acima do normal por um tempo: a lâmina esquenta, se curva e desliga. A bobina age na subida brusca do curto."
  - pergunta: "O disjuntor desarma na hora em que se liga o disjuntor, mesmo com tudo desligado das tomadas. O que é mais provável?"
    opcoes: ["Sobrecarga", "Curto-circuito na fiação", "Falta de neutro"]
    resposta: 1
    explicacao: "Sem nada ligado, não há carga para fazer sobrecarga. Desarmar na hora indica curto no próprio circuito."
  - pergunta: "Por que um borne frouxo esquenta?"
    opcoes: ["Porque a tensão sobe nele", "Porque o contato ruim tem mais resistência, e a mesma corrente produz mais calor ali", "Porque ele puxa mais corrente"]
    resposta: 1
    explicacao: "O calor é P = R × I². Com a mesma corrente, o ponto com resistência maior esquenta mais."
  - pergunta: "O disjuntor do circuito vive desarmando. O que nunca se deve fazer?"
    opcoes: ["Medir a corrente com alicate amperímetro", "Trocar por um disjuntor maior sem trocar os fios", "Dividir as cargas em mais circuitos"]
    resposta: 1
    explicacao: "O disjuntor protege o fio. Um disjuntor maior deixa passar corrente que o fio não aguenta."
---

```provocacao
O disjuntor desarma às vezes no fim da tarde e às vezes na hora em que você liga. São o mesmo defeito?
```

## O que você vai aprender

Ao fim desta aula você vai distinguir curto-circuito de sobrecarga, saber como o disjuntor e o fusível percebem cada um, entender por que o mau contato esquenta e seguir um roteiro para descobrir a causa de um disjuntor que desarma.

## Duas coisas diferentes

| | Sobrecarga | Curto-circuito |
| --- | --- | --- |
| O que é | corrente um pouco acima do que o circuito aguenta, por um tempo | caminho quase sem resistência entre fase e neutro (ou entre fases, ou fase e terra) |
| Como a corrente sobe | aos poucos | de repente, muito |
| Causa comum | aparelhos demais no mesmo circuito, benjamins, chuveiro mais potente no fio antigo | isolação danificada, fios que se encostam, água, um prego ou parafuso que atravessou o fio |
| Quem desliga | a parte **térmica** do disjuntor, depois de algum tempo | a parte **magnética**, na hora |

O curto costuma vir com estalo, faísca e marca preta. A Wikipédia o descreve como uma das principais causas de incêndio em instalações mal conservadas ou mal dimensionadas.

## Disjuntor e fusível

O **disjuntor termomagnético** tem as duas proteções: a **lâmina bimetálica**, que se curva quando esquenta e desliga na sobrecarga, e a **bobina**, que abre o contato na hora quando a corrente dispara no curto.

O **fusível** é um fio ou lâmina de metal de baixo ponto de fusão: quando a corrente passa do limite, ele **derrete** por efeito Joule e abre o circuito. Depois, tem de ser trocado por outro **do mesmo valor**. Pôr um fio grosso no lugar do fusível ("fazer uma ponte") elimina a proteção.

## O mau contato: o calor escondido

Nem todo aquecimento é sobrecarga. Um **borne frouxo**, uma emenda malfeita ou um contato oxidado tem resistência maior que o normal. Como o calor é P = R × I², a mesma corrente que passa tranquila pelo fio produz calor concentrado naquele ponto. O sinal é **tomada escurecida, plástico derretido, cheiro de queimado** ou um plugue que esquenta. O disjuntor pode nunca desarmar, porque a corrente é normal: quem esquenta é o ponto.

Em manutenção profissional, a **termografia**, uma câmera que mostra a temperatura pelo infravermelho, encontra esses pontos quentes antes que virem problema.

```navidareal
**O cheiro de queimado na tomada da geladeira.** Tomada que esquenta, mesmo sem o disjuntor desarmar, não é para esperar. Desligue o disjuntor, abra a tomada e veja os bornes e as emendas. Contato escuro ou derretido se troca: a tomada, o plugue ou os dois.
```

## Roteiro quando o disjuntor desarma

1. **Quando desarma?**
   - Na hora de religar, mesmo com tudo desligado das tomadas → suspeita de **curto na fiação**.
   - Só quando se liga um aparelho específico → suspeita de **defeito no aparelho**.
   - Depois de um tempo, com vários aparelhos ligados → suspeita de **sobrecarga**.
2. **Para sobrecarga**: some as potências do que está ligado e calcule a corrente (I = P ÷ U), ou meça com o **alicate amperímetro** no fio do circuito. Compare com o disjuntor.
3. **Para curto**: desligue o disjuntor, tire os aparelhos das tomadas, desligue os interruptores e, com a ausência de tensão confirmada, meça a **continuidade entre fase e neutro** e **entre fase e terra** no quadro. Em condição normal, sem nada ligado, não deve haver caminho. Se houver, vá separando trechos até achar o ponto.
4. **Para aparelho**: ligue o aparelho suspeito em outro circuito. Se desarmar lá também, o defeito é dele.

```verificar
Um circuito com disjuntor de 10 A em 127 V alimenta uma fritadeira de 1.000 W e um micro-ondas de 1.200 W ao mesmo tempo. O disjuntor desarma depois de alguns minutos. O que é?
+ Sobrecarga: 2.200 ÷ 127 ≈ 17 A, acima dos 10 A
- Curto-circuito
- Defeito no disjuntor
> Some as potências e divida pela tensão.
```

## Exemplo resolvido

**O disjuntor das tomadas da cozinha (10 A, 127 V) desarma toda manhã, quando a família liga a cafeteira de 800 W, a sanduicheira de 750 W e a geladeira de 150 W. Diagnostique e proponha a solução.**

```conta
Potência somada: 800 + 750 + 150 = 1.700 W
Corrente: 1.700 ÷ 127 ≈ 13,4 A
Disjuntor: 10 A → 13,4 A está acima
```

É **sobrecarga**: desarma depois de um tempo, só com aqueles aparelhos juntos. A solução **não** é trocar o disjuntor por um maior. O certo é **dividir as cargas**: criar outro circuito de tomadas para a cozinha, com fio de 2,5 mm², disjuntor próprio e DR, como pede a norma para cozinhas. Enquanto isso, a família pode evitar ligar os aparelhos de aquecimento ao mesmo tempo.

## Resumo

- **Sobrecarga**: corrente um pouco acima, por um tempo; desliga a parte térmica.
- **Curto-circuito**: corrente que dispara; desliga a parte magnética, na hora.
- O **fusível** derrete e se troca pelo mesmo valor; nunca por um fio.
- **Mau contato** esquenta no ponto, mesmo sem desarmar nada.
- Disjuntor que desarma tem uma causa: descubra qual antes de mexer.

```leve
- Some as potências dos aparelhos que costumam ficar ligados juntos na sua cozinha e calcule a corrente.
- Encoste as costas da mão no corpo dos plugues mais usados de casa logo depois de tirá-los da tomada (nunca nos pinos). Algum está morno? Anote para verificar com o disjuntor desligado.
```
