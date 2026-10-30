// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";

type No = { tipo: "dir"; filhos: Record<string, No>; modo: number } | { tipo: "arq"; conteudo: string; modo: number };
interface Exercicio {
  id: string;
  titulo: string;
  enunciado: string;
  dicas: string[];
  confere: (fs: No, cwd: string, historico: string[]) => boolean;
}

const dir = (filhos: Record<string, No> = {}, modo = 0o755): No => ({ tipo: "dir", filhos, modo });
const arq = (conteudo: string, modo = 0o644): No => ({ tipo: "arq", conteudo, modo });
function fsInicial(): No {
  return dir({
    home: dir({
      aluno: dir({
        "leia-me.txt": arq("Bem-vindo ao terminal do Instituto Lúcia.\nEste é um sistema de arquivos virtual: nada aqui toca o seu computador.\n"),
        documentos: dir({ "lista.txt": arq("pão\nleite\narroz\nfeijão\ncafé\n"), "notas.csv": arq("nome,nota\nAna,8.5\nBruno,6.0\nCarla,9.5\n") }),
        downloads: dir({ "foto1.jpg": arq("…"), "foto2.jpg": arq("…"), "relatorio.pdf": arq("…"), "musica.mp3": arq("…") }),
        "script.sh": arq("#!/bin/sh\necho Olá, $1\n", 0o644),
        "segredo.txt": arq("senha=1234\n", 0o644),
      }),
    }),
    etc: dir({ hostname: arq("lucia\n"), passwd: arq("root:x:0:0:root:/root:/bin/sh\naluno:x:1000:1000:Aluno:/home/aluno:/bin/sh\n") }),
    tmp: dir({}, 0o777),
    var: dir({ log: dir({ "acesso.log": arq("10.0.0.5 - GET /index.html 200\n10.0.0.9 - GET /admin 403\n10.0.0.5 - GET /aula 200\n10.0.0.9 - GET /admin 403\n10.0.0.9 - POST /login 401\n") }) }),
  });
}

const COMANDOS = ["ls", "cd", "pwd", "cat", "echo", "mkdir", "rm", "cp", "mv", "touch", "chmod", "grep", "head", "tail", "wc", "find", "man", "clear", "whoami", "hostname", "date", "help", "sort", "uniq", "rmdir", "history"];
const MAN: Record<string, string> = {
  ls: "ls [-l] [-a] [caminho]: lista arquivos. -l mostra permissões e tamanho; -a mostra os ocultos.",
  cd: "cd [caminho]: muda de pasta. cd .. sobe; cd sozinho vai para a sua casa (~).",
  pwd: "pwd: mostra a pasta atual.",
  cat: "cat arquivo…: mostra o conteúdo.",
  echo: "echo texto: escreve o texto. Com > arquivo grava; com >> acrescenta.",
  mkdir: "mkdir [-p] pasta: cria pasta (-p cria o caminho inteiro).",
  rm: "rm [-r] alvo: apaga arquivo; -r apaga pasta com tudo dentro. Não tem lixeira.",
  cp: "cp origem destino: copia.",
  mv: "mv origem destino: move ou renomeia.",
  touch: "touch arquivo: cria um arquivo vazio (ou atualiza a data).",
  chmod: "chmod modo arquivo: muda as permissões (ex.: chmod 755 script.sh, chmod +x script.sh).",
  grep: "grep [-i] [-n] padrão arquivo: procura linhas com o padrão.",
  head: "head [-n N] arquivo: as primeiras N linhas (10 por padrão).",
  tail: "tail [-n N] arquivo: as últimas N linhas.",
  wc: "wc [-l] arquivo: conta linhas, palavras e caracteres (-l só linhas).",
  find: "find [pasta] -name padrão: acha arquivos pelo nome (aceita *).",
  sort: "sort: ordena linhas. uniq: tira repetidas consecutivas (uniq -c conta).",
  man: "man comando: esta ajuda.",
};

function partes(caminho: string, cwd: string): string[] {
  const abs = caminho.startsWith("/") ? caminho : caminho.startsWith("~") ? `/home/aluno${caminho.slice(1)}` : `${cwd}/${caminho}`;
  const saida: string[] = [];
  for (const p of abs.split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") saida.pop();
    else saida.push(p);
  }
  return saida;
}
function achar(fs: No, ps: string[]): No | null {
  let n: No = fs;
  for (const p of ps) {
    if (n.tipo !== "dir" || !n.filhos[p]) return null;
    n = n.filhos[p];
  }
  return n;
}
function pai(fs: No, ps: string[]): { d: No; nome: string } | null {
  const d = achar(fs, ps.slice(0, -1));
  return d && d.tipo === "dir" && ps.length ? { d, nome: ps[ps.length - 1] } : null;
}
const modoTexto = (m: number, dirp: boolean) => (dirp ? "d" : "-") + [6, 3, 0].map((s) => ((m >> s) & 4 ? "r" : "-") + ((m >> s) & 2 ? "w" : "-") + ((m >> s) & 1 ? "x" : "-")).join("");
const glob = (padrao: string) => new RegExp("^" + padrao.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");

/** Executa uma linha (com pipes e redirecionamento simples) e devolve a saída. Tudo em memória. */
function executar(linha: string, fs: No, estado: { cwd: string; historico: string[] }): string {
  const comandos = linha.split("|").map((c) => c.trim()).filter(Boolean);
  let entrada = "";
  let saida = "";
  for (let i = 0; i < comandos.length; i++) {
    let cmd = comandos[i];
    let gravar: { arquivo: string; acrescenta: boolean } | null = null;
    const red = />(>?)\s*(\S+)\s*$/.exec(cmd);
    if (red) {
      gravar = { arquivo: red[2], acrescenta: red[1] === ">" };
      cmd = cmd.slice(0, red.index).trim();
    }
    const tokens = cmd.match(/"[^"]*"|'[^']*'|\S+/g)?.map((t) => t.replace(/^["']|["']$/g, "")) ?? [];
    const [nome, ...args] = tokens;
    const flags = args.filter((a) => a.startsWith("-") && a.length > 1);
    const pos = args.filter((a) => !a.startsWith("-") || a === "-");
    const tem = (f: string) => flags.some((x) => x === f || (x.length > 2 && !x.startsWith("--") && x.includes(f[1])));
    const lerArquivo = (c: string): string => {
      const n = achar(fs, partes(c, estado.cwd));
      if (!n) throw new Error(`${nome}: ${c}: arquivo ou pasta não encontrado`);
      if (n.tipo === "dir") throw new Error(`${nome}: ${c}: é uma pasta`);
      return n.conteudo;
    };
    const texto = (): string => (pos.length ? pos.map(lerArquivo).join("") : entrada);
    let out = "";
    try {
      switch (nome) {
        case undefined: break;
        case "help": out = `Comandos disponíveis neste simulador:\n${COMANDOS.join(", ")}\nPipes (|) e redirecionamento (> e >>) funcionam. man comando explica cada um.\n`; break;
        case "man": out = `${MAN[pos[0]] ?? `Sem manual para “${pos[0] ?? ""}”. Comandos: ${COMANDOS.join(", ")}`}\n`; break;
        case "pwd": out = `${estado.cwd || "/"}\n`; break;
        case "whoami": out = "aluno\n"; break;
        case "hostname": out = "lucia\n"; break;
        case "date": out = `${new Date().toString()}\n`; break;
        case "history": out = estado.historico.map((h, k) => `${String(k + 1).padStart(4)}  ${h}`).join("\n") + "\n"; break;
        case "clear": out = "\u0000clear"; break;
        case "echo": out = `${pos.join(" ").replace(/\$HOME/g, "/home/aluno").replace(/\$USER/g, "aluno")}\n`; break;
        case "cd": {
          const alvo = pos[0] ?? "~";
          const ps = partes(alvo, estado.cwd);
          const n = achar(fs, ps);
          if (!n) throw new Error(`cd: ${alvo}: não existe`);
          if (n.tipo !== "dir") throw new Error(`cd: ${alvo}: não é uma pasta`);
          estado.cwd = "/" + ps.join("/");
          if (estado.cwd === "/") estado.cwd = "";
          break;
        }
        case "ls": {
          const alvo = pos[0] ?? ".";
          const n = achar(fs, partes(alvo, estado.cwd));
          if (!n) throw new Error(`ls: ${alvo}: não existe`);
          if (n.tipo === "arq") { out = `${alvo}\n`; break; }
          const nomes = Object.keys(n.filhos).filter((x) => tem("-a") || !x.startsWith(".")).sort();
          out = tem("-l")
            ? nomes.map((x) => { const f = n.filhos[x]; return `${modoTexto(f.modo, f.tipo === "dir")} aluno aluno ${String(f.tipo === "dir" ? 4096 : f.conteudo.length).padStart(6)} ${x}${f.tipo === "dir" ? "/" : ""}`; }).join("\n") + (nomes.length ? "\n" : "")
            : nomes.map((x) => (n.filhos[x].tipo === "dir" ? `${x}/` : x)).join("  ") + (nomes.length ? "\n" : "");
          break;
        }
        case "cat": out = texto(); break;
        case "head": case "tail": {
          const nIdx = args.indexOf("-n");
          const qtd = nIdx >= 0 ? Number(args[nIdx + 1]) || 10 : 10;
          const arquivos = pos.filter((p, k) => !(nIdx >= 0 && args[nIdx + 1] === p && k === pos.indexOf(args[nIdx + 1])));
          const linhas = (arquivos.length ? arquivos.map(lerArquivo).join("") : entrada).split("\n").filter((l, k, a) => k < a.length - 1 || l !== "");
          out = (nome === "head" ? linhas.slice(0, qtd) : linhas.slice(-qtd)).join("\n") + (linhas.length ? "\n" : "");
          break;
        }
        case "wc": {
          const t = texto();
          const l = (t.match(/\n/g) ?? []).length;
          out = tem("-l") ? `${l}\n` : `${l} ${t.split(/\s+/).filter(Boolean).length} ${t.length}\n`;
          break;
        }
        case "grep": {
          const padrao = pos[0];
          if (!padrao) throw new Error("grep: falta o padrão");
          const arquivos = pos.slice(1);
          const re = new RegExp(padrao.replace(/[.+^${}()|[\]\\]/g, "\\$&"), tem("-i") ? "i" : "");
          const fonte = arquivos.length ? arquivos.map((a) => lerArquivo(a).split("\n").filter(Boolean).map((l) => (arquivos.length > 1 ? `${a}:${l}` : l))).flat() : entrada.split("\n").filter(Boolean);
          out = fonte.filter((l) => re.test(l)).map((l, k) => (tem("-n") ? `${k + 1}:${l}` : l)).join("\n");
          out = out ? out + "\n" : "";
          break;
        }
        case "sort": out = texto().split("\n").filter(Boolean).sort((a, b) => (tem("-n") ? Number(a) - Number(b) : a.localeCompare(b))).join("\n") + "\n"; if (tem("-r")) out = out.trim().split("\n").reverse().join("\n") + "\n"; break;
        case "uniq": {
          const linhas = texto().split("\n").filter(Boolean);
          const res: string[] = [];
          let ultima: string | null = null;
          let conta = 0;
          const fecha = () => { if (ultima !== null) res.push(tem("-c") ? `${String(conta).padStart(7)} ${ultima}` : ultima); };
          for (const l of linhas) { if (l === ultima) conta++; else { fecha(); ultima = l; conta = 1; } }
          fecha();
          out = res.join("\n") + (res.length ? "\n" : "");
          break;
        }
        case "mkdir": {
          for (const p of pos) {
            const ps = partes(p, estado.cwd);
            if (tem("-p")) { let n = fs; for (const x of ps) { if (n.tipo !== "dir") throw new Error("mkdir: caminho inválido"); n.filhos[x] ??= dir(); n = n.filhos[x]; } }
            else { const pp = pai(fs, ps); if (!pp || pp.d.tipo !== "dir") throw new Error(`mkdir: ${p}: a pasta de cima não existe`); if (pp.d.filhos[pp.nome]) throw new Error(`mkdir: ${p}: já existe`); pp.d.filhos[pp.nome] = dir(); }
          }
          break;
        }
        case "touch": for (const p of pos) { const pp = pai(fs, partes(p, estado.cwd)); if (!pp || pp.d.tipo !== "dir") throw new Error(`touch: ${p}: pasta não existe`); pp.d.filhos[pp.nome] ??= arq(""); } break;
        case "rm": case "rmdir": {
          for (const p of pos) {
            const ps = partes(p, estado.cwd);
            const pp = pai(fs, ps);
            const n = pp && pp.d.tipo === "dir" ? pp.d.filhos[pp.nome] : null;
            if (!pp || !n || pp.d.tipo !== "dir") throw new Error(`${nome}: ${p}: não existe`);
            if (n.tipo === "dir" && nome === "rm" && !tem("-r")) throw new Error(`rm: ${p}: é uma pasta (use rm -r)`);
            if (n.tipo === "dir" && nome === "rmdir" && Object.keys(n.filhos).length) throw new Error(`rmdir: ${p}: a pasta não está vazia`);
            delete pp.d.filhos[pp.nome];
          }
          break;
        }
        case "cp": case "mv": {
          if (pos.length < 2) throw new Error(`${nome}: uso: ${nome} origem destino`);
          const destinoPs = partes(pos[pos.length - 1], estado.cwd);
          const destinoNo = achar(fs, destinoPs);
          for (const o of pos.slice(0, -1)) {
            const ops = partes(o, estado.cwd);
            const op = pai(fs, ops);
            const n = op && op.d.tipo === "dir" ? op.d.filhos[op.nome] : null;
            if (!op || !n || op.d.tipo !== "dir") throw new Error(`${nome}: ${o}: não existe`);
            if (n.tipo === "dir" && nome === "cp" && !tem("-r")) throw new Error(`cp: ${o}: é uma pasta (use cp -r)`);
            const copia: No = JSON.parse(JSON.stringify(n)) as No;
            if (destinoNo && destinoNo.tipo === "dir") destinoNo.filhos[op.nome] = copia;
            else { const dp = pai(fs, destinoPs); if (!dp || dp.d.tipo !== "dir") throw new Error(`${nome}: destino inválido`); dp.d.filhos[dp.nome] = copia; }
            if (nome === "mv") delete op.d.filhos[op.nome];
          }
          break;
        }
        case "chmod": {
          const [modo, ...alvos] = pos;
          if (!modo || !alvos.length) throw new Error("chmod: uso: chmod 755 arquivo");
          for (const a of alvos) {
            const n = achar(fs, partes(a, estado.cwd));
            if (!n) throw new Error(`chmod: ${a}: não existe`);
            if (/^[0-7]{3}$/.test(modo)) n.modo = parseInt(modo, 8);
            else if (/^[ugoa]*[+-][rwx]+$/.test(modo)) {
              const [, quem, op, perms] = /^([ugoa]*)([+-])([rwx]+)$/.exec(modo)!;
              const alvosBits = (quem || "a").includes("a") ? [6, 3, 0] : [...(quem.includes("u") ? [6] : []), ...(quem.includes("g") ? [3] : []), ...(quem.includes("o") ? [0] : [])];
              for (const s of alvosBits) for (const p of perms) { const bit = (p === "r" ? 4 : p === "w" ? 2 : 1) << s; n.modo = op === "+" ? n.modo | bit : n.modo & ~bit; }
            } else throw new Error(`chmod: modo inválido: ${modo}`);
          }
          break;
        }
        case "find": {
          const raiz = pos[0] && !pos[0].startsWith("-") ? pos[0] : ".";
          const nIdx = args.indexOf("-name");
          const re = nIdx >= 0 ? glob(args[nIdx + 1] ?? "*") : /.*/;
          const base = partes(raiz, estado.cwd);
          const n = achar(fs, base);
          if (!n) throw new Error(`find: ${raiz}: não existe`);
          const achados: string[] = [];
          const andar = (no: No, caminho: string) => { if (re.test(caminho.split("/").pop() ?? "")) achados.push(caminho); if (no.tipo === "dir") for (const [k, v] of Object.entries(no.filhos)) andar(v, `${caminho}/${k}`); };
          andar(n, raiz.replace(/\/$/, ""));
          out = achados.join("\n") + (achados.length ? "\n" : "");
          break;
        }
        default:
          if (nome.startsWith("./") || nome.startsWith("/")) {
            const n = achar(fs, partes(nome, estado.cwd));
            if (!n || n.tipo !== "arq") throw new Error(`${nome}: não encontrado`);
            if (!(n.modo & 0o100)) throw new Error(`${nome}: permissão negada (falta o x: chmod +x ${nome})`);
            out = n.conteudo.split("\n").filter((l) => l.startsWith("echo")).map((l) => l.slice(5).replace(/\$1/g, pos[0] ?? "").replace(/^["']|["']$/g, "")).join("\n") + "\n";
          } else throw new Error(`${nome}: comando não encontrado. Digite help para ver os comandos deste simulador.`);
      }
    } catch (e) {
      out = `${(e as Error).message}\n`;
    }
    if (gravar) {
      const ps = partes(gravar.arquivo, estado.cwd);
      const pp = pai(fs, ps);
      if (pp && pp.d.tipo === "dir") {
        const atual = pp.d.filhos[pp.nome];
        pp.d.filhos[pp.nome] = arq((gravar.acrescenta && atual?.tipo === "arq" ? atual.conteudo : "") + out);
        out = "";
      } else out = `bash: ${gravar.arquivo}: pasta não existe\n`;
    }
    entrada = out;
    saida = out;
  }
  return saida;
}

const EXERCICIOS: Exercicio[] = [
  { id: "lx-01", titulo: "Onde estou?", enunciado: "Descubra em que pasta você está e liste o que há nela.", dicas: ["pwd mostra a pasta; ls lista."], confere: (_fs, _cwd, h) => h.some((c) => /^pwd\b/.test(c)) && h.some((c) => /^ls\b/.test(c)) },
  { id: "lx-02", titulo: "Organize os downloads", enunciado: "Dentro de ~/downloads, crie as pastas fotos e docs, mova as .jpg para fotos e o .pdf para docs.", dicas: ["mkdir fotos docs", "mv *.jpg não existe aqui: mova um por um (mv foto1.jpg fotos/)."], confere: (fs) => { const d = achar(fs, ["home", "aluno", "downloads"]); if (!d || d.tipo !== "dir") return false; const f = d.filhos.fotos, c = d.filhos.docs; return Boolean(f && f.tipo === "dir" && f.filhos["foto1.jpg"] && f.filhos["foto2.jpg"] && c && c.tipo === "dir" && c.filhos["relatorio.pdf"] && !d.filhos["foto1.jpg"]); } },
  { id: "lx-03", titulo: "Ache o arquivo", enunciado: "Ache, a partir da sua casa (~), o arquivo lista.txt com o comando find e mostre o conteúdo dele.", dicas: ["find ~ -name lista.txt", "cat ~/documentos/lista.txt"], confere: (_fs, _cwd, h) => h.some((c) => /^find\b.*lista\.txt/.test(c)) && h.some((c) => /^cat\b.*lista\.txt/.test(c)) },
  { id: "lx-04", titulo: "Conte e filtre", enunciado: "No arquivo /var/log/acesso.log, conte quantas linhas têm 403 usando grep e wc com um pipe.", dicas: ["grep 403 /var/log/acesso.log | wc -l"], confere: (_fs, _cwd, h) => h.some((c) => /grep\b.*403.*\|\s*wc/.test(c)) },
  { id: "lx-05", titulo: "Corrija as permissões", enunciado: "O script ~/script.sh não roda porque não tem permissão de execução. Dê a permissão e rode-o com ./script.sh mundo.", dicas: ["chmod +x script.sh", "./script.sh mundo"], confere: (fs, _cwd, h) => { const n = achar(fs, ["home", "aluno", "script.sh"]); return Boolean(n && n.tipo === "arq" && n.modo & 0o100) && h.some((c) => /^\.\/script\.sh/.test(c)); } },
  { id: "lx-06", titulo: "Proteja o segredo", enunciado: "O arquivo ~/segredo.txt pode ser lido por todo mundo. Deixe-o legível e gravável só pelo dono (600).", dicas: ["chmod 600 segredo.txt", "ls -l mostra -rw-------"], confere: (fs) => { const n = achar(fs, ["home", "aluno", "segredo.txt"]); return Boolean(n && n.modo === 0o600); } },
  { id: "lx-07", titulo: "Grave um relatório", enunciado: "Crie ~/relatorio.txt com a lista de compras ordenada (sort em documentos/lista.txt) usando redirecionamento.", dicas: ["sort documentos/lista.txt > relatorio.txt"], confere: (fs) => { const n = achar(fs, ["home", "aluno", "relatorio.txt"]); return Boolean(n && n.tipo === "arq" && n.conteudo.startsWith("arroz\n")); } },
  { id: "lx-08", titulo: "Quem mais bate na porta?", enunciado: "Descubra qual endereço IP aparece mais vezes em /var/log/acesso.log (dica: o primeiro campo), montando um pipe com sort e uniq -c.", dicas: ["cat /var/log/acesso.log | sort | uniq -c", "Repare que 10.0.0.9 aparece 3 vezes."], confere: (_fs, _cwd, h) => h.some((c) => /sort.*\|\s*uniq\s+-c/.test(c)) },
];

/** Um terminal Linux simulado: shell e sistema de arquivos virtuais, para praticar sem medo. Nada toca o aparelho real. */
export function TerminalLinux() {
  const [fs] = useState<No>(() => fsInicial());
  const estado = useRef({ cwd: "/home/aluno", historico: [] as string[] });
  const [linhas, setLinhas] = useState<string[]>(["Instituto Lúcia · terminal simulado. Digite help para ver os comandos.", ""]);
  const [comando, setComando] = useState("");
  const [posHist, setPosHist] = useState<number | null>(null);
  const [cwd, setCwd] = useState("/home/aluno");
  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [resultado, setResultado] = useState<boolean | null>(null);
  const [dica, setDica] = useState(0);
  const fim = useRef<HTMLDivElement>(null);
  // Chave no corpo: o scrollIntoView do Chrome novo devolve uma promessa, e efeito que devolve algo que não é função derruba a página.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [linhas]);
  function enviar() {
    const c = comando.trim();
    const prompt = `aluno@lucia:${estado.current.cwd.replace("/home/aluno", "~") || "/"}$ ${comando}`;
    if (!c) { setLinhas((l) => [...l, prompt]); setComando(""); return; }
    estado.current.historico.push(c);
    const saida = executar(c, fs, estado.current);
    if (saida === "\u0000clear") setLinhas([]);
    else setLinhas((l) => [...l.slice(-400), prompt, ...(saida ? saida.replace(/\n$/, "").split("\n") : [])]);
    setComando("");
    setPosHist(null);
    setCwd(estado.current.cwd);
  }
  const conferir = () => { if (exercicio) setResultado(exercicio.confere(fs, estado.current.cwd, estado.current.historico)); };
  const prompt = `aluno@lucia:${cwd.replace("/home/aluno", "~") || "/"}$`;
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 font-sans text-sm lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div className="border-4 border-ink bg-[#17130e] p-3 font-mono text-[0.8rem] text-[#efe4c8]" onClick={() => document.getElementById("terminal-entrada")?.focus()}>
          <div className="h-80 overflow-y-auto whitespace-pre-wrap">
            {linhas.map((l, i) => <div key={i}>{l}</div>)}
            <div ref={fim} />
          </div>
          <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
            <span className="shrink-0 text-[#d4a24c]">{prompt}</span>
            <input id="terminal-entrada" value={comando} onChange={(e) => setComando(e.target.value)} autoComplete="off" spellCheck={false} aria-label="Comando" className="min-w-0 flex-1 bg-transparent outline-none"
              onKeyDown={(e) => {
                const h = estado.current.historico;
                if (e.key === "ArrowUp" && h.length) { e.preventDefault(); const p = posHist === null ? h.length - 1 : Math.max(0, posHist - 1); setPosHist(p); setComando(h[p]); }
                if (e.key === "ArrowDown" && posHist !== null) { e.preventDefault(); const p = posHist + 1; if (p >= h.length) { setPosHist(null); setComando(""); } else { setPosHist(p); setComando(h[p]); } }
                if (e.key === "Tab") { e.preventDefault(); const [n, ...r] = comando.split(" "); if (r.length === 0) { const op = COMANDOS.filter((c) => c.startsWith(n)); if (op.length === 1) setComando(op[0] + " "); } else { const parcial = r[r.length - 1]; const d = achar(fs, partes(parcial.includes("/") ? parcial.slice(0, parcial.lastIndexOf("/") + 1) : ".", estado.current.cwd)); if (d && d.tipo === "dir") { const base = parcial.includes("/") ? parcial.slice(parcial.lastIndexOf("/") + 1) : parcial; const op = Object.keys(d.filhos).filter((k) => k.startsWith(base)); if (op.length === 1) { r[r.length - 1] = (parcial.includes("/") ? parcial.slice(0, parcial.lastIndexOf("/") + 1) : "") + op[0] + (d.filhos[op[0]].tipo === "dir" ? "/" : ""); setComando([n, ...r].join(" ")); } } } }
              }} />
          </form>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Sistema de arquivos virtual: ~ é /home/aluno. ↑ e ↓ percorrem o histórico; Tab completa. Nada aqui toca o seu computador.</p>
      </div>
      <aside className="border-2 border-ink bg-parchment-deep p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">Exercícios guiados</p>
        <ol className="mt-2 space-y-1">
          {EXERCICIOS.map((e, i) => (
            <li key={e.id}><button type="button" onClick={() => { setExercicio(e); setResultado(null); setDica(0); }} className={`cursor-pointer text-left underline hover:text-oxblood ${exercicio?.id === e.id ? "font-semibold" : ""}`}>{i + 1}. {e.titulo}</button></li>
          ))}
        </ol>
        {exercicio && (
          <div className="mt-4 border-t border-rule pt-3">
            <p className="font-semibold">{exercicio.titulo}</p>
            <p className="mt-1">{exercicio.enunciado}</p>
            {exercicio.dicas.slice(0, dica).map((d, i) => <p key={i} className="mt-1 text-ink-soft">{d}</p>)}
            <p className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="cursor-pointer bg-ink px-3 py-1.5 font-semibold text-parchment hover:bg-oxblood" onClick={conferir}>Conferir</button>
              {dica < exercicio.dicas.length && <button type="button" className="cursor-pointer underline" onClick={() => setDica((n) => n + 1)}>Dica</button>}
            </p>
            {resultado !== null && <p className={`mt-2 font-semibold ${resultado ? "text-ok" : "text-oxblood"}`}>{resultado ? "✓ Feito!" : "Ainda não. Confira o que o enunciado pede."}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
