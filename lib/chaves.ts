// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Tudo o que o site guarda fica no navegador da pessoa, sob estas chaves. Não há servidor.
export const KEYS = {
  /** Menu do painel só com ícones (computador). */
  painelCompacto: "lucia:painel-compacto",
  /** Modo foco do painel: só as seções essenciais no menu. */
  painelFoco: "lucia:painel-foco",
  /** Modo leve do painel: sem animações, sombras nem texturas (aparelho fraco, internet ruim ou cansaço da vista). */
  painelLeve: "lucia:painel-leve",
  /** Depois de quantos minutos sem uso o painel se fecha neste aparelho ("0": nunca). */
  painelOcioso: "lucia:painel-ocioso",
  /** O último toque no painel, em qualquer aba deste navegador (uma aba esquecida não derruba a que está em uso). */
  painelUltimoUso: "lucia:painel-ultimo-uso",
  done: "lucia:concluidas",
  last: "lucia:ultima-aula",
  draft: "lucia:rascunho",
  theme: "lucia:tema",
  a11y: "lucia:acessibilidade",
  session: "lucia:sessao",
  // Primeiro nome da conta, para o cabeçalho dizer "Olá" sem esperar o serviço; sai junto com a sessão.
  name: "lucia:nome",
  // O ícone da conta (o de Minha conta), para o cabeçalho mostrar o rosto certo de imediato; sai junto com a sessão.
  avatar: "lucia:avatar",
  notes: "lucia:fichamento",
  radio: "lucia:radio",
  device: "lucia:aparelho",
  notice: "lucia:aviso",
  light: "lucia:leve",
  filter: "lucia:filtro",
  purge: "lucia:purga",
  seen: "lucia:visto",
  site: "lucia:site",
  passkey: "lucia:digital",
  // O rascunho da folha de redação e a última ferramenta aberta em cada disciplina (caixa de ferramentas das aulas).
  essay: "lucia:redacao",
  // Os itens já conferidos na revisão guiada da redação.
  essayCheck: "lucia:redacao-revisao",
  tools: "lucia:ferramentas",
  // A resposta do guia das disciplinas ("objetivo:etapa"), para o caminho sugerido continuar ali na próxima visita.
  guia: "lucia:guia",
  // O andamento e as respostas do teste dos 12 eixos (nivelamento), para continuar depois; nada sai do aparelho.
  eixos: "lucia:eixos",
  // Os grupos do menu do painel que a pessoa abriu ou fechou ({"Produção": true, ...}).
  painelGrupos: "lucia:painel-grupos",
  // O som dos jogos ("1": ligado). Desligado por padrão; só a escolha fica, nenhum dado do jogo.
  jogosSom: "lucia:jogos-som",
} as const;
