// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista das versões dos apps (public/apps/versoes.json), gerada pelo fluxo de lançamento (.github/workflows/apps-lancamento.yml)
// e mostrada na página de baixar e conferir (/alumia/app). Formato (desenho da R3, seção 2.4):
//   { versao, arquivos: [{ nome, plataforma, sha256, tamanho, rekor: { indice, uuid }, pacote }] }
// O arquivo e o pacote Sigstore ficam no lançamento do GitHub da tag v<versao>; os endereços saem daqui, não do JSON.
// Nada nesta lista é confiável por si: quem confere é o Sigstore (lib/rede/transparencia-apps/conferir.ts e o app). A página só
// mostra; o que vier fora do formato some da lista em vez de ir para a tela.
// Sem "@/" de propósito: roda no Node nos testes.
import { REPOSITORIO, versaoValida } from "./identidade";

export type PlataformaDoApp = "android" | "windows" | "macos" | "linux";
const PLATAFORMAS: readonly PlataformaDoApp[] = ["android", "windows", "macos", "linux"];

export interface ArquivoDoApp {
  nome: string;
  plataforma: PlataformaDoApp;
  sha256: string;
  tamanho: number;
  rekor: { indice: number; uuid: string };
  /** Nome do pacote Sigstore no lançamento (<nome>.sigstore.json). */
  pacote: string;
}

export interface VersoesDosApps {
  versao: string | null;
  arquivos: ArquivoDoApp[];
}

const NOME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function arquivo(x: unknown): ArquivoDoApp | null {
  if (!x || typeof x !== "object") return null;
  const a = x as Record<string, unknown>;
  const rekor = a.rekor as Record<string, unknown> | undefined;
  if (typeof a.nome !== "string" || !NOME.test(a.nome)) return null;
  if (typeof a.pacote !== "string" || !NOME.test(a.pacote)) return null;
  if (!PLATAFORMAS.includes(a.plataforma as PlataformaDoApp)) return null;
  if (typeof a.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(a.sha256)) return null;
  if (typeof a.tamanho !== "number" || !Number.isSafeInteger(a.tamanho) || a.tamanho <= 0) return null;
  if (!rekor || typeof rekor.indice !== "number" || !Number.isSafeInteger(rekor.indice) || rekor.indice < 0) return null;
  if (typeof rekor.uuid !== "string" || !/^[0-9a-f]{64,80}$/.test(rekor.uuid)) return null;
  return { nome: a.nome, plataforma: a.plataforma as PlataformaDoApp, sha256: a.sha256, tamanho: a.tamanho, rekor: { indice: rekor.indice, uuid: rekor.uuid }, pacote: a.pacote };
}

/** Lê a lista; o que estiver fora do formato fica de fora. Versão inválida = nenhuma versão. */
export function lerVersoes(json: unknown): VersoesDosApps {
  if (!json || typeof json !== "object") return { versao: null, arquivos: [] };
  const j = json as Record<string, unknown>;
  if (typeof j.versao !== "string" || !versaoValida(j.versao)) return { versao: null, arquivos: [] };
  const arquivos = Array.isArray(j.arquivos) ? j.arquivos.map(arquivo).filter((a): a is ArquivoDoApp => a !== null) : [];
  return { versao: j.versao, arquivos };
}

/** O endereço de um arquivo do lançamento (o binário ou o pacote Sigstore). */
export function enderecoNoLancamento(versao: string, nome: string): string {
  return `https://github.com/${REPOSITORIO}/releases/download/v${versao}/${encodeURIComponent(nome)}`;
}

/** A entrada no buscador público do Rekor. */
export function enderecoNoRekor(indice: number): string {
  return `https://search.sigstore.dev/?logIndex=${indice}`;
}
