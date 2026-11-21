// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os consertos do chat a dois (Prompt 5, lote "chat") sobre o chat da R2 (lib/rede/chat/r2/servico.ts), no Node, com o motor de
// verdade (@wireapp/core-crypto: Proteus) e um servidor de caixas em memória que faz o que o banco faz (passe errado responde "ok" e
// o pacote cai fora). Nada da cifra muda: o que se confere aqui é o transporte, o estado e o fluxo em volta dela.
//   1. Quem aceita o pedido e escreve logo, antes de o aparelho de quem pediu receber o aceite: a mensagem não se perde (antes, o
//      depósito ia com o passe de quem aceitou para uma caixa que ainda só aceitava o provisório, e caía fora em silêncio). Ela espera
//      na fila do aparelho e sai sozinha quando a confirmação chega.
//   2. F5: o aparelho reaberto (outra instância do motor sobre a mesma loja) só cifra e decifra depois de ligar o Proteus de novo
//      (reabrirProteus); sem isso, toda mensagem falhava depois de recarregar a página.
//   3. Editar e "apagar para todos" vão como controle dentro do cifrado; só o autor edita ou apaga a própria mensagem.
//   4. A agenda das caixas da R3 (receberCaixa) também solta a fila; e, no código: o F5 ligado no navegador, nenhuma busca fora da
//      agenda nem canal do Realtime por caixa, a tela sem confirm() do navegador e os textos novos nos seis idiomas.
// Uso: npm run testar:p5-chat
import { sha256 } from "@noble/hashes/sha2.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { spqrNoNode } from "./spqr-no-node.mjs";
import { paraB64Url, texto, juntar } from "../lib/rede/chat/r2/bytes.ts";
import { ChatDoAparelho } from "../lib/rede/chat/r2/servico.ts";
import { reabrirProteus } from "../lib/rede/chat/r2/proteus.ts";
import { cofreDaLista } from "../lib/rede/aparelhos/sincronia.ts";
import { TAMANHOS_DO_ARQUIVO } from "../lib/rede/aparelhos/arquivo.ts";
import { TAMANHO_DO_PEDIDO } from "../lib/rede/chat/r2/pedido.ts";
import { ROTULOS_DE_FORA } from "../lib/rede/chat/r2/rotulos.ts";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const M = await motorNoNode();
const SPQR = await spqrNoNode();
const b64 = paraB64Url;
const H = (rotulo, v) => sha256(juntar(texto(rotulo), v));

// ═══════════════════ O servidor em memória (o mesmo contrato de scripts/testar-r2-dupla-servico.mjs) ═══════════════════
const servidor = { caixas: new Map(), contas: new Map(), aparelhos: new Map(), preChaves: new Map(), cofres: new Map(), depositos: [] };
const relogio = { agora: Date.UTC(2026, 10, 26, 12) };
const dia = () => new Date(relogio.agora).toISOString().slice(0, 10);
const caixaDe = (id) => servidor.caixas.get(b64(H(ROTULOS_DE_FORA.caixa, id)));
const codinomeDe = {};
function transporteDe(usuario) {
  return {
    async criarCaixa(c) {
      const k = b64(H(ROTULOS_DE_FORA.caixa, c.id));
      const plh = b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl));
      const ja = servidor.caixas.get(k);
      if (ja) {
        if (ja.pl_h !== plh) throw new Error("caixa_existe");
        return;
      }
      servidor.caixas.set(k, { pd_h: b64(c.pdH), pd_anterior_h: null, pl_h: plh, proxima: 1, pacotes: [] });
    },
    async depositar(c, envelope, franquia) {
      const cx = caixaDe(c.id);
      const pdh = b64(H(ROTULOS_DE_FORA.passeDeposito, c.pd));
      const aceito = !!cx && (cx.pd_h === pdh || cx.pd_anterior_h === pdh);
      servidor.depositos.push({ caixa: b64(c.id), aceito });
      if (aceito) cx.pacotes.push({ ordem: cx.proxima++, envelope: new Uint8Array(envelope), franquia: franquia && new Uint8Array(franquia), dia: dia() });
      return { ok: true };
    },
    async buscar(c, cursor) {
      servidor.buscas = (servidor.buscas ?? 0) + 1;
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return [];
      return cx.pacotes.filter((p) => p.ordem > cursor).map((p) => ({ ...p, marca: null }));
    },
    async confirmar(c, ate) {
      const cx = caixaDe(c.id);
      if (cx && cx.pl_h === b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) cx.pacotes = cx.pacotes.filter((p) => p.ordem > ate);
    },
    async trocar(c, pdH, bloqueio) {
      const cx = caixaDe(c.id);
      if (!cx || cx.pl_h !== b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) return;
      cx.pd_anterior_h = bloqueio ? null : cx.pd_h;
      cx.pd_h = b64(pdH);
    },
    async apagar(c) {
      const k = b64(H(ROTULOS_DE_FORA.caixa, c.id));
      const cx = servidor.caixas.get(k);
      if (cx && cx.pl_h === b64(H(ROTULOS_DE_FORA.passeLeitura, c.pl))) servidor.caixas.delete(k);
    },
    async lerDiretorio(codinome) {
      const [u, c] = [...servidor.contas].find(([, x]) => x.codinome === codinome) ?? [];
      if (!u) return null;
      const aparelhos = [...servidor.aparelhos.values()].filter((a) => a.usuario === u).map((a) => ({ ...a, usuario: undefined }));
      return { usuario: u, identidade: c.identidade, pedidosXwing: c.pedidosXwing, pedidosAssinatura: c.pedidosAssinatura, pedidosCaixa: c.pedidosCaixa, pedidosPd: c.pedidosPd, aparelhos };
    },
    async reivindicar(u) {
      const saida = [];
      for (const [k, a] of servidor.aparelhos) {
        if (a.usuario !== u) continue;
        const lista = servidor.preChaves.get(k) ?? [];
        const i = lista.findIndex((p) => !p.ultima);
        const p = i >= 0 ? lista.splice(i, 1)[0] : lista.find((x) => x.ultima);
        if (p) saida.push({ aparelho: a.aparelho, id: p.id, pre: p.pkb, assinatura: p.assinatura });
      }
      return saida;
    },
    async depositarPedido(codinome, envelope) {
      if (envelope.length !== TAMANHO_DO_PEDIDO) throw new Error("tamanho");
      const c = [...servidor.contas.values()].find((x) => x.codinome === codinome);
      if (c) await this.depositar({ id: c.pedidosCaixa, pd: c.pedidosPd }, envelope, null);
    },
    async publicarConta(c) {
      const k = b64(H(ROTULOS_DE_FORA.caixa, c.pedidosCaixa));
      const ja = servidor.caixas.get(k);
      servidor.caixas.set(k, { pd_h: b64(H(ROTULOS_DE_FORA.passeDeposito, c.pedidosPd)), pd_anterior_h: null, pl_h: b64(H(ROTULOS_DE_FORA.passeLeitura, c.pedidosPl)), proxima: ja?.proxima ?? 1, pacotes: ja?.pacotes ?? [] });
      const { pedidosPl: _pl, ...publico } = c;
      servidor.contas.set(usuario, { ...publico, codinome: codinomeDe[usuario] });
    },
    async publicarAparelho(a) {
      servidor.aparelhos.set(b64(a.aparelho), { ...a, usuario });
    },
    async publicarPreChaves(aparelho, lista) {
      servidor.preChaves.set(b64(aparelho), [...lista]);
    },
    async tirarAparelho(aparelho) {
      servidor.aparelhos.delete(b64(aparelho));
    },
    async lerCofre(tipo) {
      return servidor.cofres.get(`${usuario}:${tipo}`) ?? null;
    },
    async gravarCofre(tipo, versao, blob) {
      if (!TAMANHOS_DO_ARQUIVO.includes(blob.length)) throw new Error("invalido:tamanho");
      const k = `${usuario}:${tipo}`;
      if ((servidor.cofres.get(k)?.versao ?? 0) !== versao) return "versao_ocupada";
      servidor.cofres.set(k, { versao: versao + 1, blob: new Uint8Array(blob) });
      return { versao: versao + 1 };
    },
  };
}

/** O histórico em memória, com o "editar" (o do navegador está em lib/rede/chat/r2/navegador.ts). */
function historicoNovo() {
  const m = new Map();
  return {
    m,
    async guardar(x) {
      m.set(`${x.conversa}:${x.id}:${x.aparelho}`, { ...x });
    },
    async apagar(conversa, id, autor) {
      for (const [k, x] of m) if (x.conversa === conversa && x.id === id && x.autor === autor) m.delete(k);
    },
    async apagarConversa(conversa) {
      for (const [k, x] of m) if (x.conversa === conversa) m.delete(k);
    },
    async editar(conversa, id, autor, t) {
      for (const x of m.values()) if (x.conversa === conversa && x.id === id && x.autor === autor) Object.assign(x, { texto: t, editada: true });
    },
    da: (conversa) => [...m.values()].filter((x) => x.conversa === conversa),
  };
}

let guardados = new Map(); // o "disco" de cada aparelho: o estado gravado por persistir
async function aparelho(usuario, codinome) {
  codinomeDe[usuario] = codinome;
  const db = await M.Database.inMemory();
  const motor = M.CoreCrypto.new(db);
  const historico = historicoNovo();
  const deps = {
    motor, spqr: SPQR, transporte: transporteDe(usuario), historico, cofre: cofreDaLista, persistir: async (e) => void guardados.set(usuario, JSON.parse(JSON.stringify(e))),
    sigo: async () => false, conferirRegistro: async () => "confere", agora: () => relogio.agora,
  };
  const chat = await ChatDoAparelho.nascer(deps, usuario, codinome);
  return { chat, historico, motor, deps, db, usuario };
}
const rotina = async (...xs) => {
  for (const x of xs) await x.chat.rotinaAnonima();
  for (const x of xs) await x.chat.rotinaComSessao();
};

const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
const BIA = "bbbbbbbb-0000-4000-8000-000000000002";
const CAIO = "cccccccc-0000-4000-8000-000000000003";
const A = await aparelho(ANA, "ana");
const B = await aparelho(BIA, "bia");
const C = await aparelho(CAIO, "caio");
await rotina(A, B, C);

// ═══════════════════ 1. Quem aceitou escreve antes de quem pediu receber o aceite ═══════════════════
const conv = await A.chat.pedirConversa("bia", "oi");
await B.chat.receberPedidos();
await B.chat.aceitar(conv);
confere("fila: logo depois de aceitar, a Bia ainda não pode escrever direto (a caixa da Ana ainda aceita só o provisório)", B.chat.podeEscreverAgora(conv) === false);
const cedo = await B.chat.mandarTexto(conv, "oi Ana, aceitei!");
confere("fila: a mensagem de quem aceitou fica pendente no aparelho, e nada vai para a caixa da Ana com o passe errado", cedo.pendente === true && cedo.entregues === 0 && !servidor.depositos.some((d) => !d.aceito));
confere("fila: a tela vê a mensagem marcada como pendente", B.historico.da(conv).some((x) => x.texto === "oi Ana, aceitei!" && x.pendente === true));
await A.chat.receber(); // a Ana recebe o aceite, troca o passe e se anuncia
confere("aceite: a conversa abriu para a Ana e ela já pode escrever", A.chat.estado.lista.conversas[conv]?.situacao === "aberta" && A.chat.podeEscreverAgora(conv));
await B.chat.receber(); // a Bia recebe o anúncio da Ana: a fila sai
confere("fila: com a confirmação da Ana, a fila da Bia saiu sozinha", B.chat.pendentesDe(conv).length === 0 && B.chat.podeEscreverAgora(conv));
confere("fila: a cópia da Bia deixou de ser pendente (agora com o id de dentro do cifrado)", B.historico.da(conv).filter((x) => x.texto === "oi Ana, aceitei!").length === 1 && !B.historico.da(conv).some((x) => x.pendente));
await A.chat.receber();
confere("fila: a Ana recebe a mensagem escrita antes do aceite chegar (antes ela se perdia)", A.historico.da(conv).some((x) => x.texto === "oi Ana, aceitei!" && x.autor === BIA));
confere("passe: nenhum depósito caiu fora por passe errado na conversa inteira", !servidor.depositos.some((d) => !d.aceito));

// Conversa direta, nos dois sentidos.
const m1 = await A.chat.mandarTexto(conv, "bora conversar");
confere("direto: a Ana manda sem fila", !m1.pendente && m1.entregues === 1);
confere("direto: a Bia recebe", (await B.chat.receber()) === 1 && B.historico.da(conv).some((x) => x.id === m1.id));
const m2 = await B.chat.mandarTexto(conv, "bora");
confere("direto: a Bia manda sem fila e a Ana recebe", !m2.pendente && (await A.chat.receber()) === 1);

// ═══════════════════ 2. Editar e apagar para todos (controle dentro do cifrado) ═══════════════════
await B.chat.editarMensagem(conv, m2.id, "bora agora");
confere("editar: a cópia da Bia muda e fica marcada", B.historico.da(conv).some((x) => x.id === m2.id && x.texto === "bora agora" && x.editada));
await A.chat.receber();
confere("editar: a cópia da Ana muda e fica marcada como editada", A.historico.da(conv).some((x) => x.id === m2.id && x.texto === "bora agora" && x.editada === true));
await A.chat.editarMensagem(conv, m2.id, "texto falso");
await B.chat.receber();
confere("ataque: a Ana não edita a mensagem da Bia no aparelho da Bia (o autor tem de ser quem pede)", B.historico.da(conv).some((x) => x.id === m2.id && x.texto === "bora agora"));
await A.chat.apagarMensagem(conv, m1.id);
await B.chat.receber();
confere("apagar para todos: a mensagem da Ana some da Bia", !B.historico.da(conv).some((x) => x.id === m1.id));
const naFila = await (async () => {
  const c2 = await C.chat.pedirConversa("ana", "");
  await A.chat.receberPedidos();
  await A.chat.aceitar(c2);
  const p = await A.chat.mandarTexto(c2, "primeira");
  await A.chat.editarMensagem(c2, p.id, "primeira (editada)");
  await A.chat.apagarMensagem(c2, (await A.chat.mandarTexto(c2, "some antes de sair")).id);
  return { c2, p };
})();
confere("fila: editar e apagar valem também na fila (o que foi apagado nunca sai)", A.chat.pendentesDe(naFila.c2).length === 1 && A.chat.pendentesDe(naFila.c2)[0].texto === "primeira (editada)");
await C.chat.receber();
await A.chat.receber();
await C.chat.receber();
confere("fila: o Caio recebe só a mensagem que ficou, já editada", C.historico.da(naFila.c2).map((x) => x.texto).join("|") === "primeira (editada)");

// ═══════════════════ 3. F5: o aparelho reaberto liga o Proteus de novo ═══════════════════
{
  const estado = guardados.get(BIA);
  const outroMotor = M.CoreCrypto.new(B.db); // a página recarregada: outra instância do motor, a mesma loja
  let semLigar = "funcionou";
  try {
    await outroMotor.transaction((c) => c.proteusFingerprint());
  } catch {
    semLigar = "falhou";
  }
  confere("F5: sem ligar o Proteus de novo, o motor reaberto não cifra (era o defeito)", semLigar === "falhou");
  confere("F5: reabrirProteus recusa uma loja do motor que não é a do estado (impressão diferente)", await reabrirProteus(outroMotor, "impressao-de-outro-aparelho").then(() => false, (e) => e?.code === "motor_trocado"));
  const motorDeNovo = M.CoreCrypto.new(B.db);
  await reabrirProteus(motorDeNovo, estado.aparelho.impressao);
  const historico = B.historico;
  const B2 = new ChatDoAparelho({ ...B.deps, motor: motorDeNovo, historico }, estado);
  const m3 = await A.chat.mandarTexto(conv, "depois do F5");
  confere("F5: o aparelho reaberto recebe", (await B2.receber()) === 1 && historico.da(conv).some((x) => x.id === m3.id));
  const m4 = await B2.mandarTexto(conv, "voltei");
  confere("F5: o aparelho reaberto manda e a Ana lê", m4.entregues === 1 && (await A.chat.receber()) === 1 && A.historico.da(conv).some((x) => x.id === m4.id));
  B.chat = B2;
}

// ═══════════════════ 4. A agenda da R3 também solta a fila ═══════════════════
// Com a R3, cada caixa é buscada no seu horário (receberCaixa, pela agenda), não mais por receber(). A fila tem de sair por ali também.
{
  const D = await aparelho("dddddddd-0000-4000-8000-000000000004", "duda");
  await rotina(D);
  const c3 = await D.chat.pedirConversa("bia", "");
  await B.chat.receberCaixa("pedidos");
  await B.chat.aceitar(c3);
  const cedo3 = await B.chat.mandarTexto(c3, "na fila pela agenda");
  confere("agenda: a mensagem de quem aceitou espera na fila", cedo3.pendente === true && B.chat.pendentesDe(c3).length === 1);
  for (const qual of D.chat.caixasVigiadas()) await D.chat.receberCaixa(qual); // a Duda recebe o aceite e se anuncia
  await B.chat.receberCaixa(c3); // a Bia busca só a caixa desta conversa, no horário dela
  confere("agenda: buscar a caixa da conversa (receberCaixa) solta a fila", B.chat.pendentesDe(c3).length === 0);
  for (const qual of D.chat.caixasVigiadas()) await D.chat.receberCaixa(qual);
  confere("agenda: a Duda recebe o que esperava na fila", D.historico.da(c3).some((x) => x.texto === "na fila pela agenda" && x.autor === BIA));
}

// ═══════════════════ 5. O que fica no código (sem rodar o navegador) ═══════════════════
{
  const fs = await import("node:fs");
  const ler = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const nav = ler("lib/rede/chat/r2/navegador.ts");
  const servico = ler("lib/rede/chat/r2/servico.ts");
  const conversa = ler("components/rede/chat/Conversa.tsx");
  const ajustes = ler("components/rede/chat/Ajustes.tsx");
  const semComentarios = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const reabre = nav.indexOf("await reabrirProteus(deps.motor, guardado.estado.aparelho.impressao);");
  confere("F5: o chat reaberto no navegador liga o Proteus de novo antes de usar o motor", reabre > 0 && reabre < nav.indexOf("const c = new ChatDoAparelho(deps, guardado.estado);"));
  confere("histórico do navegador: guarda a marca de editada e de pendente, e edita só a mensagem do próprio autor", nav.includes("editada: true") && nav.includes("pendente: true") && nav.includes("async editar(conversa, id, autor, texto)") && nav.includes("y.autor === autor"));
  // A R3 (Horário e volume): o horário da busca não depende de ter chegado mensagem, e a conta não fica ligada às caixas. Nada de
  // busca fora da agenda nem de canal de aviso por caixa (Broadcast por caixa ligaria a conta da sessão às caixas que ela lê).
  confere("R3: nenhuma busca fora da agenda (sem receberDe nem caixasQueLeio)", !/receberDe\(|caixasQueLeio\(/.test(servico + nav));
  confere("R3: o chat não abre canal do Realtime (o aviso para a tela fica dentro da aba)", !/\.channel\(|realtime/i.test(semComentarios(nav)));
  confere("tela: nada de confirm() do navegador no chat", !/window\.confirm\(/.test(conversa + ajustes));
  confere("tela: o menu da mensagem tem editar, apagar só para mim e apagar para todos", ["t.conversa.editar", "t.conversa.apagarParaMim", "t.conversa.apagarParaTodos", "t.conversa.editada"].every((x) => conversa.includes(x)));
  for (const lang of ["pt", "en", "es", "fr", "ru", "zh"]) {
    const j = JSON.parse(ler(`i18n/rede/chat/${lang}.json`));
    const faltam = ["menu", "editar", "editada", "apagarParaMim", "apagarParaTodos", "apagarParaMimConfirma", "naFila", "filaAviso", "pedidoSemResposta", "ritmo"].filter((k) => !j.conversa?.[k]);
    confere(`textos ${lang}: as chaves novas da conversa existem`, faltam.length === 0 && !!j.confirmar?.nao && !!j.erros?.motor_trocado, faltam.join(","));
    if (lang !== "pt") confere(`textos ${lang}: a marca de rascunho continua`, !!j._rascunho);
  }
}

console.log(`testar:p5-chat — ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  ✗", f);
process.exit(falhas.length ? 1 : 0);
