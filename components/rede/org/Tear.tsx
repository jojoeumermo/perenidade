// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Onda A da F4 na página da organização (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideias 6 e 10):
//  - Tear de encaminhamentos: cada deliberação vira um fio com uma FUNÇÃO responsável (nunca uma pessoa), prazo e estado. Cumprido,
//    a agulha tece o fio na faixa; vencido, o fio fica solto e balança. O público vê o texto e o agregado ("decidimos 12, cumprimos
//    9", só a partir de 3); a função e o prazo, só quem é de dentro (o banco decide: rede_org_tear).
//  - Acenda um lampião: fundar um núcleo em 5 passos (nome e cidade escrita, pauta, cartaz, convite, primeira tarefa), com o
//    lampião que acende no fim. Sem GPS; o encontro é em ponto público.
import { useEffect, useId, useState } from "react";
import { chamar } from "@/lib/rede/cliente";
import { bancoSemAFuncao } from "@/lib/rede/cliente-org";
import { dataCurta } from "@/lib/rede/org/contagem";
import { previaLigada } from "@/lib/rede/org/exemplos";
import { preencher } from "@/lib/rede/preencher";
import type { PedidoDeNucleo } from "@/lib/rede/tipos-org";
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
}

export interface TearDaOrg {
  decididos: number;
  cumpridos: number;
  dentro: boolean;
  gerencio: boolean;
  fios: FioDoTear[];
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

export function TearDeEncaminhamentos({ handle, lang, s }: { handle: string; lang: string; s?: TextosDaRede }) {
  const t = useTextosDoPerfilLivre(lang);
  const id = useId();
  const [tear, setTear] = useState<TearDaOrg | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState({ texto: "", funcao: "", prazo: "" });
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

  if (!t || !tear) return erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null;
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
  const valido = novo.texto.trim().length >= 3 && novo.funcao.trim().length >= 2 && novo.prazo >= hoje;

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
              void mexer({ texto: novo.texto.trim(), funcao: novo.funcao.trim(), prazo: novo.prazo }, () => setNovo({ texto: "", funcao: "", prazo: "" }));
            }}
          >
            <label>
              <span>{tt.texto}</span>
              <input type="text" value={novo.texto} maxLength={200} onChange={(e) => setNovo((n) => ({ ...n, texto: e.target.value }))} />
            </label>
            <label>
              <span>{tt.funcao}</span>
              <input type="text" value={novo.funcao} maxLength={40} aria-describedby={`${id}-funcao`} onChange={(e) => setNovo((n) => ({ ...n, funcao: e.target.value }))} />
              <small id={`${id}-funcao`}>{tt.funcaoAjuda}</small>
            </label>
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

// ───────────────────────────── Acenda um lampião ─────────────────────────────

export function AcendaUmLampiao({ lang, criar, s }: { lang: string; criar: (p: PedidoDeNucleo) => Promise<unknown>; s?: TextosDaRede }) {
  const t = useTextosDoPerfilLivre(lang);
  const id = useId();
  const [passo, setPasso] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [d, setD] = useState({ nome: "", cidade: "", quando: "", onde: "", pauta: "", tarefa: "", cor: 1 as PedidoDeNucleo["cor"] });
  const [aceso, setAceso] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (!t) return null;
  const tl = t.org.lampiao;
  const passos = tl.passos;
  const pode = [d.nome.trim().length >= 3 && d.cidade.trim().length >= 2, d.quando.trim().length >= 2 && d.onde.trim().length >= 2, true, true, true][passo];

  async function acender() {
    setOcupado(true);
    setErro("");
    try {
      if (!previaLigada()) await criar({ nome: d.nome.trim(), quando: d.quando.trim(), onde: `${d.onde.trim()} · ${d.cidade.trim()}`.slice(0, 80), cor: d.cor });
      setAceso(true);
    } catch (e) {
      setErro(erroDe(s, e));
    } finally {
      setOcupado(false);
    }
  }

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
        <p className="lampiao-aceso" role="status">{tl.aceso}</p>
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
            if (passo < 4) setPasso(passo + 1);
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
          <p className="lampiao-passo-nome">
            {preencher(tl.passo, { n: passo + 1 })} · <strong>{passos[passo]}</strong>
          </p>
          <div key={passo} className="lampiao-corpo">
            {passo === 0 ? (
              <>
                <label><span>{tl.nome}</span><input type="text" value={d.nome} maxLength={60} onChange={(e) => setD({ ...d, nome: e.target.value })} /></label>
                <label><span>{tl.cidade}</span><input type="text" value={d.cidade} maxLength={40} onChange={(e) => setD({ ...d, cidade: e.target.value })} /></label>
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
                <label><span>{tl.pauta}</span><textarea rows={4} value={d.pauta || tl.pautaModelo} maxLength={600} onChange={(e) => setD({ ...d, pauta: e.target.value })} /></label>
              </>
            ) : passo === 2 ? (
              <div className="lampiao-cartaz" style={{ ["--c" as string]: `var(--al-com-${d.cor})` }}>
                <strong className="al-cond">{d.nome || "—"}</strong>
                <span>{d.quando} · {d.onde}</span>
                <span>{d.cidade}</span>
                <p className="al-perfil-nota">{tl.cartaz}</p>
              </div>
            ) : passo === 3 ? (
              <p className="al-perfil-nota">{tl.convite}</p>
            ) : (
              <label><span>{tl.tarefa}</span><textarea rows={2} value={d.tarefa || tl.tarefaModelo} maxLength={200} onChange={(e) => setD({ ...d, tarefa: e.target.value })} /></label>
            )}
          </div>
          <div className="lampiao-botoes">
            {passo > 0 ? (
              <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => setPasso(passo - 1)}>
                {tl.voltar}
              </button>
            ) : null}
            <button type="submit" className={`al-botao al-botao-m ${passo === 4 ? "al-botao-dourado" : "al-botao-primario"}`} disabled={!pode || ocupado}>
              {passo === 4 ? tl.acender : tl.seguir}
            </button>
          </div>
          {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
        </form>
      )}
    </section>
  );
}
