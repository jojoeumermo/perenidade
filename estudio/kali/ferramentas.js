// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As ferramentas de treino da área de trabalho. Cada uma é uma RECRIAÇÃO DIDÁTICA: imita a cara e o fluxo de uma
// ferramenta famosa de segurança (Nmap, Wireshark, Burp, sqlmap, Hydra, John, Metasploit), mas a saída é fictícia e
// vem toda do cenário de rede.js. Nenhuma delas tem acesso a rede nenhuma: não varrem, não capturam e não atacam nada.
// O objetivo é ensinar a LER o que cada ferramenta mostra e, em cada caso, a defesa.
import { ALVOS, EU, FLAG, HASHES, principal, REDE, WEB } from "./rede.js";

/** Pequeno criador de elementos: h("div.classe", { attr }, ...filhos). */
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

/** Escreve um texto aos poucos num elemento, para a saída "andar" como num terminal. Devolve uma promessa. */
function digitar(el, texto, { velocidade = 6, aoFim } = {}) {
  return new Promise((resolve) => {
    const linhas = texto.split("\n");
    let i = 0;
    el.textContent = "";
    const passo = () => {
      if (i >= linhas.length) {
        aoFim?.();
        return resolve();
      }
      el.textContent += (i ? "\n" : "") + linhas[i++];
      el.scrollTop = el.scrollHeight;
      setTimeout(passo, velocidade * (8 + Math.random() * 12));
    };
    passo();
  });
}

const aviso = (texto) => h("p.aviso-treino", texto);
const botao = (rotulo, onclick) => h("button.k-botao", { onclick }, rotulo);
const console0 = () => h("pre.k-console");

// ───────────────────────── Nmap ─────────────────────────
function nmap(corpo) {
  const saida = console0();
  const alvo = h("input.k-campo", { value: REDE });
  const rodar = botao("Varrer", async () => {
    rodar.disabled = true;
    let t = `# nmap -sV ${alvo.value}\nA iniciar o Nmap (treino) — nenhum host real é tocado.\n\n`;
    for (const a of ALVOS) {
      t += `Nmap scan report for ${a.nome} (${a.ip})\nHost is up.\nPORT      STATE SERVICE     VERSION\n`;
      for (const p of a.portas) t += `${String(p.n + "/tcp").padEnd(9)} open  ${p.servico.padEnd(11)} ${p.versao}\n`;
      t += "\n";
    }
    t += `Nmap done: ${ALVOS.length} hosts up. Alvo do desafio: ${principal().nome} (${principal().ip}).`;
    await digitar(saida, t);
    rodar.disabled = false;
  });
  corpo.append(
    aviso("Varredor de portas — recriação didática do Nmap. Descobre quais serviços um computador deixa abertos. Leitura, não invasão."),
    h("div.k-barra", h("span", "Alvo:"), alvo, rodar),
    saida,
    h("p.k-dica", "O que aprender: cada porta aberta é uma porta de entrada possível. Menos portas expostas, menos risco. A defesa começa fechando o que não se usa (firewall) e atualizando o que fica aberto."),
  );
}

// ───────────────────────── Wireshark ─────────────────────────
function wireshark(corpo) {
  const alvo = principal();
  const pacotes = [
    { n: 1, t: "0.000", de: EU, para: alvo.ip, prot: "TCP", info: "54312 → 80 [SYN]", det: "Começo de conversa (aperto de mão TCP): o seu computador pede para abrir conexão na porta 80." },
    { n: 2, t: "0.002", de: alvo.ip, para: EU, prot: "TCP", info: "80 → 54312 [SYN, ACK]", det: "O servidor aceita e responde. O aperto de mão continua." },
    { n: 3, t: "0.003", de: EU, para: alvo.ip, prot: "TCP", info: "54312 → 80 [ACK]", det: "Conexão estabelecida." },
    { n: 4, t: "0.010", de: EU, para: alvo.ip, prot: "HTTP", info: "POST /login", corpo: `usuario=maria&senha=${WEB.contas[1].senha}`, det: "AQUI está a lição: o login foi enviado em HTTP puro (sem cadeado). A senha viaja em texto limpo e qualquer um na rede a lê. Repare no campo senha abaixo." },
    { n: 5, t: "0.030", de: alvo.ip, para: EU, prot: "HTTP", info: "200 OK (Set-Cookie: sessao=…)", det: "O servidor responde e entrega um cookie de sessão — também em texto limpo." },
    { n: 6, t: "1.200", de: EU, para: "10.10.14.1", prot: "DNS", info: "Standard query A biblioteca.local", det: "Uma consulta de nome comum na rede." },
  ];
  const lista = h("table.k-tabela");
  lista.append(h("tr", ...["Nº", "Tempo", "Origem", "Destino", "Prot.", "Informação"].map((c) => h("th", c))));
  const detalhe = h("div.k-detalhe", h("p.k-dica", "Clique num pacote para ver o que ele carrega."));
  for (const p of pacotes) {
    const cor = p.prot === "HTTP" ? "http" : p.prot === "DNS" ? "dns" : "tcp";
    const linha = h(`tr.pac.${cor}`, h("td", p.n), h("td", p.t), h("td", p.de), h("td", p.para), h("td", p.prot), h("td", p.info));
    linha.addEventListener("click", () => {
      [...lista.querySelectorAll("tr.sel")].forEach((x) => x.classList.remove("sel"));
      linha.classList.add("sel");
      detalhe.innerHTML = "";
      detalhe.append(h("p", { html: `<strong>Pacote ${p.n}</strong> — ${p.de} → ${p.para} (${p.prot})` }), h("p", p.det));
      if (p.corpo) detalhe.append(h("pre.k-console.vermelho", `Conteúdo enviado:\n${p.corpo}\n\n↑ senha em texto limpo, capturável por qualquer um na rede.`));
    });
    lista.append(linha);
  }
  corpo.append(
    aviso("Analisador de rede — recriação didática do Wireshark. Mostra os pacotes que passam. Aqui é uma captura fictícia já gravada."),
    h("div.k-split", lista, detalhe),
    h("p.k-dica", "O que aprender: sem HTTPS (cadeado), tudo viaja aberto — senhas, cookies, mensagens. Defesa: HTTPS em tudo, sempre; nunca digitar senha em site sem cadeado; numa rede pública, usar VPN."),
  );
}

// ───────────────────────── Burp (HTTP) ─────────────────────────
function burp(corpo) {
  const alvo = principal();
  const req = `POST /login HTTP/1.1\nHost: ${alvo.ip}\nContent-Type: application/x-www-form-urlencoded\nContent-Length: 29\n\nusuario=maria&senha=girassol`;
  const res = `HTTP/1.1 200 OK\nSet-Cookie: sessao=8f3a1c; HttpOnly\nContent-Type: text/html\n\n<h1>Olá, maria</h1>`;
  const areaReq = h("pre.k-console.editavel", { contenteditable: "true" }, req);
  const areaRes = console0();
  const enviar = botao("Enviar", async () => {
    const texto = areaReq.textContent;
    let resposta;
    if (/senha=('|%27| or |' or )/i.test(texto) || /senha=.*--/.test(texto)) {
      resposta = `HTTP/1.1 200 OK\nSet-Cookie: sessao=ADMIN; HttpOnly\n\n<h1>Olá, admin</h1>\n<!-- entrou sem a senha certa: o campo não foi tratado (injeção de SQL) -->`;
    } else if (/senha=girassol/.test(texto)) {
      resposta = res;
    } else {
      resposta = `HTTP/1.1 401 Unauthorized\n\n<h1>Usuário ou senha inválidos</h1>`;
    }
    await digitar(areaRes, resposta);
  });
  corpo.append(
    aviso("Intermediário HTTP — recriação didática do Burp. Mostra e deixa reenviar o pedido que o navegador manda. Alvo é a aplicação de treino."),
    h("p.k-dica", "Experimente trocar o valor de senha por  ' or '1'='1  e reenviar. Veja a aplicação de treino deixar entrar sem a senha certa: é a injeção de SQL."),
    h("div.k-split", h("div", h("div.k-rotulo", "Pedido (editável)"), areaReq, enviar), h("div", h("div.k-rotulo", "Resposta"), areaRes)),
    h("p.k-dica", "Defesa: nunca montar consulta ao banco juntando texto do usuário (usar consultas parametrizadas); validar e tratar toda entrada; HTTPS; cookies HttpOnly."),
  );
}

// ───────────────────────── sqlmap ─────────────────────────
function sqlmap(corpo) {
  const saida = console0();
  const rodar = botao("Testar injeção", async () => {
    rodar.disabled = true;
    const contas = WEB.contas.map((c) => `${c.usuario.padEnd(8)} | ${c.senha.padEnd(16)} | ${c.papel}`).join("\n");
    await digitar(saida, [
      `# sqlmap -u "http://${WEB.host}/login" --data "usuario=a&senha=a" (treino)`,
      "[info] a testar o parâmetro 'senha'…",
      "[info] o parâmetro 'senha' parece ser injetável (a aplicação de treino confia no texto digitado)",
      "[info] o banco é: MariaDB (simulado)",
      "[info] a listar tabelas: usuarios, livros, emprestimos",
      "[info] a extrair 'usuarios':",
      "",
      "usuario  | senha            | papel",
      "---------+------------------+--------------",
      contas,
      "",
      "Repare: as senhas estão guardadas em texto puro no banco de treino — erro grave e comum.",
    ].join("\n"));
    rodar.disabled = false;
  });
  corpo.append(
    aviso("Teste de injeção de SQL — recriação didática do sqlmap, contra a aplicação de treino. Mostra por que uma consulta mal feita entrega o banco inteiro."),
    rodar, saida,
    h("p.k-dica", "Defesa: consultas parametrizadas (nunca juntar texto do usuário na consulta); senhas guardadas como hash forte (bcrypt/argon2), nunca em texto; menor privilégio no banco."),
  );
}

// ───────────────────────── dirb ─────────────────────────
function dirb(corpo) {
  const saida = console0();
  const rodar = botao("Procurar diretórios", async () => {
    rodar.disabled = true;
    let t = `# dirb http://${WEB.host}/ (treino — lista de nomes comuns)\n\n`;
    for (const c of WEB.caminhos) t += `+ http://${WEB.host}${c.caminho}  (CÓDIGO:${c.status})  ${c.nota}\n`;
    t += "\nAchados perigosos: /admin aberto, /backup com acervo.sql, /.git exposto.";
    await digitar(saida, t);
    rodar.disabled = false;
  });
  corpo.append(
    aviso("Varredor de diretórios — recriação didática do dirb/gobuster. Tenta nomes comuns de pastas e vê quais existem. Só na aplicação de treino."),
    rodar, saida,
    h("p.k-dica", "Defesa: não deixar painéis, cópias de segurança e repositórios (.git) acessíveis; responder 404 para o que não é público; revisar o que está no servidor."),
  );
}

// ───────────────────────── Hydra ─────────────────────────
function hydra(corpo) {
  const saida = console0();
  const rodar = botao("Auditar senha SSH", async () => {
    rodar.disabled = true;
    const tentativas = ["admin", "root", "123456", "senha", "biblioteca", WEB.ssh.senha];
    let t = `# hydra -l ${WEB.ssh.usuario} -P lista-curta.txt ssh://${WEB.host} (treino)\n\n`;
    for (const s of tentativas) t += `[ATTEMPT] ${WEB.ssh.usuario}:${s}\n`;
    t += `\n[22][ssh] host: ${WEB.host}   login: ${WEB.ssh.usuario}   password: ${WEB.ssh.senha}\n1 senha encontrada (fictícia).`;
    await digitar(saida, t);
    rodar.disabled = false;
  });
  corpo.append(
    aviso("Auditoria de senha — recriação didática do Hydra. Testa uma lista curta de senhas comuns contra o SSH de treino. Serve para mostrar por que senha fraca cai."),
    rodar, saida,
    h("p.k-dica", "Defesa: senha longa e única, ou melhor, chave SSH sem senha de texto; limite de tentativas e bloqueio por IP (fail2ban); segundo fator."),
  );
}

// ───────────────────────── John (hashes) ─────────────────────────
function john(corpo) {
  const saida = console0();
  const rodar = botao("Quebrar hashes", async () => {
    rodar.disabled = true;
    let t = "# john --wordlist=comuns.txt hashes.txt (treino)\n\nHashes a testar:\n";
    for (const x of HASHES) t += `  ${x.usuario}: ${x.hash}\n`;
    t += "\nComparando com uma lista de senhas comuns…\n";
    for (const x of HASHES) t += x.fraca ? `  ${x.usuario}: ${x.senha}  (quebrada — estava na lista)\n` : `  ${x.usuario}: (não quebrada — senha longa e fora da lista)\n`;
    t += "\n2 de 3 quebradas. A que resistiu era longa e única.";
    await digitar(saida, t);
    rodar.disabled = false;
  });
  corpo.append(
    aviso("Quebra de senhas por lista — recriação didática do John the Ripper. Mostra que senha comum vira texto em segundos, mesmo guardada como hash."),
    rodar, saida,
    h("p.k-dica", "O que aprender: hash não é mágica — senha fraca cai na comparação com listas. Defesa: senhas longas e únicas, hash forte com sal (bcrypt/argon2), segundo fator."),
  );
}

// ───────────────────────── Metasploit (cenário guiado) ─────────────────────────
function metasploit(corpo) {
  const saida = console0();
  const alvo = principal();
  const passos = [
    "msf6 > use scenario/treino/biblioteca_aberta",
    `msf6 > set RHOSTS ${alvo.ip}`,
    `RHOSTS => ${alvo.ip}`,
    "msf6 > run",
    "",
    "[*] Cenário de treino — nada real é atacado.",
    "[*] A reconhecer o alvo… porta 80 aberta (Biblioteca Aberta).",
    "[*] A aplicação confia no texto do formulário de login (injeção de SQL).",
    "[+] Entrada conseguida como 'admin' (fictícia).",
    "[*] A ler o arquivo de treino /var/www/flag.txt…",
    `[+] ${FLAG}`,
    "",
    "[*] Fim do cenário. Entregue a bandeira em 'enviar-flag' no terminal ou na janela do Desafio.",
  ].join("\n");
  const rodar = botao("Rodar cenário", async () => {
    rodar.disabled = true;
    await digitar(saida, passos, { velocidade: 10 });
    rodar.disabled = false;
  });
  corpo.append(
    aviso("Console de cenário guiado — no estilo do Metasploit, mas é um roteiro fixo de treino contra a aplicação-fantasia. Mostra o encaixe das peças, do reconhecimento à bandeira."),
    rodar, saida,
    h("p.k-dica", "Cada passo tem uma defesa: fechar portas, tratar entrada, guardar senha como hash, separar privilégios. Atacar sistema real sem autorização é crime (no Brasil, Lei 12.737)."),
  );
}

// ───────────────────────── Alvos (mapa da rede) ─────────────────────────
function alvos(corpo) {
  const mapa = h("div.k-mapa");
  for (const a of ALVOS) {
    mapa.append(h(`div.k-host${a.principal ? ".alvo" : ""}`,
      h("div.k-host-ip", a.ip),
      h("div.k-host-nome", a.nome),
      h("div.k-host-sis", a.sistema),
      h("div.k-host-portas", a.portas.map((p) => h("span.k-porta", `${p.n}/${p.servico}`))),
      h("p.k-host-nota", a.nota),
    ));
  }
  corpo.append(
    aviso(`Rede do laboratório (${REDE}) — tudo fictício. Você está em ${EU}. O alvo do desafio tem a borda destacada.`),
    mapa,
    h("p.k-dica", "Mapear a rede é o primeiro passo de qualquer trabalho de segurança (com autorização). Para a defesa, é o inventário: você só protege o que sabe que tem."),
  );
}

// ───────────────────────── Desafio (CTF) ─────────────────────────
function ctf(corpo) {
  const passos = [
    "Abra o Nmap e varra a rede. Qual é o alvo principal e quais portas ele tem abertas?",
    "No mapa de Alvos, confirme o IP do servidor da Biblioteca Aberta.",
    "Use o dirb: que pastas não deviam estar abertas no servidor?",
    "No Burp, troque a senha por  ' or '1'='1  e veja a aplicação deixar entrar: é injeção de SQL.",
    "No sqlmap, extraia as contas. No Metasploit (cenário), rode até aparecer a bandeira.",
    "Entregue a bandeira abaixo (ou no terminal com  enviar-flag LUCIA{...} ).",
  ];
  const lista = h("ol.k-passos", passos.map((p) => h("li", p)));
  const campo = h("input.k-campo.largo", { placeholder: "LUCIA{...}" });
  const resposta = h("p.k-resp");
  const enviar = botao("Entregar bandeira", () => {
    if (campo.value.trim() === FLAG) {
      resposta.textContent = "Correto! Você seguiu a trilha das ferramentas até o fim. Parabéns — e lembre: isto só se faz com autorização.";
      resposta.className = "k-resp ok";
    } else {
      resposta.textContent = "Ainda não. Siga os passos acima com as ferramentas da área de trabalho.";
      resposta.className = "k-resp erro";
    }
  });
  corpo.append(
    aviso("Desafio do laboratório (CTF de treino). Use as ferramentas da área de trabalho para achar a bandeira. Tudo fictício."),
    lista,
    h("div.k-barra", campo, enviar),
    resposta,
  );
}

/** A lista das ferramentas: ícone, nome, categoria e como desenhar a janela. A ordem é a do menu. */
export const FERRAMENTAS = [
  { id: "terminal", nome: "Terminal", icone: "▸_", cat: "Sistema", largura: 680, altura: 420, terminal: true },
  { id: "alvos", nome: "Alvos da rede", icone: "🗺", cat: "Reconhecimento", largura: 640, altura: 480, render: alvos },
  { id: "nmap", nome: "Nmap", icone: "📡", cat: "Reconhecimento", largura: 640, altura: 460, render: nmap },
  { id: "dirb", nome: "dirb", icone: "📁", cat: "Reconhecimento", largura: 620, altura: 420, render: dirb },
  { id: "wireshark", nome: "Wireshark", icone: "🦈", cat: "Rede", largura: 760, altura: 480, render: wireshark },
  { id: "burp", nome: "Burp (HTTP)", icone: "🕷", cat: "Web", largura: 740, altura: 460, render: burp },
  { id: "sqlmap", nome: "sqlmap", icone: "💉", cat: "Web", largura: 680, altura: 440, render: sqlmap },
  { id: "hydra", nome: "Hydra", icone: "🐉", cat: "Senhas", largura: 640, altura: 420, render: hydra },
  { id: "john", nome: "John", icone: "🔑", cat: "Senhas", largura: 640, altura: 420, render: john },
  { id: "metasploit", nome: "Metasploit", icone: "🎯", cat: "Cenário", largura: 700, altura: 460, render: metasploit },
  { id: "ctf", nome: "Desafio", icone: "🚩", cat: "Cenário", largura: 620, altura: 460, render: ctf },
];
