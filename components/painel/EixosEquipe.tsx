// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { AVISO_DA_PESQUISA, MINIMO_DA_PESQUISA, VERSAO_DO_AVISO_EIXOS, vetorParaEnvio } from "@/lib/eixos/equipe";
import { NIVEIS, ordemDoNivel, pontuarEixos, type Nivel } from "@/lib/eixos/pontuacao";
import { getItem, setItem } from "@/lib/storage";
import { textoDoErro } from "./comum";
import { Botao, Marca, Vazio } from "./ui";

interface Eixo {
  id: string;
  nome: string;
  a: string;
  b: string;
}
interface Pergunta {
  id: string;
  eixo: string;
  lado: "a" | "b";
  nivel: number;
  texto: string;
}
interface Dados {
  eixos: Eixo[];
  perguntas: Pergunta[];
}
interface Resultado {
  liberado: boolean;
  minimo: number;
  n?: number;
  media?: Record<string, number>;
  distribuicao?: Record<string, number[]>;
}

const RESPOSTAS = ["Concordo totalmente", "Concordo", "Neutro", "Discordo", "Discordo totalmente"];
const TAMANHOS: Record<Nivel, { nome: string; sobre: string }> = {
  1: { nome: "Curto", sobre: "36 perguntas, uns 5 minutos." },
  2: { nome: "Médio", sobre: "96 perguntas, uns 12 minutos." },
  3: { nome: "Longo (opcional)", sobre: "240 perguntas, bem mais tempo; só se você quiser." },
};
const FAIXAS = ["0-19", "20-39", "40-59", "60-79", "80-100"];
const CHAVE_CONVITE = "lucia.eixos-equipe.convite";

/** O arquivo das perguntas (72 KB) só é carregado quando a pessoa começa o teste, nunca com o painel. */
async function carregarDados(): Promise<Dados> {
  const m = await import("@/content/eixos.json");
  const d = (m.default ?? m) as unknown as Dados;
  return { eixos: d.eixos, perguntas: d.perguntas };
}

/**
 * Convite curto, junto do termo e do aviso da equipe: aparece para quem ainda não respondeu e não dispensou. Dispensar vale só
 * neste navegador (nada vai ao banco); "Mais tarde" some até a próxima visita.
 */
export function ConviteEixos({ ir }: { ir: (id: string) => void }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    let vivo = true;
    let dispensado = false;
    try {
      dispensado = getItem(CHAVE_CONVITE) === "1";
    } catch {}
    if (dispensado) return;
    rpc<{ respondeu: boolean }>("eixos_equipe_estado")
      .then((r) => vivo && setMostrar(!r.respondeu))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  if (!mostrar) return null;
  return (
    <aside role="region" aria-label="Convite para a pesquisa anônima" className="no-print fixed bottom-20 right-4 z-40 max-w-sm rounded-md border border-rule bg-folha p-4 text-ink lg:bottom-4">
      <p className="font-semibold">{AVISO_DA_PESQUISA.titulo}</p>
      <p className="mt-1 text-ink-soft">{AVISO_DA_PESQUISA.anonimo} {AVISO_DA_PESQUISA.opcional}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao
          variante="principal"
          onClick={() => {
            setMostrar(false);
            ir("eixos-equipe");
          }}
        >
          Ver e decidir
        </Botao>
        <Botao onClick={() => setMostrar(false)}>Mais tarde</Botao>
        <Botao
          variante="discreto"
          onClick={() => {
            try {
              setItem(CHAVE_CONVITE, "1");
            } catch {}
            setMostrar(false);
          }}
        >
          Não quero responder
        </Botao>
      </div>
    </aside>
  );
}

type Etapa = "aviso" | "tamanho" | "perguntas" | "enviado";

/** A tarefa opcional de cada voluntário (e, só para a coordenação, o resultado agregado da equipe). */
export function EixosEquipe({ coordena }: { coordena: boolean }) {
  const [respondeu, setRespondeu] = useState<boolean | null>(null);
  const [erro, setErro] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("aviso");
  const [consenti, setConsenti] = useState(false);
  const [nivel, setNivel] = useState<Nivel>(1);
  const [dados, setDados] = useState<Dados | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [atual, setAtual] = useState(0);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    rpc<{ respondeu: boolean }>("eixos_equipe_estado")
      .then((r) => setRespondeu(r.respondeu))
      .catch((e) => {
        setErro(textoDoErro(e));
        setRespondeu(false);
      });
  }, []);

  const lista = useMemo(() => (dados ? ordemDoNivel(dados.eixos, dados.perguntas, nivel) : []), [dados, nivel]);
  const pergunta = lista[atual];

  async function comecar(n: Nivel) {
    setErro("");
    try {
      setDados(await carregarDados());
      setNivel(n);
      setRespostas({});
      setAtual(0);
      setEtapa("perguntas");
    } catch {
      setErro("Não foi possível carregar as perguntas. Tente de novo.");
    }
  }
  const responder = (i: number) => {
    if (!pergunta) return;
    setRespostas((r) => ({ ...r, [pergunta.id]: i }));
    setAtual((a) => a + 1);
  };
  async function enviar() {
    if (!dados || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      // Só os 12 números saem daqui; as respostas às perguntas ficam e morrem neste navegador.
      const pontos = vetorParaEnvio(pontuarEixos(dados.eixos, lista, respostas));
      await rpc("eixos_equipe_enviar", { p_pontos: pontos, p_consentimento: consenti, p_versao: VERSAO_DO_AVISO_EIXOS });
      setRespostas({});
      setRespondeu(true);
      setEtapa("enviado");
    } catch (e) {
      setErro(textoDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const fim = etapa === "perguntas" && atual >= lista.length && lista.length > 0;
  return (
    <div className="pn-tela">
      <section aria-labelledby="eixos-equipe-titulo" className="max-w-2xl space-y-3">
        <h2 id="eixos-equipe-titulo" className="pn-secao-titulo">{AVISO_DA_PESQUISA.titulo}</h2>
        <p className="font-semibold">{AVISO_DA_PESQUISA.anonimo}</p>
        {erro && <p role="alert" className="text-oxblood">{erro}</p>}

        {respondeu === null && <p className="pn-ajuda">Carregando…</p>}
        {(respondeu || etapa === "enviado") && (
          <Vazio titulo="Você já respondeu. Obrigado." texto="Fica uma resposta por conta, e ela já entrou na soma da equipe, sem ligação com o seu nome." />
        )}

        {respondeu === false && etapa === "aviso" && (
          <>
            <p>{AVISO_DA_PESQUISA.finalidade}</p>
            <p>{AVISO_DA_PESQUISA.oQueGuarda}</p>
            <p>{AVISO_DA_PESQUISA.sensivel}</p>
            <p>{AVISO_DA_PESQUISA.limites}</p>
            <p className="pn-ajuda">{AVISO_DA_PESQUISA.opcional}</p>
            <Marca rotulo={AVISO_DA_PESQUISA.consentimento} checked={consenti} onChange={(e) => setConsenti(e.target.checked)} />
            <Botao variante="principal" disabled={!consenti} onClick={() => setEtapa("tamanho")}>Continuar</Botao>
          </>
        )}

        {respondeu === false && etapa === "tamanho" && (
          <>
            <p>Escolha o tamanho do teste. Os dois primeiros bastam para a pesquisa.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {NIVEIS.map((n) => (
                <Botao key={n} variante={n === 1 ? "principal" : "padrao"} onClick={() => comecar(n)} style={{ display: "block", textAlign: "left", height: "auto" }}>
                  <strong className="block">{TAMANHOS[n].nome}</strong>
                  <span className="block text-sm">{TAMANHOS[n].sobre}</span>
                </Botao>
              ))}
            </div>
          </>
        )}

        {respondeu === false && etapa === "perguntas" && pergunta && (
          <div className="space-y-3">
            <p className="pn-ajuda">Pergunta {atual + 1} de {lista.length}. Nada é guardado enquanto você responde.</p>
            <progress className="w-full" max={lista.length} value={atual} aria-label="Andamento do teste" />
            <p lang="pt-BR" className="font-serif text-xl leading-snug">{pergunta.texto}</p>
            <div className="grid gap-2 sm:grid-cols-5">
              {RESPOSTAS.map((rotulo, i) => (
                <Botao key={rotulo} onClick={() => responder(i)} aria-pressed={respostas[pergunta.id] === i}>{rotulo}</Botao>
              ))}
            </div>
            <div className="flex gap-2">
              <Botao variante="discreto" disabled={atual === 0} onClick={() => setAtual((a) => Math.max(0, a - 1))}>Voltar</Botao>
              <Botao variante="discreto" onClick={() => { setRespostas({}); setEtapa("aviso"); }}>Desistir</Botao>
            </div>
          </div>
        )}

        {respondeu === false && fim && (
          <div className="space-y-3">
            <p>Terminou. Ao enviar, só 12 números (um por eixo) entram na soma da equipe. Nada mais sai deste navegador.</p>
            <div className="flex gap-2">
              <Botao variante="principal" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Enviar de forma anônima"}</Botao>
              <Botao disabled={enviando} onClick={() => { setRespostas({}); setEtapa("aviso"); }}>Descartar sem enviar</Botao>
            </div>
          </div>
        )}
      </section>

      {coordena && <ResultadoDaEquipe />}
    </div>
  );
}

/** Só a coordenação: média e distribuição, e só com 5 ou mais respostas (o banco também recusa antes disso). */
function ResultadoDaEquipe() {
  const [res, setRes] = useState<Resultado | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    Promise.all([rpc<Resultado>("eixos_equipe_resultado"), carregarDados()])
      .then(([r, d]) => {
        if (!vivo) return;
        setRes(r);
        setDados(d);
      })
      .catch((e) => vivo && setErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, []);
  return (
    <section aria-labelledby="eixos-equipe-resultado" className="mt-8 space-y-3">
      <h2 id="eixos-equipe-resultado" className="pn-secao-titulo">Resultado da equipe (só coordenação)</h2>
      {erro && <p role="alert" className="text-oxblood">{erro}</p>}
      {res && !res.liberado && (
        <p>Ainda não há respostas suficientes para mostrar sem identificar ninguém (mínimo de {res.minimo ?? MINIMO_DA_PESQUISA}). O resultado aparece de 5 em 5 respostas.</p>
      )}
      {res?.liberado && dados && res.media && res.distribuicao && (
        <>
          <p className="pn-ajuda">{res.n} pessoas na soma. Cada barra mostra quantas caíram em cada faixa do eixo, de {"“a”"} (0) a {"“b”"} (100).</p>
          <ul className="space-y-4">
            {dados.eixos.map((e) => {
              const faixas = res.distribuicao![e.id] ?? [];
              const maior = Math.max(1, ...faixas);
              return (
                <li key={e.id}>
                  <p className="font-semibold">{e.nome} <span className="pn-ajuda">média {res.media![e.id]} de 100 ({e.a} 0 a 100 {e.b})</span></p>
                  <div className="mt-1 grid grid-cols-5 gap-1" role="img" aria-label={`Distribuição de ${e.nome}: ${faixas.map((q, i) => `${FAIXAS[i]}: ${q}`).join("; ")}`}>
                    {faixas.map((q, i) => (
                      <div key={FAIXAS[i]} className="text-center text-xs">
                        <div className="flex h-12 items-end"><div className="w-full bg-ink-soft" style={{ height: `${(100 * q) / maior}%`, minHeight: q ? 2 : 0 }} /></div>
                        <span>{q}</span><br /><span className="pn-ajuda">{FAIXAS[i]}</span>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
