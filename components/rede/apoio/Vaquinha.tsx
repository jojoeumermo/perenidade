// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A vaquinha do caixa transparente (onda 13, L1-18 com a troca por princípio): a meta, o valor arrecadado e a prestação de contas,
// todos INFORMADOS pela organização e com data; a faixa de 20 ladrilhos dourados mostra o caminho até a meta. Nenhum pagamento
// passa pela Alumia (a chave Pix e o link ficam no caixa, e só para organização com selo) e quem doa nunca aparece: nem nome, nem
// número de doadores. Quem desconfia de uma vaquinha falsa manda à mediação, sem a organização saber quem foi.
import { useId, useState } from "react";
import { centavosDe, dinheiro } from "@/lib/rede/org/b1";
import { dataCurta } from "@/lib/rede/org/contagem";
import { Botao } from "../ui/Botao";
import { clienteDoApoio } from "./cliente";
import { casasDaMeta, LIMITES_DO_APOIO as L, type CaixaComVaquinha, type CaixasComVaquinha } from "./regras";
import { fraseDoApoio, preencherApoio, type TextosDoApoio } from "./textos";
import "./apoio.css";
import { confirmar } from "@/components/perguntar";

type Fazer = (f: () => Promise<CaixasComVaquinha | null>) => Promise<void>;

/** A faixa de ladrilhos até a meta (20 casas). Serve à vaquinha e à petição. */
export function Ladrilhos({ acesas, rotulo, chegou }: { acesas: number; rotulo: string; chegou: boolean }) {
  return (
    <span className="ap-ladrilhos" role="img" aria-label={rotulo} data-chegou={chegou ? "" : undefined}>
      {Array.from({ length: 20 }, (_, i) => <span key={i} data-acesa={i < acesas ? "" : undefined} style={{ ["--i" as string]: i }} />)}
    </span>
  );
}

/** A frase do idioma ("{valor} de {meta}", "{n} из {meta}") com o número grande no lugar dele. */
export function NumeroNaFrase({ modelo, chave, numero, valores }: { modelo: string; chave: string; numero: string; valores: Record<string, string> }) {
  const [antes, depois = ""] = modelo.split(`{${chave}}`);
  return (
    <span className="ap-frase">
      {preencherApoio(antes, valores)}
      <strong className="al-cond ap-numero">{numero}</strong>
      {preencherApoio(depois, valores)}
    </span>
  );
}

const reais =(centavos: number | null) => (centavos === null ? "" : (centavos / 100).toFixed(2).replace(".", ","));

export function VaquinhaDoCaixa({ c, t, lang, handle, cuido, selo, ocupado, fazer }: {
  c: CaixaComVaquinha; t: TextosDoApoio; lang: string; handle: string; cuido: boolean; selo: boolean; ocupado: boolean; fazer: Fazer;
}) {
  const tv = t.vaquinha;
  const id = useId();
  const cli = clienteDoApoio();
  const chegou = c.meta !== null && c.arrecadado !== null && c.arrecadado >= c.meta;
  const temAlgo = c.meta !== null || c.arrecadado !== null || c.contas.length > 0 || cuido;
  if (!temAlgo) return <Denunciar c={c} t={t} cuido={cuido} />;

  return (
    <div className="ap-vaquinha" aria-labelledby={`${id}-v`}>
      <p id={`${id}-v`} className="ap-faixa al-cond">{tv.rotulo}</p>
      {c.meta !== null ? (
        <div className="ap-meta">
          <Ladrilhos
            acesas={casasDaMeta(c.arrecadado, c.meta)}
            chegou={chegou}
            rotulo={preencherApoio(tv.ladrilhos, { valor: dinheiro(c.arrecadado ?? 0, lang), meta: dinheiro(c.meta, lang) })}
          />
          <p className="ap-meta-numero">
            <NumeroNaFrase modelo={tv.deMeta} chave="valor" numero={dinheiro(c.arrecadado ?? 0, lang)} valores={{ meta: dinheiro(c.meta, lang) }} />
            {chegou ? <span className="ap-carimbo al-cond">{tv.chegou}</span> : null}
          </p>
        </div>
      ) : null}
      {c.arrecadado !== null ? (
        <p className="ap-informado">
          {c.meta === null ? <><strong>{tv.arrecadado}: {dinheiro(c.arrecadado, lang)}</strong> · </> : null}
          {c.arrecadadoDia ? preencherApoio(tv.informadoEm, { data: dataCurta(c.arrecadadoDia, lang) }) : null}
        </p>
      ) : c.meta !== null ? <p className="ap-informado">{tv.semArrecadado}</p> : null}

      <section className="ap-contas" aria-labelledby={`${id}-c`}>
        <h5 id={`${id}-c`} className="ap-subtitulo al-cond">{tv.contas}</h5>
        {c.contas.length === 0 ? <p className="ap-vazio">{tv.contasVazio}</p> : (
          <ol className="ap-contas-lista">
            {c.contas.map((k) => (
              <li key={k.id}>
                <time className="ap-dia al-cond" dateTime={k.dia}>{dataCurta(k.dia, lang)}</time>
                <p>
                  {k.texto}
                  {k.link ? <a className="ap-nota-link" href={k.link} target="_blank" rel="noopener noreferrer nofollow">{tv.verMais}</a> : null}
                </p>
                {k.possoRetirar && cuido ? (
                  <Botao tamanho="p" variante="fantasma" disabled={ocupado} onClick={async () => (await confirmar(tv.retirarConfirma)) && void fazer(() => cli.retirarConta(handle, k.id))}>{tv.retirar}</Botao>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {cuido ? (
        <>
          <Ajustar c={c} t={t} handle={handle} selo={selo} ocupado={ocupado} fazer={fazer} />
          <NovaConta c={c} t={t} handle={handle} ocupado={ocupado} fazer={fazer} />
        </>
      ) : null}
      <Denunciar c={c} t={t} cuido={cuido} />
    </div>
  );
}

function Ajustar({ c, t, handle, selo, ocupado, fazer }: { c: CaixaComVaquinha; t: TextosDoApoio; handle: string; selo: boolean; ocupado: boolean; fazer: Fazer }) {
  const tv = t.vaquinha;
  const id = useId();
  const cli = clienteDoApoio();
  const [f, setF] = useState({ meta: reais(c.meta), arrecadado: reais(c.arrecadado), pix: c.pix ?? "", link: c.link ?? "" });
  const [ruim, setRuim] = useState<"meta" | "arrecadado" | null>(null);
  const centavos = (s: string) => (s.trim() ? centavosDe(s) : null);
  return (
    <details className="b1-novo">
      <summary>{tv.ajustar}</summary>
      <form className="b1-form" noValidate onSubmit={(e) => {
        e.preventDefault();
        const meta = centavos(f.meta);
        const arr = centavos(f.arrecadado);
        if (f.meta.trim() && (meta === null || meta < L.metaCaixaMin)) return setRuim("meta");
        if (f.arrecadado.trim() && arr === null) return setRuim("arrecadado");
        setRuim(null);
        void fazer(() => cli.ajustar(handle, c.id, {
          meta: meta === null ? null : String(meta), arrecadado: arr === null ? null : String(arr),
          ...(selo ? { pix: f.pix.trim(), link: f.link.trim() } : {}),
        }));
      }}>
        <label><span>{tv.metaCampo}</span>
          <input className="al-entrada" inputMode="decimal" value={f.meta} aria-invalid={ruim === "meta" || undefined} aria-describedby={`${id}-m`} onChange={(e) => setF({ ...f, meta: e.target.value })} />
          <small id={`${id}-m`} className={ruim === "meta" ? "b1-problema" : undefined}>{ruim === "meta" ? tv.valorInvalido : ""}</small>
        </label>
        <label><span>{tv.arrecadadoCampo}</span>
          <input className="al-entrada" inputMode="decimal" value={f.arrecadado} aria-invalid={ruim === "arrecadado" || undefined} aria-describedby={`${id}-a`} onChange={(e) => setF({ ...f, arrecadado: e.target.value })} />
          <small id={`${id}-a`} className={ruim === "arrecadado" ? "b1-problema" : undefined}>{ruim === "arrecadado" ? tv.valorInvalido : ""}</small>
        </label>
        {selo ? (
          <>
            <label><span>{tv.pix}</span><input className="al-entrada" maxLength={L.pixMax} value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} /></label>
            <label><span>{tv.link}</span><input className="al-entrada" type="url" pattern="https://.+" maxLength={L.linkMax} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
          </>
        ) : <p className="ap-informado">{tv.soComSelo}</p>}
        <Botao type="submit" disabled={ocupado}>{tv.salvar}</Botao>
      </form>
    </details>
  );
}

function NovaConta({ c, t, handle, ocupado, fazer }: { c: CaixaComVaquinha; t: TextosDoApoio; handle: string; ocupado: boolean; fazer: Fazer }) {
  const tv = t.vaquinha;
  const id = useId();
  const cli = clienteDoApoio();
  const hoje = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ dia: hoje, texto: "", link: "" });
  const curto = f.texto.trim().length < L.contaMin;
  return (
    <details className="b1-novo">
      <summary>{tv.novaConta}</summary>
      <form className="b1-form" onSubmit={(e) => {
        e.preventDefault();
        if (curto) return;
        void fazer(() => cli.conta(handle, c.id, { dia: f.dia, texto: f.texto.trim(), ...(f.link.trim() ? { link: f.link.trim() } : {}) })).then(() => setF({ dia: hoje, texto: "", link: "" }));
      }}>
        <label><span>{tv.contaTexto}</span>
          <textarea className="al-entrada" rows={3} minLength={L.contaMin} maxLength={L.contaMax} value={f.texto} aria-describedby={`${id}-a`} onChange={(e) => setF({ ...f, texto: e.target.value })} />
          <small id={`${id}-a`}>{tv.contaAjuda}</small>
        </label>
        <label><span>{tv.contaDia}</span><input className="al-entrada" type="date" max={hoje} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} /></label>
        <label><span>{tv.contaLink}</span><input className="al-entrada" type="url" pattern="https://.+" maxLength={L.linkMax} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
        <Botao type="submit" disabled={ocupado || curto}>{tv.publicar}</Botao>
      </form>
    </details>
  );
}

/** A denúncia de vaquinha falsa: só para quem não cuida do caixa. Vai à fila da mediação; a organização não sabe quem foi. */
function Denunciar({ c, t, cuido }: { c: CaixaComVaquinha; t: TextosDoApoio; cuido: boolean }) {
  const tv = t.vaquinha;
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resposta, setResposta] = useState<{ ok: boolean; frase: string } | null>(null);
  if (cuido) return null;
  if (resposta?.ok) return <p className="ap-informado" role="status">{resposta.frase}</p>;
  if (!aberto) return <p className="ap-denunciar"><Botao tamanho="p" variante="fantasma" onClick={() => setAberto(true)}>{tv.denunciar}</Botao></p>;
  return (
    <form className="b1-form ap-denuncia" onSubmit={async (e) => {
      e.preventDefault();
      setOcupado(true);
      try {
        const r = await clienteDoApoio().denunciar(c.id, texto.trim());
        setResposta({ ok: true, frase: preencherApoio(tv.denunciado, { protocolo: r.protocolo }) });
      } catch (erro) {
        setResposta({ ok: false, frase: fraseDoApoio(t, erro) });
      } finally {
        setOcupado(false);
      }
    }}>
      <p className="ap-informado" id={`${id}-a`}>{tv.denunciarAjuda}</p>
      <label><span>{tv.denunciarTexto}</span>
        <textarea className="al-entrada" rows={2} maxLength={1500} value={texto} aria-describedby={`${id}-a`} onChange={(e) => setTexto(e.target.value)} />
      </label>
      <div className="ap-botoes">
        <Botao type="submit" variante="contorno" disabled={ocupado}>{tv.denunciarMandar}</Botao>
        <Botao variante="fantasma" disabled={ocupado} onClick={() => { setAberto(false); setResposta(null); }}>{tv.cancelar}</Botao>
      </div>
      {resposta && !resposta.ok ? <p className="al-perfil-erro" role="alert">{resposta.frase}</p> : null}
    </form>
  );
}
