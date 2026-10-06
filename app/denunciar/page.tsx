import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { ReportForm } from "@/components/ReportForm";

export const metadata = {
  title: "Denunciar conteúdo",
  description: "Avise sobre violação de direitos autorais, erros ou conteúdo impróprio no acervo.",
};

const stages = [
  ["Registro público", "A denúncia vira um registro aberto, com data, que qualquer pessoa pode acompanhar."],
  ["Quarentena", "Em denúncias de direitos autorais, a moderação tira o item do ar enquanto analisa."],
  ["Decisão", "Confirmado o problema, o item é removido ou corrigido. O histórico da decisão fica guardado."],
];

export default function Denunciar() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow="Direitos autorais e qualidade" title="Denunciar conteúdo">
        Respeitamos direitos autorais. Se algo aqui não deveria estar, avise e nós tiramos do ar para analisar.
      </PageHeading>

      <ol className="mt-10 grid gap-5 font-sans text-sm sm:grid-cols-3">
        {stages.map(([title, description], i) => (
          <li key={title} className="border-l-2 border-gold pl-4">
            <p className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-ink-soft">{description}</p>
          </li>
        ))}
      </ol>

      <Suspense>
        <ReportForm />
      </Suspense>

      <p className="mt-10 border-t border-rule pt-6 font-sans text-sm text-ink-soft">
        A denúncia é registrada no GitHub e fica pública, junto com o nome da sua conta. Não inclua dados pessoais no
        texto.
      </p>
    </div>
  );
}
