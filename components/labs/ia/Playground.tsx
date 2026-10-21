// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Botao, Bancada, corDaSaida, Deslizante, Escolha, Grafico, Leitura, PrevejaRode } from "../kit";
import { type Ativacao, avaliar, CARACTERISTICAS, type Caracteristica, type Conjunto, criarRede, entradas, gerarDados, prever, type Rede, treinar } from "./motor";

/**
 * Playground de rede neural, no espírito do TensorFlow Playground, feito do zero: escolha os dados, as
 * características de entrada, as camadas, a ativação e veja a fronteira de decisão sendo aprendida, época a época.
 */
const CONJUNTOS: [Conjunto, string][] = [["circulo", "Círculo"], ["xor", "Quadrantes (XOR)"], ["nuvens", "Duas nuvens"], ["espiral", "Espiral"]];
const RES = 50;

export function Playground() {
  const [conjunto, setConjunto] = useState<Conjunto>("circulo");
  const [ruido, setRuido] = useState(0.1);
  const [semente, setSemente] = useState(7);
  const [usadas, setUsadas] = useState<Caracteristica[]>(["x1", "x2"]);
  const [ocultas, setOcultas] = useState<number[]>([4, 2]);
  const [ativacao, setAtivacao] = useState<Ativacao>("tanh");
  const [taxa, setTaxa] = useState(0.03);
  const [l2, setL2] = useState(0);
  const [lote, setLote] = useState(10);
  const [rodando, setRodando] = useState(false);
  const [epoca, setEpoca] = useState(0);
  const [historico, setHistorico] = useState<{ treino: number[]; teste: number[] }>({ treino: [], teste: [] });
  const [acertoTeste, setAcertoTeste] = useState(0);
  const rede = useRef<Rede | null>(null);
  const tela = useRef<HTMLCanvasElement>(null);

  // Os dados: metade para treinar, metade para testar (o teste mede se a rede generaliza ou só decorou).
  const pontos = useMemo(() => gerarDados(conjunto, 300, ruido, semente), [conjunto, ruido, semente]);
  // Os pontos alternam de classe (par, ímpar): a divisão pega dois de cada quatro, para treino e teste terem as duas cores.
  const treino = useMemo(() => pontos.filter((_, i) => i % 4 < 2), [pontos]);
  const teste = useMemo(() => pontos.filter((_, i) => i % 4 >= 2), [pontos]);
  const prep = (pts: typeof pontos) => pts.map((p) => ({ x: entradas(p.x, p.y, usadas), y: p.c }));
  const dadosTreino = useMemo(() => prep(treino), [treino, usadas]); // eslint-disable-line react-hooks/exhaustive-deps
  const dadosTeste = useMemo(() => prep(teste), [teste, usadas]); // eslint-disable-line react-hooks/exhaustive-deps

  function reiniciar() {
    rede.current = criarRede(Math.max(1, usadas.length), ocultas, ativacao, semente);
    setEpoca(0);
    setHistorico({ treino: [], teste: [] });
    setAcertoTeste(avaliar(rede.current, dadosTeste).acerto);
  }
  // Mudou a arquitetura ou os dados: rede nova.
  useEffect(() => {
    void Promise.resolve().then(reiniciar);
  }, [usadas, ocultas, ativacao, semente, conjunto, ruido]); // eslint-disable-line react-hooks/exhaustive-deps

  function passo(n: number) {
    if (!rede.current) return;
    for (let i = 0; i < n; i++) treinar(rede.current, dadosTreino, taxa, l2, lote, epoca + i);
    const t = avaliar(rede.current, dadosTreino).perda;
    const aval = avaliar(rede.current, dadosTeste);
    const v = aval.perda;
    setAcertoTeste(aval.acerto);
    setEpoca((e) => e + n);
    setHistorico((h) => ({ treino: [...h.treino, t].slice(-300), teste: [...h.teste, v].slice(-300) }));
  }
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => passo(1), 50);
    return () => window.clearInterval(id);
  });

  // Desenha o mapa de decisão e os pontos.
  useEffect(() => {
    const c = tela.current;
    const r = rede.current;
    if (!c || !r) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(RES, RES);
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const x = (i / (RES - 1)) * 12 - 6;
        const y = 6 - (j / (RES - 1)) * 12;
        const [cr, cg, cb] = corDaSaida(prever(r, entradas(x, y, usadas)));
        const k = (j * RES + i) * 4;
        img.data[k] = cr;
        img.data[k + 1] = cg;
        img.data[k + 2] = cb;
        img.data[k + 3] = 255;
      }
    }
    const temp = document.createElement("canvas");
    temp.width = RES;
    temp.height = RES;
    temp.getContext("2d")!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(temp, 0, 0, c.width, c.height);
    const px = (x: number) => ((x + 6) / 12) * c.width;
    const py = (y: number) => ((6 - y) / 12) * c.height;
    for (const [lista, cheio] of [[treino, true], [teste, false]] as const) {
      for (const p of lista) {
        ctx.beginPath();
        ctx.arc(px(p.x), py(p.y), 4, 0, Math.PI * 2);
        ctx.fillStyle = p.c === 1 ? "#1a4f9c" : "#c4561a";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        if (cheio) ctx.fill();
        else {
          ctx.fillStyle = "#ffffffaa";
          ctx.fill();
          ctx.strokeStyle = p.c === 1 ? "#1a4f9c" : "#c4561a";
        }
        ctx.stroke();
      }
    }
  }, [epoca, treino, teste, usadas, historico.treino.length]);

  const perdaTreino = historico.treino.at(-1);
  const perdaTeste = historico.teste.at(-1);
  const mudarCamada = (i: number, d: number) => setOcultas(ocultas.map((n, k) => (k === i ? Math.max(1, Math.min(8, n + d)) : n)));

  return (
    <Bancada
      titulo="Playground de rede neural"
      subtitulo="Uma rede de verdade, treinando no seu navegador"
      acoes={<>
        <Botao primario onClick={() => setRodando(!rodando)}>{rodando ? "⏸ Pausar" : "▶ Treinar"}</Botao>
        <Botao onClick={() => passo(1)} desligado={rodando}>+1 época</Botao>
        <Botao onClick={() => { setRodando(false); reiniciar(); }}>↺ Recomeçar</Botao>
      </>}
    >
      <div className="grid gap-5 xl:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <div className="space-y-4">
          <Escolha rotulo="Dados" valor={conjunto} opcoes={CONJUNTOS} mudar={setConjunto} />
          <Deslizante rotulo="Ruído" valor={ruido} min={0} max={1} passo={0.05} mudar={setRuido} formato={(v) => v.toFixed(2)} />
          <Deslizante rotulo="Semente (sorteio)" valor={semente} min={1} max={99} mudar={setSemente} />
          <div className="text-sm">
            <p className="font-semibold">Características de entrada</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CARACTERISTICAS.map((k) => {
                const ligada = usadas.includes(k);
                return <button key={k} type="button" aria-pressed={ligada} onClick={() => setUsadas(ligada ? (usadas.length > 1 ? usadas.filter((x) => x !== k) : usadas) : [...usadas, k])} className={`cursor-pointer rounded border-2 px-2 py-0.5 font-mono text-xs ${ligada ? "border-ink bg-ink text-parchment" : "border-ink/30"}`}>{k}</button>;
              })}
            </div>
          </div>
        </div>

        <div>
          <canvas ref={tela} width={420} height={420} className="mx-auto block aspect-square w-full max-w-[420px] rounded border-2 border-ink" role="img" aria-label="Mapa de decisão: azul é uma classe, laranja a outra; pontos cheios são de treino, vazados de teste" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Leitura rotulo="Época" valor={String(epoca)} />
            <Leitura rotulo="Perda treino" valor={perdaTreino !== undefined ? perdaTreino.toFixed(3) : "—"} />
            <Leitura rotulo="Perda teste" valor={perdaTeste !== undefined ? perdaTeste.toFixed(3) : "—"} destaque={perdaTreino !== undefined && perdaTeste !== undefined && perdaTeste > perdaTreino * 1.5} />
            <Leitura rotulo="Acerto teste" valor={`${(acertoTeste * 100).toFixed(0)}%`} />
          </div>
          <div className="mt-3"><Grafico series={[["#9ec5ff", historico.treino], ["#ffb27a", historico.teste]]} rotulos={["perda no treino", "perda no teste"]} /></div>
        </div>

        <div className="space-y-4">
          <div className="text-sm">
            <p className="font-semibold">Camadas ocultas</p>
            <div className="mt-1 space-y-1.5">
              {ocultas.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 text-xs">Camada {i + 1}</span>
                  <button type="button" className="h-7 w-7 cursor-pointer rounded border-2 border-ink font-bold" onClick={() => mudarCamada(i, -1)} aria-label="Menos neurônios">−</button>
                  <span className="flex gap-0.5" aria-label={`${n} neurônios`}>{Array.from({ length: n }, (_, k) => <span key={k} className="h-3 w-3 rounded-full bg-oxblood" />)}</span>
                  <button type="button" className="h-7 w-7 cursor-pointer rounded border-2 border-ink font-bold" onClick={() => mudarCamada(i, 1)} aria-label="Mais neurônios">+</button>
                </div>
              ))}
            </div>
            <p className="mt-2 flex gap-2">
              <button type="button" className="cursor-pointer text-xs underline" disabled={ocultas.length >= 4} onClick={() => setOcultas([...ocultas, 2])}>+ camada</button>
              <button type="button" className="cursor-pointer text-xs underline" disabled={ocultas.length === 0} onClick={() => setOcultas(ocultas.slice(0, -1))}>− camada</button>
            </p>
          </div>
          <Escolha rotulo="Ativação" valor={ativacao} opcoes={[["tanh", "tanh"], ["relu", "ReLU"], ["sigmoide", "sigmoide"], ["linear", "linear"]]} mudar={setAtivacao} />
          <Deslizante rotulo="Taxa de aprendizado" valor={taxa} min={0.001} max={0.3} passo={0.001} mudar={setTaxa} formato={(v) => v.toFixed(3)} />
          <Deslizante rotulo="Regularização (L2)" valor={l2} min={0} max={0.01} passo={0.0005} mudar={setL2} formato={(v) => v.toFixed(4)} />
          <Deslizante rotulo="Tamanho do lote" valor={lote} min={1} max={30} mudar={setLote} />
        </div>
      </div>
      <div className="mt-5">
        <PrevejaRode
          pergunta="Com os dados em espiral e só x1 e x2, uma rede de UMA camada com 2 neurônios consegue separar as cores?"
          explicacao="Não: com poucos neurônios a rede só traça fronteiras simples e a espiral exige uma curva complicada. Mais camadas e mais neurônios (ou características como sen x1) dão à rede o “material” para dobrar a fronteira. Mas rede grande demais pode decorar o treino: repare quando a perda do teste para de cair enquanto a do treino continua caindo."
          limites="É uma rede pequena, com dados de brinquedo em 2D. Redes de verdade têm milhões de pesos e dados de milhares de dimensões, mas a regra de aprendizado (descer o gradiente do erro) é a mesma."
          aprofundar="Ligue a regularização L2 numa rede grande com bastante ruído: a fronteira fica mais suave e o teste melhora? Por quê?"
        />
      </div>
    </Bancada>
  );
}
