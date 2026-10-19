// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência de senha nova, toda aqui no aparelho e sem serviço de fora: tamanho mínimo de 12, nada de senha comum
// (uma lista curta empacotada com o site, mais as variações óbvias), nada de só repetição, e um medidor de força.
// Frase longa vale, colar vale, gerenciador de senha vale. Como o Supabase do instituto exige letra minúscula,
// maiúscula e número (Authentication › Email › Password requirements), o site cobra o mesmo: senão o medidor diria
// "aceita" e o servidor recusaria.
// Sem os atalhos "@/" de propósito: `npm run testar:estudo` roda este arquivo direto no Node.

export const MINIMO = 12;

/** As senhas que mais aparecem em vazamentos (em português e em inglês), já sem acento e em minúsculas. */
const COMUNS = new Set(
  `123456 123456789 12345678 1234567890 12345 1234567 123123 111111 000000 654321 666666 121212 112233 123321 147258369 159753
  password passw0rd password1 qwerty qwerty123 qwertyuiop asdfgh asdfghjkl zxcvbnm abc123 abcdef abcd1234 iloveyou letmein welcome admin
  administrator root login master dragon monkey shadow sunshine princess football baseball superman batman trustno1 hello
  senha senha123 senha1234 minhasenha mudar123 trocar123 acesso acesso123 entrar entrar123 brasil brasil123 flamengo corinthians
  palmeiras saopaulo vasco gremio internacional cruzeiro botafogo santos fluminense atletico bahia vitoria sport
  amor amor123 teamo meuamor deus deus123 jesus jesus123 jesuscristo familia felicidade saudade mamae papai
  instituto institutolucia lucia lucia123 marxismo comunismo socialismo revolucao trabalhador companheiro camarada
  lula lula13 bolsonaro dilma pt13 vermelho estrela`
    .split(/\s+/)
    .filter(Boolean),
);

/** Teclado e sequências: "qwertyuiop", "abcdefgh", "123456789". */
const SEQUENCIAS = ["abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm", "01234567890123456789"].flatMap((s) => [s, [...s].reverse().join("")]);

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A senha é comum: está na lista, ou é uma da lista com números e símbolos em volta, ou é só uma sequência do teclado. */
export function senhaComum(senha: string, pessoais: string[] = []): boolean {
  const s = sem(senha).trim();
  if (!s) return false;
  const nucleo = s.replace(/^[^a-z]+|[^a-z]+$/g, "");
  const so = s.replace(/[^a-z0-9]/g, "");
  if (COMUNS.has(s) || COMUNS.has(so) || (nucleo.length >= 3 && COMUNS.has(nucleo) && so.length - nucleo.length <= 6)) return true;
  if (SEQUENCIAS.some((seq) => seq.includes(so) && so.length >= 6)) return true;
  // O próprio nome ou o e-mail, com um número no fim, é das primeiras coisas que alguém tenta.
  // Vale para o nome ocupando boa parte da senha ("paulo2024abc"); numa frase longa ("paulo e maria foram ao mercado"), não.
  for (const p of pessoais.map(sem).flatMap((x) => x.split(/[^a-z0-9]+/)).filter((x) => x.length >= 4)) if (nucleo === p || (so.includes(p) && p.length / so.length >= 0.35)) return true;
  return false;
}

/** Só repetição: "aaaaaaaaaaaa", "121212121212", "abcabcabcabc". */
export function soRepeticao(senha: string): boolean {
  const s = senha.toLowerCase();
  if (new Set(s).size < 4) return true;
  for (let n = 1; n <= 4; n++) if (s.length >= n * 3 && s === s.slice(0, n).repeat(Math.ceil(s.length / n)).slice(0, s.length)) return true;
  return false;
}

export type RegraDeSenha = "length" | "mix" | "common" | "variety";
export const REGRAS_DE_SENHA: RegraDeSenha[] = ["length", "mix", "common", "variety"];

export interface Avaliacao {
  regras: Record<RegraDeSenha, boolean>;
  /** Todas as regras atendidas: a senha pode ser usada. */
  aceita: boolean;
  /** 0 (fraca) a 3 (forte), para o medidor. */
  forca: 0 | 1 | 2 | 3;
}

/**
 * A força é uma estimativa honesta de quantas tentativas um invasor precisaria: tamanho vezes a variedade de
 * caracteres, descontando repetição. Frase de quatro ou cinco palavras chega a "forte" sem nenhum símbolo.
 */
export function avaliarSenha(senha: string, pessoais: string[] = []): Avaliacao {
  const regras: Record<RegraDeSenha, boolean> = {
    length: [...senha].length >= MINIMO,
    mix: /[a-z]/.test(senha) && /[A-Z]/.test(senha) && /\d/.test(senha),
    common: senha.length > 0 && !senhaComum(senha, pessoais),
    variety: senha.length > 0 && !soRepeticao(senha),
  };
  const aceita = REGRAS_DE_SENHA.every((r) => regras[r]);
  let alfabeto = 0;
  if (/[a-z]/.test(senha)) alfabeto += 26;
  if (/[A-Z]/.test(senha)) alfabeto += 26;
  if (/\d/.test(senha)) alfabeto += 10;
  if (/[^\p{L}\p{Nd}]/u.test(senha)) alfabeto += 20;
  if (/[^\x00-\x7f]/.test(senha)) alfabeto += 30;
  const distintos = new Set(senha).size;
  const bits = Math.log2(Math.max(alfabeto, 2)) * Math.min([...senha].length, distintos * 2);
  const forca: Avaliacao["forca"] = !aceita ? 0 : bits >= 80 ? 3 : bits >= 60 ? 2 : 1;
  return { regras, aceita, forca };
}
