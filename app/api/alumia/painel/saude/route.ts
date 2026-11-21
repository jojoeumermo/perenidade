// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A Saúde do painel da Alumia, a parte que só o servidor sabe: o que o banco consegue no serviço de contas
// (public.alumia_painel_servico_de_contas, chamada com a sessão de quem pediu; o banco decide se a pessoa tem o painel) e quais
// variáveis secretas do servidor estão postas (lib/rede/seguranca/variaveis.ts: o nome e "presente", "curta" ou "falta"; nunca o
// valor). POST com a sessão no Authorization. Quem não tem o painel recebe 404, igual a um endereço que não existe.
// P5 (A7): também as peças da federação (lib/rede/fediverso/saude.ts): o recurso, o endereço, o segredo no servidor e o que o banco
// guarda. Sem valor, sem tamanho, sem endereço.
import { deOutraOrigem, resposta } from "@/lib/rede/convites/servidor";
import { saudeDaFederacao, type FederacaoNoBanco } from "@/lib/rede/fediverso/saude";
import { banco, ErroDoBanco } from "@/lib/rede/fediverso/servidor";
import { rpcComToken } from "@/lib/rede/seguranca/servico-de-contas";
import { situacaoDasVariaveis } from "@/lib/rede/seguranca/variaveis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const naoExiste = () => resposta(null, 404);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return naoExiste();
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1];
  if (!token) return naoExiste();
  const r = await rpcComToken<Record<string, unknown>>("alumia_painel_servico_de_contas", {}, token);
  // Sem a resposta do banco (a pessoa não tem o painel, ou a migração da onda 14 não rodou), nada sai: quem tem o painel, o banco diz.
  if (!r.ok) return naoExiste();
  const doBanco = await rpcComToken<FederacaoNoBanco>("alumia_admin_federacao", {}, token);
  const federacao = await saudeDaFederacao(doBanco.ok ? doBanco.dado : null, async () => {
    try {
      // Só leitura: o estado de um domínio que não existe. Responde só se o SHA-256 do segredo confere.
      await banco("dominio_estado", { dominio: "saude.invalid" });
      return true;
    } catch (e) {
      if (e instanceof ErroDoBanco && /sem_permissao/.test(e.message)) return false;
      throw e;
    }
  });
  return resposta({ banco: r.dado, variaveis: situacaoDasVariaveis(), federacao });
}
