import { ModerationQueue } from "@/components/ModerationQueue";
import { PageHeading } from "@/components/PageHeading";
import { github } from "@/lib/site";

export const metadata = {
  title: "Fila de moderação",
  description: "Contribuições e denúncias em análise, abertas para qualquer pessoa acompanhar.",
};

const facts = [
  ["Nada a roubar", "Este painel não tem login, senha nem dados de ninguém. Ele só mostra informações que já são públicas."],
  ["Nada a destruir", "Aprovar é aceitar uma mudança no histórico. Uma aprovação errada se desfaz com uma reversão, sem perda."],
  ["Quem aprova", "Só moderadores com permissão no repositório. Quem confere essa permissão é o GitHub, não este site."],
];

export default function Moderacao() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow="Curadoria às claras" title="Fila de moderação">
        Tudo o que a comunidade envia passa por aqui antes de entrar no acervo. A fila é pública de propósito.
      </PageHeading>

      <div className="mt-10 grid gap-5 font-sans text-sm sm:grid-cols-3">
        {facts.map(([title, description]) => (
          <div key={title} className="border-l-2 border-gold pl-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-soft">{description}</p>
          </div>
        ))}
      </div>

      <ModerationQueue />

      <p className="mt-12 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        É moderador? O passo a passo de revisão, quarentena e reversão está no{" "}
        <a
          href={github.file("docs/MODERACAO.md")}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-oxblood"
        >
          guia de moderação
        </a>
        .
      </p>
    </div>
  );
}
