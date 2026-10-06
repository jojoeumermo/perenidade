import { areas } from "@/lib/data";

export const metadata = { title: "Contribuir — Perenidade" };

const rules = [
  "Envie apenas texto (Markdown). Não aceitamos upload de PDFs ou arquivos.",
  "Só conteúdo seu, de domínio público ou com licença aberta (CC BY, CC BY-SA…).",
  "Todo envio vira um rascunho: a moderação apenas aprova ou recusa. Nada é editado direto no acervo.",
  "Tudo fica versionado no Git, então qualquer erro é revertido na hora.",
];

export default function Contribuir() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Fila de moderação</p>
      <h1 className="mt-2 text-5xl font-semibold">Contribuir</h1>
      <ul className="mt-6 list-disc space-y-1 pl-5 text-lg text-ink-soft">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <form className="mt-10 space-y-5 font-sans text-sm">
        <label className="block">
          Título
          <input disabled className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 disabled:opacity-60" />
        </label>
        <label className="block">
          Área
          <select disabled className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 disabled:opacity-60">
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Conteúdo (Markdown)
          <textarea disabled rows={10} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono disabled:opacity-60" />
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" disabled className="mt-1" />
          Declaro que o texto é meu ou de domínio público/licença aberta.
        </label>
        <button disabled className="bg-oxblood px-8 py-3 font-medium text-parchment disabled:opacity-50">
          Enviar para revisão
        </button>
        <p className="font-mono text-xs text-ink-soft">
          Envio em breve: depende do login (Supabase Auth) e da fila de moderação.
        </p>
      </form>
    </div>
  );
}
