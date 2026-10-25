---
titulo: "Diagnóstico de defeitos com o multímetro"
resumo: "Um método para achar defeitos sem chutar: observar, levantar hipóteses e medir na ordem certa. Os três números de uma tomada, a lâmpada que não acende e o fio partido no meio do caminho."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Multímetro"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Mult%C3%ADmetro"
  - titulo: "College Physics 2e, seção 21.4, DC Voltmeters and Ammeters"
    autor: "Paul Peter Urone e Roger Hinrichs (OpenStax)"
    ano: "2022"
    url: "https://openstax.org/books/college-physics-2e/pages/21-4-dc-voltmeters-and-ammeters"
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
  - titulo: "NR-10: Segurança em instalações e serviços em eletricidade (texto de 2004, atualizado em 2019)"
    autor: "Ministério do Trabalho e Emprego"
    ano: "2019"
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-10-atualizada-2019-1.pdf"
glossario:
  - termo: "diagnóstico"
    definicao: "Descobrir a causa de um defeito a partir dos sintomas e das medições, antes de trocar qualquer peça."
  - termo: "hipótese"
    definicao: "Uma causa possível, que a medição vai confirmar ou descartar."
  - termo: "neutro interrompido"
    definicao: "Quando o fio neutro se parte ou se solta. Os aparelhos param, e o neutro depois do ponto partido pode ficar com tensão."
quiz:
  - pergunta: "Numa tomada de 127 V em bom estado, qual leitura se espera entre neutro e terra?"
    opcoes: ["Cerca de 127 V", "Uma tensão pequena, perto de zero", "220 V"]
    resposta: 1
    explicacao: "Neutro e terra se encontram na entrada da instalação, num sistema com neutro aterrado. Entre fase e neutro e entre fase e terra é que aparece a tensão da rede."
  - pergunta: "A tomada mostra 127 V entre fase e terra, mas quase nada entre fase e neutro. Onde procurar o defeito?"
    opcoes: ["No caminho do neutro", "No caminho do terra", "No disjuntor"]
    resposta: 0
    explicacao: "A fase está chegando (há tensão até o terra). O que falta é o caminho de volta: o neutro está partido ou solto em algum ponto."
  - pergunta: "Para testar se um interruptor fecha o contato, como se faz?"
    opcoes: ["Com o circuito ligado, na escala de continuidade", "Com o circuito desligado e a ausência de tensão confirmada, na escala de continuidade", "Na escala de corrente"]
    resposta: 1
    explicacao: "Continuidade só se mede sem energia. Liga-se e desliga-se o interruptor e o aparelho deve apitar numa posição e calar na outra."
  - pergunta: "Qual é o primeiro passo de um bom diagnóstico?"
    opcoes: ["Trocar a peça mais barata", "Observar o sintoma e perguntar o que aconteceu antes de o defeito aparecer", "Abrir o quadro"]
    resposta: 1
    explicacao: "Saber o sintoma e o que mudou (uma chuva, um aparelho novo, uma reforma) já elimina muitas causas."
---

```provocacao
A tomada da cozinha parou de funcionar. O disjuntor está ligado. Você troca a tomada, e nada. Que pergunta você deveria ter feito antes de trocar?
```

## O que você vai aprender

Ao fim desta aula você vai seguir um método de diagnóstico, interpretar as três medições de uma tomada, achar o defeito de uma lâmpada que não acende e localizar um fio partido no meio do caminho, sempre com segurança.

## O método: medir antes de trocar

Trocar peça "para ver se resolve" custa dinheiro e tempo, e às vezes esconde o defeito de verdade. Um diagnóstico segue passos:

1. **Observar o sintoma**: o que não funciona? Só uma tomada, um cômodo, a casa toda?
2. **Perguntar**: desde quando? O que mudou antes: uma chuva, um aparelho novo, uma reforma?
3. **Listar as causas possíveis**, da mais provável para a menos provável.
4. **Medir** para confirmar ou descartar cada uma, começando pelas medições mais simples e seguras.
5. **Consertar** só o que a medição apontou.
6. **Testar de novo** e explicar ao cliente o que foi feito.

Um circuito é um caminho: do quadro até o último ponto. Se a energia chega no começo e não chega no fim, o defeito está entre os dois. Medindo no meio, descobre-se em qual metade ele está, e assim por diante.

## Segurança: o que se mede ligado e o que se mede desligado

- **Tensão** se mede com o circuito **ligado**: ponteiras em bom estado, dedos atrás da proteção, multímetro com categoria adequada e a escala de tensão alternada.
- **Continuidade e resistência** se medem com o circuito **desligado** e a **ausência de tensão confirmada**, como manda a NR-10 (item 10.5.1).
- Antes de encostar a mão, sempre os três tempos: testar o multímetro num ponto ligado, medir, testar de novo.

## Os três números de uma tomada

Numa tomada de uso geral em 127 V, meça entre os três furos:

| Medição | Esperado numa tomada boa |
| --- | --- |
| Fase e neutro | a tensão da rede (cerca de 127 V) |
| Fase e terra | a tensão da rede (cerca de 127 V) |
| Neutro e terra | pequena, perto de zero |

Num sistema com neutro aterrado, neutro e terra se encontram na entrada da instalação: por isso entre eles a tensão é pequena.

Agora, o que cada resultado diferente indica:

| O que aparece | O que provavelmente é |
| --- | --- |
| Zero em tudo | a fase não chega: disjuntor, emenda solta ou fio partido antes da tomada |
| 127 V entre fase e terra, quase nada entre fase e neutro | o **neutro** está partido ou solto |
| 127 V entre fase e neutro, zero entre fase e terra | **não há terra** ligado, ou ele está partido |
| A tensão aparece entre o terra e o furo onde se esperava o neutro | fase e neutro foram ligados em furos **trocados**; o aparelho funciona, mas padronizar o lado facilita a manutenção |

```navidareal
**O neutro que dá choque.** Quando o neutro se parte, os aparelhos ligados depois do ponto partido param de funcionar. Mas, através deles, o pedaço de neutro que ficou solto passa a ter a tensão da fase. Quem acha que "o neutro não dá choque" e segura esse fio pode se machucar. Por isso a regra é medir sempre, e tratar todo fio como energizado até provar o contrário.
```

## A lâmpada que não acende

Siga esta ordem, da mais simples para a mais trabalhosa:

1. **Troque a lâmpada** por uma que você sabe que funciona.
2. Com o interruptor **ligado**, meça a tensão no bocal, entre o contato central e a rosca. Se aparece a tensão da rede, o defeito é o bocal (contato oxidado ou frouxo).
3. Se dá zero, **desligue o disjuntor**, confirme a ausência de tensão e teste o **interruptor** na continuidade: ele deve apitar numa posição e calar na outra.
4. Se o interruptor está bom, teste a **continuidade do retorno** (do interruptor ao bocal) e do **neutro**.

## Achar o fio partido

Um fio pode se partir dentro do eletroduto ou se soltar numa emenda escondida numa caixa. Com o circuito desligado, a continuidade mostra se há caminho entre as duas pontas de um mesmo fio. Para medir um fio comprido, use outro fio, que você sabe que está bom, como "extensão" da ponteira até a outra ponta.

```verificar
Você mede uma tomada e encontra: fase-neutro 127 V, fase-terra 0 V, neutro-terra 0 V. O que concluir?
- A tomada está perfeita
+ A tomada funciona, mas não tem terra ligado
- O neutro está partido
> Fase-terra deveria dar a tensão da rede, se o terra existisse.
```

## Exemplo resolvido

**As duas tomadas da parede da sala pararam; a do lado da porta, no mesmo circuito, funciona. O disjuntor está ligado. Encontre o defeito.**

1. **Sintoma**: duas tomadas mortas; a outra do mesmo circuito, boa. O disjuntor não desarmou, então não parece curto.
2. **Pergunta**: alguém mexeu ali? O cliente conta que colocaram um quadro na parede na semana passada.
3. **Medição**: nas tomadas mortas, zero entre fase e neutro e zero entre fase e terra. A fase não chega.
4. **Hipótese**: o caminho da fase passa primeiro pela tomada da porta e de lá segue para as outras. O defeito está entre ela e a próxima.
5. **Com o disjuntor desligado** e a ausência de tensão confirmada, abre-se a caixa da tomada da porta: a emenda da fase que segue para as outras está solta, talvez pelo impacto da furadeira.
6. **Conserto**: refazer a emenda com conector adequado, fechar, religar e medir de novo nas três tomadas.

## Resumo

- Diagnóstico é **observar, perguntar, listar causas, medir, consertar e testar de novo**.
- Divida o caminho ao meio para achar em que trecho está o defeito.
- **Tensão** se mede ligado; **continuidade**, desligado e com ausência de tensão confirmada.
- Numa tomada boa de 127 V: fase-neutro e fase-terra dão a tensão da rede; neutro-terra, quase nada.
- O neutro partido pode ficar com tensão: trate todo fio como energizado até medir.

```leve
- Com o multímetro, meça os três pares de furos de uma tomada de três pinos em casa e anote os valores.
- Escreva num papel o método de seis passos e treine com um defeito simples: uma lâmpada queimada.
```
