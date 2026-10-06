import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Erro 404</p>
      <h1 className="mt-3 text-5xl font-semibold">Este rolo não está na estante</h1>
      <p className="mx-auto mt-4 max-w-xl text-xl text-ink-soft">
        A página pode ter mudado de lugar ou nunca ter existido. O acervo continua inteiro.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 font-sans text-sm">
        <Link href="/busca" className="bg-ink px-8 py-3 font-medium text-parchment hover:bg-oxblood">Buscar no acervo</Link>
        <Link href="/" className="border-2 border-ink px-8 py-3 font-medium hover:border-oxblood hover:text-oxblood">Página inicial</Link>
      </div>
    </div>
  );
}
