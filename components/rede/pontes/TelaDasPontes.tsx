// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Robôs e Telegram da organização (/alumia/pontes, frente 13E). Para quem gerencia uma organização: os robôs dela (criar, chave
// nova que aparece uma vez, desligar), o canal do Telegram (atrás de "alumia-telegram"; só com selo) e como a API funciona. Para a
// coordenação, a fila dos robôs de organização sem selo. Nenhuma lista de pessoas: robô e canal são da organização.
import "./pontes.css";
import { useEffect, useState } from "react";
import { telegramLigado } from "@/lib/rede/pontes/ligado";
import { canalDoTelegram, LIMITES_DAS_PONTES as L } from "@/lib/rede/pontes/regras";
import type { PropsDaTelaDoPacote } from "../registro";
import { pontes, PREVIA_DAS_PONTES, type EuNasPontes, type PontesDaOrg, type Robo } from "./cliente";
import { diaNoIdioma, por, textoDoErro, type TextosDasPontes } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

type Aba = "robos" | "telegram" | "api" | "fila";
const TELEGRAM = PREVIA_DAS_PONTES || telegramLigado();

function Cabeca({ t }: { t: TextosDasPontes }) {
  return (
    <header className="po-cabeca">
      <p className="po-carimbo al-cond">{t.pontes.carimbo}</p>
      <h1 className="al-cond">{t.pontes.titulo}</h1>
      <p className="po-chamada">{t.pontes.chamada}</p>
    </header>
  );
}

function ChaveUmaVez({ t, chave, aoFechar }: { t: TextosDasPontes; chave: string; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="po-chave" role="alert">
      <strong className="al-cond" style={{ fontSize: "1.25rem" }}>{t.robos.chaveTitulo}</strong>
      <p className="po-nota">{t.robos.chaveUmaVez}</p>
      <code translate="no">{chave}</code>
      <div className="po-acoes">
        <button type="button" className="al-botao al-botao-m al-botao-dourado" onClick={() => navigator.clipboard?.writeText(chave).then(() => setCopiado(true), () => undefined)}>
          {copiado ? t.robos.copiado : t.robos.copiar}
        </button>
        <button type="button" className="al-botao al-botao-m al-botao-fantasma" onClick={aoFechar}>{t.robos.fechar}</button>
      </div>
    </div>
  );
}

function CartaoDoRobo({ t, lang, robo, aoMudar }: { t: TextosDasPontes; lang: string; robo: Robo; aoMudar: (r: Robo) => void }) {
  const [chave, setChave] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ativo = robo.situacao === "ativo";
  const fazer = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <li className="po-cartao" data-situacao={robo.situacao}>
      <div className="po-cartao-cabeca">
        <h3 className="al-cond">{robo.nome}</h3>
        <span className="po-selo al-cond" data-tom="robo">{t.rotulo.robo}</span>
        <span className="po-selo al-cond" data-tom={ativo ? "ativo" : "parado"}>{t.robos.situacao[robo.situacao]}</span>
      </div>
      {robo.handle && <p className="po-handle">@{robo.handle}</p>}
      <p className="po-texto" style={{ margin: "0.35rem 0" }}>{robo.descricao}</p>
      {ativo && (
        <p className="po-nota">
          {robo.temChave && robo.chaveDia ? por(t.robos.chaveDe, { data: diaNoIdioma(lang, robo.chaveDia) }) : t.robos.semChave}
          {" · "}
          {por(t.robos.usoHoje, { n: robo.hoje, max: L.robosPorDia })}
        </p>
      )}
      {robo.situacao === "desligado" && <p className="po-nota">{t.robos.desligadoTexto}</p>}
      {robo.situacao === "recusado" && <p className="po-nota">{t.robos.recusadoTexto}</p>}
      {chave && <ChaveUmaVez t={t} chave={chave} aoFechar={() => setChave(null)} />}
      {(ativo || robo.situacao === "esperando") && (
        <div className="po-acoes" style={{ marginTop: "0.7rem" }}>
          {ativo && (
            <button type="button" className="al-botao al-botao-m al-botao-claro" disabled={ocupado} title={robo.temChave ? t.robos.trocarAviso : undefined}
              onClick={() => fazer(async () => { const r = await pontes.novaChave(robo.id); setChave(r.chave); aoMudar(r.robo); })}>
              {robo.temChave ? t.robos.trocarChave : t.robos.novaChave}
            </button>
          )}
          {robo.handle && ativo && <a className="al-botao al-botao-m al-botao-fantasma" href={`/${lang}/alumia/u/${robo.handle}`}>{t.robos.perfil}</a>}
          <button type="button" className="al-botao al-botao-m al-botao-contorno" disabled={ocupado}
            onClick={() => { if (window.confirm(por(t.robos.desligarConfirma, { nome: robo.nome }))) void fazer(async () => { aoMudar(await pontes.desligarRobo(robo.id)); setChave(null); }); }}>
            {t.robos.desligar}
          </button>
        </div>
      )}
      {erro && <p className="po-erro" role="alert">{erro}</p>}
    </li>
  );
}

function Robos({ t, lang, handle, dados, aoMudar }: { t: TextosDasPontes; lang: string; handle: string; dados: PontesDaOrg; aoMudar: (d: PontesDaOrg) => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const vivos = dados.robos.filter((r) => r.situacao !== "desligado" && r.situacao !== "recusado").length;
  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      const r = await pontes.criarRobo(handle, nome.trim(), descricao.trim());
      aoMudar({ ...dados, robos: [...dados.robos, r.robo] });
      setNome("");
      setDescricao("");
    } catch (x) {
      setErro(textoDoErro(t.erros, x));
    } finally {
      setOcupado(false);
    }
  };
  const nomeOk = nome.trim().length >= L.roboNomeMin && nome.trim().length <= L.roboNome;
  const descOk = descricao.trim().length >= L.roboDescricaoMin && descricao.trim().length <= L.roboDescricao;
  return (
    <section className="po-bloco" aria-labelledby="po-robos-t">
      <h2 id="po-robos-t" className="po-bloco-titulo al-cond">{t.robos.titulo}</h2>
      <p className="po-texto">{t.robos.chamada}</p>
      {!dados.selo && <p className="po-texto"><strong>{t.robos.semSelo}</strong></p>}
      {dados.robos.length === 0 ? <p className="po-vazio">{t.robos.nenhum}</p> : (
        <ul className="po-lista">
          {dados.robos.map((r) => <CartaoDoRobo key={r.id} t={t} lang={lang} robo={r} aoMudar={(novo) => aoMudar({ ...dados, robos: dados.robos.map((x) => (x.id === novo.id ? { ...x, ...novo } : x)) })} />)}
        </ul>
      )}
      {vivos < L.robosPorOrg && (
        <form className="po-form" style={{ marginTop: "1.4rem" }} onSubmit={criar}>
          <h3 className="al-cond" style={{ margin: 0, fontSize: "1.45rem" }}>{t.robos.novo}</h3>
          <label className="po-campo">
            <span>{t.robos.nome}</span>
            <input value={nome} maxLength={L.roboNome} onChange={(e) => setNome(e.target.value)} />
            <small>{t.robos.nomeAjuda}</small>
          </label>
          <label className="po-campo">
            <span>{t.robos.descricao}</span>
            <textarea value={descricao} maxLength={L.roboDescricao} onChange={(e) => setDescricao(e.target.value)} />
            <small>{t.robos.descricaoAjuda}</small>
          </label>
          <div className="po-acoes">
            <button type="submit" className="al-botao al-botao-m al-botao-primario" disabled={ocupado || !nomeOk || !descOk}>{ocupado ? t.robos.criando : t.robos.criar}</button>
            <span className="po-nota" style={{ margin: 0 }}>{por(t.robos.limite, { n: L.robosPorOrg })}</span>
          </div>
          {erro && <p className="po-erro" role="alert">{erro}</p>}
        </form>
      )}
    </section>
  );
}

function Telegram({ t, lang, handle, dados, aoMudar }: { t: TextosDasPontes; lang: string; handle: string; dados: PontesDaOrg; aoMudar: (d: PontesDaOrg) => void }) {
  const [canal, setCanal] = useState(dados.telegram?.canal ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const tg = dados.telegram;
  const salvar = async (ligar: boolean, apagar = false) => {
    const limpo = apagar ? "" : canalDoTelegram(canal);
    if (limpo === null) return setErro(t.telegram.invalido);
    setOcupado(true);
    setErro(null);
    try {
      const novo = await pontes.telegram(handle, limpo, apagar ? false : ligar);
      aoMudar(novo);
      setCanal(novo.telegram?.canal ?? "");
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section className="po-bloco" aria-labelledby="po-tg-t">
      <h2 id="po-tg-t" className="po-bloco-titulo al-cond">{t.telegram.titulo}</h2>
      <p className="po-texto">{t.telegram.chamada}</p>
      {!dados.selo ? <p className="po-texto"><strong>{t.telegram.semSelo}</strong></p> : (
        <div className="po-form">
          <ol className="po-texto" style={{ paddingLeft: "1.2rem", margin: 0 }}>
            <li>{t.telegram.passo1}</li>
            <li>{t.telegram.passo2}</li>
          </ol>
          <label className="po-campo">
            <span>{t.telegram.canal}</span>
            <input value={canal} onChange={(e) => setCanal(e.target.value)} placeholder="@" autoComplete="off" spellCheck={false} />
            <small>{t.telegram.canalAjuda}</small>
          </label>
          <p className="po-nota" role="status">
            {tg?.motivo === "falhas" ? t.telegram.falhas : tg?.ligado ? (tg.enviadoDia ? por(t.telegram.ligado, { data: diaNoIdioma(lang, tg.enviadoDia) }) : t.telegram.ligadoNunca) : t.telegram.desligado}
          </p>
          <div className="po-acoes">
            {tg?.ligado ? (
              <>
                <button type="button" className="al-botao al-botao-m al-botao-claro" disabled={ocupado} onClick={() => salvar(true)}>{t.telegram.salvar}</button>
                <button type="button" className="al-botao al-botao-m al-botao-contorno" disabled={ocupado} onClick={() => salvar(false)}>{t.telegram.desligar}</button>
              </>
            ) : (
              <button type="button" className="al-botao al-botao-m al-botao-primario" disabled={ocupado || !canal.trim()} onClick={() => salvar(true)}>{t.telegram.ligar}</button>
            )}
            {tg && <button type="button" className="al-botao al-botao-m al-botao-fantasma" disabled={ocupado} onClick={() => salvar(false, true)}>{t.telegram.apagar}</button>}
          </div>
          {erro && <p className="po-erro" role="alert">{erro}</p>}
        </div>
      )}
    </section>
  );
}

function ComoUsar({ t }: { t: TextosDasPontes }) {
  const exemplo = `POST /api/rede/robos\nAuthorization: Bearer alumia_robo_…\nContent-Type: application/json\n\n{ "texto": "Boletim da greve: assembleia amanhã, 10h.", "publico": "internet" }`;
  return (
    <section className="po-bloco" aria-labelledby="po-api-t">
      <h2 id="po-api-t" className="po-bloco-titulo al-cond">{t.api.titulo}</h2>
      <p className="po-texto">{por(t.api.chamada, { hora: L.robosPorHora, dia: L.robosPorDia })}</p>
      <p className="po-nota">{t.api.exemplo}</p>
      <pre className="po-codigo" translate="no">{exemplo}</pre>
      <p className="po-texto">{t.api.publicos}</p>
      <p className="po-texto">{t.api.respostas}</p>
      <p className="po-texto"><strong>{t.api.segredo}</strong></p>
    </section>
  );
}

function Fila({ t }: { t: TextosDasPontes }) {
  const [fila, setFila] = useState<Robo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    pontes.fila().then(setFila, (e) => { setFila([]); setErro(textoDoErro(t.erros, e)); });
  }, [t]);
  const decidir = async (r: Robo, aprovar: boolean) => {
    try {
      await pontes.decidir(r.id, aprovar);
      setFila((l) => l?.filter((x) => x.id !== r.id) ?? l);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    }
  };
  return (
    <section className="po-bloco" aria-labelledby="po-fila-t">
      <h2 id="po-fila-t" className="po-bloco-titulo al-cond">{t.fila.titulo}</h2>
      <p className="po-texto">{t.fila.chamada}</p>
      {fila === null ? <p className="po-nota">{t.pontes.carregando}</p> : fila.length === 0 ? <p className="po-vazio">{t.fila.vazia}</p> : (
        <ul className="po-lista">
          {fila.map((r) => (
            <li key={r.id} className="po-cartao" data-situacao="esperando">
              <div className="po-cartao-cabeca">
                <h3 className="al-cond">{r.nome}</h3>
                <span className="po-selo al-cond" data-tom="robo">{t.rotulo.robo}</span>
              </div>
              {r.org && <p className="po-handle">{por(t.fila.de, { org: r.org.nome })}</p>}
              <p className="po-texto" style={{ margin: "0.35rem 0 0.7rem" }}>{r.descricao}</p>
              <div className="po-acoes">
                <button type="button" className="al-botao al-botao-m al-botao-primario" onClick={() => decidir(r, true)}>{t.fila.aprovar}</button>
                <button type="button" className="al-botao al-botao-m al-botao-contorno" onClick={() => decidir(r, false)}>{t.fila.recusar}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="po-erro" role="alert">{erro}</p>}
    </section>
  );
}

export default function TelaDasPontes({ lang, situacao, params }: PropsDaTelaDoPacote) {
  const t = useTextosDasPontes(lang);
  const membro = situacao.logado && situacao.membro && !situacao.suspenso;
  const [eu, setEu] = useState<EuNasPontes | null>(null);
  const [org, setOrg] = useState<string>(params?.org ?? "");
  const [carga, setCarga] = useState<{ org: string; dados: PontesDaOrg } | null>(null);
  const [aba, setAba] = useState<Aba>("robos");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!membro) return;
    pontes.eu().then((x) => {
      setEu(x);
      const minhas = x.orgs.filter((o) => o.gerencio);
      setOrg((atual) => (minhas.some((o) => o.handle === atual) ? atual : minhas[0]?.handle ?? ""));
      if (!minhas.length && x.coordenacao) setAba("fila");
    }, () => setEu({ coordenacao: false, telegram: false, orgs: [] }));
  }, [membro]);
  useEffect(() => {
    if (!org) return;
    let vivo = true;
    pontes.daOrg(org).then((d) => vivo && setCarga({ org, dados: d }), (e) => vivo && setErro(t ? textoDoErro(t.erros, e) : null));
    return () => {
      vivo = false;
    };
  }, [org, t]);
  const dados = carga?.org === org ? carga.dados : null;
  const setDados = (d: PontesDaOrg) => setCarga({ org, dados: d });

  if (!t) return <p className="po-pagina po-nota">…</p>;
  if (!membro) return <article className="po-pagina"><Cabeca t={t} /><p className="po-texto">{t.erros.consentimento}</p></article>;
  if (!eu) return <article className="po-pagina"><Cabeca t={t} /><p className="po-nota">{t.pontes.carregando}</p></article>;

  const minhas = eu.orgs.filter((o) => o.gerencio);
  const abas: Aba[] = [...(minhas.length ? (["robos", ...(TELEGRAM && eu.telegram ? ["telegram"] : []), "api"] as Aba[]) : []), ...(eu.coordenacao ? (["fila"] as Aba[]) : [])];

  return (
    <article className="po-pagina">
      <Cabeca t={t} />
      {minhas.length === 0 && !eu.coordenacao ? <p className="po-vazio">{t.pontes.semOrg}</p> : (
        <>
          {minhas.length > 1 && (
            <label className="po-campo" style={{ maxWidth: "24rem", marginBottom: "1.1rem" }}>
              <span>{t.pontes.escolherOrg}</span>
              <select value={org} onChange={(e) => setOrg(e.target.value)}>
                {minhas.map((o) => <option key={o.handle} value={o.handle}>{o.nome}</option>)}
              </select>
            </label>
          )}
          {abas.length > 1 && (
            <div className="po-abas" role="group" aria-label={t.pontes.titulo}>
              {abas.map((a) => (
                <button key={a} type="button" className="po-aba" aria-pressed={aba === a} onClick={() => setAba(a)}>{t.pontes.abas[a]}</button>
              ))}
            </div>
          )}
          {erro && <p className="po-erro" role="alert">{erro}</p>}
          {aba === "fila" && eu.coordenacao ? <Fila t={t} /> : aba === "api" ? <ComoUsar t={t} /> : !dados ? <p className="po-nota">{t.pontes.carregando}</p>
            : aba === "telegram" ? <Telegram key={org} t={t} lang={lang} handle={org} dados={dados} aoMudar={setDados} />
            : <Robos key={org} t={t} lang={lang} handle={org} dados={dados} aoMudar={setDados} />}
        </>
      )}
    </article>
  );
}
