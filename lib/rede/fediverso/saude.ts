// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A federação na Saúde do painel da Alumia (P5, A7): o painel dizia "Fediverso: ligada" (a decisão do recurso, no banco) enquanto a
// tela do Fediverso dizia "a federação ainda não está ligada no servidor". As duas coisas são diferentes, e para a federação andar
// precisam de quatro peças: o recurso ligado, o endereço próprio da Alumia em https, o segredo da federação no servidor que está no
// ar e o mesmo segredo (o SHA-256 dele) e o endereço de entrega guardados no banco. Aqui o servidor diz quais peças existem, sem
// nunca mostrar valor, tamanho ou endereço. Só no servidor (app/api/alumia/painel/saude). Sem "@/".
import { ALUMIA_URL, urlDaAlumiaOk } from "../alumia";

/** O que o banco diz da federação (public.alumia_admin_federacao: só a coordenação com o segundo fator). */
export interface FederacaoNoBanco {
  total: boolean;
  grupos: boolean;
  segredo_guardado: boolean;
  url_entrega: boolean;
}

export interface SaudeDaFederacao {
  /** O endereço próprio da Alumia é https e serve para a federação. */
  endereco: boolean;
  /** O segredo da federação está no servidor, com o tamanho mínimo. */
  segredo: "presente" | "curta" | "falta";
  /** O banco reconhece o segredo do servidor (o SHA-256 confere). Nulo: não deu para perguntar. */
  banco_reconhece: boolean | null;
  /** O que o banco tem (nulo: a migração do P5 não rodou, ou a sessão não pode). */
  banco: FederacaoNoBanco | null;
  /** O que falta, em frases do painel (português), na ordem de fazer. Vazio: a federação está pronta no servidor. */
  faltam: string[];
}

/** A peça "segredo" pelo valor do ambiente (nunca devolve o valor). Pura. */
export function situacaoDoSegredo(valor: string | undefined): SaudeDaFederacao["segredo"] {
  const v = (valor ?? "").trim();
  return !v ? "falta" : v.length < 32 ? "curta" : "presente";
}

/** As frases do que falta. Pura (o teste roda no Node). */
export function oQueFalta(s: Omit<SaudeDaFederacao, "faltam">): string[] {
  const faltam: string[] = [];
  if (s.banco && !s.banco.total) faltam.push("Ligar o Fediverso (fediverso-total) em Beta fechado ou Recursos, quando a coordenação decidir.");
  if (!s.endereco) faltam.push("Pôr o endereço próprio da Alumia em https (NEXT_PUBLIC_ALUMIA_URL) e montar o site de novo.");
  if (s.segredo !== "presente") faltam.push("Pôr ALUMIA_FEDIVERSO_SEGREDO (32 caracteres ou mais) nas variáveis do servidor que está no ar e reiniciar o site.");
  if (s.banco && !s.banco.segredo_guardado) faltam.push("Guardar no banco o SHA-256 do segredo e o endereço de entrega (interno.configuracoes, chave \"fediverso\").");
  else if (s.banco && !s.banco.url_entrega) faltam.push("Guardar no banco o endereço de entrega da fila (url_entrega, na chave \"fediverso\").");
  if (s.segredo === "presente" && s.banco?.segredo_guardado && s.banco_reconhece === false) {
    faltam.push("O segredo do servidor não é o mesmo que o banco guardou: refaça o SHA-256 com o valor que está no servidor.");
  }
  return faltam;
}

/**
 * Monta a saúde da federação. `perguntarAoBanco` é public.rede_fed_servidor com o segredo (uma ação só de leitura, que só
 * responde se o SHA-256 confere); `doBanco` é o que public.alumia_admin_federacao devolveu (ou nulo).
 */
export async function saudeDaFederacao(
  doBanco: FederacaoNoBanco | null,
  perguntarAoBanco: () => Promise<boolean>,
  ambiente: Record<string, string | undefined> = process.env,
  endereco: string = ALUMIA_URL,
): Promise<SaudeDaFederacao> {
  const segredo = situacaoDoSegredo(ambiente.ALUMIA_FEDIVERSO_SEGREDO);
  const enderecoOk = /^https:\/\//.test(endereco) && urlDaAlumiaOk(endereco);
  let banco_reconhece: boolean | null = null;
  if (segredo === "presente") banco_reconhece = await perguntarAoBanco().catch(() => null);
  const base = { endereco: enderecoOk, segredo, banco_reconhece, banco: doBanco };
  return { ...base, faltam: oQueFalta(base) };
}
