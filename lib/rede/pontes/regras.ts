// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras da frente 13E (pontes), iguais às do banco (supabase/migracoes/20261119-alumia-o13-pontes.sql): os limites, os
// tipos de chamado do Mural dos Trabalhadores, o nome do canal do Telegram e a chave de API dos robôs. O teste
// (scripts/testar-alumia-o13-pontes.mjs) confere que os números daqui são os da migração. Sem "@/" de propósito: o teste roda
// este arquivo direto no Node.

export const LIMITES_DAS_PONTES = {
  /** Comunidades no resumo. */
  resumoComunidades: 10,
  /** Robôs (que não estão desligados nem recusados) por organização. */
  robosPorOrg: 3,
  robosPorHora: 12,
  robosPorDia: 60,
  roboNomeMin: 3,
  roboNome: 40,
  roboDescricaoMin: 10,
  roboDescricao: 300,
  /** O texto que o robô publica. */
  roboTexto: 500,
  /** O que vai para o servidor de tradução. */
  traducaoTexto: 5000,
  traducoesPorHora: 60,
  muralTituloMin: 4,
  muralTitulo: 90,
  muralTextoMin: 10,
  muralTexto: 600,
  muralCategoriaMin: 2,
  muralCategoria: 60,
  muralCidade: 60,
  muralAbertosPorOrg: 5,
  muralDiasMax: 90,
  muralDiasPadrao: 30,
  telegramMinutos: 10,
  telegramFalhas: 5,
} as const;

export const TIPOS_DO_MURAL = ["greve", "paralisacao", "assembleia", "campanha", "solidariedade", "trabalho"] as const;
export type TipoDoMural = (typeof TIPOS_DO_MURAL)[number];

export const PUBLICOS_DO_ROBO = ["internet", "membros"] as const;
export type PublicoDoRobo = (typeof PUBLICOS_DO_ROBO)[number];

/** O canal do Telegram como o banco aceita: "@nome" (5 a 32 letras) ou o número "-100…" do canal. Nulo se não servir. */
export function canalDoTelegram(texto: string): string | null {
  let c = texto.trim();
  const link = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z][A-Za-z0-9_]{4,31})\/?$/i.exec(c);
  if (link) c = `@${link[1]}`;
  else if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(c)) c = `@${c}`;
  return /^(@[A-Za-z][A-Za-z0-9_]{4,31}|-100[0-9]{6,15})$/.test(c) ? c : null;
}

/** O que falta num chamado do mural (a primeira coisa), ou nulo se está pronto para ir. */
export function problemaDoChamado(c: { tipo: string; categoria: string; titulo: string; texto: string; cidade: string; quando: string; ate: string }, hoje: string): string | null {
  const L = LIMITES_DAS_PONTES;
  if (!(TIPOS_DO_MURAL as readonly string[]).includes(c.tipo)) return "tipo";
  const cat = c.categoria.trim().length;
  if (cat < L.muralCategoriaMin || cat > L.muralCategoria) return "categoria";
  const tit = c.titulo.trim().length;
  if (tit < L.muralTituloMin || tit > L.muralTitulo) return "titulo";
  const tex = c.texto.trim().length;
  if (tex < L.muralTextoMin || tex > L.muralTexto) return "texto";
  if (c.cidade.trim().length > L.muralCidade) return "cidade";
  if (c.ate && (c.ate < hoje || c.ate > maisDias(hoje, L.muralDiasMax))) return "ate";
  if (c.quando && (c.quando < maisDias(hoje, -1) || c.quando > (c.ate || maisDias(hoje, L.muralDiasPadrao)))) return "quando";
  return null;
}

/** "AAAA-MM-DD" + n dias. */
export function maisDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** O prefixo das chaves de API (para a pessoa reconhecer e para o varredor de segredos achar uma chave colada por engano). */
export const PREFIXO_DA_CHAVE = "alumia_robo_";

/** Uma chave nova: o prefixo e 32 bytes aleatórios em base64url. Nasce no servidor do site; o banco só vê o resumo. */
export function chaveNova(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIXO_DA_CHAVE + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A chave tem a forma certa? (o prefixo e 43 letras base64url). */
export function chaveTemForma(chave: string): boolean {
  return new RegExp(`^${PREFIXO_DA_CHAVE}[A-Za-z0-9_-]{43}$`).test(chave);
}

/** O resumo SHA-256 da chave, em hexadecimal: o único jeito em que ela é guardada (Web Crypto, do Node ou do navegador). */
export async function resumoDaChave(chave: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chave));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Os idiomas em que a Alumia tem tela, que são os que a tradução oferece. */
export const IDIOMAS_DA_TRADUCAO = ["pt", "en", "es", "fr", "ru", "zh"] as const;
