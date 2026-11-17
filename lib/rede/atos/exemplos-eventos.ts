// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ da frente 10F (série, organizações juntas, álbum e linha ao vivo) para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as funções
// de verdade (supabase/migracoes/20261116-alumia-o10-atos.sql) têm o mesmo contrato. Tudo na memória da aba; os nomes são
// ilustrativos (não são pessoas). Segue as regras do banco: nenhuma foto diz quem mandou; a fila só para quem modera; a linha em
// ordem de chegada. As "fotos" da prévia são mosaicos desenhados aqui (nada de imagem de fora). Sem "@/" de propósito.
import type { Post } from "../tipos";
import type { AlbumDoAto, Ato, FotoDoAlbum, MaisDoAto, OrgDoAto, SerieDoAto } from "../tipos-atos";
import { datasDaSerie, diaDoAto } from "./eventos";
import { pareceDadoPessoal } from "./quadros";

interface FotoGuardada extends FotoDoAlbum {
  ato: string;
}
interface SerieGuardada {
  serie: SerieDoAto;
  inicio: string;
}

const FAISCA: OrgDoAto = { handle: "coletivo_faisca", nome: "Coletivo Faísca", selo: true };
const DCE: OrgDoAto = { handle: "dce_livre", nome: "DCE Livre", selo: true };
const GREMIO: OrgDoAto = { handle: "gremio_zl", nome: "Grêmio da Zona Leste", selo: false };

const VOZES = [
  { codinome: "Mandacaru", handle: "mandacaru" },
  { codinome: "Ipê Roxo", handle: "ipe_roxo" },
  { codinome: "Carcará", handle: "carcara" },
  { codinome: "Jatobá", handle: "jatoba" },
];

/** Um post de exemplo da linha ao vivo (só os campos que a linha mostra; o resto no padrão). */
function postDeExemplo(id: string, ato: Ato, minutos: number, texto: string, voz: (typeof VOZES)[number], meu = false): Post {
  const criado = new Date(Date.parse(ato.inicio) + minutos * 60_000).toISOString();
  return {
    id,
    tipo: "post",
    titulo: null,
    texto,
    corpo: null,
    longo: false,
    comunidade: ato.comunidade?.slug ?? null,
    flair: null,
    publico: "membros",
    criado_em: criado,
    editado_em: null,
    fixado: false,
    travado: false,
    aceita: null,
    verificada: false,
    resposta_a: null,
    raiz: id,
    nivel: 0,
    aviso: "",
    cita: null,
    chamado: null,
    meu,
    retido: false,
    motivo: "",
    modero: false,
    autor: { id: null, codinome: voz.codinome, handle: voz.handle, perfil: true, equipe: false },
    respostas: 0,
    na_conversa: null,
    util: 0,
    util_eu: false,
    apoios: null,
    apoiei: false,
    salvei: false,
    vou: null,
    vou_eu: false,
    midia: [],
    citado: null,
    ato: ato.id,
  };
}

/**
 * A "foto" de exemplo: um mosaico de ladrilhos nas cores da Alumia, com uma faixa e um carimbo de rosto borrado, desenhado aqui
 * (data: SVG). Serve só para a prévia mostrar o álbum sem imagem de fora.
 */
export function fotoDeExemplo(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const cores = ["#0f0e0d", "#2a2522", "#e8321f", "#ffc21a", "#f3efe6", "#4a403a"];
  const lados: string[] = [];
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 12; x++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const c = y < 4 ? cores[(h >> 8) % 2] : cores[(h >> 8) % cores.length];
      lados.push(`<rect x="${x * 10}" y="${y * 10}" width="10" height="10" fill="${c}"/>`);
    }
  }
  const faixa = `<rect x="8" y="52" width="104" height="14" fill="#e8321f"/><rect x="8" y="52" width="104" height="2" fill="#ffc21a"/>`;
  const rostos = [20, 52, 84].map((x) => `<rect x="${x}" y="30" width="14" height="16" fill="#8a7f76"/><rect x="${x}" y="30" width="7" height="8" fill="#a39788"/><rect x="${x + 7}" y="38" width="7" height="8" fill="#6f655d"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" shape-rendering="crispEdges">${lados.join("")}${rostos}${faixa}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** As funções da 10F no dublê. `achar` é o do dublê dos atos (recusa ato desconhecido). */
export function dubleDosEventos(achar: (id: unknown) => { ato: Ato; confirmados: number }) {
  const series = new Map<string, SerieGuardada>();
  const coletivos = new Map<string, { org: OrgDoAto; aceito: boolean; minha: boolean }[]>();
  const fotos: FotoGuardada[] = [];
  const linhas = new Map<string, Post[]>();
  const semeados = new Set<string>();
  let n = 0;
  const novoId = (p: string) => `previa-${p}-${++n}`;

  const semear = (ato: Ato) => {
    if (semeados.has(ato.id)) return;
    semeados.add(ato.id);
    if (ato.meu) {
      // O ato que "você" organiza: um convite pendente, uma organização junto, fotos esperando a conferência.
      coletivos.set(ato.id, [{ org: DCE, aceito: true, minha: false }, { org: GREMIO, aceito: false, minha: false }]);
      fotos.push(
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "A faixa da ocupação na porta", minha: false, estado: "aprovada", criado_em: ato.inicio },
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "Vigília na madrugada", minha: false, estado: "pendente", criado_em: ato.inicio },
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "", minha: false, estado: "pendente", criado_em: ato.inicio },
      );
    } else {
      // O ato de outra organização: chamado junto com o Faísca, repete toda semana, com fotos aprovadas e linha ao vivo.
      coletivos.set(ato.id, [{ org: FAISCA, aceito: true, minha: false }]);
      const ate = new Date(Date.parse(ato.inicio) + 60 * 86_400_000).toISOString().slice(0, 10);
      const excecao = diaDoAto(new Date(Date.parse(ato.inicio) + 14 * 86_400_000).toISOString());
      series.set(ato.id, { inicio: ato.inicio, serie: { id: novoId("serie"), frequencia: "semanal", ate, excecoes: [excecao], encerrada: false, modelo: true, datas: [] } });
      fotos.push(
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "A faixa na escadaria da catedral", minha: false, estado: "aprovada", criado_em: ato.inicio },
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "Bateria puxando a caminhada", minha: false, estado: "aprovada", criado_em: ato.inicio },
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "", minha: true, estado: "pendente", criado_em: ato.inicio },
        { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: "Cartazes feitos na oficina do núcleo", minha: false, estado: "aprovada", criado_em: ato.inicio },
      );
      linhas.set(ato.id, [
        postDeExemplo(novoId("linha"), ato, -50, "Chegando pela saída da Rua Direita. Já tem bastante gente na escadaria.", VOZES[0]),
        postDeExemplo(novoId("linha"), ato, -32, "A bateria chegou! Faixa grande aberta na frente da catedral.", VOZES[1]),
        postDeExemplo(novoId("linha"), ato, -10, "Água e protetor na barraca do núcleo, perto da banca de jornal.", VOZES[2]),
        postDeExemplo(novoId("linha"), ato, 4, "Começou a fala da assembleia. Microfone aberto por ordem de inscrição.", VOZES[3]),
        postDeExemplo(novoId("linha"), ato, 21, "Caminhada saindo agora em direção ao Theatro Municipal.", VOZES[0]),
      ]);
    }
  };

  const serieJson = (ato: Ato): SerieDoAto | null => {
    const s = series.get(ato.id);
    if (!s) return null;
    const datas = datasDaSerie(s.inicio, s.serie, 6).map((d, i) => ({
      data: d.data,
      inicio: d.inicio,
      id: i === 0 ? ato.id : null,
      situacao: d.pulada ? ("pulada" as const) : i === 0 ? ato.situacao : i < 5 ? ("confirmado" as const) : ("prevista" as const),
      atual: i === 0,
    }));
    return { ...s.serie, datas };
  };

  const maisJson = (ato: Ato): MaisDoAto => {
    semear(ato);
    const lista = coletivos.get(ato.id) ?? [];
    const aberto = ato.situacao !== "cancelado";
    return {
      organiza: ato.meu,
      chamou: ato.meu,
      coletivos: lista.filter((c) => c.aceito).map((c) => c.org),
      convites: ato.meu ? lista.filter((c) => !c.aceito).map((c) => c.org) : [],
      meus_convites: [],
      minhas_orgs: lista.filter((c) => c.aceito && c.minha).map((c) => c.org),
      serie: serieJson(ato),
      pode_repetir: ato.meu && aberto && !series.has(ato.id),
      album: {
        aprovadas: fotos.filter((f) => f.ato === ato.id && f.estado === "aprovada").length,
        pendentes: ato.meu ? fotos.filter((f) => f.ato === ato.id && f.estado === "pendente").length : null,
        pode_enviar: aberto && (ato.vou_eu || ato.meu),
      },
      // Na prévia a linha fica aberta para mostrar a tela inteira (o banco abre de 2 h antes a 24 h depois do começo).
      linha: { aberta: aberto, pode_escrever: aberto, desde: new Date(Date.parse(ato.inicio) - 2 * 3_600_000).toISOString(), ate: new Date(Date.parse(ato.inicio) + 24 * 3_600_000).toISOString() },
    };
  };

  const albumJson = (ato: Ato): AlbumDoAto => {
    semear(ato);
    const daqui = fotos.filter((f) => f.ato === ato.id);
    const limpa = ({ ato: _ato, ...f }: FotoGuardada): FotoDoAlbum => (void _ato, f);
    return {
      organiza: ato.meu,
      pode_enviar: maisJson(ato).album.pode_enviar,
      fotos: daqui.filter((f) => f.estado === "aprovada" || f.minha).map(limpa),
      pendentes: ato.meu ? daqui.filter((f) => f.estado === "pendente").map(limpa) : [],
    };
  };

  const minhaOrg = (ato: Ato) => {
    if (!ato.meu) throw new Error("so_quem_organizou");
    return coletivos.get(ato.id) ?? [];
  };

  return {
    rede_ato_mais(a: { p_ato?: string }): MaisDoAto {
      return maisJson(achar(a.p_ato).ato);
    },
    rede_ato_serie_criar(a: { p_ato?: string; p?: { frequencia?: string; ate?: string; excecoes?: string[] } }): MaisDoAto {
      const { ato } = achar(a.p_ato);
      if (!ato.meu) throw new Error("so_quem_organizou");
      if (series.has(ato.id)) throw new Error("serie_existe");
      const p = a.p ?? {};
      if (!["semanal", "quinzenal", "mensal"].includes(p.frequencia ?? "")) throw new Error("invalido:frequencia");
      if (!p.ate || p.ate <= diaDoAto(ato.inicio)) throw new Error("invalido:ate");
      series.set(ato.id, { inicio: ato.inicio, serie: { id: novoId("serie"), frequencia: p.frequencia as SerieDoAto["frequencia"], ate: p.ate, excecoes: p.excecoes ?? [], encerrada: false, modelo: true, datas: [] } });
      return maisJson(ato);
    },
    rede_ato_serie_pular(a: { p_ato?: string; p_data?: string }): MaisDoAto {
      const { ato } = achar(a.p_ato);
      const s = series.get(ato.id);
      if (!s) throw new Error("nao_encontrado");
      if (!ato.meu) throw new Error("so_quem_organizou");
      if (a.p_data && !s.serie.excecoes.includes(a.p_data)) s.serie.excecoes = [...s.serie.excecoes, a.p_data].sort();
      return maisJson(ato);
    },
    rede_ato_serie_encerrar(a: { p_ato?: string }): MaisDoAto {
      const { ato } = achar(a.p_ato);
      const s = series.get(ato.id);
      if (!s) throw new Error("nao_encontrado");
      if (!ato.meu) throw new Error("so_quem_organizou");
      s.serie.encerrada = true;
      s.serie.ate = diaDoAto(ato.inicio);
      return maisJson(ato);
    },
    rede_ato_coletivo_convidar(a: { p_ato?: string; p_handle?: string }): MaisDoAto {
      const { ato } = achar(a.p_ato);
      const lista = minhaOrg(ato);
      const handle = (a.p_handle ?? "").replace(/^@/, "").trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error("nao_encontrado");
      if (lista.some((c) => c.org.handle === handle)) throw new Error("ja_convidada");
      lista.push({ org: { handle, nome: handle.replace(/_/g, " "), selo: false }, aceito: false, minha: false });
      coletivos.set(ato.id, lista);
      return maisJson(ato);
    },
    rede_ato_coletivo_responder(a: { p_ato?: string }): MaisDoAto {
      return maisJson(achar(a.p_ato).ato);
    },
    rede_ato_coletivo_tirar(a: { p_ato?: string; p_handle?: string }): MaisDoAto {
      const { ato } = achar(a.p_ato);
      coletivos.set(ato.id, minhaOrg(ato).filter((c) => c.org.handle !== a.p_handle));
      return maisJson(ato);
    },
    rede_ato_album(a: { p_ato?: string }): AlbumDoAto {
      return albumJson(achar(a.p_ato).ato);
    },
    rede_ato_album_caminho(a: { p_id?: string }): { bucket: string; caminho: string } {
      const f = fotos.find((x) => x.id === a.p_id);
      if (!f) throw new Error("nao_encontrado");
      return { bucket: "previa", caminho: f.id };
    },
    rede_ato_album_decidir(a: { p_id?: string; p_aprovar?: boolean }): AlbumDoAto {
      const f = fotos.find((x) => x.id === a.p_id);
      if (!f) throw new Error("nao_encontrado");
      const { ato } = achar(f.ato);
      if (!ato.meu) throw new Error("nao_encontrado");
      if (a.p_aprovar) f.estado = "aprovada";
      else fotos.splice(fotos.indexOf(f), 1);
      return albumJson(ato);
    },
    rede_ato_album_apagar(a: { p_id?: string }): AlbumDoAto {
      const f = fotos.find((x) => x.id === a.p_id && x.minha);
      if (!f) throw new Error("nao_encontrado");
      fotos.splice(fotos.indexOf(f), 1);
      return albumJson(achar(f.ato).ato);
    },
    /** Na prévia, "mandar" uma foto só guarda o registro (a imagem fica no aparelho, não vai a lugar nenhum). */
    rede_ato_album_previa_enviar(a: { p_ato?: string; p_legenda?: string }): FotoDoAlbum {
      const { ato } = achar(a.p_ato);
      if (pareceDadoPessoal(a.p_legenda ?? "")) throw new Error("dado_pessoal");
      const f: FotoGuardada = { id: novoId("foto"), ato: ato.id, largura: 1200, altura: 900, legenda: (a.p_legenda ?? "").slice(0, 140), minha: true, estado: ato.meu ? "aprovada" : "pendente", criado_em: new Date().toISOString() };
      fotos.push(f);
      return { ...f };
    },
    rede_ato_linha(a: { p_ato?: string; p_depois?: string | null }): { itens: Post[]; proximo: string | null } {
      const { ato } = achar(a.p_ato);
      semear(ato);
      const todos = [...(linhas.get(ato.id) ?? [])].sort((x, y) => x.criado_em.localeCompare(y.criado_em));
      const depois = a.p_depois ? todos.filter((p) => `${p.criado_em}|${p.id}` > (a.p_depois as string)) : todos;
      const ult = depois[depois.length - 1];
      return { itens: depois, proximo: ult ? `${ult.criado_em}|${ult.id}` : (a.p_depois ?? null) };
    },
    rede_ato_linha_publicar(a: { p_ato?: string; p_texto?: string }): Post {
      const { ato } = achar(a.p_ato);
      const t = (a.p_texto ?? "").trim();
      if (!t || t.length > 500) throw new Error("invalido:texto");
      if (pareceDadoPessoal(t)) throw new Error("dado_pessoal");
      const p = postDeExemplo(novoId("linha"), ato, 0, t, { codinome: "Faísca", handle: "faisca" }, true);
      p.criado_em = new Date(Math.max(Date.now(), ...(linhas.get(ato.id) ?? []).map((x) => Date.parse(x.criado_em) + 1000))).toISOString();
      linhas.set(ato.id, [...(linhas.get(ato.id) ?? []), p]);
      return p;
    },
    rede_ato_linha_tirar(a: { p_post?: string }): { ok: true } {
      for (const [id, l] of linhas) linhas.set(id, l.filter((p) => p.id !== a.p_post));
      return { ok: true };
    },
  };
}
