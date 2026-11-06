// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/Link";

/** A navegação própria do Vale o Escrito (na barra da moldura): marca a página aberta com aria-current. */
export function NavDoVale({ rotulo, itens }: { rotulo: string; itens: { href: string; texto: string; n: string }[] }) {
  const caminho = usePathname() ?? "";
  const raiz = itens[0]?.href ?? "";
  return (
    <nav className="ve-nav" aria-label={rotulo}>
      <ul>
        {itens.map((it) => {
          const aberta = it.href === raiz ? caminho === raiz || caminho.startsWith(`${raiz}/caso/`) || caminho.startsWith(`${raiz}/pessoa/`) || caminho.startsWith(`${raiz}/organizacao/`) : caminho.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={aberta ? "page" : undefined}>
                <span className="ve-nav-n" aria-hidden="true">
                  {it.n}
                </span>
                {it.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
