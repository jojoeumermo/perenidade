// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Jogos em grupo (T23): o código curto da sala, o apelido e o filtro de contato. Puro (sem "@/", sem rede, sem disco)
// para rodar no teste em Node (`npm run testar:jogos-em-grupo`).
//
// Privacidade: a sala não tem conta nem cadastro. Quem entra escolhe um apelido (nada de nome completo), que só existe
// enquanto a aba está aberta: não vai para banco nenhum (LGPD, art. 6º, III: só o necessário). Como crianças e
// adolescentes também jogam, o texto livre (os argumentos da Assembleia e o apelido) recusa telefone, e-mail, endereço de
// site e @ de rede social: ninguém usa o jogo para puxar contato fora dele (ECA, art. 17, e cuidado do art. 241-D).

/** Letras e números sem os que se confundem (0/O, 1/I/L): o código se dita em voz alta sem erro. */
export const ALFABETO_DO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TAMANHO_DO_CODIGO = 5;
/** O grupo que o pedido imaginou ("umas 10 pessoas") com folga. Depois disso, a sala avisa que está cheia. */
export const MAXIMO_DE_JOGADORES = 12;

/** Sorteia um código de sala (31^5, perto de 29 milhões de combinações). */
export function gerarCodigo(rnd: () => number = Math.random): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) codigo += ALFABETO_DO_CODIGO[Math.floor(rnd() * ALFABETO_DO_CODIGO.length)];
  return codigo;
}

/** O que a pessoa digitou, em maiúsculas, sem espaço nem traço (o código "abc-12" e "ABC12" são o mesmo). */
export function normalizarCodigo(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TAMANHO_DO_CODIGO);
}

export const codigoValido = (codigo: string): boolean => codigo.length === TAMANHO_DO_CODIGO && [...codigo].every((c) => ALFABETO_DO_CODIGO.includes(c));

/** Telefone, e-mail, endereço de site ou @ de rede social: o jogo não serve para trocar contato. */
export function temContato(texto: string): boolean {
  const t = texto.toLowerCase();
  if (/\S+@\S+\.\S+/.test(t)) return true; // e-mail
  if (/(^|\s)@[a-z0-9_.]{3,}/.test(t)) return true; // @ de rede social
  if (/https?:|www\.|\b[a-z0-9-]+\.(com|net|org|br|me|io|gg|app|ly|link|site|xyz)\b/.test(t)) return true; // endereço
  if (/(wa\.me|whats|zap|telegram|insta|tiktok|discord|snap)/.test(t) && /\d/.test(t)) return true;
  const digitos = t.replace(/[\s().-]/g, "").match(/\d{8,}/);
  return Boolean(digitos);
}

/** O apelido: até 20 caracteres, sem quebra de linha nem contato. Vazio ou recusado vira "". */
export function limparApelido(texto: string): string {
  const limpo = texto
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  if (!limpo || temContato(limpo)) return "";
  return limpo;
}

/** O texto livre de um argumento: até 160 caracteres, uma linha, sem contato (recusado vira ""). */
export const LIMITE_DO_ARGUMENTO = 160;
export function limparArgumento(texto: string): string {
  const limpo = texto
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITE_DO_ARGUMENTO);
  if (limpo.length < 3 || temContato(limpo)) return "";
  return limpo;
}

/** Apelidos de partida, para quem não quer pensar num (árvores, rios e bichos do Brasil). */
const NOMES = ["Ipê", "Jatobá", "Buriti", "Aroeira", "Pequi", "Caju", "Jabuti", "Tatu", "Arara", "Capivara", "Tucano", "Sabiá", "Xingu", "Tapajós", "Araguaia", "Paraná", "Mandacaru", "Cajá", "Jenipapo", "Baobá"];
export function apelidoSorteado(rnd: () => number = Math.random): string {
  return `${NOMES[Math.floor(rnd() * NOMES.length)]} ${10 + Math.floor(rnd() * 90)}`;
}

/** As cores de quem joga (as do site e vizinhas), sempre com texto claro por cima (contraste ≥ 4,5:1 com #fff8ea). */
export const CORES_DOS_JOGADORES = ["#c21f16", "#23408e", "#2e6b4f", "#7a3b8f", "#8a4b12", "#0f6674", "#9b1b5a", "#3d5a1e", "#5b4636", "#a3361c", "#1f4e79", "#6b2d2d"];

/** As equipes: nome e cor (até 4). */
export const EQUIPES = [
  { nome: "Equipe Ipê", cor: "#8a4b12" },
  { nome: "Equipe Anil", cor: "#23408e" },
  { nome: "Equipe Mata", cor: "#2e6b4f" },
  { nome: "Equipe Prelo", cor: "#c21f16" },
] as const;
