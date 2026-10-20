// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As janelas do laboratório: o Terminal (o Linux real, em terminal.js), as Missões (o objetivo e as dicas de cada
// nível do wargame) e o Guia (os comandos de verdade que o aluno usa). Nada aqui é enlatado: a janela de Missões só
// guia e confere a senha que o aluno ENCONTROU no terminal real; o trabalho é feito no terminal.
import { NIVEIS } from "./jogo.js";

/** Criador de elementos: h("div.classe", { attr }, ...filhos). */
export function h(seletor, ...resto) {
  const [tag, ...classes] = seletor.split(".");
  const el = document.createElement(tag || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const parte of resto) {
    if (parte == null) continue;
    if (typeof parte === "string" || typeof parte === "number") el.append(String(parte));
    else if (parte instanceof Node) el.append(parte);
    else if (Array.isArray(parte)) parte.forEach((f) => f && el.append(f));
    else for (const [k, v] of Object.entries(parte)) {
      if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v != null) el.setAttribute(k, v);
    }
  }
  return el;
}

// As senhas sorteadas desta sessão (em memória), para a janela de Missões conferir o que o aluno encontrou.
let SENHAS = null;
const resolvidos = new Set();
export function configurar(senhas) {
  SENHAS = senhas;
}
/** A resposta esperada de um nível: a senha do próximo nível; no último, a bandeira. */
function respostaDo(n) {
  if (!SENHAS) return null;
  return n.n < 8 ? SENHAS.nivel[n.n + 1] : SENHAS.flag;
}

// ───────────────────────── Missões ─────────────────────────
function missoes(corpo) {
  corpo.append(
    h("p.aviso-treino", "Wargame de verdade: você está num Linux isolado e vai do nivel0 até o root, explorando uma falha real a cada nível. Faça o trabalho no Terminal; aqui estão o objetivo, as dicas e a conferência da senha que você achar."),
  );
  const lista = h("div.missoes");
  const desbloqueado = (n) => n.n === 0 || resolvidos.has(n.n - 1);

  function desenhar() {
    lista.innerHTML = "";
    for (const n of NIVEIS) {
      const feito = resolvidos.has(n.n);
      const aberto = desbloqueado(n);
      const cartao = h(`div.missao${feito ? ".feita" : aberto ? ".ativa" : ".travada"}`);
      cartao.append(
        h("div.missao-topo",
          h("span.missao-num", feito ? "✓" : n.n),
          h("span.missao-titulo", aberto || feito ? n.titulo : "— bloqueado —"),
          h("span.missao-tec", aberto || feito ? n.tecnica : ""),
        ),
      );
      if (aberto && !feito) {
        cartao.append(h("p.missao-obj", n.objetivo));
        const dicas = h("div.missao-dicas");
        let vistas = 0;
        const botaoDica = h("button.k-link", "Mostrar uma dica");
        botaoDica.addEventListener("click", () => {
          if (vistas < n.dicas.length) {
            dicas.append(h("p.dica", `💡 ${n.dicas[vistas]}`));
            vistas++;
          }
          if (vistas >= n.dicas.length) botaoDica.remove();
        });
        const campo = h("input.k-campo.largo", { placeholder: n.n < 8 ? "senha que você encontrou…" : "a bandeira LUCIA{…}" });
        const resp = h("span.missao-resp");
        const conferir = h("button.k-botao", "Conferir");
        const tentar = () => {
          const esperado = respostaDo(n);
          if (esperado && campo.value.trim() === esperado) {
            resolvidos.add(n.n);
            desenhar();
          } else {
            resp.textContent = "Ainda não. Siga as dicas e procure no terminal.";
            resp.className = "missao-resp erro";
          }
        };
        conferir.addEventListener("click", tentar);
        campo.addEventListener("keydown", (e) => e.key === "Enter" && tentar());
        cartao.append(h("div.missao-barra", botaoDica), dicas, h("div.missao-barra", campo, conferir), resp);
      } else if (feito) {
        cartao.append(h("p.missao-obj.ok", n.n < 8 ? "Resolvido. Entre no próximo com  su nivel" + (n.n + 1) + "  e a senha que você achou." : "Você virou root e pegou a bandeira. Parabéns!"));
      }
      lista.append(cartao);
    }
    if (resolvidos.size === NIVEIS.length) {
      lista.append(h("div.vitoria", h("strong", "🏁 Laboratório concluído!"), h("p", "Você escalou do nivel0 até o root explorando uma falha real a cada passo. Isso é o básico de um teste de intrusão — e sempre, sempre, com autorização por escrito.")));
    }
  }
  desenhar();
  corpo.append(lista);
}

// ───────────────────────── Guia de comandos ─────────────────────────
const GUIA = [
  ["Onde estou / navegar", [
    ["pwd", "mostra o diretório atual"],
    ["ls", "lista arquivos (ls -l detalhado, ls -a inclui ocultos)"],
    ["cd ~", "vai para a sua pasta pessoal; cd pasta entra, cd .. volta"],
  ]],
  ["Ler arquivos", [
    ["cat arquivo", "mostra o conteúdo (cat ./- para um arquivo chamado -)"],
    ["cat \"nome com espacos\"", "use aspas quando o nome tem espaços"],
    ["head / tail arquivo", "começo / fim de um arquivo grande"],
  ]],
  ["Procurar", [
    ["grep texto arquivo", "mostra as linhas que contêm o texto"],
    ["grep -r texto pasta", "procura dentro de uma pasta inteira"],
    ["find / -user nome 2>/dev/null", "acha arquivos de um dono no sistema todo"],
    ["sort arquivo | uniq -u", "mostra só as linhas que aparecem uma vez"],
    ["strings arquivo", "textos legíveis dentro de um arquivo binário"],
  ]],
  ["Usuários e permissões", [
    ["whoami / id", "quem você é agora"],
    ["su nivelN", "troca para outro usuário (pede a senha dele)"],
    ["ls -l", "a 1ª coluna mostra quem pode ler (r), escrever (w), executar (x)"],
  ]],
  ["Atalhos", [
    ["Tab", "completa nomes de arquivo automaticamente"],
    ["seta ↑ / ↓", "repete comandos anteriores"],
    ["Ctrl+C", "interrompe um comando travado"],
  ]],
];
function guia(corpo) {
  corpo.append(h("p.aviso-treino", "Os comandos de verdade que você usa no Terminal. Não decore: consulte aqui sempre que precisar."));
  for (const [titulo, itens] of GUIA) {
    corpo.append(h("h3.guia-cat", titulo));
    const tab = h("div.guia-tab");
    for (const [cmd, desc] of itens) tab.append(h("code.guia-cmd", cmd), h("span.guia-desc", desc));
    corpo.append(tab);
  }
}

/** Ícones de linha (no espírito dos ícones do Kali). */
const D = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONES = {
  terminal: D(`<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M6 9l3 3-3 3"/><path d="M12.5 15h5"/>`),
  missoes: D(`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`),
  guia: D(`<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h7"/>`),
};

/** As janelas do laboratório, na ordem do menu. */
export const FERRAMENTAS = [
  { id: "terminal", nome: "Terminal", cat: "Laboratório", largura: 760, altura: 460, terminal: true },
  { id: "missoes", nome: "Missões", cat: "Laboratório", largura: 560, altura: 520, render: missoes },
  { id: "guia", nome: "Guia de comandos", cat: "Laboratório", largura: 560, altura: 480, render: guia },
].map((f) => ({ ...f, svg: ICONES[f.id] }));
