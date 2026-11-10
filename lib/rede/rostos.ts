// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os rostos de pixels que a gente já conhece (perfil livre, A5): quando a aparência de um perfil é lida ou salva, o rosto que a
// pessoa desenhou fica guardado aqui (e na sessão da aba), e o Avatar16 da rede inteira (cartão da barra lateral, posts, conversas,
// stories) passa a mostrar ESSE rosto no lugar do automático. É só a aparência pública do perfil, já conferida; nada de rastreio,
// nada vai para servidor nenhum, e fechar a aba esquece tudo. Sem o rosto, fica o desenho automático do @nome.
import { useSyncExternalStore } from "react";
import { rostoValido } from "./aparencia";

/** Só na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): o rosto de exemplo da Faísca, a pessoa logada das pranchas. */
export const ROSTOS_DA_PREVIA: Readonly<Record<string, string>> = {
  faisca: "0011110001222210122332211232232112222221012442100122221000111100",
};

const CHAVE = "alumia:rostos";
const MAXIMO = 300;
let rostos: Map<string, string> | null = null;
const ouvintes = new Set<() => void>();

function mapa(): Map<string, string> {
  if (rostos) return rostos;
  rostos = new Map();
  try {
    const bruto = typeof window === "undefined" ? null : window.sessionStorage.getItem(CHAVE);
    const lido = bruto ? (JSON.parse(bruto) as Record<string, unknown>) : {};
    if (process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim") for (const [h, px] of Object.entries(ROSTOS_DA_PREVIA)) rostos.set(h, px);
    for (const [h, px] of Object.entries(lido)) if (rostoValido(px)) rostos.set(h, px);
    // Um rosto apagado na prévia fica apagado (null guardado).
    for (const [h, px] of Object.entries(lido)) if (px === null) rostos.delete(h);
  } catch {
    // sem armazenamento: só não lembra depois de recarregar
  }
  return rostos;
}

/** Guarda (ou esquece, com `null`) o rosto de pixels de um @nome. */
export function lembrarRosto(handle: string, px: string | null | undefined) {
  if (!handle) return;
  const m = mapa();
  const antes = m.get(handle) ?? null;
  const agora = px && rostoValido(px) ? px : null;
  if (antes === agora) return;
  if (agora) m.set(handle, agora);
  else m.delete(handle);
  while (m.size > MAXIMO) m.delete(m.keys().next().value as string);
  try {
    const guardar: Record<string, string | null> = Object.fromEntries(m);
    if (!agora) guardar[handle] = null;
    window.sessionStorage.setItem(CHAVE, JSON.stringify(guardar));
  } catch {
    // idem
  }
  for (const f of ouvintes) f();
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** O rosto de pixels conhecido de um @nome (nulo = o desenho automático). No servidor, sempre nulo. */
export function useRostoDe(handle: string): string | null {
  return useSyncExternalStore(
    assinar,
    () => mapa().get(handle) ?? null,
    () => null,
  );
}
