// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O aviso de link suspeito (onda 9, frente 9A): uma lista ABERTA de padrões, conferida no próprio aparelho. Nenhum serviço de fora é
// consultado (nem lista de reputação, nem "verificador de link"): o endereço que a pessoa vai abrir não sai do aparelho. A lista é
// esta, escrita aqui, e a tela diz qual padrão acendeu. Puro (sem DOM): os testes chamam direto.

/** Por que um link acendeu o aviso. Cada chave tem a explicação na tela (i18n/rede/protecao, link.motivos). */
export type MotivoDeLink = "perigo" | "numero" | "alfabeto" | "encurtador" | "arroba" | "imitacao" | "terminacao" | "sem_cadeado";

export interface AnaliseDeLink {
  /** Algum padrão acendeu. */
  suspeito: boolean;
  /** O link roda código ou abre conteúdo embutido (javascript:, data:): a tela não oferece abrir. */
  perigo: boolean;
  motivos: MotivoDeLink[];
  /** O nome do lugar, como o navegador vai ler (com letras de outro alfabeto em punycode). Vazio quando não deu para ler. */
  host: string;
}

/** Encurtadores conhecidos: o destino só aparece depois do clique. */
export const ENCURTADORES = [
  "bit.ly", "bit.do", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "v.gd", "buff.ly", "cutt.ly", "rebrand.ly", "shorturl.at",
  "rb.gy", "tiny.cc", "s.id", "t.ly", "encurtador.com.br", "l1nq.com", "abre.ai", "encr.pw", "tiny.one", "shre.ink",
];

/** Terminações que se confundem com nome de arquivo ("atualizacao.zip", "video.mov"). */
export const TERMINACOES_DE_ARQUIVO = ["zip", "mov"];

/** Nomes que golpe costuma imitar, e o único lugar onde eles valem de verdade. */
export const NOMES_IMITADOS: { palavras: string[]; dominio: string }[] = [
  { palavras: ["govbr", "inss", "receita", "receitafederal", "detran", "pix", "caixa", "fgts", "meugov", "cadunico", "bolsafamilia"], dominio: "gov.br" },
  { palavras: ["institutolucia", "alumia"], dominio: "institutolucia.org" },
];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const termina = (host: string, dominio: string) => host === dominio || host.endsWith(`.${dominio}`);
const pedacos = (host: string) => host.split(/[.-]/).filter(Boolean);

/** Os padrões, na ordem em que aparecem na tela. Exportados para a lista poder ser lida e conferida. */
export const PADROES_DE_LINK: { chave: MotivoDeLink; confere: (u: URL) => boolean }[] = [
  { chave: "perigo", confere: (u) => ["javascript:", "data:", "vbscript:", "file:"].includes(u.protocol) },
  { chave: "numero", confere: (u) => IPV4.test(u.hostname) || u.hostname.startsWith("[") },
  { chave: "alfabeto", confere: (u) => u.hostname.split(".").some((rotulo) => rotulo.startsWith("xn--")) },
  { chave: "encurtador", confere: (u) => ENCURTADORES.some((e) => termina(u.hostname, e)) },
  { chave: "arroba", confere: (u) => u.username !== "" || u.password !== "" },
  {
    chave: "imitacao",
    confere: (u) => {
      const partes = pedacos(u.hostname);
      const junto = u.hostname.replace(/[.-]/g, "");
      return NOMES_IMITADOS.some(({ palavras, dominio }) => {
        if (termina(u.hostname, dominio)) return false;
        return palavras.some((p) => partes.includes(p) || (p.length >= 8 && junto.includes(p))) || junto.includes(dominio.replace(/\./g, ""));
      });
    },
  },
  { chave: "terminacao", confere: (u) => TERMINACOES_DE_ARQUIVO.includes(u.hostname.split(".").pop() ?? "") },
  { chave: "sem_cadeado", confere: (u) => u.protocol === "http:" },
];

/** Confere um endereço contra a lista. Texto que não é endereço não acende nada. */
export function analisarLink(endereco: string): AnaliseDeLink {
  const nada: AnaliseDeLink = { suspeito: false, perigo: false, motivos: [], host: "" };
  const limpo = (endereco ?? "").trim();
  if (!limpo || /\s/.test(limpo)) return nada;
  let u: URL;
  try {
    u = new URL(limpo);
  } catch {
    return nada;
  }
  if (!["http:", "https:", "javascript:", "data:", "vbscript:", "file:"].includes(u.protocol)) return nada;
  const motivos = PADROES_DE_LINK.filter((p) => {
    try {
      return p.confere(u);
    } catch {
      return false;
    }
  }).map((p) => p.chave);
  return { suspeito: motivos.length > 0, perigo: motivos.includes("perigo"), motivos, host: u.hostname };
}

/** Os endereços http(s) escritos num texto (para o aviso antes de publicar). */
export function linksDoTexto(texto: string): string[] {
  return (texto.match(/https?:\/\/[^\s<>"'()]+/gi) ?? []).map((l) => l.replace(/[.,;:!?]+$/, ""));
}
