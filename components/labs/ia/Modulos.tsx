// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bancada, Botao, BotaoClaro, corDaSaida, Deslizante, Grafico, Leitura, PrevejaRode } from "../kit";
import { ajustarPolinomio, bigramas, knn, normal, passoKMedias, type Ponto, polinomio, proximas, sorteio } from "./motor";

/** k vizinhos: clique para pôr pontos (azul ou laranja) e veja como k muda as regiões. */
export function Vizinhos() {
  const [pontos, setPontos] = useState<Ponto[]>(() => {
    const r = sorteio(3);
    return Array.from({ length: 24 }, (_, i) => ({ x: (i % 2 ? 2 : -2) + normal(r) * 1.6, y: (i % 2 ? 1.5 : -1.5) + normal(r) * 1.6, c: i % 2 ? 1 : -1 }));
  });
  const [k, setK] = useState(3);
  const [cor, setCor] = useState<1 | -1>(1);
  const tela = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = tela.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const res = 40;
    const t = c.width / res;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const [r, g, b] = corDaSaida(knn(pontos, (i / res) * 12 - 6, 6 - (j / res) * 12, Math.min(k, pontos.length)) * 0.55);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(i * t, j * t, t + 1, t + 1);
    }
    for (const p of pontos) {
      ctx.beginPath();
      ctx.arc(((p.x + 6) / 12) * c.width, ((6 - p.y) / 12) * c.height, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.c === 1 ? "#1a4f9c" : "#c4561a";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [pontos, k]);
  return (
    <Bancada titulo="k vizinhos mais próximos" subtitulo="Classificar pelo que está perto" acoes={<><Botao onClick={() => setPontos([])}>Limpar</Botao></>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <canvas ref={tela} width={420} height={420} onClick={(e) => {
          const b = e.currentTarget.getBoundingClientRect();
          setPontos([...pontos, { x: ((e.clientX - b.left) / b.width) * 12 - 6, y: 6 - ((e.clientY - b.top) / b.height) * 12, c: cor }]);
        }} className="mx-auto block aspect-square w-full max-w-[420px] cursor-crosshair rounded border-2 border-ink" role="img" aria-label="Clique para pôr um ponto da cor escolhida" />
        <div className="space-y-4">
          <Deslizante rotulo="k (quantos vizinhos votam)" valor={k} min={1} max={15} passo={2} mudar={setK} />
          <div className="flex gap-2 text-sm">
            <button type="button" aria-pressed={cor === 1} onClick={() => setCor(1)} className={`flex-1 cursor-pointer rounded border-2 px-2 py-1.5 font-semibold ${cor === 1 ? "border-[#1a4f9c] bg-[#1a4f9c] text-white" : "border-[#1a4f9c]"}`}>Pôr azul</button>
            <button type="button" aria-pressed={cor === -1} onClick={() => setCor(-1)} className={`flex-1 cursor-pointer rounded border-2 px-2 py-1.5 font-semibold ${cor === -1 ? "border-[#c4561a] bg-[#c4561a] text-white" : "border-[#c4561a]"}`}>Pôr laranja</button>
          </div>
          <Leitura rotulo="Pontos" valor={String(pontos.length)} />
          <PrevejaRode pergunta="Com k = 1, um ponto laranja perdido no meio dos azuis cria uma ilha laranja. E com k = 9?" explicacao="Com k = 1 cada ponto manda sozinho na vizinhança, e qualquer ponto fora do lugar (ruído) vira uma ilha. Com k maior, os vizinhos votam e a fronteira fica mais suave, ignorando pontos isolados; k grande demais apaga detalhes de verdade." limites="Mede distância em linha reta e trata todas as direções igual; com muitas dimensões, “perto” perde o sentido." aprofundar="Ponha três azuis num canto cheio de laranjas: qual o menor k que faz o canto virar laranja?" />
        </div>
      </div>
    </Bancada>
  );
}

/** k-médias: agrupar sem saber as respostas, passo a passo. */
export function KMedias() {
  const [semente, setSemente] = useState(4);
  const [k, setK] = useState(3);
  const pts = useMemo(() => {
    const r = sorteio(semente);
    const centros = Array.from({ length: 4 }, () => ({ x: (r() - 0.5) * 8, y: (r() - 0.5) * 8 }));
    return Array.from({ length: 160 }, (_, i) => ({ x: centros[i % 4].x + normal(r) * 0.9, y: centros[i % 4].y + normal(r) * 0.9 }));
  }, [semente]);
  const inicio = useMemo(() => { const r = sorteio(semente * 7 + k); return Array.from({ length: k }, () => ({ x: (r() - 0.5) * 10, y: (r() - 0.5) * 10 })); }, [semente, k]);
  const [estado, setEstado] = useState({ centros: inicio, grupo: pts.map(() => -1), inercias: [] as number[] });
  useEffect(() => { void Promise.resolve().then(() => setEstado({ centros: inicio, grupo: pts.map(() => -1), inercias: [] })); }, [inicio, pts]);
  const CORES = ["#1a4f9c", "#c4561a", "#2e8b57", "#7a1f7a", "#b58900", "#0e7c86"];
  const passo = () => { const r = passoKMedias(pts, estado.centros); setEstado({ centros: r.centros, grupo: r.grupo, inercias: [...estado.inercias, r.inercia] }); };
  const px = (x: number) => ((x + 6) / 12) * 400;
  const py = (y: number) => ((6 - y) / 12) * 400;
  return (
    <Bancada titulo="Agrupamento (k-médias)" subtitulo="A máquina acha grupos sem ninguém dizer quais são" acoes={<><Botao primario onClick={passo}>Próximo passo</Botao><Botao onClick={() => setEstado({ centros: inicio, grupo: pts.map(() => -1), inercias: [] })}>↺</Botao></>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <svg viewBox="0 0 400 400" className="mx-auto w-full max-w-[420px] rounded border-2 border-ink bg-[#17130e]" role="img" aria-label="Pontos coloridos pelo grupo e os centros marcados com X">
          {pts.map((p, i) => <circle key={i} cx={px(p.x)} cy={py(p.y)} r={4} fill={estado.grupo[i] >= 0 ? CORES[estado.grupo[i]] : "#9a9a9a"} />)}
          {estado.centros.map((c, i) => <g key={i} transform={`translate(${px(c.x)},${py(c.y)})`}><path d="M-9-9L9 9M9-9L-9 9" stroke="#fff" strokeWidth={6} /><path d="M-9-9L9 9M9-9L-9 9" stroke={CORES[i]} strokeWidth={3} /></g>)}
        </svg>
        <div className="space-y-4">
          <Deslizante rotulo="k (quantos grupos)" valor={k} min={2} max={6} mudar={setK} />
          <Deslizante rotulo="Semente dos dados" valor={semente} min={1} max={50} mudar={setSemente} />
          <Leitura rotulo="Passos" valor={String(estado.inercias.length)} />
          <Grafico series={[["#ffd27a", estado.inercias]]} rotulos={["distância total aos centros"]} />
          <PrevejaRode pergunta="Os dados têm 4 grupos. Se você pedir k = 2, o que a máquina faz?" explicacao="Ela junta grupos vizinhos: o k-médias sempre acha exatamente k grupos, mesmo que não façam sentido. A distância total cai a cada passo até parar; o resultado depende de onde os centros começam (mude a semente)." limites="Supõe grupos redondos e de tamanho parecido; erra com grupos alongados ou de densidades diferentes." aprofundar="Rode com k de 2 a 6 e anote a distância final: onde ela para de cair muito? Esse “cotovelo” sugere o número de grupos." />
        </div>
      </div>
    </Bancada>
  );
}

/** Ajuste de curva e o perigo de decorar: grau baixo erra, grau alto decora o ruído. */
export function Sobreajuste() {
  const [grau, setGrau] = useState(1);
  const [ruido, setRuido] = useState(0.4);
  const { treino, teste } = useMemo(() => {
    const r = sorteio(11);
    const f = (x: number) => Math.sin(x * 1.2) * 2;
    const mk = (n: number, d: number) => Array.from({ length: n }, (_, i) => { const x = -3 + (6 * (i + d)) / n; return { x, y: f(x) + normal(r) * ruido }; });
    return { treino: mk(12, 0.2), teste: mk(12, 0.7) };
  }, [ruido]);
  const coef = useMemo(() => ajustarPolinomio(treino.map((p) => p.x / 3), treino.map((p) => p.y), grau), [treino, grau]);
  const prev = (x: number) => polinomio(coef, x / 3);
  const erro = (pts: { x: number; y: number }[]) => pts.reduce((s, p) => s + (prev(p.x) - p.y) ** 2, 0) / pts.length;
  const px = (x: number) => ((x + 3.2) / 6.4) * 400;
  const py = (y: number) => 150 - y * 40;
  const curva = Array.from({ length: 200 }, (_, i) => { const x = -3 + (6 * i) / 199; return `${px(x)},${Math.max(-20, Math.min(320, py(prev(x))))}`; }).join(" ");
  const [et, ev] = [erro(treino), erro(teste)];
  return (
    <Bancada titulo="Ajuste demais (sobreajuste)" subtitulo="Quando o modelo decora em vez de aprender">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <svg viewBox="0 0 400 300" className="w-full rounded border-2 border-ink bg-[#17130e]" role="img" aria-label="Pontos de treino e de teste e a curva ajustada">
          <polyline points={curva} fill="none" stroke="#ffd27a" strokeWidth={2.5} />
          {treino.map((p, i) => <circle key={`t${i}`} cx={px(p.x)} cy={py(p.y)} r={5} fill="#9ec5ff" />)}
          {teste.map((p, i) => <circle key={`v${i}`} cx={px(p.x)} cy={py(p.y)} r={5} fill="none" stroke="#ffb27a" strokeWidth={2} />)}
        </svg>
        <div className="space-y-4">
          <Deslizante rotulo="Grau do polinômio" valor={grau} min={1} max={11} mudar={setGrau} />
          <Deslizante rotulo="Ruído nos dados" valor={ruido} min={0} max={1.2} passo={0.05} mudar={setRuido} formato={(v) => v.toFixed(2)} />
          <div className="grid grid-cols-2 gap-2"><Leitura rotulo="Erro treino" valor={et.toFixed(3)} /><Leitura rotulo="Erro teste" valor={ev.toFixed(3)} destaque={ev > et * 2} /></div>
          <p className="text-xs">Azul cheio: pontos de treino (o modelo vê). Laranja vazado: teste (o modelo nunca vê).</p>
          <PrevejaRode pergunta="Aumentando o grau até 11, o erro no TREINO só cai. E o erro no TESTE?" explicacao="Cai no começo e depois sobe: com grau alto a curva passa por todos os pontos de treino, inclusive o ruído, e entorta entre eles. É o sobreajuste: decorar o treino em vez de aprender o padrão. Por isso sempre se mede num conjunto separado." limites="Um polinômio é um modelo simples; redes neurais sobreajustam do mesmo jeito, só que com muito mais parâmetros." aprofundar="Zere o ruído: o grau alto ainda atrapalha? E com ruído alto, qual grau dá o menor erro de teste?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Texto padrão: parlendas e fábulas recontadas pelo instituto (sem direitos de terceiros). */
const TEXTO_PADRAO = "Hoje é domingo, pede cachimbo. O cachimbo é de barro, bate no jarro. O jarro é de ouro, bate no touro. O touro é valente, bate na gente. A gente é fraco, cai no buraco. O buraco é fundo, acabou-se o mundo. Uma raposa com muita fome viu um cacho de uvas lá no alto. A raposa pulou uma vez, a raposa pulou duas vezes e não alcançou. Então a raposa disse que as uvas estavam verdes. Um ratinho acordou o leão. O leão soltou o ratinho. Depois o leão ficou preso na rede e o ratinho roeu a rede. O ratinho ajudou o leão e o leão agradeceu ao ratinho.";

/** A próxima palavra: o que um modelo de linguagem faz, em miniatura, contando pares de palavras. */
export function ProximaPalavra() {
  const [texto, setTexto] = useState(TEXTO_PADRAO);
  const [frase, setFrase] = useState(["a", "raposa"]);
  const [temperatura, setTemperatura] = useState(1);
  const [semente, setSemente] = useState(1);
  const modelo = useMemo(() => bigramas(texto), [texto]);
  const ops = proximas(modelo, frase.at(-1) ?? "", temperatura);
  function sortear() {
    const r = sorteio(semente * 977 + frase.length);
    let x = r();
    for (const [p, prob] of ops) { x -= prob; if (x <= 0) { setFrase([...frase, p]); return; } }
    if (ops.length) setFrase([...frase, ops[0][0]]);
  }
  return (
    <Bancada titulo="A próxima palavra" subtitulo="Como um modelo de linguagem escreve, em miniatura">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <p className="min-h-24 rounded border-2 border-ink bg-[#17130e] p-4 font-serif text-2xl leading-snug text-parchment">{frase.join(" ")}<span className="animate-pulse motion-reduce:animate-none">▍</span></p>
          <p className="mt-3 text-sm font-semibold">Depois de “{frase.at(-1)}”, o modelo dá estas chances:</p>
          <ul className="mt-2 space-y-1">
            {ops.slice(0, 8).map(([p, prob]) => (
              <li key={p}><button type="button" onClick={() => setFrase([...frase, p])} className="flex w-full cursor-pointer items-center gap-2 text-left text-sm hover:text-oxblood">
                <span className="w-24 truncate font-mono">{p}</span>
                <span className="h-3 rounded bg-oxblood" style={{ width: `${Math.max(2, prob * 100)}%` }} />
                <span className="font-mono text-xs tabular-nums">{(prob * 100).toFixed(0)}%</span>
              </button></li>
            ))}
            {ops.length === 0 && <li className="text-sm text-ink-soft">Essa palavra não aparece seguida de nada no texto. Recomece.</li>}
          </ul>
          <p className="mt-3 flex flex-wrap gap-2">
            <BotaoClaro onClick={sortear} desligado={ops.length === 0}>Sortear a próxima</BotaoClaro>
            <BotaoClaro onClick={() => { for (let i = 0; i < 8; i++) setSemente((s) => s + 1); sortear(); }} desligado={ops.length === 0}>Outra semente</BotaoClaro>
            <BotaoClaro onClick={() => setFrase(frase.slice(0, -1))} desligado={frase.length <= 1}>⌫</BotaoClaro>
            <BotaoClaro onClick={() => setFrase(["a", "raposa"])}>Recomeçar</BotaoClaro>
          </p>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo="Temperatura" valor={temperatura} min={0.1} max={3} passo={0.1} mudar={setTemperatura} formato={(v) => v.toFixed(1)} />
          <label className="block text-sm"><span className="font-semibold">O texto que o modelo “leu” (troque à vontade)</span><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} className="mt-1 w-full border-2 border-ink/30 bg-parchment p-2 text-sm" /></label>
          <PrevejaRode pergunta="Com a temperatura em 0,1, o modelo vai escrever sempre a mesma coisa?" explicacao="Sim: com temperatura baixa ele quase sempre escolhe a palavra mais frequente, e o texto fica repetitivo. Com temperatura alta, as palavras raras ganham chance e o texto fica mais variado (e mais sem sentido). Modelos grandes fazem a mesma conta, só que olhando muitas palavras para trás, não só uma, e com bilhões de exemplos." limites="Aqui o modelo só vê a última palavra e só conhece o texto ao lado. Ele não “entende” nada: repete padrões de frequência." aprofundar="Cole um texto seu (uma notícia, uma letra de música) e veja que o “estilo” muda. De onde vem o que um modelo escreve?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Viés em algoritmos: um sistema que aprende com decisões passadas aprende também o preconceito delas. */
export function Vies() {
  const [viesHistorico, setViesHistorico] = useState(0.3);
  const [usarBairro, setUsarBairro] = useState(true);
  const { aprovA, aprovB, peso } = useMemo(() => {
    // Candidatos fictícios: nota de 0 a 10, bairro A ou B. No histórico, quem é do bairro B foi aprovado menos, com a mesma nota.
    const r = sorteio(21);
    const hist = Array.from({ length: 400 }, (_, i) => {
      const bairroB = i % 2 === 1;
      const nota = r() * 10;
      const chance = 1 / (1 + Math.exp(-(nota - 5) * 1.2 + (bairroB ? viesHistorico * 6 : 0)));
      return { nota, b: bairroB ? 1 : 0, aprovado: r() < chance ? 1 : 0 };
    });
    // Regressão logística simples treinada no histórico.
    let w0 = 0, wn = 0, wb = 0;
    for (let e = 0; e < 300; e++) {
      let g0 = 0, gn = 0, gb = 0;
      for (const h of hist) {
        const p = 1 / (1 + Math.exp(-(w0 + wn * (h.nota - 5) + (usarBairro ? wb * h.b : 0))));
        g0 += p - h.aprovado; gn += (p - h.aprovado) * (h.nota - 5); gb += (p - h.aprovado) * h.b;
      }
      w0 -= 0.05 * g0 / hist.length; wn -= 0.05 * gn / hist.length; if (usarBairro) wb -= 0.05 * gb / hist.length;
    }
    // Candidatos novos, iguais nos dois bairros (mesma nota): quantos o sistema aprova?
    const novos = Array.from({ length: 100 }, (_, i) => 4 + (i / 99) * 4);
    const taxa = (b: number) => novos.filter((n) => 1 / (1 + Math.exp(-(w0 + wn * (n - 5) + (usarBairro ? wb * b : 0)))) > 0.5).length;
    return { aprovA: taxa(0), aprovB: taxa(1), peso: wb };
  }, [viesHistorico, usarBairro]);
  return (
    <Bancada titulo="Viés em algoritmos" subtitulo="O sistema aprende o preconceito dos dados (dados fictícios)">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <p className="text-sm">Um sistema de seleção aprende com 400 decisões antigas. Depois, julga 100 candidatos novos de cada bairro, <strong>com exatamente as mesmas notas</strong>.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {[["Bairro A", aprovA, "#1a4f9c"], ["Bairro B", aprovB, "#c4561a"]].map(([nome, n, cor]) => (
              <div key={String(nome)} className="rounded border-2 border-ink p-3 text-center">
                <p className="font-semibold">{nome}</p>
                <div className="mx-auto mt-2 flex h-40 w-16 items-end rounded bg-[#17130e]"><div className="w-full rounded" style={{ height: `${n}%`, background: String(cor) }} /></div>
                <p className="mt-2 font-mono text-2xl font-semibold">{n} aprovados</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm">Peso que o sistema deu ao bairro: <span className="font-mono">{peso.toFixed(2)}</span> {usarBairro ? "" : "(o bairro foi tirado dos dados)"}</p>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo="Preconceito nas decisões antigas" valor={viesHistorico} min={0} max={1} passo={0.05} mudar={setViesHistorico} formato={(v) => `${Math.round(v * 100)}%`} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usarBairro} onChange={(e) => setUsarBairro(e.target.checked)} /> O sistema vê o bairro</label>
          <PrevejaRode pergunta="Se tirarmos o bairro dos dados, o viés some?" explicacao="Aqui sim, porque a nota não depende do bairro. Na vida real, quase nunca: outras informações (escola, CEP, sobrenome, horário de uso) funcionam como pistas do bairro, e o sistema reaprende o preconceito por elas. Tirar a coluna não basta; é preciso medir o resultado por grupo e corrigir." limites="Dados inventados e um modelo simples (regressão logística). O fenômeno, porém, já foi documentado em sistemas reais de crédito, emprego e policiamento." aprofundar="Com o preconceito em 0%, os dois bairros empatam? E com 100%? Quem decide o que é um resultado “justo”?" />
        </div>
      </div>
    </Bancada>
  );
}
