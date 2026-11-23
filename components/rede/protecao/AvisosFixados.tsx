// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

interface Topo {
  avisos: AvisoNoAlto[];
  so_leitura?: { ligado: boolean; desde: string | null };
}

/** Relê o alto no máximo uma vez por minuto ao trocar de tela (a casca fica montada entre as telas). */
const INTERVALO_MS = 60_000;

/**
 * O alto de toda página da Alumia (Prompt 5, D1): os avisos que a coordenação fixou (no máximo 3, cada um com prazo) e a faixa
 * do modo só leitura, quando a coordenação liga. Uma chamada só (public.alumia_topo); sem ela no banco (antes do SQL), cai nos
 * avisos de antes (public.alumia_avisos_fixados). O banco devolve só o texto, o link de dentro do site e desde quando; nunca
 * quem fixou. Nada aqui registra quem leu. Sem aviso, sem modo e sem resposta, não desenha nada.
 */
export default function AvisosFixados({ lang, s }: Pick<ContextoDoEncaixe, "lang" | "s">) {
  const [topo, setTopo] = useState<Topo>({ avisos: [] });
  const caminho = usePathname();
  const lidoEm = useRef(0);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  useEffect(() => {
    // Trocar de tela não cancela a leitura que já saiu: só evita outra antes de um minuto.
    if (Date.now() - lidoEm.current < INTERVALO_MS) return;
    lidoEm.current = Date.now();
    rpc<Topo>("alumia_topo")
      .catch(() => rpc<AvisoNoAlto[]>("alumia_avisos_fixados").then((avisos): Topo => ({ avisos })))
      .then((r) => {
        if (montado.current && r && Array.isArray(r.avisos)) setTopo({ avisos: r.avisos.slice(0, 3), so_leitura: r.so_leitura });
      })
      .catch(() => undefined);
  }, [caminho]);
  const soLeitura = topo.so_leitura?.ligado === true;
  if (topo.avisos.length === 0 && !soLeitura) return null;
  return (
    <section className="al-aviso-fixado-lista" aria-label={s.avisoFixado.rotulo}>
      {soLeitura ? (
        <p className="al-aviso-fixado" data-tom="so-leitura" role="status">
          <span className="al-aviso-fixado-rotulo al-cond">{s.avisoFixado.soLeituraRotulo}</span>
          <span className="al-aviso-fixado-texto">{s.avisoFixado.soLeitura}</span>
        </p>
      ) : null}
      {topo.avisos.map((a) => (
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
