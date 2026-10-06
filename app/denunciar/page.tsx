export const metadata = { title: "Denunciar — Perenidade" };

export default async function Denunciar({ searchParams }: PageProps<"/denunciar">) {
  const sp = await searchParams;
  const item = typeof sp.item === "string" ? sp.item : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Direitos autorais · DMCA</p>
      <h1 className="mt-2 text-5xl font-semibold">Denunciar conteúdo</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Respeitamos direitos autorais. Todo item denunciado é colocado em quarentena (<code className="font-mono">is_active = false</code>)
        até a revisão, e removido se a violação for confirmada.
      </p>

      <form className="mt-10 space-y-5 font-sans text-sm">
        <label className="block">
          Item ou URL
          <input defaultValue={item} disabled className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono disabled:opacity-60" />
        </label>
        <label className="block">
          Motivo
          <textarea disabled rows={6} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 disabled:opacity-60" />
        </label>
        <label className="block">
          E-mail para contato
          <input type="email" disabled className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 disabled:opacity-60" />
        </label>
        <button disabled className="bg-oxblood px-8 py-3 font-medium text-parchment disabled:opacity-50">
          Enviar denúncia
        </button>
        <p className="font-mono text-xs text-ink-soft">Formulário será ativado junto com o banco de dados.</p>
      </form>
    </div>
  );
}
