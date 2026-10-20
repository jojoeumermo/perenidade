// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O terminal: um Linux DE VERDADE (Buildroot/busybox) rodando no navegador pelo emulador v86 — isolado, sem rede
// nenhuma para o mundo real. O console serial do Linux é ligado a um terminal xterm.js. Quando o sistema sobe, o
// laboratório faz login como root, prepara o wargame (cria os usuários e planta os desafios — veja jogo.js) e deixa
// o aluno dentro do nivel0. A partir daí tudo é real: o que o aluno digita é o que o sistema responde.
import { Terminal } from "./xterm.mjs";
import { FitAddon } from "./addon-fit.mjs";
import { V86 } from "./libv86.mjs";

const BASE = new URL(".", import.meta.url).href;

/** O serial do v86 manda um byte por caractere: para passar acentos e os traços ┌─└ do prompt, convertemos para bytes UTF-8. */
const emBytesUtf8 = (texto) => Array.from(new TextEncoder().encode(texto), (b) => String.fromCharCode(b)).join("");

/**
 * Arranca o Linux no v86 e liga ao terminal xterm. `roteiro` é o script de preparação do wargame (jogo.js), injetado
 * como root assim que o sistema sobe. aoPronto() é chamado quando o laboratório está pronto (o aluno virou nivel0).
 */
export function montarTerminal(elemento, { roteiro, aoPronto } = {}) {
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
  term.write("\x1b[90mA arrancar o Linux do laboratório (emulador v86)… e a preparar o desafio. Isto leva alguns segundos.\x1b[0m\r\n");

  const emulator = new V86({
    wasm_path: `${BASE}v86.wasm`,
    memory_size: 128 * 1024 * 1024,
    vga_memory_size: 4 * 1024 * 1024,
    bios: { url: `${BASE}seabios.bin` },
    vga_bios: { url: `${BASE}vgabios.bin` },
    cdrom: { url: `${BASE}linux.iso` },
    autostart: true,
    disable_keyboard: true,
    disable_speaker: true,
  });

  let entrou = false;
  let preparou = false;
  let avisou = false;
  let buffer = "";
  emulator.add_listener("serial0-output-byte", (byte) => {
    // Escreve o byte cru: o xterm junta os bytes e decodifica UTF-8 (assim os acentos e os traços ┌─└ aparecem).
    term.write(new Uint8Array([byte]));
    const ch = byte < 128 ? String.fromCharCode(byte) : ""; // só ASCII para detectar o login e o fim da preparação
    buffer = (buffer + ch).slice(-400);
    if (!entrou && /login:\s*$/.test(buffer)) {
      entrou = true;
      setTimeout(() => emulator.serial0_send("root\n"), 400);
    } else if (entrou && !preparou && /(#|\$|%)\s*$/.test(buffer)) {
      preparou = true;
      setTimeout(() => emulator.serial0_send(emBytesUtf8(roteiro ?? "echo pronto\n")), 600);
    }
    if (!avisou && buffer.includes("Comece agora")) {
      avisou = true;
      setTimeout(() => aoPronto?.(), 400);
    }
  });
  // O que o aluno digita no xterm vai para o serial do Linux (em bytes UTF-8, para acentos funcionarem).
  term.onData((d) => emulator.serial0_send(emBytesUtf8(d)));

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
