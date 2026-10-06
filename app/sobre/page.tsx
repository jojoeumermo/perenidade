export const metadata = { title: "Sobre — Perenidade" };

export default function Sobre() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">Manifesto</p>
      <h1 className="mt-2 text-5xl font-semibold">Por que Perenidade</h1>
      <div className="mt-8 space-y-5 text-xl leading-relaxed">
        <p>
          A Biblioteca de Alexandria não caiu por um único fogo: caiu pelo descuido e pela falta de cópias. Perenidade
          nasce para o contrário: conhecimento livre, gratuito e copiado por todos.
        </p>
        <p>
          Aqui ninguém paga. O conteúdo vive em um repositório aberto, é revisado pela comunidade e cada mudança fica no
          histórico, como no Wayback Machine.
        </p>
        <p>
          Nossa revolução é legal e sólida: só domínio público, licenças abertas e textos da própria comunidade. Quando
          algo estiver errado, a denúncia coloca o item em quarentena na hora.
        </p>
      </div>
    </div>
  );
}
