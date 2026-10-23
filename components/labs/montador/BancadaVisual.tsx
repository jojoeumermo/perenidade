// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { Selo } from "@/components/Selo";
import { COOLERS, CPUS, conferir, DISCOS, type Escolha, FONTES, GABINETES, GPUS, PLACAS, RAMS } from "./pecas";

/**
 * A montagem em bancada visual: a placa-mãe desenhada, que vai recebendo as peças (processador no soquete, cooler,
 * pentes nos slots, SSDs nos M.2, placa de vídeo no PCIe, cabos da fonte), o medidor da fonte e o botão de ligar,
 * que mostra o que aconteceria de verdade: a tela da BIOS, ou o defeito.
 */
const PEDIDOS = [
  { nome: "Livre", texto: "Monte o que quiser e veja o que é compatível." },
  { nome: "Escritório da associação", texto: "Planilhas, navegador e reunião por vídeo. Sem placa de vídeo, gabinete pequeno, silencioso.", confere: (e: Escolha) => e.gpu === "nenhuma" && e.gabinete !== "atx" },
  { nome: "Estúdio de edição de vídeo", texto: "Muitos núcleos, 64 GB de memória, dois SSDs NVMe e placa de vídeo forte.", confere: (e: Escolha) => ["am5-16", "1700-14f", "am4-8"].includes(e.cpu ?? "") && ["d4-4x16", "d5-4x16"].includes(e.ram ?? "") && e.discos.filter((d) => d.startsWith("nvme")).length >= 2 && ["alta", "topo"].includes(e.gpu ?? "") },
  { nome: "Computador compacto para a sala", texto: "Mini-ITX, cabe na estante, com placa de vídeo de entrada para jogos leves.", confere: (e: Escolha) => e.placa === "1700-itx" && e.gabinete === "itx" && e.gpu === "entrada" },
];

type Categoria = "placa" | "cpu" | "cooler" | "ram" | "discos" | "gpu" | "fonte" | "gabinete";
const CATEGORIAS: { id: Categoria; nome: string; icone: string; lista: { id: string; nome: string }[] }[] = [
  { id: "gabinete", nome: "Gabinete", icone: "caixa", lista: GABINETES },
  { id: "placa", nome: "Placa-mãe", icone: "chip", lista: PLACAS },
  { id: "cpu", nome: "Processador", icone: "chip", lista: CPUS },
  { id: "cooler", nome: "Cooler", icone: "engrenagem", lista: COOLERS },
  { id: "ram", nome: "Memória", icone: "regua", lista: RAMS },
  { id: "discos", nome: "Armazenamento", icone: "pasta", lista: DISCOS },
  { id: "gpu", nome: "Placa de vídeo", icone: "tela", lista: GPUS },
  { id: "fonte", nome: "Fonte", icone: "tomada", lista: FONTES },
];

/** O sintoma que cada tipo de erro produz ao apertar o botão de ligar. */
function sintoma(erros: string[]): { titulo: string; tela: string; som: string } {
  const tem = (r: RegExp) => erros.some((e) => r.test(e));
  if (tem(/^Soquete|^Formato|tampa não fecha|bate na frente|radiador/)) return { titulo: "Nem chega a ligar", tela: "A montagem não fecha: uma peça não encaixa no lugar. Na bancada, isso aparece antes de ligar.", som: "silêncio" };
  if (tem(/^Falta o cooler|não vem com cooler/)) return { titulo: "Liga e desliga sozinho", tela: "Ventoinhas giram por alguns segundos e tudo apaga: o processador passou de 100 °C e se protegeu.", som: "clique da fonte desligando" };
  if (tem(/^Memória|pentes e a placa/)) return { titulo: "Liga, mas sem imagem (memória)", tela: "Ventoinhas e luzes acesas, monitor preto. A placa-mãe acende o LED de diagnóstico DRAM.", som: "bipes repetidos de memória" };
  if (tem(/^Sem imagem/)) return { titulo: "Liga, mas o monitor fica preto", tela: "Não há saída de vídeo: o processador não tem vídeo integrado e não há placa de vídeo. LED de diagnóstico VGA aceso.", som: "1 bipe longo e 2 curtos" };
  if (tem(/^Fonte|cabo\(s\) PCIe/)) return { titulo: "Liga, mas desliga quando exige", tela: "Entra no sistema, mas desliga ao abrir um jogo ou renderizar um vídeo: a fonte não aguenta o pico.", som: "estalo e silêncio" };
  if (tem(/^Sem armazenamento|M\.2 e a placa|portas SATA/)) return { titulo: "Entra na BIOS, mas não acha disco", tela: "Mensagem: \"No bootable device\". Falta onde instalar o sistema, ou um disco não tem onde encaixar.", som: "1 bipe curto (POST ok)" };
  return { titulo: "Não liga direito", tela: erros[0] ?? "", som: "—" };
}

function Placa({ e }: { e: Escolha }) {
  const placa = PLACAS.find((x) => x.id === e.placa);
  const cpu = CPUS.find((x) => x.id === e.cpu);
  const cooler = COOLERS.find((x) => x.id === e.cooler);
  const ram = RAMS.find((x) => x.id === e.ram);
  const gpu = GPUS.find((x) => x.id === e.gpu);
  const fonte = FONTES.find((x) => x.id === e.fonte);
  const gab = GABINETES.find((x) => x.id === e.gabinete);
  const r = conferir(e);
  const errou = (t: RegExp) => r.erros.some((x) => t.test(x));
  const borda = (ok: boolean, ruim: boolean) => (ruim ? "#ff5a4a" : ok ? "#f4ecd8" : "#ffffff55");
  // Tamanho da placa conforme o formato.
  const W = placa?.formato === "ITX" ? 170 : placa?.formato === "mATX" ? 244 : 305;
  const H = placa?.formato === "ITX" ? 170 : 244;
  const x0 = 40;
  const y0 = 40;
  const gabW = gab?.id === "itx" ? 260 : gab?.id === "matx" ? 340 : 400;
  return (
    <svg viewBox="0 0 420 380" className="w-full rounded-md border-2 border-ink bg-[#1c1813]" role="img" aria-label="Desenho da placa-mãe com as peças escolhidas">
      {gab && <rect x={10} y={10} width={gabW} height={360} rx={8} fill="none" stroke={borda(true, errou(/^Formato|tampa|bate na frente|radiador/))} strokeWidth={3} strokeDasharray="8 5" />}
      {gab && <text x={18} y={30} fontSize={11} fill="#d8cfbd">Gabinete {gab.id.toUpperCase()}</text>}
      {placa ? (
        <g>
          <rect x={x0} y={y0} width={W} height={H} rx={4} fill="#1f5134" stroke={borda(true, errou(/^Formato/))} strokeWidth={2} />
          <text x={x0 + 8} y={y0 + H - 8} fontSize={10} fill="#bfe3c8">{placa.formato} · {placa.soquete} · {placa.memoria}</text>
          {/* Soquete e processador */}
          <rect x={x0 + 40} y={y0 + 30} width={60} height={60} fill={cpu ? "#b8b2a6" : "#2b2b2b"} stroke={borda(Boolean(cpu), errou(/^Soquete/))} strokeWidth={3} />
          {cpu && <text x={x0 + 70} y={y0 + 64} fontSize={9} textAnchor="middle" fill="#17130e">{cpu.soquete}</text>}
          {cooler && <circle cx={x0 + 70} cy={y0 + 60} r={cooler.radiador ? 22 : 40} fill="#4a5568aa" stroke={borda(true, errou(/cooler|tampa/))} strokeWidth={2} />}
          {cooler?.radiador && <rect x={x0 + W - 10} y={y0} width={14} height={H} fill="#4a5568" />}
          {/* Slots de memória */}
          {Array.from({ length: placa.slotsRam }, (_, i) => {
            // Onde os pentes vão, como manda o manual: 1 pente no 2.º slot; 2 pentes no 2.º e no 4.º (ou nos dois, se só há 2).
            const ocupados = !ram ? [] : ram.pentes >= placa.slotsRam ? Array.from({ length: placa.slotsRam }, (_, k) => k) : ram.pentes === 1 ? [Math.min(1, placa.slotsRam - 1)] : placa.slotsRam === 4 ? [1, 3] : [0, 1];
            const cheio = ocupados.includes(i);
            return <rect key={i} x={x0 + 120 + i * 13} y={y0 + 15} width={8} height={100} fill={cheio ? "#2d6cdf" : "#111"} stroke={borda(cheio, cheio && errou(/^Memória|pentes/))} strokeWidth={1.5} />;
          })}
          {/* Conector de 24 pinos e EPS */}
          <rect x={x0 + W - 22} y={y0 + 40} width={12} height={46} fill={fonte ? "#e9c46a" : "#333"} />
          <rect x={x0 + 20} y={y0 + 6} width={30} height={10} fill={fonte ? "#e9c46a" : "#333"} />
          {/* M.2 */}
          {Array.from({ length: placa.m2 }, (_, i) => {
            const usado = e.discos.filter((d) => d.startsWith("nvme")).length > i;
            return <rect key={i} x={x0 + 30} y={y0 + 120 + i * 22} width={70} height={10} fill={usado ? "#7f8c8d" : "#0e0e0e"} stroke="#ffffff33" />;
          })}
          {/* PCIe x16 e placa de vídeo */}
          <rect x={x0 + 20} y={y0 + (placa.formato === "ITX" ? 135 : 190)} width={Math.min(W - 30, 200)} height={8} fill="#000" stroke="#ffffff33" />
          {gpu && gpu.id !== "nenhuma" && (
            <g>
              <rect x={x0 + 10} y={y0 + (placa.formato === "ITX" ? 145 : 200)} width={gpu.comprimento} height={26} rx={3} fill="#3d3d46" stroke={borda(true, errou(/bate na frente|cabo\(s\) PCIe/))} strokeWidth={2} />
              <text x={x0 + 18} y={y0 + (placa.formato === "ITX" ? 162 : 217)} fontSize={9} fill="#eee">GPU {gpu.consumo} W · {gpu.comprimento} mm</text>
            </g>
          )}
        </g>
      ) : (
        <text x={210} y={190} fontSize={14} textAnchor="middle" fill="#d8cfbd">Comece escolhendo o gabinete e a placa-mãe</text>
      )}
      {/* Fonte */}
      {fonte && (
        <g>
          <rect x={30} y={318} width={110} height={44} rx={4} fill="#2a2a2a" stroke={borda(true, errou(/^Fonte|cabo\(s\) PCIe/))} strokeWidth={2} />
          <text x={85} y={344} fontSize={10} textAnchor="middle" fill="#eee">Fonte {fonte.watts} W</text>
        </g>
      )}
      {/* Discos SATA */}
      {e.discos.filter((d) => !d.startsWith("nvme")).map((d, i) => <rect key={d} x={gabW - 70} y={300 - i * 30} width={55} height={22} rx={3} fill="#555" stroke="#ffffff55" />)}
    </svg>
  );
}

export function BancadaVisual() {
  const [e, setE] = useState<Escolha>({ discos: [] });
  const [pedido, setPedido] = useState(0);
  const [categoria, setCategoria] = useState<Categoria>("gabinete");
  const [ligado, setLigado] = useState(false);
  const r = useMemo(() => conferir(e), [e]);
  const p = PEDIDOS[pedido];
  const atende = r.completa && !r.erros.length && (!p.confere || p.confere(e));
  const cat = CATEGORIAS.find((c) => c.id === categoria)!;
  const fonte = FONTES.find((x) => x.id === e.fonte);
  const escolher = (id: string) => {
    setLigado(false);
    if (categoria === "discos") setE((x) => ({ ...x, discos: x.discos.includes(id) ? x.discos.filter((d) => d !== id) : [...x.discos, id] }));
    else setE((x) => ({ ...x, [categoria]: x[categoria] === id ? undefined : id }));
  };
  const escolhido = (id: string) => (categoria === "discos" ? e.discos.includes(id) : e[categoria] === id);
  const s = r.erros.length ? sintoma(r.erros) : null;
  const pctFonte = fonte ? Math.min(100, (r.consumo / fonte.real) * 100) : 0;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PEDIDOS.map((x, i) => <button key={x.nome} type="button" aria-pressed={i === pedido} onClick={() => setPedido(i)} className={`cursor-pointer rounded border-2 px-2.5 py-1 text-xs font-semibold ${i === pedido ? "border-ink bg-ink text-parchment" : "border-ink/25 hover:border-ink"}`}>{x.nome}</button>)}
      </div>
      <p className="mt-2 text-ink-soft"><strong>Pedido:</strong> {p.texto}</p>
      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Placa e={e} />
          <div className="mt-3">
            <p className="flex justify-between text-xs font-semibold"><span>Consumo estimado {r.consumo} W</span><span>{fonte ? `fonte entrega ${fonte.real} W` : "sem fonte"} · recomendada {r.recomendada} W</span></p>
            <div className="mt-1 h-3 overflow-hidden rounded bg-[#17130e]"><div className="h-full rounded" style={{ width: `${pctFonte}%`, background: pctFonte > 77 ? "#c21f16" : pctFonte > 60 ? "#e0a21a" : "#2e8b57" }} /></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={!r.completa} onClick={() => setLigado(true)} className="cursor-pointer rounded-full border-4 border-ink bg-[#c21f16] px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">⏻ Ligar</button>
            {!r.completa && <span className="text-xs text-ink-soft">Escolha todas as peças para ligar.</span>}
          </div>
          {ligado && (
            <div className="mt-3 rounded-md border-2 border-ink bg-black p-4 font-mono text-sm text-[#cfe8d0]" aria-live="polite">
              {s ? (
                <>
                  <p className="text-[#ff8a7a]">✗ {s.titulo}</p>
                  <p className="mt-1 text-[#e8e2d4]">{s.tela}</p>
                  <p className="mt-1 text-xs text-[#a89f8c]">Som: {s.som}</p>
                </>
              ) : (
                <>
                  <p>BIOS · POST concluído ✓ (1 bipe curto)</p>
                  <p className="mt-1">CPU: {CPUS.find((x) => x.id === e.cpu)?.nome.split(",")[0]} · {CPUS.find((x) => x.id === e.cpu)?.soquete}</p>
                  <p>Memória: {RAMS.find((x) => x.id === e.ram)?.gb} GB {RAMS.find((x) => x.id === e.ram)?.memoria} {RAMS.find((x) => x.id === e.ram)?.pentes === 1 ? "(canal único)" : "(dual channel)"}</p>
                  <p>Armazenamento: {e.discos.map((d) => DISCOS.find((x) => x.id === d)?.nome.split(" (")[0]).join(" · ")}</p>
                  <p>Vídeo: {e.gpu === "nenhuma" ? "integrado do processador" : GPUS.find((x) => x.id === e.gpu)?.nome.split(",")[0]}</p>
                  <p className="mt-2 text-[#e9c46a]">{r.avisos.length ? `Liga, com ${r.avisos.length} ressalva(s): veja ao lado.` : "Tudo certo. Pode instalar o sistema."}</p>
                  {pedido > 0 && <p className={atende ? "text-[#9fe0a8]" : "text-[#ff8a7a]"}>{atende ? "✓ Atende o pedido do cliente." : "Liga, mas não é o que o cliente pediu."}</p>}
                </>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => {
              const feito = c.id === "discos" ? e.discos.length > 0 : Boolean(e[c.id]);
              return <button key={c.id} type="button" aria-pressed={categoria === c.id} onClick={() => setCategoria(c.id)} className={`cursor-pointer rounded border-2 px-2 py-1 text-xs font-semibold ${categoria === c.id ? "border-ink bg-ink text-parchment" : feito ? "border-[#2e8b57] text-[#2e8b57]" : "border-ink/25"}`}><Selo nome={c.icone} className="mr-1 inline h-4 w-4 align-[-3px]" />{c.nome}{feito ? " ✓" : ""}</button>;
            })}
          </div>
          <ul className="mt-3 grid gap-2">
            {cat.lista.map((x) => (
              <li key={x.id}><button type="button" aria-pressed={escolhido(x.id)} onClick={() => escolher(x.id)} className={`w-full cursor-pointer rounded-md border-2 px-3 py-2 text-left text-sm ${escolhido(x.id) ? "border-ink bg-[#fff6e0] shadow-[3px_3px_0_#17130e]" : "border-ink/20 bg-parchment hover:border-ink"}`}>
                <span className="mr-2" aria-hidden>{cat.icone}</span>{x.nome}
              </button></li>
            ))}
          </ul>
          {categoria === "discos" && <p className="mt-1 text-xs text-ink-soft">Pode escolher mais de um.</p>}
          <div className="mt-4 rounded-md border-2 border-ink bg-parchment-deep p-3 text-sm" aria-live="polite">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-oxblood">Conferência da bancada</p>
            {r.erros.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5 text-oxblood">{r.erros.map((x) => <li key={x}>{x}</li>)}</ul>}
            {r.avisos.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5">{r.avisos.map((x) => <li key={x}>{x}</li>)}</ul>}
            {!r.erros.length && !r.avisos.length && <p className="mt-1 text-ink-soft">{r.completa ? "Nada a apontar." : "As peças escolhidas combinam até aqui."}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
