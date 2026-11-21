// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O navegador conhecido no servidor (P5, A4; a parte pura e o desenho estão em lib/sessao/aparelho.ts): lê o cookie, apresenta o
// resumo ao banco (public.alumia_aparelho_entrou, só a chave de serviço; supabase/migracoes/20261126-p5-entrada.sql) e devolve o
// Set-Cookie quando o identificador é novo ou o prazo dele se renova. Usado por /api/sessao/aparelho (sessão aberta no navegador: a ponte, o link
// do e-mail, a Escola, o site) e por /api/alumia/porta/entrar (sessão aberta aqui com a senha). Só no servidor.
import { navegadorDoPedido } from "../rede/seguranca/navegador";
import { rpcDeServico } from "../rede/convites/servidor";
import { dominioDoCookie, identificadorNovo, lerCookie, montarCookie, nomeDoCookie, resumoDoIdentificador } from "./aparelho";

export interface Reconhecimento {
  /** true: navegador já visto nesta conta (sem aviso); false: novo (avisou, se a conta está na Alumia); null: banco sem a função. */
  conhecido: boolean | null;
  setCookie: string | null;
}

/** O pedido veio por https (ou é produção, sempre atrás de https)? */
export function pedidoSeguro(pedido: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (pedido.headers.get("x-forwarded-proto") === "https") return true;
  try {
    return new URL(pedido.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function reconhecerNavegador(pedido: Request, usuario: string, sessao: string | null): Promise<Reconhecimento> {
  const seguro = pedidoSeguro(pedido);
  const cookies = pedido.headers.get("cookie");
  // Lê os dois nomes: quem passou de http para https (só em teste) não vira navegador novo.
  const atual = lerCookie(cookies, nomeDoCookie(seguro)) ?? lerCookie(cookies, nomeDoCookie(!seguro));
  const novo = identificadorNovo();
  const { navegador, sistema } = navegadorDoPedido(pedido.headers);
  const r = await rpcDeServico<{ conhecido: boolean; cookie: "novo" | "renovar" | null }>("alumia_aparelho_entrou", {
    p_usuario: usuario,
    p_sessao: sessao,
    p_hash: resumoDoIdentificador(atual),
    p_hash_novo: resumoDoIdentificador(novo),
    p_navegador: navegador,
    p_sistema: sistema,
  });
  if (!r.ok || !r.dado) return { conhecido: null, setCookie: null };
  // "novo": o navegador não tinha cookie (ou veio mexido) e passa a ter este. "renovar": o mesmo valor, com o prazo de novo.
  const valor = r.dado.cookie === "novo" ? novo : r.dado.cookie === "renovar" && resumoDoIdentificador(atual) ? atual : null;
  if (!valor) return { conhecido: r.dado.conhecido, setCookie: null };
  const host = pedido.headers.get("x-forwarded-host") ?? pedido.headers.get("host");
  const dominio = dominioDoCookie(host, process.env.NEXT_PUBLIC_SITE_URL);
  return { conhecido: r.dado.conhecido, setCookie: montarCookie(valor, { seguro, dominio }) };
}
