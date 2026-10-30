// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bancada, Botao, Deslizante, Escolha, Grafico, Leitura, PrevejaRode } from "../kit";
import { aniversarioExato, campeonato, type Celula, type Estrategia, ESTRATEGIAS, gini, mediasDeDados, montyHall, moedas, schellingInicial, schellingPasso, segregacao, yardSale } from "./motor";

/** Probabilidade: moedas (lei dos grandes números), Monty Hall, aniversários e médias de dados (teorema central do limite). */
export function Probabilidade() {
  const [qual, setQual] = useState<"moedas" | "monty" | "aniversario" | "tlc">("moedas");
  const [semente, setSemente] = useState(1);
  const [n, setN] = useState(500);
  const [pessoas, setPessoas] = useState(23);
  const [k, setK] = useState(5);
  const serie = useMemo(() => moedas(n, semente), [n, semente]);
  const mh = useMemo(() => montyHall(n, semente), [n, semente]);
  const medias = useMemo(() => mediasDeDados(2000, k, semente), [k, semente]);
  const caixas = useMemo(() => { const h = Array(25).fill(0); for (const m of medias) h[Math.min(24, Math.floor(((m - 1) / 5) * 25))]++; return h; }, [medias]);
  return (
    <Bancada titulo="Probabilidade" subtitulo="Quando o acaso vira regra" acoes={<Botao onClick={() => setSemente(semente + 1)}>Outra semente ({semente})</Botao>}>
      <Escolha rotulo="Experimento" valor={qual} opcoes={[["moedas", "Moedas"], ["monty", "Monty Hall"], ["aniversario", "Aniversários"], ["tlc", "Médias de dados"]]} mudar={setQual} />
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          {qual === "moedas" && <><Grafico series={[["#ffd27a", serie], ["#ffffff44", serie.map(() => 0.5)]]} max={1} altura={160} rotulos={["fração de caras", "50%"]} /><p className="mt-2 text-sm">Depois de {n} lançamentos: <strong>{(serie.at(-1)! * 100).toFixed(1)}% de caras</strong>.</p></>}
          {qual === "monty" && (
            <div className="grid grid-cols-2 gap-3">
              {[["Ficando com a porta", mh.ficando, "#c4561a"], ["Trocando de porta", mh.trocando, "#2e8b57"]].map(([nome, v, cor]) => (
                <div key={String(nome)} className="rounded border-2 border-ink p-3 text-center"><p className="font-semibold">{nome}</p><div className="mx-auto mt-2 flex h-40 w-14 items-end rounded bg-[#17130e]"><div className="w-full rounded" style={{ height: `${Number(v) * 100}%`, background: String(cor) }} /></div><p className="mt-1 font-mono text-xl">{(Number(v) * 100).toFixed(1)}%</p></div>
              ))}
            </div>
          )}
          {qual === "aniversario" && (
            <>
              <Grafico series={[["#9ec5ff", Array.from({ length: 70 }, (_, i) => aniversarioExato(i + 1))], ["#ffffff44", Array.from({ length: 70 }, () => 0.5)]]} max={1} altura={160} rotulos={["chance de pelo menos dois aniversários iguais (1 a 70 pessoas)", "50%"]} />
              <p className="mt-2 text-sm">Com <strong>{pessoas} pessoas</strong>, a chance é <strong>{(aniversarioExato(pessoas) * 100).toFixed(1)}%</strong>.</p>
            </>
          )}
          {qual === "tlc" && (
            <svg viewBox="0 0 250 120" className="w-full rounded bg-[#17130e]" role="img" aria-label="Histograma das médias">
              {caixas.map((c, i) => <rect key={i} x={i * 10 + 1} y={120 - (c / Math.max(...caixas)) * 110} width={8} height={(c / Math.max(...caixas)) * 110} fill="#ffd27a" />)}
            </svg>
          )}
        </div>
        <div className="space-y-4">
          {(qual === "moedas" || qual === "monty") && <Deslizante rotulo="Rodadas" valor={n} min={10} max={5000} passo={10} mudar={setN} />}
          {qual === "aniversario" && <Deslizante rotulo="Pessoas no grupo" valor={pessoas} min={2} max={70} mudar={setPessoas} />}
          {qual === "tlc" && <Deslizante rotulo="Dados por média" valor={k} min={1} max={30} mudar={setK} />}
          <PrevejaRode
            pergunta={qual === "moedas" ? "Com 10 lançamentos, sai exatamente metade de caras? E com 5.000?" : qual === "monty" ? "Três portas, um carro. Você escolhe uma; o apresentador abre outra, vazia. Vale a pena trocar?" : qual === "aniversario" ? "Quantas pessoas precisam estar numa sala para a chance de dois fazerem aniversário no mesmo dia passar de 50%?" : "A média de 1 dado tem distribuição plana. E a média de 30 dados?"}
            explicacao={qual === "moedas" ? "Com poucos lançamentos a fração pula muito; com muitos, ela se aproxima de 50% (lei dos grandes números). Mas a diferença absoluta entre caras e coroas pode até crescer: o que converge é a proporção." : qual === "monty" ? "Trocar ganha 2 em cada 3 vezes. Sua primeira escolha acerta só 1/3; o apresentador, que sabe onde está o carro, nunca abre a porta dele, então a outra porta fechada concentra os 2/3 restantes." : qual === "aniversario" ? "Só 23! Não é a chance de alguém fazer aniversário no SEU dia: são todos os pares possíveis (253 pares com 23 pessoas)." : "Ela vira um sino (curva normal) em torno de 3,5, cada vez mais estreito: é o teorema central do limite. É por isso que pesquisas com amostras funcionam."}
            limites={qual === "aniversario" ? "Supõe aniversários espalhados por igual nos 365 dias; na vida real há meses com mais nascimentos." : "Sorteio de computador (pseudoaleatório, com semente), não moeda de verdade."}
            aprofundar={qual === "monty" ? "E se o apresentador abrisse uma porta ao acaso, podendo revelar o carro? A vantagem de trocar continua?" : "Mude a semente: o resultado de cada rodada muda, mas o comportamento geral se repete."}
          />
        </div>
      </div>
    </Bancada>
  );
}

/** Como mentir com gráficos: o mesmo dado, em versões honestas e enganosas. */
export function GraficosEnganosos() {
  const dados = [102, 104, 103, 106, 108, 107, 109];
  const [truque, setTruque] = useState<"honesto" | "eixo" | "periodo" | "escala">("honesto");
  const valores = truque === "periodo" ? dados.slice(3) : dados;
  const min = truque === "eixo" ? 100 : 0;
  const max = truque === "escala" ? 400 : 115;
  return (
    <Bancada titulo="Gráficos que enganam" subtitulo="O mesmo dado, contado de jeitos diferentes (dados fictícios)">
      <Escolha rotulo="Versão" valor={truque} opcoes={[["honesto", "Honesta"], ["eixo", "Eixo cortado"], ["periodo", "Período escolhido a dedo"], ["escala", "Escala esticada"]]} mudar={setTruque} />
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <svg viewBox="0 0 300 200" className="w-full rounded border-2 border-ink bg-parchment" role="img" aria-label="Gráfico de barras do preço da cesta">
          <text x={10} y={16} fontSize={11} fontWeight={700} fill="#17130e">Preço da cesta básica (R$)</text>
          {valores.map((v, i) => {
            const h = ((v - min) / (max - min)) * 150;
            return <g key={i}><rect x={20 + i * (260 / valores.length)} y={185 - h} width={260 / valores.length - 8} height={h} fill="#7A1F1F" /><text x={20 + i * (260 / valores.length) + (260 / valores.length - 8) / 2} y={180 - h} fontSize={9} textAnchor="middle">{v}</text></g>;
          })}
          <line x1={18} x2={290} y1={185} y2={185} stroke="#17130e" />
          <text x={4} y={188} fontSize={8}>{min}</text>
        </svg>
        <div className="space-y-3 text-sm">
          <p>{truque === "honesto" ? "Eixo começa no zero e mostra o período todo: a alta é de uns 7%." : truque === "eixo" ? "O eixo começa em 100: a mesma alta de 7% parece ter mais que dobrado." : truque === "periodo" ? "Só os últimos meses, escolhidos a dedo: some o contexto." : "A escala vai até 400: a alta, que existiu, parece não ter acontecido."}</p>
          <PrevejaRode pergunta="Qual das versões é a verdadeira?" explicacao="Todas usam os mesmos números! O truque está no desenho: onde o eixo começa, que período aparece e o tamanho da escala. Antes de acreditar num gráfico, olhe os números do eixo e de onde vieram os dados." limites="Os números são inventados para o exercício." aprofundar="Procure um gráfico numa notícia de hoje e confira: o eixo começa no zero? O período foi escolhido por quê?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Segregação: o modelo de Schelling, com pessoas que só querem não ser minoria entre os vizinhos. */
export function Segregacao() {
  const L = 36;
  const [tolerancia, setTolerancia] = useState(0.35);
  const [semente, setSemente] = useState(3);
  const [grade, setGrade] = useState<Celula[]>(() => schellingInicial(L, 0.1, 3));
  const [rodando, setRodando] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [serie, setSerie] = useState<number[]>([]);
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      setGrade((g) => {
        const r = schellingPasso(g, L, tolerancia, semente * 1000 + rodada);
        if (!r.mudaram) setRodando(false);
        setSerie((s) => [...s, segregacao(r.grade, L)].slice(-200));
        return r.grade;
      });
      setRodada((n) => n + 1);
    }, 120);
    return () => window.clearInterval(id);
  });
  const reiniciar = (s: number) => { setSemente(s); setGrade(schellingInicial(L, 0.1, s)); setRodada(0); setSerie([]); setRodando(false); };
  return (
    <Bancada titulo="Segregação (modelo de Schelling)" subtitulo="Pequenas preferências, grande separação" acoes={<><Botao primario onClick={() => setRodando(!rodando)}>{rodando ? "⏸" : "▶ Rodar"}</Botao><Botao onClick={() => reiniciar(semente + 1)}>↺ Nova cidade</Botao></>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <svg viewBox={`0 0 ${L} ${L}`} className="mx-auto w-full max-w-[420px] rounded border-2 border-ink" role="img" aria-label="Cidade em grade: casas azuis, laranja e vazias">
          {grade.map((v, i) => <rect key={i} x={i % L} y={Math.floor(i / L)} width={1} height={1} fill={v === 1 ? "#1a4f9c" : v === 2 ? "#e0701a" : "#f4ebdb"} />)}
        </svg>
        <div className="space-y-4">
          <Deslizante rotulo="Quer ao menos esta fração de vizinhos iguais" valor={tolerancia} min={0} max={0.8} passo={0.05} mudar={setTolerancia} formato={(v) => `${Math.round(v * 100)}%`} />
          <div className="grid grid-cols-2 gap-2"><Leitura rotulo="Rodada" valor={String(rodada)} /><Leitura rotulo="Vizinhos iguais" valor={`${Math.round(segregacao(grade, L) * 100)}%`} /></div>
          <Grafico series={[["#ffd27a", serie]]} max={1} rotulos={["vizinhos iguais, em média"]} />
          <PrevejaRode pergunta="Se cada pessoa só quer que um terço dos vizinhos seja do seu grupo (ela aceita ser minoria!), a cidade fica muito separada?" explicacao="Fica: com preferências pequenas, as mudanças em cadeia separam a cidade em blocos, e a média de vizinhos iguais passa de 70%. Thomas Schelling mostrou isso em 1971: a segregação não precisa de ódio declarado para acontecer." limites="Modelo de brinquedo: na vida real pesam preço do aluguel, renda, racismo de bancos e imobiliárias, políticas públicas e onde há emprego e transporte. O modelo mostra só um dos mecanismos." aprofundar="Qual a menor preferência que já produz blocos? E o que acontece com 70%: todo mundo fica satisfeito?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Cooperação: o dilema do prisioneiro repetido, num campeonato entre estratégias. */
export function Cooperacao() {
  const [presentes, setPresentes] = useState<Estrategia[]>(["olho-por-olho", "sempre-trai", "rancoroso", "sempre-coopera", "aleatorio"]);
  const [rodadas, setRodadas] = useState(50);
  const pontos = campeonato(presentes, rodadas, 7);
  const max = Math.max(1, ...pontos);
  return (
    <Bancada titulo="Cooperação (dilema do prisioneiro)" subtitulo="Trair compensa? Depende de quem está jogando">
      <p className="text-sm">Cada dupla joga {rodadas} rodadas. Os dois cooperam: 3 pontos cada. Um trai e o outro coopera: 5 para quem traiu, 0 para quem cooperou. Os dois traem: 1 cada.</p>
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <ul className="space-y-2">
          {ESTRATEGIAS.map((e) => {
            const i = presentes.indexOf(e.id);
            return (
              <li key={e.id} className="rounded border-2 border-ink/20 p-2">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={i >= 0} onChange={(ev) => setPresentes(ev.target.checked ? [...presentes, e.id] : presentes.filter((x) => x !== e.id))} />{e.nome}<span className="font-normal text-ink-soft">· {e.regra}</span></label>
                {i >= 0 && <div className="mt-1 flex items-center gap-2"><div className="h-3 rounded bg-oxblood" style={{ width: `${(pontos[i] / max) * 100}%` }} /><span className="font-mono text-xs">{pontos[i]}</span></div>}
              </li>
            );
          })}
        </ul>
        <div className="space-y-4">
          <Deslizante rotulo="Rodadas por partida" valor={rodadas} min={1} max={200} mudar={setRodadas} />
          <PrevejaRode pergunta="Num campeonato, quem sempre trai vence?" explicacao="Só quando há gente ingênua para explorar (quem sempre coopera). Tire o 'Sempre coopera': quem coopera com reciprocidade (Olho por olho, Rancoroso) vence, porque ganha 3 de 3 entre si e quem trai só lucra na primeira rodada. Com uma rodada só (sem repetição), trair volta a compensar." limites="Estratégias fixas e pontos inventados; na vida real há reputação, conversa, regras coletivas e instituições que mudam o jogo." aprofundar="Com 1 rodada, quem vence? E com 200? O que a repetição (conviver de novo amanhã) muda?" />
        </div>
      </div>
    </Bancada>
  );
}

/** Riqueza: trocas "justas" ao acaso concentram riqueza (modelo yard-sale), e a redistribuição. */
export function Riqueza() {
  const [trocas, setTrocas] = useState(20000);
  const [fracao, setFracao] = useState(0.2);
  const [imposto, setImposto] = useState(0);
  const [semente, setSemente] = useState(5);
  const w = useMemo(() => {
    // Em blocos: a cada 2.000 trocas, a redistribuição devolve uma parte à média.
    let r = Array(120).fill(100);
    for (let b = 0; b < trocas / 2000; b++) r = yardSale(r, 2000, fracao, semente * 100 + b, imposto);
    return r;
  }, [trocas, fracao, imposto, semente]);
  const ordenado = [...w].sort((a, b) => b - a);
  const top10 = ordenado.slice(0, 12).reduce((s, x) => s + x, 0) / ordenado.reduce((s, x) => s + x, 0);
  return (
    <Bancada titulo="Riqueza (modelo yard-sale)" subtitulo="Todo mundo começa igual e as trocas são cara ou coroa" acoes={<Botao onClick={() => setSemente(semente + 1)}>Outra semente</Botao>}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          <svg viewBox="0 0 240 120" className="w-full rounded bg-[#17130e]" role="img" aria-label="Riqueza de cada pessoa, da maior para a menor">
            {ordenado.map((x, i) => <rect key={i} x={i * 2} y={120 - Math.min(120, (x / Math.max(...ordenado)) * 118)} width={1.6} height={Math.min(120, (x / Math.max(...ordenado)) * 118)} fill="#ffd27a" />)}
          </svg>
          <div className="mt-3 grid grid-cols-2 gap-2"><Leitura rotulo="Índice de Gini" valor={gini(w).toFixed(2)} destaque={gini(w) > 0.5} /><Leitura rotulo="Os 10% mais ricos têm" valor={`${Math.round(top10 * 100)}%`} /></div>
        </div>
        <div className="space-y-4">
          <Deslizante rotulo="Trocas" valor={trocas} min={2000} max={100000} passo={2000} mudar={setTrocas} />
          <Deslizante rotulo="Aposta (fração da riqueza do mais pobre)" valor={fracao} min={0.05} max={0.5} passo={0.05} mudar={setFracao} formato={(v) => `${Math.round(v * 100)}%`} />
          <Deslizante rotulo="Redistribuição a cada 2.000 trocas" valor={imposto} min={0} max={0.2} passo={0.01} mudar={setImposto} formato={(v) => `${Math.round(v * 100)}%`} />
          <PrevejaRode pergunta="Se cada troca é cara ou coroa, justa, e todos começam com 100, a riqueza fica bem dividida?" explicacao="Não: a riqueza se concentra sozinha, e o Gini sobe sem parar. Quem perde algumas vezes seguidas fica com pouco e passa a apostar pouco; quem ganha acumula. Uma pequena redistribuição periódica segura a concentração." limites="Modelo de brinquedo (Chakraborti, Boghosian e outros): ignora salário, herança, juros e o poder de quem já tem muito, que concentram ainda mais." aprofundar="Com redistribuição de 5%, onde o Gini se estabiliza? E com 0%, ele para de subir algum dia?" />
        </div>
      </div>
    </Bancada>
  );
}

