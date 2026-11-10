// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dados de exemplo de gente de fora para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), coerentes com a arte
// (docs/plano-2026-11/alumia-pranchas): o post de "Tião do Morro" (tiao@mastodon.social) na linha e a resposta de
// "Entregador do Porto" (porto@mastodon.social) na conversa. Nenhuma imagem: nada aqui aponta para fora. Sem "@/" de propósito.
import type { CartaoDeFora, FioDeFora, LinhaDeFora, PerfilDeFora, SituacaoDeFora } from "./tipos";

const MINUTO = 60_000;
const quando = (agora: number, minutosAtras: number) => new Date(agora - minutosAtras * MINUTO).toISOString();

interface Molde {
  id: string;
  usuario: string;
  nome: string;
  texto: string;
  minutos: number;
  respostas?: number;
  resposta_a?: string | null;
  raiz?: string;
}

function cartao(m: Molde, agora: number): CartaoDeFora {
  const servidor = "mastodon.social";
  const handle = `${m.usuario}@${servidor}`;
  const id = `https://${servidor}/users/${m.usuario}/statuses/${m.id}`;
  return {
    id,
    origem: "fediverso",
    tipo: "post",
    titulo: null,
    texto: m.texto,
    html: `<p>${m.texto}</p>`,
    corpo: null,
    longo: false,
    comunidade: null,
    flair: null,
    publico: "internet",
    visibilidade: "publico",
    criado_em: quando(agora, m.minutos),
    editado_em: null,
    fixado: false,
    travado: false,
    aceita: null,
    verificada: false,
    resposta_a: m.resposta_a ?? null,
    raiz: m.raiz ?? id,
    nivel: 0,
    aviso: "",
    sensivel: false,
    cita: null,
    chamado: null,
    meu: false,
    retido: false,
    motivo: "",
    modero: false,
    autor: { id: null, codinome: m.nome, handle, perfil: false, equipe: false, remoto: true },
    ator_remoto: `https://${servidor}/users/${m.usuario}`,
    handle_remoto: handle,
    nome_remoto: m.nome,
    avatar: null,
    servidor,
    url: `https://${servidor}/@${m.usuario}/${m.id}`,
    respostas: m.respostas ?? 0,
    na_conversa: null,
    util: 0,
    util_eu: false,
    apoios: null,
    curti: false,
    impulsionei: false,
    apoiei: false,
    salvei: false,
    vou: null,
    vou_eu: false,
    midia: [],
    citado: null,
    post_local: null,
    impulsionado_por: null,
  };
}

const TIAO: Molde = {
  id: "113400000000000001",
  usuario: "tiao",
  nome: "Tião do Morro",
  texto:
    "A ocupação Esperança recebeu ordem de despejo para segunda. São 140 famílias. A Defensoria entrou com recurso hoje; precisamos de gente na porta às 6h, e de quem saiba filmar com o celular na horizontal.",
  minutos: 34,
  respostas: 27,
};
const ID_DO_TIAO = `https://mastodon.social/users/tiao/statuses/${TIAO.id}`;

/** O post de fora da linha da arte: Tião do Morro, tiao@mastodon.social. */
export function cartaoDeExemplo(agora: number = Date.now()): CartaoDeFora {
  return cartao(TIAO, agora);
}

/** A resposta de fora da conversa da arte: Entregador do Porto, porto@mastodon.social. */
export function respostaDeExemplo(agora: number = Date.now()): CartaoDeFora {
  return cartao(
    {
      id: "113400000000000002",
      usuario: "porto",
      nome: "Entregador do Porto",
      texto: "Aqui em Porto Alegre a gente montou uma cooperativa de entrega. Posso contar como foi, se ajudar.",
      minutos: 12,
      resposta_a: ID_DO_TIAO,
      raiz: ID_DO_TIAO,
    },
    agora,
  );
}

export function linhaDeExemplo(agora: number = Date.now()): LinhaDeFora {
  return { itens: [{ ...cartaoDeExemplo(agora), chave: ID_DO_TIAO }], proximo: null };
}

export function perfilDeExemplo(agora: number = Date.now()): PerfilDeFora {
  return {
    ator: "https://mastodon.social/users/tiao",
    handle: "tiao@mastodon.social",
    nome: "Tião do Morro",
    resumo: "Morador da Zona Leste. Moradia é direito. Falo de ocupação, mutirão e despejo.",
    url: "https://mastodon.social/@tiao",
    avatar: null,
    tipo: "Person",
    servidor: "mastodon.social",
    posts: [
      cartaoDeExemplo(agora),
      cartao({ id: "113400000000000003", usuario: "tiao", nome: "Tião do Morro", texto: "Mutirão de sábado: levantamos a cozinha coletiva em um dia. Quem tem panela grande sobrando?", minutos: 60 * 26, respostas: 4 }, agora),
    ],
    local: { seguindo: "sim", segue_voce: false, bloqueado: false, silenciado: false },
  };
}

export function fioDeExemplo(agora: number = Date.now()): FioDeFora {
  return { post: cartaoDeExemplo(agora), acima: [], respostas: [respostaDeExemplo(agora)] };
}

export function situacaoDeExemplo(): SituacaoDeFora {
  return { logado: true, ligado: true, pode: true, motivo: null, handle: "voce", desde: null, seguidores: 0, seguindo: 1, versao: 2, total: true, consentimento_versao: 2, descobrivel: false, pedir_fediverso: false };
}
