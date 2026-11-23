// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onde o aparelho fala com as caixas anônimas: o próprio site (como na R2) ou o SERVIDOR DO CHAT SEPARADO da onda R3 (item 3.1,
// nativo/servidor-chat, docs/rede/CHAT-SEPARADO.md). A troca é por configuração: NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR (vazio = o mesmo
// site, como hoje). O endereço também vai ao registro público de transparência (linha 'servidor-chat', "sc1:<endereço>", anotada só pelo
// dono do banco): o aparelho recusa um servidor de chat que não seja o ÚLTIMO anotado lá, então quem troca o endereço no site (ou no
// build) sem passar pelo registro não leva as conversas para outro lugar sem que o registro mostre.
//
// O servidor separado responde nas MESMAS rotas e com o MESMO JSON das rotas da R2, só sem o "/api/alumia" do começo:
//   /api/alumia/caixa/{lote,buscar,confirmar,trocar,apagar}  →  <endereço>/caixa/{lote,buscar,confirmar,trocar,apagar}
// Os passes continuam sendo EMITIDOS pelo site (com a sessão da conta); o servidor do chat os confere com a chave pública da semana.
// Sem "@/" de propósito.
import { usarDesvio } from "./vias";

/** As rotas das caixas que mudam de lugar quando o chat é separado. */
export type RotaDoChat = "caixa/lote" | "caixa/buscar" | "caixa/confirmar" | "caixa/trocar" | "caixa/apagar" | "cofre/ler" | "cofre/gravar";

const ENDERECO = /^https:\/\/[a-z0-9.-]+(:[0-9]{2,5})?(\/[A-Za-z0-9._~/-]*)?$/;

/** O endereço como o registro aceita: https, sem barra no fim, até 200 letras (a mesma regra de interno.rede_servidor_chat_registrar). */
export function enderecoValido(e: string): boolean {
  return e === "" || (e.length <= 200 && ENDERECO.test(e) && !e.endsWith("/"));
}

/**
 * O endereço do servidor do chat: "" = o mesmo site (o modo da R2); senão, o servidor separado. Lido da configuração do build
 * (NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR). Endereço torto na configuração vira "" (o chat fica no site: nunca vai a um lugar inesperado).
 */
export function enderecoDoChat(valor: string | undefined = process.env.NEXT_PUBLIC_ALUMIA_CHAT_SERVIDOR): string {
  const e = (valor ?? "").trim();
  return enderecoValido(e) ? e : "";
}

/** O caminho completo de uma rota das caixas no lugar certo (site ou servidor separado). */
export function caminhoDoChat(rota: RotaDoChat, endereco: string = enderecoDoChat()): string {
  if (!endereco) {
    // O cofre anônimo só existe no servidor separado; no site, a lista sincronizada continua em rede_cofres_da_conta (R2).
    if (rota.startsWith("cofre/")) throw new Error("cofre_so_no_servidor_do_chat");
    return `/api/alumia/${rota}`;
  }
  return `${endereco}/${rota}`;
}

/** O que a vista do registro guarda do servidor do chat (lib/rede/chat/transparencia.ts). */
export interface ServidorNaVista {
  endereco: string;
  seq: number;
}

/**
 * O endereço configurado é o último anotado no registro conferido por este aparelho? "" (o mesmo site) vale quando o registro não tem
 * linha nenhuma, ou quando a última linha é "sc1:" (o chat voltou para o site).
 */
export function servidorDoChatConfere(naVista: ServidorNaVista | undefined, endereco: string = enderecoDoChat()): boolean {
  if (!enderecoValido(endereco)) return false;
  if (!naVista) return endereco === "";
  return naVista.endereco === endereco;
}

/**
 * O adaptador do transporte das caixas (lib/rede/caixas/transporte.ts): com o chat separado, as chamadas a "/api/alumia/caixa/*" vão ao
 * servidor do chat ("<endereço>/caixa/*"); o resto (emitir passes, o diretório, a denúncia) continua no site. Assim o cliente das caixas
 * (lib/rede/caixas/cliente.ts) não muda: quem liga o modo separado chama `ligarServidorDoChat(vista.servidorChat)` (abaixo), que confere
 * o endereço no registro e põe este adaptador por cima do fetch de CADA via (direta, Tor e mixnet: lib/rede/caixas/vias.ts,
 * usarDesvio). `endereco` vazio devolve o fetch de sempre. O endereço já vem conferido de quem chama (enderecoDoChat valida; os testes
 * passam o do contêiner).
 */
export function fetchDoChat(endereco: string, base: typeof fetch = (...a) => globalThis.fetch(...a)): typeof fetch {
  const e = endereco.replace(/\/+$/, "");
  if (!e) return base;
  return (entrada, init) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const m = /^(?:https?:\/\/[^/]+)?\/api\/alumia\/caixa\/(lote|buscar|confirmar|trocar|apagar)$/.exec(url);
    if (!m) return base(entrada, init);
    // Para fora do site: nunca cookie, nunca referência de página (o transporte já manda assim; aqui fica garantido).
    return base(`${e}/caixa/${m[1]}`, { ...init, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
  };
}

/**
 * O desvio que RECUSA as rotas das caixas (as outras passam): quando o registro conferido diz que o chat está num servidor separado e
 * este aparelho está configurado para outro lugar (inclusive o próprio site). Antes, esse caso caía no site em silêncio: os apps (que
 * não tinham o endereço do servidor separado) depositariam no banco do site enquanto o site depositava no servidor do chat, e a
 * mensagem "entregue" nunca chegaria (auditoria interna da R3). Agora o erro aparece ("servidor_do_chat_fora").
 */
function recusarCaixas(daVia: typeof fetch): typeof fetch {
  return (entrada, init) => {
    const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (/^(?:https?:\/\/[^/]+)?\/api\/alumia\/caixa\//.test(url)) return Promise.reject(Object.assign(new TypeError("servidor_do_chat_fora"), { code: "servidor_do_chat_fora" }));
    return daVia(entrada, init);
  };
}

/**
 * Liga o modo separado neste aparelho: só se o endereço configurado é o último anotado no registro conferido (servidorDoChatConfere).
 * As rotas das caixas passam a ir ao servidor do chat em toda via (direta, Tor, mixnet). Sem servidor separado no registro e sem
 * endereço configurado: tudo no site, como na R2. Registro e configuração DIFERENTES (um aponta o servidor separado e o outro não, ou
 * os dois apontam lugares diferentes): as rotas das caixas são RECUSADAS (nem o site, nem o outro). Devolve se ficou separado.
 */
export function ligarServidorDoChat(naVista: ServidorNaVista | undefined, endereco: string = enderecoDoChat()): boolean {
  if (!servidorDoChatConfere(naVista, endereco)) {
    usarDesvio(naVista?.endereco || endereco ? recusarCaixas : null);
    return false;
  }
  if (!endereco) {
    usarDesvio(null);
    return false;
  }
  usarDesvio((daVia) => fetchDoChat(endereco, daVia));
  return true;
}
