// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import { safeLink } from "@/lib/text";
import { EstadoVazio } from "./EstadoVazio";
import { useI18n } from "./I18n";

interface Material {
  id: string;
  tipo: keyof Dict["materials"]["types"];
  titulo: string;
  descricao: string;
  campanha: string;
  url: string;
  publicado?: boolean;
  credito_autor?: string;
  licenca?: string;
}

/** O nome da licença no idioma da página (as Creative Commons têm o mesmo nome em toda língua). */
const LICENCAS: Record<string, Record<string, string> | string> = {
  "cc-by-sa": "CC BY-SA 4.0",
  "cc-by": "CC BY 4.0",
  cc0: "CC0",
  "dominio-publico": { pt: "Domínio público", en: "Public domain", es: "Dominio público", ru: "Общественное достояние", zh: "公有领域" },
  autorizacao: { pt: "Com autorização de quem fez", en: "Used with the author's permission", es: "Con autorización de quien lo hizo", ru: "С разрешения автора", zh: "经作者授权" },
  outra: { pt: "Licença livre", en: "Free license", es: "Licencia libre", ru: "Свободная лицензия", zh: "自由许可" },
};
const nomeDaLicenca = (l: string | undefined, lang: string) => { const x = LICENCAS[l ?? ""]; return typeof x === "string" ? x : x?.[lang] ?? x?.pt ?? ""; };

/** Zines, panfletos, cartazes e banners para baixar, imprimir e distribuir. A lista é mantida pela coordenação. */
export function Materials({ s }: { s: Dict["materials"] }) {
  const { t, lang } = useI18n();
  const [list, setList] = useState<Material[] | null>(null);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelled = false;
    rpc<Material[]>("materiais_listar")
      .then((data) => {
        // Só o que está no ar e já tem endereço (a equipe logada também recebe rascunhos, que ficam no painel).
        if (!cancelled) setList(data.filter((item) => item.publicado !== false && item.url));
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
  if (list.length === 0) return <EstadoVazio textos={t.lists.empty.materiais} acaoHref="/contribuir" relacionadoHref="/galeria" />;

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
                  {item.credito_autor && <p className="mt-2 font-sans text-xs text-ink-soft">{item.credito_autor}{item.licenca ? ` · ${nomeDaLicenca(item.licenca, lang)}` : ""}</p>}
                  <p className="mt-4 font-sans text-sm">
                    <a href={safeLink(item.url) ? item.url : undefined} target="_blank" rel="noopener noreferrer" className="inline-block bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood">
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
