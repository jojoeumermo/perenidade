// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As partes das páginas de governança que vêm de arquivos de conteúdo editados à mão: as tarefas de voluntariado, a
// lista de quem contribuiu e o guia de direitos. Nada é coletado: o contato é só por e-mail (mailto).
import contribuidores from "@/content/contribuidores.json";
import direitos from "@/content/direitos.json";
import voluntariado from "@/content/voluntariado.json";
import { site } from "@/lib/site";

const mailto = (assunto: string, corpo: string) => `mailto:${site.newsletter}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
const externo = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;

export function TarefasDeVoluntariado() {
  return (
    <ul className="mt-8 grid gap-5 sm:grid-cols-2">
      {voluntariado.tarefas.map((t) => (
        <li key={t.id} className="flex flex-col border-[3px] border-ink bg-parchment-deep p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-oxblood">{t.area} · {t.tempo}</p>
          <h2 className="mt-1 text-2xl font-semibold">{t.titulo}</h2>
          <p className="mt-2">{t.descricao}</p>
          <dl className="mt-3 space-y-1 font-sans text-sm">
            <div><dt className="inline font-semibold">Como começar: </dt><dd className="inline">{t.comecar}</dd></div>
            <div><dt className="inline font-semibold">Como entregar: </dt><dd className="inline">{t.entrega}</dd></div>
          </dl>
          <a
            href={mailto(`Quero ajudar: ${t.titulo}`, `Olá! Quero ajudar com "${t.titulo}".\n\nO que sei fazer:\n\nQuanto tempo tenho por semana:\n\nComo prefiro ser creditado (nome, apelido ou anônimo):\n`)}
            className="mt-4 inline-block self-start border-2 border-ink bg-ink px-4 py-2 font-sans font-semibold text-parchment hover:bg-oxblood"
          >
            Quero fazer esta →
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ListaDeContribuidores() {
  const pessoas = contribuidores.pessoas as { credito: string; como?: string }[];
  if (pessoas.length === 0) return <p className="mt-8 border-2 border-dashed border-rule p-8 text-center font-sans text-ink-soft">A lista começa com o primeiro pedido.</p>;
  return (
    <ul className="mt-8 columns-1 gap-8 sm:columns-2 lg:columns-3">
      {pessoas.map((p, i) => (
        <li key={i} className="mb-2 break-inside-avoid">
          <strong>{p.credito}</strong>{p.como ? <span className="text-ink-soft"> · {p.como}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export function GuiaDeDireitos() {
  return (
    <div className="mt-8">
      <section aria-labelledby="emergencia" className="border-4 border-[#c21f16] bg-parchment-deep p-5">
        <h2 id="emergencia" className="text-2xl font-semibold">Emergência e apoio imediato</h2>
        <ul className="mt-3 grid gap-3 font-sans sm:grid-cols-2 lg:grid-cols-3">
          {direitos.emergencia.map((e) => (
            <li key={e.numero} className="flex items-start gap-3">
              <a href={`tel:${e.numero}`} className="min-w-16 border-2 border-ink bg-ink px-2 py-1 text-center font-mono text-2xl font-bold text-parchment">{e.numero}</a>
              <span><strong>{e.nome}</strong><br /><span className="text-sm text-ink-soft">{e.quando}</span></span>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-8 space-y-4">
        {direitos.servicos.map((s) => (
          <details key={s.id} id={s.id} className="group border-[3px] border-ink bg-parchment-deep">
            <summary className="cursor-pointer list-none p-4 text-xl font-semibold group-open:border-b-2 group-open:border-ink">
              <span className="mr-2 text-oxblood group-open:hidden">+</span><span className="mr-2 hidden text-oxblood group-open:inline">−</span>{s.titulo}
            </summary>
            <dl className="space-y-3 p-4 font-sans">
              <div><dt className="font-semibold">O que é</dt><dd>{s.o_que}</dd></div>
              <div><dt className="font-semibold">Quem pode procurar</dt><dd>{s.quem}</dd></div>
              <div><dt className="font-semibold">Onde ir</dt><dd>{s.onde}</dd></div>
              <div><dt className="font-semibold">Documentos que costumam pedir</dt><dd>{s.documentos}</dd></div>
              {s.depende && <div><dt className="font-semibold">Do que depende</dt><dd>{s.depende}</dd></div>}
              <div>
                <dt className="font-semibold">Fonte oficial</dt>
                <dd>
                  <ul className="list-disc pl-5">
                    {s.fontes.map((f) => <li key={f.url}><a href={f.url} {...externo} className="underline hover:text-oxblood">{f.nome}</a> <span className="text-xs text-ink-soft">(site de terceiros)</span></li>)}
                  </ul>
                </dd>
              </div>
            </dl>
          </details>
        ))}
      </div>
      <p className="mt-6 font-sans text-sm text-ink-soft">Links conferidos em {dataBr(direitos.conferido_em)}. Achou um link quebrado ou uma informação desatualizada? <a href="mailto:institutolucia@tutamail.com?subject=Guia%20de%20direitos" className="underline">Avise</a>.</p>
    </div>
  );
}
