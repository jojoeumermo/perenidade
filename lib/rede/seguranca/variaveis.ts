// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As variáveis secretas do servidor que a Alumia usa, e se cada uma está posta (para a Saúde do painel, app/api/alumia/painel/saude).
// Só no servidor. O valor nunca sai daqui: a resposta diz só "presente", "curta" (abaixo do tamanho que a rota exige) ou "falta".
// Nenhuma delas é NEXT_PUBLIC_ (o que começa assim vai para o navegador); scripts/testar-alumia-o14-conta.mjs confere no repositório.

export interface VariavelDoServidor {
  nome: string;
  /** O que para quando ela falta (texto do painel, que é em português). */
  semEla: string;
  /** O tamanho mínimo que as rotas aceitam (abaixo disso, contam como se faltasse). */
  minimo: number;
  /** Só existe durante a troca de um segredo (R3, item 2.6): sem ela, nada para; posta, tem de ter o tamanho mínimo. */
  opcional?: boolean;
}

export const VARIAVEIS_DO_SERVIDOR: readonly VariavelDoServidor[] = [
  {
    nome: "SUPABASE_SERVICE_ROLE_KEY",
    semEla:
      "A porta da entrada (criar conta, entrar, pedir o link), a passagem do site para a Alumia, a impressão da rede, a mídia do painel, o acervo, o álbum dos atos, o vídeo dos posts, a conferência dos links do perfil, as contas de organização, os posts agendados (quando o banco não tem o agendador), os robôs das pontes, a ponte do Telegram, a faxina dos arquivos das contas apagadas e tirar o aplicativo autenticador depois do código de recuperação param.",
    minimo: 20,
  },
  {
    nome: "ALUMIA_FEDIVERSO_SEGREDO",
    semEla:
      "A federação não liga no servidor: a tela do Fediverso diz \"a federação ainda não está ligada no servidor da Alumia\", mesmo com o Fediverso ligado aqui no painel, e nenhuma rota do Fediverso responde. O banco guarda só o SHA-256 dele (interno.configuracoes, chave \"fediverso\").",
    minimo: 32,
  },
  { nome: "ALUMIA_VOTO_SEGREDO", semEla: "O voto secreto, as decisões e o lacre das correções de redação param.", minimo: 32 },
  {
    nome: "ALUMIA_IMPRESSAO_SEGREDO",
    semEla: "Sem a impressão da rede não há banimento por rede, e o freio da porta junta todo mundo num balde só. Os desafios da porta mudam a cada vez que o servidor reinicia.",
    minimo: 32,
  },
  {
    nome: "ALUMIA_BORDA_SEGREDO",
    semEla: "O servidor aceita o endereço que a Cloudflare escreve sem conferir o sinal da borda: quem chegar ao servidor por fora da Cloudflare escolhe a própria impressão.",
    minimo: 32,
  },
  { nome: "TURNSTILE_SECRET_KEY", semEla: "O desafio da Cloudflare não é conferido no servidor; a porta segue só com a prova de trabalho do aparelho.", minimo: 10 },
  { nome: "GOOGLE_SAFE_BROWSING_KEY", semEla: "Os links dos posts não são conferidos contra a lista de golpes.", minimo: 10 },
  { nome: "ALUMIA_EMAIL_SEGREDO", semEla: "Banir com tudo não barra o e-mail da conta banida (o resto do banimento vale).", minimo: 32 },
  { nome: "ALUMIA_CF_TOKEN", semEla: "O bloqueio na borda (aba Ataque do painel de admin) não funciona.", minimo: 20 },
  { nome: "ALUMIA_CF_ZONA", semEla: "O bloqueio na borda (aba Ataque do painel de admin) não funciona.", minimo: 32 },
  // Só durante a troca do segredo (scripts/segredos, docs/rede: a cerimônia da R3). Fora da troca, ficam vazias.
  {
    nome: "ALUMIA_IMPRESSAO_SEGREDO_ANTERIOR",
    semEla: "Só na troca do segredo da impressão: sem ela, as impressões de antes deixam de valer na hora (os banimentos por rede antigos param de pegar).",
    minimo: 32,
    opcional: true,
  },
  {
    nome: "ALUMIA_FEDIVERSO_SEGREDO_ANTERIOR",
    semEla: "Só na troca do segredo da federação: sem ela, as chaves do Fediverso seladas com o segredo de antes não abrem.",
    minimo: 32,
    opcional: true,
  },
];

export type SituacaoDaVariavel = "presente" | "curta" | "falta" | "dispensada";

/** Cada variável e a situação dela. Nunca o valor, nem o tamanho. */
export function situacaoDasVariaveis(ambiente: Record<string, string | undefined> = process.env): { nome: string; semEla: string; situacao: SituacaoDaVariavel }[] {
  return VARIAVEIS_DO_SERVIDOR.map((v) => {
    const valor = (ambiente[v.nome] ?? "").trim();
    return { nome: v.nome, semEla: v.semEla, situacao: !valor ? (v.opcional ? "dispensada" : "falta") : valor.length < v.minimo ? "curta" : "presente" };
  });
}
