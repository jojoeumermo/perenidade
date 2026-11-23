// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ da conversa em grupo, só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): um grupo com quatro pessoas e mensagens, um convite
// recebido e as ações (criar, convidar, aceitar, recusar, mandar, apagar, quem está, código, tirar, sair), tudo na memória da aba.
// Nada sai do aparelho e nada é cifrado de verdade. Os nomes são os codinomes inventados da prévia do chat (lib/rede/chat-exemplos.ts);
// nenhuma pessoa real. Sem "@/" de propósito (roda no Node nos testes).
import type { ClienteDosGrupos, ConviteNaTela } from "./cliente";
import type { GrupoNaLista, MensagemDoGrupo, PessoaDoGrupo } from "./servico";

const MIN = 60_000;
const DIA = 86_400_000;
const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const espera = () => new Promise((r) => setTimeout(r, 80));

/** As pessoas da prévia que têm conversa a dois aberta comigo (só elas podem ser convidadas, como no chat de verdade). */
const COM_CONVERSA: Record<string, string> = { rosavermelha: "Rosa Vermelha", liaquilombo: "Lia Quilombo", nucleocohab2: "Núcleo Cohab 2", saradograjau: "Sara do Grajaú" };
const EU = "previa-identidade-eu";
const identidadeDe = (handle: string) => `previa-identidade-${handle}`;

interface GrupoDaPrevia {
  lista: GrupoNaLista;
  pessoas: PessoaDoGrupo[];
  mensagens: MensagemDoGrupo[];
  feitos: { codinome: string; quando: number }[];
}

export function dubleDosGrupos(agora = () => Date.now()): ClienteDosGrupos {
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((f) => f());
  const pessoa = (handle: string, mediacao = false): PessoaDoGrupo => ({ identidade: identidadeDe(handle), conta: `exemplo-${handle}`, codinome: handle, eu: false, mediacao, conferida: "confere" });
  const eu = (mediacao: boolean): PessoaDoGrupo => ({ identidade: EU, conta: "exemplo-eu", codinome: "faisca", eu: true, mediacao, conferida: "confere" });
  const t0 = agora();
  let seq = 0;
  const msg = (autor: string, minutos: number, texto: string, extra: Partial<MensagemDoGrupo> = {}): MensagemDoGrupo => ({
    id: `${autor}.exemplo-${++seq}`, autor, minha: autor === EU, quando: t0 - minutos * MIN, expira: t0 - minutos * MIN + 7 * DIA, texto, umaVez: false, ...extra,
  });
  const grupos = new Map<string, GrupoDaPrevia>();
  const contagem = (p: PessoaDoGrupo[]) => (p.length >= 3 ? p.length : null);
  const novo = (id: string, nome: string, pessoas: PessoaDoGrupo[], mensagens: MensagemDoGrupo[], naoLidas = 0) => {
    const mediacao = pessoas.some((p) => p.eu && p.mediacao);
    grupos.set(id, { lista: { id, nome, ultimaEm: mensagens.at(-1)?.quando ?? agora(), naoLidas, contagem: contagem(pessoas), souMediacao: mediacao, fora: null, suspeito: false }, pessoas, mensagens, feitos: [] });
  };
  novo("exemplo-grupo-leste", "Núcleo Zona Leste", [eu(true), pessoa("rosavermelha"), pessoa("liaquilombo"), pessoa("saradograjau")], [
    msg(identidadeDe("rosavermelha"), 180, "Gente, a roda de sábado mudou para as 15h."),
    msg(identidadeDe("liaquilombo"), 120, "Levo as faixas. Alguém leva água?"),
    msg(EU, 60, "Eu levo a água e os copos."),
    msg(identidadeDe("saradograjau"), 12, "Combinado. Até sábado!"),
  ], 1);
  let convites: ConviteNaTela[] = [{ g: "exemplo-convite-horta", nome: "Brigada da Horta", codinome: "liaquilombo", quando: t0 - 30 * MIN }];

  const exigir = (id: string) => {
    const g = grupos.get(id);
    if (!g || g.lista.fora) throw erro("grupo_fora");
    return g;
  };
  const tocar = (g: GrupoDaPrevia) => {
    g.lista.contagem = contagem(g.pessoas);
    g.lista.ultimaEm = g.mensagens.at(-1)?.quando ?? g.lista.ultimaEm;
    avisar();
  };

  return {
    async lista() {
      await espera();
      const vivas = (g: GrupoDaPrevia) => ({ ...g.lista });
      return { grupos: [...grupos.values()].map(vivas).sort((a, b) => b.ultimaEm - a.ultimaEm), convites: convites.map((c) => ({ ...c })), esperando: [] };
    },
    async criar(_conta, nome) {
      await espera();
      const n = nome.trim().replace(/\s+/g, " ");
      if (!n || [...n].length > 60) throw erro("nome_invalido");
      const id = `exemplo-grupo-${++seq}`;
      novo(id, n, [eu(true)], []);
      avisar();
      return id;
    },
    async renomear(_conta, id, nome) {
      await espera();
      const g = exigir(id);
      if (!g.lista.souMediacao) throw erro("sem_papel");
      g.lista.nome = nome.trim().replace(/\s+/g, " ");
      avisar();
    },
    async convidar(_conta, id, codinome) {
      await espera();
      const g = exigir(id);
      if (!g.lista.souMediacao) throw erro("sem_papel");
      const h = codinome.trim().replace(/^@+/, "").toLowerCase();
      if (!COM_CONVERSA[h]) throw erro("grupo_sem_conversa");
      if (g.pessoas.some((p) => p.codinome === h)) throw erro("grupo_ja_esta");
      g.feitos = [...g.feitos.filter((f) => f.codinome !== h), { codinome: h, quando: agora() }];
      avisar();
    },
    async convitesFeitos(_conta, id) {
      return [...(grupos.get(id)?.feitos ?? [])];
    },
    async responder(_conta, convite, aceitar) {
      await espera();
      const c = convites.find((x) => x.g === convite);
      if (!c) throw erro("nao_encontrado");
      convites = convites.filter((x) => x.g !== convite);
      if (aceitar) novo(`exemplo-grupo-${++seq}`, c.nome, [eu(false), pessoa(c.codinome, true), pessoa("nucleocohab2")], []);
      avisar();
    },
    async mensagens(_conta, id) {
      const t = agora();
      return (grupos.get(id)?.mensagens ?? []).filter((m) => m.expira > t).map((m) => ({ ...m }));
    },
    async mandarTexto(_conta, id, texto, opcoes) {
      await espera();
      const g = exigir(id);
      const c = texto.trim();
      if (!c || [...c].length > 2000) throw erro("texto_invalido");
      const q = agora();
      g.mensagens.push({ id: `${EU}.exemplo-${++seq}`, autor: EU, minha: true, quando: q, expira: q + opcoes.prazo * DIA, texto: c, umaVez: !!opcoes.umaVez });
      tocar(g);
    },
    async mandarAnexo() {
      throw erro("anexo_desligado");
    },
    abrirAnexo: async () => null,
    corpoDoAnexo: () => null,
    tirarAnexoDoDeposito: async () => undefined,
    async apagarMensagem(_conta, id, mensagem) {
      const g = grupos.get(id);
      if (!g) return;
      g.mensagens = g.mensagens.filter((m) => m.id !== mensagem);
      tocar(g);
    },
    async pessoas(_conta, id) {
      await espera();
      return exigir(id).pessoas.map((p) => ({ ...p }));
    },
    async codigo(_conta, p) {
      // Um código inventado (60 algarismos), fixo para cada pessoa: na prévia não há identidade de verdade.
      let n = 0;
      for (const ch of p.identidade) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
      let s = "";
      while (s.length < 60) {
        n = (n * 1103515245 + 12345) >>> 0;
        s += String(n % 100000).padStart(5, "0");
      }
      return s.slice(0, 60);
    },
    async tirar(_conta, id, identidade) {
      await espera();
      const g = exigir(id);
      if (!g.lista.souMediacao) throw erro("sem_papel");
      g.pessoas = g.pessoas.filter((p) => p.identidade !== identidade || p.eu);
      tocar(g);
    },
    async sair(_conta, id) {
      await espera();
      grupos.delete(id);
      avisar();
    },
    async esquecer(_conta, id) {
      grupos.delete(id);
      avisar();
    },
    async marcarLido(_conta, id) {
      const g = grupos.get(id);
      if (g?.lista.naoLidas) {
        g.lista.naoLidas = 0;
        avisar();
      }
    },
    aoMudar(fazer) {
      ouvintes.add(fazer);
      return () => void ouvintes.delete(fazer);
    },
  };
}
