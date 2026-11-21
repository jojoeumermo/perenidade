// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O depósito do anexo cifrado do chat (Prompt 4, itens 137 e 138: áudio e vídeo curto). O aparelho cifra o arquivo antes de mandar
// (lib/rede/chat/anexo-cifrado.ts); aqui só passa o cifrado, sem sessão de conta e com um passe anônimo. O que a rota faz está em
// lib/rede/chat/anexo-servidor.ts (tratarAnexo); aqui ficam só as peças de verdade: o banco e o depósito "alumia-anexos" pela chave
// de serviço, a conferência do passe, o sorteio e a flag. Desligado ("alumia-p4-anexo-cifrado" fora no painel), a rota responde o
// mesmo 404 a qualquer pedido, antes de olhar o que veio (e o banco também recusa). Nenhum endereço de rede é lido nem guardado.
import { recursoLigado } from "@/lib/recursos-vivos";
import { tratarAnexo, type PecasDoAnexo } from "@/lib/rede/chat/anexo-servidor";
import { rpcDeServico } from "@/lib/rede/convites/servidor";
import { conferirPasse } from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const servico = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const objeto = (caminho: string) => `${url}/storage/v1/object/alumia-anexos/${caminho.split("/").map(encodeURIComponent).join("/")}`;

const pecas: PecasDoAnexo = {
  async rpc(funcao, argumentos) {
    const r = await rpcDeServico<never>(funcao, argumentos);
    return r.ok ? { ok: true, dado: r.dado } : { ok: false, codigo: r.codigo };
  },
  conferirPasse: (cabecalho) => conferirPasse(cabecalho),
  async guardar(caminho, bytes) {
    const chave = servico();
    if (!url || !chave) return false;
    try {
      const r = await fetch(objeto(caminho), {
        method: "POST",
        headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/octet-stream", "x-upsert": "false" },
        body: bytes as unknown as BodyInit,
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
      });
      return r.ok;
    } catch {
      return false;
    }
  },
  async ler(caminho) {
    const chave = servico();
    if (!url || !chave) return null;
    try {
      const r = await fetch(objeto(caminho), { headers: { apikey: chave, Authorization: `Bearer ${chave}` }, cache: "no-store", signal: AbortSignal.timeout(60_000) });
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    } catch {
      return null;
    }
  },
  async apagar(caminho) {
    const chave = servico();
    if (!url || !chave) return false;
    try {
      const r = await fetch(`${url}/storage/v1/object/alumia-anexos`, {
        method: "DELETE",
        headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [caminho] }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      return r.ok;
    } catch {
      return false;
    }
  },
  sortear: (n) => crypto.getRandomValues(new Uint8Array(n)),
  ligado: () => recursoLigado("alumia-p4-anexo-cifrado"),
};

export const POST = (pedido: Request) => tratarAnexo(pedido, pecas);
export const GET = (pedido: Request) => tratarAnexo(pedido, pecas);
export const DELETE = (pedido: Request) => tratarAnexo(pedido, pecas);
