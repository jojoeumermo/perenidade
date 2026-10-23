// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import exercicios from "@/content/laboratorios/redes.json";
import { type Cabo, COMANDOS_DO_IOS, comandoDeHost, comandoDeIos, completar, type Dispositivo, type Estado, estadoNovo, type Evento, type ExercicioDeRede, LIMITE_DE_DISPOSITIVOS, mascaraValida, navegar, novoDispositivo, pedirDhcp, prompt, type Resultado, type Sessao, servicosPadrao, type TipoDeDispositivo, type Topologia, validarTopologia, verificar, vizinho, ipValido } from "@/lib/redes/motor";

const TIPOS: { tipo: TipoDeDispositivo; nome: string; icone: string }[] = [
  { tipo: "pc", nome: "PC", icone: "M4 5h16v11H4zM9 20h6M12 16v4" },
  { tipo: "notebook", nome: "Notebook", icone: "M5 6h14v9H5zM2 18h20" },
  { tipo: "servidor", nome: "Servidor", icone: "M5 4h14v5H5zM5 11h14v5H5zM5 18h14v2H5zM8 6.5h.01M8 13.5h.01" },
  { tipo: "switch", nome: "Switch", icone: "M3 9h18v6H3zM7 12h.01M10 12h.01M13 12h.01M16 12h.01" },
  { tipo: "roteador", nome: "Roteador", icone: "M3 12a9 4 0 1 0 18 0 9 4 0 1 0-18 0M8 12l3-2M16 12l-3 2M12 8v8" },
];
const COR: Record<TipoDeDispositivo, string> = { pc: "#17130e", notebook: "#17130e", servidor: "#4a4032", switch: "#6e1f1a", roteador: "#c21f16" };
const CHAVE = "lucia:lab:redes";
/** A cor de cada protocolo, nos envelopes animados e na lista de eventos. */
const COR_DO_PROTOCOLO: [RegExp, string, string][] = [[/ARP/, "#d4a24c", "ARP"], [/ICMP/, "#8b3fc4", "ICMP"], [/DHCP/, "#e0701a", "DHCP"], [/DNS/, "#1f6fd1", "DNS"], [/HTTP/, "#2e8b57", "HTTP"]];
const corDoProtocolo = (p?: string) => COR_DO_PROTOCOLO.find(([r]) => r.test(p ?? ""))?.[1] ?? "#8a8070";
const botao = "cursor-pointer bg-ink px-3 py-1.5 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const campo = "mt-1 w-full border-2 border-ink bg-parchment px-2 py-1 font-mono text-xs";

const clonar = (t: Topologia): Topologia => JSON.parse(JSON.stringify(t)) as Topologia;
const vazia = (): Topologia => ({ dispositivos: [], cabos: [] });

/**
 * O Laboratório de Redes: editor de topologia (arrastar, cabear, configurar), terminal de PC, switch e roteador, e
 * o modo "ver o pacote andando", com os eventos passo a passo. Exercícios com correção automática vêm de
 * content/laboratorios/redes.json. Tudo roda no navegador; a topologia baixa e abre como JSON.
 */
export function LabRedes() {
  const [t, setT] = useState<Topologia>(() => {
    try {
      const guardada = window.localStorage.getItem(CHAVE);
      return guardada ? validarTopologia(JSON.parse(guardada)) : exemplo();
    } catch {
      return exemplo();
    }
  });
  const [historico, setHistorico] = useState<Topologia[]>([]);
  const [refeito, setRefeito] = useState<Topologia[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [cabeando, setCabeando] = useState<{ dispositivo: string; porta: string } | null>(null);
  const [ferramenta, setFerramenta] = useState<"mover" | "cabo">("mover");
  const [zoom, setZoom] = useState(1);
  const [arrasto, setArrasto] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [estado, setEstado] = useState<Estado>(() => estadoNovo());
  const [simulacao, setSimulacao] = useState<{ eventos: Evento[]; passo: number; rodando: boolean; velocidade: number; resumo: string; sucesso: boolean } | null>(null);
  const [exercicio, setExercicio] = useState<ExercicioDeRede | null>(null);
  const [resultado, setResultado] = useState<ReturnType<typeof verificar> | null>(null);
  const [dica, setDica] = useState(0);
  const [aviso, setAviso] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const lista = exercicios as unknown as ExercicioDeRede[];
  const sel = t.dispositivos.find((d) => d.id === selecionado) ?? null;

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(t));
    } catch {
      // sem armazenamento
    }
  }, [t]);
  useEffect(() => {
    if (!simulacao?.rodando) return;
    const id = window.setInterval(() => setSimulacao((s) => (s && s.passo < s.eventos.length - 1 ? { ...s, passo: s.passo + 1 } : s ? { ...s, rodando: false } : s)), 1400 / simulacao.velocidade);
    return () => window.clearInterval(id);
  }, [simulacao?.rodando, simulacao?.velocidade]);

  /** Toda mudança passa por aqui: guarda o antes (desfazer) e zera as tabelas (a rede "reinicia"). */
  function mudar(f: (copia: Topologia) => void) {
    setT((atual) => {
      const copia = clonar(atual);
      f(copia);
      setHistorico((h) => [...h.slice(-40), atual]);
      setRefeito([]);
      return copia;
    });
    setEstado(estadoNovo());
    setResultado(null);
  }
  const desfazer = () => { const h = historico[historico.length - 1]; if (h) { setRefeito((r) => [...r, t]); setHistorico((x) => x.slice(0, -1)); setT(h); } };
  const refazer = () => { const r = refeito[refeito.length - 1]; if (r) { setHistorico((h) => [...h, t]); setRefeito((x) => x.slice(0, -1)); setT(r); } };

  function adicionar(tipo: TipoDeDispositivo) {
    if (t.dispositivos.length >= LIMITE_DE_DISPOSITIVOS) return setAviso(`Limite de ${LIMITE_DE_DISPOSITIVOS} dispositivos nesta topologia.`);
    const n = t.dispositivos.filter((d) => d.tipo === tipo).length + 1;
    mudar((c) => c.dispositivos.push(novoDispositivo(tipo, n, 80 + ((c.dispositivos.length * 90) % 600), 80 + Math.floor((c.dispositivos.length * 90) / 600) * 120)));
  }
  function apagar(id: string) {
    mudar((c) => { c.dispositivos = c.dispositivos.filter((d) => d.id !== id); c.cabos = c.cabos.filter((cb) => cb.de.dispositivo !== id && cb.para.dispositivo !== id); });
    setSelecionado(null);
  }
  function clicarPorta(dispositivo: string, porta: string) {
    if (t.cabos.some((c) => (c.de.dispositivo === dispositivo && c.de.porta === porta) || (c.para.dispositivo === dispositivo && c.para.porta === porta))) {
      mudar((c) => { c.cabos = c.cabos.filter((cb) => !((cb.de.dispositivo === dispositivo && cb.de.porta === porta) || (cb.para.dispositivo === dispositivo && cb.para.porta === porta))); });
      setCabeando(null);
      return;
    }
    if (!cabeando) return setCabeando({ dispositivo, porta });
    if (cabeando.dispositivo === dispositivo) return setCabeando(null);
    const a = t.dispositivos.find((d) => d.id === cabeando.dispositivo)!;
    const b = t.dispositivos.find((d) => d.id === dispositivo)!;
    const cruzado = (a.tipo === "switch") === (b.tipo === "switch");
    mudar((c) => c.cabos.push({ id: `cabo-${Date.now().toString(36)}`, de: { ...cabeando }, para: { dispositivo, porta } }));
    setAviso(`Cabo ${cruzado ? "cruzado" : "direto"} ligado (${a.nome} ${cabeando.porta} ↔ ${b.nome} ${porta}). Hoje quase toda porta ajusta sozinha (Auto-MDIX).`);
    setCabeando(null);
  }
  function posicao(e: React.PointerEvent): { x: number; y: number } {
    const r = svg.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }
  function simular(r: Resultado) {
    setSimulacao({ eventos: r.eventos, passo: 0, rodando: false, velocidade: 1, resumo: r.resumo, sucesso: r.sucesso });
  }
  function baixar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: "application/json" }));
    a.download = "rede.json";
    a.click();
  }
  async function abrir(f: File | undefined) {
    if (!f) return;
    try {
      if (f.size > 1024 * 1024) throw new Error("grande");
      const nova = validarTopologia(JSON.parse(await f.text()));
      setHistorico((h) => [...h, t]);
      setT(nova);
      setEstado(estadoNovo());
      setAviso("Topologia aberta.");
    } catch {
      setAviso("Não deu para abrir: o arquivo precisa ser um JSON de topologia deste laboratório, até 1 MB.");
    }
  }
  function abrirExercicio(ex: ExercicioDeRede | null) {
    setExercicio(ex);
    setResultado(null);
    setDica(0);
    setSimulacao(null);
    setSelecionado(null);
    if (ex) { setHistorico((h) => [...h, t]); setT(clonar(ex.topologia)); setEstado(estadoNovo()); }
  }

  const evento = simulacao ? simulacao.eventos[simulacao.passo] : null;
  const ponto = (id: string) => { const d = t.dispositivos.find((x) => x.id === id); return d ? { x: d.x, y: d.y } : { x: 0, y: 0 }; };
  const largura = Math.max(760, ...t.dispositivos.map((d) => d.x + 120));
  const altura = Math.max(420, ...t.dispositivos.map((d) => d.y + 120));

  return (
    <div className="mt-6 font-sans text-sm">
      {exercicio && (
        <section className="mb-4 border-l-4 border-oxblood bg-parchment-deep p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">Exercício · nível {exercicio.nivel}</p>
          <h2 className="mt-1 font-serif text-xl font-semibold">{exercicio.titulo}</h2>
          <p className="mt-1">{exercicio.objetivo}</p>
          <p className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={botao} onClick={() => setResultado(verificar(t, exercicio))}>Conferir</button>
            {dica < exercicio.dicas.length && <button type="button" className="cursor-pointer underline" onClick={() => setDica((n) => n + 1)}>Dica ({dica + 1}/{exercicio.dicas.length})</button>}
            {exercicio.solucao && resultado && !resultado.every((r) => r.passou) && <details className="inline"><summary className="cursor-pointer underline">Ver a solução</summary><pre className="mt-2 whitespace-pre-wrap border border-rule bg-parchment p-2 font-mono text-xs">{exercicio.solucao}</pre></details>}
            <button type="button" className="cursor-pointer underline" onClick={() => abrirExercicio(null)}>Sair do exercício</button>
          </p>
          {exercicio.dicas.slice(0, dica).map((d, i) => <p key={i} className="mt-1 text-ink-soft">{d}</p>)}
          {resultado && (
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {resultado.map((r, i) => <li key={i} className={r.passou ? "text-ok" : "text-oxblood"}>{r.passou ? "✓" : "✗"} {r.verificacao.texto}{!r.passou && ` — ${r.detalhe}`}</li>)}
              {resultado.every((r) => r.passou) && <li className="font-sans font-semibold text-ok">Tudo certo! Exercício concluído.</li>}
            </ul>
          )}
        </section>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Adicionar:</span>
        {TIPOS.map((x) => (
          <button key={x.tipo} type="button" className={claro} onClick={() => adicionar(x.tipo)} title={x.nome}>
            <svg aria-hidden viewBox="0 0 24 24" className="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={x.icone} /></svg>{x.nome}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-rule" />
        <button type="button" aria-pressed={ferramenta === "mover"} className={ferramenta === "mover" ? botao : claro} onClick={() => { setFerramenta("mover"); setCabeando(null); }}>Mover</button>
        <button type="button" aria-pressed={ferramenta === "cabo"} className={ferramenta === "cabo" ? botao : claro} onClick={() => setFerramenta("cabo")}>Cabo</button>
        <button type="button" className={claro} onClick={desfazer} disabled={!historico.length} aria-label="Desfazer">↶</button>
        <button type="button" className={claro} onClick={refazer} disabled={!refeito.length} aria-label="Refazer">↷</button>
        <button type="button" className={claro} onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Afastar">−</button>
        <span className="font-mono text-xs">{Math.round(zoom * 100)}%</span>
        <button type="button" className={claro} onClick={() => setZoom((z) => Math.min(2, z + 0.1))} aria-label="Aproximar">+</button>
        <span className="mx-1 h-5 w-px bg-rule" />
        <button type="button" className={claro} onClick={baixar}>Baixar JSON</button>
        <button type="button" className={claro} onClick={() => arquivo.current?.click()}>Abrir JSON</button>
        <input ref={arquivo} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void abrir(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="cursor-pointer underline" onClick={() => { if (window.confirm("Começar uma rede vazia?")) { setHistorico((h) => [...h, t]); setT(vazia()); setEstado(estadoNovo()); } }}>Nova</button>
        <details className="ml-auto">
          <summary className="cursor-pointer underline">Exercícios ({lista.length})</summary>
          <ol className="absolute z-10 mt-1 max-h-64 w-72 overflow-y-auto border-2 border-ink bg-parchment p-2 shadow-lg">
            {lista.map((ex, i) => <li key={ex.id}><button type="button" className="cursor-pointer py-0.5 text-left underline hover:text-oxblood" onClick={() => abrirExercicio(ex)}>{i + 1}. {ex.titulo} <span className="font-mono text-[0.6rem] text-ink-soft">{"●".repeat(ex.nivel)}</span></button></li>)}
          </ol>
        </details>
      </div>
      <p role="status" className="mt-1 min-h-5 text-xs text-ink-soft">{aviso || (ferramenta === "cabo" ? (cabeando ? `Agora clique numa porta de outro dispositivo (de ${t.dispositivos.find((d) => d.id === cabeando.dispositivo)?.nome} ${cabeando.porta}).` : "Clique numa porta (círculo) e depois noutra para ligar o cabo; clique numa porta cabeada para desligar.") : "Arraste os dispositivos; clique para configurar. No celular, toque e segure para arrastar.")}</p>

      <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-auto border-4 border-ink bg-[#f8f2e4]" style={{ maxHeight: "34rem" }}>
          <svg ref={svg} width={largura * zoom} height={altura * zoom} viewBox={`0 0 ${largura} ${altura}`} className="block touch-none select-none"
            onPointerMove={(e) => { if (arrasto) { const p = posicao(e); setT((atual) => ({ ...atual, dispositivos: atual.dispositivos.map((d) => (d.id === arrasto.id ? { ...d, x: Math.max(40, p.x - arrasto.dx), y: Math.max(40, p.y - arrasto.dy) } : d)) })); } }}
            onPointerUp={() => setArrasto(null)} onPointerLeave={() => setArrasto(null)}>
            <defs><pattern id="grade" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0v20" fill="none" stroke="#e6dcc4" strokeWidth="1" /></pattern></defs>
            <rect width={largura} height={altura} fill="url(#grade)" />
            {t.cabos.map((c) => {
              const a = ponto(c.de.dispositivo); const b = ponto(c.para.dispositivo);
              const ativo = evento && ((evento.de === c.de.dispositivo && evento.para === c.para.dispositivo) || (evento.de === c.para.dispositivo && evento.para === c.de.dispositivo));
              const da = t.dispositivos.find((d) => d.id === c.de.dispositivo); const db = t.dispositivos.find((d) => d.id === c.para.dispositivo);
              const up = da && db && vizinho(t, da.id, c.de.porta);
              return <g key={c.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ativo ? "#c21f16" : up ? "#17130e" : "#b9ad90"} strokeWidth={ativo ? 4 : 2} strokeDasharray={up ? undefined : "6 4"} /><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fontSize="9" textAnchor="middle" fill="#8a5a16" fontFamily="monospace">{c.de.porta}·{c.para.porta}</text></g>;
            })}
            {evento && evento.de !== evento.para && (() => { const a = ponto(evento.de); const b = ponto(evento.para); const cor = evento.erro ? "#c21f16" : corDoProtocolo(evento.pacote?.protocolo); return (
              <g key={`${simulacao?.passo}`}>
                <g><rect x={-11} y={-8} width={22} height={16} rx={2} fill={cor} stroke="#17130e" strokeWidth="1.5" /><path d="M-11 -8 L0 1 L11 -8" fill="none" stroke="#17130e" strokeWidth="1.5" />
                  <animateMotion dur={`${1.2 / (simulacao?.velocidade ?? 1)}s`} fill="freeze" path={`M${a.x} ${a.y} L${b.x} ${b.y}`} /></g>
              </g>); })()}
            {t.dispositivos.map((d) => {
              const icone = TIPOS.find((x) => x.tipo === d.tipo)!.icone;
              const ativo = evento && (evento.de === d.id || evento.para === d.id);
              return (
                <g key={d.id} transform={`translate(${d.x} ${d.y})`} className="cursor-pointer"
                  onPointerDown={(e) => { if (ferramenta === "mover") { const p = posicao(e); setArrasto({ id: d.id, dx: p.x - d.x, dy: p.y - d.y }); (e.target as Element).setPointerCapture?.(e.pointerId); } setSelecionado(d.id); }}>
                  <rect x={-26} y={-26} width={52} height={52} rx={6} fill={COR[d.tipo]} stroke={selecionado === d.id ? "#d4a24c" : ativo ? "#c21f16" : "#17130e"} strokeWidth={selecionado === d.id || ativo ? 4 : 2} />
                  <svg x={-16} y={-16} width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#f4ecd8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icone} /></svg>
                  <text y={42} textAnchor="middle" fontSize="12" fontWeight="600" fill="#17130e">{d.nome}</text>
                  {d.portas[0]?.ip && d.tipo !== "switch" && <text y={54} textAnchor="middle" fontSize="9" fill="#4a4032" fontFamily="monospace">{d.tipo === "roteador" ? `${d.portas.filter((p) => p.ip).length} if` : d.portas[0].ip}</text>}
                  {ferramenta === "cabo" && d.portas.map((p, i) => {
                    const ang = (i / d.portas.length) * Math.PI * 2 - Math.PI / 2;
                    const cx = Math.cos(ang) * 38; const cy = Math.sin(ang) * 38;
                    const cabeada = t.cabos.some((c) => (c.de.dispositivo === d.id && c.de.porta === p.nome) || (c.para.dispositivo === d.id && c.para.porta === p.nome));
                    const marcada = cabeando?.dispositivo === d.id && cabeando.porta === p.nome;
                    return <g key={p.nome} onPointerDown={(e) => { e.stopPropagation(); clicarPorta(d.id, p.nome); }}><circle cx={cx} cy={cy} r={6} fill={marcada ? "#d4a24c" : cabeada ? "#17130e" : p.ligada ? "#f4ecd8" : "#b9ad90"} stroke="#17130e" strokeWidth="1.5" /><title>{p.nome}{cabeada ? " (cabeada)" : ""}{p.ligada ? "" : " (desligada)"}</title></g>;
                  })}
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="min-w-0">
          {sel ? <Painel key={`${sel.id}-${sel.nome}`} d={sel} t={t} estado={estado} mudar={mudar} apagar={() => apagar(sel.id)} simular={simular} /> : (
            <div className="border-2 border-ink bg-parchment-deep p-4 text-ink-soft">
              <p>Clique num dispositivo para configurar ou abrir o terminal.</p>
              <p className="mt-2 text-xs">Este simulador é didático e não é o IOS da Cisco. Para OSPF, BGP e ACLs avançadas, use o Packet Tracer oficial (gratuito, com cadastro na Cisco Networking Academy).</p>
            </div>
          )}
        </aside>
      </div>

      {simulacao && (
        <section className="mt-4 border-2 border-ink bg-parchment-deep p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Modo simulação</p>
            <span className="flex flex-wrap gap-2 text-[0.65rem]">{COR_DO_PROTOCOLO.map(([, cor, nome]) => <span key={nome}><span className="mr-0.5 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: cor }} />{nome}</span>)}</span>
            <span className={`ml-2 font-semibold ${simulacao.sucesso ? "text-ok" : "text-oxblood"}`}>{simulacao.resumo}</span>
            <span className="ml-auto flex items-center gap-1">
              <button type="button" className={claro} onClick={() => setSimulacao({ ...simulacao, passo: Math.max(0, simulacao.passo - 1), rodando: false })}>◀</button>
              <button type="button" className={botao} onClick={() => setSimulacao({ ...simulacao, rodando: !simulacao.rodando, passo: simulacao.passo >= simulacao.eventos.length - 1 ? 0 : simulacao.passo })}>{simulacao.rodando ? "Pausar" : "▶ Tocar"}</button>
              <button type="button" className={claro} onClick={() => setSimulacao({ ...simulacao, passo: Math.min(simulacao.eventos.length - 1, simulacao.passo + 1), rodando: false })}>▶</button>
              <label className="ml-2 text-xs">velocidade <select value={simulacao.velocidade} onChange={(e) => setSimulacao({ ...simulacao, velocidade: Number(e.target.value) })} className="border border-rule bg-parchment px-1"><option value={0.5}>0,5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></label>
              <button type="button" className="cursor-pointer underline" onClick={() => setSimulacao(null)}>fechar</button>
            </span>
          </div>
          <ol className="mt-3 max-h-56 space-y-0.5 overflow-y-auto font-mono text-xs">
            {simulacao.eventos.map((ev, i) => (
              <li key={i}>
                <button type="button" onClick={() => setSimulacao({ ...simulacao, passo: i, rodando: false })} className={`w-full cursor-pointer px-2 py-0.5 text-left ${i === simulacao.passo ? "bg-ink text-parchment" : ev.erro ? "text-oxblood" : ""}`}>
                  <span className="mr-2 inline-block w-6 text-right opacity-60">{i + 1}</span><span className="mr-2 inline-block h-2.5 w-3.5 rounded-sm align-middle" style={{ background: ev.erro ? "#c21f16" : corDoProtocolo(ev.pacote?.protocolo) }} title={ev.pacote?.protocolo} /><span className="mr-2 opacity-60">L{ev.camada}</span>{ev.texto}
                </button>
              </li>
            ))}
          </ol>
          {evento?.pacote && (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-rule pt-3 font-mono text-xs sm:grid-cols-3">
              <div><dt className="text-ink-soft">protocolo</dt><dd>{evento.pacote.protocolo}{evento.pacote.vlan ? ` · VLAN ${evento.pacote.vlan}` : ""}</dd></div>
              {evento.pacote.origemMac && <div><dt className="text-ink-soft">MAC origem → destino</dt><dd>{evento.pacote.origemMac} → {evento.pacote.destinoMac}</dd></div>}
              {evento.pacote.origemIp && <div><dt className="text-ink-soft">IP origem → destino</dt><dd>{evento.pacote.origemIp} → {evento.pacote.destinoIp}</dd></div>}
              {evento.pacote.ttl !== undefined && <div><dt className="text-ink-soft">TTL</dt><dd>{evento.pacote.ttl}</dd></div>}
            </dl>
          )}
          <p className="mt-2 text-xs text-ink-soft">Em linguagem simples: MAC é o endereço físico da placa (camada 2, só na rede local); IP é o endereço lógico (camada 3, atravessa roteadores); TTL cai 1 a cada roteador e, ao chegar a zero, o pacote morre (é assim que o traceroute descobre o caminho).</p>
        </section>
      )}
      <details className="mt-4 text-xs text-ink-soft">
        <summary className="cursor-pointer">Comandos disponíveis neste simulador</summary>
        <p className="mt-1">PC, notebook e servidor: ipconfig, ipconfig /renew (DHCP), ping (por IP ou nome), traceroute (tracert), nslookup, arp -a. Servidores têm DHCP, DNS e site (HTTP) na aba Serviços; PCs têm navegador.</p>
        <p className="mt-1">Switch e roteador (modos usuário &gt;, privilegiado #, configuração): {COMANDOS_DO_IOS.join(" · ")}. Não há OSPF, RIP, BGP, ACL nem NAT: para isso, o Packet Tracer oficial.</p>
      </details>
      <p className="mt-2 text-xs text-ink-soft">Tudo roda no navegador: a topologia fica guardada só aqui (e no JSON que você baixar). Nenhum dado vai para servidor. Este laboratório é obra do instituto, não é afiliado à Cisco; os comandos seguem o jeito comum de equipamentos de rede.</p>
    </div>
  );
}

/** O painel do dispositivo escolhido: configuração gráfica e terminal. */
function Painel({ d, t, estado, mudar, apagar, simular }: { d: Dispositivo; t: Topologia; estado: Estado; mudar: (f: (c: Topologia) => void) => void; apagar: () => void; simular: (r: Resultado) => void }) {
  const [aba, setAba] = useState<"config" | "servicos" | "navegador" | "terminal">("config");
  const [nome, setNome] = useState(d.nome);
  const host = d.tipo !== "switch" && d.tipo !== "roteador";
  const editar = (f: (x: Dispositivo) => void) => mudar((c) => { const x = c.dispositivos.find((y) => y.id === d.id); if (x) f(x); });
  return (
    <div className="border-2 border-ink bg-parchment-deep p-3">
      <div className="flex items-center justify-between gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 20))} onBlur={() => nome.trim() && nome !== d.nome && editar((x) => { x.nome = nome.trim(); })} aria-label="Nome" className="min-w-0 flex-1 border-b-2 border-ink bg-transparent font-serif text-lg font-semibold outline-none" />
        <button type="button" className="cursor-pointer text-xs underline hover:text-oxblood" onClick={() => { if (window.confirm(`Apagar ${d.nome}?`)) apagar(); }}>apagar</button>
      </div>
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{TIPOS.find((x) => x.tipo === d.tipo)?.nome}</p>
      <div className="mt-2 flex gap-1" role="tablist">
        {([["config", host ? "Configuração IP" : "Configurar"], ...(d.tipo === "servidor" ? [["servicos", "Serviços"]] : []), ...(host ? [["navegador", "Navegador"]] : []), ["terminal", host ? "Prompt" : "CLI"]] as [typeof aba, string][]).map(([a, nomeDaAba]) => <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)} className={`cursor-pointer rounded-t border-x border-t px-2 py-1 text-xs font-semibold ${aba === a ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment"}`}>{nomeDaAba}</button>)}
      </div>
      {aba === "servicos" && d.servicos ? (
        <Servicos d={d} editar={editar} />
      ) : aba === "navegador" ? (
        <Navegador d={d} t={t} estado={estado} simular={simular} />
      ) : aba === "config" ? (
        host ? (
          <div className="mt-2 space-y-2">
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="radio" checked={!d.dhcp} onChange={() => editar((x) => { x.dhcp = false; })} /> Endereço fixo</label>
              <label className="flex items-center gap-1"><input type="radio" checked={d.dhcp} onChange={() => editar((x) => { x.dhcp = true; })} /> DHCP (automático)</label>
            </div>
            {d.dhcp && (
              <button type="button" className={botao} onClick={() => {
                const r = pedirDhcp(t, estado, d.id);
                simular(r);
                if (r.config) { const c = r.config; editar((x) => { x.portas[0].ip = c.ip; x.portas[0].mascara = c.mascara; x.gateway = c.gateway; x.dns = c.dns; }); }
              }}>Pedir endereço (DHCP)</button>
            )}
            {([["ip", "Endereço IP"], ["mascara", "Máscara"]] as const).map(([k, rotulo]) => (
              <label key={k} className="block text-xs">{rotulo}<input value={d.portas[0][k]} onChange={(e) => editar((x) => { x.portas[0][k] = e.target.value.trim(); })} placeholder={k === "ip" ? "192.168.1.10" : "255.255.255.0"} className={`${campo} ${d.portas[0][k] && !(k === "ip" ? ipValido(d.portas[0][k]) : mascaraValida(d.portas[0][k])) ? "border-oxblood" : ""}`} /></label>
            ))}
            <label className="block text-xs">Gateway padrão<input value={d.gateway} onChange={(e) => editar((x) => { x.gateway = e.target.value.trim(); })} placeholder="192.168.1.1" className={campo} /></label>
            <label className="block text-xs">Servidor DNS<input value={d.dns} onChange={(e) => editar((x) => { x.dns = e.target.value.trim(); })} placeholder="10.0.0.50" className={campo} /></label>
            <p className="text-xs text-ink-soft">{vizinho(t, d.id, "eth0") ? `eth0 ligada a ${vizinho(t, d.id, "eth0")!.dispositivo.nome}` : "eth0 sem cabo"}</p>
          </div>
        ) : d.tipo === "roteador" ? (
          <div className="mt-2 space-y-2">
            {d.portas.map((p) => (
              <fieldset key={p.nome} className="border border-rule p-2">
                <legend className="px-1 font-mono text-xs">{p.nome} <label className="ml-2 cursor-pointer font-sans"><input type="checkbox" checked={p.ligada} onChange={(e) => editar((x) => { x.portas.find((q) => q.nome === p.nome)!.ligada = e.target.checked; })} /> ligada</label></legend>
                <div className="grid grid-cols-2 gap-2">
                  <input value={p.ip} onChange={(e) => editar((x) => { x.portas.find((q) => q.nome === p.nome)!.ip = e.target.value.trim(); })} placeholder="IP" aria-label={`IP ${p.nome}`} className={campo} />
                  <input value={p.mascara} onChange={(e) => editar((x) => { x.portas.find((q) => q.nome === p.nome)!.mascara = e.target.value.trim(); })} placeholder="Máscara" aria-label={`Máscara ${p.nome}`} className={campo} />
                </div>
                <p className="mt-1 text-[0.65rem] text-ink-soft">{vizinho(t, d.id, p.nome) ? `ligada a ${vizinho(t, d.id, p.nome)!.dispositivo.nome}` : "sem cabo"}</p>
              </fieldset>
            ))}
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Rotas estáticas</p>
            {d.rotas.map((r, i) => <p key={i} className="flex items-center justify-between font-mono text-xs"><span>{r.rede} {r.mascara} → {r.via}</span><button type="button" className="cursor-pointer underline" onClick={() => editar((x) => { x.rotas.splice(i, 1); })}>tirar</button></p>)}
            <NovaRota aoAdicionar={(r) => editar((x) => { x.rotas.push(r); })} />
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">VLANs: {d.vlans.map((v) => `${v.id} (${v.nome})`).join(", ")}</p>
            <table className="w-full font-mono text-xs"><thead><tr className="text-left"><th>Porta</th><th>Modo</th><th>VLAN</th><th>Up</th></tr></thead>
              <tbody>{d.portas.map((p) => (
                <tr key={p.nome}><td>{p.nome}</td>
                  <td><select value={p.modo} onChange={(e) => editar((x) => { x.portas.find((q) => q.nome === p.nome)!.modo = e.target.value as "access" | "trunk"; })} className="border border-rule bg-parchment"><option value="access">access</option><option value="trunk">trunk</option></select></td>
                  <td><input type="number" min={1} max={4094} value={p.vlan} disabled={p.modo === "trunk"} onChange={(e) => editar((x) => { const q = x.portas.find((y) => y.nome === p.nome)!; q.vlan = Number(e.target.value) || 1; if (!x.vlans.some((v) => v.id === q.vlan)) x.vlans.push({ id: q.vlan, nome: `VLAN${String(q.vlan).padStart(4, "0")}` }); })} className="w-14 border border-rule bg-parchment px-1" /></td>
                  <td><input type="checkbox" checked={p.ligada} onChange={(e) => editar((x) => { x.portas.find((q) => q.nome === p.nome)!.ligada = e.target.checked; })} /></td></tr>
              ))}</tbody></table>
          </div>
        )
      ) : (
        <Terminal d={d} t={t} estado={estado} host={host} simular={simular} mudar={mudar} />
      )}
    </div>
  );
}

/** Os serviços do servidor: DHCP, DNS e o site (HTTP). */
function Servicos({ d, editar }: { d: Dispositivo; editar: (f: (x: Dispositivo) => void) => void }) {
  const sv = d.servicos ?? servicosPadrao();
  const [registro, setRegistro] = useState({ nome: "", ip: "" });
  const muda = (f: (x: NonNullable<Dispositivo["servicos"]>) => void) => editar((x) => { x.servicos ??= servicosPadrao(); f(x.servicos); });
  return (
    <div className="mt-2 space-y-3 text-xs">
      <fieldset className="border border-rule p-2">
        <legend className="px-1 font-semibold"><label className="flex items-center gap-1"><input type="checkbox" checked={sv.dhcp.ligado} onChange={(e) => muda((x) => { x.dhcp.ligado = e.target.checked; })} /> DHCP</label></legend>
        <div className="grid grid-cols-2 gap-2">
          <label>Primeiro endereço<input value={sv.dhcp.inicio} onChange={(e) => muda((x) => { x.dhcp.inicio = e.target.value.trim(); })} placeholder="192.168.1.100" className={campo} /></label>
          <label>Quantos<input type="number" min={1} max={250} value={sv.dhcp.quantidade} onChange={(e) => muda((x) => { x.dhcp.quantidade = Math.min(250, Math.max(1, Number(e.target.value) || 1)); })} className={campo} /></label>
          <label>Máscara<input value={sv.dhcp.mascara} onChange={(e) => muda((x) => { x.dhcp.mascara = e.target.value.trim(); })} className={campo} /></label>
          <label>Gateway<input value={sv.dhcp.gateway} onChange={(e) => muda((x) => { x.dhcp.gateway = e.target.value.trim(); })} className={campo} /></label>
          <label className="col-span-2">DNS entregue<input value={sv.dhcp.dns} onChange={(e) => muda((x) => { x.dhcp.dns = e.target.value.trim(); })} className={campo} /></label>
        </div>
      </fieldset>
      <fieldset className="border border-rule p-2">
        <legend className="px-1 font-semibold"><label className="flex items-center gap-1"><input type="checkbox" checked={sv.dns.ligado} onChange={(e) => muda((x) => { x.dns.ligado = e.target.checked; })} /> DNS</label></legend>
        {sv.dns.registros.map((r, i) => <p key={i} className="flex items-center justify-between font-mono"><span>{r.nome} → {r.ip}</span><button type="button" className="cursor-pointer underline" onClick={() => muda((x) => { x.dns.registros.splice(i, 1); })}>tirar</button></p>)}
        <div className="mt-1 grid grid-cols-[1fr_1fr_auto] gap-1">
          <input value={registro.nome} onChange={(e) => setRegistro({ ...registro, nome: e.target.value.trim().toLowerCase() })} placeholder="nome (escola.lucia)" aria-label="Nome" className={campo} />
          <input value={registro.ip} onChange={(e) => setRegistro({ ...registro, ip: e.target.value.trim() })} placeholder="IP" aria-label="IP" className={campo} />
          <button type="button" className={`${claro} mt-1`} disabled={!registro.nome || !ipValido(registro.ip)} onClick={() => { muda((x) => { x.dns.registros.push(registro); }); setRegistro({ nome: "", ip: "" }); }}>+</button>
        </div>
      </fieldset>
      <fieldset className="border border-rule p-2">
        <legend className="px-1 font-semibold"><label className="flex items-center gap-1"><input type="checkbox" checked={sv.http.ligado} onChange={(e) => muda((x) => { x.http.ligado = e.target.checked; })} /> Site (HTTP)</label></legend>
        <label className="block">Título<input value={sv.http.titulo} onChange={(e) => muda((x) => { x.http.titulo = e.target.value.slice(0, 80); })} className={campo} /></label>
        <label className="mt-1 block">Texto da página<textarea value={sv.http.texto} onChange={(e) => muda((x) => { x.http.texto = e.target.value.slice(0, 1000); })} rows={3} className={campo} /></label>
      </fieldset>
    </div>
  );
}

/** O navegador do PC: digita um endereço, a rede resolve o nome e busca a página, com os pacotes à vista. */
function Navegador({ d, t, estado, simular }: { d: Dispositivo; t: Topologia; estado: Estado; simular: (r: Resultado) => void }) {
  const [endereco, setEndereco] = useState("");
  const [pagina, setPagina] = useState<{ titulo: string; texto: string; servidor: string } | { erro: string } | null>(null);
  return (
    <div className="mt-2 overflow-hidden rounded border-2 border-ink bg-white">
      <form className="flex gap-1 border-b-2 border-ink bg-[#e9e4d8] p-1.5" onSubmit={(e) => { e.preventDefault(); const r = navegar(t, estado, d.id, endereco); simular(r); setPagina(r.pagina ?? { erro: r.resumo }); }}>
        <input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="http://escola.lucia ou um IP" aria-label="Endereço" className="min-w-0 flex-1 rounded border border-ink/40 bg-white px-2 py-1 font-mono text-xs" />
        <button type="submit" className={botao}>Ir</button>
      </form>
      <div className="min-h-32 p-3 text-sm">
        {!pagina && <p className="text-ink-soft">Digite o nome de um site da sua rede (cadastrado num servidor DNS) ou o IP do servidor.</p>}
        {pagina && "erro" in pagina && <p className="text-oxblood">Não foi possível abrir: {pagina.erro}</p>}
        {pagina && "titulo" in pagina && <><h3 className="font-serif text-xl font-semibold">{pagina.titulo}</h3><p className="mt-2 whitespace-pre-wrap">{pagina.texto}</p><p className="mt-3 text-xs text-ink-soft">Servido por {pagina.servidor}.</p></>}
      </div>
    </div>
  );
}

function NovaRota({ aoAdicionar }: { aoAdicionar: (r: { rede: string; mascara: string; via: string }) => void }) {
  const [r, setR] = useState({ rede: "", mascara: "", via: "" });
  const ok = ipValido(r.rede) && mascaraValida(r.mascara) && r.via.trim() !== "";
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
      <input value={r.rede} onChange={(e) => setR({ ...r, rede: e.target.value.trim() })} placeholder="rede (0.0.0.0)" aria-label="Rede" className={campo} />
      <input value={r.mascara} onChange={(e) => setR({ ...r, mascara: e.target.value.trim() })} placeholder="máscara" aria-label="Máscara" className={campo} />
      <input value={r.via} onChange={(e) => setR({ ...r, via: e.target.value.trim() })} placeholder="via (IP ou Gi0/1)" aria-label="Via" className={campo} />
      <button type="button" className={`${claro} mt-1`} disabled={!ok} onClick={() => { aoAdicionar(r); setR({ rede: "", mascara: "", via: "" }); }}>+</button>
    </div>
  );
}

/** O terminal: de host (ipconfig, ping…) ou de switch/roteador (subconjunto do IOS). */
function Terminal({ d, t, estado, host, simular, mudar }: { d: Dispositivo; t: Topologia; estado: Estado; host: boolean; simular: (r: Resultado) => void; mudar: (f: (c: Topologia) => void) => void }) {
  const [linhas, setLinhas] = useState<string[]>([host ? `Terminal de ${d.nome}. Digite help.` : `${d.nome} — digite ? para ajuda, enable para configurar.`]);
  const [comando, setComando] = useState("");
  const [sessao, setSessao] = useState<Sessao>({ modo: "usuario" });
  const [hist, setHist] = useState<string[]>([]);
  const [pos, setPos] = useState<number | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  // Chave no corpo: o scrollIntoView do Chrome novo devolve uma promessa, e efeito que devolve algo que não é função derruba a página.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [linhas]);
  const p = host ? `${d.nome}> ` : `${prompt(d, sessao)} `;
  function enviar() {
    const c = comando;
    setLinhas((l) => [...l.slice(-300), `${p}${c}`]);
    if (c.trim()) setHist((h) => [...h, c]);
    setComando("");
    setPos(null);
    if (host) {
      const r = comandoDeHost(t, estado, d, c);
      if (r.saida) setLinhas((l) => [...l, ...r.saida.split("\n")]);
      if (r.resultado) simular(r.resultado);
      if (r.aplicar) { const a = r.aplicar; mudar((top) => { const x = top.dispositivos.find((y) => y.id === d.id); if (x) { x.dhcp = true; x.portas[0].ip = a.ip; x.portas[0].mascara = a.mascara; x.gateway = a.gateway; x.dns = a.dns; } }); }
      return;
    }
    // Os comandos de configuração mudam o dispositivo: passam por "mudar" (desfazer, tabelas zeradas).
    const antes = JSON.stringify(d);
    const copia = JSON.parse(antes) as Dispositivo;
    const r = comandoDeIos(t, estado, copia, sessao, c);
    if (JSON.stringify(copia) !== antes) mudar((top) => { const i = top.dispositivos.findIndex((x) => x.id === d.id); if (i >= 0) top.dispositivos[i] = copia; });
    setSessao(r.sessao);
    if (r.saida) setLinhas((l) => [...l, ...r.saida.split("\n")]);
    if (r.resultado) simular(r.resultado);
  }
  return (
    <div className="mt-2 border-2 border-ink bg-[#17130e] p-2 font-mono text-[0.75rem] text-[#efe4c8]" onClick={() => document.getElementById(`term-${d.id}`)?.focus()}>
      <div className="h-56 overflow-y-auto whitespace-pre-wrap">{linhas.map((l, i) => <div key={i}>{l}</div>)}<div ref={fim} /></div>
      <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <span className="shrink-0 text-[#d4a24c]">{p}</span>
        <input id={`term-${d.id}`} value={comando} onChange={(e) => setComando(e.target.value)} autoComplete="off" spellCheck={false} aria-label="Comando" className="min-w-0 flex-1 bg-transparent outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && hist.length) { e.preventDefault(); const n = pos === null ? hist.length - 1 : Math.max(0, pos - 1); setPos(n); setComando(hist[n]); }
            if (e.key === "ArrowDown" && pos !== null) { e.preventDefault(); const n = pos + 1; if (n >= hist.length) { setPos(null); setComando(""); } else { setPos(n); setComando(hist[n]); } }
            if (e.key === "Tab" && !host) { e.preventDefault(); const c = completar(comando, sessao); if (c) setComando(c); }
            if (e.key === "?" && !host && comando.trim() === "") { e.preventDefault(); setComando("?"); window.setTimeout(enviar, 0); }
          }} />
      </form>
    </div>
  );
}

/** A rede de exemplo que abre na primeira vez: dois PCs, um switch e um roteador para outra rede com um servidor. */
function exemplo(): Topologia {
  const pc1 = novoDispositivo("pc", 1, 90, 110); pc1.portas[0].ip = "192.168.1.10"; pc1.portas[0].mascara = "255.255.255.0"; pc1.gateway = "192.168.1.1";
  const pc2 = novoDispositivo("pc", 2, 90, 290); pc2.portas[0].ip = "192.168.1.11"; pc2.portas[0].mascara = "255.255.255.0"; pc2.gateway = "192.168.1.1";
  const sw = novoDispositivo("switch", 1, 300, 200);
  const r = novoDispositivo("roteador", 1, 500, 200); r.portas[0] = { ...r.portas[0], ligada: true, ip: "192.168.1.1", mascara: "255.255.255.0" }; r.portas[1] = { ...r.portas[1], ligada: true, ip: "10.0.0.1", mascara: "255.255.255.0" };
  const srv = novoDispositivo("servidor", 1, 690, 200); srv.portas[0].ip = "10.0.0.50"; srv.portas[0].mascara = "255.255.255.0"; srv.gateway = "10.0.0.1";
  const cabo = (a: Dispositivo, pa: string, b: Dispositivo, pb: string): Cabo => ({ id: `cabo-${a.id}-${b.id}`, de: { dispositivo: a.id, porta: pa }, para: { dispositivo: b.id, porta: pb } });
  return { dispositivos: [pc1, pc2, sw, r, srv], cabos: [cabo(pc1, "eth0", sw, "Fa0/1"), cabo(pc2, "eth0", sw, "Fa0/2"), cabo(sw, "Fa0/8", r, "Gi0/0"), cabo(r, "Gi0/1", srv, "eth0")] };
}

