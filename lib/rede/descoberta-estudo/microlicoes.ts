// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 73 (Prompt 4): a trilha de segurança digital em microlições, ligadas às aulas da trilha "Autodefesa digital" do site
// (content/trilhas/autodefesa-digital, na mesma ordem do plano.json). Cada microlição cabe numa tela: três pontos e uma pergunta para
// conferir. Quando a aula inteira já existe no site, o link vai para ela; enquanto não existe, vai para a página da trilha. O que a
// pessoa já fez fica só neste aparelho ("lucia:p4-de:microlicoes"). O texto é em português, como as aulas da trilha. Sem "@/".
import { gravarNoAparelho, lerDoAparelho, type Guarda } from "./aparelho";

export interface Microlicao {
  /** O slug da aula correspondente em content/trilhas/autodefesa-digital. */
  aula: string;
  titulo: string;
  pontos: readonly [string, string, string];
  pergunta: { texto: string; opcoes: readonly string[]; certa: number; porque: string };
}

export const TRILHA = "autodefesa-digital";

/** As aulas da trilha que já existem no site (as outras ainda estão no plano). Conferido pelo teste contra content/trilhas. */
export const AULAS_PRONTAS: readonly string[] = ["senhas-e-verificacao-em-duas-etapas"];

export const MICROLICOES: readonly Microlicao[] = [
  {
    aula: "senhas-e-verificacao-em-duas-etapas",
    titulo: "Senha comprida e a segunda etapa",
    pontos: [
      "Uma frase de quatro ou mais palavras soltas é mais forte e mais fácil de lembrar do que uma senha curta cheia de símbolos.",
      "Nunca repita a mesma senha em dois lugares: quando um site vaza, tentam a mesma senha nos outros. Um cofre de senhas guarda todas.",
      "Ligue a verificação em duas etapas no e-mail e nas redes. Prefira o aplicativo autenticador ou a chave de acesso ao código por SMS.",
    ],
    pergunta: {
      texto: "Qual destas senhas é a mais forte?",
      opcoes: ["Lu#2024!", "cadeira laranja sobe devagar", "o nome do seu bairro com o seu ano de nascimento"],
      certa: 1,
      porque: "O que mais pesa é o comprimento e não ter nada que outra pessoa adivinhe sobre você.",
    },
  },
  {
    aula: "golpes-pelo-celular-como-reconhecer",
    titulo: "Golpe pelo celular",
    pontos: [
      "Pressa e urgência são o sinal mais comum: \"sua conta vai ser bloqueada\", \"pague hoje\", \"me empresta agora\".",
      "Ninguém de banco, aplicativo ou da Alumia pede código que chegou por SMS. Quem pede o código está tentando entrar na sua conta.",
      "Pedido de dinheiro de número novo de alguém conhecido: ligue para o número antigo ou pergunte algo que só a pessoa sabe.",
    ],
    pergunta: {
      texto: "Chegou uma mensagem pedindo o código de 6 números que você acabou de receber. O que fazer?",
      opcoes: ["Mandar, se a pessoa parece ser do banco", "Não mandar para ninguém", "Mandar só metade do código"],
      certa: 1,
      porque: "O código é a chave da sua conta naquele momento. Quem pede está tentando entrar no seu lugar.",
    },
  },
  {
    aula: "atualizacoes-e-copia-de-seguranca",
    titulo: "Atualizar e ter cópia",
    pontos: [
      "Atualização do sistema e dos aplicativos fecha falhas que já são conhecidas por quem ataca. Deixe a atualização automática ligada.",
      "Baixe aplicativos só da loja oficial do celular. Aplicativo de fora pode trazer vigilância escondida.",
      "Tenha uma cópia das fotos e documentos importantes em outro lugar: assim, perder o celular não é perder tudo.",
    ],
    pergunta: {
      texto: "Por que vale atualizar o celular?",
      opcoes: ["Para ganhar figurinhas novas", "Para fechar falhas que já são conhecidas", "Não vale: atualização sempre deixa o celular lento"],
      certa: 1,
      porque: "Muitas atualizações existem para corrigir falhas de segurança que já estão sendo usadas.",
    },
  },
  {
    aula: "mensagens-com-criptografia-de-ponta-a-ponta",
    titulo: "Cifra de ponta a ponta",
    pontos: [
      "Na cifra de ponta a ponta, só quem conversa consegue ler. Nem a empresa do aplicativo lê a mensagem no caminho.",
      "A cifra não protege o celular desbloqueado na mão de outra pessoa, nem o print que alguém tira da conversa.",
      "Confira o código de segurança da conversa com a pessoa ao vivo quando o assunto for sensível.",
    ],
    pergunta: {
      texto: "Com cifra de ponta a ponta, quem consegue ler a mensagem?",
      opcoes: ["Só quem está na conversa", "Também a empresa do aplicativo", "Qualquer pessoa na mesma rede de wi-fi"],
      certa: 0,
      porque: "A mensagem sai cifrada do seu aparelho e só abre no aparelho de quem recebe.",
    },
  },
  {
    aula: "privacidade-nas-redes-sociais",
    titulo: "O que você mostra nas redes",
    pontos: [
      "Foto com uniforme, fachada de casa ou placa da rua diz onde você está. Pense antes de postar ao vivo.",
      "Use um codinome onde puder e reveja quem pode ver seus posts e sua lista de contatos.",
      "Antes de postar foto de outras pessoas num ato, pergunte. Rosto em foto pode expor quem não quis aparecer.",
    ],
    pergunta: {
      texto: "Qual cuidado ajuda a proteger quem estava com você num ato?",
      opcoes: ["Marcar todo mundo na foto", "Perguntar antes e desfocar rostos", "Postar na hora, com a localização"],
      certa: 1,
      porque: "Quem aparece numa foto pode ser identificado. Perguntar e desfocar protege quem não quis aparecer.",
    },
  },
  {
    aula: "navegar-com-menos-rastros",
    titulo: "Navegar deixando menos rastro",
    pontos: [
      "Navegador com bloqueio de rastreadores reduz quem acompanha o que você vê de um site para outro.",
      "A janela anônima só não guarda o histórico neste aparelho: o site e a operadora continuam vendo a visita.",
      "Em wi-fi público, evite entrar em contas importantes. Os dados móveis do seu chip costumam ser mais seguros.",
    ],
    pergunta: {
      texto: "A janela anônima esconde o que você faz da operadora de internet?",
      opcoes: ["Sim, esconde tudo", "Não: ela só não guarda o histórico neste aparelho", "Só esconde de noite"],
      certa: 1,
      porque: "A janela anônima é sobre este aparelho. A rede por onde a conexão passa continua vendo a visita.",
    },
  },
  {
    aula: "celular-perdido-ou-roubado-o-que-fazer",
    titulo: "Celular perdido ou roubado",
    pontos: [
      "Deixe ligada, antes de precisar, a função de localizar e apagar o celular à distância.",
      "Perdeu: troque a senha do e-mail primeiro (é com ele que se recupera o resto) e encerre as sessões abertas.",
      "Peça à operadora o bloqueio do chip, para ninguém receber os seus códigos por SMS.",
    ],
    pergunta: {
      texto: "O celular foi roubado. Qual senha trocar primeiro?",
      opcoes: ["A do e-mail", "A do jogo", "Nenhuma: esperar o celular aparecer"],
      certa: 0,
      porque: "Pelo e-mail se recupera quase toda conta. Protegido o e-mail, o resto fica mais difícil de tomar.",
    },
  },
  {
    aula: "seguranca-digital-em-grupos-e-movimentos",
    titulo: "Segurança no grupo",
    pontos: [
      "Combine com o grupo o que vai por mensagem e o que só se fala ao vivo.",
      "Grupo grande não é lugar para plano sensível: quanto mais gente, mais chance de alguém repassar.",
      "Tenha um plano para quando alguém perder o celular: quem tira a pessoa dos grupos e como avisar o resto.",
    ],
    pergunta: {
      texto: "Onde combinar um assunto sensível do coletivo?",
      opcoes: ["No grupo aberto com centenas de pessoas", "Ao vivo ou numa conversa cifrada pequena", "Num post público"],
      certa: 1,
      porque: "Menos gente e cifra de ponta a ponta reduzem a chance de o assunto se espalhar.",
    },
  },
];

/** O endereço da aula no site (a aula pronta) ou da página da trilha (a aula ainda no plano). */
export function enderecoDaAula(lang: string, aula: string): string {
  return AULAS_PRONTAS.includes(aula) ? `/${lang}/trilhas/${TRILHA}/${aula}` : `/${lang}/trilhas/${TRILHA}`;
}

/** As microlições que a pessoa já fez (só neste aparelho). */
export function feitas(g?: Guarda | null): string[] {
  const v = lerDoAparelho<unknown>("microlicoes", g);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && MICROLICOES.some((m) => m.aula === x)) : [];
}
export function marcarFeita(aula: string, sim: boolean, g?: Guarda | null): string[] {
  const lista = feitas(g).filter((x) => x !== aula);
  const nova = sim && MICROLICOES.some((m) => m.aula === aula) ? [...lista, aula] : lista;
  gravarNoAparelho("microlicoes", nova.length ? nova : null, g);
  return nova;
}
