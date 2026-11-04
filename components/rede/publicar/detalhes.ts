// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { redePub } from "@/lib/rede/cliente-publicar";
import type { DetalhesDoPost } from "@/lib/rede/tipos-publicar";

// Os detalhes dos posts (áudio, enquete, prévia, quem responde, edição) chegam em LOTE: todos os cartões que aparecem juntos
// pedem no mesmo instante e uma chamada só (até 50 ids) responde por todos. Cada resposta fica guardada até alguém mudar o post
// (votar, editar) e chamar `invalidar`.
type Pendente = { resolver: (d: DetalhesDoPost | null) => void };

const guardados = new Map<string, Promise<DetalhesDoPost | null>>();
const pendentes = new Map<string, Pendente[]>();
let marcado = false;

async function enviar() {
  marcado = false;
  const ids = [...pendentes.keys()].slice(0, 50);
  const grupos = ids.map((id) => [id, pendentes.get(id) ?? []] as const);
  ids.forEach((id) => pendentes.delete(id));
  try {
    const r = await redePub.detalhes(ids);
    for (const [id, quem] of grupos) quem.forEach((p) => p.resolver(r[id] ?? null));
  } catch {
    for (const [, quem] of grupos) quem.forEach((p) => p.resolver(null));
  }
  if (pendentes.size) {
    marcado = true;
    setTimeout(() => void enviar(), 20);
  }
}

export function detalhesDe(id: string): Promise<DetalhesDoPost | null> {
  const feito = guardados.get(id);
  if (feito) return feito;
  const p = new Promise<DetalhesDoPost | null>((resolver) => {
    pendentes.set(id, [...(pendentes.get(id) ?? []), { resolver }]);
    if (!marcado) {
      marcado = true;
      setTimeout(() => void enviar(), 30);
    }
  });
  guardados.set(id, p);
  return p;
}

/** Esquece o que se sabia do post (depois de votar ou editar). */
export const invalidar = (id: string) => void guardados.delete(id);

let vencidosPublicados = false;
/** "Ao ler": na primeira vez que a Rede aparece, publica o que a pessoa agendou e já venceu (o banco confere tudo). Uma vez por página. */
export function publicarVencidosUmaVez() {
  if (vencidosPublicados) return;
  vencidosPublicados = true;
  void redePub.agendados().catch(() => undefined);
}
