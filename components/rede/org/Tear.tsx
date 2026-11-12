// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Onda A da F4 na página da organização (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideias 6 e 10):
//  - Tear de encaminhamentos: cada deliberação vira um fio com uma FUNÇÃO responsável (nunca uma pessoa), prazo e estado. Cumprido,
//    a agulha tece o fio na faixa; vencido, o fio fica solto e balança. O público vê o texto e o agregado ("decidimos 12, cumprimos
//    9", só a partir de 3); a função e o prazo, só quem é de dentro (o banco decide: rede_org_tear).
//  - Acenda um lampião: fundar um núcleo em 5 passos (nome e cidade escrita, pauta, cartaz, convite, primeira tarefa), com o
//    lampião que acende no fim. Sem GPS; o encontro é em ponto público.
import { useEffect, useId, useRef, useState } from "react";
import { chamar } from "@/lib/rede/cliente";
import { bancoSemAFuncao } from "@/lib/rede/cliente-org";
import { dataCurta } from "@/lib/rede/org/contagem";
import { previaLigada } from "@/lib/rede/org/exemplos";
import { preencher } from "@/lib/rede/preencher";
import { linkDoConvite, UFS, type ConviteDoLampiao, type PedidoDeLampiao } from "@/lib/rede/org/b1";
import { useTextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import type { ConsultaDaOrg } from "@/lib/rede/tipos-org";
import { textoDoErro } from "../erros";
import { useTextosDoPerfilLivre } from "../perfil/livre/textos";
import { Lampiao } from "../ui/Lampiao";
import type { TextosDaRede } from "@/lib/rede/textos";
import "./tear.css";

const erroDe = (s: TextosDaRede | undefined, e: unknown): string => (s ? textoDoErro(s, e) : e instanceof Error ? e.message : String(e));

export interface FioDoTear {
  id: string;
  texto: string;
  estado: "aberto" | "cumprido" | "retirado";
  criado: string;
  funcao: string | null;
  prazo: string | null;
  vencido: boolean;
  cumprido: string | null;
  /** De onde o fio nasceu: à mão, de uma consulta fechada ou de uma ata (B1). */
  origem?: "mao" | "consulta" | "ata";
}

export interface TearDaOrg {
  decididos: number;
  cumpridos: number;
  dentro: boolean;
  gerencio: boolean;
  fios: FioDoTear[];
  /** Quantos fios abertos passaram do prazo (B1; a função responsável recebe um aviso). */
  vencidos?: number;
  /** As funções de verdade da organização (só para quem é de dentro; B1). */
  funcoes?: { id: string; nome: string }[] | null;
}

function tearDeExemplo(): TearDaOrg {
  const dia = (d: number) => new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10);
  return {
    decididos: 12,
    cumpridos: 9,
    dentro: true,
    gerencio: true,
    fios: [
      { id: "f1", texto: "Levar a pauta da tarifa zero à audiência pública", estado: "aberto", criado: dia(-6), funcao: "comunicação", prazo: dia(5), vencido: false, cumprido: null },
      { id: "f2", texto: "Prestar contas da rifa do fundo de greve", estado: "aberto", criado: dia(-12), funcao: "tesouraria", prazo: dia(-2), vencido: true, cumprido: null },
      { id: "f3", texto: "Imprimir 500 panfletos para o ato de sábado", estado: "cumprido", criado: dia(-10), funcao: "secretaria", prazo: dia(-4), vencido: false, cumprido: dia(-5) },
      { id: "f4", texto: "Abrir o núcleo da Cohab 2", estado: "cumprido", criado: dia(-20), funcao: "formação", prazo: dia(-8), vencido: false, cumprido: dia(-9) },
    ],
  };
}

/** Um fio novo, só na prévia (o de verdade nasce no banco). */
function fioDaPrevia(p: Record<string, unknown>): FioDoTear {
  return { id: `f${Date.now()}`, texto: String(p.texto), estado: "aberto", criado: new Date().toISOString().slice(0, 10), funcao: String(p.funcao), prazo: String(p.prazo), vencido: false, cumprido: null };
}

async function lerTear(handle: string): Promise<TearDaOrg | null> {
  if (previaLigada()) return tearDeExemplo();
  try {
    return await chamar<TearDaOrg | null>("rede_org_tear", { p_handle: handle });
  } catch (e) {
    if (bancoSemAFuncao(e)) return null;
    throw e;
  }
}

export function TearDeEncaminhamentos({ handle, lang, s, consultas = [] }: { handle: string; lang: string; s?: TextosDaRede; consultas?: (ConsultaDaOrg & { eleicao?: boolean; virouFio?: boolean })[] }) {
  const t = useTextosDoPerfilLivre(lang);
  const tb = useTextosDaOrgB1(lang);
  const id = useId();
  const [tear, setTear] = useState<TearDaOrg | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState({ texto: "", funcao: "", funcaoId: "", consulta: "", prazo: "" });
  const [tecido, setTecido] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerTear(handle)
      .then((x) => vivo && setTear(x))
      .catch((e) => vivo && setErro(erroDe(s, e)));
    return () => {
      vivo = false;
    };
  }, [handle, s]);

  if (!t || !tb || !tear) return erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null;
  const tt = t.org.tear;

  async function mexer(p: Record<string, unknown>, aoFim?: (r: TearDaOrg) => void) {
    setOcupado(true);
    setErro("");
    try {
      let r: TearDaOrg;
      if (previaLigada()) {
        const atual = tear!;
        if (p.id) {
          const fios = atual.fios.map((f) => (f.id === p.id ? { ...f, estado: p.estado as FioDoTear["estado"], vencido: false, cumprido: p.estado === "cumprido" ? new Date().toISOString().slice(0, 10) : null } : f)).filter((f) => f.estado !== "retirado");
          r = { ...atual, fios, cumpridos: fios.filter((f) => f.estado === "cumprido").length + 7, decididos: fios.length + 8 };
        } else {
          const f = fioDaPrevia(p);
          r = { ...atual, fios: [f, ...atual.fios], decididos: atual.decididos + 1 };
        }
      } else {
        r = await chamar<TearDaOrg>("rede_org_tear_fio", { p_handle: handle, p });
      }
      setTear(r);
      aoFim?.(r);
    } catch (e) {
      setErro(erroDe(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const proporcao = tear.decididos > 0 ? tear.cumpridos / tear.decididos : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const fechadas = consultas.filter((c) => c.situacao === "fechada" && !c.eleicao && !c.virouFio);
  const funcoes = tear.funcoes ?? [];
  const valido = (novo.texto.trim().length >= 3 || !!novo.consulta) && (novo.funcaoId !== "" || novo.funcao.trim().length >= 2) && novo.prazo >= hoje;

  return (
    <section className="al-perfil-bloco tear" aria-labelledby={`${id}-tear`}>
      <h2 id={`${id}-tear`} className="al-cond">{tt.titulo}</h2>
      {tear.decididos >= 3 ? (
        <div className="tear-placar">
          <p className="tear-agregado">{preencher(tt.agregado, { decididos: tear.decididos, cumpridos: tear.cumpridos })}</p>
          <div aria-hidden className="tear-faixa">
            <span style={{ width: `${Math.round(proporcao * 100)}%` }} />
          </div>
        </div>
      ) : (
        <p className="al-perfil-nota">{tt.poucos}</p>
      )}
      <p className="al-perfil-nota">{tt.ajuda}</p>
      {tear.vencidos ? <p className="tear-vencidos">{preencher(tb.tear.vencidos, { n: tear.vencidos })}</p> : null}
      {!tear.dentro ? <p className="al-perfil-nota">{tt.funcaoSoDentro}</p> : null}
      {tear.fios.length === 0 ? (
        <p className="al-perfil-nota">{tt.vazio}</p>
      ) : (
        <ol className="tear-fios">
          {tear.fios.map((f) => (
            <li key={f.id} className="tear-fio" data-estado={f.vencido ? "vencido" : f.estado} data-tecido={tecido === f.id ? "" : undefined}>
              <span aria-hidden className="tear-linha" />
              <span className="tear-texto">{f.texto}</span>
              <span className="tear-meta">
                <span className="tear-selo">{f.estado === "cumprido" ? tt.cumprido : f.vencido ? tt.vencido : tt.aberto}</span>
                {f.funcao ? <span>{tt.funcao}: <strong>{f.funcao}</strong></span> : null}
                {f.prazo ? <span>{tt.prazo}: {dataCurta(f.prazo, lang)}</span> : null}
                {f.origem ? <span className="tear-origem" data-origem={f.origem}>{f.origem === "ata" ? tb.tear.daAta : f.origem === "consulta" ? tb.tear.daConsulta : tb.tear.aMao}</span> : null}
              </span>
              {tear.gerencio ? (
                <span className="tear-acoes">
                  {f.estado === "aberto" ? (
                    <button type="button" className="al-botao al-botao-claro al-botao-p" disabled={ocupado} onClick={() => void mexer({ id: f.id, estado: "cumprido" }, () => setTecido(f.id))}>
                      {tt.cumprir}
                    </button>
                  ) : (
                    <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={ocupado} onClick={() => void mexer({ id: f.id, estado: "aberto" })}>
                      {tt.reabrir}
                    </button>
                  )}
                  <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => void mexer({ id: f.id, estado: "retirado" })}>
                    {tt.retirar}
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {tear.gerencio ? (
        <details className="tear-novo">
          <summary>{tt.novo}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!valido) return;
              void mexer({ texto: novo.texto.trim(), funcao: novo.funcao.trim(), prazo: novo.prazo, ...(novo.funcaoId ? { funcaoId: novo.funcaoId } : {}), ...(novo.consulta ? { consulta: novo.consulta } : {}) }, () => setNovo({ texto: "", funcao: "", funcaoId: "", consulta: "", prazo: "" }));
            }}
          >
            {fechadas.length > 0 ? (
              <label>
                <span>{tb.tear.consulta}</span>
                <select value={novo.consulta} onChange={(e) => setNovo((n) => ({ ...n, consulta: e.target.value }))}>
                  <option value="">{tb.tear.nenhuma}</option>
                  {fechadas.map((c) => <option key={c.id} value={c.id}>{c.pergunta}</option>)}
                </select>
              </label>
            ) : null}
            <label>
              <span>{tt.texto}</span>
              <input type="text" value={novo.texto} maxLength={200} onChange={(e) => setNovo((n) => ({ ...n, texto: e.target.value }))} />
            </label>
            {funcoes.length > 0 ? (
              <label>
                <span>{tb.tear.funcao}</span>
                <select value={novo.funcaoId} onChange={(e) => setNovo((n) => ({ ...n, funcaoId: e.target.value }))}>
                  <option value="">{tb.tear.outraFuncao}</option>
                  {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </label>
            ) : null}
            {novo.funcaoId === "" ? (
              <label>
                <span>{tt.funcao}</span>
                <input type="text" value={novo.funcao} maxLength={40} aria-describedby={`${id}-funcao`} onChange={(e) => setNovo((n) => ({ ...n, funcao: e.target.value }))} />
                <small id={`${id}-funcao`}>{tt.funcaoAjuda}</small>
              </label>
            ) : null}
            <label>
              <span>{tt.prazo}</span>
              <input type="date" value={novo.prazo} min={hoje} onChange={(e) => setNovo((n) => ({ ...n, prazo: e.target.value }))} />
            </label>
            <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={!valido || ocupado}>
              {tt.tecer}
            </button>
          </form>
        </details>
      ) : null}
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </section>
  );
}


/** "Do decidido ao feito" ao lado do "Como votamos": o placar do Tear (a partir de 3 deliberações) e quantos passaram do prazo. */
export function PlacarDoTear({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDoPerfilLivre(lang);
  const tb = useTextosDaOrgB1(lang);
  const [tear, setTear] = useState<TearDaOrg | null>(null);
  useEffect(() => {
    let vivo = true;
    lerTear(handle).then((x) => vivo && setTear(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [handle]);
  if (!t || !tb || !tear) return null;
  const proporcao = tear.decididos > 0 ? tear.cumpridos / tear.decididos : 0;
  return (
    <section className="tear tear-placar-contas" aria-label={tb.tear.contas}>
      <h3 className="al-cond">{tb.tear.contas}</h3>
      <p className="al-perfil-nota">{tb.tear.contasAjuda}</p>
      {tear.decididos >= 3 ? (
        <div className="tear-placar">
          <p className="tear-agregado">{preencher(t.org.tear.agregado, { decididos: tear.decididos, cumpridos: tear.cumpridos })}</p>
          <div aria-hidden className="tear-faixa"><span style={{ width: `${Math.round(proporcao * 100)}%` }} /></div>
          {tear.vencidos ? <p className="tear-vencidos">{preencher(tb.tear.vencidos, { n: tear.vencidos })}</p> : null}
        </div>
      ) : (
        <p className="al-perfil-nota">{t.org.tear.poucos}</p>
      )}
    </section>
  );
}

// ───────────────────────────── Acenda um lampião ─────────────────────────────

const PASSOS_DO_LAMPIAO = 5;

/**
 * Fundar um núcleo em 5 passos, e tudo é guardado: nome e cidade ESCRITA (e o estado, opcional), pauta da 1ª reunião, o cartaz
 * (e se o núcleo entra no mapa: padrão NÃO), o convite com validade e limite de usos (só o hash fica no banco; o código aparece
 * uma vez, aqui) e a primeira tarefa. No fim, o cartaz com o QR do convite, para imprimir. O lampião nasce em brasa e ganha chama
 * plena com a 3ª pessoa além de quem fundou (o banco calcula, com atraso de até 15 minutos; nunca o número, nem 1 ou 2).
 */
export function AcendaUmLampiao({ lang, handle, criar, s }: { lang: string; handle: string; criar: (p: PedidoDeLampiao) => Promise<{ id: string; convite: ConviteDoLampiao | null }>; s?: TextosDaRede }) {
  const t = useTextosDoPerfilLivre(lang);
  const tb = useTextosDaOrgB1(lang);
  const id = useId();
  const [passo, setPasso] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [d, setD] = useState({ nome: "", cidade: "", uf: "", quando: "", onde: "", pauta: "", tarefa: "", cor: 1 as PedidoDeLampiao["cor"], mapa: false, dias: "7", usos: "10" });
  const [aceso, setAceso] = useState<{ convite: ConviteDoLampiao | null } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cartaz = useRef<HTMLDivElement>(null);
  const link = aceso?.convite && typeof window !== "undefined" ? linkDoConvite(window.location.origin, lang, handle, aceso.convite.codigo) : null;

  useEffect(() => {
    if (!link) return;
    let vivo = true;
    import("qrcode")
      .then((q) => q.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#0f0e0d", light: "#ffffff" } }))
      .then((u) => vivo && setQr(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [link]);

  if (!t || !tb) return null;
  const tl = t.org.lampiao;
  const tn = tb.lampiao;
  const passos = tl.passos;
  const pauta = d.pauta || tl.pautaModelo;
  const tarefa = d.tarefa || tl.tarefaModelo;
  const dias = Number(d.dias), usos = Number(d.usos);
  const pode = [
    d.nome.trim().length >= 3 && d.cidade.trim().length >= 2,
    d.quando.trim().length >= 2 && d.onde.trim().length >= 2,
    true,
    Number.isInteger(dias) && dias >= 1 && dias <= 30 && Number.isInteger(usos) && usos >= 1 && usos <= 200,
    tarefa.trim().length >= 3,
  ][passo];

  async function acender() {
    setOcupado(true);
    setErro("");
    try {
      const r = await criar({
        nome: d.nome.trim(), quando: d.quando.trim(), onde: `${d.onde.trim()} · ${d.cidade.trim()}`.slice(0, 80), cor: d.cor,
        pauta: pauta.trim(), tarefa: tarefa.trim(), cidade: d.cidade.trim(), uf: d.uf || null, mapa: d.mapa, convite: { dias, usos },
      });
      setAceso({ convite: r.convite });
    } catch (e) {
      setErro(erroDe(s, e));
    } finally {
      setOcupado(false);
    }
  }

  const Cartaz = (
    <div ref={cartaz} className="lampiao-cartaz" style={{ ["--c" as string]: `var(--al-com-${d.cor})` }}>
      <strong className="al-cond">{d.nome || "—"}</strong>
      <span>{d.quando} · {d.onde}</span>
      <span>{d.cidade}{d.uf ? ` · ${d.uf}` : ""}</span>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- QR gerado no aparelho, em data URL
        <img src={qr} alt={tn.qr} width={180} height={180} className="lampiao-qr" />
      ) : null}
      {aceso?.convite ? <small>{preencher(tn.validade, { data: dataCurta(aceso.convite.validade, lang), n: aceso.convite.usos })}</small> : <p className="al-perfil-nota">{tl.cartaz}</p>}
    </div>
  );

  return (
    <section className="al-perfil-bloco lampiao" aria-labelledby={`${id}-lampiao`} data-aceso={aceso ? "" : undefined}>
      <div className="lampiao-topo">
        <span className="lampiao-luz" aria-hidden>
          <Lampiao tamanho={40} />
        </span>
        <div>
          <h2 id={`${id}-lampiao`} className="al-cond">{tl.titulo}</h2>
          <p className="al-perfil-nota">{tl.ajuda}</p>
        </div>
      </div>
      {aceso ? (
        <div className="lampiao-pronto">
          <p className="lampiao-aceso" role="status">{tl.aceso}</p>
          {Cartaz}
          {link ? (
            <div className="b1-botoes">
              <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopiado(true)).catch(() => setCopiado(false))}>
                {tn.copiar}
              </button>
              <button type="button" className="al-botao al-botao-dourado al-botao-m" onClick={() => imprimirCartaz(cartaz.current)}>
                {tn.imprimir}
              </button>
            </div>
          ) : null}
          <p className="sr-only" role="status">{copiado ? tn.copiado : ""}</p>
          {aceso.convite ? <p className="al-perfil-nota">{tn.conviteAjuda}</p> : null}
        </div>
      ) : !aberto ? (
        <button type="button" className="al-botao al-botao-dourado al-botao-m" onClick={() => setAberto(true)}>
          {tl.titulo}
        </button>
      ) : (
        <form
          className="lampiao-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pode) return;
            if (passo < PASSOS_DO_LAMPIAO - 1) setPasso(passo + 1);
            else void acender();
          }}
        >
          <ol className="lampiao-passos" aria-label={preencher(tl.passo, { n: passo + 1 })}>
            {passos.map((p, i) => (
              <li key={p} aria-current={i === passo ? "step" : undefined} data-feito={i < passo ? "" : undefined}>
                <span aria-hidden>{i + 1}</span>
                <span className="sr-only">{p}</span>
              </li>
            ))}
          </ol>
          <p className="lampiao-passo-nome" aria-live="polite">
            {preencher(tl.passo, { n: passo + 1 })} · <strong>{passos[passo]}</strong>
          </p>
          <div key={passo} className="lampiao-corpo">
            {passo === 0 ? (
              <>
                <label><span>{tl.nome}</span><input type="text" value={d.nome} maxLength={60} onChange={(e) => setD({ ...d, nome: e.target.value })} /></label>
                <label><span>{tl.cidade}</span><input type="text" value={d.cidade} maxLength={40} onChange={(e) => setD({ ...d, cidade: e.target.value })} /></label>
                <label><span>{tn.uf}</span>
                  <select value={d.uf} onChange={(e) => setD({ ...d, uf: e.target.value })}>
                    <option value="">{tn.ufNenhum}</option>
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <fieldset className="lampiao-cores">
                  <legend>{tl.cor}</legend>
                  {([1, 2, 3, 4, 5] as const).map((c) => (
                    <label key={c} style={{ ["--c" as string]: `var(--al-com-${c})` }}>
                      <input type="radio" name={`${id}-cor`} checked={d.cor === c} onChange={() => setD({ ...d, cor: c })} />
                      <span className="sr-only">{c}</span>
                    </label>
                  ))}
                </fieldset>
              </>
            ) : passo === 1 ? (
              <>
                <label><span>{tl.quando}</span><input type="text" value={d.quando} maxLength={40} onChange={(e) => setD({ ...d, quando: e.target.value })} /></label>
                <label><span>{tl.onde}</span><input type="text" value={d.onde} maxLength={60} onChange={(e) => setD({ ...d, onde: e.target.value })} /></label>
                <label><span>{tn.pauta}</span><textarea rows={4} value={pauta} maxLength={600} onChange={(e) => setD({ ...d, pauta: e.target.value })} /></label>
              </>
            ) : passo === 2 ? (
              <>
                {Cartaz}
                <label className="lampiao-marcar">
                  <input type="checkbox" checked={d.mapa} onChange={(e) => setD({ ...d, mapa: e.target.checked })} aria-describedby={`${id}-mapa`} />
                  <span>{tn.mapa}</span>
                </label>
                <small id={`${id}-mapa`}>{tn.mapaAjuda}</small>
              </>
            ) : passo === 3 ? (
              <>
                <label><span>{tn.conviteDias}</span><input type="number" min={1} max={30} value={d.dias} onChange={(e) => setD({ ...d, dias: e.target.value })} /></label>
                <label><span>{tn.conviteUsos}</span><input type="number" min={1} max={200} value={d.usos} onChange={(e) => setD({ ...d, usos: e.target.value })} /></label>
                <small>{tn.conviteAjuda}</small>
              </>
            ) : (
              <label><span>{tn.tarefa}</span><textarea rows={2} value={tarefa} maxLength={200} onChange={(e) => setD({ ...d, tarefa: e.target.value })} /></label>
            )}
          </div>
          <div className="lampiao-botoes">
            {passo > 0 ? (
              <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setPasso(passo - 1)}>
                {tl.voltar}
              </button>
            ) : null}
            <button type="submit" className={`al-botao al-botao-m ${passo === PASSOS_DO_LAMPIAO - 1 ? "al-botao-dourado" : "al-botao-primario"}`} disabled={!pode || ocupado}>
              {passo === PASSOS_DO_LAMPIAO - 1 ? tl.acender : tl.seguir}
            </button>
          </div>
          {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
        </form>
      )}
    </section>
  );
}

/** Imprime só o cartaz (com o QR), numa folha limpa. */
function imprimirCartaz(no: HTMLElement | null) {
  if (!no) return;
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cartaz</title><style>body{margin:2cm;font:18px/1.4 system-ui,sans-serif;color:#000}.c{display:grid;gap:10px;justify-items:start;border-top:14px solid #000;padding-top:16px}strong{font-size:48px;line-height:1}img{width:7cm;height:7cm}</style></head><body><div class="c">${no.innerHTML}</div></body></html>`);
  doc.close();
  quadro.contentWindow?.focus();
  quadro.contentWindow?.print();
  setTimeout(() => quadro.remove(), 60_000);
}
