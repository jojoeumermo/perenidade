// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Caixa transparente (ALUMIA-FUNCOES-E-IDEIAS §2.1 ideia 8; Onda B item 10): o livro-caixa do núcleo, do ato ou do fundo de greve,
// com a foto da nota, o duplo carimbo CONFERIDO por duas pessoas DIFERENTES da tesouraria e o saldo público num cofre de mosaico.
// Não há pagamento dentro da Alumia (o "como apoiar" é o Pix da organização como texto e/ou um link de fora) e quem doa nunca
// aparece: a descrição recusa CPF, telefone, e-mail e endereço, aqui e de novo no banco.
//
// A foto da nota é refeita no aparelho (canvas): o arquivo novo não leva EXIF (lugar, data, modelo do aparelho), e quem lança
// arrasta sobre o que for dado pessoal para borrar (pixelar) antes de mandar (LGPD art. 6º, III e art. 46). Até 400 KB.
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as EventoDePonteiro } from "react";
import { clienteOrgB1 } from "@/lib/rede/cliente-org-b1";
import { centavosDe, conferirLancamento, dinheiro, TIPOS_DE_CAIXA, type CaixaDaOrg, type CaixasDaOrg, type TipoDeCaixa } from "@/lib/rede/org/b1";
import { dataCurta, linkSeguro } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import { fraseDoErro, useTextosDaOrgB1, type TextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import { Botao } from "../../ui/Botao";
import "./b1.css";

const LIMITE_DA_NOTA = 400_000;

export function CaixaTransparente({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDaOrgB1(lang);
  const id = useId();
  const [dado, setDado] = useState<CaixasDaOrg | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; tipo: TipoDeCaixa; pix: string; link: string }>({ nome: "", tipo: "greve", pix: "", link: "" });

  useEffect(() => {
    let vivo = true;
    clienteOrgB1()
      .caixa(handle)
      .then((r) => vivo && setDado(r))
      .catch((e) => vivo && t && setErro(fraseDoErro(t, e)));
    return () => {
      vivo = false;
    };
  }, [handle, t]);
  if (!t || !dado) return erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null;
  const tc = t.caixa;
  const cli = clienteOrgB1();

  async function fazer(f: () => Promise<CaixasDaOrg>) {
    setOcupado(true);
    setErro("");
    try {
      setDado(await f());
    } catch (e) {
      setErro(fraseDoErro(t!, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="b1-bloco b1-caixas" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="al-cond b1-titulo">{tc.titulo}</h3>
      <p className="al-perfil-nota">{tc.ajuda}</p>
      {dado.caixas.length === 0 ? <p className="al-painel-vazio">{tc.vazio}</p> : dado.caixas.map((c) => (
        <UmCaixa key={c.id} c={c} t={t} lang={lang} tesouraria={dado.tesouraria} gerencio={dado.gerencio} dentro={dado.dentro} ocupado={ocupado} fazer={fazer} />
      ))}
      {dado.tesouraria || dado.gerencio ? (
        <details className="b1-novo">
          <summary>{tc.novo}</summary>
          <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => cli.criarCaixa(handle, { ...novo, nome: novo.nome.trim(), pix: novo.pix.trim(), link: novo.link.trim() })).then(() => setNovo({ nome: "", tipo: "greve", pix: "", link: "" })); }}>
            <label><span>{tc.tipo}</span>
              <select className="al-entrada" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoDeCaixa, nome: novo.nome || tc.tipos[e.target.value as TipoDeCaixa] })}>
                {TIPOS_DE_CAIXA.map((x) => <option key={x} value={x}>{tc.tipos[x]}</option>)}
              </select>
            </label>
            <label><span>{tc.nome}</span><input className="al-entrada" required minLength={3} maxLength={60} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></label>
            <label><span>{tc.pix}</span><input className="al-entrada" maxLength={140} value={novo.pix} onChange={(e) => setNovo({ ...novo, pix: e.target.value })} /></label>
            <label><span>{tc.link}</span><input className="al-entrada" type="url" pattern="https://.+" maxLength={300} value={novo.link} onChange={(e) => setNovo({ ...novo, link: e.target.value })} /></label>
            <Botao type="submit" disabled={ocupado || novo.nome.trim().length < 3}>{tc.abrir}</Botao>
          </form>
        </details>
      ) : null}
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </section>
  );
}

/** O cofre: 20 casas; as douradas são o saldo, as escuras o que já saiu, de tudo o que entrou (conferido). */
function Cofre({ c, t, lang }: { c: CaixaDaOrg; t: TextosDaOrgB1; lang: string }) {
  const casas = 20;
  const saldo = c.entradas > 0 ? Math.max(0, Math.round((c.saldo / c.entradas) * casas)) : 0;
  const rotulo = preencher(t.caixa.cofre, { entradas: dinheiro(c.entradas, lang), saidas: dinheiro(c.saidas, lang) });
  return (
    <div className="b1-cofre">
      <span className="b1-cofre-grade" role="img" aria-label={rotulo}>
        {Array.from({ length: casas }, (_, i) => <span key={i} data-cheia={i < saldo ? "" : undefined} data-usada={c.entradas > 0 && i >= saldo ? "" : undefined} style={{ ["--i" as string]: i }} />)}
      </span>
      <span className="b1-cofre-saldo">
        <small>{t.caixa.saldo}</small>
        <strong className="al-cond">{dinheiro(c.saldo, lang)}</strong>
        <small>{t.caixa.entradas} {dinheiro(c.entradas, lang)} · {t.caixa.saidas} {dinheiro(c.saidas, lang)}</small>
      </span>
    </div>
  );
}

function UmCaixa({ c, t, lang, tesouraria, gerencio, dentro, ocupado, fazer }: { c: CaixaDaOrg; t: TextosDaOrgB1; lang: string; tesouraria: boolean; gerencio: boolean; dentro: boolean; ocupado: boolean; fazer: (f: () => Promise<CaixasDaOrg>) => Promise<void> }) {
  const tc = t.caixa;
  const id = useId();
  const cli = clienteOrgB1();
  const [nota, setNota] = useState<{ id: string; url: string } | null>(null);
  const [form, setForm] = useState({ tipo: "entrada" as "entrada" | "saida", valor: "", descricao: "", dia: new Date().toISOString().slice(0, 10) });
  const [foto, setFoto] = useState<{ base64: string; mime: string } | null>(null);
  const [tocado, setTocado] = useState(false);
  const problemas = conferirLancamento({ descricao: form.descricao, valor: form.valor });
  const link = linkSeguro(c.link);

  async function verNota(l: string) {
    try {
      const r = await cli.nota(l);
      if (r) setNota({ id: l, url: r.url });
    } catch {
      setNota(null);
    }
  }

  return (
    <article className="b1-caixa" aria-labelledby={`${id}-n`}>
      <header className="b1-caixa-topo">
        <h4 id={`${id}-n`} className="b1-subtitulo">{c.nome}</h4>
        <span className="b1-selo-situacao">{tc.tipos[c.tipo]}{c.nucleo ? ` · ${c.nucleo}` : ""}</span>
      </header>
      <Cofre c={c} t={t} lang={lang} />
      {c.esperando ? <p className="al-perfil-nota">{preencher(tc.esperando, { n: c.esperando })}</p> : null}
      {c.pix || link ? (
        <p className="b1-doar">
          <strong>{tc.comoDoar}:</strong>{" "}
          {c.pix ? <span>{tc.pix}: <code>{c.pix}</code></span> : null}
          {link ? <> {" · "}<a href={link} target="_blank" rel="noopener noreferrer nofollow">{tc.link}</a></> : null}
        </p>
      ) : null}
      {c.lancamentos.length > 0 ? (
        <table className="b1-livro">
          {/* O cabeçalho da coluna fica curto ("Descrição"); o aviso entre parênteses ("sem nome de quem doou") desce para a legenda. */}
          <caption className="b1-livro-legenda"><span className="sr-only">{c.nome}. </span>{notaDaDescricao(tc.descricao)}</caption>
          <thead><tr><th scope="col">{tc.dia}</th><th scope="col">{tc.descricao.replace(/\s*[（(].*$/, "")}</th><th scope="col">{tc.valor}</th><th scope="col"><span className="sr-only">{tc.conferido}</span></th></tr></thead>
          <tbody>
            {c.lancamentos.map((l) => (
              <tr key={l.id} data-carimbos={l.carimbos}>
                <td>{dataCurta(l.dia, lang)}</td>
                <td>{l.descricao}</td>
                <td className="b1-valor" data-tipo={l.tipo}>{l.tipo === "saida" ? "−" : "+"}{dinheiro(l.centavos, lang)}<span className="sr-only"> ({tc[l.tipo]})</span></td>
                <td className="b1-carimbos-caixa">
                  {l.carimbos === 2 ? <span className="b1-conferido" title={l.conferidoEm ? dataCurta(l.conferidoEm, lang) : undefined}>{tc.conferido}</span> : <span className="b1-meio">{l.carimbos === 1 ? tc.umCarimbo : tc.semCarimbo}</span>}
                  {l.possoConferir && tesouraria ? <Botao tamanho="p" variante="dourado" disabled={ocupado} onClick={() => void fazer(() => cli.conferir(l.id))}>{tc.conferir}</Botao> : null}
                  {l.nota && dentro ? <Botao tamanho="p" variante="fantasma" onClick={() => void verNota(l.id)}>{tc.verNota}</Botao> : null}
                  {l.carimbos < 2 && (l.meu || gerencio) ? <Botao tamanho="p" variante="fantasma" disabled={ocupado} onClick={() => window.confirm(tc.retirarConfirma) && void fazer(() => cli.retirarLancamento(l.id))}>{tc.retirar}</Botao> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {nota ? (
        <figure className="b1-nota">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL vinda do banco; sem otimização de imagem */}
          <img src={nota.url} alt={tc.nota} />
          <Botao tamanho="p" variante="contorno" onClick={() => setNota(null)}>{tc.fecharNota}</Botao>
        </figure>
      ) : null}
      {tesouraria ? (
        <details className="b1-novo">
          <summary>{tc.lancar}</summary>
          <form className="b1-form" noValidate onSubmit={(e) => {
            e.preventDefault();
            setTocado(true);
            if (problemas.descricao || problemas.valor) return;
            void fazer(() => cli.lancar(c.id, { tipo: form.tipo, centavos: String(centavosDe(form.valor)), descricao: form.descricao.trim(), dia: form.dia, ...(foto ? { nota: foto.base64, mime: foto.mime } : {}) })).then(() => {
              setForm({ ...form, valor: "", descricao: "" });
              setFoto(null);
              setTocado(false);
            });
          }}>
            <fieldset className="b1-marcar b1-marcar-linha">
              <legend>{tc.tipo}</legend>
              {(["entrada", "saida"] as const).map((x) => (
                <label key={x} className="al-marcar"><input type="radio" name={`${id}-tipo`} checked={form.tipo === x} onChange={() => setForm({ ...form, tipo: x })} /><span>{tc[x]}</span></label>
              ))}
            </fieldset>
            <label><span>{tc.valor}</span>
              <input className="al-entrada" inputMode="decimal" value={form.valor} aria-invalid={tocado && !!problemas.valor} aria-describedby={`${id}-pv`} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              <small id={`${id}-pv`} className={tocado && problemas.valor ? "b1-problema" : undefined}>{tocado && problemas.valor ? tc.problemas.numero : ""}</small>
            </label>
            <label><span>{tc.descricao}</span>
              <input className="al-entrada" maxLength={140} value={form.descricao} aria-invalid={tocado && !!problemas.descricao} aria-describedby={`${id}-pd`} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              <small id={`${id}-pd`} className={tocado && problemas.descricao ? "b1-problema" : undefined}>{tocado && problemas.descricao ? tc.problemas[problemas.descricao] : ""}</small>
            </label>
            <label><span>{tc.dia}</span><input className="al-entrada" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dia} onChange={(e) => setForm({ ...form, dia: e.target.value })} /></label>
            <FotoDaNota t={t} aoPronta={setFoto} />
            <Botao type="submit" disabled={ocupado}>{tc.mandar}</Botao>
          </form>
        </details>
      ) : null}
    </article>
  );
}

interface Retangulo { x: number; y: number; w: number; h: number }

/**
 * A foto da nota: escolhida ou tirada, desenhada num canvas (o que joga fora o EXIF), com borrões que a pessoa arrasta por cima do
 * que for dado pessoal. Teclado: as setas movem um borrão novo de 10 % e Enter o fixa (para quem não usa ponteiro).
 */
function FotoDaNota({ t, aoPronta }: { t: TextosDaOrgB1; aoPronta: (f: { base64: string; mime: string } | null) => void }) {
  const tc = t.caixa;
  const id = useId();
  const tela = useRef<HTMLCanvasElement>(null);
  const [imagem, setImagem] = useState<ImageBitmap | null>(null);
  const [borroes, setBorroes] = useState<Retangulo[]>([]);
  const [arrasto, setArrasto] = useState<Retangulo | null>(null);
  const [cursor, setCursor] = useState<Retangulo>({ x: 0.1, y: 0.1, w: 0.3, h: 0.08 });
  const [erro, setErro] = useState("");

  const desenhar = useCallback(() => {
    const cv = tela.current;
    if (!cv || !imagem) return;
    const escala = Math.min(1, 1200 / Math.max(imagem.width, imagem.height));
    cv.width = Math.round(imagem.width * escala);
    cv.height = Math.round(imagem.height * escala);
    const g = cv.getContext("2d");
    if (!g) return;
    g.drawImage(imagem, 0, 0, cv.width, cv.height);
    for (const r of [...borroes, ...(arrasto ? [arrasto] : [])]) pixelar(g, r, cv.width, cv.height);
  }, [imagem, borroes, arrasto]);
  useEffect(desenhar, [desenhar]);

  // Exporta (sem EXIF: o arquivo nasce do canvas) sempre que a foto ou os borrões mudam.
  useEffect(() => {
    const cv = tela.current;
    if (!cv || !imagem || arrasto) return;
    let vivo = true;
    (async () => {
      for (const [mime, q] of [["image/webp", 0.8], ["image/webp", 0.6], ["image/jpeg", 0.7], ["image/jpeg", 0.5]] as const) {
        const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, mime, q));
        if (blob && blob.type === mime && blob.size <= LIMITE_DA_NOTA) {
          const b64 = await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1] ?? ""); f.readAsDataURL(blob); });
          if (vivo) { aoPronta({ base64: b64, mime }); setErro(""); }
          return;
        }
      }
      if (vivo) { aoPronta(null); setErro(tc.fotoGrande); }
    })();
    return () => {
      vivo = false;
    };
  }, [imagem, borroes, arrasto, aoPronta, tc.fotoGrande]);

  const ponto = (e: EventoDePonteiro<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  return (
    <div className="b1-foto">
      <label><span>{tc.foto}</span>
        <input type="file" accept="image/*" capture="environment" aria-describedby={`${id}-a`} onChange={async (e) => {
          const arq = e.target.files?.[0];
          setBorroes([]);
          if (!arq) { setImagem(null); aoPronta(null); return; }
          try {
            setImagem(await createImageBitmap(arq, { imageOrientation: "from-image" }));
          } catch {
            setErro(t.erros.falha);
          }
        }} />
      </label>
      <small id={`${id}-a`}>{tc.fotoAjuda}</small>
      {imagem ? (
        <>
          <canvas
            ref={tela}
            className="b1-foto-tela"
            tabIndex={0}
            role="img"
            aria-label={tc.borrar}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = ponto(e); setArrasto({ x: p.x, y: p.y, w: 0, h: 0 }); }}
            onPointerMove={(e) => { if (!arrasto) return; const p = ponto(e); setArrasto({ ...arrasto, w: p.x - arrasto.x, h: p.y - arrasto.y }); }}
            onPointerUp={() => { if (arrasto && Math.abs(arrasto.w) > 0.01 && Math.abs(arrasto.h) > 0.01) setBorroes((b) => [...b, normal(arrasto)]); setArrasto(null); }}
            onKeyDown={(e) => {
              const d = 0.05;
              const mov: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
              if (mov[e.key]) { e.preventDefault(); setCursor((c) => ({ ...c, x: clamp(c.x + mov[e.key][0], 0, 1 - c.w), y: clamp(c.y + mov[e.key][1], 0, 1 - c.h) })); setArrasto({ ...cursor }); }
              if (e.key === "Enter") { e.preventDefault(); setBorroes((b) => [...b, cursor]); setArrasto(null); }
            }}
          />
          <Botao tamanho="p" variante="fantasma" disabled={borroes.length === 0} onClick={() => setBorroes((b) => b.slice(0, -1))}>{tc.desfazer}</Botao>
        </>
      ) : null}
      {erro ? <small className="b1-problema" role="alert">{erro}</small> : null}
    </div>
  );
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const normal = (r: Retangulo): Retangulo => ({ x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) });

/** Pixela (blocos de 12 px) o retângulo: não dá para "desborrar" como um desfoque leve. */
function pixelar(g: CanvasRenderingContext2D, r0: Retangulo, W: number, H: number) {
  const r = normal(r0);
  const x = Math.floor(r.x * W), y = Math.floor(r.y * H), w = Math.ceil(r.w * W), h = Math.ceil(r.h * H);
  if (w < 2 || h < 2) return;
  const bloco = 12;
  const dados = g.getImageData(x, y, w, h);
  for (let by = 0; by < h; by += bloco) for (let bx = 0; bx < w; bx += bloco) {
    const i = (by * w + bx) * 4;
    g.fillStyle = `rgb(${dados.data[i]},${dados.data[i + 1]},${dados.data[i + 2]})`;
    g.fillRect(x + bx, y + by, Math.min(bloco, w - bx), Math.min(bloco, h - by));
  }
}

/** O aviso entre parênteses do rótulo da descrição ("sem nome de quem doou"), para a legenda da tabela; sem parênteses, nada. */
function notaDaDescricao(rotulo: string): string {
  return /[（(]\s*(.+?)\s*[)）]\s*$/.exec(rotulo)?.[1] ?? "";
}
