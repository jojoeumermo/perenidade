---
titulo: "Interruptor simples, paralelo e intermediário"
resumo: "Como se liga uma lâmpada a um interruptor, por que a fase vai sempre no interruptor e como acender a mesma lâmpada de dois, três ou mais lugares."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Instalações elétricas residenciais, parte 2 (manual baseado na NBR 5410)"
    autor: "ELEKTRO e Pirelli, com revisão técnica de Hilton Moreno"
    ano: "2003"
    url: "https://www.coe.ufrj.br/~kleber/INST_ELET_RES_PARTE_02.pdf"
  - titulo: "Comutador de escada"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Interruptor_paralelo"
  - titulo: "Interruptor"
    autor: "Wikipédia"
    url: "https://pt.wikipedia.org/wiki/Interruptor"
glossario:
  - termo: "interruptor paralelo"
    definicao: "Também chamado de three-way ou interruptor de escada. Tem três bornes e trabalha sempre em dupla, para comandar a mesma lâmpada de dois lugares."
  - termo: "interruptor intermediário"
    definicao: "Também chamado de four-way ou inversor. Tem quatro bornes e vai entre dois paralelos para acrescentar mais pontos de comando."
  - termo: "borne"
    definicao: "O terminal com parafuso onde se prende o fio."
quiz:
  - pergunta: "Qual fio vai ligado ao interruptor simples?"
    opcoes: ["O neutro", "A fase", "O terra"]
    resposta: 1
    explicacao: "A fase entra no interruptor, e do interruptor sai o retorno para a lâmpada. O neutro vai direto à lâmpada."
  - pergunta: "No bocal da lâmpada, onde se liga o neutro?"
    opcoes: ["No contato central", "Na base rosqueada", "Tanto faz"]
    resposta: 1
    explicacao: "O retorno vai no contato do centro e o neutro na rosca, a parte que fica mais exposta na hora de trocar a lâmpada."
  - pergunta: "Para acender a mesma lâmpada de dois lugares, o que se usa?"
    opcoes: ["Dois interruptores simples", "Dois interruptores paralelos", "Um interruptor intermediário"]
    resposta: 1
    explicacao: "Os paralelos trabalham em dupla. Dois interruptores simples em série exigiriam os dois ligados para a lâmpada acender."
  - pergunta: "Quantos interruptores intermediários são precisos para comandar uma lâmpada de quatro lugares?"
    opcoes: ["Um", "Dois", "Quatro"]
    resposta: 1
    explicacao: "Ficam sempre dois paralelos nas pontas. Cada ponto a mais é um intermediário entre eles: para quatro pontos, 2 paralelos e 2 intermediários."
---

```provocacao
Você entra pela porta da sala, acende a luz, atravessa e sai pela outra porta. Como apagar a luz de lá, sem voltar?
```

## O que você vai aprender

Ao fim desta aula você vai saber ligar uma lâmpada a um interruptor simples, entender por que a fase vai no interruptor e montar o comando de uma lâmpada de dois, três ou mais pontos com interruptores paralelos e intermediários.

## Os fios do ponto de luz

Num circuito de iluminação aparecem quatro fios:

| Fio | Função |
| --- | --- |
| **Fase** | traz a tensão do quadro |
| **Neutro** (azul-claro) | fecha o caminho de volta |
| **Retorno** | vai do interruptor até a lâmpada; só tem tensão com o interruptor ligado |
| **Terra** (verde-amarelo) | protege a luminária metálica |

## Interruptor simples

O interruptor simples tem **dois bornes**: uma entrada e uma saída. A ligação segue sempre esta regra:

1. A **fase** vai ao **interruptor**.
2. Do interruptor sai o **retorno**, que vai ao **contato central** do bocal da lâmpada.
3. O **neutro** vai direto à **base rosqueada** do bocal.
4. O **terra** vai à **luminária**, se ela for metálica.

Por que a fase no interruptor? Porque assim, com o interruptor desligado, **não chega fase ao bocal**: quem troca a lâmpada não fica exposto à tensão. Se o interruptor cortasse o neutro, a lâmpada apagaria, mas o bocal continuaria com fase. E a rosca, que é a parte mais fácil de encostar, fica no neutro.

Para várias lâmpadas no mesmo interruptor, os bocais são ligados lado a lado: o mesmo retorno vai a todos, e o neutro também.

## Interruptor paralelo: dois pontos de comando

O **interruptor paralelo**, ou de escada, tem **três bornes**: um comum e dois de saída. Ele **trabalha em dupla**:

1. A **fase** vai ao borne comum do primeiro interruptor.
2. Os dois bornes de saída do primeiro são ligados aos dois do segundo por **dois fios de retorno**.
3. Do borne comum do segundo sai o **retorno** para a lâmpada.
4. O neutro vai direto à lâmpada.

Cada interruptor escolhe um dos dois caminhos. Quando os dois escolhem o **mesmo** caminho, a corrente passa e a lâmpada acende; quando escolhem caminhos **diferentes**, ela apaga. Por isso qualquer um dos dois, mexido sozinho, muda o estado da lâmpada.

| Interruptor 1 | Interruptor 2 | Lâmpada |
| --- | --- | --- |
| caminho A | caminho A | acesa |
| caminho A | caminho B | apagada |
| caminho B | caminho A | apagada |
| caminho B | caminho B | acesa |

## Interruptor intermediário: três ou mais pontos

Para comandar a lâmpada de **três lugares**, coloca-se um **interruptor intermediário** (ou four-way) **entre** os dois paralelos, no meio dos dois fios de retorno. Ele tem **quatro bornes** e, a cada toque, cruza ou descruza os dois caminhos. Para mais pontos, põem-se mais intermediários em sequência, sempre com os **dois paralelos nas pontas**.

| Pontos de comando | Interruptores |
| --- | --- |
| 1 | 1 simples |
| 2 | 2 paralelos |
| 3 | 2 paralelos + 1 intermediário |
| 4 | 2 paralelos + 2 intermediários |

```navidareal
**Escada, corredor e quarto.** O paralelo é o interruptor da escada: acende embaixo, apaga em cima. Também serve para corredores compridos e para o quarto, com um interruptor na porta e outro perto da cama. Além do conforto, evita que a luz fique acesa à toa porque o interruptor estava longe.
```

```verificar
Alguém ligou uma lâmpada com o interruptor cortando o neutro. Ela acende e apaga normalmente. Qual é o problema?
- Nenhum, se funciona está certo
+ Com o interruptor desligado, o bocal continua com fase, e quem trocar a lâmpada pode levar choque
- A lâmpada vai gastar mais energia
> Pense no que chega ao bocal quando o interruptor está desligado.
```

## Exemplo resolvido

**Um corredor terá a mesma lâmpada comandada de três portas. Que interruptores usar e quais fios passam entre eles?**

1. Três pontos: **2 paralelos** (nas portas das pontas) e **1 intermediário** (na porta do meio).
2. Do quadro até o ponto de luz vêm **fase, neutro e terra**.
3. Do ponto de luz desce a **fase** até o primeiro paralelo.
4. Entre o primeiro paralelo e o intermediário: **2 retornos**.
5. Entre o intermediário e o segundo paralelo: **2 retornos**.
6. Do segundo paralelo volta **1 retorno** até a lâmpada.
7. Na lâmpada: retorno no contato central, neutro na rosca, terra na luminária metálica.

Antes de ligar o disjuntor, confira cada emenda e cada borne. E faça todo o trabalho com o circuito desligado e a ausência de tensão confirmada.

## Resumo

- **Fase no interruptor**, **retorno no contato central**, **neutro na rosca**, **terra na luminária**.
- O **simples** tem dois bornes e comanda de um lugar.
- O **paralelo** tem três bornes, trabalha em dupla e comanda de dois lugares.
- O **intermediário** tem quatro bornes e vai entre dois paralelos: cada um acrescenta um ponto.
- Entre paralelos e intermediários passam sempre **dois retornos**.

```leve
- Procure em casa, na escola ou no prédio uma lâmpada comandada de dois lugares e teste os quatro casos da tabela.
- Desenhe num papel o esquema do exemplo resolvido, com uma cor para cada fio.
```
