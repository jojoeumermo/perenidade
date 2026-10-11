// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";

interface Supporter {
  id: string;
  nome: string;
  mensagem: string;
}

/** Mural de quem apoiou a campanha. Os nomes são adicionados pela coordenação. */
export function SupportersWall({ empty }: { empty: string }) {
  const [list, setList] = useState<Supporter[] | null>(null);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<Supporter[]>("apoiadores_listar")
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

  if (!list || list.length === 0) return <p className="mt-4 text-lg text-ink-soft">{empty}</p>;
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((supporter) => (
        <li key={supporter.id} className="border border-rule bg-parchment-deep p-4">
          <p className="text-xl font-semibold">{supporter.nome}</p>
          {supporter.mensagem && <p className="mt-1 font-sans text-sm italic text-ink-soft">“{supporter.mensagem}”</p>}
        </li>
      ))}
    </ul>
  );
}
