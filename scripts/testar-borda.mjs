// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova os arquivos da VPS (infra/contabo/*) que guardam a borda e o servidor. Não toca em servidor nenhum:
//   registro   o Caddy não grava o IP, os cabeçalhos (cookies) nem a busca de quem visita, nem no registro do site nem no do
//              próprio Caddy (o journald), e o journald tem prazo de 7 dias;
//   SSH        só com chave, com fail2ban, sem encaminhar X11 nem agente; o root só fecha quando a conta nova tem chave;
//   contêiner  o site escuta só em 127.0.0.1, sem capacidade do sistema e sem ganhar privilégio;
//   cópia      a cópia do banco roda de verdade (com um docker de mentira): com a chave pública, só a cópia cifrada fica no
//              disco e ela abre com a chave privada; sem a chave, avisa; erro do pg_dump não guarda nada; as velhas saem.
// Uso: npm run testar:borda
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(raiz, c), "utf8");

let certos = 0;
const falhas = [];
const pulados = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));

// ═══════════════════ 1. O registro do Caddy ═══════════════════
const caddy = ler("infra/contabo/Caddyfile");
const global = caddy.slice(0, caddy.indexOf("(origem)"));
const padrao = global.match(/log default \{[\s\S]*?\n\t\}/)?.[0] ?? "";
ok("o registro do próprio Caddy (journald) tem filtro", /format filter \{/.test(padrao) && /wrap json/.test(padrao));
for (const campo of ["request>headers", "request>remote_ip", "request>remote_port", "request>client_ip", "request>tls", "remote_ip", "client_ip"]) {
  ok(`o registro do próprio Caddy apaga ${campo}`, new RegExp(`(^|\\s)${campo.replace(">", "\\>")} delete`, "m").test(padrao));
}
ok("o registro do próprio Caddy tira a busca (o que vem depois do ?)", /request>uri regexp \\\?\.\*\$ ""/.test(padrao));
ok("a conferência de saúde do contêiner parado não enche o registro", /exclude http\.handlers\.reverse_proxy\.health_checker\.active/.test(padrao));
const acesso = caddy.match(/\tlog \{[\s\S]*?\n\t\}/)?.[0] ?? "";
for (const campo of ["request>headers", "request>remote_ip", "request>client_ip", "resp_headers"]) ok(`o registro do site apaga ${campo}`, acesso.includes(`${campo} delete`));
ok("o registro do site guarda no máximo 7 dias", /roll_keep_for 168h/.test(acesso));
ok("o site só é procurado em 127.0.0.1", /reverse_proxy 127\.0\.0\.1:3001 127\.0\.0\.1:3002/.test(caddy) && !/reverse_proxy (?!127\.0\.0\.1)[0-9]/.test(caddy));
ok("o Caddyfile do repositório não tem endereço de rede nem porta de SSH", !/\b(?:\d{1,3}\.){3}\d{1,3}\b(?!\/)/.test(caddy.replace(/127\.0\.0\.1/g, "")) && !/\.onion\b/.test(caddy));

const journald = ler("infra/contabo/journald-lucia.conf");
const instalar = ler("infra/contabo/instalar.sh");
const prazo = journald.match(/^MaxRetentionSec=(\d+)day$/m);
ok("o journald tem prazo de no máximo 7 dias", prazo !== null && Number(prazo[1]) <= 7);
ok("o journald tem teto de espaço", /^SystemMaxUse=\d+M$/m.test(journald));
ok("o instalar.sh põe o prazo do journald", /install -m 644 journald-lucia\.conf \/etc\/systemd\/journald\.conf\.d\/90-lucia\.conf/.test(instalar) && /systemctl restart systemd-journald/.test(instalar));

// ═══════════════════ 2. SSH e firewall ═══════════════════
const preparar = ler("infra/contabo/preparar.sh");
const sshd = preparar.match(/cat > \/etc\/ssh\/sshd_config\.d\/00-lucia\.conf <<'?EOF'?\n([\s\S]*?)\nEOF/)?.[1] ?? "";
ok("SSH sem senha", /^PasswordAuthentication no$/m.test(sshd) && /^KbdInteractiveAuthentication no$/m.test(sshd));
ok("SSH sem X11 e sem agente", /^X11Forwarding no$/m.test(sshd) && /^AllowAgentForwarding no$/m.test(sshd));
ok("SSH com poucas tentativas por conexão", /^MaxAuthTries [1-3]$/m.test(sshd));
ok("o root nunca entra com senha", /^PermitRootLogin \$raiz_ssh$/m.test(sshd) && /raiz_ssh=prohibit-password/.test(preparar) && !/raiz_ssh=yes/.test(preparar));
ok("o root só fecha quando a conta nova tem chave (ninguém se tranca fora)", /if \[ -s "\/home\/\$LUCIA_ADMIN\/\.ssh\/authorized_keys" \]; then raiz_ssh=no; fi/.test(preparar));
ok("o fail2ban é instalado e vigia o SSH", /apt-get install -y[^\n]*\bfail2ban\b/.test(preparar) && /\[sshd\]\nenabled = true/.test(preparar) && /systemctl enable fail2ban/.test(preparar));
ok("o fail2ban vigia também a porta extra, sem escrever a porta no arquivo", /port = 22\$\{SSH_PORTA_EXTRA:\+,\$\{SSH_PORTA_EXTRA\}\}/.test(preparar));
ok("nenhuma porta de SSH escrita no preparar.sh", !/(ufw allow|Port|port =)\s*[0-9]{3,5}(?!\d)/.test(preparar.replace(/ufw allow 22\/tcp|port = 22\$/g, "")));
ok("80 e 443 só para a Cloudflare; o resto fechado", /ufw default deny incoming/.test(preparar) && /ufw allow proto tcp from "\$ip" to any port 80,443 comment cloudflare/.test(preparar) && !/ufw allow (80|443)\b/.test(preparar));
ok("atualizações automáticas de segurança", /APT::Periodic::Unattended-Upgrade "1";/.test(preparar));

// ═══════════════════ 3. O contêiner do site ═══════════════════
const atualizar = ler("infra/contabo/atualizar.sh");
const run = atualizar.match(/docker run -d [\s\S]*?"\$IMAGEM:\$ALVO"/)?.[0] ?? "";
const portas = [...run.matchAll(/(?:^|\s)(?:-p|--publish)[ =]"?([^"\s]+)/g)].map((m) => m[1]);
ok("o site publica a porta só em 127.0.0.1", portas.length === 1 && portas.every((p) => p.startsWith("127.0.0.1:")));
ok("o site roda sem nenhuma capacidade do sistema", /--cap-drop ALL/.test(run));
ok("o site não pode ganhar privilégio", /--security-opt no-new-privileges:true/.test(run));
ok("o site tem teto de memória, de processos e de registro", /--memory \d+g/.test(run) && /--pids-limit \d+/.test(run) && /--log-opt max-size=/.test(run));
ok("nenhum contêiner privilegiado nem na rede da máquina (o site)", !/--privileged|--network host/.test(run));
ok("a imagem do site roda como usuário comum", /^USER node$/m.test(ler("Dockerfile")));

// ═══════════════════ 4. A cópia do banco, rodando ═══════════════════
const copia = ler("infra/contabo/backup-banco.sh");
ok("a cópia usa a imagem do Postgres pelo resumo (digest)", /^IMAGEM=postgres:\d+-alpine@sha256:[0-9a-f]{64}$/m.test(copia));
ok("o instalar.sh baixa a mesma imagem da cópia", instalar.includes(`docker pull -q "$(sed -n 's/^IMAGEM=//p' backup-banco.sh)"`));
// Os sais e segredos ficam de fora das duas cópias: com o sal junto, os resumos de endereço de rede viram endereços.
const copiaGithub = ler(".github/workflows/copia-do-banco.yml");
for (const tabela of ["origem_segredo", "origem_sal", "vale_sal", "rede_fed_apelido_segredo", "segredos"]) {
  const exclusao = new RegExp(`--exclude-table-data=interno\\.${tabela}(?![\\w.])`);
  ok(`a cópia da VPS deixa de fora os dados de interno.${tabela}`, exclusao.test(copia));
  ok(`a cópia do GitHub deixa de fora os dados de interno.${tabela}`, exclusao.test(copiaGithub));
}

const bash = spawnSync("bash", ["--version"], { encoding: "utf8" });
const gpg = spawnSync("gpg", ["--version"], { encoding: "utf8" });
if (bash.status !== 0) pulados.push("a cópia rodando (falta o bash)");
else if (gpg.status !== 0) pulados.push("a cópia cifrada rodando (falta o gpg)");
else {
  const roteiro = `
set -u
script="$1"
t=$(mktemp -d)
mkdir -p "$t/bin" "$t/gnupg" "$t/copias"
chmod 700 "$t/gnupg"
export GNUPGHOME="$t/gnupg"
# O docker de mentira: imprime uma cópia "PGDMP" de 120 kB, ou falha com DOCKER_FALHA=1, ou sai minúsculo com DOCKER_PEQUENO=1.
cat > "$t/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
[ "\${DOCKER_FALHA:-}" = 1 ] && { echo "pg_dump: erro de mentira" >&2; exit 1; }
printf 'PGDMP'
if [ "\${DOCKER_PEQUENO:-}" = 1 ]; then printf 'x'; else head -c 120000 /dev/zero | tr '\\0' 'a'; fi
DOCKER
chmod 755 "$t/bin/docker"
export PATH="$t/bin:$PATH"
printf 'BANCO_URL=postgresql://teste:teste@localhost/teste\\n' > "$t/segredo"  # gitleaks:allow (valor de teste)
gpg --batch --quiet --passphrase '' --quick-gen-key 'copia-de-teste' default default never 2>/dev/null
gpg --batch --quiet --export 'copia-de-teste' > "$t/chave.pub"
export BACKUP_SEGREDO="$t/segredo" BACKUP_PASTA="$t/copias" BACKUP_GUARDAR=2
diz() { if eval "$2"; then echo "OK $1"; else echo "FALHA $1"; fi; }

BACKUP_CHAVE="$t/chave.pub" bash "$script" > "$t/saida1" 2>&1; s=$?
diz "com a chave: a rodada termina bem" '[ $s -eq 0 ]'
diz "com a chave: só a cópia cifrada fica no disco" '[ "$(ls "$t/copias" | grep -c "\\.dump\\.gpg$")" = 1 ] && [ "$(ls -A "$t/copias" | grep -vc "\\.dump\\.gpg$")" = 0 ]'
f=$(ls "$t/copias"/*.dump.gpg 2>/dev/null | head -1)
diz "com a chave: a cópia cifrada não mostra o cabeçalho do pg_dump" '[ -n "$f" ] && [ "$(head -c 5 "$f")" != PGDMP ]'
diz "com a chave: a chave privada abre a cópia" '[ "$(gpg --batch --quiet --decrypt "$f" 2>/dev/null | head -c 5)" = PGDMP ]'
diz "com a chave: o registro não mostra o caminho das cópias" '! grep -q "$t" "$t/saida1"'

bash "$script" > "$t/saida2" 2>&1; s=$?
diz "sem a chave: a cópia sai, sem cifra, e avisa" '[ $s -eq 0 ] && grep -q "SEM cifra" "$t/saida2" && [ "$(ls "$t/copias" | grep -c "\\.dump$")" = 1 ]'

# Duas cópias antigas (uma cifrada, outra não): com BACKUP_GUARDAR=2, as duas saem na próxima rodada.
touch -d '2020-01-01' "$t/copias/banco-2020-01-01T0000Z.dump" "$t/copias/banco-2020-01-02T0000Z.dump.gpg"
BACKUP_CHAVE="$t/chave.pub" bash "$script" > /dev/null 2>&1; s=$?
diz "as velhas saem: ficam só BACKUP_GUARDAR cópias, cifradas ou não" '[ $s -eq 0 ] && [ "$(ls "$t/copias" | grep -c "^banco-")" = 2 ] && ! ls "$t/copias" | grep -q "^banco-2020"'

antes=$(ls -A "$t/copias" | wc -l)
DOCKER_FALHA=1 BACKUP_CHAVE="$t/chave.pub" bash "$script" > /dev/null 2>&1; s=$?
diz "erro do pg_dump: a rodada falha e nada novo fica (nem pedaço)" '[ $s -ne 0 ] && [ "$(ls -A "$t/copias" | wc -l)" = "$antes" ]'
DOCKER_PEQUENO=1 BACKUP_CHAVE="$t/chave.pub" bash "$script" > /dev/null 2>&1; s=$?
diz "cópia estranha (minúscula): a rodada falha e nada novo fica" '[ $s -ne 0 ] && [ "$(ls -A "$t/copias" | wc -l)" = "$antes" ]'
BACKUP_CHAVE="$t/nao-existe.pub" bash "$script" > /dev/null 2>&1; s=$?
diz "chave que não existe: a rodada falha antes de copiar" '[ $s -ne 0 ] && [ "$(ls -A "$t/copias" | wc -l)" = "$antes" ]'
rm -rf "$t"
`;
  const arquivo = path.join(raiz, "infra/contabo/backup-banco.sh");
  const r = spawnSync("bash", ["-c", roteiro, "roteiro", arquivo.replace(/\\/g, "/")], { encoding: "utf8", timeout: 300_000 });
  const linhas = (r.stdout ?? "").split("\n").filter((l) => /^(OK|FALHA) /.test(l));
  if (linhas.length < 10) falhas.push(`a cópia rodando: o roteiro não terminou (${(r.stderr ?? "").slice(0, 300)})`);
  for (const l of linhas) ok(`cópia: ${l.slice(l.indexOf(" ") + 1)}`, l.startsWith("OK "));
}

for (const p of pulados) console.log(`  pulado: ${p}`);
if (falhas.length) {
  console.error(`Borda e servidor: ${certos} certos, ${falhas.length} falhas.`);
  for (const f of falhas) console.error(`  FALHA: ${f}`);
  process.exit(1);
}
console.log(`Borda e servidor: ${certos} certos, 0 falhas.`);
