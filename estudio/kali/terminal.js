// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O terminal: um Linux DE VERDADE (Buildroot/busybox) rodando no navegador pelo emulador v86 — isolado, sem rede
// nenhuma para o mundo real. O console serial do Linux é ligado a um terminal xterm.js. Depois que o sistema sobe,
// o laboratório faz login e injeta alguns comandos de treino (alvos, nmap, enviar-flag) escrevendo scripts no próprio
// Linux. Esses comandos só imprimem o cenário fictício de rede.js; nada aqui varre ou ataca sistema real.
import { Terminal } from "./xterm.mjs";
import { FitAddon } from "./addon-fit.mjs";
import { V86 } from "./libv86.mjs";
import { ALVOS, EU, FLAG, principal, REDE, WEB } from "./rede.js";

const BASE = new URL(".", import.meta.url).href;

/** Texto do "nmap" como o aluno veria: lê os alvos fictícios e monta a saída. */
function textoNmap() {
  const linhas = [`A iniciar o Nmap (treino) contra ${REDE}`, "Nota: tudo fictício — nenhum host real é tocado.", ""];
  for (const a of ALVOS) {
    linhas.push(`Relatório para ${a.nome} (${a.ip}) — ${a.sistema}`);
    linhas.push("PORTA      ESTADO  SERVIÇO     VERSÃO");
    for (const p of a.portas) linhas.push(`${String(p.n + "/tcp").padEnd(10)} aberta  ${p.servico.padEnd(11)} ${p.versao}`);
    linhas.push("");
  }
  linhas.push(`Varredura concluída: ${ALVOS.length} hosts no ar. O alvo do desafio é ${principal().nome} (${principal().ip}).`);
  return linhas.join("\n");
}

function textoAlvos() {
  return [
    "Rede do laboratório (fictícia):",
    ...ALVOS.map((a) => `  ${a.ip.padEnd(13)} ${a.nome.padEnd(20)} ${a.nota}`),
    "",
    `Você está em ${EU}. Comece pelo alvo principal com:  nmap`,
  ].join("\n");
}

/** Cada comando de treino: nome, o texto que imprime e uma ajuda curta. */
function comandosDeTreino() {
  return [
    { nome: "ajuda", ajuda: "lista os comandos de treino", texto: [
      "Comandos de treino do laboratório (além de todo o Linux real: ls, cat, ps, vi…):",
      "  alvos        — mostra os computadores da rede do laboratório",
      "  nmap         — varredura de portas (fictícia) de toda a rede",
      "  ssh-audit    — testa senhas fracas de SSH no alvo (fictício)",
      "  enviar-flag  — entrega a bandeira do desafio quando você a encontrar",
      "",
      "As janelas da área de trabalho (Nmap, Wireshark, Burp, SQL, Metasploit) mostram o mesmo cenário com mais detalhe.",
      "Tudo é treino. Hacking de verdade, só com autorização por escrito e dentro da lei.",
    ].join("\n") },
    { nome: "alvos", ajuda: "lista os alvos", texto: textoAlvos() },
    { nome: "nmap", ajuda: "varredura fictícia", texto: textoNmap() },
    { nome: "ssh-audit", ajuda: "senhas fracas (fictício)", texto: [
      `Auditoria de senha SSH (treino) em ${WEB.host}:22`,
      "Testando senhas fracas comuns contra o usuário 'biblioteca'…",
      "  admin        não",
      "  123456       não",
      "  senha        não",
      `  ${WEB.ssh.senha}      SIM — senha fraca encontrada (fictícia!)`,
      "",
      "Lição: senha de servidor curta e sazonal cai numa lista de poucas tentativas.",
      "Defesa: senha longa e única, chave SSH em vez de senha, limite de tentativas (fail2ban).",
    ].join("\n") },
  ];
}

/** Escreve os comandos de treino dentro do Linux real, por heredoc no shell, e dá um 'clear' no fim. */
function injetarComandos(emulator) {
  const pasta = "/opt/lucia";
  let sh = `mkdir -p ${pasta}\n`;
  for (const c of comandosDeTreino()) {
    sh += `cat > ${pasta}/${c.nome}.txt <<'LUCIATXT'\n${c.texto}\nLUCIATXT\n`;
    sh += `cat > /usr/bin/${c.nome} <<'LUCIASH'\n#!/bin/sh\ncat ${pasta}/${c.nome}.txt\nLUCIASH\n`;
    sh += `chmod +x /usr/bin/${c.nome}\n`;
  }
  // enviar-flag confere a bandeira e avisa a área de trabalho pelo próprio texto do shell.
  sh += `cat > /usr/bin/enviar-flag <<'LUCIASH'\n#!/bin/sh\nif [ "$1" = "${FLAG}" ]; then echo "CORRETO! Você concluiu o desafio. Parabéns."; echo "LUCIA-FLAG-OK"; else echo "Ainda não. A bandeira tem o formato LUCIA{...}. Use as ferramentas para encontrá-la."; fi\nLUCIASH\nchmod +x /usr/bin/enviar-flag\n`;
  sh += "clear\n";
  sh += "echo 'Laboratório pronto. Digite  ajuda  para ver os comandos de treino.'\n";
  emulator.serial0_send(sh);
}

/**
 * Arranca o Linux no v86 e liga ao terminal xterm. Chama aoPronto() quando o sistema está utilizável.
 * Devolve o emulador e o terminal, para a área de trabalho controlar (reiniciar, redimensionar).
 */
export function montarTerminal(elemento, { aoPronto } = {}) {
  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "'DejaVu Sans Mono', 'Courier New', monospace",
    theme: { background: "#0b0e14", foreground: "#c5c8c6", cursor: "#1793d1", black: "#1d1f21", brightBlack: "#5c6370", blue: "#1793d1", brightBlue: "#4fc1ff", green: "#8ae234", red: "#ff6565", yellow: "#ffce51", cyan: "#34e2e2", white: "#d7d7d7" },
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(elemento);
  try {
    fit.fit();
  } catch {
    // o elemento ainda não tem tamanho; o ResizeObserver abaixo ajusta
  }
  term.write("\x1b[90mA arrancar o Linux do laboratório (emulador v86)… isto leva alguns segundos.\x1b[0m\r\n");

  const emulator = new V86({
    wasm_path: `${BASE}v86.wasm`,
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 4 * 1024 * 1024,
    bios: { url: `${BASE}seabios.bin` },
    vga_bios: { url: `${BASE}vgabios.bin` },
    cdrom: { url: `${BASE}linux.iso` },
    autostart: true,
    disable_keyboard: true,
    // Um laboratório de terminal não precisa de som; sem o alto-falante, o v86 não monta o worklet de áudio.
    disable_speaker: true,
  });

  let entrou = false;
  let pronto = false;
  let buffer = "";
  emulator.add_listener("serial0-output-byte", (byte) => {
    const ch = String.fromCharCode(byte);
    term.write(ch);
    buffer = (buffer + ch).slice(-200);
    if (!entrou && /login:\s*$/.test(buffer)) {
      entrou = true;
      setTimeout(() => emulator.serial0_send("root\n"), 400);
    }
    if (entrou && !pronto && /(#|\$|%)\s*$/.test(buffer)) {
      pronto = true;
      setTimeout(() => {
        injetarComandos(emulator);
        aoPronto?.();
      }, 600);
    }
  });
  // O que o aluno digita no xterm vai para o serial do Linux.
  term.onData((d) => emulator.serial0_send(d));

  const observador = new ResizeObserver(() => {
    try {
      fit.fit();
    } catch {
      /* elemento escondido */
    }
  });
  observador.observe(elemento);

  return {
    term,
    emulator,
    ajustar: () => {
      try {
        fit.fit();
      } catch {
        /* escondido */
      }
    },
    destruir: () => {
      observador.disconnect();
      try {
        emulator.destroy?.();
      } catch {
        /* já parado */
      }
      term.dispose();
    },
  };
}
