---
titulo: "Multímetro e fonte de bancada"
modelo: 9
resumo: "O que o multímetro mede, como testar continuidade e tensão, para que serve a fonte de bancada e como usá-la com segurança num celular."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Cursos de qualificação profissional em eletrônica e manutenção de celulares"
    autor: "Senai"
    url: "https://www.senai.br"
  - titulo: "Manual do multímetro e da fonte de bancada utilizados"
    autor: "Fabricante do equipamento"
glossario:
  - termo: "tensão (volt, V)"
    definicao: "A força que empurra a corrente num circuito. A bateria de celular tem poucos volts."
  - termo: "corrente (ampère, A)"
    definicao: "A quantidade de eletricidade que passa pelo circuito."
  - termo: "continuidade"
    definicao: "Teste que mostra se dois pontos estão ligados por um caminho elétrico."
quiz:
  - pergunta: "Para saber se um fio ou trilha está interrompido, qual função do multímetro se usa?"
    opcoes: ["Continuidade (ou resistência baixa)", "Frequência", "Temperatura", "Capacitância sempre"]
    resposta: 0
    explicacao: "No teste de continuidade, o aparelho apita se há caminho entre os dois pontos, o que mostra que o fio ou trilha está inteiro."
  - pergunta: "Para que serve a fonte de bancada num conserto de celular?"
    opcoes: ["Para alimentar o aparelho com tensão controlada e ver quanta corrente ele consome, o que ajuda a achar curto e outras falhas", "Para carregar a bateria sem controle", "Para esquentar a placa", "Para aumentar a tela"]
    resposta: 0
    explicacao: "A fonte permite ajustar a tensão e limitar a corrente. Um consumo anormal indica curto ou defeito na placa."
  - pergunta: "Antes de medir tensão em corrente contínua, é preciso:"
    opcoes: ["Colocar o multímetro na função certa (V contínua) e as pontas nos encaixes certos", "Qualquer posição serve", "Tirar as pontas", "Molhar a placa"]
    resposta: 0
    explicacao: "Função ou encaixe errado pode estragar o multímetro ou dar medida errada. Confira o manual."
  - pergunta: "Medir a bateria de lítio do celular com o multímetro exige cuidado porque:"
    opcoes: ["As pontas não podem encostar uma na outra nos polos, pois um curto-circuito pode esquentar e pegar fogo", "A bateria não tem tensão", "Não há risco algum", "O multímetro é de papel"]
    resposta: 0
    explicacao: "Curto-circuito na bateria de lítio é perigoso. Use pontas finas e firmes, sem deslizar. Veja a aula de segurança."
---

## O que você vai aprender

Ao fim desta aula você vai saber para que servem o multímetro e a fonte de bancada, fazer um teste de continuidade e de tensão e usar a fonte com segurança.

```suarealidade
Qual instrumento de medição você já viu ser usado na sua casa, num serviço de eletricista ou numa assistência? Para que serviu?
```

## O multímetro

O multímetro mede **tensão** (volts), **corrente** (ampères) e **resistência** (ohms), e tem a função de **continuidade**. Para o dia a dia no celular, você usa duas:

1. **Continuidade:** coloque na função com o símbolo de apito. Encoste as pontas em dois pontos. Se apitar, há caminho elétrico entre eles. Usa-se para ver se um fio, trilha ou fusível está inteiro. **Sempre com o aparelho desligado e sem bateria.**
2. **Tensão contínua (V com traço):** mede quanto há entre dois pontos de um circuito ligado, por exemplo a tensão da bateria.

Passos básicos: ponta preta no encaixe comum, vermelha no encaixe de tensão, função certa, pontas nos pontos certos, sem deslizar. Se a leitura parece absurda, confira a função e as pontas.

## A fonte de bancada

A **fonte de bancada** é uma fonte ajustável. Você escolhe a **tensão** (a de uma bateria de celular costuma ser de poucos volts: veja o rótulo da bateria) e **limita a corrente**. Ela mostra, num visor, quanta corrente o aparelho puxa. Assim:

- Aparelho que **não consome nada** pode ter caminho aberto ou bateria ausente.
- Aparelho que **consome demais e a corrente sobe e fica alta** pode ter curto. O limite da fonte protege a placa.
- Consumo estranho muda o rumo do diagnóstico, e você não precisa trocar peça por tentativa.

## Segurança

- Ajuste a tensão e o limite de corrente **antes** de ligar. Não passe do indicado para o aparelho.
- Não ligue a fonte sem saber a polaridade: positivo no positivo, negativo no negativo.
- Evite medir com a bateria de lítio ligada e as pontas soltas. Não curto-circuite os polos.
- Se aquecer, cheirar ou fumaçar, desligue e afaste.

```verificar
Para que serve limitar a corrente na fonte de bancada?
- Para o aparelho andar mais rápido
+ Para proteger a placa se houver curto
- Para carregar mais rápido
> Releia "A fonte de bancada".
```

## Exemplo resolvido

**Chegou um celular que "morreu" depois de uma queda. O técnico Beto usa a fonte e o multímetro.**

1. Tira a bateria e liga o aparelho à fonte de bancada, com a tensão e o limite de corrente recomendados para o modelo.
2. Liga e olha o visor: a corrente sobe um pouco e volta a zero, ou fica muito alta?
3. Neste caso, a corrente sobe e fica alta: sinal de curto na placa.
4. Beto desliga e usa o multímetro na função de continuidade em pontos de alimentação para localizar onde está o curto, seguindo o esquema do modelo.
5. Informa ao cliente que o conserto exige trabalho de placa e dá o orçamento, ou encaminha a um especialista.

Beto não trocou peça por tentativa e deu uma resposta honesta.

```outrolado
# O argumento mais forte de quem diz que não precisa de instrumento
Há técnicos experientes que dizem: "eu conserto no olho e na prática, instrumento é gasto". A experiência vale muito e há quem faça serviços simples só com ferramenta básica.
---
Como você responderia a esse argumento, com respeito e com fatos?
---
Uma resposta possível: para trocas simples, a prática basta. Mas para falhas de placa, curto e consumo, medir evita chute, e um multímetro básico custa pouco perto do prejuízo de uma troca errada. A fonte de bancada é investimento maior e se paga com o tempo. Fonte: orientação de formação técnica em eletrônica.
```

```agir
# Esta semana
Se tiver um multímetro à mão, treine a continuidade em um fio ou fusível comum de casa, com tudo desligado da tomada. Se não tiver, pesquise o preço de um e anote.
```

## Resumo

- Multímetro mede tensão, corrente e resistência e testa continuidade.
- Continuidade se testa com tudo desligado; tensão, com a função e as pontas certas.
- Fonte de bancada dá tensão ajustável e limita a corrente: protege a placa e mostra o consumo.
- Cuidado com curto na bateria de lítio.
