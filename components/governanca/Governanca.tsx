// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As partes das páginas de governança que vêm de arquivos de conteúdo editados à mão: as tarefas de voluntariado, a
// lista de quem contribuiu e o guia de direitos. Nada é coletado aqui: as tarefas levam ao formulário de candidatura.
import contribuidores from "@/content/contribuidores.json";
import direitos from "@/content/direitos.json";
import voluntariado from "@/content/voluntariado.json";

const externo = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;

export function TarefasDeVoluntariado() {
  return (
    <section id="tarefas" aria-labelledby="tarefas-titulo" className="mt-12 scroll-mt-28">
      <h2 id="tarefas-titulo" className="tarja tarja-v">
        <span className="tarja-nome">★ Tarefas rápidas, no seu tempo</span>
      </h2>
      <p className="mt-3 max-w-2xl font-sans text-sm text-ink-soft">Escolha uma tarefa e clique em “Quero fazer esta”: o formulário logo abaixo já vem com ela escrita. A coordenação responde no seu e-mail.</p>
    <ul className="mt-6 grid gap-6 sm:grid-cols-2">
      {voluntariado.tarefas.map((t) => (
        <li key={t.id} className="cartao flex flex-col p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-oxblood">{t.area} · {t.tempo}</p>
          <h2 className="mt-1 text-2xl font-semibold">{t.titulo}</h2>
          <p className="mt-2">{t.descricao}</p>
          <dl className="mt-3 space-y-1 font-sans text-sm">
            <div><dt className="inline font-semibold">Como começar: </dt><dd className="inline">{t.comecar}</dd></div>
            <div><dt className="inline font-semibold">Como entregar: </dt><dd className="inline">{t.entrega}</dd></div>
          </dl>
          <a href={`?tarefa=${t.id}#candidatura`} className="botao botao-tinta botao-menor mt-4 self-start">
            Quero fazer esta →
          </a>
        </li>
      ))}
    </ul>
    </section>
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

// Os serviços agrupados pelo que a pessoa precisa. Serviço novo no JSON sem grupo aqui cai em "Outros serviços".
const GRUPOS_DE_DIREITOS: { id: string; nome: string; texto: string; servicos: string[] }[] = [
  { id: "saude", nome: "Saúde", texto: "Atendimento de graça e apoio emocional.", servicos: ["sus", "cvv"] },
  { id: "assistencia", nome: "Assistência social e benefícios", texto: "A porta de entrada costuma ser o CRAS do bairro, onde se faz o Cadastro Único.", servicos: ["cras", "cadunico", "bolsa-familia", "bpc", "tarifa-social"] },
  { id: "trabalho", nome: "Trabalho e aposentadoria", texto: "Para quem perdeu o emprego, adoeceu ou vai se aposentar.", servicos: ["seguro-desemprego", "inss"] },
  { id: "justica", nome: "Justiça e denúncia", texto: "Advogado de graça e onde denunciar violência e violação de direitos.", servicos: ["defensoria", "denuncia"] },
];

/**
 * O guia de direitos: os números de emergência como teclas de telefone (tocar liga, no celular) e os serviços agrupados
 * pelo que a pessoa precisa, cada um com o que é, quem pode procurar e onde ir à vista; documentos, regras e a fonte
 * oficial abrem no cartão. Os endereços #sus, #cras... continuam valendo.
 */
export function GuiaDeDireitos() {
  const agrupados = new Set(GRUPOS_DE_DIREITOS.flatMap((g) => g.servicos));
  const grupos = [...GRUPOS_DE_DIREITOS, { id: "outros", nome: "Outros serviços", texto: "", servicos: direitos.servicos.map((d) => d.id).filter((id) => !agrupados.has(id)) }]
    .map((g) => ({ ...g, itens: g.servicos.map((id) => direitos.servicos.find((d) => d.id === id)).filter((d) => d !== undefined) }))
    .filter((g) => g.itens.length > 0);
  return (
    <div className="mt-8">
      <section aria-labelledby="emergencia" className="border-4 border-[#c21f16] bg-parchment-deep p-5 sm:p-6">
        <h2 id="emergencia" className="font-serif text-2xl font-semibold">Emergência e apoio imediato</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">Ligações de graça, de qualquer telefone, 24 horas. No celular, toque no número para ligar.</p>
        <ul className="mt-4 grid gap-3 font-sans sm:grid-cols-2 lg:grid-cols-3">
          {direitos.emergencia.map((e) => (
            <li key={e.numero}>
              <a href={`tel:${e.numero}`} className="direito-tecla">
                <span className="direito-numero">{e.numero}</span>
                <span className="min-w-0">
                  <strong className="block leading-tight">{e.nome}</strong>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{e.quando}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <nav aria-label="Assuntos do guia" className="no-print mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-y-2 border-ink py-3 font-sans text-sm">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">Assuntos</span>
        {grupos.map((g) => (
          <a key={g.id} href={`#grupo-${g.id}`} className="font-semibold underline decoration-rule underline-offset-4 hover:decoration-[#c21f16]">
            {g.nome}
          </a>
        ))}
      </nav>
      {grupos.map((g) => (
        <section key={g.id} id={`grupo-${g.id}`} aria-labelledby={`grupo-${g.id}-titulo`} className="mt-10 scroll-mt-24">
          <h2 id={`grupo-${g.id}-titulo`} className="border-b-[3px] border-double border-ink pb-2 font-serif text-[1.7rem] font-semibold leading-tight">{g.nome}</h2>
          {g.texto && <p className="mt-2 font-sans text-sm text-ink-soft">{g.texto}</p>}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {g.itens.map((d) => (
              <article key={d.id} id={d.id} className="cartao flex scroll-mt-24 flex-col p-5 sm:p-6">
                <h3 className="font-serif text-[1.45rem] font-semibold leading-tight">{d.titulo}</h3>
                <p className="mt-2 font-sans leading-relaxed">{d.o_que}</p>
                <dl className="mt-4 grid gap-3 font-sans text-sm leading-relaxed">
                  <div>
                    <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-gold">Quem pode procurar</dt>
                    <dd className="mt-0.5">{d.quem}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-gold">Onde ir</dt>
                    <dd className="mt-0.5">{d.onde}</dd>
                  </div>
                </dl>
                <details className="checagem-completa mt-auto border-t-2 border-ink pt-4 [&:not([open])]:mt-5">
                  <summary className="checagem-abrir">Documentos, regras e fonte oficial</summary>
                  <dl className="mt-4 grid gap-3 font-sans text-sm leading-relaxed">
                    <div>
                      <dt className="font-semibold">Documentos que costumam pedir</dt>
                      <dd>{d.documentos}</dd>
                    </div>
                    {d.depende && (
                      <div>
                        <dt className="font-semibold">Do que depende</dt>
                        <dd>{d.depende}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-semibold">Fonte oficial</dt>
                      <dd>
                        <ul className="list-disc pl-5">
                          {d.fontes.map((f) => (
                            <li key={f.url}>
                              <a href={f.url} {...externo} className="underline hover:text-oxblood">{f.nome}</a> <span className="text-xs text-ink-soft">(site de terceiros)</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </details>
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="mt-8 font-sans text-sm text-ink-soft">Links conferidos em {dataBr(direitos.conferido_em)}. Achou um link quebrado ou uma informação desatualizada? <a href="mailto:institutolucia@tutamail.com?subject=Guia%20de%20direitos" className="underline">Avise</a>.</p>
    </div>
  );
}
