// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o aparelho manda no relato de um problema e no registro de erros da tela (P5, A21), já limpo AQUI, antes de sair (o banco
// limpa de novo: supabase/migracoes/20261126-p5-auditoria.sql). Nada que diga quem é: a tela só com o idioma, o /alumia e
// a rota de primeiro nível; o aparelho só como família do navegador, sistema e tipo (celular ou computador), nunca versão nem
// modelo; a mensagem do erro sem e-mail, link, @nome, id, token, endereço de rede, número longo ou com pontuação e texto entre
// aspas. Sem conta, sem endereço de rede, sem hora.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-p5-beta-tela.mjs).
import { navegadorDe, NOMES_DOS_NAVEGADORES, NOMES_DOS_SISTEMAS, type CodigoDoNavegador } from "../seguranca/navegador";

/**
 * As rotas de primeiro nível da Alumia (app/[lang]/alumia/*). Só elas ficam no endereço guardado; o resto vira ":x" (auditoria do
 * P5: o slug de uma comunidade, de um pacote, de uma busca, de um perfil ou do coringa [...resto] dizia de quem ou do quê era).
 */
export const ROTAS_DA_ALUMIA =
  "agenda|ajuda|aparelhos|aparencia|app|aprovados|ato|atos|aula|avisos|buscar|c|calendario|como-a-linha|comunidades|conquistas|conversas|convite|cuidado|denunciar|denuncias|editar-perfil|explorar|fediverso|identidades|leve|linhas|listas|mapa|meus-dados|moderacao|modo-ato|nucleos|o|o-que-guardamos|organizacoes|p|pacote|pontes|privacidade|propor|questoes|redacao|regras|rotulos|salvos|seguranca|series|silenciados|stories|tag|temas|termos|trabalhadores|transparencia|turmas|u";
const ROTA = new RegExp(`^/(${ROTAS_DA_ALUMIA})$`);

/**
 * A tela sem nada de quem é (a mesma regra de interno.alumia_p5_endereco_limpo): sem "?", "#" e endereço do site; fica o idioma,
 * o "/alumia" e a primeira parte só se for uma rota conhecida; tudo o que vem depois vira um ":x". Até 200 letras.
 */
export function telaLimpa(endereco: string): string {
  const x = (endereco.split("?")[0].split("#")[0] ?? "").replace(/^https?:\/\/[^/]*/i, "");
  if (!x.startsWith("/")) return "";
  const m = /^(\/[a-z]{2}(?:-[A-Za-z]{2,4})?(?=\/|$))?(\/alumia(?=\/|$))?(\/[^/]*)?(.*)$/.exec(x);
  if (!m) return "";
  const [, idioma = "", alumia = "", primeira, resto = ""] = m;
  const parte = primeira === undefined || primeira === "/" ? "" : ROTA.test(primeira) ? primeira : "/:x";
  return (idioma + alumia + parte + (/^\/*$/.test(resto) ? "" : "/:x")).slice(0, 200);
}

/**
 * A mensagem do erro sem dado pessoal (a mesma regra de interno.alumia_p5_texto_limpo), na ordem: e-mail, link, id, token (JWT,
 * chave sk_/pk_, sequência longa de letras e algarismos), endereço de rede (IPv4 e IPv6), número com pontuação (CPF, telefone),
 * texto entre aspas (fica só um nome de propriedade, como 'map'), @nome e número de 4 algarismos ou mais. Até 300 letras, numa linha.
 */
export function mensagemLimpa(texto: string): string {
  return texto
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<e-mail>")
    .replace(/(https?|wss?|blob|data):[^\s"'<>)]*/g, "<link>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":x")
    .replace(/eyJ[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]+)*/g, "<token>")
    .replace(/(sk|pk|rk)_(live|test)_[A-Za-z0-9]+/g, "<token>")
    .replace(/(?=[A-Za-z0-9+\/_=-]*[0-9])(?=[A-Za-z0-9+\/_=-]*[A-Za-z])[A-Za-z0-9+\/_=-]{20,}/g, "<token>")
    .replace(/[0-9]{1,3}(\.[0-9]{1,3}){3}/g, "<ip>")
    .replace(/(?=[0-9A-Fa-f:]*[0-9])[0-9A-Fa-f]{1,4}(:[0-9A-Fa-f]{0,4}){2,7}/g, "<ip>")
    .replace(/[0-9]{3,}([./-][0-9]+)+/g, ":x")
    .replace(/'(?![a-z_$][A-Za-z0-9_$.]{0,40}')[^']*'/g, "'…'")
    .replace(/"(?![a-z_$][A-Za-z0-9_$.]{0,40}")[^"]*"/g, '"…"')
    .replace(/“[^”]*”/g, "“…”")
    .replace(/‘[^’]*’/g, "‘…’")
    .replace(/(@[A-Za-z0-9_]{2,}|[0-9]{4,})/g, ":x")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** A família do navegador para o registro de erros (o banco aceita só estas; Vivaldi e Brave contam como Chrome). */
export type FamiliaDoNavegador = "chrome" | "firefox" | "safari" | "edge" | "samsung" | "opera" | "outro";
export function familiaDoNavegador(agente: string): FamiliaDoNavegador {
  const n: CodigoDoNavegador = navegadorDe(agente).navegador;
  return n === "vivaldi" || n === "brave" ? "chrome" : n;
}

/** "Chrome · Android · celular": a família, o sistema e o tipo de tela, sem versão nem modelo. */
export function aparelhoDoRelato(agente: string, larguraDaTela: number): string {
  const { navegador, sistema } = navegadorDe(agente);
  const nome = navegador === "outro" ? "Outro navegador" : NOMES_DOS_NAVEGADORES[navegador];
  const so = sistema === "ios" ? "iOS" : sistema === "outro" ? "outro sistema" : NOMES_DOS_SISTEMAS[sistema];
  const tipo = larguraDaTela > 0 && larguraDaTela < 768 ? "celular" : larguraDaTela >= 768 && larguraDaTela < 1100 ? "tablet" : "computador";
  return `${nome} · ${so} · ${tipo}`;
}

/** A medida da janela em "LxA" (sem densidade nem nada que ajude a reconhecer o aparelho além do tamanho). */
export function medidaDaTela(largura: number, altura: number): string {
  const l = Math.round(largura);
  const a = Math.round(altura);
  return l >= 10 && a >= 10 && l < 100000 && a < 100000 ? `${l}x${a}` : "";
}

/** A versão do site como o banco aceita (o commit de /versao.txt, curto). Vazio se não parece versão. */
export function versaoLimpa(texto: string): string {
  const v = texto.trim().toLowerCase();
  return /^[0-9a-z.-]{1,40}$/.test(v) ? v.slice(0, 12) : "";
}

/** A mensagem de um erro qualquer (Error, texto, evento de promessa recusada). */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name}: ${erro.message}`;
  if (typeof erro === "string") return erro;
  return "Erro sem mensagem";
}

/**
 * O freio do aparelho: no máximo `teto` erros por página aberta e cada mensagem uma vez. Devolve se este pode sair. A memória é
 * só desta aba (nada é guardado no aparelho).
 */
export function criarFreio(teto = 8): (chave: string) => boolean {
  const vistas = new Set<string>();
  return (chave) => {
    if (vistas.size >= teto || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  };
}
