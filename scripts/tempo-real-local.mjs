// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O canal de tempo real do serviço de contas, imitado para o banco de teste local (scripts/backend-local.mjs). Faz só o
// que o site usa: entrar num canal, mensagens "broadcast" para os outros do canal e presença (quem está na sala). Com ele,
// a sala das aulas ao vivo liga o vídeo entre duas abas na mesma máquina, sem o serviço de verdade. Escuta só em
// 127.0.0.1 (o servidor que o recebe já é local) e não guarda nada.
//
// O formato é o do cliente (@supabase/realtime-js, protocolo 2.0.0): mensagens de texto [join_ref, ref, tópico, evento,
// carga] e, para o broadcast enviado pelo cliente, um quadro binário (tipo 3) com os mesmos campos.
import crypto from "node:crypto";

const TIPO_BROADCAST_DO_CLIENTE = 3;

function lerBinario(buffer) {
  const visao = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (visao.getUint8(0) !== TIPO_BROADCAST_DO_CLIENTE) return null;
  const tamanhos = [1, 2, 3, 4, 5].map((i) => visao.getUint8(i));
  const codificacao = visao.getUint8(6);
  let pos = 7;
  const ler = (n) => {
    const texto = buffer.subarray(pos, pos + n).toString("utf8");
    pos += n;
    return texto;
  };
  const [joinRef, ref, topico, evento] = [ler(tamanhos[0]), ler(tamanhos[1]), ler(tamanhos[2]), ler(tamanhos[3])];
  ler(tamanhos[4]); // metadados
  const resto = buffer.subarray(pos);
  const carga = codificacao === 1 ? JSON.parse(resto.toString("utf8") || "{}") : {};
  return { joinRef, ref, topico, evento: "broadcast", carga: { type: "broadcast", event: evento, payload: carga } };
}

/** Liga o canal ao servidor HTTP do banco local, no caminho que o cliente usa (/realtime/v1/websocket). */
export async function ligarTempoReal(servidor) {
  let WebSocketServer;
  try {
    ({ WebSocketServer } = await import("ws"));
  } catch {
    console.log("[local] sem o pacote ws: o tempo real local fica desligado (as salas ao vivo não ligam o vídeo)");
    return;
  }
  const wss = new WebSocketServer({ noServer: true });
  /** tópico → Map(conexão → { joinRef, chave, metas }) */
  const canais = new Map();

  const mandar = (ws, joinRef, ref, topico, evento, carga) => {
    if (ws.readyState === 1) ws.send(JSON.stringify([joinRef, ref, topico, evento, carga]));
  };
  const estadoDaPresenca = (topico) => {
    const estado = {};
    for (const membro of canais.get(topico)?.values() ?? []) {
      if (!membro.meta) continue;
      (estado[membro.chave] ??= { metas: [] }).metas.push(membro.meta);
    }
    return estado;
  };
  const avisarPresenca = (topico, juntou, saiu) => {
    for (const [ws, membro] of canais.get(topico) ?? []) mandar(ws, membro.joinRef, null, topico, "presence_diff", { joins: juntou, leaves: saiu });
  };
  const sairDe = (ws, topico) => {
    const membros = canais.get(topico);
    const membro = membros?.get(ws);
    if (!membro) return;
    membros.delete(ws);
    if (membros.size === 0) canais.delete(topico);
    if (membro.meta) avisarPresenca(topico, {}, { [membro.chave]: { metas: [membro.meta] } });
  };

  wss.on("connection", (ws) => {
    const meus = new Set();
    ws.on("message", (dados, binario) => {
      let msg;
      try {
        if (binario) msg = lerBinario(Buffer.from(dados));
        else {
          const [joinRef, ref, topico, evento, carga] = JSON.parse(dados.toString("utf8"));
          msg = { joinRef, ref, topico, evento, carga };
        }
      } catch {
        return;
      }
      if (!msg) return;
      const { joinRef, ref, topico, evento, carga } = msg;
      if (topico === "phoenix" && evento === "heartbeat") return mandar(ws, null, ref, "phoenix", "phx_reply", { status: "ok", response: {} });
      if (evento === "phx_join") {
        const config = carga?.config ?? {};
        const chave = config.presence?.key || crypto.randomUUID();
        if (!canais.has(topico)) canais.set(topico, new Map());
        canais.get(topico).set(ws, { joinRef, chave, meta: null, self: Boolean(config.broadcast?.self) });
        meus.add(topico);
        mandar(ws, joinRef, ref, topico, "phx_reply", { status: "ok", response: { postgres_changes: [] } });
        // O estado da presença de quem já está, como o serviço manda logo depois de entrar.
        return mandar(ws, joinRef, null, topico, "presence_state", estadoDaPresenca(topico));
      }
      if (evento === "phx_leave") {
        sairDe(ws, topico);
        meus.delete(topico);
        return mandar(ws, joinRef, ref, topico, "phx_reply", { status: "ok", response: {} });
      }
      const membros = canais.get(topico);
      const eu = membros?.get(ws);
      if (!eu) return ref && mandar(ws, joinRef, ref, topico, "phx_reply", { status: "error", response: { reason: "não entrou no canal" } });
      if (evento === "broadcast") {
        for (const outro of membros.keys()) {
          if (outro === ws && !eu.self) continue;
          mandar(outro, null, null, topico, "broadcast", carga);
        }
        return ref && mandar(ws, joinRef, ref, topico, "phx_reply", { status: "ok", response: {} });
      }
      if (evento === "presence") {
        const anterior = eu.meta;
        if (carga?.event === "track") eu.meta = { ...(carga.payload ?? {}), phx_ref: crypto.randomBytes(6).toString("base64url") };
        else if (carga?.event === "untrack") eu.meta = null;
        avisarPresenca(topico, eu.meta ? { [eu.chave]: { metas: [eu.meta] } } : {}, anterior ? { [eu.chave]: { metas: [anterior] } } : {});
        return ref && mandar(ws, joinRef, ref, topico, "phx_reply", { status: "ok", response: {} });
      }
      // access_token e o resto: só confirma.
      if (ref) mandar(ws, joinRef, ref, topico, "phx_reply", { status: "ok", response: {} });
    });
    ws.on("close", () => {
      for (const topico of meus) sairDe(ws, topico);
    });
  });

  /** O envio pelo endereço HTTP (o cliente usa quando ainda não entrou no canal): entrega a todos os do tópico. */
  const difundir = (topico, evento, carga) => {
    for (const [ws] of canais.get(`realtime:${topico}`) ?? []) mandar(ws, null, null, `realtime:${topico}`, "broadcast", { type: "broadcast", event: evento, payload: carga });
  };

  servidor.on("upgrade", (req, socket, cabeca) => {
    if (!new URL(req.url, "http://127.0.0.1").pathname.startsWith("/realtime/v1/websocket")) return socket.destroy();
    wss.handleUpgrade(req, socket, cabeca, (ws) => wss.emit("connection", ws, req));
  });
  return { difundir };
}
