// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";

/** As posições da chave seletora de um multímetro digital simples. */
type Escala = "desligado" | "vdc20" | "vdc200" | "vac750" | "ohm2k" | "ohm200k" | "cont" | "a10";
const ESCALAS: { id: Escala; rotulo: string }[] = [
  { id: "desligado", rotulo: "OFF" },
  { id: "vdc20", rotulo: "V⎓ 20" },
  { id: "vdc200", rotulo: "V⎓ 200" },
  { id: "vac750", rotulo: "V~ 750" },
  { id: "ohm2k", rotulo: "Ω 2k" },
  { id: "ohm200k", rotulo: "Ω 200k" },
  { id: "cont", rotulo: "•))) contin." },
  { id: "a10", rotulo: "A 10" },
];

interface Ponto {
  id: string;
  nome: string;
  /** Tensão contínua (V), alternada (V~) ou peça sem energia, com a resistência em ohms (Infinity: aberto). */
  dc?: number;
  ac?: number;
  ohm?: number;
  detalhe: string;
}

/** Fonte ATX: cada cor de fio do conector de 24 pinos, medida contra o preto (terra). */
const fiosAtx = (ligada: boolean): Ponto[] => [
  { id: "amarelo", nome: "Fonte ATX: fio amarelo × preto", dc: ligada ? 12.08 : 0, detalhe: "Amarelo é +12 V: alimenta processador, placa de vídeo e motores. Aceita de 11,4 V a 12,6 V (±5%)." },
  { id: "vermelho", nome: "Fonte ATX: fio vermelho × preto", dc: ligada ? 5.02 : 0, detalhe: "Vermelho é +5 V (USB, discos SATA). Tolerância: 4,75 V a 5,25 V." },
  { id: "laranja", nome: "Fonte ATX: fio laranja × preto", dc: ligada ? 3.34 : 0, detalhe: "Laranja é +3,3 V (memória, chipset). Tolerância: 3,14 V a 3,47 V." },
  { id: "roxo", nome: "Fonte ATX: fio roxo × preto", dc: 5.05, detalhe: "Roxo é o +5 V de espera (5VSB): existe mesmo com o computador desligado, desde que a fonte esteja na tomada. Sem ele, o botão de ligar não funciona." },
  { id: "verde", nome: "Fonte ATX: fio verde × preto", dc: ligada ? 0 : 4.9, detalhe: "Verde é o PS_ON: fica em 5 V com a fonte em espera; quando vai a 0 V (botão ou clipe ligando verde e preto), a fonte liga." },
  { id: "cinza", nome: "Fonte ATX: fio cinza × preto", dc: ligada ? 4.96 : 0, detalhe: "Cinza é o PWR_OK: a fonte avisa a placa-mãe que as tensões estabilizaram." },
];

const FIOS_ATX = new Set(fiosAtx(false).map((f) => f.id));

const OUTROS: Ponto[] = [
  { id: "tomada", nome: "Tomada da parede (127 V)", ac: 127.4, detalhe: "Na tomada a tensão é alternada (V~). Em parte do Brasil é 127 V, em outra parte 220 V: meça antes de ligar aparelho sem chave bivolt." },
  { id: "cr2032", nome: "Bateria da placa-mãe (CR2032)", dc: 2.48, detalhe: "Nova, a CR2032 tem uns 3 V. Abaixo de 2,7 V, a placa começa a perder data, hora e configurações da BIOS: esta está fraca." },
  { id: "bateria-cel", nome: "Bateria de celular (íon-lítio, fora do aparelho)", dc: 3.92, detalhe: "Íon-lítio: uns 4,3 V cheia, 3,8 V nominal e 3,3 V vazia. Nunca fure, dobre ou aqueça; estufada vai para o ponto de coleta." },
  { id: "carregador-note", nome: "Carregador de notebook, na ponta do plugue", dc: 19.5, detalhe: "A maioria dos carregadores de notebook entrega de 19 V a 20 V. Atenção à escala: 19,5 V cabe na de 20 V; se passasse, o visor mostraria \"1\" (fora da escala)." },
  { id: "fusivel-bom", nome: "Fusível de vidro (tirado do circuito)", ohm: 0.2, detalhe: "Fusível bom é quase um fio: continuidade apita e a resistência dá perto de zero." },
  { id: "fusivel-ruim", nome: "Fusível escurecido (tirado do circuito)", ohm: Infinity, detalhe: "Aberto: sem continuidade. Fusível que queima de novo logo depois da troca indica curto em outro lugar: procure a causa." },
  { id: "resistor", nome: "Resistor marrom-preto-vermelho (tirado do circuito)", ohm: 1000, detalhe: "Marrom (1), preto (0), vermelho (×100) = 1.000 Ω = 1 kΩ. Meça o resistor fora do circuito, senão as outras peças entram na conta." },
  { id: "resistor-grande", nome: "Resistor marrom-preto-amarelo (tirado do circuito)", ohm: 100000, detalhe: "Marrom (1), preto (0), amarelo (×10.000) = 100 kΩ. Na escala de 2k ele estoura (aparece \"1\"); passe para a de 200k." },
  { id: "cabo-usb", nome: "Cabo USB com o fio partido perto do plugue", ohm: Infinity, detalhe: "Um dos fios internos rompeu: sem continuidade de ponta a ponta. Muitas vezes o cabo funciona \"só numa posição\"." },
];

function leitura(escala: Escala, p: Ponto, invertido: boolean): { visor: string; alerta?: string; ok?: boolean } {
  const energizado = (p.dc ?? 0) !== 0 || (p.ac ?? 0) !== 0;
  if (escala === "desligado") return { visor: "" };
  if (escala === "a10") {
    if (energizado) return { visor: "FUSE", alerta: "PERIGO: na escala de corrente o multímetro é quase um fio. Encostar as ponteiras numa fonte de tensão faz um curto-circuito: queima o fusível do multímetro e, na tomada, pode causar arco elétrico e queimaduras. Corrente se mede em série, com o circuito aberto." };
    return { visor: "0.00", alerta: "Escala de corrente: sem circuito ligado, não há o que medir." };
  }
  if (escala === "ohm2k" || escala === "ohm200k" || escala === "cont") {
    if (energizado) return { visor: "----", alerta: "Nunca meça resistência ou continuidade em circuito energizado: a leitura não faz sentido e pode danificar o multímetro ou o aparelho. Desligue da tomada e descarregue os capacitores antes." };
    if (p.ohm === undefined) return { visor: "1", alerta: "Sem resistência para medir aqui: isto é uma fonte de tensão." };
    if (escala === "cont") return p.ohm < 30 ? { visor: `${p.ohm.toFixed(1)}  •)))`, ok: true } : { visor: "1" };
    const max = escala === "ohm2k" ? 2000 : 200000;
    if (p.ohm > max) return { visor: "1", alerta: p.ohm === Infinity ? undefined : "\"1\" à esquerda é estouro de escala: o valor é maior que o máximo. Suba a escala." };
    return { visor: escala === "ohm2k" ? `${p.ohm.toFixed(0)}` : `${(p.ohm / 1000).toFixed(1)} k`, ok: true };
  }
  if (escala === "vac750") {
    if (p.ac) return { visor: p.ac.toFixed(0), ok: true };
    return { visor: "0", alerta: p.dc ? "Escala de alternada numa fonte contínua: o multímetro mostra zero (ou um valor sem sentido). Use V⎓." : undefined };
  }
  // Contínua.
  if (p.ac) return { visor: "0.0", alerta: "Tomada é tensão alternada: na escala contínua o visor fica perto de zero e engana. Use V~ 750." };
  if (p.dc === undefined) return { visor: "0.00", alerta: "Peça sem energia: não há tensão para medir." };
  const max = escala === "vdc20" ? 20 : 200;
  if (Math.abs(p.dc) > max) return { visor: "1", alerta: "Estouro de escala: suba para a de 200 V." };
  const v = invertido ? -p.dc : p.dc;
  return { visor: escala === "vdc20" ? v.toFixed(2) : v.toFixed(1), ok: true, alerta: invertido && p.dc ? "O sinal de menos indica ponteiras invertidas: a vermelha está no negativo. Em multímetro digital isso não estraga nada." : undefined };
}

const MISSOES = [
  { texto: "Confira se a tomada tem tensão.", ponto: "tomada", escala: ["vac750"] },
  { texto: "Descubra se a bateria da placa-mãe está fraca.", ponto: "cr2032", escala: ["vdc20"] },
  { texto: "Teste do clipe: com a fonte ligada, meça os 12 V do fio amarelo.", ponto: "amarelo", escala: ["vdc20"], ligada: true },
  { texto: "Com a fonte em espera (desligada, mas na tomada), meça o fio roxo.", ponto: "roxo", escala: ["vdc20"], ligada: false },
  { texto: "Descubra qual dos dois fusíveis queimou.", ponto: "fusivel-ruim", escala: ["cont", "ohm2k", "ohm200k"] },
  { texto: "Meça o resistor de 100 kΩ na escala certa.", ponto: "resistor-grande", escala: ["ohm200k"] },
  { texto: "Confira se o carregador do notebook entrega a tensão de saída.", ponto: "carregador-note", escala: ["vdc20", "vdc200"] },
];

/** Multímetro virtual: chave seletora, ponteiras e o que se mede numa bancada de informática e eletrônica. */
export function Multimetro() {
  const [escala, setEscala] = useState<Escala>("desligado");
  const [ligada, setLigada] = useState(false);
  const [invertido, setInvertido] = useState(false);
  const [ponto, setPonto] = useState("tomada");
  const [feitas, setFeitas] = useState<string[]>([]);
  const pontos = [...OUTROS.slice(0, 1), ...fiosAtx(ligada), ...OUTROS.slice(1)];
  const p = pontos.find((x) => x.id === ponto)!;
  const r = leitura(escala, p, invertido);
  const medir = (novaEscala: Escala, novoPonto: string, novaLigada: boolean) => {
    const pronta = MISSOES.findIndex((m, i) => !feitas.includes(String(i)) && m.ponto === novoPonto && m.escala.includes(novaEscala) && (m.ligada === undefined || m.ligada === novaLigada));
    if (pronta >= 0) setFeitas((f) => [...f, String(pronta)]);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div className="border-4 border-[#1b1b1b] bg-[#e8b520] p-4 text-[#1b1b1b]">
        <div className="border-2 border-[#1b1b1b] bg-[#b8c4a0] p-3 text-right font-mono text-4xl tabular-nums" aria-live="polite" aria-label="Visor do multímetro">{r.visor || " "}</div>
        <p className="mt-1 text-right font-mono text-xs">{ESCALAS.find((e) => e.id === escala)?.rotulo}</p>
        <fieldset className="mt-3 grid grid-cols-2 gap-1">
          <legend className="mb-1 font-mono text-[0.65rem] uppercase tracking-widest">Chave seletora</legend>
          {ESCALAS.map((e) => (
            <button key={e.id} type="button" aria-pressed={escala === e.id} onClick={() => { setEscala(e.id); medir(e.id, ponto, ligada); }} className={`cursor-pointer border-2 border-[#1b1b1b] px-2 py-1 font-mono text-xs ${escala === e.id ? "bg-[#1b1b1b] text-[#e8b520]" : "bg-[#f4d35e] hover:bg-[#f7e08a]"} ${e.id === "a10" ? "text-[#9b1c1c]" : ""}`}>{e.rotulo}</button>
          ))}
        </fieldset>
        <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={invertido} onChange={(e) => setInvertido(e.target.checked)} /> Inverter as ponteiras (vermelha no negativo)</label>
      </div>
      <div className="text-sm">
        <label className="block font-semibold" htmlFor="ponto-de-medida">Onde encostar as ponteiras</label>
        <select id="ponto-de-medida" value={ponto} onChange={(e) => { setPonto(e.target.value); medir(escala, e.target.value, ligada); }} className="mt-1 w-full border-2 border-ink bg-parchment px-2 py-1.5">
          {pontos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
        {FIOS_ATX.has(p.id) && (
          <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ligada} onChange={(e) => { setLigada(e.target.checked); medir(escala, ponto, e.target.checked); }} /> Fonte ligada (clipe unindo o fio verde a um preto, sem placa-mãe: o “teste do clipe”)</label>
        )}
        {r.alerta && <p role="alert" className={`mt-3 border-l-4 p-2 ${r.alerta.startsWith("PERIGO") ? "border-oxblood bg-oxblood/10 font-semibold" : "border-gold"}`}>{r.alerta}</p>}
        {r.ok && <p className="mt-3 border-l-4 border-ok p-2">{p.detalhe}</p>}
        <div className="mt-5 border-2 border-ink bg-parchment-deep p-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Missões ({feitas.length}/{MISSOES.length})</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {MISSOES.map((m, i) => <li key={m.texto} className={feitas.includes(String(i)) ? "text-ok line-through" : ""}>{m.texto}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}
