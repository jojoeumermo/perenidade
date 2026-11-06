// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O fundo vivo do Vale o Escrito: uma rede de nós e ligações que se move devagar num <canvas>, com pulsos vermelhos que
// correm de um nó a outro (a "ligação acendendo"). Desenho próprio, sem biblioteca. Chega ao navegador só por import()
// dinâmico (FundoVivo.tsx), depois que a página já está de pé: nada disso pesa no carregamento inicial.
//  - pausa sozinho quando o canvas sai da tela (IntersectionObserver) ou a aba fica escondida (visibilitychange);
//  - com "reduzir movimento" desenha um quadro parado e só redesenha quando a janela muda de tamanho;
//  - pixel ratio limitado a 1,5 e no máximo 110 nós (menos no celular): leve até em aparelho de entrada.

interface No {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  cor: 0 | 1 | 2; // 0 = osso, 1 = sangue, 2 = âmbar
  brilho: number; // 0..1, acende quando um pulso chega
}

interface Pulso {
  de: number;
  para: number;
  t: number; // 0..1
  vel: number;
}

const CORES = ["241,241,237", "225,16,47", "255,176,32"] as const;

export interface OpcoesDaRede {
  /** Menos movimento: um quadro parado. */
  calmo: boolean;
}

/** Liga a rede no canvas. Devolve a função que para tudo e solta os ouvintes. */
export function iniciarRede(canvas: HTMLCanvasElement, { calmo }: OpcoesDaRede): () => void {
  const g = canvas.getContext("2d", { alpha: true });
  if (!g) return () => {};
  const ctx2d: CanvasRenderingContext2D = g;
  let largura = 0;
  let altura = 0;
  let dpr = 1;
  let nos: No[] = [];
  let pulsos: Pulso[] = [];
  let distancia = 150;
  let quadro = 0;
  let ultimo = 0;
  let proximoPulso = 0;
  let visivel = true;
  let ponteiro: { x: number; y: number } | null = null;
  let parado = false;

  const sortear = (a: number, b: number) => a + Math.random() * (b - a);

  function semear() {
    const area = largura * altura;
    const n = Math.round(Math.min(110, Math.max(26, area / 15000)));
    distancia = largura < 700 ? 115 : 155;
    nos = Array.from({ length: n }, () => {
      const sorte = Math.random();
      return {
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: sortear(-0.12, 0.12),
        vy: sortear(-0.12, 0.12),
        r: sortear(0.7, 2.1),
        cor: sorte < 0.14 ? 1 : sorte < 0.18 ? 2 : 0,
        brilho: 0,
      } satisfies No;
    });
    pulsos = [];
  }

  function medir() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const l = Math.max(1, Math.round(r.width));
    const a = Math.max(1, Math.round(r.height));
    const mudou = Math.abs(l - largura) > 40 || Math.abs(a - altura) > 40 || nos.length === 0;
    largura = l;
    altura = a;
    canvas.width = Math.round(l * dpr);
    canvas.height = Math.round(a * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mudou) semear();
  }

  /** Um vizinho ao alcance (para o pulso andar por uma ligação que existe na tela). */
  function vizinho(i: number): number {
    const a = nos[i];
    const perto: number[] = [];
    for (let j = 0; j < nos.length; j++) {
      if (j === i) continue;
      const dx = nos[j].x - a.x;
      const dy = nos[j].y - a.y;
      if (dx * dx + dy * dy < distancia * distancia) perto.push(j);
    }
    return perto.length ? perto[Math.floor(Math.random() * perto.length)] : -1;
  }

  function desenhar() {
    ctx2d.clearRect(0, 0, largura, altura);
    const d2 = distancia * distancia;
    ctx2d.lineWidth = 0.6;
    for (let i = 0; i < nos.length; i++) {
      const a = nos[i];
      for (let j = i + 1; j < nos.length; j++) {
        const b = nos[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const q = dx * dx + dy * dy;
        if (q > d2) continue;
        const forca = 1 - Math.sqrt(q) / distancia;
        const sangue = a.cor === 1 || b.cor === 1;
        const acesa = Math.max(a.brilho, b.brilho);
        ctx2d.strokeStyle = `rgba(${sangue ? CORES[1] : CORES[0]},${(forca * (sangue ? 0.3 : 0.14) + acesa * 0.25).toFixed(3)})`;
        ctx2d.beginPath();
        ctx2d.moveTo(a.x, a.y);
        ctx2d.lineTo(b.x, b.y);
        ctx2d.stroke();
      }
    }
    // O ponteiro também puxa linhas finas para os nós de perto (só em mouse: no toque não há "perto").
    if (ponteiro) {
      for (const a of nos) {
        const dx = a.x - ponteiro.x;
        const dy = a.y - ponteiro.y;
        const q = dx * dx + dy * dy;
        if (q > d2) continue;
        ctx2d.strokeStyle = `rgba(${CORES[1]},${((1 - Math.sqrt(q) / distancia) * 0.35).toFixed(3)})`;
        ctx2d.beginPath();
        ctx2d.moveTo(a.x, a.y);
        ctx2d.lineTo(ponteiro.x, ponteiro.y);
        ctx2d.stroke();
      }
    }
    for (const a of nos) {
      const alfa = a.cor === 0 ? 0.55 : 0.9;
      ctx2d.fillStyle = `rgba(${CORES[a.cor]},${Math.min(1, alfa + a.brilho * 0.5).toFixed(3)})`;
      ctx2d.beginPath();
      ctx2d.arc(a.x, a.y, a.r + a.brilho * 2.2, 0, Math.PI * 2);
      ctx2d.fill();
      if (a.brilho > 0.05) {
        ctx2d.strokeStyle = `rgba(${CORES[1]},${(a.brilho * 0.6).toFixed(3)})`;
        ctx2d.beginPath();
        ctx2d.arc(a.x, a.y, a.r + 4 + (1 - a.brilho) * 10, 0, Math.PI * 2);
        ctx2d.stroke();
      }
    }
    for (const p of pulsos) {
      const a = nos[p.de];
      const b = nos[p.para];
      if (!a || !b) continue;
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      const rastro = ctx2d.createLinearGradient(a.x, a.y, x, y);
      rastro.addColorStop(0, `rgba(${CORES[1]},0)`);
      rastro.addColorStop(1, `rgba(${CORES[1]},0.7)`);
      ctx2d.strokeStyle = rastro;
      ctx2d.lineWidth = 1.1;
      ctx2d.beginPath();
      ctx2d.moveTo(a.x, a.y);
      ctx2d.lineTo(x, y);
      ctx2d.stroke();
      ctx2d.lineWidth = 0.6;
      ctx2d.fillStyle = "rgba(255,90,110,0.95)";
      ctx2d.beginPath();
      ctx2d.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx2d.fill();
    }
  }

  function passo(agora: number) {
    quadro = 0;
    if (parado || !visivel) return;
    const dt = Math.min(48, ultimo ? agora - ultimo : 16) / 16;
    ultimo = agora;
    for (const a of nos) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < -20) a.x = largura + 20;
      else if (a.x > largura + 20) a.x = -20;
      if (a.y < -20) a.y = altura + 20;
      else if (a.y > altura + 20) a.y = -20;
      a.brilho = Math.max(0, a.brilho - 0.012 * dt);
    }
    if (agora > proximoPulso && pulsos.length < 6 && nos.length > 1) {
      proximoPulso = agora + sortear(700, 1600);
      const de = Math.floor(Math.random() * nos.length);
      const para = vizinho(de);
      if (para >= 0) pulsos.push({ de, para, t: 0, vel: sortear(0.008, 0.016) });
    }
    pulsos = pulsos.filter((p) => {
      p.t += p.vel * dt;
      if (p.t < 1) return true;
      const alvo = nos[p.para];
      if (alvo) alvo.brilho = 1;
      return false;
    });
    desenhar();
    agendar();
  }

  function agendar() {
    if (!quadro && !parado && visivel && !calmo) quadro = requestAnimationFrame(passo);
  }

  const aoMudarTamanho = () => {
    medir();
    if (calmo || !visivel) desenhar();
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(aoMudarTamanho) : null;
  ro?.observe(canvas);

  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entradas) => {
          visivel = entradas.some((e) => e.isIntersecting) && document.visibilityState === "visible";
          ultimo = 0;
          agendar();
        })
      : null;
  io?.observe(canvas);

  const aoMudarAba = () => {
    visivel = document.visibilityState === "visible";
    ultimo = 0;
    agendar();
  };
  document.addEventListener("visibilitychange", aoMudarAba);

  const fino = typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
  const aoMover = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ponteiro = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const aoSair = () => {
    ponteiro = null;
  };
  if (fino && !calmo) {
    window.addEventListener("pointermove", aoMover, { passive: true });
    document.documentElement.addEventListener("pointerleave", aoSair);
  }

  medir();
  desenhar();
  agendar();

  return () => {
    parado = true;
    if (quadro) cancelAnimationFrame(quadro);
    ro?.disconnect();
    io?.disconnect();
    document.removeEventListener("visibilitychange", aoMudarAba);
    window.removeEventListener("pointermove", aoMover);
    document.documentElement.removeEventListener("pointerleave", aoSair);
  };
}
