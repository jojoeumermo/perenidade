// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O Mural dos Trabalhadores (/alumia/trabalhadores, frente 13E): os chamados de greve, paralisação, assembleia, campanha,
// solidariedade e trabalho coletivo das organizações com selo, em ladrilhos do Mosaico. Filtro por tipo e por cidade (só a
// cidade; nenhum mapa, nenhuma localização). Quem fala por uma organização com selo publica e encerra os chamados dela. Nenhum
// chamado diz quem escreveu: é da organização. O mural de economia solidária do site (/mural) continua onde está.
import "./pontes.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LIMITES_DAS_PONTES as L, maisDias, problemaDoChamado, TIPOS_DO_MURAL, type TipoDoMural } from "@/lib/rede/pontes/regras";
import type { PropsDaTelaDoPacote } from "../registro";
import { pontes, type Chamado, type ChamadoNovo, type Mural } from "./cliente";
import { diaNoIdioma, por, textoDoErro, type TextosDasPontes } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

const hojeAqui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function Ladrilho({ t, lang, c, aoEncerrar }: { t: TextosDasPontes; lang: string; c: Chamado; aoEncerrar?: () => void }) {
  return (
    <li className="po-chamado" data-tipo={c.tipo}>
      <div className="po-chamado-topo">
        <span className="po-tipo al-cond">{t.mural.tipos[c.tipo]}</span>
        <span className="po-categoria">{c.categoria}</span>
      </div>
      <h3 className="al-cond">{c.titulo}</h3>
      <p>{c.texto}</p>
      <div className="po-chamado-pe">
        <a href={`/${lang}/alumia/u/${c.org.handle}`}><span className="po-palavra al-cond">{c.org.palavra}</span> · {c.org.nome}</a>
        {c.cidade && <span>{c.cidade}</span>}
        {c.quando && <span>{por(t.mural.quando, { data: diaNoIdioma(lang, c.quando) })}</span>}
        <span>{c.encerrado ? t.mural.encerrado : por(t.mural.ate, { data: diaNoIdioma(lang, c.ate) })}</span>
      </div>
      {aoEncerrar && !c.encerrado && (
        <div className="po-acoes">
          <button type="button" className="al-botao al-botao-p al-botao-contorno" onClick={() => { if (window.confirm(t.mural.encerrarConfirma)) aoEncerrar(); }}>{t.mural.encerrar}</button>
        </div>
      )}
    </li>
  );
}

function Publicar({ t, orgs, aoPublicar }: { t: TextosDasPontes; orgs: { handle: string; nome: string }[]; aoPublicar: (c: Chamado) => void }) {
  const vazio: ChamadoNovo = { tipo: "greve", categoria: "", titulo: "", texto: "", cidade: "", quando: "", ate: "" };
  const [org, setOrg] = useState(orgs[0]?.handle ?? "");
  const [c, setC] = useState<ChamadoNovo>(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const hoje = hojeAqui();
  const muda = <K extends keyof ChamadoNovo>(k: K, v: ChamadoNovo[K]) => setC((x) => ({ ...x, [k]: v }));
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = problemaDoChamado(c, hoje);
    if (p) return setErro(t.mural.problema[p as keyof TextosDasPontes["mural"]["problema"]] ?? t.erros.invalido);
    setOcupado(true);
    setErro(null);
    try {
      aoPublicar(await pontes.publicarChamado(org, { ...c, categoria: c.categoria.trim(), titulo: c.titulo.trim(), texto: c.texto.trim(), cidade: c.cidade.trim() }));
      setC(vazio);
    } catch (x) {
      setErro(textoDoErro(t.erros, x));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <form className="po-form" onSubmit={enviar}>
      {orgs.length > 1 && (
        <label className="po-campo">
          <span>{t.mural.comoOrg}</span>
          <select value={org} onChange={(e) => setOrg(e.target.value)}>{orgs.map((o) => <option key={o.handle} value={o.handle}>{o.nome}</option>)}</select>
        </label>
      )}
      <label className="po-campo">
        <span>{t.mural.tipo}</span>
        <select value={c.tipo} onChange={(e) => muda("tipo", e.target.value as TipoDoMural)}>{TIPOS_DO_MURAL.map((x) => <option key={x} value={x}>{t.mural.tipos[x]}</option>)}</select>
      </label>
      <label className="po-campo">
        <span>{t.mural.categoria}</span>
        <input value={c.categoria} maxLength={L.muralCategoria} onChange={(e) => muda("categoria", e.target.value)} />
        <small>{t.mural.categoriaAjuda}</small>
      </label>
      <label className="po-campo">
        <span>{t.mural.tituloCampo}</span>
        <input value={c.titulo} maxLength={L.muralTitulo} onChange={(e) => muda("titulo", e.target.value)} />
      </label>
      <label className="po-campo">
        <span>{t.mural.texto}</span>
        <textarea value={c.texto} maxLength={L.muralTexto} onChange={(e) => muda("texto", e.target.value)} />
        <small>{t.mural.textoAjuda}</small>
      </label>
      <label className="po-campo">
        <span>{t.mural.cidadeCampo}</span>
        <input value={c.cidade} maxLength={L.muralCidade} onChange={(e) => muda("cidade", e.target.value)} />
      </label>
      <div className="po-linha">
        <label className="po-campo">
          <span>{t.mural.quandoCampo}</span>
          <input type="date" value={c.quando} min={hoje} max={c.ate || maisDias(hoje, L.muralDiasMax)} onChange={(e) => muda("quando", e.target.value)} />
        </label>
        <label className="po-campo">
          <span>{t.mural.ateCampo}</span>
          <input type="date" value={c.ate} min={hoje} max={maisDias(hoje, L.muralDiasMax)} onChange={(e) => muda("ate", e.target.value)} />
          <small>{por(t.mural.ateAjuda, { n: L.muralDiasMax })}</small>
        </label>
      </div>
      <div className="po-acoes">
        <button type="submit" className="al-botao al-botao-m al-botao-primario" disabled={ocupado}>{ocupado ? t.mural.enviando : t.mural.enviar}</button>
      </div>
      {erro && <p className="po-erro" role="alert">{erro}</p>}
    </form>
  );
}

export default function TelaDosTrabalhadores({ lang, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDasPontes(lang);
  const [tipo, setTipo] = useState<TipoDoMural | "">("");
  const [cidade, setCidade] = useState("");
  const [mural, setMural] = useState<Mural | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const membro = situacao.logado && situacao.membro && !situacao.suspenso;

  const carregar = useCallback(() => {
    pontes.mural({ ...(tipo ? { tipo } : {}), ...(cidade ? { cidade } : {}) }).then(setMural, (e) => {
      setMural({ chamados: [], cidades: [], possoPublicar: [], meus: [] });
      setErro(t ? textoDoErro(t.erros, e) : null);
    });
  }, [tipo, cidade, t]);
  useEffect(() => carregar(), [carregar]);
  const cidades = useMemo(() => mural?.cidades ?? [], [mural]);

  if (!t) return <p className="po-pagina po-nota">…</p>;
  const encerrar = async (id: string) => {
    try {
      await pontes.encerrarChamado(id);
      carregar();
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
  };
  const filtrado = Boolean(tipo || cidade);
  const posso = membro && (mural?.possoPublicar.length ?? 0) > 0;
  // Os chamados da organização que não estão na lista de cima (encerrados, vencidos ou fora do filtro).
  const meusFora = (mural?.meus ?? []).filter((c) => !mural?.chamados.some((x) => x.id === c.id));

  return (
    <article className="po-pagina">
      <header className="po-cabeca">
        <p className="po-carimbo al-cond">{t.mural.carimbo}</p>
        <h1 className="al-cond">{t.mural.titulo}</h1>
        <p className="po-chamada">{t.mural.chamada}</p>
      </header>

      <div className="po-duas">
        <div>
          <div className="po-filtros" role="group" aria-label={t.mural.tipo}>
            <button type="button" className="po-pilula" aria-pressed={tipo === ""} onClick={() => setTipo("")}>{t.mural.todos}</button>
            {TIPOS_DO_MURAL.map((x) => (
              <button key={x} type="button" className="po-pilula" aria-pressed={tipo === x} onClick={() => setTipo(x)}>{t.mural.tipos[x]}</button>
            ))}
            {cidades.length > 0 && (
              <select aria-label={t.mural.cidade} value={cidade} onChange={(e) => setCidade(e.target.value)}>
                <option value="">{t.mural.todasCidades}</option>
                {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          {erro && <p className="po-erro" role="alert">{erro}</p>}
          {mural === null ? <p className="po-nota">{t.pontes.carregando}</p> : mural.chamados.length === 0 ? <p className="po-vazio">{filtrado ? t.mural.vazioFiltro : t.mural.vazio}</p> : (
            <ul className="po-mural">
              {mural.chamados.map((c) => <Ladrilho key={c.id} t={t} lang={lang} c={c} aoEncerrar={c.posso ? () => encerrar(c.id) : undefined} />)}
            </ul>
          )}
        </div>

        <aside className="po-lado" aria-labelledby="po-publicar-t">
          {posso && mural ? (
            <>
              <h2 id="po-publicar-t" className="al-cond">{t.mural.publicar}</h2>
              <Publicar t={t} orgs={mural.possoPublicar} aoPublicar={() => carregar()} />
            </>
          ) : (
            <>
              <h2 id="po-publicar-t" className="al-cond">{t.mural.porque}</h2>
              <p className="po-texto">{t.mural.porqueTexto}</p>
            </>
          )}
          <p className="po-nota" style={{ marginTop: "1.2rem" }}>{t.mural.solidaria}</p>
          <a className="po-link" href={`/${lang}/mural`}>{t.mural.solidariaLink}</a>
        </aside>
      </div>

      {posso && mural && meusFora.length > 0 && (
        <section className="po-bloco" style={{ marginTop: "2.2rem" }} aria-labelledby="po-meus-t">
          <h2 id="po-meus-t" className="po-bloco-titulo al-cond">{t.mural.meus}</h2>
          <ul className="po-mural">
            {meusFora.map((c) => <Ladrilho key={c.id} t={t} lang={lang} c={c} aoEncerrar={() => encerrar(c.id)} />)}
          </ul>
        </section>
      )}
    </article>
  );
}
