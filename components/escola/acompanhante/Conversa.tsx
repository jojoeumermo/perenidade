// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { RespostaDoAssistente } from "@/components/Assistente";
import { L, useI18n } from "@/components/I18n";
import { SelosDePrivacidade } from "@/components/SeloDePrivacidade";
import { fill } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { askAssistant, hasBackend, rpc, useMe } from "@/lib/backend";
import { type Contexto, type Conversa as ConversaGuardada, type Fala, gravarConversa, type ModoDeConversa, montarPedido, novoId, tituloDe } from "@/lib/escola/acompanhante";
import { estaLigado } from "@/lib/modo-seguro";
import { SELOS_DE_FORA } from "@/lib/selos";
import { type MotivoSemServidor, RespostaSemServidor } from "./RespostaSemServidor";
import "@/styles/escola-acompanhante.css";

// A conversa do acompanhante (E4-10), usada por todos os modos: o campo, o aviso do que vai para o assistente (ANTES do
// botão), o selo de privacidade, as falas e as respostas (RespostaDoAssistente, com o aviso de resposta automática).
// O histórico fica só no aparelho (lib/escola/acompanhante.ts) e nunca é gravado no modo seguro.
// Sem conta, com o assistente desligado ou sem internet, entra o modo sem servidor (trechos das aulas, no aparelho).

export type Textos = TextosDoAcompanhante;
export type ItemQueVai = keyof TextosDoAcompanhante["comum"]["itens"];

const assinarRede = (avisar: () => void) => {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
};
const assinarSeguro = (avisar: () => void) => {
  window.addEventListener("lucia:modo-seguro", avisar);
  return () => window.removeEventListener("lucia:modo-seguro", avisar);
};

/** O modo seguro está ligado nesta aba? (falso no servidor e na hidratação) */
export function useModoSeguro(): boolean {
  return useSyncExternalStore(assinarSeguro, () => estaLigado(), () => false);
}

/** O estado do assistente, consultado uma vez por minuto no máximo, por mais conversas que a página tenha. */
let estadoGuardado: { em: number; ligado: Promise<boolean> } | null = null;
function assistenteLigado(): Promise<boolean> {
  if (!estadoGuardado || Date.now() - estadoGuardado.em > 60_000) {
    estadoGuardado = {
      em: Date.now(),
      ligado: rpc<{ ligado?: boolean } | null>("assistente_estado")
        .then((estado) => estado?.ligado === true)
        .catch(() => {
          estadoGuardado = null;
          return false;
        }),
    };
  }
  return estadoGuardado.ligado;
}

/**
 * Dá para perguntar ao assistente agora? "carregando" no servidor e enquanto a conta e o estado do assistente não
 * chegam; depois, "pronto" ou o motivo do modo sem servidor. Só consulta o estado do assistente para quem tem conta.
 */
export function useDisponibilidade(): "carregando" | "pronto" | MotivoSemServidor {
  const me = useMe();
  const online = useSyncExternalStore(assinarRede, () => navigator.onLine, () => true);
  const [ligado, setLigado] = useState<boolean | null>(null);
  const entrou = me.status === "in";
  useEffect(() => {
    if (!entrou || !hasBackend) return;
    let vivo = true;
    void assistenteLigado().then((sim) => vivo && setLigado(sim));
    return () => {
      vivo = false;
    };
  }, [entrou]);
  if (!online) return "semInternet";
  if (!hasBackend) return "desligado";
  if (me.status === "loading") return "carregando";
  if (!entrou) return "semConta";
  if (ligado === null) return "carregando";
  return ligado ? "pronto" : "desligado";
}

/** O aviso do que vai, montado com os itens deste pedido. */
export function AvisoDoQueVai({ s, itens, lang, id }: { s: Textos["comum"]; itens: readonly ItemQueVai[]; lang: string; id?: string }) {
  const lista = itens.map((i) => s.itens[i]).join("; ");
  return (
    <div id={id} className="acompanhante-aviso mt-3 border-l-4 border-oxblood pl-3 text-sm">
      <p>{fill(s.oQueVai, { itens: lista })}</p>
      <SelosDePrivacidade item={SELOS_DE_FORA.assistente} lang={lang} className="mt-2" />
      <p className="mt-1 text-xs">
        <L href="/escola/acompanhante/como-funciona" className="underline hover:text-oxblood">
          {s.comoFunciona}
        </L>
      </p>
    </div>
  );
}

export interface PropsDaConversa {
  s: Textos;
  modo: ModoDeConversa;
  /** O que vai junto com a pergunta (trecho, aula, exercício, trabalho, idioma…). */
  contexto?: Contexto;
  imagem?: { tipo: string; dados: string } | null;
  /** O que a tela diz que vai, além do histórico (que entra sozinho quando há). */
  itens: readonly ItemQueVai[];
  campo: { rotulo: string; dica?: string; max: number; min: number; linhas?: number; lang?: string };
  botao?: string;
  /** Uma pergunta só (redação, documento): depois da resposta, só "Começar outra". */
  umaVez?: boolean;
  /** Sem servidor: procurar nas aulas ("busca") ou só avisar ("aviso"). */
  semServidor: "busca" | "aviso";
  /** O que fazer com a resposta antes de mostrar (o comentário de redação tira linhas com nota). */
  transformar?: (texto: string) => { texto: string; nota?: string };
  /** Um aviso fixo logo abaixo de cada resposta (o "não é correção nem nota"). */
  avisoDaResposta?: string;
  /** Um botão a mais em cada resposta (o "Ouvir" da conversa de idioma). */
  acaoNaResposta?: (texto: string) => ReactNode;
  /** Um controle a mais junto do campo (o microfone): recebe a função que preenche o campo e o texto de agora. */
  extraNoCampo?: (preencher: (texto: string) => void, texto: string) => ReactNode;
  /** A conversa acabou (a entrevista, ao concluir as 5 respostas): some o formulário e fica só "Começar outra". */
  encerrarQuando?: (falas: readonly Fala[]) => boolean;
  /** Confere o texto do campo antes do envio (dado pessoal): mostra o aviso e, se bloqueia, desliga o botão. */
  conferirTexto?: (texto: string) => { aviso: string; bloqueia: boolean } | null;
  /** Valor inicial do campo (a redação que veio da Oficina). */
  inicial?: string;
  /** Pode mandar sem escrever nada (o trecho ou a foto já bastam)? */
  semTextoBasta?: boolean;
  /** O idioma da prática (vai para o histórico, para a lista do aparelho). */
  idiomaAlvo?: "en" | "es";
  /** Falta algo fora do campo (o trabalho, a foto): o botão fica desligado. */
  bloqueado?: boolean;
  /** Avisa a tela de fora quando chega uma resposta ou quando começa outra conversa. */
  aoMudar?: (falas: readonly Fala[]) => void;
}

export function Conversa(p: PropsDaConversa) {
  const { s, modo } = p;
  const { lang, t } = useI18n();
  const disponivel = useDisponibilidade();
  const seguro = useModoSeguro();
  const campoId = useId();
  const [texto, setTexto] = useState(p.inicial ?? "");
  const [falas, setFalas] = useState<Fala[]>([]);
  const [estado, setEstado] = useState<{ fase: "parado" | "pensando" } | { fase: "erro"; texto: string } | { fase: "local"; pergunta: string; motivo: MotivoSemServidor }>({ fase: "parado" });
  const [restantes, setRestantes] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const id = useRef<{ id: string; criada: number } | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const aoMudar = useRef(p.aoMudar);
  useEffect(() => {
    aoMudar.current = p.aoMudar;
  });

  const pergunta = texto.trim();
  const temBase = Boolean(p.semTextoBasta && (p.contexto?.trecho || p.contexto?.enunciado || p.imagem));
  const conferido = p.conferirTexto?.(texto) ?? null;
  const pronto = (pergunta.length >= p.campo.min || (temBase && pergunta.length === 0)) && pergunta.length <= p.campo.max && (p.imagem !== null || p.semServidor !== "aviso") && !p.bloqueado && !conferido?.bloqueia;
  const terminou = (Boolean(p.umaVez) && falas.some((f) => f.de === "assistente")) || Boolean(p.encerrarQuando?.(falas));
  const itens: ItemQueVai[] = [...p.itens, ...(falas.length && !p.umaVez ? (["historico"] as const) : [])];

  function guardar(lista: Fala[]) {
    if (!id.current) id.current = { id: novoId(), criada: Date.now() };
    const primeira = (modo === "entrevista" ? p.contexto?.vaga : "") || lista.find((f) => f.de === "pessoa")?.texto || p.contexto?.trecho || p.contexto?.enunciado || s.hub.nomesDosModos[modo];
    const conversa: ConversaGuardada = {
      id: id.current.id,
      modo,
      titulo: tituloDe(primeira),
      ...(p.contexto?.aula ? { aula: p.contexto.aula } : {}),
      ...(p.idiomaAlvo ? { idiomaAlvo: p.idiomaAlvo } : {}),
      criada: id.current.criada,
      atualizada: Date.now(),
      falas: lista,
    };
    gravarConversa(conversa);
  }

  async function perguntar() {
    if (!pronto || estado.fase === "pensando") return;
    if (disponivel !== "pronto") {
      if (disponivel !== "carregando") setEstado({ fase: "local", pergunta: pergunta || p.contexto?.trecho || "", motivo: disponivel });
      return;
    }
    setEstado({ fase: "pensando" });
    setNota("");
    const pedido = montarPedido({ modo, pergunta, idioma: lang, falas, contexto: p.contexto, imagem: p.imagem ?? undefined });
    const r = await askAssistant(pedido);
    if (!r.ok) {
      const semRede = r.erro === "assistente_falhou" && typeof navigator !== "undefined" && !navigator.onLine;
      if ((semRede || r.erro === "assistente_indisponivel") && p.semServidor === "busca") {
        setEstado({ fase: "local", pergunta: pergunta || p.contexto?.trecho || "", motivo: semRede ? "semInternet" : "falhou" });
        return;
      }
      setEstado({ fase: "erro", texto: r.recusa ? s.comum.recusa : errorText(t, r.erro) });
      return;
    }
    const tratado = p.transformar ? p.transformar(r.texto) : { texto: r.texto };
    if (tratado.nota) setNota(tratado.nota);
    const agora = Date.now();
    const novas: Fala[] = [...falas, { de: "pessoa" as const, texto: pergunta, em: agora }, { de: "assistente" as const, texto: tratado.texto, em: agora, ...(r.cortada ? { cortada: true } : {}) }].filter((f) => f.texto);
    setFalas(novas);
    setRestantes(r.restantes);
    setTexto("");
    setEstado({ fase: "parado" });
    guardar(novas);
    aoMudar.current?.(novas);
    window.setTimeout(() => fim.current?.focus(), 0);
  }

  function recomecar() {
    id.current = null;
    setFalas([]);
    setTexto("");
    setNota("");
    setRestantes(null);
    setEstado({ fase: "parado" });
    aoMudar.current?.([]);
  }

  const avisoId = `${campoId}-aviso`;

  return (
    <div className="acompanhante-conversa" data-modo={modo}>
      {falas.length > 0 && (
        <ol className="acompanhante-falas space-y-3" aria-label={s.meta.titulo}>
          {falas.map((f, i) =>
            f.de === "pessoa" ? (
              <li key={i} className="acompanhante-fala-pessoa ml-auto max-w-[85%] border border-rule bg-parchment px-3 py-2 text-sm">
                <span className="sr-only">{s.comum.voce}: </span>
                <span className="whitespace-pre-line">{f.texto}</span>
              </li>
            ) : (
              <li key={i}>
                <RespostaDoAssistente texto={f.texto} cortada={Boolean(f.cortada)} rotulo={s.comum.rotuloResposta} aviso={s.comum.avisoAutomatico} avisoCortada={s.comum.cortada} lang={lang} />
                {p.avisoDaResposta && <p className="mt-1 text-sm font-semibold text-oxblood">{p.avisoDaResposta}</p>}
                {p.acaoNaResposta?.(f.texto)}
              </li>
            ),
          )}
        </ol>
      )}
      <div ref={fim} tabIndex={-1} className="outline-none" />
      {nota && <p className="mt-2 text-sm text-ink-soft">{nota}</p>}
      {restantes !== null && <p className="mt-2 text-xs text-ink-soft">{fill(s.comum.restantes, { n: restantes })}</p>}
      {falas.length > 0 && <p className="mt-2 text-xs text-ink-soft">{seguro ? s.comum.modoSeguro : s.comum.historicoAqui}</p>}

      {terminou ? (
        <p className="mt-4">
          <button type="button" onClick={recomecar} className="acompanhante-botao-claro">
            {s.comum.novaConversa}
          </button>
        </p>
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void perguntar();
          }}
        >
          <label htmlFor={campoId} className="block font-semibold">
            {p.campo.rotulo}
          </label>
          {p.campo.dica && (
            <p id={`${campoId}-dica`} className="text-sm text-ink-soft">
              {p.campo.dica}
            </p>
          )}
          <textarea
            id={campoId}
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, p.campo.max))}
            rows={p.campo.linhas ?? 3}
            maxLength={p.campo.max}
            lang={p.campo.lang}
            aria-describedby={`${p.campo.dica ? `${campoId}-dica ` : ""}${avisoId}`}
            className="acompanhante-campo mt-2 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-base"
          />
          <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
            <span>{s.comum.naoEscreva}</span>
            {p.campo.max > 400 && <span aria-live="off">{fill(s.comum.caracteres, { n: texto.length, max: p.campo.max })}</span>}
          </p>
          {conferido && (
            <p role="status" className={`mt-1 text-sm font-semibold ${conferido.bloqueia ? "text-oxblood" : "text-ink"}`} data-dado-pessoal={conferido.bloqueia ? "bloqueia" : "avisa"}>
              {conferido.aviso}
            </p>
          )}
          {p.extraNoCampo?.((novo) => setTexto(novo.slice(0, p.campo.max)), texto)}
          {disponivel === "pronto" || disponivel === "carregando" ? (
            <AvisoDoQueVai s={s.comum} itens={itens} lang={lang} id={avisoId} />
          ) : (
            <p id={avisoId} className="mt-3 text-sm text-ink-soft">
              {s.semServidor[disponivel]}
              {disponivel === "semConta" && (
                <>
                  {" "}
                  <L href="/entrar" className="font-semibold underline hover:text-oxblood">
                    {s.comum.entrarLink}
                  </L>
                </>
              )}
            </p>
          )}
          {!(p.semServidor === "aviso" && disponivel !== "pronto" && disponivel !== "carregando") && (
            <p className="mt-3 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={!pronto || estado.fase === "pensando" || disponivel === "carregando"} className="acompanhante-botao">
                {disponivel === "pronto" || disponivel === "carregando" ? (p.botao ?? s.comum.enviar) : s.semServidor.buscar}
              </button>
              {falas.length > 0 && !p.umaVez && (
                <button type="button" onClick={recomecar} className="acompanhante-botao-claro">
                  {s.comum.novaConversa}
                </button>
              )}
            </p>
          )}
        </form>
      )}

      <div role="status" aria-live="polite">
        {estado.fase === "pensando" && <p className="mt-3 text-ink-soft">{s.comum.enviando}</p>}
        {estado.fase === "erro" && <p className="mt-3 text-oxblood">{estado.texto}</p>}
      </div>
      {estado.fase === "local" && <RespostaSemServidor s={s.semServidor} lang={lang} pergunta={estado.pergunta} motivo={estado.motivo} />}
    </div>
  );
}
