// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState, useSyncExternalStore } from "react";
import { Bancada, BotaoClaro, Leitura, PrevejaRode } from "../kit";

/** Expressões regulares: teste ao vivo e desafios. A expressão roda no aparelho, com limite de tamanho. */
const DESAFIOS = [
  { texto: "Ache todos os números de 3 dígitos.", amostra: "Rua 123, sala 45, CEP 20000-000, ramal 987.", certos: ["123", "200", "000", "987"], dica: "\\d{3}" },
  { texto: "Ache as palavras que começam com maiúscula.", amostra: "Machado de Assis nasceu no Rio de Janeiro em 1839.", certos: ["Machado", "Assis", "Rio", "Janeiro"], dica: "\\b[A-Z]\\w*" },
  { texto: "Ache os e-mails.", amostra: "Escreva para ana@escola.org ou para bia.santos@exemplo.com.br, não para @fulano.", certos: ["ana@escola.org", "bia.santos@exemplo.com.br"], dica: "[\\w.]+@[\\w.]+" },
  { texto: "Ache as datas no formato dia/mês/ano.", amostra: "Aula em 21/10/2026, prova em 3/11/2026 e entrega em 30/11.", certos: ["21/10/2026", "3/11/2026"], dica: "\\d{1,2}/\\d{1,2}/\\d{4}" },
];

export function Regex() {
  const [expr, setExpr] = useState("\\d+");
  const [texto, setTexto] = useState("O ônibus 485 passa às 7h20 e às 18h05; a passagem custa R$ 5,30.");
  const [flags, setFlags] = useState("g");
  const [desafio, setDesafio] = useState<number | null>(null);
  let re: RegExp | null = null;
  let erro = "";
  try {
    if (expr.length > 200) throw new Error("Expressão longa demais (até 200 caracteres).");
    re = new RegExp(expr, flags.includes("g") ? flags : `${flags}g`);
  } catch (e) {
    erro = (e as Error).message;
  }
  const alvo = desafio !== null ? DESAFIOS[desafio].amostra : texto;
  const achados: { i: number; t: string }[] = [];
  if (re && expr) {
    let m: RegExpExecArray | null;
    let voltas = 0;
    while ((m = re.exec(alvo)) && voltas++ < 500) {
      if (m[0] === "") { re.lastIndex++; continue; }
      achados.push({ i: m.index, t: m[0] });
    }
  }
  const partes: React.ReactNode[] = [];
  let pos = 0;
  achados.forEach((a, k) => { partes.push(alvo.slice(pos, a.i)); partes.push(<mark key={k} className="rounded bg-[#ffd27a] px-0.5">{a.t}</mark>); pos = a.i + a.t.length; });
  partes.push(alvo.slice(pos));
  const venceu = desafio !== null && JSON.stringify(achados.map((a) => a.t)) === JSON.stringify(DESAFIOS[desafio].certos);
  return (
    <Bancada titulo="Expressões regulares" subtitulo="Achar padrões em texto">
      <div className="flex flex-wrap gap-2">
        <BotaoClaro onClick={() => setDesafio(null)}>Livre</BotaoClaro>
        {DESAFIOS.map((d, i) => <BotaoClaro key={i} onClick={() => setDesafio(i)}>{`Desafio ${i + 1}`}</BotaoClaro>)}
      </div>
      {desafio !== null && <p className="mt-3 font-semibold">{DESAFIOS[desafio].texto}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono">
        <span>/</span><input value={expr} onChange={(e) => setExpr(e.target.value)} aria-label="Expressão" className="min-w-0 flex-1 border-2 border-ink bg-parchment px-2 py-1" spellCheck={false} /><span>/</span>
        <input value={flags} onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, "").slice(0, 5))} aria-label="Opções" className="w-16 border-2 border-ink bg-parchment px-2 py-1" />
      </div>
      {erro && <p className="mt-1 text-sm text-oxblood">{erro}</p>}
      {desafio === null && <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 2000))} rows={3} aria-label="Texto" className="mt-3 w-full border-2 border-ink/30 bg-parchment p-2 text-sm" />}
      <p className="mt-3 rounded border-2 border-ink bg-white p-3 text-lg leading-relaxed">{partes}</p>
      <p className="mt-2 text-sm">{achados.length} achado(s){venceu ? " · ✓ Desafio resolvido!" : ""}</p>
      {desafio !== null && !venceu && <details className="mt-1 text-sm"><summary className="cursor-pointer underline">Dica</summary><code>{DESAFIOS[desafio].dica}</code></details>}
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
        {[["\\d", "um dígito"], ["\\w", "letra, dígito ou _"], ["\\s", "espaço"], [".", "qualquer caractere"], ["+", "um ou mais"], ["*", "zero ou mais"], ["{2,4}", "de 2 a 4 vezes"], ["[aeiou]", "qualquer um desses"], ["^ $", "começo e fim"], ["\\b", "borda de palavra"], ["( )", "grupo"], ["|", "ou"]].map(([s, d]) => <p key={s}><code className="font-mono font-bold">{s}</code> {d}</p>)}
      </div>
    </Bancada>
  );
}

/** O que o navegador revela sobre você, sem pedir permissão. Lido aqui e mostrado só aqui: nada é enviado. */
const nada = () => () => undefined;
function lerNavegador() {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
  return JSON.stringify([
    ["Idioma preferido", n.language],
    ["Idiomas", (n.languages ?? []).join(", ")],
    ["Fuso horário", Intl.DateTimeFormat().resolvedOptions().timeZone],
    ["Tela", `${screen.width} × ${screen.height} (densidade ${window.devicePixelRatio})`],
    ["Janela", `${window.innerWidth} × ${window.innerHeight}`],
    ["Núcleos do processador", String(n.hardwareConcurrency ?? "?")],
    ["Memória (aproximada)", n.deviceMemory ? `${n.deviceMemory} GB` : "não informada"],
    ["Toque", navigator.maxTouchPoints > 0 ? `sim (${navigator.maxTouchPoints} pontos)` : "não"],
    ["Tema escuro preferido", matchMedia("(prefers-color-scheme: dark)").matches ? "sim" : "não"],
    ["Conexão", n.connection?.effectiveType ?? "não informada"],
    ["Sistema e navegador (user agent)", n.userAgent],
  ]);
}
export function NavegadorRevela() {
  const dados = useSyncExternalStore(nada, lerNavegador, () => "[]");
  const linhas = JSON.parse(dados) as [string, string][];
  return (
    <Bancada titulo="O que o seu navegador conta" subtitulo="Sem pedir licença, todo site pode ler isto">
      <p className="text-sm">Estes dados foram lidos agora, no seu aparelho, e <strong>não saíram dele</strong>. Mas qualquer site que você visita consegue ler os mesmos, e muitos mandam para empresas de propaganda.</p>
      <dl className="mt-3 divide-y divide-rule rounded border-2 border-ink bg-parchment">
        {linhas.map(([k, v]) => <div key={k} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[14rem_1fr]"><dt className="font-semibold">{k}</dt><dd className="break-all font-mono text-xs">{v}</dd></div>)}
      </dl>
      <div className="mt-4">
        <PrevejaRode pergunta="Só com isso, sem nome nem conta, dá para reconhecer você de um site para outro?" explicacao="Muitas vezes dá: a combinação de idioma, fuso, tela, núcleos, fontes e navegador é quase única (a chamada impressão digital do navegador). Somada a cookies de terceiros e ao endereço de rede, permite seguir uma pessoa pela internet sem ela perceber." limites="Mostramos só o que se lê sem pedir licença; scripts de rastreamento vão além (fontes instaladas, desenho em canvas, áudio)." aprofundar="Abra esta página em outro navegador ou no modo anônimo: o que muda? Navegadores com proteção contra rastreamento escondem parte disso." />
      </div>
    </Bancada>
  );
}

/** Laboratório no celular: acelerômetro (gravidade e queda livre), com plano B sem sensor. */
export function Sensores() {
  const [leitura, setLeitura] = useState<{ x: number; y: number; z: number } | null>(null);
  const [max, setMax] = useState(0);
  const [min, setMin] = useState(99);
  const [aviso, setAviso] = useState("");
  const [ligado, setLigado] = useState(false);
  async function ligar() {
    const D = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (!D) { setAviso("Este aparelho não tem sensor de movimento (ou o navegador não deixa ler). Use os dados de exemplo abaixo."); return; }
    try {
      if (D.requestPermission && (await D.requestPermission()) !== "granted") { setAviso("Sem permissão para ler o sensor."); return; }
    } catch {
      setAviso("O navegador não deixou pedir a permissão.");
      return;
    }
    setLigado(true);
    window.addEventListener("devicemotion", (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null) return;
      const v = { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 };
      const mod = Math.hypot(v.x, v.y, v.z);
      setLeitura(v);
      setMax((m) => Math.max(m, mod));
      setMin((m) => Math.min(m, mod));
    });
  }
  const mod = leitura ? Math.hypot(leitura.x, leitura.y, leitura.z) : 0;
  return (
    <Bancada titulo="Laboratório no celular" subtitulo="O acelerômetro mede a gravidade">
      <p className="text-sm">Calculado só no aparelho; nada é gravado nem enviado. No iPhone, o navegador pede licença ao ligar.</p>
      <div className="mt-3 flex flex-wrap gap-2"><BotaoClaro onClick={() => void ligar()} desligado={ligado}>Ligar o sensor</BotaoClaro><BotaoClaro onClick={() => { setMax(0); setMin(99); }}>Zerar máximo e mínimo</BotaoClaro></div>
      {aviso && <p className="mt-2 text-sm text-oxblood">{aviso}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Leitura rotulo="Aceleração total" valor={leitura ? `${mod.toFixed(2)} m/s²` : "—"} />
        <Leitura rotulo="Máxima" valor={max ? `${max.toFixed(1)}` : "—"} />
        <Leitura rotulo="Mínima" valor={min < 99 ? `${min.toFixed(1)}` : "—"} destaque={min < 2} />
        <Leitura rotulo="x · y · z" valor={leitura ? `${leitura.x.toFixed(1)} · ${leitura.y.toFixed(1)} · ${leitura.z.toFixed(1)}` : "—"} />
      </div>
      <p className="mt-3 text-sm"><strong>Dados de exemplo (sem sensor):</strong> parado sobre a mesa, o celular marca cerca de 9,8 m/s² (a gravidade). Num lançamento curto para cima, em cima de uma cama, a leitura cai perto de 0 durante o voo: em queda livre, o sensor “não sente” a gravidade.</p>
      <div className="mt-4">
        <PrevejaRode pergunta="Parado na mesa, o celular está acelerando? E quanto ele marca durante uma queda (com segurança, sobre a cama)?" explicacao="Parado, marca ~9,8 m/s²: o sensor mede a força que a mesa faz para segurar o celular contra a gravidade. Em queda livre, nada segura, e ele marca perto de 0. É o mesmo motivo de os astronautas flutuarem: estão caindo em volta da Terra o tempo todo." limites="Os sensores de celular variam; mexer a mão também acelera. Faça só experimentos seguros: nunca deixe o celular cair no chão." aprofundar="Gire o celular devagar: em qual eixo aparece o 9,8? O que isso diz sobre como o celular sabe se está deitado ou em pé?" />
      </div>
    </Bancada>
  );
}
