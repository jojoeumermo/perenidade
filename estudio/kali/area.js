// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A área de trabalho no estilo do Kali Linux: painel de cima, menu de aplicativos, barra de tarefas e janelas
// arrastáveis. Cada janela é uma ferramenta de treino (ferramentas.js); o Terminal é o Linux real do v86 (terminal.js).
// Nada aqui é um sistema de verdade nem alcança a rede: é um laboratório fechado, só para aprender.
import { FERRAMENTAS, h } from "./ferramentas.js";
import { montarTerminal } from "./terminal.js";

const area = document.getElementById("area");
const barraTarefas = document.getElementById("tarefas");
const relogio = document.getElementById("relogio");
const botaoMenu = document.getElementById("menu-botao");
const menu = document.getElementById("menu");

const janelas = new Map(); // id -> { win, tarefa, terminal? }
let zTopo = 20;
let terminalVivo = null;

function relogioTick() {
  const d = new Date();
  relogio.textContent = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
setInterval(relogioTick, 10_000);
relogioTick();

function focar(id) {
  const reg = janelas.get(id);
  if (!reg) return;
  reg.win.style.zIndex = String(++zTopo);
  for (const [outro, r] of janelas) r.tarefa.classList.toggle("ativa", outro === id);
}

function arrastavel(win, puxador) {
  let sx = 0, sy = 0, ox = 0, oy = 0, arrastando = false;
  const mover = (e) => {
    if (!arrastando) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - sx + ox;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - sy + oy;
    win.style.left = `${Math.max(0, Math.min(x, area.clientWidth - 80))}px`;
    win.style.top = `${Math.max(0, Math.min(y, area.clientHeight - 40))}px`;
  };
  const soltar = () => {
    arrastando = false;
    document.removeEventListener("mousemove", mover);
    document.removeEventListener("touchmove", mover);
  };
  const pegar = (e) => {
    arrastando = true;
    const p = e.touches ? e.touches[0] : e;
    sx = p.clientX;
    sy = p.clientY;
    ox = win.offsetLeft;
    oy = win.offsetTop;
    document.addEventListener("mousemove", mover);
    document.addEventListener("touchmove", mover, { passive: true });
    document.addEventListener("mouseup", soltar, { once: true });
    document.addEventListener("touchend", soltar, { once: true });
  };
  puxador.addEventListener("mousedown", pegar);
  puxador.addEventListener("touchstart", pegar, { passive: true });
}

function minimizar(id) {
  const reg = janelas.get(id);
  if (!reg) return;
  const escondida = reg.win.classList.toggle("minimizada");
  if (!escondida) focar(id);
}

function fechar(id) {
  const reg = janelas.get(id);
  if (!reg) return;
  if (reg.terminal) {
    reg.terminal.destruir();
    terminalVivo = null;
  }
  reg.win.remove();
  reg.tarefa.remove();
  janelas.delete(id);
}

function abrir(f) {
  if (janelas.has(f.id)) {
    const reg = janelas.get(f.id);
    reg.win.classList.remove("minimizada");
    focar(f.id);
    reg.terminal?.ajustar();
    return;
  }
  const corpo = h("div.jan-corpo");
  const win = h("div.janela",
    h("div.jan-topo",
      h("span.jan-icone", f.icone),
      h("span.jan-titulo", f.nome),
      h("div.jan-botoes",
        h("button.jan-min", { title: "Minimizar", onclick: () => minimizar(f.id) }, "–"),
        h("button.jan-fechar", { title: "Fechar", onclick: () => fechar(f.id) }, "✕"),
      ),
    ),
    corpo,
  );
  win.style.width = `${f.largura}px`;
  win.style.height = `${f.altura}px`;
  const n = janelas.size;
  win.style.left = `${40 + n * 28}px`;
  win.style.top = `${30 + n * 24}px`;
  win.addEventListener("mousedown", () => focar(f.id));
  area.append(win);

  const tarefa = h("button.tarefa", h("span", f.icone), h("span.tarefa-nome", f.nome));
  tarefa.addEventListener("click", () => minimizar(f.id));
  barraTarefas.append(tarefa);

  const reg = { win, tarefa };
  janelas.set(f.id, reg);
  arrastavel(win, win.querySelector(".jan-topo"));

  if (f.terminal) {
    const tela = h("div.terminal-tela");
    corpo.append(tela);
    corpo.classList.add("sem-pad");
    reg.terminal = terminalVivo = montarTerminal(tela, { aoPronto: () => {} });
    setTimeout(() => reg.terminal.ajustar(), 80);
  } else {
    f.render(corpo);
  }
  focar(f.id);
}

// Menu de aplicativos, agrupado por categoria.
function montarMenu() {
  const cats = [...new Set(FERRAMENTAS.map((f) => f.cat))];
  for (const c of cats) {
    menu.append(h("div.menu-cat", c));
    for (const f of FERRAMENTAS.filter((x) => x.cat === c)) {
      const item = h("button.menu-item", h("span.menu-icone", f.icone), h("span", f.nome));
      item.addEventListener("click", () => {
        abrir(f);
        fecharMenu();
      });
      menu.append(item);
    }
  }
}
function abrirMenu() {
  menu.classList.add("aberto");
  botaoMenu.classList.add("ativo");
}
function fecharMenu() {
  menu.classList.remove("aberto");
  botaoMenu.classList.remove("ativo");
}
botaoMenu.addEventListener("click", (e) => {
  e.stopPropagation();
  menu.classList.contains("aberto") ? fecharMenu() : abrirMenu();
});
document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && e.target !== botaoMenu) fecharMenu();
});

// Atalhos na área de trabalho (os mais usados).
function montarAtalhos() {
  const docas = document.getElementById("atalhos");
  for (const id of ["terminal", "alvos", "nmap", "wireshark", "burp", "metasploit", "ctf"]) {
    const f = FERRAMENTAS.find((x) => x.id === id);
    const a = h("button.atalho", h("span.atalho-icone", f.icone), h("span", f.nome));
    a.addEventListener("dblclick", () => abrir(f));
    a.addEventListener("click", () => abrir(f)); // toque único também abre
    docas.append(a);
  }
}

montarMenu();
montarAtalhos();
// Abre o terminal e os alvos ao entrar, para o laboratório já começar vivo.
abrir(FERRAMENTAS.find((f) => f.id === "terminal"));
setTimeout(() => abrir(FERRAMENTAS.find((f) => f.id === "alvos")), 300);
