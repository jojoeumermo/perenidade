// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

type Slot = "cpu" | "ram" | "disco" | "gpu" | "fonte" | "gabinete";
interface Peca { id: string; slot: Slot; nome: string; soquete?: string; memoria?: string; watts?: number; consumo?: number; tamanho?: "pequeno" | "grande"; ocupa?: "pequeno" | "grande"; }
const PLACA = { soquete: "AM4", memoria: "DDR4", slots: ["cpu", "ram", "disco", "gpu", "fonte", "gabinete"] as Slot[] };
const PECAS: Peca[] = [
  { id: "cpu-a", slot: "cpu", nome: "Processador 6 núcleos (soquete AM4)", soquete: "AM4", consumo: 65 },
  { id: "cpu-b", slot: "cpu", nome: "Processador 8 núcleos (soquete LGA1700)", soquete: "LGA1700", consumo: 125 },
  { id: "ram-a", slot: "ram", nome: "Memória 16 GB DDR4", memoria: "DDR4", consumo: 5 },
  { id: "ram-b", slot: "ram", nome: "Memória 16 GB DDR5", memoria: "DDR5", consumo: 5 },
  { id: "ssd", slot: "disco", nome: "SSD NVMe 1 TB", consumo: 8 },
  { id: "hd", slot: "disco", nome: "HD 2 TB (SATA)", consumo: 10 },
  { id: "gpu-a", slot: "gpu", nome: "Placa de vídeo compacta (120 W)", consumo: 120, ocupa: "pequeno" },
  { id: "gpu-b", slot: "gpu", nome: "Placa de vídeo grande (320 W)", consumo: 320, ocupa: "grande" },
  { id: "fonte-a", slot: "fonte", nome: "Fonte 350 W", watts: 350 },
  { id: "fonte-b", slot: "fonte", nome: "Fonte 650 W", watts: 650 },
  { id: "gab-a", slot: "gabinete", nome: "Gabinete compacto", tamanho: "pequeno" },
  { id: "gab-b", slot: "gabinete", nome: "Gabinete torre", tamanho: "grande" },
];
const NOMES: Record<Slot, string> = { cpu: "Processador", ram: "Memória", disco: "Armazenamento", gpu: "Placa de vídeo", fonte: "Fonte", gabinete: "Gabinete" };
const DIAGNOSTICOS = [
  { id: "d1", titulo: "Não liga nada", sintoma: "Aperto o botão e nada acontece: nenhuma luz, nenhum ventilador.", causas: ["Pente de memória solto", "Fonte desligada na chave de trás ou cabo solto", "Pasta térmica seca"], certa: 1, explica: "Sem luz nenhuma, a energia não está chegando: cabo, chave da fonte ou a própria fonte. Memória solta dá apito ou tela preta com ventiladores girando." },
  { id: "d2", titulo: "Liga, apita e não dá imagem", sintoma: "Ventiladores giram, a placa apita em sequência e a tela fica preta.", causas: ["Pente de memória mal encaixado", "HD cheio", "Mouse com defeito"], certa: 0, explica: "Apitos na partida (POST) apontam para memória ou vídeo. Reencaixe o pente até os travamentos fecharem." },
  { id: "d3", titulo: "Desliga sozinho em jogos", sintoma: "Funciona normal, mas desliga de repente quando o jogo pesa.", causas: ["Fonte fraca para o consumo da placa de vídeo, ou superaquecimento", "Teclado", "Falta de espaço em disco"], certa: 0, explica: "Sob carga o consumo sobe: fonte insuficiente ou cooler sujo/pasta térmica seca derrubam a máquina. Some os watts das peças e deixe folga de 30%." },
  { id: "d4", titulo: "Não reconhece a memória nova", sintoma: "Troquei a memória por uma DDR5 e o computador não dá vídeo.", causas: ["A placa-mãe é DDR4: o pente DDR5 não é compatível (nem encaixa direito)", "Precisa formatar", "A fonte é fraca"], certa: 0, explica: "DDR4 e DDR5 têm encaixes e tensões diferentes. A placa-mãe define o tipo de memória." },
];

/** Montador: peças genéricas, sem marca; a compatibilidade (soquete, memória, potência, espaço) é conferida e explicada. */
export function Montador() {
  const [montagem, setMontagem] = useState<Partial<Record<Slot, string>>>({});
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [diag, setDiag] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const peca = (id?: string) => PECAS.find((p) => p.id === id);
  const colocar = (slot: Slot, id: string) => { const p = peca(id); if (p && p.slot === slot) setMontagem((m) => ({ ...m, [slot]: id })); };
  const cpu = peca(montagem.cpu), ram = peca(montagem.ram), gpu = peca(montagem.gpu), fonte = peca(montagem.fonte), gab = peca(montagem.gabinete), disco = peca(montagem.disco);
  const consumo = [cpu, ram, gpu, disco].reduce((s, p) => s + (p?.consumo ?? 0), 0) + 40;
  const problemas: string[] = [];
  if (cpu && cpu.soquete !== PLACA.soquete) problemas.push(`O processador é ${cpu.soquete}; a placa-mãe é ${PLACA.soquete}. Não encaixa: cada soquete tem pinos e tamanho próprios.`);
  if (ram && ram.memoria !== PLACA.memoria) problemas.push(`A memória é ${ram.memoria}; a placa-mãe aceita ${PLACA.memoria}. O encaixe e a tensão são diferentes.`);
  if (fonte && fonte.watts! < consumo * 1.3) problemas.push(`A fonte de ${fonte.watts} W é pouca para ${consumo} W de consumo estimado (deixe 30% de folga: ${Math.ceil(consumo * 1.3)} W ou mais).`);
  if (gpu && gab && gpu.ocupa === "grande" && gab.tamanho === "pequeno") problemas.push("A placa de vídeo grande não cabe no gabinete compacto. Confira o comprimento máximo da placa.");
  const completa = PLACA.slots.every((s) => montagem[s]);
  const d = DIAGNOSTICOS[diag];
  return (
    <div className="mt-6 font-sans text-sm">
      <p className="text-ink-soft">Arraste (ou toque e depois toque no encaixe) cada peça para o lugar certo na placa-mãe {PLACA.soquete}/{PLACA.memoria}. Peças genéricas, sem marca.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ul className="space-y-1">
          {PECAS.map((p) => (
            <li key={p.id}>
              <button type="button" draggable onDragStart={() => setArrastando(p.id)} onClick={() => setArrastando(arrastando === p.id ? null : p.id)} aria-pressed={arrastando === p.id} className={`w-full cursor-grab border-2 px-2 py-1.5 text-left ${arrastando === p.id ? "border-oxblood bg-parchment-deep" : Object.values(montagem).includes(p.id) ? "border-rule opacity-50" : "border-ink bg-parchment-deep hover:border-oxblood"}`}>
                <span className="font-mono text-[0.6rem] uppercase text-gold">{NOMES[p.slot]}</span><br />{p.nome}
              </button>
            </li>
          ))}
        </ul>
        <div>
          <div className="grid grid-cols-2 gap-3 border-4 border-[#1f5f3a] bg-[#2d7a4f] p-4 sm:grid-cols-3">
            {PLACA.slots.map((slot) => {
              const p = peca(montagem[slot]);
              return (
                <div key={slot} role="button" tabIndex={0} aria-label={`Encaixe: ${NOMES[slot]}`} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (arrastando) colocar(slot, arrastando); setArrastando(null); }} onClick={() => { if (arrastando) { colocar(slot, arrastando); setArrastando(null); } }} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && arrastando) { e.preventDefault(); colocar(slot, arrastando); setArrastando(null); } }}
                  className={`flex min-h-20 cursor-pointer flex-col justify-between border-2 border-dashed p-2 text-[#f4ecd8] ${p ? "border-[#f4ecd8] bg-[#1f5f3a]" : "border-[#f4ecd8]/50"} ${arrastando && peca(arrastando)?.slot === slot ? "ring-2 ring-[#d4a24c]" : ""}`}>
                  <span className="font-mono text-[0.6rem] uppercase tracking-wider opacity-80">{NOMES[slot]}</span>
                  <span className="text-xs">{p ? p.nome : "vazio"}</span>
                  {p && <button type="button" className="self-end text-[0.65rem] underline" onClick={(e) => { e.stopPropagation(); setMontagem((m) => { const n = { ...m }; delete n[slot]; return n; }); }}>tirar</button>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-2 border-ink bg-parchment-deep p-3">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Verificação</p>
            <p className="mt-1">Consumo estimado: <strong>{consumo} W</strong>{fonte ? ` · fonte: ${fonte.watts} W` : ""}</p>
            {problemas.length > 0 ? <ul className="mt-2 list-disc space-y-1 pl-5 text-oxblood">{problemas.map((x) => <li key={x}>{x}</li>)}</ul> : completa ? <p className="mt-2 font-semibold text-ok">✓ Tudo compatível. O computador liga!</p> : <p className="mt-2 text-ink-soft">Encaixe todas as peças para ligar.</p>}
          </div>
        </div>
      </div>
      <section className="mt-8 border-2 border-ink bg-parchment-deep p-4">
        <h2 className="font-serif text-xl font-semibold">Modo diagnóstico: “o computador não liga”</h2>
        <ol className="mt-2 flex flex-wrap gap-2">{DIAGNOSTICOS.map((x, i) => <li key={x.id}><button type="button" onClick={() => { setDiag(i); setEscolha(null); }} className={`cursor-pointer border px-2 py-1 ${i === diag ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{i + 1}</button></li>)}</ol>
        <p className="mt-3 font-semibold">{d.titulo}</p>
        <p className="text-ink-soft">{d.sintoma}</p>
        <ul className="mt-2 space-y-1">{d.causas.map((c, i) => <li key={c}><button type="button" disabled={escolha !== null} onClick={() => setEscolha(i)} className={`w-full cursor-pointer border-2 px-3 py-1.5 text-left disabled:cursor-default ${escolha === null ? "border-rule hover:border-ink" : i === d.certa ? "border-ok" : i === escolha ? "border-oxblood" : "border-rule opacity-60"}`}>{c}</button></li>)}</ul>
        {escolha !== null && <p className="mt-2"><strong>{escolha === d.certa ? "Isso." : "Não é essa."}</strong> {d.explica}</p>}
      </section>
    </div>
  );
}
