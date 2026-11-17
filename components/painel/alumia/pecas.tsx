// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import * as Radix from "@radix-ui/react-dialog";
import { Archivo } from "next/font/google";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useState, useSyncExternalStore } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { Faixa } from "@/components/rede/ui/Faixa";
import { BackendError, rpc } from "@/lib/backend";
import { ERROS_DO_ADMIN } from "@/lib/rede/admin/tipos";
import { ERROS_DO_PAINEL, type PapelNoPainel, type VisaoGeral } from "@/lib/rede/painel/tipos";
import { PAINEL_MUDOU, textoDoErro } from "../comum";
import { notificar } from "../ui";

// A letra das pranchas (a mesma configuração do layout da Alumia: o Next reaproveita o arquivo). Só é baixada quando o painel
// de controle abre.
const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--al-fonte-archivo", preload: false, display: "swap" });
export const classeDasLetras = archivo.variable;

// ───────────── Claro ou escuro, como o painel interno ─────────────

function assinarTema(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const midia = window.matchMedia("(prefers-color-scheme: light)");
  midia.addEventListener("change", avisar);
  return () => {
    observador.disconnect();
    midia.removeEventListener("change", avisar);
  };
}
function lerTemaClaro() {
  const escolhido = document.documentElement.getAttribute("data-theme");
  return escolhido ? escolhido === "light" : window.matchMedia("(prefers-color-scheme: light)").matches;
}

/**
 * O painel de admin segue o tema do painel interno (o escolhido, ou o do sistema): claro vira a variante clara dos tokens da
 * Alumia ([data-al-tema="claro"]); escuro é o padrão das pranchas. Devolve o valor do atributo. O painel de controle antigo
 * continua só escuro (foi desenhado assim); a janela de ação segue o painel em que está, pelo contexto abaixo.
 */
export function useTemaDaAlumia(): "claro" | undefined {
  return useSyncExternalStore(assinarTema, lerTemaClaro, () => false) ? "claro" : undefined;
}

/** O tema da janela de ação: o painel que a abre diz (o de admin passa "claro" no tema claro; o de controle, nada). */
export const TemaDaAlumiaCtx = createContext<"claro" | undefined>(undefined);

// ───────────── O que as telas do painel dividem ─────────────

export type IdDaAba = "geral" | "cadastros" | "pessoas" | "conteudo" | "denuncias" | "papeis" | "comunidades" | "funcoes" | "registro";

export interface ContextoDoPainel {
  papel: PapelNoPainel;
  geral: VisaoGeral | null;
  /** Relê os números do alto e do menu (depois de toda ação). */
  atualizar: () => void;
  /** Troca de aba; "foco" leva um dado para a aba de destino (a conta a abrir em Pessoas, o filtro de Posts…). */
  ir: (aba: IdDaAba, foco?: string) => void;
  /** O dado que a aba anterior mandou, lido uma vez. */
  foco: string | null;
}

export const PainelCtx = createContext<ContextoDoPainel | null>(null);

export function usePainelDaAlumia(): ContextoDoPainel {
  const ctx = useContext(PainelCtx);
  if (!ctx) throw new Error("fora do painel da Alumia");
  return ctx;
}

/** O erro do banco em português de tela: primeiro os do painel da Alumia, depois os comuns do painel interno. */
export function textoDoErroDaAlumia(erro: unknown): string {
  const codigo = erro instanceof BackendError ? erro.code : "";
  if (ERROS_DO_ADMIN[codigo]) return ERROS_DO_ADMIN[codigo];
  if (ERROS_DO_PAINEL[codigo]) return ERROS_DO_PAINEL[codigo];
  if (codigo === "invalido:motivo") return "Escreva o motivo (de 10 a 500 letras).";
  return textoDoErro(erro);
}

/** Lê uma função do painel. Sem cache e sem atualização sozinha: o painel mostra o que o banco disse agora. */
export function useDado<T>(funcao: string | null, argumentos: Record<string, unknown> = {}) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string; chave: string }>({ dados: null, erro: "", chave: "" });
  const [volta, setVolta] = useState(0);
  const chave = `${funcao}:${JSON.stringify(argumentos)}`;
  useEffect(() => {
    if (!funcao) return;
    let cancelado = false;
    rpc<T>(funcao, JSON.parse(chave.slice(funcao.length + 1)) as Record<string, unknown>)
      .then((dados) => {
        if (!cancelado) setEstado({ dados, erro: "", chave });
      })
      .catch((erro: unknown) => {
        // Falhou ao reler: o que já estava na tela continua (com o erro em cima), em vez de a tela inteira sumir.
        if (!cancelado) setEstado((antes) => ({ dados: antes.chave === chave ? antes.dados : null, erro: textoDoErroDaAlumia(erro), chave }));
      });
    return () => {
      cancelado = true;
    };
  }, [funcao, chave, volta]);
  const recarregar = useCallback(() => setVolta((v) => v + 1), []);
  // Enquanto a leitura nova não chega, a anterior continua na tela (sem piscar); "carregando" só é verdadeiro sem nada para mostrar.
  const daqui = estado.chave === chave;
  return { dados: funcao ? estado.dados : null, erro: daqui ? estado.erro : "", carregando: Boolean(funcao) && !estado.dados && !(daqui && estado.erro), velho: !daqui, recarregar };
}

// ───────────── Peças de desenho ─────────────

export function Titulo({ nome, sobre, children }: { nome: string; sobre?: ReactNode; children?: ReactNode }) {
  return (
    <header className="ap-tela" style={{ gap: "0.5rem" }}>
      <div className="ap-titulo">
        <h2 className="al-cond">{nome}</h2>
        {children ? <div className="ap-titulo-acoes">{children}</div> : null}
      </div>
      {sobre ? <p className="ap-sobre">{sobre}</p> : null}
    </header>
  );
}

export function Quadro({ titulo, lado, tom, children }: { titulo?: string; lado?: ReactNode; tom?: "perigo" | "dourado"; children: ReactNode }) {
  return (
    <section className="ap-quadro" data-tom={tom}>
      {titulo || lado ? (
        <div className="ap-quadro-topo">
          {titulo ? <h3 className="ap-sub al-cond">{titulo}</h3> : <span />}
          {lado}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Ladrilho({ numero, nome, nota, aceso, aoAbrir }: { numero: number; nome: string; nota?: string; aceso?: boolean | "urgente"; aoAbrir?: () => void }) {
  return (
    <button type="button" className="ap-ladrilho" data-aceso={aceso || undefined} onClick={aoAbrir}>
      <span className="ap-ladrilho-numero al-cond">{numero.toLocaleString("pt-BR")}</span>
      <span className="ap-ladrilho-nome">
        {nome}
        {nota ? <span className="ap-ladrilho-nota">{nota}</span> : null}
      </span>
    </button>
  );
}

export type TomDaEtiqueta = "vermelho" | "dourado" | "papel";
export function Etiqueta({ tom, children }: { tom?: TomDaEtiqueta; children: ReactNode }) {
  return (
    <span className="ap-etiqueta" data-tom={tom}>
      {children}
    </span>
  );
}

export function Nota({ tom, children }: { tom?: "perigo"; children: ReactNode }) {
  return (
    <p className="ap-nota" data-tom={tom}>
      <span>{children}</span>
    </p>
  );
}

function MosaicoMiudo() {
  return (
    <span aria-hidden className="ap-estado-mosaico">
      {Array.from({ length: 21 }, (_, i) => (
        <span key={i} data-voce={i === 10 ? "" : undefined} />
      ))}
    </span>
  );
}

/** O estado de uma leitura: carregando, erro (com "tentar de novo") ou vazio. Devolve nulo quando há o que mostrar. */
export function Estado({ leitura, vazio, eVazio }: { leitura: { erro: string; carregando: boolean; recarregar: () => void }; vazio?: string; eVazio?: boolean }) {
  if (leitura.erro) {
    return (
      <div className="ap-estado" data-tom="erro" role="alert">
        <p>{leitura.erro}</p>
        <Botao variante="contorno" tamanho="p" onClick={leitura.recarregar}>
          Tentar de novo
        </Botao>
      </div>
    );
  }
  if (leitura.carregando) {
    return (
      <div className="ap-estado ap-pulso" role="status">
        <MosaicoMiudo />
        <p>Lendo o banco…</p>
      </div>
    );
  }
  if (eVazio) {
    return (
      <div className="ap-estado">
        <MosaicoMiudo />
        <p>{vazio ?? "Nada por aqui."}</p>
      </div>
    );
  }
  return null;
}

export function Fita<T extends string>({ rotulo, opcoes, atual, escolher }: { rotulo: string; opcoes: { id: T; nome: string; conta?: number }[]; atual: T; escolher: (id: T) => void }) {
  return (
    <div className="ap-fita" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" className="ap-fita-botao" aria-pressed={atual === o.id} onClick={() => escolher(o.id)}>
          {o.nome}
          {o.conta ? <span className="ap-conta">{o.conta}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Campo({ rotulo, largo, children }: { rotulo: string; largo?: boolean; children: ReactNode }) {
  return (
    <label className="ap-campo" data-largo={largo || undefined}>
      {rotulo}
      {children}
    </label>
  );
}

const formatoDeDataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const formatoDeData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
export const quando = (iso: string | null | undefined) => (iso ? formatoDeDataHora.format(new Date(iso)) : "—");
export const dia = (iso: string | null | undefined) => (iso ? formatoDeData.format(new Date(iso)) : "—");
export const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/** Quanto falta até um instante, em palavras ("em 3 dias", "em 5 horas", "vencido"). */
export function falta(iso: string | null | undefined): string {
  if (!iso) return "sem prazo";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "vencido";
  const horas = Math.round(ms / 3_600_000);
  if (horas < 1) return "em menos de 1 hora";
  if (horas < 48) return `em ${horas} ${horas === 1 ? "hora" : "horas"}`;
  return `em ${dias(Math.round(horas / 24))}`;
}

// ───────────── A janela de ação: confirmação, motivo e o que mais a ação pedir ─────────────

export type CampoDaJanela =
  /** O motivo (10 a 500 letras). Fica no registro; "aviso" diz quem mais lê. */
  | { tipo: "motivo"; nome?: string; rotulo?: string; aviso?: string; opcional?: boolean }
  | { tipo: "texto"; nome: string; rotulo: string; min?: number; max?: number; linhas?: number; valor?: string; aviso?: string }
  | { tipo: "dias"; nome?: string; rotulo: string; min: number; max: number; valor: number; atalhos?: number[] }
  | { tipo: "escolha"; nome: string; rotulo: string; opcoes: { id: string; nome: string }[]; valor: string }
  /** A frase que a pessoa escreve igual para confirmar. */
  | { tipo: "frase"; nome?: string; frase: string; rotulo?: string }
  /** A lista de conferência: só confirma com todos os itens marcados. */
  | { tipo: "lista"; nome?: string; rotulo: string; itens: string[] };

export type ValoresDaJanela = Record<string, string | number | boolean[]>;

export interface PedidoDeAcao {
  titulo: string;
  texto?: ReactNode;
  campos?: CampoDaJanela[];
  confirmar: string;
  perigo?: boolean;
  /** Faz a ação. Se falhar, a janela continua aberta com o erro; se der certo, fecha e mostra "sucesso". */
  fazer: (valores: ValoresDaJanela) => Promise<unknown>;
  sucesso?: string;
  /** Depois de dar certo (reler a lista da tela). */
  depois?: () => void;
}

const nomeDoCampo = (c: CampoDaJanela) => c.nome ?? c.tipo;

function valorInicial(campos: CampoDaJanela[]): ValoresDaJanela {
  const v: ValoresDaJanela = {};
  for (const c of campos) {
    if (c.tipo === "dias") v[nomeDoCampo(c)] = c.valor;
    else if (c.tipo === "lista") v[nomeDoCampo(c)] = c.itens.map(() => false);
    else if (c.tipo === "escolha") v[nomeDoCampo(c)] = c.valor;
    else if (c.tipo === "texto") v[nomeDoCampo(c)] = c.valor ?? "";
    else v[nomeDoCampo(c)] = "";
  }
  return v;
}

function campoPronto(c: CampoDaJanela, valor: ValoresDaJanela[string]): boolean {
  if (c.tipo === "motivo") return (c.opcional && String(valor).trim() === "") || (String(valor).trim().length >= 10 && String(valor).trim().length <= 500);
  if (c.tipo === "texto") return String(valor).trim().length >= (c.min ?? 0) && String(valor).trim().length <= (c.max ?? 1000);
  if (c.tipo === "dias") return Number.isInteger(valor) && Number(valor) >= c.min && Number(valor) <= c.max;
  if (c.tipo === "frase") return String(valor).trim() === c.frase;
  if (c.tipo === "lista") return Array.isArray(valor) && valor.every(Boolean);
  return true;
}

function Janela({ pedido, fechar, atualizar }: { pedido: PedidoDeAcao; fechar: () => void; atualizar: () => void }) {
  const campos = pedido.campos ?? [];
  const [valores, setValores] = useState<ValoresDaJanela>(() => valorInicial(campos));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const id = useId();
  const tema = useContext(TemaDaAlumiaCtx);
  const pronto = campos.every((c) => campoPronto(c, valores[nomeDoCampo(c)]));
  const mudar = (nome: string, valor: ValoresDaJanela[string]) => setValores((v) => ({ ...v, [nome]: valor }));

  async function confirmar() {
    if (!pronto || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await pedido.fazer(valores);
      if (pedido.sucesso) notificar.ok(pedido.sucesso);
      pedido.depois?.();
      atualizar();
      window.dispatchEvent(new Event(PAINEL_MUDOU));
      fechar();
    } catch (falha) {
      setErro(textoDoErroDaAlumia(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Radix.Root open onOpenChange={(aberto) => !aberto && !ocupado && fechar()}>
      <Radix.Portal>
        <Radix.Overlay className="ap-veu" />
        <Radix.Content className={`ap-janela ${classeDasLetras}`} data-al="2" data-al-tema={tema} aria-describedby={pedido.texto ? `${id}-texto` : undefined}>
          <Faixa />
          <form
            className="ap-janela-miolo"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmar();
            }}
          >
            <Radix.Title className="ap-janela-titulo al-cond">{pedido.titulo}</Radix.Title>
            {pedido.texto ? (
              <div id={`${id}-texto`} className="ap-janela-texto ap-tela" style={{ gap: "0.6rem" }}>
                {pedido.texto}
              </div>
            ) : null}
            {campos.map((c) => {
              const nome = nomeDoCampo(c);
              const valor = valores[nome];
              if (c.tipo === "motivo" || c.tipo === "texto") {
                const linhas = c.tipo === "motivo" ? 3 : (c.linhas ?? 1);
                const rotulo = c.tipo === "motivo" ? (c.rotulo ?? `Motivo${c.opcional ? " (opcional)" : " (obrigatório, 10 letras ou mais)"}`) : c.rotulo;
                const max = c.tipo === "motivo" ? 500 : (c.max ?? 1000);
                return (
                  <Campo key={nome} rotulo={rotulo}>
                    {linhas > 1 ? (
                      <textarea className="ap-entrada" rows={linhas} maxLength={max} value={String(valor)} onChange={(e) => mudar(nome, e.target.value)} />
                    ) : (
                      <input className="ap-entrada" maxLength={max} value={String(valor)} onChange={(e) => mudar(nome, e.target.value)} />
                    )}
                    {c.aviso ? <span className="ap-miudo">{c.aviso}</span> : null}
                  </Campo>
                );
              }
              if (c.tipo === "dias") {
                return (
                  <Campo key={nome} rotulo={`${c.rotulo} (de ${c.min} a ${c.max} dias)`}>
                    <input className="ap-entrada" type="number" inputMode="numeric" min={c.min} max={c.max} value={Number.isNaN(Number(valor)) ? "" : Number(valor)} onChange={(e) => mudar(nome, e.target.value === "" ? Number.NaN : Math.trunc(Number(e.target.value)))} />
                    {c.atalhos ? (
                      <span className="ap-fita">
                        {c.atalhos.map((n) => (
                          <button key={n} type="button" className="ap-fita-botao" aria-pressed={valor === n} onClick={() => mudar(nome, n)}>
                            {dias(n)}
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </Campo>
                );
              }
              if (c.tipo === "escolha") {
                return (
                  <Campo key={nome} rotulo={c.rotulo}>
                    <select className="ap-entrada" value={String(valor)} onChange={(e) => mudar(nome, e.target.value)}>
                      {c.opcoes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome}
                        </option>
                      ))}
                    </select>
                  </Campo>
                );
              }
              if (c.tipo === "frase") {
                return (
                  <Campo key={nome} rotulo={c.rotulo ?? "Para confirmar, escreva exatamente:"}>
                    <span>
                      <span className="ap-frase">{c.frase}</span>
                    </span>
                    <input className="ap-entrada" autoComplete="off" spellCheck={false} value={String(valor)} onChange={(e) => mudar(nome, e.target.value)} />
                  </Campo>
                );
              }
              const marcados = Array.isArray(valor) ? valor : [];
              return (
                <fieldset key={nome} className="ap-tela" style={{ gap: "0.5rem", border: 0, padding: 0, margin: 0 }}>
                  <legend className="ap-campo" style={{ marginBottom: "0.4rem" }}>
                    {c.rotulo}
                  </legend>
                  {c.itens.map((item, i) => (
                    <label key={item} className="ap-marcar">
                      <input type="checkbox" checked={Boolean(marcados[i])} onChange={(e) => mudar(nome, marcados.map((m, j) => (j === i ? e.target.checked : m)))} />
                      <span>{item}</span>
                    </label>
                  ))}
                </fieldset>
              );
            })}
            <p role="alert" className="ap-janela-erro">
              {erro}
            </p>
            <div className="ap-janela-pe">
              <Botao variante="contorno" disabled={ocupado} onClick={fechar}>
                Cancelar
              </Botao>
              <Botao type="submit" variante={pedido.perigo ? "primario" : "claro"} disabled={!pronto || ocupado}>
                {ocupado ? "Fazendo…" : pedido.confirmar}
              </Botao>
            </div>
          </form>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

/**
 * A janela de ação de uma tela: `pedir(…)` abre, `janela` é o que a tela desenha. Toda ação que esconde, suspende, apaga ou
 * muda papel passa por aqui: confirmação explícita e motivo escrito. (O banco exige o motivo de novo; a janela só evita a viagem.)
 */
export function useJanela() {
  const { atualizar } = usePainelDaAlumia();
  // A "vez" anda junto com o pedido: cada pedido novo remonta a janela, com os campos zerados.
  const [aberto, setAberto] = useState<{ pedido: PedidoDeAcao; vez: number } | null>(null);
  const pedir = useCallback((novo: PedidoDeAcao) => {
    setAberto((antes) => ({ pedido: novo, vez: (antes?.vez ?? 0) + 1 }));
  }, []);
  const janela = aberto ? <Janela key={aberto.vez} pedido={aberto.pedido} fechar={() => setAberto(null)} atualizar={atualizar} /> : null;
  return { pedir, janela };
}

/** O motivo que a janela devolveu, já como texto. */
export const motivoDe = (v: ValoresDaJanela, nome = "motivo") => String(v[nome] ?? "").trim();
