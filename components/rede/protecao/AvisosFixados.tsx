// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { rpc } from "@/lib/backend";
import type { ContextoDoEncaixe } from "../encaixes";
import "./avisos-fixados.css";

interface AvisoNoAlto {
  id: string;
  texto: string;
  link: string | null;
  desde: string;
}

/**
 * Os avisos que a coordenação fixou no alto da Alumia (painel de controle): no máximo 3, cada
 * um com prazo. O banco devolve só o texto e o link de dentro do site; nunca quem fixou. Sem aviso, sem a função no banco ou sem
 * resposta, não desenha nada. Nada aqui registra quem leu.
 */
export default function AvisosFixados({ lang, s }: ContextoDoEncaixe) {
  const [avisos, setAvisos] = useState<AvisoNoAlto[]>([]);
  useEffect(() => {
    let cancelado = false;
    rpc<AvisoNoAlto[]>("alumia_avisos_fixados")
      .then((lista) => {
        if (!cancelado && Array.isArray(lista)) setAvisos(lista.slice(0, 3));
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);
  if (avisos.length === 0) return null;
  return (
    <section className="al-aviso-fixado-lista" aria-label={s.avisoFixado.rotulo}>
      {avisos.map((a) => (
        <p key={a.id} className="al-aviso-fixado">
          <span className="al-aviso-fixado-rotulo al-cond">{s.avisoFixado.rotulo}</span>
          <span className="al-aviso-fixado-texto">{a.texto}</span>
          {a.link && /^\/[^/\\]/.test(a.link) ? (
            <Link href={`/${lang}${a.link}`} className="al-aviso-fixado-link">
              {s.avisoFixado.abrir}
            </Link>
          ) : null}
        </p>
      ))}
    </section>
  );
}
