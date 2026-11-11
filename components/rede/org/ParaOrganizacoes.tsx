// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A página "Traga sua organização" (prancha traga-sua-organizacao): sem estado e sem "use client", sai pronta do servidor (é pública
// e indexável). Cada peça leva a algum lugar: os botões do alto vão ao Entrar e ao Criar conta; "Pedir o selo" vai ao formulário
// (/alumia/organizacoes/selo); "Ver um perfil de exemplo" e cada ferramenta abrem o perfil de exemplo NA aba daquela ferramenta.
import type { CSSProperties } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { TextosDaOrg } from "@/lib/rede/textos-org";
import { Mosaico } from "../mosaico/Mosaico";
import { LinkBotao } from "../ui/Botao";
import { Carimbo } from "../ui/Carimbo";
import { Faixa } from "../ui/Faixa";
import { Lampiao } from "../ui/Lampiao";
import { DiretorioDasOrganizacoes, MapaDosLampioes } from "./b1/Diretorio";
import { BotoesDoSiteDaOrg } from "./BotoesDoSite";
import { BarrasDaConsulta, CartaoAoVivo, ListaDeNucleos } from "./partes";
import "./org.css";

/** Os endereços da F4 num lugar só. */
export const enderecosDaOrg = {
  pagina: (lang: string) => `/${lang}/alumia/organizacoes`,
  selo: (lang: string) => `/${lang}/alumia/organizacoes/selo`,
  exemplo: (lang: string, aba?: string) => `/${lang}/alumia/organizacoes/exemplo${aba ? `?aba=${aba}` : ""}`,
  entrar: (lang: string, criar = false) => `${localePath(lang, "/entrar")}?${criar ? "criar&" : ""}volta=/alumia/organizacoes`,
};

/** A cor do traço de cada passo de "Como entrar" (prancha: vermelho, dourado, papel). */
const COR_DO_PASSO = ["var(--al-vermelho)", "var(--al-dourado)", "var(--al-texto)"];

/**
 * `naCasca`: aberta por quem tem sessão, dentro da casca da Alumia (components/rede/org/CascaSeLogado.tsx). Aí a casca já tem a
 * marca, a faixa, o menu e a conta: some o alto da página com Entrar e Criar conta (quem está logado não precisa deles).
 */
export function ConteudoParaOrganizacoes({ t, lang, naCasca = false }: { t: TextosDaOrg; lang: string; naCasca?: boolean }) {
  const p = t.pagina;
  const f = p.ferramentas;
  return (
    <div className="al-org-pagina" data-na-casca={naCasca ? "" : undefined}>
      {naCasca ? null : <Faixa />}
      <div className="al-org-miolo">
        {naCasca ? null : (
        <header className="al-org-topo">
          <Link href={`/${lang}/alumia`} className="al-org-marca" aria-label={t.marca.inicio}>
            <Lampiao tamanho={28} />
            <span>
              <span className="al-cond al-org-marca-nome">{t.marca.alumia}</span>
              <span className="al-marca-instituto al-org-marca-instituto">{t.marca.instituto}</span>
            </span>
          </Link>
          <nav className="al-org-topo-acoes" aria-label={p.titulo}>
            <LinkBotao href={enderecosDaOrg.entrar(lang)} variante="contorno" tamanho="p">
              {p.entrar}
            </LinkBotao>
            <LinkBotao href={enderecosDaOrg.entrar(lang, true)} variante="primario" tamanho="p">
              {p.criarConta}
            </LinkBotao>
            <BotoesDoSiteDaOrg t={t} />
          </nav>
        </header>
        )}

        <section className="al-org-heroi" aria-labelledby="al-org-chamada">
          <div>
            <h1 id="al-org-chamada" className="al-cond al-org-chamada">
              {p.chamada}
            </h1>
            <p className="al-org-lead">{p.lead}</p>
            <div className="al-org-heroi-acoes">
              <LinkBotao href={enderecosDaOrg.selo(lang)} variante="primario" tamanho="g">
                {p.pedirSelo}
              </LinkBotao>
              <LinkBotao href={enderecosDaOrg.exemplo(lang)} variante="contorno" tamanho="g">
                {p.verExemplo}
              </LinkBotao>
            </div>
            <p className="al-org-para">{p.para}</p>
          </div>
          <div className="al-org-heroi-mosaico">
            <figure>
              <Mosaico palavra={p.mosaicoPalavra} semente="traga-sua-organizacao" proporcao={0.9} voce sementeLocal="exemplo" rotulo={p.mosaicoRotulo} />
              <figcaption>{p.mosaicoLegenda}</figcaption>
            </figure>
          </div>
        </section>
      </div>

      <section className="al-org-papel" aria-labelledby="al-org-porque">
        <div className="al-org-miolo">
          <h2 id="al-org-porque" className="al-cond">
            {p.porQue.titulo}
          </h2>
          <table className="al-org-tabela">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{p.porQue.tema}</span>
                </th>
                <th scope="col">{p.porQue.noX}</th>
                <th scope="col" className="al-org-na-alumia">
                  {p.porQue.naAlumia}
                </th>
              </tr>
            </thead>
            <tbody>
              {p.porQue.linhas.map((l) => (
                <tr key={l.tema}>
                  <th scope="row" className="al-cond">
                    {l.tema}
                  </th>
                  <td className="al-org-x" data-rotulo={p.porQue.noX}>
                    {l.x}
                  </td>
                  <td className="al-org-alumia" data-rotulo={p.porQue.naAlumia}>
                    {l.alumia}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="al-org-miolo">
        <section className="al-org-ferramentas" aria-labelledby="al-org-ferramentas">
          <h2 id="al-org-ferramentas" className="al-cond">
            {f.titulo}
          </h2>

          <article className="al-org-ferramenta">
            <div className="al-org-ferramenta-texto">
              <h3>{f.atos.titulo}</h3>
              <p>{f.atos.texto}</p>
              <Link href={enderecosDaOrg.exemplo(lang, "atos")} className="al-org-ferramenta-ver">
                {f.verNoExemplo} →
              </Link>
            </div>
            <div className="al-org-carimbos">
              <Carimbo situacao="confirmado" texto={f.atos.carimbos.confirmado} tamanho="g" />
              <Carimbo situacao="adiado" texto={f.atos.carimbos.adiado} tamanho="g" />
              <Carimbo situacao="cancelado" texto={f.atos.carimbos.cancelado} tamanho="g" />
            </div>
          </article>

          <article className="al-org-ferramenta al-org-invertida">
            <div className="al-org-ferramenta-texto">
              <h3>{f.consulta.titulo}</h3>
              <p>{f.consulta.texto}</p>
              <Link href={enderecosDaOrg.exemplo(lang, "consultas")} className="al-org-ferramenta-ver">
                {f.verNoExemplo} →
              </Link>
            </div>
            <BarrasDaConsulta
              rotulo={f.consulta.rotulo}
              barra={t.consulta.barra}
              opcoes={f.consulta.opcoes.map((o, i) => ({ id: String(i), texto: o.texto, proporcao: o.p / 100 }))}
            />
          </article>

          <article className="al-org-ferramenta">
            <div className="al-org-ferramenta-texto">
              <h3>{f.plenaria.titulo}</h3>
              <p>{f.plenaria.texto}</p>
              <Link href={enderecosDaOrg.exemplo(lang, "plenarias")} className="al-org-ferramenta-ver">
                {f.verNoExemplo} →
              </Link>
            </div>
            <CartaoAoVivo
              t={t}
              lang={lang}
              contagem="fila"
              plenaria={{ titulo: "", descricao: "", naSala: null, naFila: f.plenaria.naFila }}
              extra={
                <ul className="al-org-aovivo-fila" aria-label={f.plenaria.rotulo}>
                  {f.plenaria.perguntas.map((q) => (
                    <li key={q.handle}>
                      <b>@{q.handle}</b> {q.texto}
                    </li>
                  ))}
                </ul>
              }
            />
          </article>

          <article className="al-org-ferramenta al-org-invertida">
            <div className="al-org-ferramenta-texto">
              <h3>{f.nucleos.titulo}</h3>
              <p>{f.nucleos.texto}</p>
              <Link href={enderecosDaOrg.exemplo(lang, "nucleos")} className="al-org-ferramenta-ver">
                {f.verNoExemplo} →
              </Link>
            </div>
            <ListaDeNucleos
              rotulo={f.nucleos.rotulo}
              nucleos={f.nucleos.lista.map((n) => ({ id: n.nome, nome: n.nome, cor: n.cor as 1 | 2 | 3 | 4 | 5, quando: n.quando, onde: null }))}
            />
          </article>
        </section>

        <section className="al-org-como" aria-labelledby="al-org-como">
          <h2 id="al-org-como" className="al-cond">
            {p.comoEntrar.titulo}
          </h2>
          <ol className="al-org-passos">
            {p.comoEntrar.passos.map((passo, i) => (
              <li key={passo.titulo} className="al-org-passo" style={{ "--al-cor-passo": COR_DO_PASSO[i] } as CSSProperties}>
                <span aria-hidden className="al-cond al-org-passo-n">
                  {i + 1}
                </span>
                <h3>
                  {i === 0 ? (
                    <Link href={enderecosDaOrg.entrar(lang, true)}>{passo.titulo}</Link>
                  ) : i === 1 ? (
                    <Link href={enderecosDaOrg.selo(lang)}>{passo.titulo}</Link>
                  ) : (
                    passo.titulo
                  )}
                </h3>
                <p>{passo.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="al-org-regra" aria-label={t.selo.texto}>
          <p>{p.regra}</p>
          <LinkBotao href={enderecosDaOrg.selo(lang)} variante="primario">
            {p.pedirOSelo}
          </LinkBotao>
        </aside>

        {/* B1: o diretório das organizações com selo e o mapa dos lampiões (leem o banco no navegador). */}
        <DiretorioDasOrganizacoes lang={lang} tipos={t.tipos} />
        <MapaDosLampioes lang={lang} aoAcender={enderecosDaOrg.selo(lang)} />
      </div>
    </div>
  );
}
