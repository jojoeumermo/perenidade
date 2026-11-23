// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O transporte do chat a dois da R2 (a interface `Transporte` de ./servico.ts) montado sobre o cliente das caixas anônimas
// (lib/rede/caixas/cliente.ts, diretorio.ts e pedidos.ts). As chamadas de caixa, de pedido e de leitura do diretório vão SEM a sessão
// da conta (as rotas /api/alumia/* recusam sessão); só publicar no diretório e o arquivo cifrado da lista (public.rede_cofre_*) levam a
// sessão, porque são da própria conta.
//
// O que este adaptador acerta entre os dois contratos:
//   - criar e trocar recebem o RESUMO do passe de depósito (o passe cru pode ser de outra pessoa, que só entregou o resumo);
//   - reivindicar é por conta (uuid) aqui e por codinome na rota: o adaptador lembra o codinome de cada conta que leu no diretório
//     (reivindicar sempre vem depois de ler o diretório da pessoa);
//   - publicarConta leva o passe de leitura da caixa de pedidos, de que o banco guarda só o resumo;
//   - o arquivo cifrado da lista vai para public.rede_cofre_ler/gravar, com a sessão;
//   - onda R3 (3.3): cada depósito de verdade sai no próximo instante do ritmo, no lugar de um pacote de cobertura
//     (lib/rede/caixas/ritmo.ts), e todos os pedidos anônimos saem pela via atual (direta, Tor ou mixnet).
// Sem "@/" de propósito.
import * as cliente from "../../caixas/cliente";
import { enfileirarDeVerdade } from "../../caixas/ritmo";
import * as diretorio from "../../caixas/diretorio";
import { depositarPedido } from "../../caixas/pedidos";
import { transporte as transporteDasRotas } from "../../caixas/transporte";
import { paraBytea } from "../../caixas/base";
import type { DiretorioLido, Transporte } from "./servico";

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

/** O base64 padrão que o PostgREST devolve para bytea em JSON ("\x…" em hexadecimal) ou o base64 de um campo texto. */
function bytesDoBanco(v: unknown): Uint8Array | null {
  if (typeof v !== "string") return null;
  if (/^\\x[0-9a-f]*$/i.test(v)) {
    const hex = v.slice(2);
    const b = new Uint8Array(hex.length / 2);
    for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return b;
  }
  try {
    const bin = atob(v.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** O transporte do chat sobre as caixas anônimas. Um por aba (guarda só o codinome das contas lidas no diretório). */
export function transporteDasCaixas(): Transporte {
  const codinomeDe = new Map<string, string>();
  const rpc = <T>(funcao: string, argumentos: Record<string, unknown>) => transporteDasRotas().rpcComSessao<T>(funcao, argumentos);
  return {
    criarCaixa: (c) => cliente.criarPorResumo({ id: c.id, pdH: c.pdH, pl: c.pl, multi: false }),
    async depositar(c, envelope, franquia) {
      const r = await enfileirarDeVerdade(() => cliente.depositar(c, envelope, franquia ?? undefined));
      return { ok: r.ok };
    },
    buscar: (c, cursor) => cliente.buscar(c, cursor),
    confirmar: (c, ate) => cliente.confirmar(c, ate),
    trocar: (c, pdH, bloqueio) => cliente.trocarPorResumo(c, { pdH }, bloqueio),
    apagar: (c) => cliente.apagar(c),
    async lerDiretorio(codinome) {
      const d = await diretorio.lerDiretorio(codinome);
      if (!d) return null;
      codinomeDe.set(d.usuario, codinome);
      const lido: DiretorioLido = {
        usuario: d.usuario, identidade: d.identidade, pedidosXwing: d.pedidosXwing, pedidosAssinatura: d.pedidosAssinatura,
        pedidosCaixa: d.pedidosCaixa, pedidosPd: d.pedidosPd, aparelhos: d.aparelhos,
      };
      return lido;
    },
    async reivindicar(usuario) {
      const codinome = codinomeDe.get(usuario);
      if (!codinome) throw erro("nao_encontrado");
      return diretorio.reivindicar(codinome, "proteus");
    },
    depositarPedido: (codinome, envelope) => depositarPedido(codinome, envelope),
    publicarConta: (c) =>
      diretorio.publicarConta(
        { identidade: c.identidade, pedidosXwing: c.pedidosXwing, pedidosAssinatura: c.pedidosAssinatura, pedidosCaixa: c.pedidosCaixa, pedidosPd: c.pedidosPd, votoXwing: null, votoAssinatura: null },
        c.pedidosPl,
      ),
    publicarAparelho: (a) => diretorio.publicarAparelho(a),
    publicarPreChaves: (aparelho, lista) => diretorio.publicarPreChaves(aparelho, lista),
    tirarAparelho: (aparelho) => diretorio.tirarAparelho(aparelho),
    async lerCofre(tipo) {
      const r = await rpc<{ versao?: number; blob?: unknown } | null>("rede_cofre_ler", { p_tipo: tipo });
      if (!r || typeof r.versao !== "number") return null;
      const blob = bytesDoBanco(r.blob);
      return blob ? { versao: r.versao, blob } : null;
    },
    async gravarCofre(tipo, versao, blob) {
      try {
        const r = await rpc<{ versao?: number } | null>("rede_cofre_gravar", { p_tipo: tipo, p_versao: versao, p_blob: paraBytea(blob) });
        if (typeof r?.versao !== "number") throw erro("rede");
        return { versao: r.versao };
      } catch (e) {
        if (String((e as { code?: string; message?: string })?.code ?? (e as Error)?.message).includes("versao_ocupada")) return "versao_ocupada";
        throw e;
      }
    },
  };
}
