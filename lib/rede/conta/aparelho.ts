// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// 110. Checagem do aparelho (app Android da R3): o plugin AlumiaAparelho (Java) só lê o que o Android diz a qualquer app; aqui fica a
// avaliação, pura, que o teste prova no Node. Nada sai do aparelho. Sem "@/" de propósito; sem import do Capacitor (quem registra o
// plugin é casca/app/iniciar.ts).

/** O plugin AlumiaAparelho, como a ponte o expõe. */
export interface PluginAparelho {
  checar(): Promise<DadosDoAparelho>;
}

export interface DadosDoAparelho {
  /** Build.VERSION.SDK_INT */
  sdk: number;
  /** Build.VERSION.SECURITY_PATCH ("AAAA-MM-DD" ou vazio). */
  patch: string;
  /** Há senha, PIN, padrão ou digital na tela de bloqueio. */
  bloqueio: boolean;
  /** Os nomes dos apps com acessibilidade ligada. */
  acessibilidade: string[];
}

export type AvisoDoAparelho =
  | { tipo: "desatualizado"; patch: string }
  | { tipo: "antigo" }
  | { tipo: "semBloqueio" }
  | { tipo: "acessibilidade"; nomes: string[] };

/** A versão mais antiga do Android que ainda recebe atualização de segurança do Google (Android 13 = SDK 33, em 2026). */
export const SDK_COM_SUPORTE = 33;
/** Quantos dias sem atualização de segurança contam como "desatualizado". */
export const DIAS_SEM_ATUALIZAR = 180;

/** Os avisos para estes dados (vazio = nada a avisar). */
export function avaliarAparelho(d: DadosDoAparelho, agora: number = Date.now()): AvisoDoAparelho[] {
  const avisos: AvisoDoAparelho[] = [];
  if (Number.isInteger(d.sdk) && d.sdk > 0 && d.sdk < SDK_COM_SUPORTE) avisos.push({ tipo: "antigo" });
  const t = /^\d{4}-\d{2}-\d{2}$/.test(d.patch ?? "") ? Date.parse(`${d.patch}T00:00:00Z`) : NaN;
  if (Number.isFinite(t) && agora - t > DIAS_SEM_ATUALIZAR * 86_400_000) avisos.push({ tipo: "desatualizado", patch: d.patch });
  if (d.bloqueio !== true) avisos.push({ tipo: "semBloqueio" });
  const nomes = (Array.isArray(d.acessibilidade) ? d.acessibilidade : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 60)).slice(0, 20);
  if (nomes.length > 0) avisos.push({ tipo: "acessibilidade", nomes });
  return avisos;
}
