// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere o pacote "controles" do painel (Etapa 8): regras puras, migração SQL, telas ligadas ao painel e ao mapa.
// Rodar: npm run testar:controles
import fs from "node:fs";
import path from "node:path";
import * as r from "../components/painel/controles/regras.ts";
import { MAPA } from "../components/painel/estrutura.ts";

const raiz = path.join(import.meta.dirname, "..");
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), "utf8");
let ok = 0;
const falhas = [];
const conferir = (nome, cond, detalhe = "") => (cond ? ok++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

// 1. Regras puras (iguais às do banco).
conferir("whatsapp canal", r.erroDoWhatsapp("https://whatsapp.com/channel/0029VaAbCdEfGh1234") === "");
conferir("whatsapp grupo", r.erroDoWhatsapp("https://chat.whatsapp.com/AbCdEfGhIjKlMn") === "");
conferir("whatsapp vazio vale", r.erroDoWhatsapp("  ") === "");
conferir("whatsapp http recusado", r.erroDoWhatsapp("http://whatsapp.com/channel/0029VaAbCdEfGh1234") !== "");
conferir("whatsapp outro site recusado", r.erroDoWhatsapp("https://exemplo.com/channel/0029VaAbCdEfGh1234") !== "");
conferir("telegram canal", r.erroDoTelegram("https://t.me/institutolucia") === "");
conferir("telegram convite", r.erroDoTelegram("https://t.me/+AbCdEfGh123") === "");
conferir("telegram recusa outro site", r.erroDoTelegram("https://telegram.org/x") !== "");
conferir("sala https", r.erroDaSala("https://meet.exemplo.org/sala") === "" && r.erroDaSala("") === "");
conferir("sala recusa http e espaço", r.erroDaSala("http://x.org") !== "" && r.erroDaSala("https://x.org/a b") !== "");
conferir("sala recusa mais de 300", r.erroDaSala(`https://x.org/${"a".repeat(300)}`) !== "");
conferir("faixa ok", r.erroDaFaixa("Hino", "https://exemplo.org/a.ogg") === "");
conferir("faixa sem título", r.erroDaFaixa(" ", "https://exemplo.org/a.ogg") !== "");
conferir("faixa sem áudio", r.erroDaFaixa("Hino", "") !== "");
conferir("faixa recusa http", r.erroDaFaixa("Hino", "http://exemplo.org/a.ogg") !== "");
conferir("canal da rádio", r.erroDoCanalDaRadio("Programas") === "" && r.erroDoCanalDaRadio("A") !== "");
const hex = "a".repeat(64);
conferir("sha256 ok", r.ehSha256(hex) && r.ehSha256(hex.toUpperCase()));
conferir("sha256 curto recusado", !r.ehSha256("abc") && !r.ehSha256("g".repeat(64)));
conferir("hexadecimal", r.emHexadecimal(new Uint8Array([0, 15, 255])) === "000fff");
conferir("sha256 do navegador tem 64", r.ehSha256(r.emHexadecimal(new Uint8Array(32))));
conferir("duração em texto", r.duracaoEmTexto(205) === "3:25" && r.duracaoEmTexto(-4) === "0:00");
conferir("texto em segundos", r.segundosDoTexto("3:25") === 205 && r.segundosDoTexto("") === 0 && r.segundosDoTexto("1:02:03") === 3723 && r.segundosDoTexto("x") === null && r.segundosDoTexto("1:2:3:4") === null);

// 2. Cartões do Centro de controle.
const vazio = { whatsapp: false, telegram: false, sala: false, radio_no_ar: false, radio_canais: 0, radio_faixas: 0, moderadores: 0, nucleos_fechados: 0, arquivos_bloqueados: 0 };
const cartoes = r.cartoesDoCentro(vazio);
conferir("7 cartões", cartoes.length === 7);
conferir("sem canal pede atenção", cartoes.find((c) => c.id === "canais")?.atencao === true);
conferir("cheio não pede atenção", r.cartoesDoCentro({ ...vazio, whatsapp: true, telegram: true, sala: true, radio_canais: 2 }).every((c) => !c.atencao));
conferir("plural certo", r.cartoesDoCentro({ ...vazio, moderadores: 1, nucleos_fechados: 2, arquivos_bloqueados: 1 }).map((c) => c.estado).join(" | ").includes("1 moderação nomeada."));
conferir("cartão não mostra endereço", !JSON.stringify(cartoes).includes("https://"));

// 3. Migração SQL.
const sql = ler("supabase", "migracoes", "2026-11-controles.sql");
const funcoes = [...sql.matchAll(/create or replace function (public\.[a-z_]+)\(/g)].map((m) => m[1]);
for (const f of ["public.rede_moderadores_listar", "public.rede_nucleos_fechados_listar", "public.arquivos_bloqueados_ver", "public.arquivo_desbloquear", "public.publicar_agora_pedir", "public.controles_resumo"]) conferir(`função ${f}`, funcoes.includes(f));
conferir("sem tabela no public", !/create table[^;]*\bpublic\./i.test(sql));
const blocos = sql.split(/(?=create or replace function )/).filter((b) => b.startsWith("create or replace function public."));
conferir("toda função security definer com search_path fixo", blocos.length === funcoes.length && blocos.every((b) => /security definer set search_path = interno, pg_temp/.test(b.split("$$")[0])));
conferir("revoga de public em todas", funcoes.every((f) => sql.includes(`revoke all on function ${f}(`)));
conferir("não libera interno a anon nem authenticated", !/grant execute on function interno\./.test(sql) && !/to anon/.test(sql));
conferir("idempotente (sem create function solto)", !/create function/.test(sql));
conferir("só curador e coordenação decidem", /interno\.curador\(\)/.test(sql) && /interno\.coord\(\)/.test(sql));

// 4. Funções que a tela chama existem no install.sql ou na migração.
const instalacao = ler("supabase", "install.sql");
const existe = (nome) => instalacao.includes(`function public.${nome}(`) || sql.includes(`function public.${nome}(`);
const arquivos = fs.readdirSync(path.join(raiz, "components", "painel", "controles"));
const telas = arquivos.filter((a) => a.endsWith(".tsx") || a.endsWith(".ts")).map((a) => ler("components", "painel", "controles", a));
const chamadas = new Set();
for (const t of telas) for (const m of t.matchAll(/(?:executar|useLista|rpc)(?:<[^>(]*>)?\(\s*"([a-z_0-9]+)"/g)) chamadas.add(m[1]);
conferir("telas chamam funções", chamadas.size >= 12, `achei ${chamadas.size}`);
for (const f of chamadas) conferir(`função existe: ${f}`, existe(f));

// 5. Painel e mapa.
// O registro de seções saiu de Painel.tsx para casca/Dentro.tsx no redesenho (docs/PAINEL-REDESENHO.md): lemos os dois.
const painel = ler("components", "painel", "Painel.tsx") + "\n" + ler("components", "painel", "casca", "Dentro.tsx");
conferir("Centro de controle no registro", /\{ id: "centro", nome: "Centro de controle"/.test(painel));
conferir("Centro desenhado", painel.includes("<CentroDeControle"));
conferir("Rádio com canais e faixas", painel.includes("<RadioCanais />"));
conferir("Centro no mapa, espaço Site", MAPA.centro?.espaco === "site");
conferir("Tecnico tem Publicar agora", ler("components", "painel", "Tecnico.tsx").includes("<PublicarAgora"));
conferir("Materiais tem Publicar agora", ler("components", "painel", "Materiais.tsx").includes("<PublicarAgora"));
conferir("Currículo mantém Publicar agora", ler("components", "painel", "Curriculo.tsx").includes("Publicar agora"));
const rota = ler("app", "api", "painel", "publicar-agora", "route.ts");
conferir("rota usa a função nova e cai na antiga", rota.includes("publicar_agora_pedir") && rota.includes("curriculo_publicar_agora"));

// 6. Higiene dos arquivos novos.
for (const n of arquivos) {
  const t = ler("components", "painel", "controles", n);
  conferir(`${n}: licença`, t.includes("AGPL-3.0-or-later"));
  conferir(`${n}: sem cor escrita à mão`, !/#[0-9a-fA-F]{3,8}\b/.test(t) && !/rgba?\(/.test(t));
  conferir(`${n}: sem confirm nem prompt do navegador`, !/window\.(confirm|prompt)\(/.test(t));
  conferir(`${n}: sem palavra proibida`, !/universidade|diploma/i.test(t));
  conferir(`${n}: sem script nem iframe de terceiros`, !/<iframe|<script/.test(t));
}
conferir("Bloquear arquivo calcula no aparelho", ler("components", "painel", "controles", "BloquearArquivo.tsx").includes("crypto.subtle.digest"));

console.log(`${ok} conferências ok, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  FALHA: ${f}`);
  process.exit(1);
}
