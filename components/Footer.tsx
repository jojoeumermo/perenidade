import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-rule mt-20">
      <div className="mx-auto max-w-6xl px-4 py-8 font-sans text-sm text-ink-soft flex flex-col gap-2 sm:flex-row sm:justify-between">
        <p>Perenidade — conhecimento livre, para todos, para sempre.</p>
        <p>
          Só domínio público, Creative Commons e texto da comunidade. Viu algo indevido?{" "}
          <Link href="/denunciar" className="underline hover:text-oxblood">Denuncie</Link>.
        </p>
      </div>
    </footer>
  );
}
