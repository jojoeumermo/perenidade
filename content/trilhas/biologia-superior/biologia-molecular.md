---
titulo: "Biologia molecular"
resumo: "Objetivo: entender como as células controlam quais genes estão ativos, do operon bacteriano à epigenética, como o RNA é processado, como o DNA é reparado e o que acontece quando esse controle falha no câncer."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Biology 2e, seção 14.6, DNA Repair"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/14-6-dna-repair"
  - titulo: "Biology 2e, seção 15.4, RNA Processing in Eukaryotes"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/15-4-rna-processing-in-eukaryotes"
  - titulo: "Biology 2e, seção 16.2, Prokaryotic Gene Regulation"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/16-2-prokaryotic-gene-regulation"
  - titulo: "Biology 2e, seção 16.3, Eukaryotic Epigenetic Gene Regulation"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/16-3-eukaryotic-epigenetic-gene-regulation"
  - titulo: "Biology 2e, seção 16.7, Cancer and Gene Regulation"
    autor: "Mary Ann Clark, Matthew Douglas e Jung Choi (OpenStax)"
    ano: "2018"
    url: "https://openstax.org/books/biology-2e/pages/16-7-cancer-and-gene-regulation"
quiz:
  - pergunta: "Se todas as células do corpo têm o mesmo DNA, por que um neurônio é diferente de uma célula do fígado?"
    opcoes: ["Porque perderam genes diferentes", "Porque ativam conjuntos diferentes de genes", "Porque têm cromossomos diferentes"]
    resposta: 1
    explicacao: "A diferença está na regulação da expressão gênica, não no DNA."
  - pergunta: "No operon lac da bactéria E. coli, o que acontece quando há lactose e falta glicose?"
    opcoes: ["Os genes para usar a lactose são ativados", "A bactéria morre", "Os genes ficam sempre desligados"]
    resposta: 0
    explicacao: "A lactose retira o repressor do DNA, e a falta de glicose favorece a transcrição."
  - pergunta: "O que é o splicing?"
    opcoes: ["A retirada dos íntrons do RNA e a união dos éxons", "A duplicação do DNA", "A ligação de aminoácidos"]
    resposta: 0
    explicacao: "O splicing alternativo permite que um mesmo gene produza proteínas diferentes."
  - pergunta: "O que é a epigenética?"
    opcoes: ["O estudo de mutações na sequência do DNA", "O estudo de mudanças na expressão dos genes que não alteram a sequência do DNA, como a metilação", "O estudo dos vírus"]
    resposta: 1
    explicacao: "Marcas químicas no DNA e nas histonas ligam e desligam genes."
---

## Mesmo DNA, células diferentes

Uma célula do fígado e um neurônio do mesmo corpo têm **o mesmo DNA**. Mas uma fabrica enzimas que desintoxicam o sangue e a outra conduz impulsos elétricos. A diferença está em **quais genes estão ligados** em cada uma. A **biologia molecular** estuda como essa informação é lida, regulada, processada e protegida.

Esta aula aprofunda [DNA, RNA e síntese de proteínas](/trilhas/biologia-medio/dna-rna-e-sintese-de-proteinas).

## Regulação em bactérias: o operon

Em 1961, os franceses **François Jacob** e **Jacques Monod** descreveram como a bactéria *Escherichia coli* decide usar ou não a lactose.

Os genes das enzimas que digerem a lactose ficam juntos, controlados por uma mesma região do DNA: o **operon lac**.

| Situação | O que acontece |
| --- | --- |
| Sem lactose | uma proteína **repressora** se liga ao DNA e bloqueia a transcrição: os genes ficam desligados |
| Com lactose | um derivado da lactose se liga ao repressor, que solta o DNA: os genes podem ser lidos |
| Com glicose disponível | a transcrição fica baixa, porque a bactéria prefere a glicose |
| Com lactose e sem glicose | transcrição alta: a bactéria passa a usar a lactose |

É uma economia notável: a bactéria só fabrica as enzimas quando há o que digerir e não há alimento melhor.

## Regulação em eucariontes

Nos eucariontes, há controle em vários níveis.

| Nível | Exemplo de mecanismo |
| --- | --- |
| **Epigenético** | o DNA enrolado firmemente nas histonas fica inacessível; marcas químicas abrem ou fecham a cromatina |
| **Transcrição** | proteínas chamadas fatores de transcrição se ligam a regiões reguladoras e ligam ou desligam genes |
| **Processamento do RNA** | splicing alternativo |
| **Tradução** | o RNA mensageiro pode ser bloqueado ou degradado |
| **Depois da tradução** | a proteína pode ser ativada, modificada ou destruída |

### Epigenética

O DNA dos eucariontes fica enrolado em proteínas chamadas **histonas**. Marcas químicas mudam o quanto ele está acessível:

- a **metilação do DNA** (acréscimo de grupos metila) tende a **silenciar** genes;
- modificações nas histonas podem **abrir** ou **fechar** a cromatina.

Essas marcas mudam a expressão dos genes **sem alterar a sequência** do DNA, e algumas são transmitidas quando a célula se divide. É assim que as células de um tecido mantêm a sua identidade. O ambiente (alimentação, substâncias tóxicas, estresse) pode influenciar algumas dessas marcas: uma das pontes entre a biologia e as condições de vida.

## O processamento do RNA

Nos eucariontes, o RNA recém-transcrito passa por ajustes antes de sair do núcleo:

- recebe uma "capa" em uma ponta e uma cauda de adeninas na outra, que o protegem;
- sofre **splicing**: os trechos chamados **íntrons** são retirados, e os **éxons** são unidos.

No **splicing alternativo**, os mesmos éxons podem ser combinados de jeitos diferentes. Assim, **um gene pode dar origem a várias proteínas**. Isso ajuda a explicar como cerca de 20 mil genes humanos produzem uma variedade muito maior de proteínas.

```verificar
Um gene tem os éxons 1, 2, 3 e 4. Em um tecido, o RNA maduro tem os éxons 1, 2 e 4; em outro, 1, 3 e 4. O que isso mostra?
- Que houve mutação no DNA
+ Que o splicing alternativo produz proteínas diferentes a partir do mesmo gene
- Que os íntrons viraram éxons
> O DNA é o mesmo nos dois tecidos. O que mudou foi a montagem do RNA.
```

## O reparo do DNA

O DNA sofre danos o tempo todo: erros de cópia, radiação ultravioleta, substâncias químicas. A célula tem sistemas de **reparo**:

- a DNA polimerase **revisa** o que acabou de copiar;
- o **reparo de pareamento** corrige bases mal pareadas que escaparam da revisão;
- o **reparo por excisão** recorta um trecho danificado e o refaz usando a outra fita como molde.

Falhas nesses sistemas aumentam muito o risco de câncer. Pessoas com a doença hereditária *xeroderma pigmentosum*, cujo reparo de danos por ultravioleta é deficiente, desenvolvem câncer de pele com grande facilidade.

## Câncer: a regulação que falha

O câncer resulta do acúmulo de alterações em genes que controlam a divisão celular, vistas em [Divisão celular](/trilhas/biologia-medio/divisao-celular).

| Tipo de gene | Função normal | Quando alterado |
| --- | --- | --- |
| **Proto-oncogenes** | estimulam a divisão quando necessário | viram **oncogenes**: funcionam como um acelerador emperrado |
| **Supressores de tumor** | freiam a divisão e induzem a morte de células danificadas | deixam de funcionar: é como perder o freio |

O gene supressor **p53** é um dos mais estudados: diante de DNA danificado, ele para o ciclo celular para o reparo ou, se o dano é grave, leva a célula à morte programada. Ele está alterado em grande parte dos cânceres humanos.

Além de mutações, alterações **epigenéticas** podem silenciar supressores de tumor. Por isso há remédios contra o câncer que agem sobre essas marcas.

## Para praticar

1. Explique, com o operon lac, por que se diz que a bactéria "economiza" energia.
2. Diferencie mutação de alteração epigenética.
3. Um gene com 3 éxons alternativos pode gerar quantas combinações diferentes, se cada um puder estar ou não presente (mantendo ao menos um)?
4. Por que a perda de um gene supressor de tumor é comparada à perda de um freio?
