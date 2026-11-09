// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de entrada da Alumia no Fediverso. Nada é gravado antes de a assinatura HTTP conferir com a chave do ator que mandou
// (buscada na instância dele, nunca a que vem no corpo) e de o ator da atividade ser o dono da chave. Aceita só o necessário:
//   Follow (a uma pessoa daqui que ligou a federação) → grava o seguidor e responde Accept; Undo de Follow → apaga;
//   Accept / Reject de um Follow que alguém daqui mandou; Create / Update / Delete de Note de quem alguém daqui segue (só texto);
//   Delete do próprio ator (conta apagada lá) → esquece; Update do próprio ator → renova o cache. O resto: 202 e nada mais.
// Com o modo "fediverso-total" (desligado por padrão; PLANO-FEDIVERSO, F2), a caixa passa a aceitar de QUALQUER instância não
// bloqueada: nota com HTML limpo, mídia e visibilidade (entrada/nota.ts → nota_recebida, que guarda se alguém daqui segue o autor,
// se ela responde a algo daqui ou se menciona alguém daqui; direta/limitada nunca), Like/Announce/Undo (entrada/interacao.ts),
// Flag e Block (entrada/moderacao.ts) e atividade repassada por outra instância, conferida pela origem (entrada/repasse.ts).
// Instância bloqueada pela mediação: 403. Sem "@/". Só roda no servidor.
import { conferirAssinatura } from "./assinatura";
import { atorRemoto, banco, fed, gruposLigados, lerAtorRemoto, modoTotal } from "./servidor";
import { htmlParaTexto, textoCurto } from "./texto";
import { comunidadeLocal, dominio, handleLocal, idDe, lerNota, listaDeIds, TIPOS_DE_ATOR } from "./entrada/nota";
import { desfazerInteracao, desfazerPeloId, receberInteracao } from "./entrada/interacao";
import { receberBloqueio, receberDenuncia } from "./entrada/moderacao";
import { confirmarNaOrigem, conferirRepassador } from "./entrada/repasse";

export { handleLocal };

export interface ResultadoDaCaixa {
  status: number;
  motivo: string;
  /** Há entrega nova na fila (um Accept, por exemplo): vale cutucar a entrega já. */
  entregar?: boolean;
}

/**
 * De onde o pedido chegou: a caixa de uma pessoa, a compartilhada ou a de uma comunidade (Group, com "fediverso-grupos"). A rota
 * da comunidade só passa "comunidade" depois de o banco confirmar que ela existe e pode sair (app/api/fediverso/c/[slug]/inbox).
 */
export interface DestinoDaCaixa {
  comunidade?: string;
}

/** A nota é endereçada ao Group (o id dele em to, cc ou audience, como o Lemmy manda)? Só então ela é "da comunidade". */
export function enderecadaAoGrupo(nota: Record<string, unknown>, slug: string): boolean {
  return [...listaDeIds(nota.to), ...listaDeIds(nota.cc), ...listaDeIds(nota.audience)].some((id) => comunidadeLocal(id) === slug);
}

type Remoto = Awaited<ReturnType<typeof atorRemoto>>;

/** Recebe um pedido já lido (método, caminho, cabeçalhos e corpo) e decide. */
export async function receber(metodo: string, caminho: string, ler: (nome: string) => string | null, corpo: Uint8Array, destino: DestinoDaCaixa = {}): Promise<ResultadoDaCaixa> {
  let atividade: Record<string, unknown>;
  try {
    const j = JSON.parse(Buffer.from(corpo).toString("utf8")) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return { status: 400, motivo: "json" };
    atividade = j as Record<string, unknown>;
  } catch {
    return { status: 400, motivo: "json" };
  }
  const autor = idDe(atividade.actor);
  if (!autor || !/^https:\/\//.test(autor)) return { status: 400, motivo: "sem_ator" };
  if (await banco<boolean>("bloqueado", { url: autor }).catch(() => false)) return { status: 403, motivo: "instancia_bloqueada" };
  const total = modoTotal();

  // A assinatura: a chave vem do ator (cache de até 1 dia; se não confere, busca de novo, porque a chave pode ter mudado).
  const assinaturaLida = /keyId="([^"]+)"/.exec(ler("signature") ?? ler("authorization") ?? "");
  if (!assinaturaLida) return { status: 401, motivo: "sem_assinatura" };
  const chaveId = assinaturaLida[1];
  if (dominio(chaveId) !== dominio(autor)) {
    // Repasse (inbox forwarding): sem o modo total, recusa como sempre. Com ele, confere quem repassou e refaz a atividade só com
    // o que a origem confirma (entrada/repasse.ts): nada do corpo repassado é gravado sem a origem confirmar.
    if (!total) return { status: 401, motivo: "chave_de_outro_dominio" };
    const repasse = await conferirRepassador({ chaveId, metodo, caminho, ler, corpo });
    if (!repasse.ok) return { status: repasse.status, motivo: repasse.motivo };
    const confirmada = await confirmarNaOrigem(atividade, autor);
    if (!confirmada) return { status: 202, motivo: "repasse_nao_confirmado" };
    return decidirTotal(confirmada, autor, null, destino);
  }

  // Um Delete de quem foi apagado lá: a instância não serve mais o ator (410), então não há chave para conferir. Só esquecemos o
  // ator se a própria instância confirma que ele sumiu.
  let remoto = await atorRemoto(autor);
  if (!remoto && atividade.type === "Delete" && idDe(atividade.object) === autor) {
    return { status: 202, motivo: "ator_sem_chave" };
  }
  if (remoto && (remoto.chave_id !== chaveId || !remoto.chave_publica)) remoto = await atorRemoto(autor, { renovar: true });
  if (!remoto || !remoto.chave_publica || remoto.chave_id !== chaveId) return { status: 401, motivo: "chave_desconhecida" };
  let conferida = conferirAssinatura({ metodo, caminho, ler, corpo, chavePublica: remoto.chave_publica });
  if (!conferida.ok && conferida.motivo === "assinatura_invalida") {
    const renovado = await atorRemoto(autor, { renovar: true });
    if (renovado?.chave_publica && renovado.chave_id === chaveId) conferida = conferirAssinatura({ metodo, caminho, ler, corpo, chavePublica: renovado.chave_publica });
  }
  if (!conferida.ok) return { status: 401, motivo: conferida.motivo };

  if (total) return decidirTotal(atividade, autor, remoto, destino);

  const tipo = String(atividade.type ?? "");
  const objeto = atividade.object;
  const objetoTipo = objeto && typeof objeto === "object" ? String((objeto as { type?: unknown }).type ?? "") : "";

  switch (tipo) {
    case "Follow":
    case "Undo":
    case "Accept":
    case "Reject":
      return seguir(tipo, atividade, autor, remoto, destino);
    case "Create":
    case "Update": {
      if (tipo === "Update" && TIPOS_DE_ATOR.has(objetoTipo)) return atualizarAtor(objeto, autor);
      if (objetoTipo !== "Note" && objetoTipo !== "Article" && objetoTipo !== "Question") return { status: 202, motivo: "ignorado" };
      const nota = objeto as Record<string, unknown>;
      const id = idDe(nota);
      if (!id || dominio(id) !== dominio(autor) || idDe(nota.attributedTo) !== autor) return { status: 202, motivo: "nota_de_outro" };
      // Só posts públicos (endereçados a "Public"): nada de mensagem direta ou só para seguidores entra aqui.
      const para = [...(Array.isArray(nota.to) ? nota.to : [nota.to]), ...(Array.isArray(nota.cc) ? nota.cc : [nota.cc])].map(String);
      if (!para.some((x) => x === "https://www.w3.org/ns/activitystreams#Public" || x === "as:Public" || x === "Public")) return { status: 202, motivo: "nao_publico" };
      const texto = htmlParaTexto(typeof nota.content === "string" ? nota.content : "");
      if (!texto) return { status: 202, motivo: "vazio" };
      await banco("recebido", {
        id,
        ator: autor,
        url: typeof nota.url === "string" ? nota.url : idDe(nota.url),
        texto,
        aviso: textoCurto(nota.summary, 200),
        publicado: typeof nota.published === "string" ? nota.published : null,
      });
      return { status: 202, motivo: "recebido" };
    }
    case "Delete":
      return apagar(atividade, autor);
    default:
      return { status: 202, motivo: "ignorado" };
  }
}

/** Update do próprio ator: renova o cache. */
async function atualizarAtor(objeto: unknown, autor: string): Promise<ResultadoDaCaixa> {
  const novo = lerAtorRemoto(objeto as Record<string, unknown>, autor);
  if (novo) await atorRemoto(autor, { renovar: true });
  return { status: 202, motivo: "ator_atualizado" };
}

/** Delete do próprio ator (esquece) ou de uma nota dele (apaga a cópia guardada). */
async function apagar(atividade: Record<string, unknown>, autor: string): Promise<ResultadoDaCaixa> {
  const alvo = idDe(atividade.object);
  if (alvo === autor) {
    await banco("ator_apagado", { ator: autor });
    return { status: 202, motivo: "ator_apagado" };
  }
  if (alvo && dominio(alvo) === dominio(autor)) await banco("recebido_apagado", { id: alvo, ator: autor });
  return { status: 202, motivo: "apagado" };
}

/** Follow, Undo(Follow), Accept e Reject: o seguir de sempre (e, com "fediverso-grupos", seguir uma comunidade daqui). */
async function seguir(tipo: string, atividade: Record<string, unknown>, autor: string, remoto: Remoto, destino: DestinoDaCaixa): Promise<ResultadoDaCaixa> {
  const objeto = atividade.object;
  const objetoTipo = objeto && typeof objeto === "object" ? String((objeto as { type?: unknown }).type ?? "") : "";
  switch (tipo) {
    case "Follow": {
      const comunidade = gruposLigados() ? comunidadeLocal(idDe(objeto)) : null;
      if (comunidade && (!destino.comunidade || destino.comunidade === comunidade)) {
        if (!remoto?.inbox) return { status: 202, motivo: "sem_caixa" };
        const r = await banco<{ ok: boolean; motivo?: string }>("comunidade_seguidor", { slug: comunidade, ator: autor, inbox: remoto.inbox, compartilhada: remoto.inbox_compartilhada, pedido: idDe(atividade) ?? "", sim: true });
        return r.ok ? { status: 202, motivo: "seguidor_da_comunidade", entregar: true } : { status: 202, motivo: r.motivo ?? "recusado" };
      }
      const handle = handleLocal(idDe(objeto));
      if (!handle) return { status: 202, motivo: "alvo_desconhecido" };
      if (!remoto?.inbox) return { status: 202, motivo: "sem_caixa" };
      const r = await banco<{ ok: boolean; motivo?: string }>("seguidor", {
        handle,
        ator: autor,
        inbox: remoto.inbox,
        compartilhada: remoto.inbox_compartilhada,
        pedido: idDe(atividade) ?? "",
        sim: true,
      });
      return r.ok ? { status: 202, motivo: "seguidor", entregar: true } : { status: 202, motivo: r.motivo ?? "recusado" };
    }
    case "Undo": {
      if (objetoTipo !== "Follow") return { status: 202, motivo: "ignorado" };
      const dentro = (objeto as { object?: unknown }).object;
      const comunidade = gruposLigados() ? comunidadeLocal(idDe(dentro)) : null;
      if (comunidade) {
        await banco("comunidade_seguidor", { slug: comunidade, ator: autor, sim: false });
        return { status: 202, motivo: "deixou_de_seguir" };
      }
      const alvo = handleLocal(idDe(dentro));
      if (alvo) await banco("seguidor", { handle: alvo, ator: autor, sim: false });
      return { status: 202, motivo: "deixou_de_seguir" };
    }
    default: {
      const pedido = idDe(objeto) ?? "";
      if (!pedido.startsWith(`${fed.base}/`)) return { status: 202, motivo: "ignorado" };
      await banco("resposta_follow", { ator: autor, pedido, aceito: tipo === "Accept" });
      return { status: 202, motivo: tipo === "Accept" ? "aceito" : "recusado" };
    }
  }
}

/**
 * O modo "fediverso-total": tudo o que a caixa de sempre faz, mais nota de qualquer um (a nota_recebida decide se guarda), Like,
 * Announce, Undo deles, Flag e Block. `remoto` é nulo numa atividade repassada (já refeita pela origem: só Create/Update/Delete).
 */
async function decidirTotal(atividade: Record<string, unknown>, autor: string, remoto: Remoto, destino: DestinoDaCaixa): Promise<ResultadoDaCaixa> {
  const tipo = String(atividade.type ?? "");
  const objeto = atividade.object;
  const objetoTipo = objeto && typeof objeto === "object" ? String((objeto as { type?: unknown }).type ?? "") : "";
  if (!remoto && !["Create", "Update", "Delete"].includes(tipo)) return { status: 202, motivo: "repasse_ignorado" };
  switch (tipo) {
    case "Follow":
    case "Accept":
    case "Reject":
      return seguir(tipo, atividade, autor, remoto, destino);
    case "Undo": {
      if (objetoTipo === "Follow") return seguir(tipo, atividade, autor, remoto, destino);
      // Undo só com o id (alguns Pleroma/Akkoma mandam assim): o banco desfaz a curtida ou o impulso pela chave (atividade, ator).
      if (typeof objeto === "string") return desfazerPeloId(objeto, autor);
      if (!objeto || typeof objeto !== "object") return { status: 202, motivo: "ignorado" };
      if (objetoTipo === "Block") return receberBloqueio(objeto as Record<string, unknown>, autor, false);
      return desfazerInteracao(objeto as Record<string, unknown>, autor);
    }
    case "Like":
    case "EmojiReact":
    case "Announce":
      return receberInteracao(atividade, autor);
    case "Flag":
      return receberDenuncia(atividade, autor);
    case "Block":
      return receberBloqueio(atividade, autor, true);
    case "Create":
    case "Update": {
      if (tipo === "Update" && TIPOS_DE_ATOR.has(objetoTipo)) return atualizarAtor(objeto, autor);
      if (!objeto || typeof objeto !== "object") return { status: 202, motivo: "ignorado" };
      const lida = lerNota(objeto as Record<string, unknown>, autor, { seguidores: remoto?.seguidores ?? null });
      if (!lida.ok) return { status: 202, motivo: lida.motivo };
      // "comunidade" só quando a nota é endereçada ao Group daquela caixa: escolher a caixa não basta para entrar na comunidade.
      const daComunidade = destino.comunidade && enderecadaAoGrupo(objeto as Record<string, unknown>, destino.comunidade) ? destino.comunidade : null;
      const r = await banco<{ guardado: boolean; motivo?: string }>("nota_recebida", { ...lida.nota, ...(daComunidade ? { comunidade: daComunidade } : {}) });
      return { status: 202, motivo: r.guardado ? "recebido" : (r.motivo ?? "descartado") };
    }
    case "Delete":
      return apagar(atividade, autor);
    default:
      return { status: 202, motivo: "ignorado" };
  }
}
