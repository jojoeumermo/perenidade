// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Selo } from "./Selo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LABS } from "@/lib/areas";
import { MarkdownEditor } from "./Editor";
import { useI18n } from "./I18n";
import { editorPt } from "./rotulosDoEditor";
import { Apresentador, Projetar } from "./sala-livre/Projetar";
import { gravarSalas, lerSalas, roteiro, type Sala } from "./sala-livre/salas";

// A Sala livre: o professor monta, no próprio navegador, uma aula com tudo o que o site oferece (texto, jogos, testes,
// laboratórios, obras do acervo, editores do Estúdio, simulações do PhET, ferramentas) e projeta na sala de aula, com
// ferramentas (temporizador, sorteio, grupos, placar, quadro) e o modo apresentador numa segunda janela. Nada vai para
// o servidor: as salas ficam neste navegador; para levar a outro computador ou mandar a um colega, baixe o arquivo.

const cerca = "```";
const recurso = (linha: string) => `${cerca}recurso\n${linha}\n${cerca}`;

/** Modelos de partida, no ritmo de uma boa aula: acolher, problematizar, praticar e fechar. */
const MODELOS: { nome: string; icone: string; sobre: string; titulo: string; corpo: string }[] = [
  {
    nome: "Aula com laboratório",
    icone: "frasco",
    sobre: "Uma pergunta para começar, o laboratório do site para praticar e um teste rápido no fim.",
    titulo: "Eletricidade na prática",
    corpo: `## Para começar · 10 min\n\nPergunte à turma: por que, numa casa, uma lâmpada queimada não apaga as outras?\n\n%% Anote os palpites no quadro antes de abrir o laboratório.\n\n## Na prática · 25 min\n\n${recurso("laboratorio: eletrica")}\n\n%% Peça que cada dupla queime uma lâmpada em série e depois em paralelo.\n\n## Para fechar · 10 min\n\n${cerca}teste\n? Numa casa, as lâmpadas são ligadas em…\n+ paralelo\n- série >> Em série, uma lâmpada queimada apagaria todas.\n> Cada lâmpada tem o próprio caminho até o quadro.\n${cerca}\n`,
  },
  {
    nome: "Modelo e previsão",
    icone: "epidemia",
    sobre: "A turma prevê, roda uma simulação do Laboratório de modelos e explica o que viu.",
    titulo: "Vacina e imunidade coletiva",
    corpo: `## Qual é o seu palpite? · 5 min\n\nSe metade da cidade se vacinar, a doença some, cai pela metade ou quase não muda?\n\n%% Cada um escreve o palpite no caderno. Não corrija ainda.\n\n## Rodar o modelo · 20 min\n\n${recurso("laboratorio: modelos")}\n\n%% Abra o módulo Epidemia. Peça para variar só a vacinação, mantendo o resto.\n\n## Comparar e explicar · 15 min\n\n1. O palpite bateu com o modelo?\n2. O que é o limiar de imunidade coletiva?\n3. O que o modelo deixa de fora?\n`,
  },
  {
    nome: "Rotação por estações",
    icone: "atualizar",
    sobre: "Três estações com tempo marcado: a turma roda em grupos (use o temporizador e o formar grupos).",
    titulo: "Estações de redes",
    corpo: `## Como vai ser · 5 min\n\nA turma se divide em três grupos. Cada estação tem 15 minutos; ao sinal, o grupo passa para a próxima.\n\n%% Abra 🧰 Ferramentas → Formar grupos, depois o Temporizador de 15 min.\n\n## Estação 1: montar a rede · 15 min\n\n${recurso("laboratorio: redes")}\n\n## Estação 2: o terminal · 15 min\n\n${recurso("laboratorio: linux")}\n\n## Estação 3: discutir · 15 min\n\nO que acontece quando você digita o endereço de um site? Desenhe o caminho.\n\n## Fechamento · 5 min\n\nCada grupo conta uma coisa que aprendeu.\n`,
  },
  {
    nome: "Debate regrado",
    icone: "microfone",
    sobre: "Pergunta, dois lados, tempo de fala e votação no fim (use o placar e o sorteio).",
    titulo: "Debate",
    corpo: `## A pergunta · 5 min\n\nO celular deve ser proibido na escola?\n\n%% Sorteie quem abre cada lado com Ferramentas → Sortear nome.\n\n## Preparar · 10 min\n\nCada lado junta três argumentos e uma fonte.\n\n## Falas · 20 min\n\n- 2 minutos para cada fala\n- Réplica de 1 minuto\n- Quem interrompe perde a vez\n\n## Votação e conversa · 10 min\n\nO que fez você mudar (ou não) de ideia?\n`,
  },
  {
    nome: "Roda de leitura",
    icone: "livros",
    sobre: "Uma obra do acervo, perguntas para conversar e uma linha do tempo para situar o texto.",
    titulo: "Roda de leitura",
    corpo: `## A obra · 10 min\n\n${recurso("obra: 1984")}\n\n## Para conversar · 25 min\n\n1. O que mais chamou a sua atenção?\n2. Isso acontece hoje? Onde?\n3. O que você mudaria no final?\n\n## Quando foi escrito · 10 min\n\n${cerca}linhadotempo\n1949 | Publicação do livro\n${cerca}\n`,
  },
  {
    nome: "Simulação de ciências",
    icone: "microscopio",
    sobre: "Uma simulação do PhET para explorar em grupo, com perguntas guiadas.",
    titulo: "Explorando circuitos",
    corpo: `## O que você acha que vai acontecer? · 5 min\n\nAntes de abrir a simulação, cada grupo escreve um palpite.\n\n${recurso("phet: circuit-construction-kit-dc")}\n\n## O que aconteceu de verdade? · 15 min\n\nCompare com o palpite: o que mudou na sua ideia?\n`,
  },
  {
    nome: "Oficina de criação",
    icone: "paleta",
    sobre: "Um editor do Estúdio de prática (foto, vídeo ou 3D) para a turma criar.",
    titulo: "Oficina de cartaz",
    corpo: `## A proposta · 10 min\n\nCriar um cartaz sobre um direito que falta no bairro.\n\n${recurso("estudio: photocraft")}\n\n## Para mostrar · 15 min\n\nCada grupo apresenta o cartaz e conta por que escolheu aquele tema.\n`,
  },
  { nome: "Em branco", icone: "folha", sobre: "Comece do zero.", titulo: "Nova sala", corpo: "## Para começar · 10 min\n\n" },
];

const ICONES_LAB: Record<string, string> = { ide: "terminal", linux: "pinguim", redes: "rede", seguranca: "escudo", montador: "chip", ia: "rede-neural", escritorio: "folha", simulacoes: "microscopio", eletrica: "raio", modelos: "probabilidade", quimica: "tubo" };

const novaId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function SalaLivre() {
  const { lang, t } = useI18n();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [projetando, setProjetando] = useState(false);
  const [apresentadorDe, setApresentadorDe] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setSalas(lerSalas());
      setApresentadorDe(new URLSearchParams(window.location.search).get("apresentador"));
      setCarregado(true);
    });
  }, []);
  const salvar = useCallback((lista: Sala[]) => {
    setSalas(lista);
    if (!gravarSalas(lista)) setAviso("Este navegador não deixou guardar (modo anônimo ou espaço cheio). Baixe o arquivo da sala para não perder.");
  }, []);
  const sala = salas.find((s) => s.id === aberta) ?? null;
  const plano = useMemo(() => (sala ? roteiro(sala.corpo) : []), [sala]);
  const mudar = (x: Partial<Sala>) => sala && salvar(salas.map((s) => (s.id === sala.id ? { ...s, ...x, atualizada: new Date().toISOString() } : s)));
  const criar = (m: { titulo: string; corpo: string; para?: string; objetivo?: string }) => {
    const agora = new Date().toISOString();
    const nova: Sala = { id: novaId(), titulo: m.titulo, para: m.para ?? "", objetivo: m.objetivo ?? "", corpo: m.corpo, criada: agora, atualizada: agora };
    salvar([nova, ...salas]);
    setAberta(nova.id);
  };
  const baixar = (s: Sala) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ tipo: "sala-livre-instituto-lucia", versao: 1, sala: s }, null, 2)], { type: "application/json" }));
    a.download = `${s.titulo.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() || "sala"}.sala.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const abrirArquivo = async (f?: File) => {
    if (!f || f.size > 2_000_000) return setAviso("Arquivo grande demais ou vazio.");
    try {
      const d = JSON.parse(await f.text()) as { tipo?: string; sala?: Partial<Sala> };
      if (d.tipo !== "sala-livre-instituto-lucia" || typeof d.sala?.corpo !== "string") throw new Error();
      criar({ titulo: String(d.sala.titulo ?? "Sala recebida").slice(0, 120), para: String(d.sala.para ?? "").slice(0, 120), objetivo: String(d.sala.objetivo ?? "").slice(0, 600), corpo: d.sala.corpo.slice(0, 200_000) });
    } catch {
      setAviso("Este arquivo não é uma sala do Instituto Lúcia.");
    }
  };

  if (!carregado) return <p className="mt-8 font-sans text-ink-soft">…</p>;
  if (apresentadorDe) return <Apresentador salaId={apresentadorDe} lang={lang} />;
  if (sala && projetando) return <Projetar sala={sala} lang={lang} fechar={() => setProjetando(false)} />;

  if (sala) {
    const total = plano.reduce((s, x) => s + x.minutos, 0);
    const nomes = t.labs as unknown as Record<string, string>;
    return (
      <div className="mt-6 font-sans">
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => setAberta(null)} className="cursor-pointer underline hover:text-oxblood">← Minhas salas</button>
          <span className="text-ink-soft">Guardada neste navegador · {new Date(sala.atualizada).toLocaleString("pt-BR")}</span>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Título da aula</span><input value={sala.titulo} onChange={(e) => mudar({ titulo: e.target.value.slice(0, 120) })} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2 font-serif text-2xl font-semibold" /></label>
          <label className="block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Para quem (turma, série)</span><input value={sala.para} onChange={(e) => mudar({ para: e.target.value.slice(0, 120) })} placeholder="8º ano B" className="mt-1 w-full border-2 border-ink/40 bg-parchment px-3 py-2" /></label>
        </div>
        <label className="mt-3 block"><span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Objetivo: o que a turma vai conseguir fazer no fim</span><input value={sala.objetivo} onChange={(e) => mudar({ objetivo: e.target.value.slice(0, 600) })} placeholder="Explicar por que as lâmpadas de uma casa são ligadas em paralelo" className="mt-1 w-full border-2 border-ink/40 bg-parchment px-3 py-2" /></label>
        <p className="mt-4 flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => setProjetando(true)} className="cursor-pointer bg-[#c21f16] px-5 py-2.5 font-bold text-white hover:bg-[#a51810]">▶ Projetar na sala</button>
          <button type="button" onClick={() => baixar(sala)} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood">Baixar o arquivo da sala</button>
          <button type="button" onClick={() => criar({ ...sala, titulo: `${sala.titulo} (cópia)`.slice(0, 120) })} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood">Duplicar</button>
          <button type="button" onClick={() => window.print()} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood">Imprimir</button>
          <button type="button" onClick={() => { if (window.confirm("Apagar esta sala deste navegador? Baixe o arquivo antes, se quiser guardar.")) { salvar(salas.filter((s) => s.id !== sala.id)); setAberta(null); } }} className="cursor-pointer px-3 py-2 text-oxblood underline">Apagar</button>
        </p>

        <section aria-label="Roteiro da aula" className="mt-5 rounded border-2 border-ink bg-parchment-deep p-3">
          <p className="flex flex-wrap items-baseline gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">Roteiro da aula <span className="font-mono normal-case tracking-normal">{plano.length + 1} telas{total ? ` · ${total} min planejados` : ""}</span></p>
          <ol className="mt-2 flex gap-1 overflow-x-auto pb-1 text-xs">
            <li className="shrink-0 rounded bg-ink px-2 py-1 text-parchment">Capa</li>
            {plano.map((x, k) => (
              <li key={k} className="shrink-0 rounded border border-ink/30 bg-parchment px-2 py-1" style={total && x.minutos ? { minWidth: `${Math.max(5, (x.minutos / total) * 100)}%` } : undefined}>
                <strong>{x.titulo}</strong>{x.minutos ? ` · ${x.minutos} min` : ""}{x.notas.length ? " · com notas" : ""}
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Pôr um laboratório na aula" className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Pôr um laboratório no fim da aula</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.keys(LABS).map((id) => (
              <button key={id} type="button" onClick={() => mudar({ corpo: `${sala.corpo.trimEnd()}\n\n## ${nomes[id] ?? id} · 20 min\n\n${recurso(`laboratorio: ${id}`)}\n` })} className="cursor-pointer rounded-full border-2 border-ink/25 bg-parchment px-3 py-1 text-sm hover:border-oxblood">
                <Selo nome={ICONES_LAB[id] ?? "frasco"} className="h-5 w-5" /> {nomes[id] ?? id}
              </button>
            ))}
          </div>
        </section>

        <p className="mt-4 border-l-4 border-gold bg-parchment-deep px-3 py-2 text-sm">Cada <strong>## Título</strong> vira uma tela; escreva <strong>## Título · 10 min</strong> para planejar o tempo (o relógio da projeção avisa quando passar). Linhas que começam com <strong>%%</strong> são <strong>notas suas</strong>: não aparecem para a turma, só no <strong>modo apresentador</strong>. Use <strong>＋ bloco</strong> para pôr jogos, testes, mapas, linhas do tempo, obras do acervo, editores do Estúdio ou simulações do PhET.</p>
        <div className="mt-4">
          <MarkdownEditor id="sala-livre" value={sala.corpo} onChange={(corpo) => mudar({ corpo: corpo.slice(0, 200_000) })} labels={editorPt} blocos rows={20} />
        </div>
        {aviso && <p role="alert" className="mt-3 text-oxblood">{aviso}</p>}
      </div>
    );
  }

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const achadas = termo ? salas.filter((s) => `${s.titulo} ${s.para} ${s.objetivo}`.toLocaleLowerCase("pt-BR").includes(termo)) : salas;
  return (
    <div className="mt-8 font-sans">
      {aviso && <p role="alert" className="mb-4 text-oxblood">{aviso}</p>}
      <section className="cartao-preto grid gap-4 p-4 sm:grid-cols-4">
        {[["tela", "Projetar", "Uma tela por vez, com setas, tela cheia e tela preta (B)."], ["pessoa", "Modo apresentador", "Segunda janela com notas, próxima tela e relógio."], ["ferramentas", "Ferramentas", "Temporizador, sorteio de nomes, grupos e placar."], ["lapis", "Quadro", "Risque por cima da tela projetada."]].map(([i, n, d]) => (
          <p key={n} className="flex gap-2.5 text-sm [--prelo-texto:#e0837a]"><Selo nome={i} className="h-7 w-7 shrink-0" /><span><strong>{n}</strong><br /><span className="text-[#f4ecd8]/75">{d}</span></span></p>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Começar uma sala</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODELOS.map((m) => (
            <li key={m.nome}>
              <button type="button" onClick={() => criar(m)} className="cartao sobe flex h-full w-full cursor-pointer items-start gap-3 p-4 text-left">
                <span className="selo h-11 w-11"><Selo nome={m.icone} className="h-7 w-7" /></span>
                <span><span className="block font-bold">{m.nome}</span><span className="block text-sm text-ink-soft">{m.sobre}</span></span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => arquivo.current?.click()} className="flex h-full w-full cursor-pointer items-start gap-3 border-2 border-dashed border-ink/40 p-4 text-left hover:border-oxblood">
              <span className="selo h-11 w-11"><Selo nome="baixar" className="h-7 w-7" /></span>
              <span><span className="block font-bold">Abrir uma sala recebida</span><span className="block text-sm text-ink-soft">O arquivo .sala.json que um colega mandou.</span></span>
            </button>
            <input ref={arquivo} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void abrirArquivo(e.target.files?.[0]); e.target.value = ""; }} />
          </li>
        </ul>
      </section>
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-serif text-2xl font-semibold">Minhas salas <span className="font-mono text-sm font-normal text-ink-soft">{salas.length}</span></h2>
          {salas.length > 3 && <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por título, turma ou objetivo" aria-label="Procurar nas minhas salas" className="ml-auto w-full max-w-xs border-2 border-ink/30 bg-parchment px-3 py-1.5 text-sm" />}
        </div>
        {salas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma ainda. As salas ficam só neste navegador: ninguém mais vê.</p>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {achadas.map((s) => {
            const r = roteiro(s.corpo);
            const min = r.reduce((a, x) => a + x.minutos, 0);
            return (
              <li key={s.id} className="flex items-start justify-between gap-3 border-2 border-ink bg-parchment p-4">
                <button type="button" onClick={() => setAberta(s.id)} className="min-w-0 cursor-pointer text-left">
                  <span className="block font-serif text-xl font-semibold hover:text-oxblood">{s.titulo}</span>
                  <span className="block text-sm text-ink-soft">{s.para || "sem turma"} · {r.length + 1} telas{min ? ` · ${min} min` : ""} · {new Date(s.atualizada).toLocaleDateString("pt-BR")}</span>
                </button>
                <button type="button" onClick={() => { setAberta(s.id); setProjetando(true); }} className="shrink-0 cursor-pointer bg-ink px-3 py-1.5 text-sm font-bold text-parchment hover:bg-oxblood">▶ Projetar</button>
              </li>
            );
          })}
        </ul>
        {termo && achadas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma sala com “{busca}”.</p>}
      </section>
    </div>
  );
}
