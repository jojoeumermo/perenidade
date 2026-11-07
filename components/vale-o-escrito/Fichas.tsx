// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import "@/styles/vale-o-escrito.css";
import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import type { Entrada, Organizacao, PessoaPublica, RefDeNo, Situacao } from "@/lib/vale-o-escrito/tipos";
import {
  casosDaOrganizacao,
  casosDaPessoa,
  codigoDeArquivo,
  condenacaoDefinitiva,
  formatarData,
  fontesNumeradas,
  listaComE,
  veiculosDaEntrada,
  acharOrganizacao,
  acharPessoa,
  acharDossie,
  acharEntrada,
  confiancaDaLigacao,
  dominioDe,
  type DadosDoObservatorio,
} from "@/lib/vale-o-escrito/visual";
import { formatarReais, valoresDaPonta, valoresOrdenados, type ValorDoCaso } from "@/lib/vale-o-escrito/valores";
import { CartaoDeArquivo } from "./CartaoDeArquivo";

// As fichas do observatório (painel da direita) e das páginas próprias (caso, pessoa, organização). Sem estado: servem
// ao servidor e ao cliente. Regras que as fichas cumprem (ESPEC, seção 1): a situação jurídica sempre escrita e visível;
// "segundo [fonte]" no resumo e na linha de autoria; fontes numeradas com trecho, data, link e cópia arquivada;
// "Atualizado em"; e os dois pedidos (correção e direito de resposta) em toda ficha.

type S = TextosDoObservatorio;

const rotuloSituacao = (s: S, situacao: Situacao) => s.situacao[situacao];

/** O caminho do formulário de correção (pacote "publico"): /vale-o-escrito/correcao/<id> (a ficha já vem preenchida); ?tipo= diz qual dos dois pedidos. */
export const caminhoDaCorrecao = (lang: string, casoId: string, tipo?: "direito_de_resposta" | "correcao") =>
  localePath(lang, `/vale-o-escrito/correcao/${encodeURIComponent(casoId)}${tipo ? `?tipo=${tipo}` : ""}`);

export function SituacaoJuridica({ s, lang, situacao, atualizadoEm }: { s: S; lang: string; situacao: Situacao; atualizadoEm?: string }) {
  return (
    <>
      {/* A faixa fica fixa no alto da ficha: a situação jurídica nunca sai da tela. */}
      <div className="ve-situacao" data-situacao={situacao} role="group" aria-label={s.ficha.situacao}>
        <span className="ve-rotulo">{s.ficha.situacao}</span>
        <strong>{rotuloSituacao(s, situacao)}</strong>
        {atualizadoEm && (
          <span className="ve-rotulo">
            {s.ficha.atualizadoEm}: {formatarData(atualizadoEm, lang)}
          </span>
        )}
      </div>
      <small className="ve-aviso-fixo">{condenacaoDefinitiva(situacao) ? s.avisos.segundoFonte : s.visual.ficha.aviso}</small>
    </>
  );
}

export function FontesDaFicha({ entrada, s, lang }: { entrada: Entrada; s: S; lang: string }) {
  return (
    <ol className="ve-fontes" aria-label={s.ficha.fontes}>
      {fontesNumeradas(entrada).map(({ n, fonte }) => (
        <li key={fonte.id} id={`fonte-${n}`} className="ve-fonte">
          <span className="ve-fonte-n" aria-hidden="true">
            {n}
          </span>
          <div>
            {/* "FONTE 01 · stf.jus.br": de onde vem, antes de abrir (decorativo; o leitor de tela ouve o número e o veículo). */}
            <span className="ve-fonte-dominio" aria-hidden="true">
              {s.visual.ficha.fonte} {String(n).padStart(2, "0")}
              {dominioDe(fonte.url) ? ` · ${dominioDe(fonte.url)}` : ""}
            </span>
            <div className="ve-fonte-titulo">
              <span className="ve-so-leitor">{fill(s.visual.ficha.numeroFonte, { n })}: </span>
              {fonte.veiculo}: {fonte.titulo}
            </div>
            <blockquote>
              <span className="ve-so-leitor">{s.ficha.trecho}: </span>“{fonte.trecho}”
            </blockquote>
            <div className="ve-fonte-meta">
              <span>
                {s.ficha.dataDaFonte}: {formatarData(fonte.data, lang)}
              </span>
              <a href={fonte.url} target="_blank" rel="noopener noreferrer nofollow">
                {s.visual.ficha.abrirFonte} ↗
              </a>
              {fonte.arquivoUrl ? (
                <a href={fonte.arquivoUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {s.visual.ficha.abrirArquivo} ↗
                </a>
              ) : (
                <span>{s.ficha.semArquivo}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AcoesDaFicha({ entradaId, s, lang, abrirFicha }: { entradaId: string; s: S; lang: string; abrirFicha?: boolean }) {
  return (
    <div className="ve-acoes">
      <Link className="ve-botao" href={caminhoDaCorrecao(lang, entradaId, "correcao")}>
        {s.visual.ficha.pedirCorrecao}
      </Link>
      <Link className="ve-botao ve-botao--azul" href={caminhoDaCorrecao(lang, entradaId, "direito_de_resposta")}>
        {s.visual.ficha.direitoDeResposta}
      </Link>
      {abrirFicha && (
        <Link className="ve-botao ve-botao--azul" href={localePath(lang, `/vale-o-escrito/caso/${entradaId}`)}>
          {s.visual.ficha.abrirFicha}
        </Link>
      )}
    </div>
  );
}

/** Nome de uma pessoa ou organização: botão que escolhe o nó (no observatório) ou link para a página própria. */
function NomeDeAgente({
  tipo,
  id,
  nome,
  lang,
  aoEscolher,
}: {
  tipo: "pessoa" | "organizacao";
  id: string;
  nome: string;
  lang: string;
  aoEscolher?: (chave: string) => void;
}) {
  if (aoEscolher)
    return (
      <button type="button" className="ve-lista-no" onClick={() => aoEscolher(`${tipo}:${id}`)}>
        {nome}
      </button>
    );
  return <Link href={localePath(lang, `/vale-o-escrito/${tipo}/${id}`)}>{nome}</Link>;
}

/** A ficha de um caso. `indice` é a posição na lista (só para o código de arquivo, que não é um identificador). */
export function FichaDoCaso({
  entrada,
  dados,
  s,
  lang,
  indice,
  aoEscolher,
  comLinkParaFicha,
  nivelDoTitulo = 2,
}: {
  entrada: Entrada;
  dados: DadosDoObservatorio;
  s: S;
  lang: string;
  indice: number;
  aoEscolher?: (chave: string) => void;
  comLinkParaFicha?: boolean;
  nivelDoTitulo?: 1 | 2;
}) {
  const Titulo = nivelDoTitulo === 1 ? "h1" : "h2";
  const dossie = acharDossie(dados, entrada.dossie);
  const veiculos = veiculosDaEntrada(entrada);
  const pessoas: { pp: Entrada["pessoas"][number]; pessoa: PessoaPublica }[] = [];
  for (const pp of entrada.pessoas) {
    const pessoa = acharPessoa(dados, pp.pessoaId);
    if (pessoa) pessoas.push({ pp, pessoa });
  }
  const orgs = entrada.organizacoes.map((id) => acharOrganizacao(dados, id)).filter((o): o is Organizacao => Boolean(o));
  const comFoto = pessoas.find((x) => x.pessoa.foto);
  const lugar = [entrada.lugar.nome, entrada.lugar.regiao].filter(Boolean).join(", ") || entrada.lugar.pais;
  const confiancaRotulo = s.confianca[entrada.confianca];
  const eConfirmado = entrada.confianca === "primaria";

  return (
    <article className="ve-bloco" aria-label={entrada.titulo}>
      <SituacaoJuridica s={s} lang={lang} situacao={entrada.situacao} atualizadoEm={entrada.atualizadoEm} />
      <div>
        <span className="ve-codigo">
          {s.visual.ficha.codigo} {codigoDeArquivo(indice)}
        </span>
        {dossie && <span className="ve-rotulo"> · {dossie.titulo}</span>}
      </div>
      <Titulo className="ve-ficha-titulo">{entrada.titulo}</Titulo>
      <div>
        <span className="ve-selo" data-confianca={entrada.confianca} title={eConfirmado ? s.confianca.primariaExplica : s.confianca.reportadoExplica}>
          {confiancaRotulo}
        </span>
      </div>
      <CartaoDeArquivo
        codigo={codigoDeArquivo(indice)}
        titulo={comFoto ? comFoto.pessoa.nome : entrada.titulo}
        linhas={[`${s.ficha.dataDoFato}: ${formatarData(entrada.dataDoFato, lang)}`, lugar]}
        foto={comFoto?.pessoa.foto}
        legendaDaFoto={comFoto ? `${comFoto.pessoa.nome}: ${rotuloSituacao(s, comFoto.pp.situacao)}` : undefined}
        carimbo={rotuloSituacao(s, entrada.situacao)}
        textoSemFoto={s.visual.ficha.semFoto}
        rotuloCredito={s.ficha.fotoCredito}
        rotuloLicenca={s.visual.ficha.licenca}
      />
      <section className="ve-bloco" aria-label={s.visual.ficha.resumo}>
        <p className="ve-resumo">{entrada.resumo}</p>
        <p className="ve-aviso-fixo">{fill(s.visual.ficha.segundo, { veiculos: listaComE(veiculos) })}.</p>
      </section>
      <dl className="ve-dl">
        <dt>{s.ficha.dataDoFato}</dt>
        <dd>{formatarData(entrada.dataDoFato, lang)}</dd>
        <dt>{s.ficha.lugar}</dt>
        <dd>{lugar}</dd>
        <dt>{s.ficha.publicadoEm}</dt>
        <dd>{formatarData(entrada.publicadoEm, lang)}</dd>
        <dt>{s.ficha.atualizadoEm}</dt>
        <dd>{formatarData(entrada.atualizadoEm, lang)}</dd>
      </dl>
      {entrada.historico && entrada.historico.length > 0 && (
        <section className="ve-bloco" aria-label={s.ficha.historicoTitulo}>
          <h3 className="ve-rotulo">{s.ficha.historicoTitulo}</h3>
          <ul>
            {entrada.historico.map((m, k) => (
              <li key={`${m.em}-${k}`}>
                {formatarData(m.em, lang)}: {fill(s.ficha.mudouDePara, { de: rotuloSituacao(s, m.de), para: rotuloSituacao(s, m.para) })}
                {m.nota ? `. ${m.nota}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
      {entrada.respostas && entrada.respostas.length > 0 && (
        <section className="ve-bloco" aria-label={s.ficha.respostasTitulo}>
          <h3 className="ve-rotulo">{s.ficha.respostasTitulo}</h3>
          <ul>
            {entrada.respostas.map((r, k) => (
              <li key={`${r.em}-${k}`}>
                <span className="ve-rotulo">
                  {r.tipo === "direito_de_resposta" ? s.ficha.tipoResposta : s.ficha.tipoCorrecao} · {formatarData(r.em, lang)}
                </span>
                <p>{r.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pessoas.length > 0 && (
        <section className="ve-bloco" aria-label={s.ficha.pessoas}>
          <h3 className="ve-rotulo">{s.ficha.pessoas}</h3>
          <ul className="ve-pessoas">
            {pessoas.map(({ pp, pessoa }) => (
              <li key={pessoa.id}>
                <span>
                  <NomeDeAgente tipo="pessoa" id={pessoa.id} nome={pessoa.nome} lang={lang} aoEscolher={aoEscolher} />{" "}
                  <span className="ve-selo" data-situacao={pp.situacao}>
                    {rotuloSituacao(s, pp.situacao)}
                  </span>
                </span>
                {pp.papelNoCaso && <span className="ve-aviso-fixo">{pp.papelNoCaso}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {orgs.length > 0 && (
        <section className="ve-bloco" aria-label={s.ficha.organizacoes}>
          <h3 className="ve-rotulo">{s.ficha.organizacoes}</h3>
          <ul className="ve-pessoas">
            {orgs.map((o) => (
              <li key={o.id}>
                <NomeDeAgente tipo="organizacao" id={o.id} nome={o.nome} lang={lang} aoEscolher={aoEscolher} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <LigacoesDaFicha entrada={entrada} dados={dados} s={s} />
      <FluxosDeDinheiro itens={valoresOrdenados([entrada])} dados={dados} s={s} lang={lang} />
      <section className="ve-bloco" aria-label={s.ficha.fontes}>
        <h3 className="ve-rotulo">{s.ficha.fontes}</h3>
        <FontesDaFicha entrada={entrada} s={s} lang={lang} />
      </section>
      <AcoesDaFicha entradaId={entrada.id} s={s} lang={lang} abrirFicha={comLinkParaFicha} />
      <p className="ve-aviso-fixo">{s.visual.ficha.nuncaVitima}</p>
    </article>
  );
}

/** A ficha de uma pessoa pública ou de uma organização: quem é (com foto livre e crédito) e os casos, cada um com a situação. */
export function FichaDeAgente({
  tipo,
  agente,
  dados,
  s,
  lang,
  aoEscolherCaso,
  nivelDoTitulo = 2,
}: {
  tipo: "pessoa" | "organizacao";
  agente: PessoaPublica | Organizacao;
  dados: DadosDoObservatorio;
  s: S;
  lang: string;
  aoEscolherCaso?: (entradaId: string) => void;
  nivelDoTitulo?: 1 | 2;
}) {
  const Titulo = nivelDoTitulo === 1 ? "h1" : "h2";
  const casos =
    tipo === "pessoa"
      ? casosDaPessoa(dados, agente.id)
      : casosDaOrganizacao(dados, agente.id).map((entrada) => ({ entrada, situacao: entrada.situacao, papelNoCaso: undefined as string | undefined }));
  const pessoa = tipo === "pessoa" ? (agente as PessoaPublica) : null;
  return (
    <article className="ve-bloco" aria-label={agente.nome}>
      <div className="ve-situacao ve-situacao--solta" data-situacao={casos[0]?.situacao ?? "suspeito"} role="group" aria-label={pessoa ? s.ficha.situacao : s.visual.ficha.situacaoDoCaso}>
        {/* Organização: a situação mostrada é a do CASO, nunca a da organização; o rótulo diz de quem é. */}
        <span className="ve-rotulo">{pessoa ? s.ficha.situacao : s.visual.ficha.situacaoDoCaso}</span>
        {casos.length === 0 ? (
          <strong>{s.visual.lista.semLigacoes}</strong>
        ) : (
          <ul className="ve-pessoas">
            {casos.map(({ entrada, situacao }) => (
              <li key={entrada.id}>
                <strong>{rotuloSituacao(s, situacao)}</strong>
                <span className="ve-aviso-fixo">{entrada.titulo}</span>
              </li>
            ))}
          </ul>
        )}
        <small>{s.visual.ficha.aviso}</small>
      </div>
      <span className="ve-codigo">{s.visual.tipoNo[tipo]}</span>
      <Titulo className="ve-ficha-titulo">{agente.nome}</Titulo>
      <CartaoDeArquivo
        codigo={`${s.visual.tipoNo[tipo]}`}
        titulo={agente.nome}
        linhas={[pessoa?.cargo ?? "", pessoa ? `${s.visual.ficha.papel}: ${s.visual.papel[pessoa.papel] ?? pessoa.papel}` : (s.visual.tipoOrg[(agente as Organizacao).tipo] ?? (agente as Organizacao).tipo)].filter(Boolean)}
        foto={agente.foto}
        legendaDaFoto={agente.nome}
        textoSemFoto={s.visual.ficha.semFoto}
        rotuloCredito={s.ficha.fotoCredito}
        rotuloLicenca={s.visual.ficha.licenca}
      />
      <section className="ve-bloco" aria-label={s.visual.ficha.casos}>
        <h3 className="ve-rotulo">{s.visual.ficha.casos}</h3>
        <ul className="ve-lista-de-casos">
          {casos.map(({ entrada, situacao, papelNoCaso }) => (
            <li key={entrada.id}>
              <span>
                {aoEscolherCaso ? (
                  <button type="button" className="ve-lista-no" onClick={() => aoEscolherCaso(entrada.id)}>
                    {entrada.titulo}
                  </button>
                ) : (
                  <Link href={localePath(lang, `/vale-o-escrito/caso/${entrada.id}`)}>{entrada.titulo}</Link>
                )}{" "}
                <span className="ve-selo" data-situacao={situacao}>
                  {rotuloSituacao(s, situacao)}
                </span>
              </span>
              {papelNoCaso && <span className="ve-aviso-fixo">{papelNoCaso}</span>}
              <span className="ve-aviso-fixo">
                {fill(s.visual.ficha.segundo, { veiculos: listaComE(veiculosDaEntrada(entrada)) })}. {s.ficha.atualizadoEm}: {formatarData(entrada.atualizadoEm, lang)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <FluxosDeDinheiro itens={valoresDaPonta(dados.entradas, { tipo, id: agente.id })} dados={dados} s={s} lang={lang} comCaso />
      <p className="ve-aviso-fixo">{s.visual.ficha.nuncaVitima}</p>
    </article>
  );
}

/**
 * Os fluxos de dinheiro (T31 3.3): cada valor documentado com o tipo ("multa", "acordo", "emenda"...), a data, a linha
 * de resumo com "segundo [fonte]", quem responde (quando a fonte diz) e o número da fonte. Do maior para o menor.
 * Valor suposto ou estimado leva o aviso de que não é prova de crime. `comCaso`: na ficha de pessoa ou organização,
 * diz de qual caso é cada valor.
 */
export function FluxosDeDinheiro({ itens, dados, s, lang, comCaso }: { itens: ValorDoCaso[]; dados: DadosDoObservatorio; s: S; lang: string; comCaso?: boolean }) {
  if (itens.length === 0) return null;
  const maior = itens[0].valor.valor || 1;
  return (
    <section className="ve-bloco" aria-label={s.visual.dinheiro.naFicha}>
      <h3 className="ve-rotulo">{s.visual.dinheiro.naFicha}</h3>
      <ol className="ve-fluxos">
        {itens.map(({ entrada, valor, nFonte }) => (
          <li key={`${entrada.id}-${valor.id}`} data-tipo={valor.tipo}>
            <div className="ve-fluxo-topo">
              <strong className="ve-fluxo-valor">{formatarReais(valor.valor, lang)}</strong>
              <span className="ve-fluxo-tipo">{s.visual.dinheiro.tipos[valor.tipo]}</span>
              <span className="ve-rotulo">{formatarData(valor.data, lang)}</span>
            </div>
            <i className="ve-fluxo-barra" aria-hidden="true" style={{ width: `${Math.max(2, (valor.valor / maior) * 100)}%` }} />
            <span>
              {valor.resumo}
              {nFonte > 0 && (comCaso ? <> [{nFonte}]</> : <a href={`#fonte-${nFonte}`}> [{nFonte}]</a>)}
            </span>
            {valor.ponta && (
              <span className="ve-aviso-fixo">
                {s.visual.dinheiro.quem}: {nomeDaPonta(dados, valor.ponta)}
              </span>
            )}
            {comCaso && <span className="ve-aviso-fixo">{entrada.titulo}</span>}
            {(valor.tipo === "movimentacao_suposta" || valor.tipo === "estimativa_oficial" || valor.tipo === "emenda") && (
              <span className="ve-aviso-fixo">{s.visual.dinheiro.suposto}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Nome de uma ponta de ligação (pessoa, organização, caso ou lugar). */
function nomeDaPonta(dados: DadosDoObservatorio, r: RefDeNo): string {
  if (r.tipo === "pessoa") return acharPessoa(dados, r.id)?.nome ?? r.id;
  if (r.tipo === "organizacao") return acharOrganizacao(dados, r.id)?.nome ?? r.id;
  if (r.tipo === "entrada") return acharEntrada(dados, r.id)?.titulo ?? r.id;
  return r.id;
}

/**
 * As ligações com fonte do caso (as Ligacao do arquivo, não as implícitas): quem liga a quem, o tipo, o rótulo curto
 * (onde vão os valores, como "doou R$ 50 mil em 2022, segundo o TSE"), o ponto de confiança e as fontes numeradas.
 * Rótulos com valor em R$ vêm primeiro, do maior para o menor (lista ordenada por valor).
 */
export function LigacoesDaFicha({ entrada, dados, s }: { entrada: Entrada; dados: DadosDoObservatorio; s: S }) {
  const valor = (t?: string) => {
    const m = t?.match(/R\$\s*([\d.,]+)\s*(mil|milh(?:ão|ões)|bilh(?:ão|ões))?/i);
    if (!m) return -1;
    const n = Number(m[1].replace(/\./g, "").replace(",", "."));
    const mult = !m[2] ? 1 : /^mil$/i.test(m[2]) ? 1e3 : /^milh/i.test(m[2]) ? 1e6 : 1e9;
    return Number.isFinite(n) ? n * mult : -1;
  };
  const ligacoes = dados.ligacoes.filter((l) => l.entradaId === entrada.id).sort((a, b) => valor(b.rotulo) - valor(a.rotulo));
  if (ligacoes.length === 0) return null;
  const numeroDaFonte = (id: string) => entrada.fontes.findIndex((f) => f.id === id || f.catalogoId === id) + 1;
  return (
    <section className="ve-bloco" aria-label={s.visual.ficha.ligacoes}>
      <h3 className="ve-rotulo">{s.visual.ficha.ligacoes}</h3>
      <ul className="ve-ligacoes">
        {ligacoes.map((l) => {
          const conf = confiancaDaLigacao(l, entrada);
          const nums = l.fonteIds.map(numeroDaFonte).filter((n) => n > 0);
          return (
            <li key={l.id}>
              <i className="ve-i-conf" data-confianca={conf} aria-hidden="true" />
              <span>
                {nomeDaPonta(dados, l.de)} <span className="ve-ligacao-tipo">{s.visual.ligacao[l.tipo]}</span> {nomeDaPonta(dados, l.para)}
                {l.rotulo ? <span className="ve-aviso-fixo"> · {l.rotulo}</span> : null}
                <span className="ve-ligacao-meta">
                  {" "}
                  · {s.visual.lista[conf]}
                  {nums.map((n) => (
                    <a key={n} href={`#fonte-${n}`}>
                      {" "}
                      [{n}]
                    </a>
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
