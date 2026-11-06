// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ator da instância Alumia (Application). Não posta nada e não segue ninguém: só assina as buscas de perfis remotos, porque há
// instâncias (as de "modo seguro") que pedem assinatura até para ler um perfil.
import { documentoDaInstancia } from "@/lib/rede/fediverso/documentos";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { chaveDaInstancia, fed, respostaAP } from "@/lib/rede/fediverso/servidor";

export const runtime = "nodejs";

export async function GET(pedido: Request) {
  const barrado = conferirTeto(pedido, "instancia");
  if (barrado) return barrado;
  const chave = await chaveDaInstancia().catch(() => null);
  if (!chave) return new Response("Service Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  return respostaAP(documentoDaInstancia(fed, chave.publica), 200, 3600);
}
