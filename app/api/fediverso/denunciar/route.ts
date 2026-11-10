// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Denunciar um perfil ou post de FORA. Só no modo "fediverso-total" (desligado por padrão: 404). A denúncia vai SEMPRE para a
// mediação daqui (rede_fed_denunciar_remoto, contrato 3.2, roda COMO a pessoa, com teto por pessoa). Encaminhar à instância de lá é
// escolha da pessoa (`encaminhar`, desligado por padrão): aí sai uma Flag assinada pelo ATOR DA INSTÂNCIA (quem denunciou não
// aparece lá) com os alvos e o comentário, e nada mais. O comentário só sai do Brasil com essa escolha explícita (LGPD art. 33, VIII).
import { after } from "next/server";
import { processarFila } from "@/lib/rede/fediverso/entrega";
import { conferirTeto } from "@/lib/rede/fediverso/rotas";
import { modoTotal, semFederacao } from "@/lib/rede/fediverso/servidor";
import { chamarComoPessoa, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });

export async function POST(pedido: Request) {
  if (!modoTotal()) return semFederacao();
  const barrado = conferirTeto(pedido, "denunciar", 10);
  if (barrado) return barrado;
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { alvo?: unknown; categoria?: unknown; texto?: unknown; encaminhar?: unknown } | null;
  const alvo = typeof corpo?.alvo === "string" && /^https:\/\/[^\s<>"']{1,490}$/.test(corpo.alvo) ? corpo.alvo : null;
  if (!alvo) return resposta({ erro: "invalido:alvo" }, 400);
  const categoria = typeof corpo?.categoria === "string" && /^[a-z_]{2,30}$/.test(corpo.categoria) ? corpo.categoria : null;
  if (!categoria) return resposta({ erro: "invalido:categoria" }, 400);
  const texto = typeof corpo?.texto === "string" ? corpo.texto.trim().slice(0, 1000) : "";
  const encaminhar = corpo?.encaminhar === true;
  const r = await chamarComoPessoa<{ protocolo?: string; encaminhada?: boolean; ja?: boolean }>(token, "rede_fed_denunciar_remoto", { p_alvo: alvo, p_categoria: categoria, p_texto: texto, p_encaminhar: encaminhar });
  if (!r.ok) return resposta({ erro: r.codigo }, statusDoCodigo(r.codigo));
  // "encaminhada" é o que o banco FEZ (a Flag entrou na fila), não o que a tela pediu; "ja" = a pessoa já tinha denunciado isto.
  const encaminhada = r.dado?.encaminhada === true;
  const ja = r.dado?.ja === true;
  if (encaminhada && !ja) after(() => processarFila(10).then(() => undefined, () => undefined));
  return resposta({ ok: true, protocolo: r.dado?.protocolo ?? null, encaminhada, ja });
}
