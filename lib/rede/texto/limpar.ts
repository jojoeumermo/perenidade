// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A limpeza do TEXTO FORMATADO da Alumia (onda 11, frente 11A): o mesmo trabalho que o banco faz em interno.rede_texto_limpo
// (supabase/migracoes/20261117-alumia-o11-texto.sql), aqui para o aparelho mostrar já o que vai ficar. O banco é quem decide: o
// navegador pode ser alterado. As regras são poucas e iguais dos dois lados (o teste compara os dois com as mesmas entradas):
//   1. tira caracteres de controle e os que invertem a direção do texto (U+202A–U+202E, U+2066–U+2069: o truque de esconder
//      código dentro de um bloco de código); quebra de linha do Windows vira "\n";
//   2. imagem só do próprio post: "![descrição](imagem:1)" a "(imagem:20)" (as imagens que a pessoa anexou, que passaram pela
//      limpeza de metadados do servidor). Imagem de qualquer outro endereço vira só a descrição: nada de fora é carregado;
//   3. link só para http(s) ou para um caminho do próprio site ("/alumia/…"); o resto ("javascript:", "data:", "//outro") vira "#".
// HTML nunca é interpretado (a tela desenha só os nós conhecidos, lib/rede/texto/desenhar.ts); a fórmula passa pelo KaTeX sem
// "trust" (lib/rede/texto/formula.ts). Sem "@/": roda no Node dos testes.

/** O maior texto formatado (o corpo do texto longo no banco vai até 10.000; a questão, até 4.000 por campo). */
export const MAXIMO_DO_TEXTO = 20_000;

// Controle (menos tabulação e quebra de linha), DEL e os marcadores de direção. Igual ao do banco.
const CONTROLE = /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;
// Imagem que não é do próprio post: fica só a descrição.
const IMAGEM_DE_FORA = /!\[([^\]\n]{0,255})\]\((?!imagem:(?:[1-9]|1[0-9]|20)\))(?:[^()\n]|\([^()\n]*\))*\)/g;
// Destino de link que não é http(s) nem caminho do site: vira "#".
const DESTINO_RUIM = /\]\(\s*(?!https?:\/\/[^\s()/@\\]+(?:[/?#](?:[^\s()\\]|\([^\s()\\]*\))*)?\)|\/(?![/\\])(?:[^\s()\\]|\([^\s()\\]*\))*\)|imagem:(?:[1-9]|1[0-9]|20)\)|#\))(?:[^()\n]|\([^()\n]*\))*\)/gi;

/** O texto como o banco vai guardar (a mesma regra de interno.rede_texto_limpo). */
export function limparFonte(texto: string): string {
  return String(texto ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROLE, "")
    .replace(IMAGEM_DE_FORA, "$1")
    .replace(DESTINO_RUIM, "](#)");
}

/**
 * O endereço de um link pode virar link na tela? Só http(s) com nome de servidor (sem "usuário@" na frente, que engana quem lê)
 * ou caminho do próprio site começando com uma barra só. O resto aparece como texto.
 */
export function urlSegura(url: string): string | null {
  const u = url.trim();
  if (u.length === 0 || u.length > 500) return null;
  if (/^https?:\/\/[^\s()/@\\]+(?:[/?#](?:[^\s()\\]|\([^\s()\\]*\))*)?$/i.test(u)) {
    try {
      const x = new URL(u);
      return x.protocol === "http:" || x.protocol === "https:" ? x.href : null;
    } catch {
      return null;
    }
  }
  if (/^\/(?![/\\])[A-Za-z0-9/_\-.~%?=&#+:]*$/.test(u)) return u;
  return null;
}
