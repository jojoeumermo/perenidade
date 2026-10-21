// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { Bancada, BotaoClaro, Escolha } from "../../labs/kit";
import { AVISO_DE_VOZ, ComoUsar, falar } from "./comum";

// ───────────── Tons do mandarim ─────────────

/** Os contornos dos tons na escala de 5 níveis de Chao (1 = grave, 5 = agudo). */
const TONS: { n: number; nome: string; contorno: number[]; dur: number; marca: string; dica: string }[] = [
  { n: 1, nome: "1º tom (alto e reto)", contorno: [5, 5], dur: 0.55, marca: "ā", dica: "Alto e parado, como uma nota cantada." },
  { n: 2, nome: "2º tom (sobe)", contorno: [3, 5], dur: 0.5, marca: "á", dica: "Sobe, como quando se pergunta “hein?”." },
  { n: 3, nome: "3º tom (desce e sobe)", contorno: [2, 1, 4], dur: 0.65, marca: "ǎ", dica: "Desce até o grave e volta a subir; na fala rápida, muitas vezes só desce." },
  { n: 4, nome: "4º tom (desce forte)", contorno: [5, 1], dur: 0.4, marca: "à", dica: "Cai de uma vez, como uma ordem: “Não!”." },
  { n: 0, nome: "Tom neutro (curto e leve)", contorno: [3, 3], dur: 0.18, marca: "a", dica: "Curto e sem força; aparece em partículas e sílabas finais." },
];
const PARES: { base: string; itens: [number, string, string, string][] }[] = [
  { base: "ma", itens: [[1, "妈", "mā", "mãe"], [2, "麻", "má", "cânhamo; dormente"], [3, "马", "mǎ", "cavalo"], [4, "骂", "mà", "xingar"], [0, "吗", "ma", "partícula de pergunta"]] },
  { base: "tang", itens: [[1, "汤", "tāng", "sopa"], [2, "糖", "táng", "açúcar, bala"], [3, "躺", "tǎng", "deitar-se"], [4, "烫", "tàng", "muito quente, escaldante"]] },
  { base: "shi", itens: [[1, "诗", "shī", "poema"], [2, "十", "shí", "dez"], [3, "史", "shǐ", "história"], [4, "是", "shì", "ser"]] },
  { base: "mai", itens: [[3, "买", "mǎi", "comprar"], [4, "卖", "mài", "vender"]] },
];

function tocarTom(contorno: number[], dur: number) {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = "sawtooth";
  f.type = "lowpass";
  f.frequency.value = 1400;
  // Cada nível da escala vale cerca de 3 semitons, a partir de 130 Hz.
  const hz = (nivel: number) => 130 * 2 ** (((nivel - 1) * 3) / 12);
  const t0 = ctx.currentTime + 0.02;
  o.frequency.setValueAtTime(hz(contorno[0]), t0);
  contorno.forEach((nivel, i) => { if (i > 0) o.frequency.linearRampToValueAtTime(hz(nivel), t0 + (dur * i) / (contorno.length - 1)); });
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.22, t0 + 0.03);
  g.gain.setValueAtTime(0.22, t0 + dur - 0.06);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(f).connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  window.setTimeout(() => void ctx.close(), (dur + 0.3) * 1000);
}

function Curva({ contorno, cor = "#c21f16", destaque = false }: { contorno: number[]; cor?: string; destaque?: boolean }) {
  const pts = contorno.map((nv, i) => `${10 + (i / Math.max(1, contorno.length - 1)) * 80},${90 - (nv - 1) * 20}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-24" aria-hidden>
      {[1, 2, 3, 4, 5].map((nv) => <line key={nv} x1="5" x2="95" y1={90 - (nv - 1) * 20} y2={90 - (nv - 1) * 20} stroke="#00000018" />)}
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={destaque ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TonsDoMandarim() {
  const [pergunta, setPergunta] = useState<number | null>(null);
  const [resposta, setResposta] = useState<number | null>(null);
  const [acertos, setAcertos] = useState({ certo: 0, total: 0 });
  const nova = () => { const t = TONS[Math.floor(Math.random() * 4)]; setPergunta(t.n); setResposta(null); tocarTom(t.contorno, t.dur); };
  const tom = (n: number) => TONS.find((t) => t.n === n)!;
  return (
    <div>
      <Bancada titulo="Tons do mandarim" subtitulo="A mesma sílaba, quatro sentidos">
        <p className="text-sm">O som dos tons é gerado aqui, no navegador, desenhando a melodia de cada um (não é gravação de gente). O botão 你 usa a voz do seu aparelho, se houver uma em chinês. Não usamos o microfone.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TONS.map((t) => (
            <button key={t.n} type="button" onClick={() => tocarTom(t.contorno, t.dur)} className="flex cursor-pointer flex-col items-center rounded-md border-2 border-ink/20 bg-parchment-deep p-3 text-center hover:border-ink">
              <Curva contorno={t.contorno} />
              <span className="font-mono text-2xl">m{t.marca}</span>
              <span className="text-xs font-semibold">{t.nome}</span>
              <span className="mt-1 text-xs text-ink-soft">{t.dica}</span>
            </button>
          ))}
        </div>
        <h3 className="mt-6 font-semibold">Pares mínimos: troque o tom, troque a palavra</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <tbody>
              {PARES.map((p) => (
                <tr key={p.base} className="border-t border-rule">
                  <th className="py-2 pr-3 text-left font-mono">{p.base}</th>
                  {p.itens.map(([n, hanzi, pinyin, sentido]) => (
                    <td key={hanzi} className="py-2 pr-2">
                      <button type="button" onClick={() => { tocarTom(tom(n).contorno, tom(n).dur); }} className="cursor-pointer text-left"><span className="text-2xl">{hanzi}</span> <span className="font-mono">{pinyin}</span></button>
                      <button type="button" onClick={() => falar(hanzi, "zh-CN", 0.7)} title="Ouvir na voz do aparelho" className="ml-1 cursor-pointer text-xs underline">voz</button>
                      <span className="block text-xs text-ink-soft">{sentido}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="mt-6 rounded-md border-2 border-ink p-4">
          <h3 className="font-semibold">Treino de ouvido</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <BotaoClaro onClick={nova}>🔊 Tocar um tom</BotaoClaro>
            {pergunta !== null && <BotaoClaro onClick={() => tocarTom(tom(pergunta).contorno, tom(pergunta).dur)}>Repetir</BotaoClaro>}
            <span className="text-sm text-ink-soft">{acertos.total ? `${acertos.certo} de ${acertos.total}` : ""}</span>
          </div>
          {pergunta !== null && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" disabled={resposta !== null} onClick={() => { setResposta(n); setAcertos((a) => ({ certo: a.certo + (n === pergunta ? 1 : 0), total: a.total + 1 })); }} className={`flex cursor-pointer items-center gap-1 rounded border-2 px-3 py-1 ${resposta === null ? "border-ink/30 hover:border-ink" : n === pergunta ? "border-[#1d6b3a] bg-[#1d6b3a]/10" : n === resposta ? "border-oxblood" : "border-ink/10 opacity-50"}`}>
                  <Curva contorno={tom(n).contorno} /> {n}º
                </button>
              ))}
            </div>
          )}
          {resposta !== null && pergunta !== null && <p className="mt-2 text-sm">{resposta === pergunta ? "✓ Isso!" : `Era o ${pergunta}º tom: ${tom(pergunta).dica}`}</p>}
        </section>
        <p className="mt-4 text-sm"><strong>Atenção ao 3º tom:</strong> dois 3º tons seguidos viram 2º + 3º. Por isso 你好 (nǐ hǎo, “olá”) soa como “ní hǎo”.</p>
        <p className="mt-2 text-xs text-ink-soft">{AVISO_DE_VOZ}</p>
      </Bancada>
      <ComoUsar
        passos={["Toque em cada tom para ouvir a melodia e ver a curva.", "Nos pares mínimos, compare palavras que só mudam no tom.", "No treino de ouvido, ouça e escolha qual tom tocou."]}
        atividades={["Diga em voz alta mā, má, mǎ, mà, imitando as curvas. Grave-se no seu celular e compare (a gravação fica só com você).", "Explique a alguém por que 买 (mǎi) e 卖 (mài) não podem ser confundidos numa feira.", "Faça 10 rodadas do treino de ouvido. Qual tom você mais confunde com qual?"]}
        revisao
      />
    </div>
  );
}

// ───────────── Alfabetos ─────────────

type Letra = [string, string, string?];
const ALFABETOS: Record<string, { nome: string; lang: string; grupos: { nome: string; letras: Letra[] }[]; fala?: (l: Letra) => string; nota: string }> = {
  cirilico: {
    nome: "Cirílico (russo)", lang: "ru-RU", nota: "Transcrição aproximada para quem fala português.",
    grupos: [
      { nome: "Iguais ao nosso alfabeto", letras: [["А а", "a"], ["К к", "k"], ["М м", "m"], ["О о", "o"], ["Т т", "t"], ["Е е", "ie", "como “ié”"]] },
      { nome: "Falsos amigos (parecem, mas são outra letra)", letras: [["В в", "v"], ["Н н", "n"], ["Р р", "r", "vibrante, como em “caro”"], ["С с", "s", "sempre “ss”"], ["У у", "u"], ["Х х", "kh", "como o “j” do espanhol"]] },
      { nome: "Novas", letras: [["Б б", "b"], ["Г г", "g", "como em “gato”"], ["Д д", "d"], ["Ё ё", "io", "como “ió”"], ["Ж ж", "j", "como em “janela”"], ["З з", "z"], ["И и", "i"], ["Й й", "i breve", "como o “i” de “pai”"], ["Л л", "l"], ["П п", "p"], ["Ф ф", "f"], ["Ц ц", "ts"], ["Ч ч", "tch"], ["Ш ш", "ch", "como em “chave”"], ["Щ щ", "chtch", "um “ch” longo e suave"], ["Ъ ъ", "sinal duro", "sem som"], ["Ы ы", "y", "um “i” fechado, sem igual no português"], ["Ь ь", "sinal brando", "amolece a consoante de antes"], ["Э э", "e", "como “é”"], ["Ю ю", "iu"], ["Я я", "ia"]] },
    ],
    fala: (l) => l[0].split(" ")[1],
  },
  hiragana: {
    nome: "Hiragana (japonês)", lang: "ja-JP", nota: "Romanização Hepburn.",
    grupos: [
      { nome: "Vogais", letras: [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]] },
      { nome: "K e S", letras: [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"], ["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]] },
      { nome: "T e N", letras: [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"], ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]] },
      { nome: "H e M", letras: [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"], ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]] },
      { nome: "Y, R, W e N", letras: [["や", "ya"], ["ゆ", "yu"], ["よ", "yo"], ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"], ["わ", "wa"], ["を", "wo"], ["ん", "n"]] },
    ],
  },
  katakana: {
    nome: "Katakana (japonês)", lang: "ja-JP", nota: "Romanização Hepburn. O katakana escreve palavras estrangeiras e nomes de fora.",
    grupos: [
      { nome: "Vogais", letras: [["ア", "a"], ["イ", "i"], ["ウ", "u"], ["エ", "e"], ["オ", "o"]] },
      { nome: "K e S", letras: [["カ", "ka"], ["キ", "ki"], ["ク", "ku"], ["ケ", "ke"], ["コ", "ko"], ["サ", "sa"], ["シ", "shi"], ["ス", "su"], ["セ", "se"], ["ソ", "so"]] },
      { nome: "T e N", letras: [["タ", "ta"], ["チ", "chi"], ["ツ", "tsu"], ["テ", "te"], ["ト", "to"], ["ナ", "na"], ["ニ", "ni"], ["ヌ", "nu"], ["ネ", "ne"], ["ノ", "no"]] },
      { nome: "H e M", letras: [["ハ", "ha"], ["ヒ", "hi"], ["フ", "fu"], ["ヘ", "he"], ["ホ", "ho"], ["マ", "ma"], ["ミ", "mi"], ["ム", "mu"], ["メ", "me"], ["モ", "mo"]] },
      { nome: "Y, R, W e N", letras: [["ヤ", "ya"], ["ユ", "yu"], ["ヨ", "yo"], ["ラ", "ra"], ["リ", "ri"], ["ル", "ru"], ["レ", "re"], ["ロ", "ro"], ["ワ", "wa"], ["ヲ", "wo"], ["ン", "n"]] },
    ],
  },
  hangul: {
    nome: "Hangul (coreano)", lang: "ko-KR", nota: "Romanização revisada do coreano. As letras se juntam em blocos de sílaba: ㅎ + ㅏ + ㄴ = 한.",
    grupos: [
      { nome: "Vogais básicas", letras: [["ㅏ", "a", "아"], ["ㅑ", "ya", "야"], ["ㅓ", "eo", "어"], ["ㅕ", "yeo", "여"], ["ㅗ", "o", "오"], ["ㅛ", "yo", "요"], ["ㅜ", "u", "우"], ["ㅠ", "yu", "유"], ["ㅡ", "eu", "으"], ["ㅣ", "i", "이"]] },
      { nome: "Consoantes básicas", letras: [["ㄱ", "g / k", "가"], ["ㄴ", "n", "나"], ["ㄷ", "d / t", "다"], ["ㄹ", "r / l", "라"], ["ㅁ", "m", "마"], ["ㅂ", "b / p", "바"], ["ㅅ", "s", "사"], ["ㅇ", "muda no começo; ng no fim", "아"], ["ㅈ", "j", "자"], ["ㅊ", "ch", "차"], ["ㅋ", "k", "카"], ["ㅌ", "t", "타"], ["ㅍ", "p", "파"], ["ㅎ", "h", "하"]] },
    ],
    fala: (l) => l[2] ?? l[0],
  },
};

/** Um quadro para treinar a escrita por cima da letra (o traço fica só na tela). */
function Quadro({ letra }: { letra: string }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    c.width = c.clientWidth * (window.devicePixelRatio || 1);
    c.height = c.clientHeight * (window.devicePixelRatio || 1);
    const ctx = c.getContext("2d");
    if (ctx) { ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1); ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.strokeStyle = "#c21f16"; }
  }, [letra]);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  return (
    <div className="relative h-48 w-48 rounded border-2 border-ink bg-white">
      <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[8rem] leading-none text-[#00000018]">{letra.split(" ")[0]}</span>
      <canvas ref={tela} className="absolute inset-0 h-full w-full touch-none" aria-label={`Treine a escrita de ${letra} por cima`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); ultimo.current = pos(e); }}
        onPointerMove={(e) => { const u = ultimo.current; const ctx = e.currentTarget.getContext("2d"); if (!u || !ctx) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ultimo.current = p; }}
        onPointerUp={() => { ultimo.current = null; }} />
      <button type="button" onClick={() => { const c = tela.current; c?.getContext("2d")?.clearRect(0, 0, c.width, c.height); }} className="absolute right-1 bottom-1 cursor-pointer rounded bg-parchment px-2 text-xs underline">limpar</button>
    </div>
  );
}

export function Alfabetos() {
  const [qual, setQual] = useState("cirilico");
  const [sel, setSel] = useState<Letra | null>(null);
  const [quiz, setQuiz] = useState<{ certa: Letra; opcoes: Letra[]; inverso: boolean } | null>(null);
  const [resp, setResp] = useState<string | null>(null);
  const a = ALFABETOS[qual];
  const todas = a.grupos.flatMap((g) => g.letras);
  const ouvir = (l: Letra) => falar(a.fala ? a.fala(l) : l[0], a.lang, 0.7);
  const sortear = () => {
    const embaralha = <T,>(x: T[]) => [...x].sort(() => Math.random() - 0.5);
    const certa = todas[Math.floor(Math.random() * todas.length)];
    const outras = embaralha(todas.filter((l) => l !== certa)).slice(0, 3);
    setQuiz({ certa, opcoes: embaralha([certa, ...outras]), inverso: Math.random() < 0.5 });
    setResp(null);
  };
  return (
    <div>
      <Bancada titulo="Alfabetos" subtitulo="Cirílico, kana e hangul: reconhecer, ouvir e escrever">
        <Escolha rotulo="Alfabeto" valor={qual} opcoes={Object.entries(ALFABETOS).map(([k, v]) => [k, v.nome])} mudar={(v) => { setQual(v); setSel(null); setQuiz(null); }} />
        <p className="mt-2 text-xs text-ink-soft">{a.nota}</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            {a.grupos.map((g) => (
              <section key={g.nome}>
                <h3 className="font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">{g.nome}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.letras.map((l) => (
                    <button key={l[0]} type="button" onClick={() => { setSel(l); ouvir(l); }} aria-pressed={sel === l} className={`min-w-14 cursor-pointer rounded border-2 px-2 py-1 text-center ${sel === l ? "border-ink bg-[#ffd27a]" : "border-ink/20 bg-parchment hover:border-ink"}`}>
                      <span className="block text-2xl">{l[0]}</span><span className="block font-mono text-xs">{l[1]}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div>
            {sel ? (
              <div>
                <Quadro letra={sel[0]} />
                <p className="mt-2 text-center"><span className="text-3xl">{sel[0]}</span> <span className="font-mono">{sel[1]}</span></p>
                {qual !== "hangul" && sel[2] && <p className="text-center text-xs text-ink-soft">{sel[2]}</p>}
                {qual === "hangul" && sel[2] && <p className="text-center text-xs text-ink-soft">sílaba de exemplo: {sel[2]}</p>}
                <p className="mt-1 text-center"><button type="button" className="cursor-pointer underline" onClick={() => ouvir(sel)}>🔊 ouvir</button></p>
              </div>
            ) : <p className="w-48 text-sm text-ink-soft">Toque numa letra para ouvir e treinar a escrita por cima dela.</p>}
          </div>
        </div>
        <section className="mt-6 rounded-md border-2 border-ink p-4">
          <h3 className="font-semibold">Teste rápido</h3>
          <BotaoClaro onClick={sortear}>{quiz ? "Outra" : "Começar"}</BotaoClaro>
          {quiz && (
            <div className="mt-3">
              <p className="text-lg">{quiz.inverso ? <>Qual letra se lê <strong className="font-mono">{quiz.certa[1]}</strong>?</> : <>Como se lê <span className="text-4xl">{quiz.certa[0]}</span>?</>}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quiz.opcoes.map((o) => (
                  <button key={o[0]} type="button" disabled={resp !== null} onClick={() => { setResp(o[0]); ouvir(quiz.certa); }} className={`cursor-pointer rounded border-2 px-3 py-1 ${resp === null ? "border-ink/30 hover:border-ink" : o === quiz.certa ? "border-[#1d6b3a] bg-[#1d6b3a]/10" : o[0] === resp ? "border-oxblood" : "opacity-50"}`}>
                    {quiz.inverso ? <span className="text-2xl">{o[0]}</span> : <span className="font-mono">{o[1]}</span>}
                  </button>
                ))}
              </div>
              {resp && <p className="mt-2 text-sm">{resp === quiz.certa[0] ? "✓ Isso!" : <>Era <strong>{quiz.certa[0]}</strong> = <span className="font-mono">{quiz.certa[1]}</span>.</>}</p>}
            </div>
          )}
        </section>
        <p className="mt-3 text-xs text-ink-soft">{AVISO_DE_VOZ} Se o seu aparelho não tiver voz neste idioma, o botão de ouvir não faz som.</p>
      </Bancada>
      <ComoUsar
        passos={["Escolha o alfabeto e estude um grupo por vez, na ordem da página.", "Toque numa letra para ouvir e escreva por cima dela no quadro.", "Faça o teste rápido nos dois sentidos: letra → som e som → letra."]}
        atividades={["Cirílico: escreva o seu nome com letras russas (por exemplo, Ана, Мария, Педро). Quais letras do seu nome existem iguais?", "Hiragana: aprenda as vogais e a linha do K e escreva palavras como かお (kao, rosto) e あき (aki, outono).", "Hangul: junte ㅎ + ㅏ + ㄴ e ㄱ + ㅡ + ㄹ: que palavra sai (한글)? Descubra o que ela quer dizer."]}
      />
    </div>
  );
}
