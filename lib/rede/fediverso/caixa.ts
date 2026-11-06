// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A caixa de entrada da Alumia no Fediverso. Nada é gravado antes de a assinatura HTTP conferir com a chave do ator que mandou
// (buscada na instância dele, nunca a que vem no corpo) e de o ator da atividade ser o dono da chave. Aceita só o necessário:
//   Follow (a uma pessoa daqui que ligou a federação) → grava o seguidor e responde Accept; Undo de Follow → apaga;
//   Accept / Reject de um Follow que alguém daqui mandou; Create / Update / Delete de Note de quem alguém daqui segue (só texto);
//   Delete do próprio ator (conta apagada lá) → esquece; Update do próprio ator → renova o cache. O resto: 202 e nada mais.
// Instância bloqueada pela mediação: 403. Sem "@/". Só roda no servidor.
import { conferirAssinatura } from "./assinatura";
import { HANDLE_FED } from "./enderecos";
import { atorRemoto, banco, fed, lerAtorRemoto } from "./servidor";
import { htmlParaTexto, textoCurto } from "./texto";

export interface ResultadoDaCaixa {
  status: number;
  motivo: string;
  /** Há entrega nova na fila (um Accept, por exemplo): vale cutucar a entrega já. */
  entregar?: boolean;
}

const idDe = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string") return (v as { id: string }).id;
  return null;
};
const dominio = (u: string) => {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
};

/** O @nome local de um endereço de ator daqui (https://alumia…/api/fediverso/u/<nome>), ou nulo. */
export function handleLocal(url: string | null): string | null {
  if (!url || !url.startsWith(`${fed.base}/api/fediverso/u/`)) return null;
  const h = url.slice(`${fed.base}/api/fediverso/u/`.length);
  return HANDLE_FED.test(h) ? h : null;
}

/** Recebe um pedido já lido (método, caminho, cabeçalhos e corpo) e decide. */
export async function receber(metodo: string, caminho: string, ler: (nome: string) => string | null, corpo: Uint8Array): Promise<ResultadoDaCaixa> {
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

  // A assinatura: a chave vem do ator (cache de até 1 dia; se não confere, busca de novo, porque a chave pode ter mudado).
  const assinaturaLida = /keyId="([^"]+)"/.exec(ler("signature") ?? ler("authorization") ?? "");
  if (!assinaturaLida) return { status: 401, motivo: "sem_assinatura" };
  const chaveId = assinaturaLida[1];
  if (dominio(chaveId) !== dominio(autor)) return { status: 401, motivo: "chave_de_outro_dominio" };

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

  const tipo = String(atividade.type ?? "");
  const objeto = atividade.object;
  const objetoTipo = objeto && typeof objeto === "object" ? String((objeto as { type?: unknown }).type ?? "") : "";

  switch (tipo) {
    case "Follow": {
      const handle = handleLocal(idDe(objeto));
      if (!handle) return { status: 202, motivo: "alvo_desconhecido" };
      if (!remoto.inbox) return { status: 202, motivo: "sem_caixa" };
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
      if (objetoTipo === "Follow") {
        const alvo = handleLocal(idDe((objeto as { object?: unknown }).object));
        if (alvo) await banco("seguidor", { handle: alvo, ator: autor, sim: false });
        return { status: 202, motivo: "deixou_de_seguir" };
      }
      return { status: 202, motivo: "ignorado" };
    }
    case "Accept":
    case "Reject": {
      const pedido = idDe(objeto) ?? "";
      if (!pedido.startsWith(`${fed.base}/`)) return { status: 202, motivo: "ignorado" };
      await banco("resposta_follow", { ator: autor, pedido, aceito: tipo === "Accept" });
      return { status: 202, motivo: tipo === "Accept" ? "aceito" : "recusado" };
    }
    case "Create":
    case "Update": {
      if (tipo === "Update" && ["Person", "Service", "Application", "Group", "Organization"].includes(objetoTipo)) {
        const novo = lerAtorRemoto(objeto as Record<string, unknown>, autor);
        if (novo) await atorRemoto(autor, { renovar: true });
        return { status: 202, motivo: "ator_atualizado" };
      }
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
    case "Delete": {
      const alvo = idDe(objeto);
      if (alvo === autor) {
        await banco("ator_apagado", { ator: autor });
        return { status: 202, motivo: "ator_apagado" };
      }
      if (alvo && dominio(alvo) === dominio(autor)) await banco("recebido_apagado", { id: alvo, ator: autor });
      return { status: 202, motivo: "apagado" };
    }
    default:
      return { status: 202, motivo: "ignorado" };
  }
}
