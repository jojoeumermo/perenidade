// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O mapa de TODOS os laboratórios do site (NOVAS TAREFAS, T21): os do próprio site (/laboratorios/*), os de fora
// (content/labs-externos/catalogo.json, abertos em /laboratorios/externos) e os simuladores que vivem dentro das aulas
// (bloco ```simulador, lib/simuladores-aula.ts). Para cada um: para que serve, para quem, em que disciplinas e aulas ajuda e
// onde fica. É daqui que saem a página /laboratorios (por finalidade e por disciplina), os "aulas em que ajuda" de cada
// laboratório e o "laboratórios para esta aula" das aulas. Conferido por `npm run testar:mapa-dos-laboratorios`
// (toda aula listada existe, todo laboratório externo e toda página de laboratório estão aqui, nada some).
// Sem os atalhos "@/" de propósito, para o teste rodar no Node.
//
// Os textos "serve para" e "para quem" estão em português e inglês (como as descrições do catálogo de fora); os outros
// idiomas mostram o inglês. Os títulos e rótulos da interface ficam nos dicionários (i18n/*.json, labs.mapa).

import type { AreaSlug } from "./areas";

/** As finalidades, na ordem em que aparecem na página. Os nomes e as frases ficam em t.labs.mapa.finalidades. */
export const FINALIDADES = [
  "programar",
  "computador-e-rede",
  "seguranca",
  "eletrica-e-conserto",
  "ciencias",
  "dados-e-modelos",
  "sociedade-e-historia",
  "ia",
  "criar",
  "musica",
] as const;
export type Finalidade = (typeof FINALIDADES)[number];

/** Onde o laboratório mora: página própria do site, catálogo de fora (carrega só ao abrir) ou dentro das aulas. */
export type Morada = "site" | "fora" | "aula";

interface Textos {
  /** Uma frase: para que ele serve. */
  serve: string;
  /** Uma frase: para quem ele é. */
  quem: string;
}

export interface LabNoMapa {
  /** Para os do site, a chave em t.labs (ide, redes…); para os de fora, o id do catálogo; para os da aula, "aula:<tipo>". */
  id: string;
  morada: Morada;
  finalidade: Finalidade;
  /** Endereço sem o idioma. Os de fora apontam para o próprio cartão em /laboratorios/externos; os da aula, para a primeira aula. */
  rota: string;
  /** Selo (ícone) dos cartões; os de fora e os da aula usam um selo da família. */
  selo: string;
  disciplinas: AreaSlug[];
  /** "trilha/aula": aulas em que o laboratório ajuda (para os da aula: as aulas que trazem o simulador). */
  aulas: string[];
  /** Nome próprio, só para os que não têm nome nos dicionários nem no catálogo (os simuladores das aulas). */
  nome?: { pt: string; en: string };
  pt: Textos;
  en: Textos;
}

export const MAPA_DOS_LABORATORIOS: LabNoMapa[] = [
  // ── Programar ──
  {
    id: "ide",
    morada: "site",
    finalidade: "programar",
    rota: "/laboratorios/ide",
    selo: "terminal",
    disciplinas: ["programacao", "informatica", "engenharia-de-sistemas", "inteligencia-artificial", "web-design"],
    aulas: [
      "logica-de-programacao/01-o-que-e-um-algoritmo",
      "logica-de-programacao/03-condicoes",
      "python-do-zero/seu-primeiro-programa-em-python",
      "python-do-zero/variaveis-tipos-e-entrada-de-dados-em-python",
      "python-do-zero/listas-em-python",
      "php-do-zero/o-que-e-php-e-o-seu-primeiro-script",
      "php-do-zero/arrays-em-php",
    ],
    pt: {
      serve: "Escrever e rodar programas de verdade no navegador (Python, JavaScript, C, PHP, SQL, Web e mais), com exercícios que se corrigem sozinhos.",
      quem: "Quem está começando a programar e quem já programa e quer treinar sem instalar nada.",
    },
    en: {
      serve: "Write and run real programs in the browser (Python, JavaScript, C, PHP, SQL, Web and more), with self-checking exercises.",
      quem: "Beginners and people who already code and want to practise without installing anything.",
    },
  },
  {
    id: "aula:execucao",
    morada: "aula",
    finalidade: "programar",
    rota: "/trilhas/logica-de-programacao/02-variaveis-e-tipos",
    selo: "terminal",
    disciplinas: ["programacao", "informatica"],
    aulas: [
      "logica-de-programacao/02-variaveis-e-tipos",
      "logica-de-programacao/04-lacos-de-repeticao",
      "logica-de-programacao/05-funcoes",
      "python-do-zero/lacos-em-python-while-e-for",
      "python-do-zero/funcoes-em-python",
    ],
    nome: { pt: "Execução passo a passo (dentro da aula)", en: "Step-by-step execution (inside the lesson)" },
    pt: {
      serve: "Ver o programa rodar linha por linha: o valor de cada variável, a pilha de funções e a saída, com erros explicados em português.",
      quem: "Quem está aprendendo laço, função e variável e ainda não enxerga o que o computador faz.",
    },
    en: {
      serve: "Watch the program run line by line: each variable's value, the call stack and the output, with errors explained.",
      quem: "People learning loops, functions and variables who cannot yet picture what the computer does.",
    },
  },

  // ── Computador, terminal e rede ──
  {
    id: "linux",
    morada: "site",
    finalidade: "computador-e-rede",
    rota: "/laboratorios/linux",
    selo: "pinguim",
    disciplinas: ["informatica", "programacao", "engenharia-de-sistemas", "redes-e-seguranca"],
    aulas: ["linux-e-software-livre/o-que-e-software-livre", "informatica-essencial/01-como-funciona-um-computador"],
    pt: {
      serve: "Aprender o terminal (pastas, arquivos, permissões e comandos) num Linux de treino que não estraga nada do seu aparelho.",
      quem: "Quem nunca abriu um terminal e quem vai trabalhar com servidores ou programação.",
    },
    en: {
      serve: "Learn the terminal (folders, files, permissions and commands) on a practice Linux that cannot break your device.",
      quem: "People who have never opened a terminal and those heading into servers or programming.",
    },
  },
  {
    id: "redes",
    morada: "site",
    finalidade: "computador-e-rede",
    rota: "/laboratorios/redes",
    selo: "rede",
    disciplinas: ["redes-e-seguranca", "engenharia-de-sistemas", "informatica"],
    aulas: ["informatica-essencial/03-como-funciona-a-internet", "informatica-essencial/02-bits-e-bytes"],
    pt: {
      serve: "Montar uma rede, dar endereço IP, separar VLANs e criar rotas, vendo o pacote andar de máquina em máquina.",
      quem: "Quem quer entender a internet por dentro e quem estuda para trabalhar com redes e suporte.",
    },
    en: {
      serve: "Build a network, assign IP addresses, split VLANs and add routes, watching the packet travel hop by hop.",
      quem: "People who want to understand the internet from inside and those training for networking or IT support.",
    },
  },

  // ── Segurança digital ──
  {
    id: "seguranca",
    morada: "site",
    finalidade: "seguranca",
    rota: "/laboratorios/seguranca",
    selo: "escudo",
    disciplinas: ["redes-e-seguranca", "informatica"],
    aulas: ["autodefesa-digital/senhas-e-verificacao-em-duas-etapas", "golpes-do-pix-e-do-whatsapp/como-se-proteger-no-dia-a-dia"],
    pt: {
      serve: "Treinar segurança no espírito do hacking ético: um Linux isolado com ferramentas recriadas (tudo fictício) e desafios para reconhecer ataques.",
      quem: "Quem estuda segurança da informação e quem quer aprender a se defender de golpes e invasões.",
    },
    en: {
      serve: "Practise security in the spirit of ethical hacking: an isolated Linux with recreated tools (all fictional) and challenges to recognise attacks.",
      quem: "Information-security students and anyone who wants to learn to defend against scams and intrusions.",
    },
  },
  {
    id: "cyberchef",
    morada: "fora",
    finalidade: "seguranca",
    rota: "/laboratorios/externos#cyberchef",
    selo: "escudo",
    disciplinas: ["redes-e-seguranca", "informatica", "programacao"],
    aulas: ["informatica-essencial/02-bits-e-bytes"],
    pt: {
      serve: "Transformar dados: codificar e decodificar (Base64, hexadecimal), cifrar, comprimir e olhar os bytes de um arquivo.",
      quem: "Quem estuda segurança, redes ou programação e precisa entender o que há dentro de um dado.",
    },
    en: {
      serve: "Transform data: encode and decode (Base64, hex), encrypt, compress and inspect a file's bytes.",
      quem: "Security, networking or programming students who need to see what is inside a piece of data.",
    },
  },

  // ── Elétrica, eletrônica e conserto ──
  {
    id: "eletrica",
    morada: "site",
    finalidade: "eletrica-e-conserto",
    rota: "/laboratorios/eletrica",
    selo: "raio",
    disciplinas: ["eletricista", "fisica", "manutencao"],
    aulas: [
      "eletricidade-basica-e-seguranca/multimetro-medir-tensao-corrente-e-continuidade",
      "eletricidade-basica-e-seguranca/corrente-tensao-e-resistencia",
      "instalacoes-eletricas-residenciais/interruptor-simples-paralelo-e-intermediario",
      "manutencao-e-diagnostico-eletrico/diagnostico-de-defeitos-com-o-multimetro",
      "fisica-medio/circuitos-eletricos",
      "fisica-fundamental/eletricidade-em-casa",
    ],
    pt: {
      serve: "Praticar com multímetro, circuitos em série e paralelo, ligação de luz e tomada e a bancada de eletrônica, sem risco de choque.",
      quem: "Quem está aprendendo o ofício de eletricista e quem estuda eletricidade na física.",
    },
    en: {
      serve: "Practise with a multimeter, series and parallel circuits, wiring lights and sockets and an electronics bench, with no risk of shock.",
      quem: "People learning the electrician's trade and physics students studying electricity.",
    },
  },
  {
    id: "aula:circuito",
    morada: "aula",
    finalidade: "eletrica-e-conserto",
    rota: "/trilhas/eletricidade-basica-e-seguranca/a-lei-de-ohm-no-dia-a-dia",
    selo: "raio",
    disciplinas: ["eletricista", "fisica"],
    aulas: [
      "eletricidade-basica-e-seguranca/a-lei-de-ohm-no-dia-a-dia",
      "instalacoes-eletricas-residenciais/dimensionar-um-circuito",
      "instalacoes-eletricas-residenciais/o-quadro-de-distribuicao-disjuntores-e-dr",
    ],
    nome: { pt: "Circuito com disjuntor (dentro da aula)", en: "Circuit with breaker (inside the lesson)" },
    pt: {
      serve: "Ligar e desligar aparelhos e ver na hora a corrente, a potência e quando o disjuntor desarma (lei de Ohm na prática).",
      quem: "Quem está na aula de elétrica e quer testar a conta antes de mexer na instalação de verdade.",
    },
    en: {
      serve: "Switch appliances on and off and instantly see current, power and when the breaker trips (Ohm's law in practice).",
      quem: "Learners in the electricity lessons who want to test the maths before touching a real installation.",
    },
  },
  {
    id: "aula:lampadas",
    morada: "aula",
    finalidade: "eletrica-e-conserto",
    rota: "/trilhas/eletricidade-basica-e-seguranca/corrente-tensao-e-resistencia",
    selo: "raio",
    disciplinas: ["eletricista", "fisica"],
    aulas: ["eletricidade-basica-e-seguranca/corrente-tensao-e-resistencia"],
    nome: { pt: "Lâmpadas em série e paralelo (dentro da aula)", en: "Bulbs in series and parallel (inside the lesson)" },
    pt: {
      serve: "Comparar lâmpadas em série e em paralelo e ver por que uma apaga as outras (ou não), dentro do texto da aula.",
      quem: "Quem está entendendo corrente, tensão e resistência pela primeira vez.",
    },
    en: {
      serve: "Compare bulbs in series and parallel and see why one switches the others off (or not), right in the lesson text.",
      quem: "People meeting current, voltage and resistance for the first time.",
    },
  },
  {
    id: "aula:instalacao",
    morada: "aula",
    finalidade: "eletrica-e-conserto",
    rota: "/trilhas/instalacoes-eletricas-residenciais/interruptor-simples-paralelo-e-intermediario",
    selo: "raio",
    disciplinas: ["eletricista"],
    aulas: ["instalacoes-eletricas-residenciais/interruptor-simples-paralelo-e-intermediario"],
    nome: { pt: "Treino de fiação (dentro da aula)", en: "Wiring practice (inside the lesson)" },
    pt: {
      serve: "Ligar fase, neutro e retorno no interruptor simples, paralelo e intermediário até a lâmpada acender do jeito certo.",
      quem: "Quem está aprendendo instalação residencial e quer errar no treino, não na parede.",
    },
    en: {
      serve: "Connect live, neutral and switch wires on single, two-way and intermediate switches until the bulb lights correctly.",
      quem: "People learning home wiring who would rather make mistakes in practice than in the wall.",
    },
  },
  {
    id: "montador",
    morada: "site",
    finalidade: "eletrica-e-conserto",
    rota: "/laboratorios/montador",
    selo: "chip",
    disciplinas: ["manutencao", "informatica", "eletricista"],
    aulas: [
      "montagem-de-computadores/as-pecas-de-um-computador",
      "informatica-essencial/01-como-funciona-um-computador",
      "conserto-de-celular/multimetro-e-fonte-de-bancada",
      "conserto-de-celular/diagnostico-nao-liga-nao-carrega-esquenta",
      "conserto-de-celular/por-dentro-do-celular-pecas-e-ferramentas",
    ],
    pt: {
      serve: "Montar um PC conferindo cada compatibilidade, ler resistores, usar o multímetro e resolver casos de conserto de computador, notebook e celular.",
      quem: "Quem quer trabalhar com manutenção ou conserto e quem quer entender o que tem dentro do computador.",
    },
    en: {
      serve: "Build a PC checking every compatibility, read resistors, use the multimeter and solve repair cases for computers, laptops and phones.",
      quem: "People who want to work in maintenance or repair and anyone curious about what is inside a computer.",
    },
  },
  {
    id: "circuitverse",
    morada: "fora",
    finalidade: "eletrica-e-conserto",
    rota: "/laboratorios/externos#circuitverse",
    selo: "chip",
    disciplinas: ["informatica", "engenharia-de-sistemas", "manutencao"],
    aulas: ["informatica-essencial/02-bits-e-bytes"],
    pt: {
      serve: "Montar circuitos digitais (portas lógicas, somadores, memórias) e ver os bits passando.",
      quem: "Quem estuda como o computador funciona por dentro, da porta lógica ao processador.",
    },
    en: {
      serve: "Build digital circuits (logic gates, adders, memory) and watch the bits flow.",
      quem: "People studying how a computer works inside, from logic gate to processor.",
    },
  },

  // ── Experimentar ciência ──
  {
    id: "simulacoes",
    morada: "site",
    finalidade: "ciencias",
    rota: "/laboratorios/simulacoes",
    selo: "microscopio",
    disciplinas: ["fisica", "quimica", "biologia", "matematica", "astronomia", "meio-ambiente", "enem"],
    aulas: [
      "fisica-fundamental/forca-e-as-leis-de-newton",
      "fisica-medio/ondas",
      "fisica-medio/gravitacao-universal",
      "quimica-fundamental/estados-fisicos-e-mudancas-de-estado",
      "quimica-medio/reacoes-quimicas-e-balanceamento",
      "biologia-medio/evolucao-darwin-e-a-selecao-natural",
      "matematica-fundamental/01-fracoes",
      "meio-ambiente-medio/efeito-estufa-e-aquecimento-global",
    ],
    pt: {
      serve: "Fazer o experimento que a escola não tem: forças, ondas, circuitos, átomos, reações, seleção natural e frações, nas simulações do PhET.",
      quem: "Estudantes do fundamental ao superior e quem se prepara para o ENEM; também educadores que querem mostrar em sala.",
    },
    en: {
      serve: "Run the experiment your school lacks: forces, waves, circuits, atoms, reactions, natural selection and fractions, with PhET simulations.",
      quem: "Students from primary to higher education and ENEM candidates; also educators who want to demo in class.",
    },
  },
  {
    id: "quimica",
    morada: "site",
    finalidade: "ciencias",
    rota: "/laboratorios/quimica",
    selo: "tubo",
    disciplinas: ["quimica", "biologia"],
    aulas: ["quimica-medio/ph", "quimica-fundamental/acidos-e-bases-em-casa", "quimica-medio/solucoes-e-concentracao", "quimica-superior/quimica-analitica"],
    pt: {
      serve: "Fazer titulação ácido-base com a curva de pH calculada, diluir no béquer e medir o pH de coisas de casa com o indicador de repolho roxo.",
      quem: "Quem estuda ácidos, bases, pH e soluções no médio ou no ENEM, sem laboratório na escola.",
    },
    en: {
      serve: "Run an acid-base titration with a computed pH curve, dilute in a beaker and test household pH with red-cabbage indicator.",
      quem: "Students of acids, bases, pH and solutions with no school lab at hand.",
    },
  },
  {
    id: "netlogo-wolf-sheep",
    morada: "fora",
    finalidade: "ciencias",
    rota: "/laboratorios/externos#netlogo-wolf-sheep",
    selo: "microscopio",
    disciplinas: ["biologia", "meio-ambiente"],
    aulas: ["biologia-medio/ecologia-populacoes-e-ecossistemas", "biologia-fundamental/cadeias-alimentares"],
    pt: { serve: "Ver populações de presa e predador subirem e descerem em ciclos, mexendo na comida e na reprodução.", quem: "Quem estuda ecologia e cadeias alimentares." },
    en: { serve: "Watch prey and predator populations rise and fall in cycles as you change food and breeding.", quem: "Ecology and food-chain students." },
  },
  {
    id: "netlogo-virus",
    morada: "fora",
    finalidade: "ciencias",
    rota: "/laboratorios/externos#netlogo-virus",
    selo: "microscopio",
    disciplinas: ["biologia", "primeiros-socorros"],
    aulas: ["biologia-medio/saude-publica-e-epidemias", "biologia-fundamental/vacinas-como-funcionam", "biologia-superior/epidemiologia"],
    pt: { serve: "Simular como um vírus se espalha numa população e o que muda com imunidade e recuperação.", quem: "Quem estuda epidemias, vacinas e saúde pública." },
    en: { serve: "Simulate how a virus spreads through a population and what immunity and recovery change.", quem: "People studying epidemics, vaccines and public health." },
  },
  {
    id: "netlogo-fire",
    morada: "fora",
    finalidade: "ciencias",
    rota: "/laboratorios/externos#netlogo-fire",
    selo: "microscopio",
    disciplinas: ["meio-ambiente", "biologia", "geografia"],
    aulas: ["meio-ambiente-fundamental/os-biomas-do-brasil", "biologia-medio/biomas-brasileiros"],
    pt: { serve: "Ver como o fogo se espalha numa floresta conforme a densidade das árvores (e por que há um ponto de virada).", quem: "Quem estuda biomas, queimadas e meio ambiente." },
    en: { serve: "See how fire spreads through a forest depending on tree density (and why there is a tipping point).", quem: "People studying biomes, wildfires and the environment." },
  },
  {
    id: "netlogo-climate",
    morada: "fora",
    finalidade: "ciencias",
    rota: "/laboratorios/externos#netlogo-climate",
    selo: "microscopio",
    disciplinas: ["meio-ambiente", "geografia", "fisica"],
    aulas: ["crise-climatica/o-efeito-estufa", "crise-climatica/o-que-e-o-aquecimento-global", "meio-ambiente-medio/efeito-estufa-e-aquecimento-global"],
    pt: { serve: "Mexer no sol e nos gases do efeito estufa e ver a temperatura da Terra responder.", quem: "Quem estuda a crise climática e quer entender o efeito estufa sem fórmula." },
    en: { serve: "Adjust the sun and greenhouse gases and watch Earth's temperature respond.", quem: "People studying the climate crisis who want to grasp the greenhouse effect without formulas." },
  },
  {
    id: "earth-nullschool",
    morada: "fora",
    finalidade: "ciencias",
    rota: "/laboratorios/externos#earth-nullschool",
    selo: "microscopio",
    disciplinas: ["geografia", "meio-ambiente"],
    aulas: ["geografia-fundamental/relevo-clima-e-vegetacao", "meio-ambiente-fundamental/o-ciclo-da-agua"],
    pt: { serve: "Olhar os ventos, as correntes do oceano e a temperatura do planeta agora, num globo animado.", quem: "Quem estuda clima, tempo e geografia física." },
    en: { serve: "Look at the planet's winds, ocean currents and temperature right now on an animated globe.", quem: "People studying climate, weather and physical geography." },
  },
  {
    id: "oimo",
    morada: "fora",
    finalidade: "ciencias",
    rota: "/laboratorios/externos#oimo",
    selo: "microscopio",
    disciplinas: ["fisica"],
    aulas: [],
    pt: { serve: "Brincar com simulações de física (fluidos, partículas, corpos) para ganhar intuição sobre movimento.", quem: "Curiosos de física em qualquer etapa." },
    en: { serve: "Play with physics simulations (fluids, particles, bodies) to build intuition about motion.", quem: "Physics-curious learners at any level." },
  },

  // ── Matemática, dados e modelos ──
  {
    id: "modelos",
    morada: "site",
    finalidade: "dados-e-modelos",
    rota: "/laboratorios/modelos",
    selo: "probabilidade",
    disciplinas: ["matematica", "fisica", "biologia", "astronomia", "sociologia", "economia", "programacao"],
    aulas: [
      "matematica-medio/probabilidade",
      "estatistica-para-ler-o-brasil/como-ler-um-grafico-sem-ser-enganado",
      "estatistica-para-ler-o-brasil/correlacao-nao-e-causa",
      "biologia-superior/epidemiologia",
      "biologia-medio/ecologia-populacoes-e-ecossistemas",
      "fisica-medio/gravitacao-universal",
      "fisica-medio/ondas",
      "sociologia-fundamental/desigualdade-social",
    ],
    pt: {
      serve: "Prever, rodar e comparar modelos: probabilidade, gráficos que enganam, epidemia, predador e presa, riqueza, órbitas, ondas e autômatos.",
      quem: "Quem estuda matemática, ciências ou sociedade e quer testar uma ideia antes de acreditar nela.",
    },
    en: {
      serve: "Predict, run and compare models: probability, misleading charts, epidemics, predator and prey, wealth, orbits, waves and automata.",
      quem: "Maths, science or social-science learners who want to test an idea before believing it.",
    },
  },
  {
    id: "geogebra",
    morada: "fora",
    finalidade: "dados-e-modelos",
    rota: "/laboratorios/externos#geogebra",
    selo: "probabilidade",
    disciplinas: ["matematica", "fisica", "enem"],
    aulas: [
      "matematica-medio/funcao-do-1-grau",
      "matematica-medio/funcao-do-2-grau",
      "matematica-medio/geometria-plana",
      "matematica-medio/trigonometria-no-triangulo-retangulo",
      "matematica-fundamental/perimetro-e-area",
    ],
    pt: { serve: "Desenhar gráficos de funções e figuras geométricas que se mexem quando você arrasta um ponto.", quem: "Quem estuda funções, geometria e trigonometria, do fundamental ao ENEM." },
    en: { serve: "Plot functions and draw geometric figures that move when you drag a point.", quem: "Students of functions, geometry and trigonometry, from primary school to ENEM." },
  },
  {
    id: "owid-expectativa-vida",
    morada: "fora",
    finalidade: "dados-e-modelos",
    rota: "/laboratorios/externos#owid-expectativa-vida",
    selo: "probabilidade",
    disciplinas: ["geografia", "sociologia", "matematica", "biologia"],
    aulas: ["geografia-medio/demografia", "geografia-fundamental/a-populacao-brasileira", "estatistica-para-ler-o-brasil/como-ler-um-grafico-sem-ser-enganado"],
    nome: { pt: "Gráfico \"Quanto se vive\" (Brasil e mundo)", en: "\"How long people live\" chart (Brazil and world)" },
    pt: { serve: "Comparar a expectativa de vida no Brasil e no mundo de 1950 a 2023 e perguntar o que fez ela mudar.", quem: "Quem estuda população, saúde pública ou aprende a ler gráficos." },
    en: { serve: "Compare life expectancy in Brazil and the world from 1950 to 2023 and ask what changed it.", quem: "People studying population, public health or learning to read charts." },
  },
  {
    id: "loopy",
    morada: "fora",
    finalidade: "dados-e-modelos",
    rota: "/laboratorios/externos#loopy",
    selo: "rede",
    disciplinas: ["meio-ambiente", "sociologia", "economia", "biologia"],
    aulas: ["crise-climatica/o-efeito-estufa", "biologia-fundamental/cadeias-alimentares"],
    pt: { serve: "Desenhar ciclos de causa e efeito (o que se reforça e o que se equilibra) e ver o sistema se mexer sozinho.", quem: "Quem quer explicar um problema complexo (clima, economia, um bairro) com um desenho que funciona." },
    en: { serve: "Draw cause-and-effect loops (reinforcing and balancing) and watch the system move by itself.", quem: "Anyone who wants to explain a complex problem (climate, economy, a neighbourhood) with a working drawing." },
  },
  {
    id: "complexity-explorables",
    morada: "fora",
    finalidade: "dados-e-modelos",
    rota: "/laboratorios/externos#complexity-explorables",
    selo: "rede",
    disciplinas: ["matematica", "biologia", "fisica", "sociologia"],
    aulas: ["biologia-superior/epidemiologia"],
    pt: { serve: "Explorar sistemas complexos: epidemias, sincronia, enxames, redes e opiniões que se espalham.", quem: "Quem já tem alguma base e quer ir além nos modelos (médio e superior)." },
    en: { serve: "Explore complex systems: epidemics, synchrony, swarms, networks and spreading opinions.", quem: "Learners with some background who want to go further with models (upper secondary and higher)." },
  },
  {
    id: "netlogo-traffic",
    morada: "fora",
    finalidade: "dados-e-modelos",
    rota: "/laboratorios/externos#netlogo-traffic",
    selo: "rede",
    disciplinas: ["fisica", "matematica", "geografia"],
    aulas: ["fisica-fundamental/movimento-e-velocidade-media"],
    pt: { serve: "Entender por que surge engarrafamento sem acidente: uma freada vira uma onda que anda para trás.", quem: "Quem estuda movimento, velocidade e a vida nas cidades." },
    en: { serve: "See why traffic jams appear without accidents: one brake becomes a wave travelling backwards.", quem: "People studying motion, speed and city life." },
  },

  // ── Sociedade e história ──
  {
    id: "polygons",
    morada: "fora",
    finalidade: "sociedade-e-historia",
    rota: "/laboratorios/externos#polygons",
    selo: "rede",
    disciplinas: ["sociologia", "luta-negra", "geografia", "favelas"],
    aulas: ["sociologia-medio/raca-e-racismo-estrutural", "sociologia-fundamental/preconceito-e-discriminacao"],
    pt: { serve: "Ver como pequenas preferências individuais produzem bairros segregados, e o que é preciso para desfazer isso.", quem: "Quem estuda racismo estrutural, segregação e cidade." },
    en: { serve: "See how small individual preferences produce segregated neighbourhoods, and what it takes to undo that.", quem: "People studying structural racism, segregation and the city." },
  },
  {
    id: "netlogo-segregation",
    morada: "fora",
    finalidade: "sociedade-e-historia",
    rota: "/laboratorios/externos#netlogo-segregation",
    selo: "rede",
    disciplinas: ["sociologia", "geografia"],
    aulas: ["sociologia-medio/raca-e-racismo-estrutural"],
    pt: { serve: "O mesmo problema do Parable of the Polygons, com números: mude a tolerância e meça a segregação que surge.", quem: "Quem já viu o Polygons e quer medir e comparar." },
    en: { serve: "The same problem as Parable of the Polygons, with numbers: change tolerance and measure the segregation that emerges.", quem: "People who have seen Polygons and want to measure and compare." },
  },
  {
    id: "trust",
    morada: "fora",
    finalidade: "sociedade-e-historia",
    rota: "/laboratorios/externos#trust",
    selo: "rede",
    disciplinas: ["filosofia", "sociologia", "economia", "matematica"],
    aulas: ["filosofia-fundamental/etica-no-dia-a-dia", "economia-fundamental/cooperativas-e-economia-solidaria"],
    pt: { serve: "Jogar o dilema do prisioneiro repetido e descobrir quando a confiança e a cooperação nascem ou morrem.", quem: "Quem estuda ética, cooperação e organização coletiva (em português)." },
    en: { serve: "Play the repeated prisoner's dilemma and find out when trust and cooperation are born or die.", quem: "People studying ethics, cooperation and collective organising." },
  },
  {
    id: "geacron",
    morada: "fora",
    finalidade: "sociedade-e-historia",
    rota: "/laboratorios/externos#geacron",
    selo: "rede",
    disciplinas: ["historia", "geografia"],
    aulas: [
      "historia-antiga/grecia-antiga",
      "historia-antiga/roma-da-republica-ao-imperio",
      "historia-superior/colonialismo-e-imperialismo",
      "geografia-medio/a-formacao-do-territorio-brasileiro",
    ],
    pt: { serve: "Ver num mapa como fronteiras, impérios e colônias mudaram ao longo do tempo, ano a ano.", quem: "Quem estuda história e geografia política e quer ver o território mudar." },
    en: { serve: "See on a map how borders, empires and colonies changed over time, year by year.", quem: "History and political-geography learners who want to watch territory change." },
  },

  // ── Inteligência artificial ──
  {
    id: "ia",
    morada: "site",
    finalidade: "ia",
    rota: "/laboratorios/ia",
    selo: "rede-neural",
    disciplinas: ["inteligencia-artificial", "informatica", "programacao"],
    aulas: [
      "ia-fundamental/como-uma-maquina-aprende-com-exemplos",
      "ia-fundamental/como-funcionam-os-assistentes-de-texto",
      "ia-fundamental/por-que-essas-maquinas-erram",
      "ia-fundamental/dados-de-onde-vem-e-de-quem-sao",
    ],
    pt: {
      serve: "Treinar modelos de verdade no navegador (rede neural, vizinhos, agrupamento, próxima palavra) e ver de onde vêm o erro e o viés.",
      quem: "Quem quer entender a inteligência artificial sem propaganda, de quem nunca programou a quem estuda computação.",
    },
    en: {
      serve: "Train real models in the browser (neural network, neighbours, clustering, next word) and see where error and bias come from.",
      quem: "Anyone who wants to understand AI without the hype, from non-programmers to computing students.",
    },
  },

  // ── Escrever, organizar e criar ──
  {
    id: "escritorio",
    morada: "site",
    finalidade: "criar",
    rota: "/laboratorios/escritorio",
    selo: "folha",
    disciplinas: ["informatica", "portugues", "enem", "literatura", "design", "midia", "web-design", "trabalho", "economia"],
    aulas: ["dividas-e-nome-sujo/orcamento-para-sair-do-aperto", "matematica-fundamental/leitura-de-graficos-e-tabelas"],
    pt: {
      serve: "Escrever um documento, montar uma planilha com fórmulas e gráficos e preparar uma apresentação (estilo Word, Excel e PowerPoint).",
      quem: "Quem precisa do computador para estudar ou trabalhar e não tem os programas pagos.",
    },
    en: {
      serve: "Write a document, build a spreadsheet with formulas and charts and prepare a slideshow (Word, Excel and PowerPoint style).",
      quem: "People who need a computer for study or work and do not have the paid programs.",
    },
  },
  {
    id: "design",
    morada: "site",
    finalidade: "criar",
    rota: "/laboratorios/design",
    selo: "paleta",
    disciplinas: ["design", "midia", "artes", "web-design"],
    aulas: ["comunicacao-popular/o-que-e-comunicacao-popular", "design-medio/a-bauhaus", "moda-periferica-e-apropriacao/marca-propria-no-corre-criar-sem-patrao"],
    pt: {
      serve: "Fazer cartaz, post, convite e capa a partir de modelos prontos e baixar para imprimir ou publicar.",
      quem: "Quem faz comunicação popular, divulga um evento ou estuda design e quer pôr a mão na massa.",
    },
    en: {
      serve: "Make posters, posts, invitations and covers from ready templates and download them to print or publish.",
      quem: "Community communicators, event organisers and design learners who want hands-on practice.",
    },
  },

  // ── Música ──
  {
    id: "musica-chrome-music-lab",
    morada: "fora",
    finalidade: "musica",
    rota: "/laboratorios/externos#musica-chrome-music-lab",
    selo: "paleta",
    disciplinas: ["musica", "fisica", "samba-e-cultura"],
    aulas: [
      "teoria-musical-do-zero/o-que-e-som-altura-duracao-intensidade-e-timbre",
      "teoria-musical-do-zero/as-notas-musicais-e-o-teclado",
      "teoria-musical-do-zero/a-escala-de-do-maior",
      "fisica-fundamental/som",
    ],
    pt: { serve: "Compor uma música simples, ver o som como onda e brincar com ritmo e harmonia, sem saber ler partitura.", quem: "Quem está começando em música, de criança a adulto." },
    en: { serve: "Compose a simple tune, see sound as a wave and play with rhythm and harmony without reading notation.", quem: "Music beginners, children and adults alike." },
  },
];

/** Os simuladores de aula ("aula:<tipo>") e os tipos de bloco ```simulador que cada um cobre. */
export const TIPOS_DOS_SIMULADORES_DE_AULA: Record<string, string[]> = {
  "aula:execucao": ["execucao-python", "execucao-js"],
  "aula:circuito": ["circuito"],
  "aula:lampadas": ["lampadas"],
  "aula:instalacao": ["instalacao"],
};

/** Laboratórios de uma finalidade, na ordem do mapa. */
export const labsDaFinalidade = (f: Finalidade) => MAPA_DOS_LABORATORIOS.filter((l) => l.finalidade === f);

/** Um laboratório pelo id. */
export const labDoMapa = (id: string) => MAPA_DOS_LABORATORIOS.find((l) => l.id === id);

/** Laboratórios que ajudam numa disciplina. */
export const labsDaDisciplina = (area: string) => MAPA_DOS_LABORATORIOS.filter((l) => (l.disciplinas as string[]).includes(area));

/**
 * Os laboratórios de uma aula: primeiro os que a citam pelo nome (a aula está na lista dele), depois os da disciplina.
 * `max` limita só os da disciplina, para a caixa não virar outra lista sem fim.
 */
export function labsDaAula(trilha: string, aula: string, area: string, max = 4): { lab: LabNoMapa; nestaAula: boolean }[] {
  const chave = `${trilha}/${aula}`;
  const desta = MAPA_DOS_LABORATORIOS.filter((l) => l.aulas.includes(chave));
  const daArea = labsDaDisciplina(area).filter((l) => !desta.includes(l) && l.morada !== "aula").slice(0, max);
  return [...desta.map((lab) => ({ lab, nestaAula: true })), ...daArea.map((lab) => ({ lab, nestaAula: false }))];
}

/** Textos do laboratório no idioma (pt ou en; os outros idiomas usam o inglês). */
export const textosDoLab = (lab: LabNoMapa, lang: string): Textos => (lang === "pt" ? lab.pt : lab.en);
