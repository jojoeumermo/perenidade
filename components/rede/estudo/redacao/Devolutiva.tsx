// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Uma redação da pessoa: na roda (quanto falta corrigir para receber, sem nada das leituras), encerrada sem devolução, ou devolvida
// com as leituras ("Leitura 1", "Leitura 2", sem nome), a média, a denúncia de uma leitura e o apagar agora.
import { useId, useState } from "react";
import { LIMITES_DA_REDACAO, type CorrecaoRecebida, type MinhaRedacao } from "./cliente";
import { FolhaDeLer } from "./Folha";
import { dataNoIdioma, por, type TextosDaRedacao } from "./textos";

function Denunciar({ t, aoEnviar }: { t: TextosDaRedacao; aoEnviar: (motivo: string) => Promise<string | null> }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const id = useId();
  const td = t.devolutivas;
  if (!aberto) {
    return <button type="button" className="al-botao al-botao-fantasma al-botao-p rd-denunciar" onClick={() => setAberto(true)}>{td.denunciar}</button>;
  }
  const enviar = async () => {
    setEnviando(true);
    const e = await aoEnviar(motivo.trim());
    setEnviando(false);
    setErro(e);
    if (!e) setAberto(false);
  };
  return (
    <div className="rd-denuncia">
      <label htmlFor={id} className="rd-rotulo">{td.denunciaMotivo}</label>
      <textarea id={id} className="rd-campo" rows={3} maxLength={LIMITES_DA_REDACAO.motivoMax} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <p className="rd-dica">{td.denunciaDica}</p>
      {erro && <p className="rd-erro" role="alert">{erro}</p>}
      <div className="rd-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={enviando || motivo.trim().length < LIMITES_DA_REDACAO.motivoMin} onClick={enviar}>{td.enviarDenuncia}</button>
        <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setAberto(false)}>{td.cancelar}</button>
      </div>
    </div>
  );
}

/** Uma leitura recebida: o total, as cinco competências em barras de ladrilho, os comentários e a denúncia. */
export function LeituraRecebida({ t, n, c, aoDenunciar }: { t: TextosDaRedacao; n: number; c: CorrecaoRecebida; aoDenunciar?: (motivo: string) => Promise<string | null> }) {
  const td = t.devolutivas;
  if (c.removida) {
    return (
      <li className="rd-recebida" data-removida="sim">
        <h4 className="al-cond">{por(td.leitura, { n })}</h4>
        <p className="rd-dica">{td.removida}</p>
      </li>
    );
  }
  return (
    <li className="rd-recebida">
      <div className="rd-recebida-topo">
        <h4 className="al-cond">{por(td.leitura, { n })}</h4>
        <p className="rd-recebida-total al-cond"><strong>{c.total}</strong> <span>{td.deMil}</span></p>
      </div>
      <ol className="rd-barras">
        {c.competencias.map((x, i) => (
          <li key={i}>
            <div className="rd-barra-linha">
              <span className="rd-barra-nome al-cond">{t.competencias[i]?.nome}</span>
              <span className="rd-barra" aria-hidden>
                {[40, 80, 120, 160, 200].map((p) => <i key={p} data-cheio={x.nota >= p ? "sim" : undefined} />)}
              </span>
              <strong className="rd-barra-nota">{x.nota}</strong>
            </div>
            <p className="rd-barra-comentario">{x.comentario}</p>
          </li>
        ))}
      </ol>
      {c.geral && <p className="rd-geral">{c.geral}</p>}
      {c.denuncia === "aberta" && <p className="rd-selo-pequeno">{td.denunciaAberta}</p>}
      {c.denuncia === "nao_abusiva" && <p className="rd-selo-pequeno">{td.denunciaNaoAbusiva}</p>}
      {c.denuncia === "abusiva" && <p className="rd-selo-pequeno">{td.denunciaAbusiva}</p>}
      {c.denuncia === null && aoDenunciar && <Denunciar t={t} aoEnviar={aoDenunciar} />}
    </li>
  );
}

export function Devolutiva({ lang, t, m, aoApagar, aoDenunciar }: {
  lang: string;
  t: TextosDaRedacao;
  m: MinhaRedacao;
  aoApagar: () => Promise<void>;
  aoDenunciar: (correcao: string, motivo: string) => Promise<string | null>;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const td = t.devolutivas;
  const valem = (m.correcoes ?? []).filter((c) => !c.removida);
  const media = valem.length ? Math.round(valem.reduce((s, c) => s + c.total, 0) / valem.length) : null;
  return (
    <article className="rd-minha" data-situacao={m.situacao}>
      <header className="rd-minha-topo">
        <p className="rd-selo al-cond">{por(td.semana, { data: dataNoIdioma(lang, m.semana) })}</p>
        <h3 className="rd-minha-tema">{m.tema}</h3>
        {m.titulo && <p className="rd-minha-titulo">“{m.titulo}”</p>}
      </header>

      {m.situacao === "na_roda" && (
        <div className="rd-estado">
          <p>{por(td.naRoda, { data: dataNoIdioma(lang, m.roda_ate) })}</p>
          <p className="rd-estado-forte">{m.falta_corrigir && m.falta_corrigir > 1 ? por(td.faltaCorrigir, { n: m.falta_corrigir }) : m.falta_corrigir === 1 ? td.faltaUma : td.esperandoLeituras}</p>
        </div>
      )}
      {m.situacao === "encerrada" && <div className="rd-estado"><p>{por(td.encerrada, { data: dataNoIdioma(lang, m.apagar_em) })}</p></div>}
      {m.situacao === "devolvida" && (
        <>
          <div className="rd-estado">
            <p>{por(td.devolvida, { data: dataNoIdioma(lang, m.devolvida_em), apagar: dataNoIdioma(lang, m.apagar_em) })}</p>
          </div>
          {media !== null && (
            <div className="rd-media">
              <span className="al-cond">{td.media}</span>
              <strong className="al-cond">{media}</strong>
              <span>{td.deMil}</span>
            </div>
          )}
          <ul className="rd-recebidas">
            {(m.correcoes ?? []).map((c, i) => <LeituraRecebida key={c.id} t={t} n={i + 1} c={c} aoDenunciar={(motivo) => aoDenunciar(c.id, motivo)} />)}
          </ul>
        </>
      )}

      <details className="rd-meu-texto">
        <summary>{td.verTexto}</summary>
        <FolhaDeLer titulo={m.titulo} texto={m.texto} />
      </details>
      <div className="rd-acoes">
        {!confirmar ? (
          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setConfirmar(true)}>{td.apagar}</button>
        ) : (
          <>
            <span className="rd-confirma">{td.apagarConfirma}</span>
            <button type="button" className="al-botao al-botao-primario al-botao-p" onClick={aoApagar}>{td.apagarSim}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setConfirmar(false)}>{td.cancelar}</button>
          </>
        )}
      </div>
    </article>
  );
}
