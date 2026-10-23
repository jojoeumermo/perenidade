// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Bancada, BotaoClaro, Deslizante, Escolha, Leitura, PrevejaRode } from "../kit";
import { comercialAcima, type CorDoLed, divisor, fonte, ldr, led, LEDS, PORTAS, type Porta, rc, resistorDoLed, type Retificacao, SERIE_E12, somar4, tabela } from "./conta-da-eletronica";

const num = (x: number, c = 2) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { maximumFractionDigits: c }) : "∞");
export function ohms(v: number) {
  if (v >= 1e6) return `${num(v / 1e6)} MΩ`;
  if (v >= 1e3) return `${num(v / 1e3)} kΩ`;
  return `${num(v)} Ω`;
}

const FAIXAS = ["#1a1a1a", "#7a4a1e", "#c62828", "#ef7d00", "#f5d000", "#2e7d32", "#1e56c8", "#7b3fa0", "#8a8a8a", "#f4f4f4"];
/** As três faixas de cor de um resistor (dois algarismos e o multiplicador). */
function faixasDe(v: number) {
  const exp = Math.floor(Math.log10(v)) - 1;
  const dois = Math.round(v / 10 ** exp);
  return [Math.floor(dois / 10), dois % 10, Math.max(0, exp)].map((i) => FAIXAS[i]);
}

/** Os furos de uma protoboard, como fundo. */
function Furos({ largura, altura }: { largura: number; altura: number }) {
  return (
    <>
      <defs>
        <pattern id="furos" width="16" height="16" patternUnits="userSpaceOnUse"><rect x="6" y="6" width="4" height="4" rx="1" fill="#c9c3b3" /></pattern>
        <filter id="brilho" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <rect width={largura} height={altura} rx="10" fill="#f3f0e7" stroke="#d8d2c2" strokeWidth="2" />
      <rect x="10" y="10" width={largura - 20} height={altura - 20} fill="url(#furos)" />
      <line x1="16" x2={largura - 16} y1="22" y2="22" stroke="#d33" strokeWidth="1.5" opacity="0.5" />
      <line x1="16" x2={largura - 16} y1={altura - 22} y2={altura - 22} stroke="#36c" strokeWidth="1.5" opacity="0.5" />
    </>
  );
}

const VALORES_R = [0, ...SERIE_E12.filter((v) => v >= 10 && v <= 100000)];
const MISSOES_LED = [
  { id: "a", texto: "Acenda o LED vermelho em 5 V na corrente certa (perto de 20 mA).", ok: (f: number, c: CorDoLed, e: string) => f === 5 && c === "vermelho" && e === "certo" },
  { id: "b", texto: "Acenda o LED azul com 3,3 V (a tensão das placas novas).", ok: (f: number, c: CorDoLed, e: string) => f === 3.3 && c === "azul" && (e === "certo" || e === "forte") },
  { id: "c", texto: "Em 12 V, acenda o LED verde sem esquentar o resistor de 1/4 W.", ok: (f: number, c: CorDoLed, e: string, quente: boolean) => f === 12 && c === "verde" && e === "certo" && !quente },
  { id: "d", texto: "Queime um LED de propósito (aqui pode).", ok: (_f: number, _c: CorDoLed, e: string) => e === "queimou" },
];

/** O LED e o resistor na protoboard: a primeira montagem de toda aula de eletrônica. */
export function LedResistor() {
  const [s, setS] = useState({ fonte: 5, cor: "vermelho" as CorDoLed, ir: VALORES_R.indexOf(150) });
  const [feitas, setFeitas] = useState<string[]>([]);
  const ohm = VALORES_R[s.ir];
  const r = led(s.fonte, s.cor, ohm);
  const recomendado = resistorDoLed(s.fonte, s.cor);
  function mudar(x: Partial<typeof s>) {
    const n = { ...s, ...x };
    setS(n);
    const rr = led(n.fonte, n.cor, VALORES_R[n.ir]);
    const novas = MISSOES_LED.filter((m) => m.ok(n.fonte, n.cor, rr.estado, rr.resistorEsquenta)).map((m) => m.id);
    if (novas.some((id) => !feitas.includes(id))) setFeitas((f) => [...new Set([...f, ...novas])]);
  }
  const corLed = LEDS[s.cor].cor;
  const queimou = r.estado === "queimou";
  const ESTADO = { apagado: "Apagado: a fonte não vence a tensão do LED", fraco: "Aceso fraquinho", certo: "Aceso na medida", forte: "Forte demais: vida curta", queimou: "Queimou!" };
  return (
    <Bancada titulo="LED e resistor" subtitulo="A primeira montagem na protoboard">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <svg viewBox="0 0 520 220" className="w-full" role="img" aria-label={`Protoboard: fonte de ${num(s.fonte)} V, resistor de ${ohms(ohm)} e LED ${s.cor}: ${ESTADO[r.estado]}`}>
            <Furos largura={520} altura={220} />
            {/* fonte */}
            <rect x="26" y="70" width="70" height="90" rx="6" fill="#26221c" />
            <text x="61" y="110" textAnchor="middle" fill="#f3f0e7" fontSize="18" fontFamily="ui-monospace, monospace">{num(s.fonte, 1)}V</text>
            <text x="61" y="132" textAnchor="middle" fill="#bbb" fontSize="11">fonte</text>
            <circle cx="96" cy="88" r="5" fill="#d33" /><circle cx="96" cy="142" r="5" fill="#36c" />
            {/* fios */}
            <path d="M96 88 H170" stroke="#d33" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M96 142 H170 V182 H420 V150" stroke="#222" strokeWidth="5" strokeLinecap="round" fill="none" />
            {/* resistor */}
            {ohm > 0 ? (
              <g>
                <line x1="170" y1="88" x2="320" y2="88" stroke="#9a9a9a" strokeWidth="4" />
                <rect x="200" y="74" width="90" height="28" rx="12" fill={r.resistorEsquenta ? "#e8a07a" : "#d9c08f"} stroke="#8a7550" strokeWidth="2" />
                {faixasDe(ohm).map((c, i) => <rect key={i} x={214 + i * 16} y="74" width="9" height="28" fill={c} />)}
                <rect x="268" y="74" width="9" height="28" fill="#c9a227" />
                {r.resistorEsquenta && <text x="245" y="64" textAnchor="middle" fontSize="18">🔥</text>}
              </g>
            ) : <line x1="170" y1="88" x2="320" y2="88" stroke="#d33" strokeWidth="5" />}
            <path d="M320 88 H400 V110" stroke="#9a9a9a" strokeWidth="4" fill="none" />
            {/* LED */}
            {!queimou && r.brilho > 0 && <circle cx="410" cy="112" r={24 + r.brilho * 18} fill={corLed} opacity={0.25 + r.brilho * 0.5} filter="url(#brilho)" />}
            <path d="M392 136 V108 a18 18 0 0 1 36 0 V136 Z" fill={queimou ? "#6b6b6b" : corLed} opacity={queimou ? 1 : 0.45 + r.brilho * 0.55} stroke="#555" strokeWidth="1.5" />
            <rect x="388" y="134" width="44" height="6" rx="2" fill={queimou ? "#555" : corLed} opacity="0.8" />
            <line x1="400" y1="140" x2="400" y2="150" stroke="#9a9a9a" strokeWidth="3" /><line x1="420" y1="140" x2="420" y2="150" stroke="#9a9a9a" strokeWidth="3" />
            {queimou && <text x="410" y="80" textAnchor="middle" fontSize="26">💨</text>}
            <text x="446" y="100" fontSize="11" fill="#555">+ ânodo</text>
            <text x="446" y="146" fontSize="11" fill="#555">− cátodo</text>
          </svg>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Leitura rotulo="Corrente" valor={Number.isFinite(r.i) ? `${num(r.i * 1000, 1)} mA` : "enorme"} destaque={r.estado === "queimou" || r.estado === "forte"} />
            <Leitura rotulo="Tensão no LED" valor={r.i > 0 ? `${num(r.vf, 1)} V` : `${num(s.fonte, 1)} V`} />
            <Leitura rotulo="Calor no resistor" valor={Number.isFinite(r.pResistor) ? `${num(r.pResistor, 3)} W` : "—"} destaque={r.resistorEsquenta} />
            <Leitura rotulo="LED" valor={r.estado === "certo" ? "✓ certo" : r.estado} destaque={queimou} />
          </div>
          <p className="mt-2 text-sm font-semibold">{ESTADO[r.estado]}</p>
        </div>
        <div className="space-y-4">
          <Escolha rotulo="Fonte" valor={String(s.fonte)} opcoes={[["3.3", "3,3 V"], ["5", "5 V (USB)"], ["9", "9 V (bateria)"], ["12", "12 V"]]} mudar={(v) => mudar({ fonte: Number(v) })} />
          <Escolha rotulo="Cor do LED" valor={s.cor} opcoes={(Object.keys(LEDS) as CorDoLed[]).map((c) => [c, `${LEDS[c].nome} (${num(LEDS[c].vf, 1)} V)`])} mudar={(v) => mudar({ cor: v })} />
          <Deslizante rotulo="Resistor" valor={s.ir} min={0} max={VALORES_R.length - 1} mudar={(v) => mudar({ ir: v })} formato={(i) => (VALORES_R[i] === 0 ? "sem resistor" : ohms(VALORES_R[i]))} />
          <p className="rounded bg-parchment-deep p-2 text-xs">Conta do resistor: ({num(s.fonte, 1)} − {num(LEDS[s.cor].vf, 1)}) ÷ 0,020 = <strong>{recomendado.conta > 0 ? ohms(recomendado.conta) : "—"}</strong>; o valor de loja logo acima é <strong>{recomendado.comercial ? ohms(comercialAcima(recomendado.conta)) : "—"}</strong>.</p>
          <ul className="space-y-1 text-sm">
            {MISSOES_LED.map((m) => <li key={m.id} className={feitas.includes(m.id) ? "text-[#1d6b3a]" : ""}>{feitas.includes(m.id) ? "✓" : "○"} {m.texto}</li>)}
          </ul>
        </div>
      </div>
      <div className="mt-5">
        <PrevejaRode pergunta="Se o LED precisa de só 2 V, por que não ligar direto nos 5 V da porta USB?" explicacao="O LED não segura a corrente sozinho: acima da tensão direta ele conduz quase sem resistência, e a corrente sobe até queimá-lo. O resistor fica com a sobra da tensão (5 − 2 = 3 V) e limita a corrente: I = 3 ÷ 150 = 20 mA." limites="A tensão direta muda com o modelo, a temperatura e a corrente; LEDs de potência precisam de driver de corrente, não só de resistor." aprofundar="Coloque dois LEDs vermelhos em série no lugar de um: qual resistor você usaria em 5 V? E em paralelo, por que cada LED precisa do seu próprio resistor?" />
      </div>
    </Bancada>
  );
}

const CAPACITORES: [string, string][] = [["0.00001", "10 µF"], ["0.0001", "100 µF"], ["0.00047", "470 µF"], ["0.001", "1.000 µF"]];
const RS_RC = SERIE_E12.filter((v) => v >= 1000 && v <= 100000);

/** O capacitor no osciloscópio: carrega e descarrega pela curva do RC, com o cursor andando no tempo. */
export function Capacitor() {
  const [ir, setIr] = useState(RS_RC.indexOf(10000));
  const [c, setC] = useState("0.0001");
  const [carregando, setCarregando] = useState(true);
  const [t, setT] = useState(0);
  const [rodando, setRodando] = useState(false);
  const R = RS_RC[ir];
  const tau = R * Number(c);
  const V = 9;
  useEffect(() => {
    if (!rodando) return;
    let id = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      // Cinco constantes de tempo em cinco segundos de tela, qualquer que seja o RC.
      const tt = ((agora - inicio) / 1000) * tau;
      if (tt >= 5 * tau) { setT(5 * tau); setRodando(false); return; }
      setT(tt);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [rodando, tau]);
  const v = rc(V, R, Number(c), t, carregando);
  const pontos = Array.from({ length: 101 }, (_, k) => { const tt = (k / 100) * 5 * tau; return [k * 5, 150 - (rc(V, R, Number(c), tt, carregando) / V) * 130] as const; });
  const ate = Math.round((t / (5 * tau)) * 100);
  function iniciar(carregar: boolean) { setCarregando(carregar); setT(0); setRodando(true); }
  return (
    <Bancada titulo="Capacitor e o tempo" subtitulo="Carga e descarga no osciloscópio">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <svg viewBox="0 0 520 170" className="w-full rounded bg-[#0f1a14]" role="img" aria-label={`Osciloscópio: o capacitor está em ${num(v, 1)} V`}>
            {Array.from({ length: 6 }, (_, k) => <line key={k} x1={10 + k * 100} x2={10 + k * 100} y1="10" y2="160" stroke="#2c4a3a" strokeDasharray={k ? "3 4" : undefined} />)}
            {[20, 85, 150].map((y) => <line key={y} x1="10" x2="510" y1={y} y2={y} stroke="#2c4a3a" strokeDasharray="3 4" />)}
            <line x1="10" x2="510" y1={150 - 0.632 * 130} y2={150 - 0.632 * 130} stroke="#ffd27a55" />
            <polyline points={pontos.map(([x, y]) => `${10 + x},${y}`).join(" ")} fill="none" stroke="#3ad17a33" strokeWidth="2" />
            <polyline points={pontos.slice(0, ate + 1).map(([x, y]) => `${10 + x},${y}`).join(" ")} fill="none" stroke="#3ad17a" strokeWidth="3" />
            <circle cx={10 + ate * 5} cy={150 - (v / V) * 130} r="5" fill="#ffd27a" />
            {[1, 2, 3, 4, 5].map((k) => <text key={k} x={10 + k * 100 - 4} y="168" fontSize="10" fill="#7fb59a">{k}τ</text>)}
          </svg>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Leitura rotulo="τ = R × C" valor={`${num(tau, tau < 1 ? 3 : 1)} s`} />
            <Leitura rotulo="Tempo" valor={`${num(t, 2)} s`} />
            <Leitura rotulo="No capacitor" valor={`${num(v, 2)} V`} />
            <Leitura rotulo="Carga" valor={`${num((v / V) * 100, 0)} %`} />
          </div>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo="Resistor" valor={ir} min={0} max={RS_RC.length - 1} mudar={(x) => { setIr(x); setRodando(false); setT(0); }} formato={(i) => ohms(RS_RC[i])} />
          <Escolha rotulo="Capacitor" valor={c} opcoes={CAPACITORES} mudar={(x) => { setC(x); setRodando(false); setT(0); }} />
          <div className="flex flex-wrap gap-2">
            <BotaoClaro onClick={() => iniciar(true)} desligado={rodando}>Carregar</BotaoClaro>
            <BotaoClaro onClick={() => iniciar(false)} desligado={rodando}>⤵ Descarregar</BotaoClaro>
          </div>
          <p className="text-xs text-ink-soft">A animação mostra sempre cinco τ em cinco segundos; o tempo de verdade está na leitura “Tempo”. A linha amarela marca 63%.</p>
        </div>
      </div>
      <div className="mt-5">
        <PrevejaRode pergunta="Dobrando o resistor, o capacitor demora o dobro, a metade ou o mesmo para carregar?" explicacao="O dobro: o tempo depende de τ = R × C. Em um τ o capacitor chega a 63%; em cinco τ, a 99%. Resistor maior deixa passar menos corrente, e o capacitor enche mais devagar. É o temporizador mais simples que existe (o pisca-pisca e a luz que demora a apagar usam isso)." limites="Capacitores reais têm tolerância grande (±20%) e vazam um pouco de carga; o modelo é ideal." aprofundar="Com 100 kΩ e 1.000 µF, quanto tempo leva para chegar a 99%? Confira na leitura." />
      </div>
    </Bancada>
  );
}

/** O desenho de cada porta (símbolo americano, o dos livros e das folhas de dados). */
function Simbolo({ p, saida }: { p: Porta; saida: boolean }) {
  const corpo = "#26221c";
  const bolinha = p === "NAO" || p === "NAOE" || p === "NAOU";
  const forma = p === "E" || p === "NAOE" ? "M60 20 H100 a40 40 0 0 1 0 80 H60 Z" : p === "NAO" ? "M60 20 L130 60 L60 100 Z" : "M55 20 Q85 60 55 100 Q120 100 140 60 Q120 20 55 20 Z";
  const ponta = p === "NAO" ? 130 : 140;
  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-xs" role="img" aria-label={`Porta ${PORTAS[p].nome}`}>
      {PORTAS[p].entradas === 2 ? <><line x1="0" y1="40" x2="66" y2="40" stroke={corpo} strokeWidth="3" /><line x1="0" y1="80" x2="66" y2="80" stroke={corpo} strokeWidth="3" /></> : <line x1="0" y1="60" x2="60" y2="60" stroke={corpo} strokeWidth="3" />}
      {p === "OUEX" && <path d="M45 20 Q75 60 45 100" fill="none" stroke={corpo} strokeWidth="3" />}
      <path d={forma} fill="#f3f0e7" stroke={corpo} strokeWidth="3" />
      {bolinha && <circle cx={ponta + 7} cy="60" r="7" fill="#f3f0e7" stroke={corpo} strokeWidth="3" />}
      <line x1={ponta + (bolinha ? 14 : 0)} y1="60" x2="190" y2="60" stroke={corpo} strokeWidth="3" />
      <circle cx="200" cy="60" r="12" fill={saida ? "#ff3b30" : "#5a2a28"} stroke={corpo} strokeWidth="2" />
      <text x="100" y="66" textAnchor="middle" fontSize="13" fontWeight="bold" fill={corpo}>{PORTAS[p].ingles}</text>
    </svg>
  );
}

function Chave({ rotulo, ligada, mudar }: { rotulo: string; ligada: boolean; mudar: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} onClick={mudar} className="flex cursor-pointer flex-col items-center gap-1 text-xs font-semibold">
      <span className={`relative h-10 w-6 rounded-full border-2 border-ink ${ligada ? "bg-[#c21f16]" : "bg-parchment-deep"}`}><span className={`absolute left-0.5 h-4 w-4 rounded-full bg-ink transition-all ${ligada ? "top-0.5" : "top-[1.1rem]"}`} /></span>
      {rotulo} = {ligada ? 1 : 0}
    </button>
  );
}

/** Portas lógicas e o somador: como o processador faz conta só com ligado e desligado. */
export function Logica() {
  const [aba, setAba] = useState<"portas" | "somador">("portas");
  const [p, setP] = useState<Porta>("E");
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [alvo, setAlvo] = useState<Porta>("OUEX");
  const [palpite, setPalpite] = useState<Porta | null>(null);
  const [x, setX] = useState(5);
  const [y, setY] = useState(9);
  const saida = PORTAS[p].f(a, b);
  const linhaAtual = PORTAS[p].entradas === 1 ? (a ? 2 : 0) : (a ? 2 : 0) + (b ? 1 : 0);
  const soma = somar4(x, y);
  const bits = (n: number) => [3, 2, 1, 0].map((i) => ((n >> i) & 1) === 1);
  const LISTA = Object.keys(PORTAS) as Porta[];
  return (
    <Bancada titulo="Portas lógicas" subtitulo="O processador por dentro: só 0 e 1">
      <Escolha rotulo="Bancada" valor={aba} opcoes={[["portas", "Portas e tabela-verdade"], ["somador", "Somador de 4 bits"]]} mudar={setAba} />
      {aba === "portas" ? (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <Escolha rotulo="Porta" valor={p} opcoes={LISTA.map((k) => [k, `${PORTAS[k].nome} (${PORTAS[k].ingles})`])} mudar={setP} />
            <div className="mt-4 flex items-center gap-4">
              <div className="flex flex-col gap-3"><Chave rotulo="A" ligada={a} mudar={() => setA(!a)} />{PORTAS[p].entradas === 2 && <Chave rotulo="B" ligada={b} mudar={() => setB(!b)} />}</div>
              <Simbolo p={p} saida={saida} />
            </div>
            <p className="mt-2 text-sm">Saída: <strong>{saida ? "1 (LED aceso)" : "0 (LED apagado)"}</strong></p>
          </div>
          <div>
            <table className="w-full max-w-xs border-2 border-ink text-center font-mono text-sm">
              <thead className="bg-ink text-parchment"><tr><th className="py-1">A</th>{PORTAS[p].entradas === 2 && <th>B</th>}<th>saída</th></tr></thead>
              <tbody>
                {(PORTAS[p].entradas === 2 ? [[0, 0], [0, 1], [1, 0], [1, 1]] : [[0, 0], [1, 0]]).map(([aa, bb]) => {
                  const k = aa * 2 + bb;
                  return <tr key={k} className={k === linhaAtual ? "bg-[#ffd27a]" : ""}><td className="py-1">{aa}</td>{PORTAS[p].entradas === 2 && <td>{bb}</td>}<td className="font-bold">{PORTAS[p].f(aa === 1, bb === 1) ? 1 : 0}</td></tr>;
                })}
              </tbody>
            </table>
            <div className="mt-4 rounded border-2 border-dashed border-ink/40 p-3 text-sm">
              <p className="font-semibold">Desafio: que porta tem esta tabela? <span className="font-mono">{tabela(alvo).split("").join(" ")}</span> <span className="text-xs text-ink-soft">(saídas para 00, 01, 10, 11)</span></p>
              <div className="mt-2 flex flex-wrap gap-1.5">{LISTA.filter((k) => PORTAS[k].entradas === 2).map((k) => <BotaoClaro key={k} onClick={() => setPalpite(k)}>{PORTAS[k].ingles}</BotaoClaro>)}</div>
              {palpite && <p className="mt-2">{palpite === alvo ? "✓ Isso! " : `✗ ${PORTAS[palpite].ingles} dá ${tabela(palpite)}. `}<button type="button" className="cursor-pointer underline" onClick={() => { const dois = LISTA.filter((k) => PORTAS[k].entradas === 2); setAlvo(dois[(dois.indexOf(alvo) + 2) % dois.length]); setPalpite(null); }}>Outra tabela</button></p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[{ nome: "Número A", n: x, set: setX }, { nome: "Número B", n: y, set: setY }].map((e) => (
              <div key={e.nome}>
                <p className="text-sm font-semibold">{e.nome} = {e.n}</p>
                <div className="mt-1 flex gap-3">{bits(e.n).map((on, i) => <Chave key={i} rotulo={String(8 >> i)} ligada={on} mudar={() => e.set(e.n ^ (8 >> i))} />)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded bg-[#17130e] p-4 text-parchment">
            <p className="text-xs uppercase tracking-widest text-parchment/70">Saída do somador</p>
            <div className="mt-2 flex items-end gap-4">
              <div className="flex flex-col items-center text-xs"><span className={`h-6 w-6 rounded-full ${soma.estouro ? "bg-[#ffd60a]" : "bg-[#3a3528]"}`} />estouro</div>
              {bits(soma.valor).map((on, i) => <div key={i} className="flex flex-col items-center text-xs"><span className={`h-6 w-6 rounded-full ${on ? "bg-[#ff3b30] shadow-[0_0_12px_#ff3b30]" : "bg-[#3a3528]"}`} />{8 >> i}</div>)}
              <p className="ml-auto font-mono text-2xl">{x} + {y} = {soma.estouro ? `${soma.valor} + 16` : soma.valor}</p>
            </div>
          </div>
          <p className="mt-3 text-sm">Cada coluna é um <strong>somador completo</strong>: duas portas OU exclusivo dão o bit da soma, duas portas E e uma OU dão o “vai um” para a coluna seguinte, igual à conta armada no papel. Com 4 bits cabe até 15; passou disso, acende o <strong>estouro</strong>.</p>
        </div>
      )}
      <div className="mt-5">
        <PrevejaRode pergunta="Dá para montar qualquer outra porta usando só portas NÃO-E (NAND)?" explicacao="Dá: ligando as duas entradas juntas, a NAND vira NÃO; uma NAND seguida de NÃO vira E; e com três NAND se faz OU. Por isso a NAND é chamada de porta universal, e fábricas de chips usam muitas delas." limites="Portas reais têm atraso (nanossegundos) e consomem energia a cada troca; é isso que limita a velocidade e esquenta o processador." aprofundar="Com quantos somadores completos dá para somar números até 255? E até 4 bilhões (32 bits)?" />
      </div>
    </Bancada>
  );
}

const CAPS_FILTRO = [0, 100, 220, 470, 1000, 2200, 4700];

/** A fonte de alimentação linear: da tomada (alternada) para a contínua que a eletrônica precisa. */
export function Fonte() {
  const [tipo, setTipo] = useState<Retificacao>("nenhuma");
  const [ic, setIc] = useState(0);
  const [carga, setCarga] = useState(100);
  const uf = CAPS_FILTRO[ic];
  const r = fonte(17, tipo, uf, carga);
  const escala = (v: number) => 90 - (v / 20) * 75;
  const caminho = (vs: number[]) => vs.map((v, k) => `${10 + (k / (vs.length - 1)) * 500},${escala(v)}`).join(" ");
  const pronta = tipo !== "nenhuma" && r.min > 0 && r.ripple < 1;
  return (
    <Bancada titulo="Fonte de alimentação" subtitulo="Transformador, diodos e capacitor de filtro">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <ol className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <li className="rounded bg-parchment-deep px-2 py-1">Tomada 127 V~</li><li aria-hidden>→</li>
            <li className="rounded bg-parchment-deep px-2 py-1">Transformador: 12 V~ (17 V de pico)</li><li aria-hidden>→</li>
            <li className={`rounded px-2 py-1 ${tipo !== "nenhuma" ? "bg-ink text-parchment" : "bg-parchment-deep"}`}>{tipo === "completa" ? "Ponte de 4 diodos" : tipo === "meia" ? "1 diodo" : "sem diodo"}</li><li aria-hidden>→</li>
            <li className={`rounded px-2 py-1 ${uf ? "bg-ink text-parchment" : "bg-parchment-deep"}`}>{uf ? `Capacitor ${num(uf, 0)} µF` : "sem filtro"}</li><li aria-hidden>→</li>
            <li className="rounded bg-parchment-deep px-2 py-1">Carga {carga} Ω</li>
          </ol>
          <svg viewBox="0 0 520 180" className="w-full rounded bg-[#0f1a14]" role="img" aria-label={`Osciloscópio da fonte: ondulação de ${num(r.ripple, 1)} V`}>
            {[15, 52.5, 90, 127.5, 165].map((y) => <line key={y} x1="10" x2="510" y1={y} y2={y} stroke="#2c4a3a" strokeDasharray={y === 90 ? undefined : "3 4"} />)}
            {[1, 2].map((k) => <line key={k} x1={10 + (k * 500) / 3} x2={10 + (k * 500) / 3} y1="10" y2="170" stroke="#2c4a3a" strokeDasharray="3 4" />)}
            <polyline points={caminho(r.entrada)} fill="none" stroke="#7fb59a88" strokeWidth="1.5" strokeDasharray="4 3" />
            <polyline points={caminho(r.saida)} fill="none" stroke="#ffd27a" strokeWidth="3" />
            <text x="14" y="26" fontSize="10" fill="#7fb59a">+20 V</text><text x="14" y="162" fontSize="10" fill="#7fb59a">−20 V</text>
            <text x="440" y="26" fontSize="10" fill="#7fb59a">três ciclos de 60 Hz</text>
          </svg>
          <p className="mt-1 text-xs"><span className="text-[#5a8f74]">tracejado:</span> o que sai do transformador · <span className="font-semibold text-[#a07a1a]">amarelo:</span> o que chega na carga</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Leitura rotulo="Máxima" valor={`${num(r.max, 1)} V`} />
            <Leitura rotulo="Mínima" valor={`${num(r.min, 1)} V`} destaque={r.min < 0} />
            <Leitura rotulo="Ondulação" valor={`${num(r.ripple, 2)} V`} destaque={r.ripple >= 1} />
            <Leitura rotulo="Média" valor={`${num(r.media, 1)} V`} />
          </div>
          <p className={`mt-2 text-sm font-semibold ${pronta ? "text-[#1d6b3a]" : ""}`}>{pronta ? "✓ Contínua e lisa o bastante para alimentar um circuito." : tipo === "nenhuma" ? "Ainda é alternada: troca de sinal 120 vezes por segundo." : r.min <= 0.01 ? "Já não fica negativa, mas pulsa até zero: um LED piscaria, um chip reiniciaria." : "Quase lá: ainda ondula mais de 1 V."}</p>
        </div>
        <div className="space-y-4">
          <Escolha rotulo="Retificação" valor={tipo} opcoes={[["nenhuma", "Nenhuma"], ["meia", "Meia onda"], ["completa", "Onda completa"]]} mudar={setTipo} />
          <Deslizante rotulo="Capacitor de filtro" valor={ic} min={0} max={CAPS_FILTRO.length - 1} mudar={setIc} formato={(i) => (CAPS_FILTRO[i] ? `${num(CAPS_FILTRO[i], 0)} µF` : "nenhum")} />
          <Deslizante rotulo="Carga (menos ohms = puxa mais corrente)" valor={carga} min={20} max={1000} passo={10} mudar={setCarga} formato={(v) => `${v} Ω · ${num((r.media / v) * 1000, 0)} mA`} />
        </div>
      </div>
      <div className="mt-5">
        <PrevejaRode pergunta="Com o mesmo capacitor, a onda completa ondula mais, menos ou igual à meia onda?" explicacao="Menos, cerca de metade: na onda completa o capacitor é recarregado 120 vezes por segundo, em vez de 60, então tem a metade do tempo para descarregar. Capacitor maior ou carga mais leve também diminuem a ondulação." limites="Fonte linear com diodos ideais de 0,7 V. A fonte do computador e o carregador de celular são chaveadas: retificam direto da tomada e trocam de tensão em alta frequência, com transformador pequeno." aprofundar="Depois do capacitor, fontes boas usam um regulador (como o 7805) para cravar 5 V. Que mínimo de entrada ele precisaria para funcionar?" />
      </div>
    </Bancada>
  );
}

const RS_SENSOR = [1000, 10000, 47000, 100000];

/** O poste que acende sozinho: um divisor de tensão com LDR e um comparador. */
export function SensorDeLuz() {
  const [lux, setLux] = useState(300);
  const [r1, setR1] = useState(10000);
  const rl = ldr(lux);
  const vout = divisor(5, r1, rl);
  const aceso = vout > 2.5;
  const limiar = Math.pow(200000 / r1, 1.25) - 1;
  const ceu = Math.min(1, lux / 600);
  const ceuCor = `rgb(${Math.round(20 + 150 * ceu)}, ${Math.round(28 + 170 * ceu)}, ${Math.round(60 + 180 * ceu)})`;
  const momento = lux < 5 ? "noite" : lux < 50 ? "anoitecer" : lux < 400 ? "sala iluminada" : "dia claro";
  return (
    <Bancada titulo="Sensor de luz" subtitulo="O poste que acende sozinho">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <svg viewBox="0 0 520 220" className="w-full rounded" role="img" aria-label={`Rua ao ${momento}: o poste está ${aceso ? "aceso" : "apagado"}`}>
            <rect width="520" height="220" fill={ceuCor} />
            {lux < 50 && [[60, 30], [140, 55], [300, 25], [420, 50], [480, 20]].map(([x, yy]) => <circle key={x} cx={x} cy={yy} r="1.6" fill="#fff" opacity={1 - lux / 50} />)}
            <circle cx="440" cy={lux < 50 ? 160 : 60 - ceu * 20} r="22" fill={lux < 50 ? "#f2e9c9" : "#ffd84d"} opacity={lux < 50 ? 0.5 : 1} />
            <rect y="180" width="520" height="40" fill="#3b3a36" />
            <rect x="140" y="60" width="8" height="120" fill="#555" />
            <path d="M144 62 Q180 40 210 62" fill="none" stroke="#555" strokeWidth="6" />
            {aceso && <path d="M196 66 L150 180 L270 180 Z" fill="#ffe27a" opacity="0.35" />}
            <rect x="196" y="60" width="28" height="10" rx="3" fill={aceso ? "#ffe27a" : "#888"} />
            {aceso && <circle cx="210" cy="68" r="22" fill="#ffe27a" opacity="0.5" filter="url(#brilhoSensor)" />}
            <defs><filter id="brilhoSensor" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8" /></filter></defs>
            <circle cx="160" cy="92" r="6" fill="#d9a441" stroke="#333" /><text x="170" y="96" fontSize="10" fill={ceu > 0.5 ? "#222" : "#ddd"}>LDR</text>
          </svg>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Leitura rotulo="Luz" valor={`${lux} lux`} />
            <Leitura rotulo="LDR" valor={ohms(rl)} />
            <Leitura rotulo="Saída do divisor" valor={`${num(vout, 2)} V`} destaque={aceso} />
            <Leitura rotulo="Acende abaixo de" valor={`${num(Math.max(0, limiar), 0)} lux`} />
          </div>
          <p className="mt-2 text-sm">O comparador acende o poste quando a saída passa de 2,5 V, a metade dos 5 V. Isso acontece quando o LDR fica maior que R1: <strong>{ohms(rl)} {rl > r1 ? ">" : "<"} {ohms(r1)}</strong>, poste {aceso ? "aceso" : "apagado"}.</p>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo={`Luz (${momento})`} valor={lux} min={0} max={1000} passo={5} mudar={setLux} formato={(v) => `${v} lux`} />
          <Escolha rotulo="Resistor fixo R1" valor={String(r1)} opcoes={RS_SENSOR.map((v) => [String(v), ohms(v)])} mudar={(v) => setR1(Number(v))} />
          <p className="rounded bg-parchment-deep p-2 font-mono text-xs">5 V ─ R1 ─┬─ LDR ─ 0 V<br />{"          "}└→ saída = 5 × LDR ÷ (R1 + LDR)</p>
        </div>
      </div>
      <div className="mt-5">
        <PrevejaRode pergunta="Com R1 de 1 kΩ, o poste vai acender só à noite?" explicacao="Não: com R1 pequeno, o LDR passa de 1 kΩ quase sempre, e o poste fica aceso até em sala iluminada. Para acender só ao anoitecer, R1 precisa ser maior (10 kΩ ou 47 kΩ). É assim que se calibra um sensor: o divisor transforma a resistência em tensão, e o resistor fixo escolhe o ponto de virada." limites="A curva do LDR varia muito de peça para peça; postes de verdade têm um atraso para não piscar com o farol de um carro (histerese)." aprofundar="Troque o LDR por um termistor (resistor que muda com a temperatura): que aparelho da sua casa poderia funcionar assim?" />
      </div>
    </Bancada>
  );
}
