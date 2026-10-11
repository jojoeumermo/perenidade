// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";

interface Material {
  id: string;
  tipo: keyof Dict["materials"]["types"];
  titulo: string;
  descricao: string;
  campanha: string;
  url: string;
}

/** Zines, panfletos, cartazes e banners para baixar, imprimir e distribuir. A lista é mantida pela liderança. */
export function Materials({ s }: { s: Dict["materials"] }) {
  const [list, setList] = useState<Material[] | null>(null);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<Material[]>("materiais_listar")
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;
  if (list === null) return null;
  if (list.length === 0) return <p className="mt-10 text-lg text-ink-soft">{s.empty}</p>;

  const campaigns = [...new Set(list.map((item) => item.campanha))];
  return (
    <div className="mt-8">
      {campaigns.map((campaign) => (
        <section key={campaign || "geral"} className="mt-10 first:mt-0">
          {campaign && <h2 className="border-b border-rule pb-2 text-3xl font-semibold">{campaign}</h2>}
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {list
              .filter((item) => item.campanha === campaign)
              .map((item) => (
                <li key={item.id} className="flex flex-col border border-rule bg-parchment-deep p-5">
                  <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.types[item.tipo] ?? item.tipo}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.titulo}</p>
                  {item.descricao && <p className="mt-1 flex-1 text-ink-soft">{item.descricao}</p>}
                  <p className="mt-4 font-sans text-sm">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-block bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">
                      {s.open}
                    </a>
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
