// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { type Algoritmo, buscar, type Grafo, largura, menorCaminho, ordenar, profundidade, sorteio } from "@/lib/ferramentas/rodada";
import { Bancada, Botao, BotaoClaro, Deslizante, Escolha, Leitura } from "../../labs/kit";
import { ComoUsar } from "./comum";

const vetorDe = (semente: number, n: number) => { const r = sorteio(semente); return Array.from({ length: n }, () => 5 + Math.floor(r() * 95)); };

/** Ordenação e busca, passo a passo, com velocidade ajustável e a contagem de comparações. */
export function Algoritmos() {
  const [modo, setModo] = useState<"ordenar" | "buscar">("ordenar");
  const [alg, setAlg] = useState<Algoritmo>("bolha");
  const [tipoBusca, setTipoBusca] = useState<"linear" | "binaria">("binaria");
  const [n, setN] = useState(12);
  const [semente, setSemente] = useState(1);
  const [passo, setPasso] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [vel, setVel] = useState(4);
  const base = useMemo(() => vetorDe(semente, n), [semente, n]);
  const ordenado = useMemo(() => [...base].sort((a, b) => a - b), [base]);
  const alvo = ordenado[Math.floor(n * 0.7)];
  const passosOrd = useMemo(() => ordenar(alg, base), [alg, base]);
  const passosBusca = useMemo(() => buscar(tipoBusca, tipoBusca === "binaria" ? ordenado : base, alvo), [tipoBusca, ordenado, base, alvo]);
  const total = modo === "ordenar" ? passosOrd.length : passosBusca.length;
  // Roda enquanto não chegou ao fim; no último passo para sozinho.
  const ativo = rodando && passo < total - 1;
  useEffect(() => {
    if (!ativo) return;
    const id = window.setInterval(() => setPasso((p) => Math.min(total - 1, p + 1)), 1000 / vel);
    return () => window.clearInterval(id);
  }, [ativo, vel, total]);
  const reiniciar = () => { setPasso(0); setRodando(false); };
  const atual = modo === "ordenar" ? passosOrd[Math.min(passo, passosOrd.length - 1)] : null;
  const b = modo === "buscar" ? passosBusca[Math.min(passo, passosBusca.length - 1)] : null;
  const vet = atual ? atual.v : tipoBusca === "binaria" ? ordenado : base;
  const max = Math.max(...vet);
  const comparacoes = modo === "ordenar" ? passosOrd.slice(0, passo + 1).filter((x) => x.olhando.length === 2).length : passo + 1;
  return (
    <div>
      <Bancada titulo="Algoritmos animados" subtitulo="Ordenar e buscar, um passo de cada vez">
        <div className="flex flex-wrap gap-4">
          <Escolha rotulo="Fazer" valor={modo} opcoes={[["ordenar", "Ordenar"], ["buscar", "Buscar"]]} mudar={(v) => { setModo(v); reiniciar(); }} />
          {modo === "ordenar" ? (
            <Escolha rotulo="Algoritmo" valor={alg} opcoes={[["bolha", "Bolha"], ["selecao", "Seleção"], ["insercao", "Inserção"], ["quick", "Quicksort"]]} mudar={(v) => { setAlg(v); reiniciar(); }} />
          ) : (
            <Escolha rotulo="Busca" valor={tipoBusca} opcoes={[["linear", "Linear"], ["binaria", "Binária (lista ordenada)"]]} mudar={(v) => { setTipoBusca(v); reiniciar(); }} />
          )}
        </div>
        <svg viewBox={`0 0 ${n * 40} 200`} className="mt-4 w-full rounded bg-[#17130e]" role="img" aria-label={`Lista: ${vet.join(", ")}`}>
          {vet.map((x, i) => {
            const olhando = atual ? atual.olhando.includes(i) : b?.olhando === i;
            const pronto = atual ? atual.prontos.includes(i) : false;
            const fora = b ? i < b.faixa[0] || i > b.faixa[1] : false;
            const cor = b?.achou && b.olhando === i ? "#30d158" : olhando ? (atual?.trocou ? "#ff453a" : "#ffd60a") : pronto ? "#30d158" : fora ? "#3a3528" : "#c9b98f";
            const h = (x / max) * 160;
            return (
              <g key={i}>
                <rect x={i * 40 + 6} y={180 - h} width={28} height={h} rx={3} fill={cor} />
                <text x={i * 40 + 20} y={195} textAnchor="middle" fontSize="11" fill="#f4ecd8" fontFamily="ui-monospace, monospace">{x}</text>
              </g>
            );
          })}
        </svg>
        <p className="mt-2 min-h-6 text-sm font-semibold">{atual?.nota ?? b?.nota}{modo === "buscar" && <span className="ml-2 font-normal text-ink-soft">(procurando {alvo})</span>}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-ink p-1 text-parchment"><Botao primario onClick={() => { if (passo >= total - 1) { setPasso(0); setRodando(true); } else setRodando(!ativo); }}>{ativo ? "⏸ Pausar" : "▶ Rodar"}</Botao></span>
          <BotaoClaro onClick={() => setPasso((p) => Math.max(0, p - 1))} desligado={ativo}>◀ Voltar</BotaoClaro>
          <BotaoClaro onClick={() => setPasso((p) => Math.min(total - 1, p + 1))} desligado={ativo}>Avançar ▶</BotaoClaro>
          <BotaoClaro onClick={() => { setSemente((s) => s + 1); reiniciar(); }}>Outra lista</BotaoClaro>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Deslizante rotulo="Tamanho da lista" valor={n} min={5} max={20} mudar={(v) => { setN(v); reiniciar(); }} />
          <Deslizante rotulo="Velocidade" valor={vel} min={1} max={20} mudar={setVel} formato={(v) => `${v} passos/s`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Leitura rotulo="Passo" valor={`${passo + 1} / ${total}`} />
          <Leitura rotulo={modo === "ordenar" ? "Comparações" : "Olhadas"} valor={String(comparacoes)} />
          <Leitura rotulo="Itens" valor={String(n)} />
        </div>
      </Bancada>
      <ComoUsar
        passos={["Escolha ordenar ou buscar e o algoritmo.", "Aperte Rodar, ou avance passo a passo para ver cada comparação (amarelo) e cada troca (vermelho).", "Compare o número de comparações entre os algoritmos com a mesma lista."]}
        atividades={["Ordene a mesma lista com Bolha e com Quicksort: qual faz menos comparações? E com 20 itens?", "Na busca binária, com 16 itens, quantas olhadas no máximo são necessárias? E com 1.000? (Dica: quantas vezes dá para dividir por 2?)", "Ponha uma lista já quase ordenada (avance a semente até achar uma): qual algoritmo se sai melhor nesse caso, e por quê?"]}
      />
    </div>
  );
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const bits = (h: string) => h.split("").map((c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const de64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Hash (efeito avalanche) e cifra AES com senha, só com a Web Crypto do navegador. */
export function Criptografia() {
  const [texto, setTexto] = useState("Instituto Lúcia");
  const [algo, setAlgo] = useState<"SHA-256" | "SHA-1">("SHA-256");
  const [h1, setH1] = useState("");
  const [h2, setH2] = useState("");
  const [senha, setSenha] = useState("uma senha longa e só sua");
  const [segredo, setSegredo] = useState("Encontro do grupo de estudo: sábado, 15h.");
  const [cifrado, setCifrado] = useState("");
  const [aberto, setAberto] = useState("");
  const [erro, setErro] = useState("");
  const vizinho = texto ? texto.slice(0, -1) + String.fromCharCode(texto.charCodeAt(texto.length - 1) ^ 1) : "";
  useEffect(() => {
    let vivo = true;
    const enc = new TextEncoder();
    void Promise.all([crypto.subtle.digest(algo, enc.encode(texto)), crypto.subtle.digest(algo, enc.encode(vizinho))]).then(([a, b]) => { if (vivo) { setH1(hex(a)); setH2(hex(b)); } });
    return () => { vivo = false; };
  }, [texto, vizinho, algo]);
  const diferentes = h1 && h2 ? bits(h1).split("").filter((c, i) => c !== bits(h2)[i]).length : 0;
  async function chave(sal: Uint8Array) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal as BufferSource, iterations: 200_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function cifrar() {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(sal), new TextEncoder().encode(segredo));
    setCifrado(`${b64(sal)}.${b64(iv)}.${b64(new Uint8Array(c))}`);
    setAberto("");
    setErro("");
  }
  async function decifrar() {
    try {
      const [s, i, c] = cifrado.split(".").map(de64);
      const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: i as BufferSource }, await chave(s), c as BufferSource);
      setAberto(new TextDecoder().decode(p));
      setErro("");
    } catch {
      setAberto("");
      setErro("Não abriu: a senha está errada ou o texto cifrado foi alterado (o AES-GCM percebe a mudança).");
    }
  }
  const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5 font-mono text-sm";
  return (
    <div>
      <Bancada titulo="Hash: a impressão digital do texto" subtitulo="Mude uma letra e o resultado muda quase todo">
        <label className="block text-sm font-semibold">Texto<input value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 500))} className={campo} /></label>
        <div className="mt-2"><Escolha rotulo="Função" valor={algo} opcoes={[["SHA-256", "SHA-256"], ["SHA-1", "SHA-1 (antiga, quebrada)"]]} mudar={setAlgo} /></div>
        <p className="mt-3 break-all rounded bg-[#17130e] p-3 font-mono text-xs text-[#30d158]">{h1}</p>
        <p className="mt-2 text-sm">Agora o mesmo texto com um bit trocado na última letra (“{vizinho}”):</p>
        <p className="mt-1 break-all rounded bg-[#17130e] p-3 font-mono text-xs text-[#ffd60a]">{h2}</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><Leitura rotulo="Bits diferentes" valor={`${diferentes} de ${h1.length * 4}`} destaque /><Leitura rotulo="Proporção" valor={h1 ? `${Math.round((diferentes / (h1.length * 4)) * 100)}%` : "—"} /></div>
      </Bancada>
      <div className="mt-6">
        <Bancada titulo="Cifrar e decifrar com senha" subtitulo="AES-GCM de 256 bits, chave tirada da senha com PBKDF2">
          <label className="block text-sm font-semibold">Mensagem<textarea value={segredo} onChange={(e) => setSegredo(e.target.value.slice(0, 2000))} rows={2} className={campo} /></label>
          <label className="mt-2 block text-sm font-semibold">Senha<input value={senha} onChange={(e) => setSenha(e.target.value.slice(0, 200))} className={campo} /></label>
          <div className="mt-3 flex flex-wrap gap-2"><BotaoClaro onClick={() => void cifrar()}>Cifrar</BotaoClaro><BotaoClaro onClick={() => void decifrar()} desligado={!cifrado}>Decifrar</BotaoClaro></div>
          {cifrado && <label className="mt-3 block text-sm font-semibold">Texto cifrado (sal . vetor . cifra, em base64; pode editar para ver o que acontece)<textarea value={cifrado} onChange={(e) => setCifrado(e.target.value)} rows={3} className={`${campo} text-xs`} /></label>}
          {aberto && <p className="mt-2 rounded border-2 border-[#1d6b3a] bg-parchment-deep p-2 text-sm">✓ {aberto}</p>}
          {erro && <p className="mt-2 text-sm text-oxblood">{erro}</p>}
          <p className="mt-3 text-xs text-ink-soft">Tudo acontece neste aparelho, com a criptografia que já vem no navegador. Nada é enviado nem guardado.</p>
        </Bancada>
      </div>
      <ComoUsar
        passos={["Digite um texto e veja o hash dele.", "Compare com o hash do mesmo texto com só um bit trocado.", "Na parte de baixo, cifre uma mensagem com senha, troque a senha e tente abrir."]}
        atividades={["Mude uma única letra do texto: quantos bits do hash mudam? Faça três vezes e tire a média.", "Por que os sites guardam o hash da senha, e não a senha? O que acontece se duas pessoas usam a mesma senha?", "Cifre uma mensagem, apague um caractere do meio do texto cifrado e tente decifrar: por que o AES-GCM recusa?"]}
        revisao
      />
    </div>
  );
}

const GRAFO_EXEMPLO: Grafo = { nos: ["A", "B", "C", "D", "E", "F"], arestas: [["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5], ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3]] };
const POS: Record<string, [number, number]> = { A: [60, 120], B: [180, 50], C: [180, 190], D: [320, 50], E: [320, 190], F: [440, 120] };

/** Grafos: busca em largura, em profundidade e menor caminho (Dijkstra), num mapa de cidades com estradas. */
export function Grafos() {
  const [g, setG] = useState<Grafo>(GRAFO_EXEMPLO);
  const [inicio, setInicio] = useState("A");
  const [fim, setFim] = useState("F");
  const [modo, setModo] = useState<"largura" | "profundidade" | "caminho">("caminho");
  const [k, setK] = useState(99);
  const ordem = modo === "largura" ? largura(g, inicio) : modo === "profundidade" ? profundidade(g, inicio) : [];
  const mc = menorCaminho(g, inicio, fim);
  const naRota = (a: string, b: string) => mc.caminho.some((x, i) => i > 0 && ((mc.caminho[i - 1] === a && x === b) || (mc.caminho[i - 1] === b && x === a)));
  const visitados = ordem.slice(0, k);
  const mudarPeso = (i: number, w: number) => setG((x) => ({ ...x, arestas: x.arestas.map((e, j) => (j === i ? [e[0], e[1], w] : e)) }));
  return (
    <div>
      <Bancada titulo="Grafos" subtitulo="Cidades, estradas e o caminho mais curto">
        <div className="flex flex-wrap gap-4">
          <Escolha rotulo="O que fazer" valor={modo} opcoes={[["caminho", "Menor caminho"], ["largura", "Busca em largura"], ["profundidade", "Busca em profundidade"]]} mudar={(v) => { setModo(v); setK(1); }} />
          <Escolha rotulo="Saída" valor={inicio} opcoes={g.nos.map((x) => [x, x])} mudar={(v) => { setInicio(v); setK(1); }} />
          {modo === "caminho" && <Escolha rotulo="Chegada" valor={fim} opcoes={g.nos.map((x) => [x, x])} mudar={setFim} />}
        </div>
        <svg viewBox="0 0 500 240" className="mt-4 w-full rounded bg-[#f9f3e3]" role="img" aria-label={modo === "caminho" ? `Menor caminho de ${inicio} a ${fim}: ${mc.caminho.join(" → ")}, distância ${mc.distancia}` : `Ordem de visita: ${visitados.join(", ")}`}>
          {g.arestas.map(([a, b, w], i) => {
            const [x1, y1] = POS[a];
            const [x2, y2] = POS[b];
            const rota = modo === "caminho" && naRota(a, b);
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={rota ? "#c21f16" : "#8a7550"} strokeWidth={rota ? 6 : 3} />
                <rect x={(x1 + x2) / 2 - 12} y={(y1 + y2) / 2 - 11} width="24" height="20" rx="4" fill="#fff" stroke="#8a7550" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize="12" fontFamily="ui-monospace, monospace">{w}</text>
              </g>
            );
          })}
          {g.nos.map((no) => {
            const [x, y] = POS[no];
            const ordemDeVisita = visitados.indexOf(no);
            const marcado = modo === "caminho" ? mc.caminho.includes(no) : ordemDeVisita >= 0;
            return (
              <g key={no}>
                <circle cx={x} cy={y} r="22" fill={marcado ? "#c21f16" : "#17130e"} />
                <text x={x} y={y + 6} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#fff">{no}</text>
                {modo !== "caminho" && ordemDeVisita >= 0 && <text x={x + 20} y={y - 18} fontSize="12" fill="#c21f16" fontWeight="bold">{ordemDeVisita + 1}º</text>}
                {modo === "caminho" && Number.isFinite(mc.dist[no]) && <text x={x} y={y + 38} textAnchor="middle" fontSize="11" fill="#555">{mc.dist[no]} km</text>}
              </g>
            );
          })}
        </svg>
        {modo === "caminho" ? (
          <p className="mt-2 text-sm"><strong>Menor caminho:</strong> {mc.caminho.join(" → ")} · <strong>{mc.distancia} km</strong>. Os números embaixo de cada cidade são a menor distância a partir de {inicio}.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span><strong>Ordem de visita:</strong> {visitados.join(" → ")}</span>
            <BotaoClaro onClick={() => setK((x) => Math.min(ordem.length, x + 1))} desligado={k >= ordem.length}>Próxima cidade ▶</BotaoClaro>
            <BotaoClaro onClick={() => setK(1)}>Recomeçar</BotaoClaro>
          </div>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">Mudar as distâncias das estradas</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {g.arestas.map(([a, b, w], i) => <Deslizante key={i} rotulo={`${a} — ${b}`} valor={w} min={1} max={20} mudar={(v) => mudarPeso(i, v)} formato={(v) => `${v} km`} />)}
          </div>
        </details>
      </Bancada>
      <ComoUsar
        passos={["Escolha a cidade de saída (e a de chegada, no menor caminho).", "Veja o caminho em vermelho, ou avance a busca cidade por cidade.", "Mude as distâncias das estradas e veja o caminho se refazer."]}
        atividades={["De A até F, qual é o menor caminho? Agora aumente a estrada D—E para 15 km: o caminho muda?", "Compare a ordem da busca em largura com a da busca em profundidade saindo de A. Qual visita primeiro as cidades vizinhas?", "Pense na sua cidade: desenhe no caderno 5 lugares que você frequenta e as distâncias. Qual o melhor caminho para passar em todos?"]}
      />
    </div>
  );
}
