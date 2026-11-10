// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import { Icone, type NomeDoIcone } from "../publicar/alumia2/icones";

/** O mosaico apagado de 7 × 5 cartões, com um só aceso em dourado ("você"): o desenho dos estados vazios da Alumia. */
export function MosaicoApagado() {
  const cel = Array.from({ length: 35 }, (_, i) => i);
  return (
    <svg aria-hidden viewBox="0 0 70 50" className="al2-estado-mosaico">
      {cel.map((i) => {
        const x = (i % 7) * 10;
        const y = Math.floor(i / 7) * 10;
        return <rect key={i} x={x + 1} y={y + 1} width={8} height={8} rx={1.5} className={i === 17 ? "al2-estado-voce" : "al2-estado-apagado"} style={{ animationDelay: `${(i % 7) * 60 + Math.floor(i / 7) * 40}ms` }} />;
      })}
    </svg>
  );
}

/**
 * Um estado da Alumia (vazio, erro, "ainda não dá"): centralizado, com o desenho (um ícone num quadrado de cantos redondos, ou o
 * mosaico apagado), um título opcional, o texto e os botões. Erro vai com role="alert".
 */
export function EstadoDaAlumia({
  icone = "alerta",
  mosaico = false,
  titulo,
  texto,
  erro = false,
  children,
}: {
  icone?: NomeDoIcone;
  /** O mosaico apagado no lugar do ícone (páginas que não existem, listas vazias). */
  mosaico?: boolean;
  titulo?: ReactNode;
  texto: ReactNode;
  erro?: boolean;
  /** Os botões (Tentar de novo, Voltar…). */
  children?: ReactNode;
}) {
  return (
    <div className={`al2-estado${erro ? " al2-estado-erro" : ""}`} role={erro ? "alert" : undefined}>
      {mosaico ? (
        <MosaicoApagado />
      ) : (
        <span className="al2-estado-icone" aria-hidden>
          <Icone nome={icone} className="h-7 w-7" />
        </span>
      )}
      {titulo && <h1 className="al2-estado-titulo al-cond">{titulo}</h1>}
      <p className={`al2-estado-texto ${titulo ? "mt-2" : "mt-4"}`}>{texto}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
