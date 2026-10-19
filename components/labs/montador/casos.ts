// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Casos de bancada: o cliente conta o problema, o técnico escolhe os testes (cada um custa tempo) e dá o diagnóstico.
// Do computador ao celular e à eletrônica do dia a dia. Os testes "inúteis" também têm resultado: ensinam o que não olhar.

export type Aparelho = "Computador" | "Notebook" | "Celular" | "Eletrônica";

export interface Caso {
  id: string;
  aparelho: Aparelho;
  titulo: string;
  relato: string;
  testes: { nome: string; resultado: string; minutos: number }[];
  hipoteses: string[];
  certa: number;
  explica: string;
}

export const CASOS: Caso[] = [
  {
    id: "sem-vida", aparelho: "Computador", titulo: "Nenhum sinal de vida",
    relato: "\"Apertei o botão e nada: nem luz, nem ventilador. Ontem caiu a energia aqui na rua.\"",
    testes: [
      { nome: "Medir a tomada com o multímetro (V~)", resultado: "127 V. A tomada está boa.", minutos: 2 },
      { nome: "Olhar a chave liga/desliga atrás da fonte", resultado: "Está na posição I (ligada).", minutos: 1 },
      { nome: "Teste do clipe na fonte (verde com preto)", resultado: "A ventoinha da fonte não gira. O fio roxo (5VSB) dá 0 V.", minutos: 5 },
      { nome: "Trocar o cabo do botão do painel frontal por um jumper", resultado: "Nada muda.", minutos: 4 },
      { nome: "Reencaixar a memória", resultado: "Nada muda.", minutos: 4 },
    ],
    hipoteses: ["Memória queimada", "Fonte queimada pelo pico de energia", "Botão de ligar quebrado", "Processador queimado"],
    certa: 1,
    explica: "Sem o 5 V de espera (roxo) e sem a fonte ligar no teste do clipe, quem morreu foi a fonte, comum depois de queda de energia. Troque por uma fonte de qualidade e indique um filtro de linha de verdade ou nobreak.",
  },
  {
    id: "apitos", aparelho: "Computador", titulo: "Liga, apita e não dá imagem",
    relato: "\"Depois que eu limpei o computador, ele liga, os ventiladores giram, mas apita várias vezes e a tela fica preta.\"",
    testes: [
      { nome: "Contar os apitos e ver no manual da placa-mãe", resultado: "Apitos longos repetidos: o manual diz \"erro de memória\".", minutos: 3 },
      { nome: "Olhar os LEDs de diagnóstico da placa (CPU, DRAM, VGA, BOOT)", resultado: "O LED DRAM fica aceso.", minutos: 1 },
      { nome: "Trocar o cabo do monitor", resultado: "Nada muda.", minutos: 3 },
      { nome: "Tirar e reencaixar os pentes, conferindo as travas", resultado: "Um pente estava com a trava aberta. Depois de encaixar até o clique, o computador dá imagem.", minutos: 4 },
    ],
    hipoteses: ["Placa de vídeo queimada", "Memória mal encaixada depois da limpeza", "HD com defeito", "Fonte fraca"],
    certa: 1,
    explica: "Apito na partida é o POST (autoteste) avisando o que falhou. Apitos longos e o LED DRAM apontam para a memória: depois de mexer no computador, o mais comum é o pente sair um pouco do lugar. Os contatos dourados podem ser limpos com borracha branca.",
  },
  {
    id: "cabo-errado", aparelho: "Computador", titulo: "Computador novo sem imagem",
    relato: "\"Montei meu primeiro PC. Liga tudo, as luzes acendem, mas o monitor diz 'sem sinal'.\"",
    testes: [
      { nome: "Olhar onde o cabo do monitor está ligado", resultado: "No HDMI da placa-mãe, embaixo das portas USB.", minutos: 1 },
      { nome: "Conferir o modelo do processador", resultado: "É da série F (sem vídeo integrado).", minutos: 2 },
      { nome: "LEDs de diagnóstico da placa", resultado: "O LED VGA pisca, depois apaga e o BOOT acende.", minutos: 1 },
      { nome: "Trocar a fonte", resultado: "Nada muda (e levou meia hora).", minutos: 30 },
    ],
    hipoteses: ["Monitor com defeito", "Cabo no lugar errado: tem que ir na placa de vídeo", "Placa-mãe queimada", "Fonte fraca"],
    certa: 1,
    explica: "Processador sem vídeo integrado não usa as saídas da placa-mãe. O cabo vai nas saídas da placa de vídeo, que ficam mais embaixo, na horizontal. Erro clássico de primeira montagem.",
  },
  {
    id: "desliga-jogo", aparelho: "Computador", titulo: "Desliga sozinho no jogo",
    relato: "\"No navegador vai bem, mas é abrir o jogo que em 10 minutos desliga do nada.\"",
    testes: [
      { nome: "Ver as temperaturas no programa de monitoramento", resultado: "Processador a 98 °C sob carga.", minutos: 5 },
      { nome: "Abrir e olhar o cooler", resultado: "Aletas entupidas de poeira e a pasta térmica seca, esfarelando.", minutos: 5 },
      { nome: "Somar o consumo das peças e comparar com a fonte", resultado: "Uns 380 W de consumo numa fonte de 650 W de qualidade: sobra.", minutos: 4 },
      { nome: "Rodar teste de memória", resultado: "Nenhum erro.", minutos: 45 },
    ],
    hipoteses: ["Fonte fraca", "Superaquecimento: poeira e pasta térmica seca", "Memória com defeito", "Vírus"],
    certa: 1,
    explica: "A 98 °C o processador chega no limite e o computador desliga para se proteger. Limpe com pincel e ar (segurando a hélice para ela não girar), troque a pasta térmica e confira se o cooler está bem preso.",
  },
  {
    id: "cmos", aparelho: "Computador", titulo: "Data e hora sempre erradas",
    relato: "\"Toda vez que tiro da tomada, o relógio volta para 2009 e o Windows reclama dos sites.\"",
    testes: [
      { nome: "Medir a bateria CR2032 da placa-mãe", resultado: "2,1 V (nova tem uns 3 V).", minutos: 3 },
      { nome: "Atualizar o Windows", resultado: "Nada muda.", minutos: 20 },
      { nome: "Trocar o cabo de força", resultado: "Nada muda.", minutos: 2 },
    ],
    hipoteses: ["Bateria da placa-mãe (CMOS) gasta", "HD com defeito", "Fonte com defeito", "Vírus"],
    certa: 0,
    explica: "A bateria redonda da placa-mãe mantém o relógio e as configurações da BIOS sem energia. Abaixo de uns 2,7 V, ela perde tudo. Trocar custa pouco: CR2032 nova, com o polo + para cima.",
  },
  {
    id: "hd-estalando", aparelho: "Computador", titulo: "Lento e fazendo \"tec, tec\"",
    relato: "\"Está cada vez mais lento para abrir as coisas e faz um barulho de estalo.\"",
    testes: [
      { nome: "Ler o SMART do disco", resultado: "Setores realocados: 312 e subindo. Estado: \"cuidado\".", minutos: 5 },
      { nome: "Ouvir o disco de perto", resultado: "Estalos repetidos (a cabeça de leitura tentando de novo).", minutos: 1 },
      { nome: "Gerenciador de tarefas", resultado: "Disco em 100% o tempo todo, processador folgado.", minutos: 2 },
      { nome: "Passar antivírus", resultado: "Nada encontrado (e demorou horas por causa do disco).", minutos: 90 },
    ],
    hipoteses: ["Vírus", "HD morrendo: copiar os dados já e trocar por SSD", "Memória pouca", "Processador velho"],
    certa: 1,
    explica: "Setores realocados subindo e estalos indicam HD mecânico falhando. A prioridade é o backup, antes que pare de vez. Depois, troque por um SSD e clone ou reinstale o sistema.",
  },
  {
    id: "tela-azul", aparelho: "Computador", titulo: "Tela azul aleatória",
    relato: "\"Dá tela azul do nada, cada vez com um erro diferente.\"",
    testes: [
      { nome: "Rodar o MemTest86 a noite inteira", resultado: "Erros a partir do endereço 12 GB.", minutos: 60 },
      { nome: "Testar um pente por vez", resultado: "Com o pente A, zero erros; com o pente B, erros na primeira passada.", minutos: 60 },
      { nome: "Reinstalar o Windows", resultado: "As telas azuis continuam.", minutos: 90 },
      { nome: "Temperaturas", resultado: "Normais: 65 °C sob carga.", minutos: 5 },
    ],
    hipoteses: ["Windows corrompido", "Um pente de memória com defeito", "Superaquecimento", "Placa de vídeo"],
    certa: 1,
    explica: "Erros diferentes a cada tela azul são típicos de memória. O teste pente por pente acha o culpado. Antes de condenar o pente, vale desligar o XMP/EXPO (o perfil de velocidade) e testar de novo.",
  },
  {
    id: "liga-desliga", aparelho: "Computador", titulo: "Liga e desliga em um segundo",
    relato: "\"Acabei de trocar de gabinete. Aperto o botão, ele liga e desliga na hora, em loop.\"",
    testes: [
      { nome: "Montar a placa fora do gabinete, sobre a caixa (teste de bancada)", resultado: "Fora do gabinete, liga normal e dá imagem.", minutos: 15 },
      { nome: "Olhar os espaçadores do gabinete novo", resultado: "Tem um espaçador num furo onde a placa não tem furo: encosta embaixo dela.", minutos: 3 },
      { nome: "Trocar a pasta térmica", resultado: "Nada muda.", minutos: 10 },
    ],
    hipoteses: ["Processador queimado", "Curto: espaçador sobrando encostando na placa", "Memória", "BIOS desatualizada"],
    certa: 1,
    explica: "Se funciona fora do gabinete e não dentro, algo no gabinete faz curto: espaçador a mais, parafuso solto embaixo da placa ou o espelho traseiro encostando. Espaçador só nos furos que a placa tem.",
  },
  {
    id: "note-carregador", aparelho: "Notebook", titulo: "Notebook não liga nem na tomada",
    relato: "\"A bateria acabou e agora não liga mais, nem com o carregador. A luzinha do carregador acende.\"",
    testes: [
      { nome: "Medir a saída do carregador na ponta do plugue", resultado: "Mexendo no cabo perto do plugue, oscila entre 0 V e 19,5 V.", minutos: 3 },
      { nome: "Continuidade do cabo dobrando perto do plugue", resultado: "O bipe falha quando dobra.", minutos: 3 },
      { nome: "Trocar a memória do notebook", resultado: "Nada muda.", minutos: 10 },
      { nome: "Testar com outro carregador compatível (mesma tensão e o plugue certo)", resultado: "Liga e começa a carregar.", minutos: 3 },
    ],
    hipoteses: ["Placa-mãe do notebook queimada", "Cabo do carregador partido perto do plugue", "Bateria viciada", "Tela queimada"],
    certa: 1,
    explica: "A luz do carregador só mostra que chega energia até ali. O fio rompe por dentro onde mais dobra, perto do plugue. Troque o carregador (mesma tensão, potência igual ou maior, mesmo plugue) e não enrole o cabo apertado.",
  },
  {
    id: "note-bateria", aparelho: "Notebook", titulo: "Só funciona na tomada",
    relato: "\"Tirou da tomada, desliga. A bateria mostra 100%, mas não dura nada.\"",
    testes: [
      { nome: "Relatório de bateria do sistema (powercfg /batteryreport)", resultado: "Capacidade de projeto: 45.000 mWh. Capacidade atual: 3.600 mWh. 1.150 ciclos.", minutos: 3 },
      { nome: "Olhar se a bateria está estufada (o touchpad levanta?)", resultado: "Não está estufada.", minutos: 2 },
      { nome: "Trocar o carregador", resultado: "Nada muda.", minutos: 3 },
    ],
    hipoteses: ["Bateria no fim da vida útil", "Carregador fraco", "Problema no Windows", "Placa-mãe"],
    certa: 0,
    explica: "Com 8% da capacidade original e mais de mil ciclos, a bateria acabou: a química do íon-lítio se desgasta com o uso. Troque pela peça certa do modelo. Se estiver estufada, pare de usar na hora.",
  },
  {
    id: "cel-carga", aparelho: "Celular", titulo: "Celular não carrega",
    relato: "\"Só carrega se eu deixar o cabo torto, segurando. Já troquei o cabo.\"",
    testes: [
      { nome: "Testar outro cabo e outro carregador que funcionam", resultado: "Mesmo problema.", minutos: 3 },
      { nome: "Lanterna e lupa dentro da porta USB-C", resultado: "Fiapo de poeira compactado no fundo; o plugue não entra até o fim.", minutos: 2 },
      { nome: "Trocar a bateria", resultado: "Nada muda (e é caro).", minutos: 40 },
      { nome: "Medidor USB entre o carregador e o cabo", resultado: "Na posição torta, 5 V e 1,8 A; reto, 0 A.", minutos: 3 },
    ],
    hipoteses: ["Conector de carga quebrado", "Sujeira compactada na porta", "Bateria viciada", "Placa queimada"],
    certa: 1,
    explica: "Bolso acumula fiapo que o plugue vai compactando no fundo da porta. Desligue o celular e tire com um palito de madeira ou plástico, com calma. Nunca use alfinete ou metal: risca os contatos e pode fazer curto. Se não resolver, aí sim o conector pode estar gasto.",
  },
  {
    id: "cel-estufada", aparelho: "Celular", titulo: "A tela está levantando",
    relato: "\"A tela começou a descolar de um lado e o celular está meio gordinho.\"",
    testes: [
      { nome: "Olhar de lado contra uma superfície plana", resultado: "O aparelho balança: a traseira está abaulada.", minutos: 1 },
      { nome: "Saúde da bateria nas configurações", resultado: "71%.", minutos: 1 },
      { nome: "Colar a tela com cola", resultado: "Não faça isso: a pressão é de dentro para fora.", minutos: 5 },
    ],
    hipoteses: ["Tela com defeito", "Bateria estufada", "Celular caiu", "Calor do sol"],
    certa: 1,
    explica: "Bateria de íon-lítio estufada solta gás e pode pegar fogo se furada, dobrada ou carregada. Pare de carregar, não aperte, e leve a uma assistência para trocar. A velha vai para o ponto de coleta, nunca para o lixo comum.",
  },
  {
    id: "cel-esquenta", aparelho: "Celular", titulo: "Esquenta e a bateria some",
    relato: "\"Desde semana passada esquenta parado no bolso e a bateria não dura meio dia.\"",
    testes: [
      { nome: "Uso de bateria por aplicativo", resultado: "Um app de lanterna baixado de fora da loja: 58% da bateria, em segundo plano.", minutos: 2 },
      { nome: "Saúde da bateria", resultado: "92%: boa.", minutos: 1 },
      { nome: "Trocar a bateria", resultado: "Continua esquentando.", minutos: 40 },
    ],
    hipoteses: ["Bateria ruim", "Aplicativo rodando escondido (talvez malicioso)", "Placa com curto", "Carregador"],
    certa: 1,
    explica: "Nem todo problema é peça: antes de abrir, olhe o software. Um app consumindo mais da metade da bateria em segundo plano explica o calor. Desinstale, revise as permissões e mantenha o sistema atualizado.",
  },
  {
    id: "capacitor", aparelho: "Eletrônica", titulo: "Caixa de som não liga mais",
    relato: "\"Ligava, fazia um chiado e um dia parou de vez. Cheiro estranho nunca teve.\"",
    testes: [
      { nome: "Olhar a placa da fonte com a caixa desligada", resultado: "Um capacitor eletrolítico grande está com o topo estufado e um líquido marrom seco.", minutos: 5 },
      { nome: "Medir o fusível (fora do circuito, sem energia)", resultado: "Continuidade: está bom.", minutos: 3 },
      { nome: "Ler o capacitor", resultado: "1000 µF, 25 V, 105 °C.", minutos: 1 },
    ],
    hipoteses: ["Alto-falante rasgado", "Capacitor eletrolítico estufado", "Fusível queimado", "Cabo de áudio"],
    certa: 1,
    explica: "Capacitor estufado é uma das falhas mais comuns em fontes. Troque por um de mesma capacitância (1000 µF), tensão igual ou maior (25 V ou 35 V) e 105 °C, respeitando a polaridade (a faixa marca o negativo). Antes de mexer, descarregue os capacitores: eles guardam carga mesmo desligados.",
  },
  {
    id: "controle", aparelho: "Eletrônica", titulo: "Controle remoto parou",
    relato: "\"A TV funciona pelos botões, mas o controle não faz nada.\"",
    testes: [
      { nome: "Apontar o controle para a câmera do celular e apertar um botão", resultado: "Nenhuma luz piscando na câmera.", minutos: 1 },
      { nome: "Medir as pilhas", resultado: "1,08 V e 1,11 V (novas têm uns 1,5 V).", minutos: 2 },
      { nome: "Trocar a TV de tomada", resultado: "Nada muda.", minutos: 2 },
    ],
    hipoteses: ["Pilhas fracas", "TV com defeito", "LED infravermelho queimado", "Controle precisa ser pareado"],
    certa: 0,
    explica: "A câmera do celular enxerga o infravermelho que o olho não vê: sem piscar, o controle não está emitindo. Pilhas abaixo de 1,2 V já não dão conta. Se com pilhas novas a câmera continuar sem ver nada, aí suspeite do LED ou da placa.",
  },
  {
    id: "wifi", aparelho: "Computador", titulo: "Internet cai só neste computador",
    relato: "\"No celular a internet vai bem; no computador cai toda hora.\"",
    testes: [
      { nome: "Ligar o computador no roteador por cabo", resultado: "Por cabo, estável o dia inteiro.", minutos: 5 },
      { nome: "Olhar as antenas da placa Wi-Fi atrás do gabinete", resultado: "Uma das duas antenas não está rosqueada.", minutos: 1 },
      { nome: "Gerenciador de dispositivos", resultado: "Driver da placa Wi-Fi de 2019, genérico.", minutos: 3 },
      { nome: "Trocar o roteador", resultado: "Não dá para testar: é o da operadora.", minutos: 0 },
    ],
    hipoteses: ["Problema no provedor", "Antena solta e driver antigo da placa Wi-Fi", "Vírus", "Fonte"],
    certa: 1,
    explica: "Se por cabo funciona, a internet e o roteador estão bem: o problema é no Wi-Fi deste computador. Rosqueie as antenas e instale o driver do fabricante da placa. Teste isolando uma parte de cada vez.",
  },
];

/** Antes de abrir qualquer aparelho. */
export const SEGURANCA = [
  ["Tire da tomada", "E espere um minuto: fontes e TVs guardam carga nos capacitores. Fonte de PC e de TV não se abre sem treino."],
  ["Pulseira antiestática", "Presa no metal do gabinete. Sem ela, toque no metal antes de pegar as peças e segure-as pelas bordas."],
  ["Bateria de lítio", "Nunca fure, dobre, aqueça ou aperte. Estufada: pare de usar e leve ao ponto de coleta."],
  ["Ferramenta certa", "Chave Phillips do tamanho certo (espanar parafuso estraga a peça), espátula plástica para celular, pincel e ar para limpeza."],
  ["Backup primeiro", "Antes de mexer no disco ou no sistema, copie os dados do cliente. A peça se troca, a foto da família não."],
  ["Anote tudo", "Fotografe cada etapa e separe os parafusos por lugar: no notebook e no celular, parafuso errado pode furar a placa."],
];
