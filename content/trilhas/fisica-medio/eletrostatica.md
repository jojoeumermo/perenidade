---
titulo: "Eletrostática"
resumo: "Objetivo: entender a carga elétrica, os processos de eletrização, a lei de Coulomb e o campo elétrico, e aplicar essas ideias aos raios e à proteção contra eles."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Physics, seção 18.1, Electrical Charges, Conservation of Charge, and Transfer of Charge"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/18-1-electrical-charges-conservation-of-charge-and-transfer-of-charge"
  - titulo: "Physics, seção 18.2, Coulomb's Law"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/18-2-coulombs-law"
  - titulo: "Physics, seção 18.3, Electric Field"
    autor: "Paul Peter Urone, Roger Hinrichs (OpenStax)"
    ano: "2020"
    url: "https://openstax.org/books/physics/pages/18-3-electric-field"
quiz:
  - pergunta: "O que acontece entre duas cargas elétricas de mesmo sinal?"
    opcoes: ["Atraem-se", "Repelem-se", "Não interagem"]
    resposta: 1
    explicacao: "Cargas de mesmo sinal se repelem; de sinais opostos, se atraem."
  - pergunta: "Quando você esfrega um pente no cabelo e ele passa a atrair papeizinhos, o que aconteceu?"
    opcoes: ["Foram criadas cargas novas", "Elétrons passaram de um corpo para o outro", "O pente ficou magnetizado"]
    resposta: 1
    explicacao: "A carga não é criada nem destruída: é transferida. É a conservação da carga."
  - pergunta: "Pela lei de Coulomb, se a distância entre duas cargas cai para a metade, a força entre elas:"
    opcoes: ["Dobra", "Fica quatro vezes maior", "Cai para a metade"]
    resposta: 1
    explicacao: "A força é inversamente proporcional ao quadrado da distância."
  - pergunta: "Durante uma tempestade com raios, qual destes lugares é o mais seguro?"
    opcoes: ["Debaixo de uma árvore isolada", "Dentro de um carro fechado", "Em um campo aberto"]
    resposta: 1
    explicacao: "A lataria conduz a descarga por fora, protegendo quem está dentro. Árvores isoladas e campo aberto são os piores lugares."
---

## Cargas paradas

A **eletrostática** estuda as cargas elétricas **em repouso**. É ela que explica o choque ao tocar a maçaneta, o cabelo que arrepia ao tirar a blusa de lã, o plástico-filme que gruda e, em escala gigantesca, os raios.

## A carga elétrica

Toda matéria é feita de [átomos](/trilhas/quimica-fundamental/o-atomo-e-a-tabela-periodica). No núcleo ficam os **prótons**, de carga **positiva**, e os nêutrons, sem carga. Em volta, os **elétrons**, de carga **negativa**.

- Cargas de **mesmo sinal** se **repelem**.
- Cargas de **sinais opostos** se **atraem**.

Normalmente, um corpo tem tantos prótons quanto elétrons: é **neutro**. Fica **eletrizado** quando ganha ou perde **elétrons** (os prótons, presos no núcleo, não se movem):

- ganhou elétrons: fica **negativo**;
- perdeu elétrons: fica **positivo**.

A unidade de carga é o **coulomb** (C). A carga de um elétron é minúscula: 1,6 × 10⁻¹⁹ C. Toda carga é um múltiplo inteiro desse valor.

**Conservação da carga**: a carga não é criada nem destruída. Quando um corpo fica negativo, outro ficou positivo na mesma medida.

## Condutores e isolantes

- **Condutores**: materiais em que as cargas se movem com facilidade. Metais, o corpo humano, a água comum, a terra úmida.
- **Isolantes**: materiais em que as cargas quase não se movem. Borracha, plástico, vidro, madeira seca, ar seco.

Por isso os fios são de cobre por dentro e de plástico por fora.

## Como eletrizar um corpo

| Processo | Como acontece | Resultado |
| --- | --- | --- |
| **Atrito** | dois materiais diferentes são esfregados; um arranca elétrons do outro | ficam com cargas de sinais opostos |
| **Contato** | um corpo carregado toca um neutro; parte da carga passa | ficam com cargas de mesmo sinal |
| **Indução** | um corpo carregado é aproximado, sem tocar; as cargas do outro se separam | o lado mais próximo fica com carga de sinal oposto |

A indução explica por que um pente eletrizado atrai papeizinhos **neutros**: as cargas do papel se rearranjam, e o lado mais próximo é atraído com mais força do que o lado distante é repelido.

O choque na maçaneta é a carga acumulada no seu corpo, por atrito com a roupa ou o carpete, escapando de uma vez. Acontece mais em dias **secos**: no ar úmido, a carga vai embora aos poucos.

## A lei de Coulomb

Em 1785, o francês **Charles Coulomb** mediu a força entre duas cargas:

**F = k · q₁ · q₂ ÷ d²**

- q₁ e q₂ são as cargas;
- d é a distância entre elas;
- k é uma constante: 9 × 10⁹ N·m²/C² (no vácuo).

A forma é a mesma da lei da [gravitação](/trilhas/fisica-medio/gravitacao-universal): a força cai com o **quadrado da distância**. Há duas diferenças: a força elétrica pode ser de atração **ou** de repulsão, e é imensamente mais forte.

```conta
Duas cargas de 1 microcoulomb (0,000001 C) cada.
a 1 m:   F = 9 × 10⁹ × 10⁻⁶ × 10⁻⁶ ÷ 1² = 0,009 N
a 0,1 m: F = 9 × 10⁹ × 10⁻⁶ × 10⁻⁶ ÷ 0,1² = 0,9 N
```

Dez vezes mais perto, força cem vezes maior.

## Campo elétrico

Como uma carga age sobre outra sem tocá-la? A física responde com a ideia de **campo**: toda carga modifica o espaço em volta, criando um **campo elétrico**. Outra carga colocada ali sente uma força.

**E = F ÷ q**

O campo é a força por unidade de carga, medido em newtons por coulomb (N/C). Representa-se por **linhas de campo**, que saem das cargas positivas e chegam às negativas. Onde as linhas estão mais juntas, o campo é mais forte.

### O poder das pontas

Em um condutor carregado, as cargas se concentram nas **partes pontudas**, e ali o campo elétrico fica muito forte. É o princípio do para-raios.

```verificar
Um bastão eletrizado negativamente é aproximado, sem tocar, de uma esfera metálica neutra. O que acontece com as cargas da esfera?
- Nada, porque a esfera é neutra
+ Os elétrons são repelidos para o lado mais distante do bastão
- Os prótons se deslocam para perto do bastão
> Nos metais, quem se move são os elétrons. Cargas de mesmo sinal se repelem.
```

## Raios

Dentro de uma nuvem de tempestade, o atrito entre gotas e cristais de gelo separa as cargas. Em geral, a base da nuvem fica negativa e induz carga positiva no solo. Quando o campo elétrico fica forte demais, o ar, que é isolante, passa a conduzir: uma descarga enorme liga a nuvem ao chão. O **relâmpago** é a luz; o **trovão**, o som do ar aquecido de repente, que se expande com violência.

O Brasil, país tropical e extenso, está entre os que mais recebem raios no mundo.

### O para-raios

Inventado por **Benjamin Franklin** no século XVIII, é uma haste metálica pontuda, no ponto mais alto do edifício, ligada à terra por um cabo condutor. Ele não "atrai" os raios da região: oferece um **caminho seguro** para a descarga chegar ao solo sem passar pela construção.

### A gaiola de Faraday

Dentro de um condutor fechado (ou de uma tela metálica), o campo elétrico se anula: as cargas ficam na superfície externa. É a **gaiola de Faraday**. Por isso quem está dentro de um **carro fechado** ou de um avião fica protegido: a descarga passa pela lataria.

### Como se proteger

- **Abrigue-se** em casa, prédio ou carro fechado.
- **Não fique** em campo aberto, praia, piscina, rio ou mar.
- **Não se abrigue** debaixo de árvore isolada, nem perto de cercas de arame, postes e torres.
- Em casa, evite usar aparelhos ligados à tomada e telefone com fio.
- No campo, sem abrigo: agache-se com os pés juntos, sem deitar.

Trabalhadores rurais e da construção estão entre os mais atingidos. Parar o trabalho a céu aberto durante a tempestade é medida de segurança, não de preguiça.

## Para praticar

1. Explique por que um caminhão-tanque de combustível é ligado à terra por um cabo antes da descarga.
2. Duas cargas se atraem com força de 8 N. Se a distância entre elas dobrar, qual será a nova força?
3. Esfregue um balão de borracha no cabelo e encoste-o na parede. Explique o que acontece usando a ideia de indução.
4. Por que não se deve ficar debaixo de uma árvore durante uma tempestade?
