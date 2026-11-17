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
}

export const VARIAVEIS_DO_SERVIDOR: readonly VariavelDoServidor[] = [
  {
    nome: "SUPABASE_SERVICE_ROLE_KEY",
    semEla:
      "A porta da entrada (criar conta, entrar, pedir o link), a passagem do site para a Alumia, a impressão da rede, a mídia do painel, o acervo, o álbum dos atos, o vídeo dos posts, a conferência dos links do perfil, as contas de organização, os posts agendados (quando o banco não tem o agendador), os robôs das pontes, a ponte do Telegram, a faxina dos arquivos das contas apagadas e tirar o aplicativo autenticador depois do código de recuperação param.",
    minimo: 20,
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
];

export type SituacaoDaVariavel = "presente" | "curta" | "falta";

/** Cada variável e a situação dela. Nunca o valor, nem o tamanho. */
export function situacaoDasVariaveis(ambiente: Record<string, string | undefined> = process.env): { nome: string; semEla: string; situacao: SituacaoDaVariavel }[] {
  return VARIAVEIS_DO_SERVIDOR.map((v) => {
    const valor = (ambiente[v.nome] ?? "").trim();
    return { nome: v.nome, semEla: v.semEla, situacao: !valor ? "falta" : valor.length < v.minimo ? "curta" : "presente" };
  });
}
