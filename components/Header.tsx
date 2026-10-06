import Link from "next/link";

const links = [
  ["Acervo", "/acervo"],
  ["Trilhas", "/trilhas"],
  ["Contribuir", "/contribuir"],
  ["Sobre", "/sobre"],
  ["Denunciar", "/denunciar"],
];

export function Header() {
  return (
    <header className="border-b border-rule">
      <div className="bg-ink text-parchment font-mono text-xs px-4 py-1.5 text-center tracking-wide">
        Arquivo vivo · 100% gratuito · conteúdo versionado e revertível
      </div>
      <div className="mx-auto max-w-6xl px-4 py-5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-3">
          <span aria-hidden className="text-3xl text-gold">◈</span>
          <span className="text-3xl font-semibold tracking-tight">Perenidade</span>
        </Link>
        <nav className="flex gap-5 font-sans text-sm text-ink-soft">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-oxblood">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
