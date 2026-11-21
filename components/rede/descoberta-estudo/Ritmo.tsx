// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 48: o ritmo de estudo privado, só neste aparelho (lib/rede/descoberta-estudo/ritmo.ts). Conta por semana: perder um dia não
// quebra nada. Sem placar, sem sequência, sem a palavra "atrasado".
import { useEffect, useId, useState } from "react";
import { ACRESCIMOS, METAS, diaDe, escolherMeta, esquecerRitmo, lerRitmo, marcar, resumo, tempo, type Ritmo as R } from "@/lib/rede/descoberta-estudo/ritmo";
import { confirmar } from "@/components/perguntar";
import { Botao } from "../ui/Botao";
import { Bloco, por, type PropsDaParte } from "./comum";

export default function Ritmo({ t }: PropsDaParte) {
  const id = useId();
  const [r, setR] = useState<R | null>(null);
  const [hoje, setHoje] = useState("");
  // Lido depois de montar (o servidor não sabe o que este aparelho guardou).
  useEffect(() => {
    const x = window.setTimeout(() => {
      setHoje(diaDe(new Date()));
      setR(lerRitmo());
    }, 0);
    return () => window.clearTimeout(x);
  }, []);
  const k = t.ritmo;
  if (!r || !hoje) return <p role="status" className="de-miudo">{t.carregando}</p>;
  const s = resumo(r, hoje);
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <p className="de-texto" role="status">
          {s.meta ? por(k.semanaComMeta, { feito: tempo(s.semana.minutos), meta: tempo(s.meta) }) : por(k.semana, { feito: tempo(s.semana.minutos) })}
        </p>
        {s.metaFeita && <p className="de-ok">{k.metaFeita}</p>}
        <p className="de-miudo">{por(k.hoje, { feito: tempo(s.hoje) })}</p>
        <div className="de-acoes" role="group" aria-label={k.marcar}>
          {ACRESCIMOS.map((n) => (
            <Botao key={n} variante="contorno" onClick={() => setR(marcar(n, hoje))}>+{tempo(n)}</Botao>
          ))}
          {s.hoje > 0 && <Botao variante="fantasma" onClick={() => setR(marcar(-15, hoje))}>{k.tirar}</Botao>}
        </div>
        <h3 className="de-form-titulo">{k.antes}</h3>
        <ul className="de-lista">
          {s.anteriores.map((x) => (
            <li key={x.segunda} className="de-item">
              {por(k.semanaDe, { dia: x.segunda.split("-").reverse().slice(0, 2).join("/"), feito: tempo(x.minutos) })}
            </li>
          ))}
        </ul>
        <p className="de-miudo">{k.semPunir}</p>
      </Bloco>
      <div className="de-form">
        <label className="de-campo" htmlFor={id}>
          <span>{k.meta}</span>
          <select id={id} className="al2-campo" value={r.meta} onChange={(e) => setR(escolherMeta(Number(e.target.value), hoje))}>
            {METAS.map((m) => <option key={m} value={m}>{m ? por(k.metaPorSemana, { tempo: tempo(m) }) : k.semMeta}</option>)}
          </select>
        </label>
        <p className="de-miudo">{k.aparelho}</p>
        <Botao variante="fantasma" onClick={async () => {
          if (await confirmar(k.esquecerConfirmar, { perigo: true })) {
            esquecerRitmo();
            setR(lerRitmo());
          }
        }}>{k.esquecer}</Botao>
      </div>
    </div>
  );
}
