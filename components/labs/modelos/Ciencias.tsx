// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bancada, Botao, Deslizante, Escolha, Grafico, Leitura, PrevejaRode } from "../kit";
import { fourier, lotkaVolterra, orbita, projetil, regraPasso, sir, vidaPasso } from "./motor";

/** Epidemia: o modelo SIR, com vacinação e distanciamento. */
export function Epidemia() {
  const [contato, setContato] = useState(0.3);
  const [recuperacao, setRecuperacao] = useState(10);
  const [vacinados, setVacinados] = useState(0);
  const [distancia, setDistancia] = useState(0);
  const beta = contato * (1 - distancia);
  const gama = 1 / recuperacao;
  const serie = useMemo(() => sir(250, beta, gama, vacinados), [beta, gama, vacinados]);
  const pico = Math.max(...serie.map((p) => p.I));
  const R0 = beta / gama;
  const limiar = Math.max(0, 1 - 1 / (contato / gama));
  return (
    <Bancada titulo="Epidemia (modelo SIR)" subtitulo="Suscetíveis, infectados e recuperados">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <Grafico series={[["#9ec5ff", serie.map((p) => p.S)], ["#ff6b5a", serie.map((p) => p.I)], ["#9fe0a8", serie.map((p) => p.R)]]} max={1} altura={180} rotulos={["suscetíveis", "infectados ao mesmo tempo", "recuperados ou vacinados"]} />
          <div className="mt-3 grid grid-cols-3 gap-2"><Leitura rotulo="R efetivo" valor={R0.toFixed(2)} destaque={R0 > 1} /><Leitura rotulo="Pico de infectados" valor={`${(pico * 100).toFixed(1)}%`} /><Leitura rotulo="Vacinação que barra o surto" valor={`${Math.round(limiar * 100)}%`} /></div>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo="Contágio por dia" valor={contato} min={0.05} max={0.8} passo={0.01} mudar={setContato} formato={(v) => v.toFixed(2)} />
          <Deslizante rotulo="Dias doente" valor={recuperacao} min={2} max={20} mudar={setRecuperacao} />
          <Deslizante rotulo="Vacinados no começo" valor={vacinados} min={0} max={0.95} passo={0.05} mudar={setVacinados} formato={(v) => `${Math.round(v * 100)}%`} />
          <Deslizante rotulo="Redução de contatos (máscara, distância)" valor={distancia} min={0} max={0.8} passo={0.05} mudar={setDistancia} formato={(v) => `${Math.round(v * 100)}%`} />
          <PrevejaRode pergunta="Para impedir o surto, é preciso vacinar todo mundo?" explicacao="Não: basta passar do limiar de imunidade coletiva, 1 − 1/R0. Acima dele, cada doente infecta menos de uma pessoa e a doença some sozinha; isso protege quem não pode se vacinar. Reduzir contatos achata o pico, o que alivia hospitais mesmo sem impedir o surto." limites="Modelo simplificado: população bem misturada, imunidade permanente e sem mortes, idades ou cidades. Serve para entender a lógica, não para prever uma epidemia real." aprofundar="Com R0 = 3, qual o limiar? E com uma doença que dura o dobro de dias?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Predador e presa: Lotka-Volterra. */
export function PredadorPresa() {
  const [a, setA] = useState(1.1);
  const [c, setC] = useState(0.4);
  const serie = useMemo(() => lotkaVolterra(3000, 0.01, { a, b: 0.4, c, d: 0.1 }, 10, 10), [a, c]);
  return (
    <Bancada titulo="Predador e presa (Lotka-Volterra)" subtitulo="Coelhos e raposas sobem e descem em ciclos">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <Grafico series={[["#9fe0a8", serie.map((p) => p[0])], ["#ff6b5a", serie.map((p) => p[1])]]} altura={170} rotulos={["presas", "predadores"]} />
          <svg viewBox="0 0 200 200" className="mx-auto mt-3 w-full max-w-[260px] rounded bg-[#17130e]" role="img" aria-label="Retrato de fase: predadores contra presas">
            <polyline fill="none" stroke="#ffd27a" strokeWidth={1.5} points={serie.map(([x, y]) => `${Math.min(200, x * 4)},${200 - Math.min(200, y * 10)}`).join(" ")} />
          </svg>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo="Nascimento das presas" valor={a} min={0.3} max={2} passo={0.05} mudar={setA} formato={(v) => v.toFixed(2)} />
          <Deslizante rotulo="Morte dos predadores" valor={c} min={0.1} max={1} passo={0.05} mudar={setC} formato={(v) => v.toFixed(2)} />
          <PrevejaRode pergunta="Quando os predadores estão no máximo, as presas estão…?" explicacao="Caindo, perto do mínimo: o pico dos predadores vem depois do das presas. Com muitas presas, os predadores se multiplicam; comem tanto que as presas somem; sem comida, os predadores morrem; e o ciclo recomeça. No retrato de fase, isso aparece como uma volta fechada." limites="Duas espécies, sem espaço, doenças nem limite de comida para as presas; a natureza tem muito mais variáveis." aprofundar="O que acontece se os predadores morrem mais rápido (aumente a morte)? Os ciclos ficam mais longos ou mais curtos?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Gravidade: órbitas e lançamento de projéteis. */
export function Gravidade() {
  const [velocidade, setVelocidade] = useState(1);
  const [angulo, setAngulo] = useState(45);
  const [vLanc, setVLanc] = useState(20);
  const o = useMemo(() => orbita(4000, 0.005, 1, velocidade), [velocidade]);
  const p = projetil(vLanc, angulo);
  const tipo = o.energia >= 0 ? "escapa (energia ≥ 0)" : Math.abs(velocidade - 1) < 0.02 ? "circular" : "elíptica";
  const px = (x: number) => 100 + x * 40;
  return (
    <Bancada titulo="Gravidade" subtitulo="Órbitas e lançamentos">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <svg viewBox="0 0 200 200" className="w-full rounded bg-[#0d0b08]" role="img" aria-label="Órbita de um planeta em volta de uma estrela">
            <circle cx={100} cy={100} r={6} fill="#ffd27a" />
            <polyline fill="none" stroke="#9ec5ff" strokeWidth={1} points={o.pts.filter((_, i) => i % 3 === 0).map(([x, y]) => `${px(x)},${px(y)}`).join(" ")} />
            <circle cx={px(1)} cy={100} r={3} fill="#9fe0a8" />
          </svg>
          <Deslizante rotulo="Velocidade do planeta (1 = órbita circular)" valor={velocidade} min={0.4} max={1.6} passo={0.02} mudar={setVelocidade} formato={(v) => v.toFixed(2)} />
          <p className="mt-2 text-sm">Órbita <strong>{tipo}</strong>. A velocidade de escape é √2 ≈ 1,41.</p>
        </div>
        <div>
          <svg viewBox="0 0 220 120" className="w-full rounded bg-[#17130e]" role="img" aria-label="Trajetória de um lançamento oblíquo">
            <polyline fill="none" stroke="#ffd27a" strokeWidth={2} points={Array.from({ length: 41 }, (_, i) => { const t = (p.tempo * i) / 40; const a = (angulo * Math.PI) / 180; return `${5 + vLanc * Math.cos(a) * t * 2},${115 - (vLanc * Math.sin(a) * t - 4.9 * t * t) * 2}`; }).join(" ")} />
          </svg>
          <Deslizante rotulo="Ângulo" valor={angulo} min={5} max={85} mudar={setAngulo} formato={(v) => `${v}°`} />
          <Deslizante rotulo="Velocidade (m/s)" valor={vLanc} min={5} max={40} mudar={setVLanc} />
          <div className="mt-2 grid grid-cols-3 gap-2"><Leitura rotulo="Alcance" valor={`${p.alcance.toFixed(1)} m`} /><Leitura rotulo="Altura" valor={`${p.altura.toFixed(1)} m`} /><Leitura rotulo="Tempo" valor={`${p.tempo.toFixed(1)} s`} /></div>
        </div>
      </div>
      <div className="mt-5">
        <PrevejaRode pergunta="Qual ângulo joga a bola mais longe? E dois ângulos diferentes podem dar o mesmo alcance?" explicacao="45° dá o maior alcance (sem resistência do ar), e ângulos que somam 90° (30° e 60°) caem no mesmo lugar, um baixo e rápido, outro alto e demorado. Na órbita, um pouquinho mais rápido que a circular vira elipse; acima da velocidade de escape, o planeta vai embora." limites="Sem resistência do ar e com uma estrela fixa; trajetórias reais de bola e de planetas sofrem atrito e a atração de outros corpos." aprofundar="Com resistência do ar, o melhor ângulo fica acima ou abaixo de 45°? Por quê?" />
      </div>
    </Bancada>
  );
}

/** Ondas: somar senos para desenhar outras ondas (série de Fourier) e ouvir (Web Audio, sem microfone). */
export function Ondas() {
  const [tipo, setTipo] = useState<"quadrada" | "serra" | "triangular">("quadrada");
  const [n, setN] = useState(3);
  const [tocando, setTocando] = useState(false);
  const pts = Array.from({ length: 300 }, (_, i) => { const t = (i / 299) * 4 * Math.PI; return `${i},${60 - fourier(tipo, n, t) * 45}`; }).join(" ");
  useEffect(() => {
    if (!tocando) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const real = new Float32Array(n * 2 + 2);
    const imag = new Float32Array(n * 2 + 2);
    for (let k = 1; k <= n; k++) {
      if (tipo === "quadrada") { const m = 2 * k - 1; if (m < imag.length) imag[m] = 1 / m; }
      else if (tipo === "serra") { if (k < imag.length) imag[k] = Math.pow(-1, k + 1) / k; }
      else { const m = 2 * k - 1; if (m < imag.length) imag[m] = Math.pow(-1, k - 1) / (m * m); }
    }
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    osc.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0.15;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    return () => { osc.stop(); void ctx.close(); };
  }, [tocando, tipo, n]);
  return (
    <Bancada titulo="Ondas e Fourier" subtitulo="Toda onda periódica é uma soma de senos" acoes={<Botao primario onClick={() => setTocando(!tocando)}>{tocando ? "Parar" : "Ouvir (220 Hz)"}</Botao>}>
      <Escolha rotulo="Onda que queremos montar" valor={tipo} opcoes={[["quadrada", "Quadrada"], ["serra", "Dente de serra"], ["triangular", "Triangular"]]} mudar={setTipo} />
      <svg viewBox="0 0 300 120" className="mt-3 w-full rounded bg-[#17130e]" role="img" aria-label="Soma de senos"><line x1={0} x2={300} y1={60} y2={60} stroke="#ffffff22" /><polyline fill="none" stroke="#ffd27a" strokeWidth={1.5} points={pts} /></svg>
      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Deslizante rotulo="Quantos senos somar" valor={n} min={1} max={60} mudar={setN} />
        <PrevejaRode pergunta="Com 1 seno, a onda já é quadrada? Quantos precisam?" explicacao="Com 1, é só um seno. A cada termo a soma fica mais parecida; com dezenas, quase quadrada, mas sempre com uma pontinha nos cantos (o fenômeno de Gibbs). Ouvindo, cada termo novo acrescenta um harmônico: é isso que dá o timbre diferente de cada instrumento." limites="O som sai pelo navegador, sem microfone e sem gravar nada." aprofundar="Por que a onda triangular converge bem mais rápido que a quadrada? Olhe o tamanho de cada termo." />
      </div>
    </Bancada>
  );
}

/** Autômatos celulares: o Jogo da Vida e as regras de uma linha. */
export function Automatos() {
  const L = 48;
  const [modo, setModo] = useState<"vida" | "regra">("vida");
  const [vida, setVida] = useState<boolean[]>(() => { const g = Array(L * L).fill(false); for (const [x, y] of [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2], [20, 20], [21, 20], [22, 20], [30, 10], [31, 10], [30, 11], [31, 11]]) g[y * L + x] = true; return g; });
  const [rodando, setRodando] = useState(false);
  const [geracao, setGeracao] = useState(0);
  const [regra, setRegra] = useState(110);
  useEffect(() => {
    if (!rodando || modo !== "vida") return;
    const id = window.setInterval(() => { setVida((g) => vidaPasso(g, L)); setGeracao((n) => n + 1); }, 100);
    return () => window.clearInterval(id);
  }, [rodando, modo]);
  const linhas = useMemo(() => {
    const W = 101;
    let l = Array(W).fill(false);
    l[regra === 110 ? W - 2 : Math.floor(W / 2)] = true;
    const out = [l];
    for (let i = 0; i < 60; i++) { l = regraPasso(l, regra); out.push(l); }
    return out;
  }, [regra]);
  return (
    <Bancada titulo="Autômatos celulares" subtitulo="Regras simples, padrões complexos" acoes={modo === "vida" ? <><Botao primario onClick={() => setRodando(!rodando)}>{rodando ? "⏸" : "▶ Rodar"}</Botao><Botao onClick={() => { setVida(Array(L * L).fill(false)); setGeracao(0); }}>Limpar</Botao></> : undefined}>
      <Escolha rotulo="Autômato" valor={modo} opcoes={[["vida", "Jogo da Vida"], ["regra", "Regra de uma linha"]]} mudar={setModo} />
      <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {modo === "vida" ? (
          <svg viewBox={`0 0 ${L} ${L}`} onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); const x = Math.floor(((e.clientX - b.left) / b.width) * L); const y = Math.floor(((e.clientY - b.top) / b.height) * L); setVida((g) => g.map((v, i) => (i === y * L + x ? !v : v))); }} className="mx-auto w-full max-w-[420px] cursor-crosshair rounded border-2 border-ink bg-[#17130e]" role="img" aria-label="Grade do Jogo da Vida: clique para ligar ou desligar uma célula">
            {vida.map((v, i) => (v ? <rect key={i} x={i % L} y={Math.floor(i / L)} width={0.95} height={0.95} fill="#9fe0a8" /> : null))}
          </svg>
        ) : (
          <svg viewBox="0 0 101 61" className="w-full rounded border-2 border-ink bg-[#17130e]" role="img" aria-label={`Regra ${regra}: cada linha é uma geração`}>
            {linhas.flatMap((l, y) => l.map((v, x) => (v ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#ffd27a" /> : null)))}
          </svg>
        )}
        <div className="space-y-4">
          {modo === "vida" ? <Leitura rotulo="Geração" valor={String(geracao)} /> : <Deslizante rotulo="Regra (0 a 255)" valor={regra} min={0} max={255} mudar={setRegra} />}
          <PrevejaRode
            pergunta={modo === "vida" ? "Uma célula nasce com 3 vizinhas vivas e sobrevive com 2 ou 3. Com regras tão simples, dá para ter coisas que andam?" : "A regra 110 cabe em 8 bits. Dá para fazer conta com ela?"}
            explicacao={modo === "vida" ? "Dá: o planador (no canto de cima) anda pela grade para sempre, e há padrões que piscam e outros que fabricam planadores. O Jogo da Vida é capaz, em teoria, de calcular qualquer coisa que um computador calcula." : "Dá: a regra 110 foi provada universal (Matthew Cook, 2004), capaz de qualquer cálculo. A regra 90 desenha o triângulo de Sierpinski; a 30 parece aleatória."}
            limites="Modelos matemáticos, não simulações de seres vivos." aprofundar={modo === "vida" ? "Desenhe uma linha de 3 células: o que acontece? E um quadrado 2×2?" : "Compare as regras 30, 90, 110 e 184. Qual parece trânsito de carros?"} />
        </div>
      </div>
    </Bancada>
  );
}
