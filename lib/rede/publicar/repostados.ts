// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Eu já repostei este post?" para os cartões da linha, numa chamada só por página (rede_pub_repostados, até 50 ids), e não uma
// por cartão. Só o próprio estado: o banco nunca diz quem mais repostou. Sem "@/" de propósito.
import { redePub } from "../cliente-publicar";

let fila: { id: string; feito: (sim: boolean) => void; falhou: (e: unknown) => void }[] = [];
let marcado = false;

function rodar() {
  marcado = false;
  const lote = fila;
  fila = [];
  for (let i = 0; i < lote.length; i += 50) {
    const parte = lote.slice(i, i + 50);
    redePub.repostados([...new Set(parte.map((x) => x.id))]).then(
      (lista) => {
        const sim = new Set(Array.isArray(lista) ? lista : []);
        for (const x of parte) x.feito(sim.has(x.id));
      },
      (e) => {
        for (const x of parte) x.falhou(e);
      },
    );
  }
}

/** Se a própria pessoa repostou o post. Os pedidos do mesmo instante vão juntos. */
export function jaRepostei(id: string): Promise<boolean> {
  return new Promise((feito, falhou) => {
    fila.push({ id, feito, falhou });
    if (!marcado) {
      marcado = true;
      setTimeout(rodar, 0);
    }
  });
}
