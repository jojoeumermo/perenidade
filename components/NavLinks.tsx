"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Sobre" some do cabeçalho em telas estreitas (continua no rodapé) para os links caberem em uma linha.
const links = [
  { label: "Trilhas", href: "/trilhas" },
  { label: "Acervo", href: "/acervo" },
  { label: "Contribuir", href: "/contribuir" },
  { label: "Sobre", href: "/sobre", wideOnly: true },
  { label: "Buscar", href: "/busca" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ label, href, wideOnly }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap hover:text-oxblood ${wideOnly ? "hidden sm:inline" : ""} ${
              active ? "text-oxblood underline decoration-gold underline-offset-8" : ""
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
