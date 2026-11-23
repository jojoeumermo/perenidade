// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As posições que chegaram a este aparelho (Prompt 4, itens 2 e 7): só a última de cada pessoa, enquanto vale. "Perto de <município>"
// sai do índice local da Alumia (lib/rede/perto/lugar.ts), sem serviço de fora. Abrir no mapa: só o aplicativo do próprio aparelho
// (geo:) ou copiar as coordenadas; nenhum link para mapa de site de fora com a posição. Nada baixa sozinho.
import { useEffect, useState } from "react";
import type { Indice } from "@/lib/rede/mapa/indice";
import { linkGeo, municipioPerto } from "@/lib/rede/perto/lugar";
import type { PosicaoRecebida } from "@/lib/rede/perto/posicao";
import { guardaDePosicoes } from "@/lib/rede/perto/guarda";
import { horaNoIdioma, por, type TextosDoPerto } from "./textos";

let indice: Promise<Indice> | null = null;
const carregarIndice = () => (indice ??= import("@/lib/rede/mapa/indice").then((m) => m.carregarIndice()));

function Lugar({ t, p }: { t: TextosDoPerto["recebidas"]; p: PosicaoRecebida }) {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    if (p.la === null || p.lo === null) return;
    let vivo = true;
    carregarIndice().then(
      (i) => {
        const m = vivo ? municipioPerto(i, p.la!, p.lo!) : null;
        if (vivo) setTexto(m ? por(t.perto, { lugar: `${m.nome} (${m.uf})` }) : t.foraDoMapa);
      },
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [p.la, p.lo, t]);
  return texto ? <span className="pt-lugar">{texto}</span> : null;
}

export function UmaPosicao({ t, lang, p, nome }: { t: TextosDoPerto; lang: string; p: PosicaoRecebida; nome: string }) {
  const r = t.recebidas;
  const [copiado, setCopiado] = useState(false);
  const titulo = p.sos ? por(p.volta ? r.sosVolta : r.sos, { nome }) : nome;
  const tem = p.la !== null && p.lo !== null;
  return (
    <li className={`pt-posicao${p.sos ? " pt-posicao-sos" : ""}`} data-sos={p.sos ? "sim" : undefined}>
      <h3>{titulo}</h3>
      {tem ? (
        <p className="pt-nota">
          <Lugar t={r} p={p} /> · {p.precisao === "bairro" ? r.bairro : r.exata} · <span className="pt-coord">{p.la}, {p.lo}</span>
        </p>
      ) : (
        <p className="pt-nota">{r.semPosicao}</p>
      )}
      <p className="pt-nota">{por(r.ate, { hora: horaNoIdioma(lang, p.vale) })}</p>
      <div className="pt-acoes">
        {tem && (
          <>
            <a className="al-botao al-botao-contorno al-botao-m" href={linkGeo(p.la!, p.lo!)}>
              {r.abrirNoAparelho}
            </a>
            <button
              type="button"
              className="al-botao al-botao-fantasma al-botao-m"
              onClick={() => {
                void navigator.clipboard?.writeText(`${p.la}, ${p.lo}`).then(() => setCopiado(true), () => undefined);
              }}
            >
              {copiado ? r.copiado : r.copiar}
            </button>
          </>
        )}
        {p.sos && (
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => guardaDePosicoes.tirar(p.origem, p.autor)}>
            {r.entendi}
          </button>
        )}
      </div>
    </li>
  );
}
