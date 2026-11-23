// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As partes das páginas públicas de transparência que vêm dos dados (lib/transparencia.ts): o texto de cada página está em
// content/paginas/transparencia*.md e entra pelo ContentPageView; isto vem embaixo dele. Componentes de servidor, sem script.
import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/i18n/config";
import { type Canario, canarioVencido, prazoEmPortugues, type Inventario, type Pedidos, type RelatorioDeAuditoria, type RelatorioTrimestral } from "@/lib/transparencia";

const caixa = "mt-10 border-l-4 border-gold bg-parchment-deep px-4 py-4 font-sans text-sm leading-relaxed";
const titulo = "font-sans text-lg font-semibold";
const tabela = "w-full min-w-[36rem] border-collapse text-left font-sans text-sm";
const celula = "border-b border-rule px-2 py-2 align-top";

function dataLonga(lang: Locale, iso: string) {
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
}

/** Nada publicado ainda: dito com todas as letras, sem número inventado. */
function Vazio({ children }: { children: React.ReactNode }) {
  return <p className={caixa}>{children}</p>;
}

export function ListaDeRelatorios({ lang, relatorios }: { lang: Locale; relatorios: RelatorioDeAuditoria[] }) {
  if (!relatorios.length) return <Vazio>Nenhuma auditoria externa foi feita ainda. O pacote para a primeira está pronto; quando ela acontecer, o relatório entra aqui inteiro, com os achados e a resposta.</Vazio>;
  return (
    <section className="mt-10" aria-labelledby="relatorios-lista">
      <h2 id="relatorios-lista" className={titulo}>Os relatórios</h2>
      <ul className="mt-4 space-y-6">
        {relatorios.map((r) => (
          <li key={r.arquivo} className="border-t border-rule pt-4 font-sans text-sm">
            <p className="text-ink-soft">{dataLonga(lang, r.data)} · {r.quem}</p>
            <p className="mt-1 text-base font-semibold">
              <a href={r.arquivo} className="underline hover:text-oxblood">{r.titulo}</a>
            </p>
            <p className="mt-1">{r.escopo}</p>
            <p className="mt-2">
              Achados: {r.achados.criticos} crítico(s), {r.achados.altos} alto(s), {r.achados.medios} médio(s), {r.achados.baixos} baixo(s).
            </p>
            <p className="mt-1 break-all text-ink-soft">
              SHA-256: <code>{r.sha256}</code>
            </p>
            {r.resposta && <p className="mt-2">{r.resposta}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ListaDePedidos({ lang, dados }: { lang: Locale; dados: Pedidos }) {
  const { pedidos } = dados;
  return (
    <section className="mt-10" aria-labelledby="pedidos-lista">
      <h2 id="pedidos-lista" className={titulo}>Os pedidos</h2>
      {dados.atualizado ? (
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Lista atualizada em {dataLonga(lang, dados.atualizado)}{dados.desde ? `, com os pedidos recebidos desde ${dataLonga(lang, dados.desde)}` : ""}.
        </p>
      ) : (
        <p className={caixa}>A primeira atualização desta lista sai com o primeiro relatório trimestral. Até lá, nenhum pedido foi publicado aqui.</p>
      )}
      {dados.atualizado && !pedidos.length && <p className="mt-4 font-sans text-sm">Nenhum pedido recebido no período.</p>}
      {pedidos.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className={tabela}>
            <caption className="sr-only">Pedidos de órgãos públicos e o que foi entregue</caption>
            <thead>
              <tr>
                <th scope="col" className={celula}>Recebido</th>
                <th scope="col" className={celula}>Tipo e órgão</th>
                <th scope="col" className={celula}>O que pediram</th>
                <th scope="col" className={celula}>O que entregamos</th>
                <th scope="col" className={celula}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p, i) => (
                <tr key={`${p.recebido}-${i}`}>
                  <td className={celula}>{dataLonga(lang, p.recebido)}</td>
                  <td className={celula}>{p.tipo} · {p.orgao}</td>
                  <td className={celula}>{p.pediu}</td>
                  <td className={celula}>{p.entregamos}</td>
                  <td className={celula}>{p.situacao}{p.contestamos ? " (contestado)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Trimestrais({ lang, relatorios }: { lang: Locale; relatorios: RelatorioTrimestral[] }) {
  if (!relatorios.length) return <Vazio>O primeiro relatório trimestral ainda não foi publicado.</Vazio>;
  return (
    <div className="mt-10 space-y-12">
      {relatorios.map((r) => (
        <section key={r.trimestre} id={r.trimestre} aria-labelledby={`t-${r.trimestre}`} className="border-t border-rule pt-6">
          <h2 id={`t-${r.trimestre}`} className={titulo}>
            {r.trimestre.replace("-T", ", ")}º trimestre
          </h2>
          <p className="mt-1 font-sans text-sm text-ink-soft">
            {r.periodo} · publicado em {dataLonga(lang, r.publicado)}
          </p>
          <div className="mt-4">
            <Markdown lang={lang}>{r.corpo}</Markdown>
          </div>
        </section>
      ))}
    </div>
  );
}

export function CanarioAtual({ lang, c }: { lang: Locale; c: Canario }) {
  if (c.situacao === "aguardando") {
    return (
      <section className="mt-10" aria-labelledby="canario-atual">
        <h2 id="canario-atual" className={titulo}>O canário</h2>
        <p className={caixa}>
          O primeiro canário ainda não foi publicado: ele sai quando a coordenação confirmar o texto abaixo e o fluxo de assinatura do repositório estiver ligado. Até lá, este é só o texto que será assinado, sem data e sem valor de canário.
        </p>
        <div className="mt-6 opacity-80">
          <Markdown lang={lang}>{c.texto}</Markdown>
        </div>
      </section>
    );
  }
  const vencido = canarioVencido(c);
  return (
    <section className="mt-10" aria-labelledby="canario-atual">
      <h2 id="canario-atual" className={titulo}>O canário de {dataLonga(lang, c.emitido!)}</h2>
      {vencido && (
        <p className={`${caixa} border-oxblood`} role="status">
          Este canário venceu em {dataLonga(lang, c.validoAte!)} e não foi renovado. Leia o texto abaixo como um aviso.
        </p>
      )}
      <div className="mt-6">
        <Markdown lang={lang}>{c.texto}</Markdown>
      </div>
    </section>
  );
}

const NOMES_DAS_AREAS: Record<string, string> = {
  alumia: "Alumia (a rede social e o chat)",
  painel: "Painel da equipe",
  escola: "Escola e estudo",
  "jornal e conteúdo": "Jornal, acervo e conteúdo",
  "site e equipe": "O site e a equipe",
};

export function ListaDoQueGuardamos({ dados }: { dados: Inventario }) {
  const areas = [...new Set(dados.tabelas.map((t) => t.area))];
  return (
    <>
      <section className="mt-10" aria-labelledby="guardamos-resumo">
        <h2 id="guardamos-resumo" className={titulo}>Em números</h2>
        <p className="mt-2 font-sans text-sm">
          {dados.total.tabelas} tabelas e {dados.total.colunas} colunas no banco do Instituto{dados.versao_do_banco ? ` (versão ${dados.versao_do_banco} do banco)` : ""}.{" "}
          {dados.total.com_conta} delas guardam o número de uma conta; as outras não ligam o que guardam a uma pessoa.
        </p>
      </section>
      <section className="mt-10" aria-labelledby="guardamos-contas">
        <h2 id="guardamos-contas" className={titulo}>O serviço de contas</h2>
        <p className="mt-2 font-sans text-sm text-ink-soft">O login (e-mail, senha embaralhada e sessões) fica no serviço de contas do Supabase, no mesmo banco, fora do código do site. O que ele grava e o que o site faz com cada coisa:</p>
        <div className="mt-4 overflow-x-auto">
          <table className={tabela}>
            <caption className="sr-only">O que o serviço de contas guarda</caption>
            <thead>
              <tr>
                <th scope="col" className={celula}>Tabela</th>
                <th scope="col" className={celula}>Guarda</th>
                <th scope="col" className={celula}>Por quanto tempo</th>
                <th scope="col" className={celula}>Observação</th>
              </tr>
            </thead>
            <tbody>
              {dados.servico_de_contas.map((s) => (
                <tr key={s.tabela}>
                  <th scope="row" className={`${celula} font-mono text-xs`}>{s.tabela}</th>
                  <td className={celula}>{s.guarda}</td>
                  <td className={celula}>{s.prazo}</td>
                  <td className={celula}>{s.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-10" aria-labelledby="guardamos-tabelas">
        <h2 id="guardamos-tabelas" className={titulo}>Todas as tabelas, por área</h2>
        {areas.map((area) => {
          const lista = dados.tabelas.filter((t) => t.area === area);
          return (
            <details key={area} className="mt-4 border-t border-rule pt-3 font-sans text-sm">
              <summary className="cursor-pointer font-semibold">
                {NOMES_DAS_AREAS[area] ?? area} ({lista.length} tabelas)
              </summary>
              <ul className="mt-3 space-y-4">
                {lista.map((t) => (
                  <li key={t.tabela} className="break-words">
                    <p className="font-mono text-xs font-semibold">{t.tabela}</p>
                    {t.o_que_e && <p className="mt-1">{t.o_que_e}</p>}
                    <p className="mt-1 text-ink-soft">
                      <span className="font-semibold">Colunas:</span> {t.colunas.map(([c]) => c).join(", ")}
                    </p>
                    <p className="mt-1 text-ink-soft">
                      <span className="font-semibold">Aponta para uma conta:</span> {t.aponta_para_conta.length ? t.aponta_para_conta.join(", ") : "não"}
                      {t.apaga_sozinho.length > 0 && (
                        <>
                          {" · "}
                          <span className="font-semibold">Apaga sozinho:</span> {t.apaga_sozinho.map(prazoEmPortugues).join(", ")}
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </section>
    </>
  );
}
