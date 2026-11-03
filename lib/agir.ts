// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Agir": a tarefa pequena do fim da aula e o "como foi?" que a aula seguinte da trilha pergunta. Tudo fica só no aparelho
// da pessoa (localStorage, chave "lucia:agir:<trilha>/<aula>"): o site não recebe a resposta nem conta quem fez. Entra na
// cópia de segurança e sai no "apagar meus dados" (lib/estudo.ts, prefixo "lucia:agir:").
// Sem os atalhos "@/" de propósito: os roteiros de conferência rodam este arquivo direto no Node.

export type EstadoDoAgir = "vou" | "fiz" | "em-parte" | "nao";
export const ESTADOS_DO_AGIR: EstadoDoAgir[] = ["vou", "fiz", "em-parte", "nao"];

export interface RegistroDoAgir {
  estado: EstadoDoAgir;
  /** O que a pessoa escreveu sobre como foi; no máximo 2000 caracteres. */
  nota?: string;
  /** Quando foi guardado (milissegundos). */
  em: number;
}

export const PREFIXO_DO_AGIR = "lucia:agir:";
export const chaveDoAgir = (aula: string) => `${PREFIXO_DO_AGIR}${aula}`;

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Lê o registro de uma aula; qualquer coisa fora do formato (ou armazenamento bloqueado) vira "nada guardado". */
export function lerAgir(aula: string, armazenamento?: Armazenamento): RegistroDoAgir | null {
  try {
    const a = armazenamento ?? localStorage;
    const bruto = a.getItem(chaveDoAgir(aula));
    if (!bruto) return null;
    const r = JSON.parse(bruto) as Partial<RegistroDoAgir> | null;
    if (!r || typeof r !== "object" || !ESTADOS_DO_AGIR.includes(r.estado as EstadoDoAgir)) return null;
    return { estado: r.estado as EstadoDoAgir, nota: typeof r.nota === "string" && r.nota ? r.nota.slice(0, 2000) : undefined, em: typeof r.em === "number" ? r.em : 0 };
  } catch {
    return null;
  }
}

/** Guarda o registro; sem estado, apaga. Devolve se conseguiu guardar (sem armazenamento, vale só na página aberta). */
export function guardarAgir(aula: string, registro: { estado: EstadoDoAgir; nota?: string } | null, armazenamento?: Armazenamento, agora = Date.now()): boolean {
  try {
    const a = armazenamento ?? localStorage;
    if (!registro) a.removeItem(chaveDoAgir(aula));
    else a.setItem(chaveDoAgir(aula), JSON.stringify({ estado: registro.estado, nota: registro.nota?.trim().slice(0, 2000) || undefined, em: agora }));
    return true;
  } catch {
    return false;
  }
}

/** O id da aula ("trilha/aula") a partir do endereço da página, com ou sem o prefixo do idioma. */
export function aulaDoEndereco(pathname: string): string | null {
  const m = /^(?:\/[a-z]{2})?\/trilhas\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(pathname);
  return m ? `${m[1]}/${m[2]}` : null;
}
