// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O WARGAME do laboratório (no estilo do OverTheWire Bandit): dentro do Linux de verdade e isolado, cada nível é um
// usuário. A senha do próximo nível está escondida atrás de uma falha ou má-configuração REAL que o aluno precisa
// explorar no terminal real — ler um arquivo, procurar entre muitos, achar por dono, escalar privilégio… Não há saída
// enlatada: o que o aluno digita é o que o sistema responde. No fim, ele vira root e pega a bandeira.
//
// As senhas são sorteadas a cada sessão (area.js) e plantadas na máquina pela preparação abaixo; a janela de Missões
// confere a senha que o aluno encontrou. Quem lê este arquivo vê a MECÂNICA, não as senhas (elas só existem em memória).

/** Os níveis, na ordem. Cada um: o usuário, o que aprender, o objetivo e dicas que ensinam a técnica (não a resposta). */
export const NIVEIS = [
  {
    n: 0, usuario: "nivel0", titulo: "Primeiro contato", tecnica: "ls, cat",
    objetivo: "A senha do nivel1 está guardada num arquivo do seu diretório pessoal. Liste os arquivos e leia o que interessa.",
    dicas: [
      "Veja onde você está com  pwd  e entre no seu diretório com  cd ~",
      "Liste os arquivos com  ls   (use  ls -l  para ver detalhes).",
      "Leia um arquivo de texto com  cat nome-do-arquivo",
    ],
  },
  {
    n: 1, usuario: "nivel1", titulo: "Um nome traiçoeiro", tecnica: "cat ./arquivo",
    objetivo: "A senha está num arquivo cujo nome é só um traço: -. Ler esse arquivo pede um truque.",
    dicas: [
      "Entre no seu diretório:  cd ~  e liste com  ls",
      "cat -  não funciona: o cat acha que  -  é uma opção (ler da entrada).",
      "Diga que é um caminho, não uma opção:  cat ./-",
    ],
  },
  {
    n: 2, usuario: "nivel2", titulo: "Espaços no caminho", tecnica: "aspas no shell",
    objetivo: "A senha está num arquivo cujo nome tem espaços. No terminal, espaço separa palavras — é preciso proteger o nome.",
    dicas: [
      "Veja o nome exato com  ls",
      "Proteja o nome com aspas:  cat \"nome com espacos.txt\"",
      "Dica rápida: digite o começo do nome e aperte Tab para completar.",
    ],
  },
  {
    n: 3, usuario: "nivel3", titulo: "O que não se vê", tecnica: "ls -a (arquivos ocultos)",
    objetivo: "A senha está num arquivo oculto (nome começando com ponto). O ls comum não mostra.",
    dicas: [
      "Arquivos e pastas que começam com  .  ficam escondidos.",
      "Mostre tudo, inclusive os ocultos, com  ls -a   (ou  ls -la).",
      "Entre na pasta oculta e leia o arquivo oculto lá dentro.",
    ],
  },
  {
    n: 4, usuario: "nivel4", titulo: "Agulha no palheiro", tecnica: "grep em vários arquivos",
    objetivo: "Na pasta  dados  há muitos arquivos. Só um contém a senha (marcada com a palavra 'senha'). Achar um por um é lento.",
    dicas: [
      "Entre na pasta:  cd ~/dados   e veja quantos arquivos há com  ls",
      "O grep procura um texto dentro de arquivos:  grep senha *",
      "Para procurar em pastas inteiras, de uma vez:  grep -r senha ~/dados",
    ],
  },
  {
    n: 5, usuario: "nivel5", titulo: "Procurando no meio da multidão", tecnica: "grep num arquivo grande",
    objetivo: "O arquivo  grande.txt  tem centenas de linhas. Uma delas revela a senha do nivel6. Role tudo, ou procure direto.",
    dicas: [
      "Ver tudo rolando é inviável. Procure pela palavra 'senha':  grep senha ~/grande.txt",
      "O grep mostra só as linhas que combinam — a resposta aparece sozinha.",
      "Experimente também  grep -i senha  (ignora maiúsculas/minúsculas).",
    ],
  },
  {
    n: 6, usuario: "nivel6", titulo: "Pertence a quem?", tecnica: "find -user (busca por dono)",
    objetivo: "Existe, em algum lugar do sistema, um arquivo que pertence ao usuário  nivel7  e que você pode ler. Encontre-o.",
    dicas: [
      "O comando  find  procura em todo o sistema por critérios.",
      "Para procurar por dono:  find / -user nivel7 2>/dev/null   (o 2>/dev/null esconde os erros de permissão).",
      "Achou o caminho? Leia com  cat  o arquivo que apareceu.",
    ],
  },
  {
    n: 7, usuario: "nivel7", titulo: "A ovelha desgarrada", tecnica: "sort | uniq -u",
    objetivo: "O arquivo  lista.txt  tem muitas linhas repetidas e uma única que aparece só uma vez — essa é a senha.",
    dicas: [
      "Repetições ficam fáceis de ver quando o arquivo está ordenado:  sort ~/lista.txt",
      "O  uniq  trabalha sobre linhas ordenadas; a opção  -u  mostra só as que não se repetem.",
      "Junte os dois com um cano (|):  sort ~/lista.txt | uniq -u",
    ],
  },
  {
    n: 8, usuario: "nivel8", titulo: "Virar o dono da casa", tecnica: "escalada de privilégio",
    objetivo: "Agora o alvo é ser ROOT (administrador) e ler a bandeira em  /root/FLAG.txt. Administradores descuidados deixam cópias de senha legíveis por todos. Procure.",
    dicas: [
      "O root deixou rastros. Olhe em lugares de administração, como  /opt  e  /var.",
      "Procure arquivos legíveis por qualquer um com nomes de backup/notas:  ls -la /opt/backup   ou  find / -perm -o=r -name '*.txt' 2>/dev/null",
      "Achou a senha do root? Vire root com  su root  (digite a senha) e depois  cat /root/FLAG.txt",
    ],
  },
];

/** Escapa um texto para dentro de aspas simples do shell. */
const sq = (t) => `'${String(t).replace(/'/g, `'\\''`)}'`;

/**
 * O roteiro de preparação (roda como root no arranque): cria os usuários, define as senhas, e planta o desafio de cada
 * nível com dono e permissão certos, de modo que um nível NÃO consegue ler o arquivo do próximo. `s` tem s.nivel[1..8]
 * (senha para entrar em cada nível), s.root (senha do root) e s.flag (a bandeira). `s.nivel[0]` é a senha inicial dada
 * ao aluno. A última linha deixa o aluno dentro do nivel0.
 */
export function roteiroDePreparacao(s) {
  const n = s.nivel;
  const linhas = [
    "for u in nivel0 nivel1 nivel2 nivel3 nivel4 nivel5 nivel6 nivel7 nivel8; do adduser -D $u >/dev/null 2>&1; done",
    // Define as senhas com passwd (esta busybox não tem chpasswd). O "too weak" é só um aviso; a senha é gravada.
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `printf ${sq(`${n[i]}\n${n[i]}\n`)} | passwd nivel${i} >/dev/null 2>&1`),
    `printf ${sq(`${s.root}\n${s.root}\n`)} | passwd root >/dev/null 2>&1`,
    // nivel0: arquivo simples
    `echo ${sq(n[1])} > /home/nivel0/senha-do-nivel1.txt`,
    // nivel1: arquivo chamado "-"
    `echo ${sq(n[2])} > /home/nivel1/-`,
    // nivel2: nome com espaços
    `echo ${sq(n[3])} > '/home/nivel2/senha secreta aqui.txt'`,
    // nivel3: oculto dentro de pasta oculta
    `mkdir -p /home/nivel3/.segredo && echo ${sq(n[4])} > /home/nivel3/.segredo/.senha`,
    // nivel4: muitos arquivos, um com a senha
    `mkdir -p /home/nivel4/dados && for i in 01 02 03 04 05 06 07 08 09 10 11 12; do echo "dado $i: nada de util aqui" > /home/nivel4/dados/arquivo$i; done && echo ${sq(`senha do nivel5: ${n[5]}`)} > /home/nivel4/dados/arquivo07`,
    // nivel5: arquivo grande com a senha numa linha marcada
    `( i=1; while [ $i -le 40 ]; do echo "registro $i — sem nada de interessante"; i=$((i+1)); done; echo ${sq(`A senha do nivel6 e: ${n[6]}`)}; i=41; while [ $i -le 80 ]; do echo "registro $i — sem nada de interessante"; i=$((i+1)); done ) > /home/nivel5/grande.txt`,
    // nivel6: arquivo em algum lugar do sistema, dono nivel7, legível
    `echo ${sq(n[7])} > /var/tmp/.cache_n7 && chown nivel7:nivel7 /var/tmp/.cache_n7 && chmod 644 /var/tmp/.cache_n7`,
    // nivel7: uma linha única no meio de repetidas
    `( i=1; while [ $i -le 20 ]; do echo "repetido-A"; echo "repetido-B"; i=$((i+1)); done; echo ${sq(n[8])}; i=1; while [ $i -le 20 ]; do echo "repetido-A"; echo "repetido-B"; i=$((i+1)); done ) > /home/nivel7/lista.txt`,
    // nivel8 -> root: backup legível por todos com a senha do root; a bandeira só o root lê
    `mkdir -p /opt/backup && echo ${sq(`Backup de manutenção. Lembrete: a senha do root e ${s.root}`)} > /opt/backup/notas.txt && chmod 644 /opt/backup/notas.txt`,
    `echo ${sq(s.flag)} > /root/FLAG.txt && chmod 600 /root/FLAG.txt`,
    // dono e permissões: cada nível é dono do seu desafio; ninguém mais entra na casa do outro
    "for i in 0 1 2 3 4 5 6 7 8; do chown -R nivel$i:nivel$i /home/nivel$i 2>/dev/null; chmod 700 /home/nivel$i; done",
    // um ambiente que dá um prompt no estilo do Kali e leva cada shell para a casa do usuário
    `printf ${sq('cd "$HOME" 2>/dev/null\nPS1="\\n\\033[1;34m┌──(\\033[1;31m$(id -un)㉿kali\\033[1;34m)-[\\033[0;37m\\w\\033[1;34m]\\n└─\\033[1;31m$\\033[0m "\n')} > /etc/perfil`,
    "export ENV=/etc/perfil",
    "clear",
    // boas-vindas (printf para as cores); o aluno já entra como nivel0
    `printf ${sq("\\033[1;31m═══ LABORATÓRIO DE ATAQUE — Instituto Lúcia ═══\\033[0m\n\nEste é um Linux DE VERDADE, isolado (sem internet). Você vai escalar de usuário em\nusuário — do nivel0 até o root — explorando uma falha REAL a cada nível.\n\n  • Você já está como \\033[1;33mnivel0\\033[0m. Ache a senha do nivel1 e entre com  \\033[1;36msu nivel1\\033[0m.\n  • Abra a janela \\033[1;36mMissões\\033[0m (objetivo e dicas) e o \\033[1;36mGuia\\033[0m (comandos).\n  • Comece agora:  \\033[1;36mcd ~\\033[0m   e depois   \\033[1;36mls\\033[0m\n\nTreino. Fazer isto em sistema alheio sem autorização é crime (Lei 12.737).\n")}`,
    // deixa o aluno dentro do nivel0 (sem deixar um shell de root para trás)
    "exec su nivel0",
  ];
  return linhas.join("\n") + "\n";
}
