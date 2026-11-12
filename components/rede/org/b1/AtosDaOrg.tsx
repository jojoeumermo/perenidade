// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A aba Atos da organização de verdade: os chamados que ela publicou (rede_org_atos), os próximos primeiro e depois os dos
// últimos 60 dias, cada um com o mosaico da contagem PUBLICADA (nunca o número de pessoas) e o carimbo da situação. Leva à
// página do ato. Antes, a aba ficava sempre vazia (PerfilDaAlumia2 não passava os atos).
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { clienteOrgB1 } from "@/lib/rede/cliente-org-b1";
import { preencher } from "@/lib/rede/preencher";
import { useTextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import type { Ato } from "@/lib/rede/tipos-atos";
import { Mosaico } from "../../mosaico/Mosaico";
import { Carimbo } from "../../ui/Carimbo";
import "./b1.css";

export function AtosDaOrganizacao({ handle, lang, vazio }: { handle: string; lang: string; vazio: string }) {
  const t = useTextosDaOrgB1(lang);
  const [atos, setAtos] = useState<Ato[] | null>(null);
  const [aberta] = useState(() => Date.now());
  useEffect(() => {
    let vivo = true;
    clienteOrgB1().atos(handle).then((a) => vivo && setAtos(a ?? [])).catch(() => vivo && setAtos([]));
    return () => {
      vivo = false;
    };
  }, [handle]);
  if (!t || !atos) return null;
  if (atos.length === 0) return <p className="al-painel-vazio">{vazio}</p>;
  const ta = t.atos;
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { ...o, timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  const corte = aberta - 6 * 3600e3;
  const grupos = [
    { nome: ta.proximos, itens: atos.filter((a) => new Date(a.inicio).getTime() > corte) },
    { nome: ta.passados, itens: atos.filter((a) => new Date(a.inicio).getTime() <= corte) },
  ].filter((g) => g.itens.length > 0);
  return (
    <div className="b1-atos">
      {grupos.map((g) => (
        <section key={g.nome} aria-label={g.nome}>
          <h3 className="b1-mini">{g.nome}</h3>
          <ul className="al-lista-simples">
            {g.itens.map((a) => (
              <li key={a.id} className="b1-ato">
                <Link href={`/${lang}/alumia/ato/${a.id}`} className="b1-ato-link" aria-label={preencher(ta.abrir, { titulo: a.titulo })}>
                  <span className="al-ato-dia al-cond">
                    <b>{fmt(a.inicio, { day: "2-digit" })}</b>
                    <span>{fmt(a.inicio, { month: "short" }).replace(".", "")}</span>
                  </span>
                  <span className="al-ato-info">
                    <strong className={a.situacao === "cancelado" ? "al-riscado" : undefined}>{a.titulo}</strong>
                    <span>{a.onde} · {a.cidade} · {fmt(a.inicio, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  <Mosaico palavra={a.palavra} semente={a.id} proporcao={a.acesos} rotulo={a.palavra} className="b1-ato-mosaico" />
                  <Carimbo situacao={a.situacao} texto={ta.situacao[a.situacao]} tamanho="p" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
