---
titulo: "Por dentro do celular: peças e ferramentas"
modelo: 9
resumo: "O que tem dentro do celular (tela, placa, bateria, conector, câmeras, alto-falante), as ferramentas de uma bancada simples, a eletricidade estática e como montar um lugar de trabalho que não estraga o aparelho."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Cursos de qualificação profissional em eletroeletrônica e manutenção de celulares"
    autor: "Senai"
    url: "https://www.senai.br"
  - titulo: "Lei nº 8.078, de 11 de setembro de 1990 (Código de Defesa do Consumidor), artigos 21 e 40"
    autor: "Brasil, Presidência da República"
    ano: "1990"
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
  - titulo: "Resolução Conama nº 401, de 4 de novembro de 2008 (pilhas e baterias)"
    autor: "Conselho Nacional do Meio Ambiente (Conama)"
    ano: "2008"
glossario:
  - termo: "placa-mãe"
    definicao: "A placa principal do celular, com o processador, a memória e a maior parte dos circuitos."
  - termo: "flat"
    definicao: "Cabo plano e fino que liga as peças à placa, como a tela e o botão de volume."
  - termo: "ESD"
    definicao: "Descarga eletrostática: a faísca de estática que pode queimar circuitos sem a gente perceber."
quiz:
  - pergunta: "O que faz a placa-mãe do celular?"
    opcoes: ["É a peça que guarda a energia", "Reúne o processador, a memória e os circuitos que ligam as outras peças", "Só serve de suporte para a tela"]
    resposta: 1
    explicacao: "A placa-mãe é o cérebro e o sistema nervoso do aparelho. Quase todas as outras peças ligam a ela."
  - pergunta: "Por que se usa pulseira antiestática na bancada?"
    opcoes: ["Para a mão não suar", "Para descarregar a estática do corpo, que pode queimar circuitos sem a gente perceber", "Para a pessoa não cansar o pulso"]
    resposta: 1
    explicacao: "A estática do corpo é invisível e pode danificar chips. A pulseira e o tapete aterram essa carga."
  - pergunta: "Qual ferramenta é a melhor para separar a tela do corpo do celular sem riscar a placa?"
    opcoes: ["Chave de fenda de metal grossa", "Espátula e palheta de plástico, com calor leve", "Faca de cozinha"]
    resposta: 1
    explicacao: "Plástico não risca circuitos nem faz curto. A cola da tela amolece com calor leve."
  - pergunta: "O que é o 'flat'?"
    opcoes: ["Um tipo de tela", "Um cabo plano e fino que liga peças à placa e quebra fácil se for dobrado ou puxado", "Um modelo de celular"]
    resposta: 1
    explicacao: "Flats rasgam com facilidade. Soltam-se levantando o conector, nunca puxando o cabo."
  - pergunta: "Um orçamento de conserto, segundo o Código de Defesa do Consumidor, deve ter:"
    opcoes: ["Só o preço final, falado de boca", "Valor da mão de obra, preço das peças, prazo de execução e de validade do orçamento", "Nada: orçamento é opcional"]
    resposta: 1
    explicacao: "O artigo 40 manda o fornecedor entregar orçamento prévio com valor, condições de pagamento, prazos e custo das peças."
---

```provocacao
Um celular caro e um celular simples parecem muito diferentes por fora. Por dentro, as peças são surpreendentemente parecidas. O que muda, e por que isso importa para quem conserta?
```

## O que você vai aprender

Ao fim desta aula você vai saber nomear as principais peças do celular, escolher as ferramentas de uma bancada simples, evitar os danos da eletricidade estática e montar o lugar de trabalho.

```suarealidade
Quais peças do celular você já viu quebrar ou trocar no seu bairro? E quem fez o conserto: um técnico de confiança, um quiosque, um parente?
```

## As peças do celular

Quase todo smartphone tem as mesmas partes:

- **Tela e vidro.** Em geral, uma peça só: o painel (que mostra a imagem) e o toque (que sente o dedo) vêm colados.
- **Placa-mãe.** A placa principal, com processador, memória, chip de rede e os circuitos de energia.
- **Bateria.** Íons de lítio, em geral colada dentro do aparelho.
- **Conector de carga.** A entrada do cabo; é uma das peças que mais quebra, porque é usada todo dia.
- **Câmeras.** A da frente e as de trás, ligadas à placa por flats.
- **Alto-falante, fone de ouvido (auricular) e microfone.** Peças pequenas e que juntam poeira.
- **Botões e vibracall.** Botões laterais e o motorzinho que vibra.
- **Antenas e leitor de chip.** Responsáveis pelo sinal e pelo cartão SIM.

Entender o que cada peça faz ajuda a pensar no defeito: se a tela mostra imagem mas não responde ao toque, o problema não é a bateria.

## A bancada simples

Para começar, uma bancada pequena e limpa basta. Itens úteis:

- **Jogo de chaves de precisão**: Phillips pequeno, Pentalobe (comum em aparelhos de uma marca conhecida) e Torx pequeno;
- **Espátula e palhetas de plástico**, ventosa e **pinça** de ponta fina (de preferência antiestática);
- **Tapete e pulseira antiestática**;
- **Fonte de ar quente** ou chapa de aquecimento, para amolecer a cola;
- **Álcool isopropílico**, pano que não solta fiapo e fita adesiva;
- **Lupa ou microscópio** simples para olhar solda e conector;
- **Multímetro** (aparelho que mede tensão e continuidade), para usar nas aulas de diagnóstico;
- **Potes ou imãs** para guardar parafusos **por ordem de posição**, porque parafuso trocado perfura a placa;
- **Boa luz** e uma **mesa sem papel**.

Ferramentas melhores vêm depois, quando o trabalho der dinheiro: estação de solda, microscópio, fonte de bancada.

## A inimiga invisível: a estática

Quando você anda no tapete e leva um choque ao encostar na porta, é eletricidade estática. Para o corpo, é só um susto. Para os circuitos do celular, uma descarga dessas pode **queimar um chip sem nenhum sinal na hora**, e o aparelho morre dias depois.

Por isso, na bancada:

1. Use **pulseira antiestática** ligada a um ponto de aterramento, ou **toque em uma peça metálica aterrada** antes de pegar a placa.
2. Segure as peças pelas **bordas**, sem encostar nos contatos dourados.
3. Evite roupa de lã ou sintética e tapete de nylon perto da bancada.
4. Guarde as peças em **saco antiestático**.

## Montando o lugar de trabalho

- **Luz forte**, de preferência branca e voltada para a mesa.
- **Mesa firme, limpa e seca**, com um tapete.
- **Caixas separadas** para peças e parafusos de cada aparelho. Uma etiqueta com o nome do cliente ajuda muito.
- **Tomada com proteção** e fio em bom estado. Fio descascado na bancada é risco de choque.
- **Local ventilado**, longe de crianças e de líquido.

```verificar
Você está com a placa na mão. Qual hábito protege mais o aparelho?
- Segurar a placa pelos contatos dourados, para firmar
+ Segurar pelas bordas, com a pulseira antiestática ligada, sem encostar nos chips
- Apoiar a placa em cima de uma flanela
> A estática pode queimar circuitos sem sinal imediato.
```

## O orçamento também é ferramenta

O **Código de Defesa do Consumidor** (Lei nº 8.078/1990, artigo 40) diz que o fornecedor deve entregar **orçamento prévio** com o valor da mão de obra, o preço dos materiais, as condições de pagamento e os prazos. A validade do orçamento, na falta de combinação, é de **10 dias**. Anote também o **estado do aparelho** quando o cliente o entrega (riscos, amassados, se liga ou não), para as duas partes saberem como ele chegou.

## Exemplo resolvido

**Carla vai montar uma bancada de conserto em casa com R$ 300. Como ela deve gastar?**

```conta
Essencial agora: jogo de chaves de precisão, espátulas e palhetas de plástico, ventosa, pinça
Segurança: pulseira e tapete antiestáticos, caixa para parafusos, luz forte
Para a cola da tela: fonte de ar quente simples ou chapa de aquecimento
Fica para depois: microscópio, estação de solda, fonte de bancada
```

Carla compra primeiro o que **protege o aparelho e quem trabalha**. Ferramenta de solda só quando já tiver clientes e aprender a usar.

```outrolado
# O argumento de quem acha que dá para improvisar
"Eu abro celular com chave de fenda comum e uma faca de mesa. Nunca perdi um aparelho. Comprar tanta ferramenta e pulseira é gastar dinheiro que não tenho."
---
Como você responderia, respeitando a limitação de dinheiro?
---
Improvisar é um jeito de começar, e muita gente começou assim. O problema é o custo escondido: uma tela riscada, um flat rasgado ou uma placa queimada por estática custam bem mais que a ferramenta certa. O kit básico é barato e se paga na primeira peça que você não perde. E o risco do cliente também conta: o artigo 21 do Código de Defesa do Consumidor trata da qualidade do conserto.
```

```agir
# Esta semana
Pegue uma folha e desenhe o contorno de um celular. Escreva ao lado onde ficam a tela, a bateria, o conector de carga e a placa. Se você tiver um celular velho e sem uso, só olhe por fora e compare com o desenho.
```

## Resumo

- Por dentro, o celular tem **tela, placa-mãe, bateria, conector de carga, câmeras, alto-falante, microfone e antenas**.
- Uma **bancada simples** tem chaves de precisão, ferramentas de plástico, pinça, pulseira antiestática, luz e caixa para parafusos.
- A **estática** queima circuitos sem aviso: pulseira, tapete e cuidado nas bordas.
- Parafuso, peça e aparelho de cada cliente ficam **separados e etiquetados**.
- O **orçamento** (CDC, art. 40) deve dizer valor, peças, prazo e validade.

```realidade
Faça a lista da sua bancada: o que você já tem, o que falta e o que custa o essencial.
```

```leve
- Mostre a alguém como separar os parafusos por ordem antes de abrir um aparelho.
- Divida com um colega de ofício o custo de uma ferramenta cara que vocês usam pouco.
```
