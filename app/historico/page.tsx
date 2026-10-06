import { PageHeading } from "@/components/PageHeading";
import { getHistory } from "@/lib/history";
import { github } from "@/lib/site";
import { formatDate } from "@/lib/text";

export const metadata = {
  title: "Histórico do acervo",
  description: "Todas as mudanças feitas no acervo, da mais recente à mais antiga.",
};

function describe(file: string): string {
  const name = file.split("/").pop() ?? file;
  if (file.startsWith("content/acervo/")) return `obra: ${name.replace(/\.md$/, "")}`;
  if (name === "_trilha.md") return `trilha: ${file.split("/")[2]}`;
  return `aula: ${file.split("/")[2]}/${name.replace(/^\d+-|\.md$/g, "")}`;
}

export default function Historico() {
  const changes = getHistory();
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow="Nada se perde" title="Histórico do acervo">
        Cada mudança no conteúdo fica registrada com data e autor, e qualquer versão anterior pode ser recuperada.
      </PageHeading>

      {changes.length === 0 ? (
        <p className="mt-10 text-lg text-ink-soft">
          O histórico não está disponível nesta cópia do site.{" "}
          <a href={github.history("content")} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
            Veja o histórico completo no GitHub ↗
          </a>
        </p>
      ) : (
        <ol className="mt-10 border-l-2 border-gold">
          {changes.map((change) => (
            <li key={change.hash} className="relative pb-8 pl-6">
              <span aria-hidden className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-gold" />
              <p className="font-mono text-xs text-gold">
                {formatDate(change.date)} · {change.author}
              </p>
              <p className="mt-1 text-xl">
                <a href={github.commit(change.hash)} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood">
                  {change.subject}
                </a>
              </p>
              <p className="mt-1 font-mono text-xs text-ink-soft">
                {change.files.slice(0, 4).map(describe).join(" · ")}
                {change.files.length > 4 && ` · e mais ${change.files.length - 4}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
