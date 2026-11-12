// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ do chat privado (rede_dm_*), só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): a lista de conversas, um pedido, uma
// conversa aberta com mensagens e as ações (enviar, apagar, prazo, bloquear, denunciar), tudo na memória da aba. Nada sai do
// aparelho e nada é cifrado de verdade: na prévia o "corpo" é o texto (lib/rede/chat-chaveiro.ts pula a cifra só com a prévia
// ligada). Os nomes são codinomes inventados das pranchas; nenhuma pessoa real. Sem "@/" de propósito (roda no Node nos testes).
import type { CategoriaDeDenuncia, ConversaDoChat, MensagemCifrada, PessoaDoChat, Prazo, QuemPode, SituacaoDoChat } from "./cliente-chat";

/** Quem "eu" sou na prévia (o mesmo codinome da prévia inteira, Faísca). */
export const EU_DA_PREVIA_NO_CHAT = "exemplo-eu";

const MIN = 60_000;
const DIA = 86_400_000;

interface Estado {
  quem_pode: QuemPode;
  prazo_dias: Prazo;
  conversas: ConversaDoChat[];
  mensagens: Record<string, MensagemCifrada[]>;
  /** Respostas que a outra pessoa "manda" depois da primeira mensagem (uma por conversa, para a prévia parecer viva). */
  respostas: Record<string, string>;
  seq: number;
}

const pessoa = (id: string, codinome: string, handle: string): PessoaDoChat => ({ id, codinome, handle, avatar: null });

function estadoInicial(agora: number): Estado {
  const conversa = (id: string, com: PessoaDoChat, minutos: number, extra: Partial<ConversaDoChat> = {}): ConversaDoChat => ({
    id,
    com,
    situacao: "aberta",
    pedi: false,
    versao: 1,
    prazo_dias: 7,
    ultima_em: new Date(agora - minutos * MIN).toISOString(),
    bloqueio: false,
    pode_escrever: true,
    nao_lidas: 0,
    ...extra,
  });
  const rosa = pessoa("exemplo-rosa", "Rosa Vermelha", "rosavermelha");
  const lia = pessoa("exemplo-lia", "Lia Quilombo", "liaquilombo");
  const cohab = pessoa("exemplo-cohab", "Núcleo Cohab 2", "nucleocohab2");
  const sara = pessoa("exemplo-sara", "Sara do Grajaú", "saradograjau");
  const msg = (conversa: string, autor: string, minutos: number, corpo: string, n: number): MensagemCifrada => ({
    id: `exemplo-msg-${conversa}-${n}`,
    autor,
    versao: 1,
    corpo,
    criado_em: new Date(agora - minutos * MIN).toISOString(),
    expira_em: new Date(agora - minutos * MIN + 7 * DIA).toISOString(),
  });
  const eu = EU_DA_PREVIA_NO_CHAT;
  return {
    quem_pode: "pedidos",
    prazo_dias: 7,
    seq: 0,
    conversas: [
      conversa("exemplo-dm-rosa", rosa, 4, { nao_lidas: 2 }),
      conversa("exemplo-dm-lia", lia, 95),
      conversa("exemplo-dm-cohab", cohab, 60 * 26, { prazo_dias: 1 }),
      conversa("exemplo-dm-sara", sara, 12, { situacao: "pedido", pedi: false, pode_escrever: false }),
    ],
    mensagens: {
      "exemplo-dm-rosa": [
        msg("exemplo-dm-rosa", eu, 42, "Oi, Rosa! Vi o chamado da panfletagem no RU. Precisa de gente para a saída B?", 1),
        msg("exemplo-dm-rosa", "exemplo-rosa", 30, "Oi, Faísca! Precisa sim. A gente se encontra às 10h30 na cantina, antes de abrir.", 2),
        msg("exemplo-dm-rosa", eu, 22, "Fechado. Levo os panfletos que sobraram da Itaquera.", 3),
        msg("exemplo-dm-rosa", "exemplo-rosa", 5, "Perfeito. Traz água também, o sol lá é forte.", 4),
        msg("exemplo-dm-rosa", "exemplo-rosa", 4, "E lembra: sem foto de rosto de ninguém no grupo, combinado?", 5),
      ],
      "exemplo-dm-lia": [
        msg("exemplo-dm-lia", "exemplo-lia", 120, "Mandei a conta do app na comunidade. Deu 38% em média.", 1),
        msg("exemplo-dm-lia", eu, 95, "Vi! Vou levar para a roda de sábado.", 2),
      ],
      "exemplo-dm-cohab": [msg("exemplo-dm-cohab", "exemplo-cohab", 60 * 26, "A reunião do núcleo mudou para quinta, 19h, no salão da associação.", 1)],
      "exemplo-dm-sara": [],
    },
    respostas: {
      "exemplo-dm-rosa": "Combinado! Até amanhã.",
      "exemplo-dm-lia": "Boa! Te vejo lá.",
      "exemplo-dm-cohab": "Anotado. Obrigado por avisar.",
    },
  };
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

/** As respostas do dublê às funções do chat. Recusa o que o banco recusaria (conversa desconhecida, escrever em bloqueada). */
export function criarDubleDoChat(agora: number = Date.now(), estado: Estado = estadoInicial(agora)) {
  const achar = (id: unknown) => {
    const c = estado.conversas.find((x) => x.id === id);
    if (!c) throw erro("dm_nao_encontrada");
    return c;
  };
  const situacao = (): SituacaoDoChat => ({
    eu: EU_DA_PREVIA_NO_CHAT,
    chave: { identidade: "previa-identidade-eu", publica: "previa-aparelho-eu", certificado: "previa", versao: 1 },
    quem_pode: estado.quem_pode,
    prazo_dias: estado.prazo_dias,
    pedidos: estado.conversas.filter((c) => c.situacao === "pedido" && !c.pedi).length,
    novas: estado.conversas.reduce((n, c) => n + c.nao_lidas, 0),
  });
  return {
    rede_dm_situacao: situacao,
    rede_dm_prefs(a: { p_quem_pode?: QuemPode; p_prazo_dias?: Prazo }) {
      if (a.p_quem_pode) estado.quem_pode = a.p_quem_pode;
      if (a.p_prazo_dias) estado.prazo_dias = a.p_prazo_dias;
      return { quem_pode: estado.quem_pode, prazo_dias: estado.prazo_dias };
    },
    rede_dm_chave_publicar() {
      return { versao: 1 };
    },
    rede_dm_abrir(a: { p_handle?: string }) {
      const handle = String(a.p_handle ?? "").replace(/^@/, "").toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw erro("dm_handle");
      const ja = estado.conversas.find((c) => c.com.handle === handle);
      if (ja) return ja;
      // Na prévia, a outra pessoa ainda não aceitou: a conversa fica como pedido enviado.
      const nova: ConversaDoChat = {
        id: `exemplo-dm-novo-${++estado.seq}`,
        com: pessoa(`exemplo-${handle}`, handle, handle),
        situacao: "pedido",
        pedi: true,
        versao: 1,
        prazo_dias: estado.prazo_dias,
        ultima_em: new Date().toISOString(),
        bloqueio: false,
        pode_escrever: false,
        nao_lidas: 0,
      };
      estado.conversas.unshift(nova);
      estado.mensagens[nova.id] = [];
      return nova;
    },
    /**
     * Na prévia, a carona leva a uma conversa de exemplo que já existe (aberta): a tela recarrega ao abrir a conversa e o
     * dublê começa de novo, então uma conversa criada aqui não estaria mais lá.
     */
    rede_dm_abrir_carona(a: { p_carona?: string }) {
      if (!String(a.p_carona ?? "")) throw erro("nao_encontrado");
      const ja = estado.conversas.find((c) => c.situacao === "aberta");
      if (!ja) throw erro("dm_fechada");
      return ja;
    },
    rede_dm_responder(a: { p_conversa?: string; p_aceitar?: boolean }) {
      const c = achar(a.p_conversa);
      if (!a.p_aceitar) {
        estado.conversas = estado.conversas.filter((x) => x.id !== c.id);
        return { recusado: true as const };
      }
      c.situacao = "aberta";
      c.pode_escrever = true;
      return c;
    },
    rede_dm_conversas() {
      return [...estado.conversas].sort((a, b) => b.ultima_em.localeCompare(a.ultima_em));
    },
    rede_dm_chaves_da_conversa() {
      return { versao: 1, versao_em: null, atual_ok: true, participantes: [], embrulhos: [] };
    },
    rede_dm_nova_versao() {
      return { versao: 1 };
    },
    rede_dm_enviar(a: { p_conversa?: string; p_corpo?: string }) {
      const c = achar(a.p_conversa);
      if (c.bloqueio || !c.pode_escrever) throw erro("dm_fechada");
      const corpo = String(a.p_corpo ?? "").slice(0, 2000);
      if (!corpo.trim()) throw erro("dm_vazia");
      const criado = new Date();
      const m: MensagemCifrada = {
        id: `exemplo-msg-${c.id}-n${++estado.seq}`,
        autor: EU_DA_PREVIA_NO_CHAT,
        versao: 1,
        corpo,
        criado_em: criado.toISOString(),
        expira_em: new Date(criado.getTime() + c.prazo_dias * DIA).toISOString(),
      };
      (estado.mensagens[c.id] ??= []).push(m);
      c.ultima_em = m.criado_em;
      // A outra pessoa responde uma vez, alguns segundos depois (a conversa busca de novo sozinha).
      const resposta = estado.respostas[c.id];
      if (resposta) {
        delete estado.respostas[c.id];
        setTimeout(() => {
          const quando = new Date();
          estado.mensagens[c.id]?.push({ id: `exemplo-msg-${c.id}-r${++estado.seq}`, autor: c.com.id, versao: 1, corpo: resposta, criado_em: quando.toISOString(), expira_em: new Date(quando.getTime() + c.prazo_dias * DIA).toISOString() });
          c.ultima_em = quando.toISOString();
        }, 3500);
      }
      return { id: m.id, criado_em: m.criado_em, expira_em: m.expira_em };
    },
    rede_dm_mensagens(a: { p_conversa?: string; p_antes?: string | null }) {
      const c = achar(a.p_conversa);
      c.nao_lidas = 0;
      const todas = estado.mensagens[c.id] ?? [];
      return a.p_antes ? todas.filter((m) => m.criado_em < (a.p_antes as string)) : todas;
    },
    rede_dm_apagar_mensagem(a: { p_id?: string }) {
      for (const lista of Object.values(estado.mensagens)) {
        const i = lista.findIndex((m) => m.id === a.p_id && m.autor === EU_DA_PREVIA_NO_CHAT);
        if (i >= 0) lista.splice(i, 1);
      }
      return { ok: true as const };
    },
    rede_dm_apagar(a: { p_conversa?: string }) {
      const c = achar(a.p_conversa);
      estado.conversas = estado.conversas.filter((x) => x.id !== c.id);
      delete estado.mensagens[c.id];
      return { ok: true as const };
    },
    rede_dm_prazo(a: { p_conversa?: string; p_dias?: Prazo }) {
      const c = achar(a.p_conversa);
      c.prazo_dias = a.p_dias === 1 || a.p_dias === 30 ? a.p_dias : 7;
      return { prazo_dias: c.prazo_dias };
    },
    rede_dm_denunciar(a: { p_conversa?: string; p_categoria?: CategoriaDeDenuncia; p_bloquear?: boolean }) {
      const c = achar(a.p_conversa);
      if (a.p_bloquear) c.bloqueio = true;
      return { protocolo: "PREVIA-0001", prioridade: a.p_categoria === "menores" || a.p_categoria === "autolesao" ? 1 : 3, bloqueado: !!a.p_bloquear };
    },
    rede_dm_apagar_tudo() {
      const n = estado.conversas.length;
      estado.conversas = [];
      estado.mensagens = {};
      return { conversas: n };
    },
    rede_bloquear(a: { p_usuario?: string; p_sim?: boolean }) {
      for (const c of estado.conversas) if (c.com.id === a.p_usuario) c.bloqueio = a.p_sim !== false;
      return { ok: true };
    },
  };
}
