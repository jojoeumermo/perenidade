import Link from "next/link";
import { ContributeForm } from "@/components/ContributeForm";
import { PageHeading } from "@/components/PageHeading";
import { getTracks } from "@/lib/content";
import { github } from "@/lib/site";

export const metadata = {
  title: "Contribuir",
  description: "Escreva uma aula ou indique uma obra livre. Toda contribuição passa por revisão pública antes de entrar.",
};

const rules = [
  "Envie apenas texto (Markdown). Não aceitamos PDFs, imagens ou outros arquivos.",
  "Só conteúdo seu, de domínio público ou com licença aberta. Nada copiado de livros, sites ou cursos protegidos.",
  "Todo envio vira uma proposta pública. Ela só entra no acervo depois de revisada e aprovada.",
  "Tudo fica versionado no Git, então qualquer erro é desfeito na hora.",
];

const steps = [
  ["Escreva", "Preencha o formulário abaixo. O rascunho fica salvo no seu navegador."],
  ["Envie", "O botão abre o GitHub com o arquivo pronto. Você confirma e cria a proposta (Pull Request)."],
  ["Revisão", "A proposta aparece na fila de moderação, onde qualquer pessoa pode ver e comentar."],
  ["Publicação", "Aprovada, a aula entra no site na próxima atualização, com seu nome no histórico."],
];

export default function Contribuir() {
  const tracks = getTracks().map((track) => ({
    slug: track.slug,
    title: track.title,
    nextOrder: Math.max(0, ...track.lessons.map((l) => l.order)) + 1,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow="Construa a biblioteca" title="Contribuir">
        Você não precisa de permissão para ensinar. Escreva, envie e a comunidade revisa.
      </PageHeading>

      <ul className="mt-8 list-disc space-y-1 pl-5 text-lg text-ink-soft">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      <ol className="mt-10 grid gap-5 font-sans text-sm sm:grid-cols-2">
        {steps.map(([title, description], i) => (
          <li key={title} className="border-l-2 border-gold pl-4">
            <p className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-soft">{description}</p>
          </li>
        ))}
      </ol>

      <ContributeForm tracks={tracks} />

      <div className="mt-10 space-y-3 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        <p>
          O envio usa uma conta gratuita do GitHub, que é onde o acervo fica guardado. Ainda não há envio sem conta.
        </p>
        <p>
          Quer corrigir algo que já existe? Cada aula e cada obra tem um link “Sugerir correção”. Quer propor uma trilha
          nova ou um assunto que falta?{" "}
          <a
            href={github.newIssue("sugestao.yml", {})}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-oxblood"
          >
            Abra uma sugestão
          </a>
          . Veja também a <Link href="/moderacao" className="underline hover:text-oxblood">fila de moderação</Link>.
        </p>
      </div>
    </div>
  );
}
