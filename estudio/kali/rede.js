// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O CENÁRIO FICTÍCIO do laboratório. Tudo aqui é inventado e existe só para o treino: endereços, serviços, senhas,
// "falhas" e a bandeira (flag) do desafio. Nenhuma ferramenta deste laboratório toca um sistema de verdade — elas leem
// estes dados e montam uma saída realista. É o mesmo cenário para todas as ferramentas, para a aula fazer sentido de
// ponta a ponta: o que o nmap mostra, o Wireshark captura, o Burp intercepta e o CTF cobra.

export const REDE = "10.10.14.0/24";
export const EU = "10.10.14.5"; // a máquina Kali do aluno

/** A bandeira do desafio: o aluno a encontra seguindo a trilha das ferramentas. */
export const FLAG = "LUCIA{curiosidade_com_responsabilidade}";

/** Os computadores da rede-alvo fictícia. */
export const ALVOS = [
  {
    ip: "10.10.14.1",
    nome: "roteador",
    sistema: "RouterOS (simulado)",
    portas: [{ n: 80, servico: "http", versao: "painel do roteador", banner: "Painel de administração" }],
    nota: "O portão da rede. No treino, fica de fora do alvo.",
  },
  {
    ip: "10.10.14.10",
    nome: "servidor-biblioteca",
    sistema: "Linux (simulado)",
    principal: true,
    portas: [
      { n: 22, servico: "ssh", versao: "OpenSSH 7.4 (simulado)", banner: "SSH-2.0-OpenSSH_7.4" },
      { n: 80, servico: "http", versao: "Apache 2.4 (simulado)", banner: "Biblioteca Aberta — login" },
      { n: 3306, servico: "mysql", versao: "MariaDB 10.3 (simulado)", banner: "banco de dados interno" },
    ],
    nota: "O servidor da aplicação de treino “Biblioteca Aberta”. É o alvo do desafio.",
  },
  {
    ip: "10.10.14.20",
    nome: "estacao-ana",
    sistema: "Windows (simulado)",
    portas: [
      { n: 139, servico: "netbios-ssn", versao: "Samba (simulado)", banner: "" },
      { n: 445, servico: "microsoft-ds", versao: "compartilhamento de arquivos (simulado)", banner: "" },
    ],
    nota: "Uma estação de trabalho comum. Pouca coisa exposta.",
  },
  {
    ip: "10.10.14.30",
    nome: "camera-corredor",
    sistema: "firmware IoT (simulado)",
    portas: [
      { n: 80, servico: "http", versao: "servidor da câmera (simulado)", banner: "Câmera IP — admin/admin" },
      { n: 554, servico: "rtsp", versao: "fluxo de vídeo (simulado)", banner: "" },
    ],
    nota: "Uma câmera IP barata. O clássico: senha de fábrica admin/admin.",
  },
];

export const alvo = (ip) => ALVOS.find((a) => a.ip === ip);
export const principal = () => ALVOS.find((a) => a.principal);

/**
 * A aplicação web de treino "Biblioteca Aberta" em 10.10.14.10:80. Tem, de propósito, as falhas mais ensinadas:
 * diretórios que não deviam aparecer, uma senha fraca e um campo de busca que confia no que o usuário digita (injeção
 * de SQL). Tudo fictício. As respostas abaixo são o que as ferramentas "veem".
 */
export const WEB = {
  host: "10.10.14.10",
  titulo: "Biblioteca Aberta",
  // O que um varredor de diretórios (dirb/gobuster) encontraria.
  caminhos: [
    { caminho: "/", status: 200, nota: "página inicial" },
    { caminho: "/login", status: 200, nota: "formulário de entrada" },
    { caminho: "/css", status: 301, nota: "estilos" },
    { caminho: "/admin", status: 200, nota: "painel — não devia estar aberto" },
    { caminho: "/backup", status: 200, nota: "cópia de segurança exposta (acervo.sql)" },
    { caminho: "/robots.txt", status: 200, nota: "menciona /admin e /backup" },
    { caminho: "/uploads", status: 403, nota: "proibido, mas existe" },
    { caminho: "/.git", status: 403, nota: "repositório exposto" },
  ],
  // Contas fictícias do sistema (o que a injeção de SQL "revelaria" e o que o quebra-senhas trabalha).
  contas: [
    { usuario: "admin", senha: "biblioteca2024", papel: "administrador" },
    { usuario: "maria", senha: "girassol", papel: "bibliotecária" },
    { usuario: "joao", senha: "123456", papel: "leitor" },
  ],
  // Senha de SSH fraca no servidor (o que uma auditoria de senha fraca encontraria).
  ssh: { usuario: "biblioteca", senha: "verao2024" },
};

/** Hashes fictícios (MD5 de brinquedo) para a aula de senhas: o quebra-senha "acha" os que estão numa lista comum. */
export const HASHES = [
  { usuario: "joao", hash: "e10adc3949ba59abbe56e057f20f883e", senha: "123456", fraca: true },
  { usuario: "maria", hash: "d1e8a70b5ccab1dc2f56bbf7e99f064a", senha: "girassol", fraca: true },
  { usuario: "admin", hash: "8b2e5f3c1a9d7e4b6c0f2a8d5e3b1c9f", senha: null, fraca: false },
];
