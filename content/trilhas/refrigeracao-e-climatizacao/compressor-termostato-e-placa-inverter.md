---
titulo: "Compressor, termostato e placa inverter"
modelo: 9
resumo: "O que cada peça faz (compressor, termostato, capacitor, relé, placa inverter), como reconhecer sinais de defeito e os riscos elétricos de abrir esses componentes."
autores: ["Instituto Lúcia"]
fontes:
  - titulo: "Manual de serviço e esquema elétrico do fabricante do equipamento"
    autor: "Fabricante do equipamento"
  - titulo: "Cursos de qualificação profissional em refrigeração e climatização"
    autor: "Senai"
    url: "https://www.senai.br"
  - titulo: "Norma Regulamentadora nº 10 (Segurança em Instalações e Serviços em Eletricidade)"
    autor: "Ministério do Trabalho e Emprego"
glossario:
  - termo: "compressor"
    definicao: "O 'coração' do sistema: aumenta a pressão do gás e o faz circular."
  - termo: "termostato"
    definicao: "Peça que liga e desliga o compressor conforme a temperatura."
  - termo: "capacitor"
    definicao: "Peça que ajuda a dar partida em motores. Pode guardar carga elétrica mesmo desligado."
  - termo: "inverter"
    definicao: "Tecnologia em que a placa varia a velocidade do compressor, em vez de ligar e desligar."
quiz:
  - pergunta: "Qual é a função do compressor?"
    opcoes: ["Aumentar a pressão do gás e fazê-lo circular pelo sistema", "Iluminar a geladeira", "Medir a conta de luz", "Dar cor ao gás"]
    resposta: 0
    explicacao: "Sem compressor funcionando, o gás não circula, e a troca de calor não acontece."
  - pergunta: "O que o termostato faz numa geladeira comum?"
    opcoes: ["Liga e desliga o compressor conforme a temperatura regulada", "Mede o consumo", "Abre a porta", "Limpa a serpentina"]
    resposta: 0
    explicacao: "Quando a temperatura chega ao valor regulado, o termostato desliga o compressor, e volta a ligar quando esquenta."
  - pergunta: "Por que é perigoso mexer em capacitores e na placa do inverter mesmo com o aparelho desligado?"
    opcoes: ["Podem guardar carga elétrica e dar choque", "Porque são frios", "Porque são pesados", "Não há risco"]
    resposta: 0
    explicacao: "Capacitores guardam carga mesmo desligados. Só profissional formado deve abrir e descarregar corretamente."
  - pergunta: "Compressor travado e queimado costuma ser conserto de:"
    opcoes: ["Custo alto, a comparar com o preço do equipamento antes de decidir", "Custo zero", "Sempre trivial", "Nunca vale a pena avaliar"]
    resposta: 0
    explicacao: "O compressor é peça cara. Compare o orçamento com o valor do aparelho e da vida útil dele antes de aprovar."
---

## O que você vai aprender

Ao fim desta aula você vai saber o que fazem o compressor, o termostato, o capacitor e a placa inverter, reconhecer sinais de defeito e entender por que essas peças exigem formação e cuidado.

```suarealidade
Pense num aparelho de refrigeração que "morreu" no seu bairro: geladeira, freezer de comércio, ar. Disseram que era o compressor ou a placa? O conserto valeu a pena?
```

## As peças e o que fazem

- **Compressor:** circula o gás e aumenta sua pressão. Fica na parte de baixo da geladeira ou na unidade externa do ar.
- **Termostato (e sensores):** controla a temperatura, ligando e desligando o compressor. Em equipamentos modernos, sensores mandam a informação a uma placa.
- **Relé de partida e protetor térmico:** ajudam o compressor a dar partida e o protegem de esquentar demais (geladeiras comuns).
- **Capacitor:** dá o empurrão de partida em motores, e pode guardar carga elétrica.
- **Placa inverter:** em equipamentos inverter, a placa controla a velocidade do compressor. Gasta menos e liga e desliga menos.

## Sinais de defeito

- **Compressor liga e desliga rápido (clique):** pode ser relé, protetor, capacitor ou compressor.
- **Zumbe e não parte:** capacitor ou compressor travado.
- **Aparelho inverter com código de erro no visor ou luzes piscando:** o manual explica os códigos, e eles ajudam a achar o defeito.
- **Aparelho não liga nada:** pode ser alimentação, fusível, placa.

Um **código de erro** do manual vale ouro: ele diz onde olhar, sem trocar peça no escuro.

## Riscos e cuidados

Essas peças mexem com **tensão da rede** e com **carga que fica guardada**. Antes de abrir qualquer coisa: desligue da tomada, aguarde e confirme com o instrumento. **Descarregar capacitor** de forma correta é aprendido em curso. Se você não tem formação (a **NR-10** trata de segurança em eletricidade), deixe para quem tem. Confira também o custo: um compressor é peça cara, e às vezes vale mais substituir o aparelho do que consertar.

```verificar
Por que o capacitor pede cuidado, mesmo com o aparelho desligado?
- Porque é muito quente sempre
+ Porque pode guardar carga elétrica e dar choque
- Porque faz barulho
> Releia "Riscos e cuidados".
```

## Exemplo resolvido

**A geladeira de seu Osvaldo faz "tec" e para, de tempos em tempos, e não gela. O técnico Wagner investiga.**

1. Desliga da tomada e abre a tampa do compartimento do compressor.
2. Reconhece o conjunto do relé e do protetor térmico. Com o multímetro, testa o protetor e o relé.
3. O relé está com defeito: é a causa do "tec" e do desligamento.
4. Troca o relé por peça compatível com o modelo.
5. Liga, mede a corrente do compressor com o alicate amperímetro e vê que está dentro do esperado. A geladeira volta a gelar.
6. Explica ao seu Osvaldo que consertou só uma peça pequena, e que o compressor está bom, e cobra o orçamento combinado.

Se o compressor estivesse queimado, Wagner avisaria o preço e compararia com o de uma geladeira equivalente.

```outrolado
# O argumento mais forte de quem prefere trocar o aparelho
Muitos técnicos e lojistas dizem: "compressor e placa saem tão caros que compensa comprar novo; tentar consertar é jogar dinheiro fora". Em aparelhos velhos, isso tem fundamento.
---
Como você responderia a esse argumento, com respeito e com fatos?
---
Uma resposta possível: em aparelho muito velho e de consumo alto, trocar pode compensar. Mas em muitos casos o defeito é de peça barata (relé, capacitor, sensor), e o conserto faz o equipamento durar anos, o que também reduz lixo eletrônico. Por isso o diagnóstico antes da decisão. Fonte: orientação de formação técnica e dos fabricantes.
```

```agir
# Esta semana
Na etiqueta ou no manual de um aparelho de refrigeração da sua casa, anote o modelo e se é inverter ou não. Procure no manual a lista de códigos de erro, se existir.
```

## Resumo

- Compressor circula o gás; termostato e sensores controlam a temperatura; capacitor e relé ajudam na partida; a placa inverter varia a velocidade do compressor.
- Código de erro do manual ajuda a achar o defeito.
- Capacitor e placa podem guardar carga: só mexa com formação (NR-10).
- Compare o orçamento do conserto com o valor do aparelho antes de decidir.
