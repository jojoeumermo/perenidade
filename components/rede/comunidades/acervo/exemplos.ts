// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ do acervo, só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): coleções, documentos e arquivos do núcleo, meses e exportação,
// na memória da aba. Nada sai do aparelho. Nomes inventados (codinomes), nenhuma pessoa real.
import { BackendError } from "@/lib/backend";
import { postDeExemplo, postsDeExemplo } from "@/lib/rede/conversa/exemplos";
import type { Post } from "@/lib/rede/tipos";
import type { ArquivoDoNucleo, Colecao, Doc, ListaDeColecoes, QuemEditaAWiki, VersaoDoDoc } from "./tipos";

const DIA = 86_400_000;
const agora = Date.now();
const quando = (dias: number) => new Date(agora - dias * DIA).toISOString();
const autor = (codinome: string, handle: string) => ({ id: null, codinome, handle, perfil: true, equipe: false });

const POSTS: Post[] = [
  ...postsDeExemplo("passe-livre-sp", agora),
  postDeExemplo({ id: "00000000-0000-4000-8000-00000000a0c1", texto: "Como ler a planilha da tarifa: a linha 12 é o custo por passageiro, a 14 é o subsídio. Sem as duas, a conta da prefeitura não fecha.", comunidade: "passe-livre-sp", autor: autor("Catraca Aberta", "catracaaberta"), criado_em: quando(9), respostas: 11 }, agora),
  postDeExemplo({ id: "00000000-0000-4000-8000-00000000a0c2", titulo: "Passo a passo do pedido de acesso à informação", texto: "Pedi pelo portal da transparência os contratos das empresas de ônibus. Deixo aqui o modelo do pedido e os prazos da lei.", comunidade: "passe-livre-sp", autor: autor("Lia Ponto Final", "liapontofinal"), criado_em: quando(23), respostas: 7 }, agora),
  postDeExemplo({ id: "00000000-0000-4000-8000-00000000a0c3", texto: "Linha do tempo das tarifas desde 2013, com as fontes oficiais de cada reajuste.", comunidade: "passe-livre-sp", autor: autor("Bruno Catraca", "brunocatraca"), criado_em: quando(41), respostas: 4 }, agora),
];
const postPor = (id: string) => POSTS.find((p) => p.id === id);

interface ColecaoNaMemoria {
  id: string;
  slug: string | null;
  handle: string | null;
  titulo: string;
  descricao: string;
  mudou_em: string;
  itens: { post: string; nota: string }[];
  sugestoes: string[];
}

let seq = 0;
const novoId = () => `00000000-0000-4000-8000-${String(0xa100 + ++seq).padStart(12, "0")}`;

const COLECOES: ColecaoNaMemoria[] = [
  {
    id: "00000000-0000-4000-8000-00000000c011",
    slug: "passe-livre-sp",
    handle: null,
    titulo: "Para entender a tarifa",
    descricao: "Comece por aqui: as contas, as fontes e o caminho do pedido de informação.",
    mudou_em: quando(2),
    itens: [
      { post: "00000000-0000-4000-8000-00000000a0c1", nota: "A leitura da planilha, linha por linha." },
      { post: "00000000-0000-4000-8000-00000000a0c2", nota: "" },
      { post: "00000000-0000-4000-8000-00000000a0c3", nota: "" },
    ],
    sugestoes: [POSTS[0]?.id ?? ""].filter(Boolean),
  },
  {
    id: "00000000-0000-4000-8000-00000000c012",
    slug: "passe-livre-sp",
    handle: null,
    titulo: "Prestação de contas dos mandatos",
    descricao: "Como votaram, com a fonte.",
    mudou_em: quando(12),
    itens: POSTS[1] ? [{ post: POSTS[1].id, nota: "" }] : [],
    sugestoes: [],
  },
];

const DOCS: { id: string; nucleo: string; versoes: { titulo: string; corpo: string; resumo: string; criado_em: string; editou: string }[] }[] = [
  {
    id: "00000000-0000-4000-8000-00000000d0c1",
    nucleo: "",
    versoes: [
      { titulo: "Pauta da assembleia de sábado", corpo: "1. Informes\n2. Ato do dia 20: trajeto e comissão de segurança", resumo: "primeira versão", criado_em: quando(3), editou: "Faísca" },
      { titulo: "Pauta da assembleia de sábado", corpo: "1. Informes\n2. Ato do dia 20: trajeto e comissão de segurança\n3. Finanças: prestação de contas da rifa", resumo: "finanças", criado_em: quando(1), editou: "Lia Ponto Final" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-00000000d0c2",
    nucleo: "",
    versoes: [{ titulo: "Contatos da assessoria jurídica popular", corpo: "Defensoria Pública: atendimento pelo site oficial.\nComissão de direitos humanos da OAB.", resumo: "", criado_em: quando(15), editou: "Faísca" }],
  },
];

const ARQUIVOS: ArquivoDoNucleo[] = [
  { id: "00000000-0000-4000-8000-00000000f0c1", nome: "Cartilha de direitos no ato.pdf", ext: "pdf", tamanho: 842_000, criado_em: quando(4), caminho: "x/1.pdf" },
  { id: "00000000-0000-4000-8000-00000000f0c2", nome: "Cartaz do ato do dia 20.png", ext: "png", tamanho: 1_930_000, criado_em: quando(6), caminho: "x/2.png" },
];

let quemEdita: QuemEditaAWiki = "membros";

function colecaoParaTela(k: ColecaoNaMemoria): Colecao {
  return {
    id: k.id,
    titulo: k.titulo,
    descricao: k.descricao,
    mudou_em: k.mudou_em,
    dono: k.slug ? { tipo: "comunidade", slug: k.slug, nome: "Passe Livre SP", cor: "" } : { tipo: "pessoa", handle: k.handle ?? "", nome: "Faísca" },
    pode_editar: true,
    itens: k.itens.flatMap((i) => {
      const post = postPor(i.post);
      return post ? [{ post, nota: i.nota, meu: false }] : [];
    }),
    sugestoes: k.sugestoes.flatMap((id) => postPor(id) ?? []),
  };
}

function docParaTela(d: (typeof DOCS)[number], versao: number | null, nucleo: string): Doc {
  const n = versao ?? d.versoes.length;
  const v = d.versoes[n - 1];
  if (!v) throw new BackendError("nao_encontrado");
  return { id: d.id, nucleo, titulo: v.titulo, corpo: v.corpo, versao: n, atual: d.versoes.length, editado_em: v.criado_em, resumo: v.resumo, editou: v.editou, media: true };
}

/** A resposta de mentira para cada função do acervo (a prévia não fala com banco nenhum). */
export async function duble<T>(funcao: string, a: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 60));
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const colecao = (id: string) => {
    const k = COLECOES.find((x) => x.id === id);
    if (!k) throw new BackendError("nao_encontrado");
    return k;
  };
  const doc = (id: string) => {
    const d = DOCS.find((x) => x.id === id);
    if (!d) throw new BackendError("nao_encontrado");
    return d;
  };
  const r = ((): unknown => {
    switch (funcao) {
      case "rede_acervo_colecoes": {
        const lista = COLECOES.filter((k) => (a.p_slug ? k.slug === a.p_slug : k.handle === String(a.p_handle ?? "").replace(/^@/, "")));
        const saida: ListaDeColecoes = {
          itens: lista.map((k) => ({ id: k.id, titulo: k.titulo, descricao: k.descricao, mudou_em: k.mudou_em, posts: k.itens.length, sugestoes: k.sugestoes.length })),
          pode_criar: true,
          pode_sugerir: Boolean(a.p_slug),
        };
        return saida;
      }
      case "rede_acervo_colecao":
        return colecaoParaTela(colecao(s("p_id")));
      case "rede_acervo_colecao_salvar": {
        if (a.p_id) {
          const k = colecao(s("p_id"));
          k.titulo = s("p_titulo");
          k.descricao = s("p_descricao");
          return { id: k.id, titulo: k.titulo, descricao: k.descricao };
        }
        const k: ColecaoNaMemoria = { id: novoId(), slug: s("p_slug") || null, handle: s("p_slug") ? null : "faisca", titulo: s("p_titulo"), descricao: s("p_descricao"), mudou_em: new Date().toISOString(), itens: [], sugestoes: [] };
        COLECOES.push(k);
        return { id: k.id, titulo: k.titulo, descricao: k.descricao };
      }
      case "rede_acervo_colecao_apagar":
        COLECOES.splice(COLECOES.indexOf(colecao(s("p_id"))), 1);
        return { apagada: true };
      case "rede_acervo_colecao_por": {
        const k = colecao(s("p_id"));
        if (!a.p_sim) {
          k.itens = k.itens.filter((i) => i.post !== a.p_post);
          return { na_colecao: false };
        }
        if (!postPor(s("p_post"))) throw new BackendError("nao_encontrado");
        if (!k.itens.some((i) => i.post === a.p_post)) k.itens.push({ post: s("p_post"), nota: s("p_nota") });
        k.sugestoes = k.sugestoes.filter((x) => x !== a.p_post);
        return { na_colecao: true };
      }
      case "rede_acervo_colecao_ordem": {
        const k = colecao(s("p_id"));
        const ordem = a.p_posts as string[];
        k.itens = ordem.flatMap((id) => k.itens.find((i) => i.post === id) ?? []);
        return { ordem };
      }
      case "rede_acervo_colecao_tirar_meu":
      case "rede_acervo_sugestao_descartar": {
        const k = colecao(s("p_id"));
        k.sugestoes = k.sugestoes.filter((x) => x !== a.p_post);
        if (funcao === "rede_acervo_colecao_tirar_meu") k.itens = k.itens.filter((i) => i.post !== a.p_post);
        return { na_colecao: false, descartada: true };
      }
      case "rede_acervo_sugerir": {
        const k = colecao(s("p_id"));
        if (!postPor(s("p_post"))) throw new BackendError("nao_encontrado");
        if (!k.sugestoes.includes(s("p_post"))) k.sugestoes.push(s("p_post"));
        return { sugerido: true };
      }
      case "rede_acervo_docs":
        return {
          itens: DOCS.map((d) => {
            const v = d.versoes[d.versoes.length - 1];
            return { id: d.id, titulo: v.titulo, versao: d.versoes.length, editado_em: v.criado_em, tamanho: v.corpo.length };
          }),
          media: true,
        };
      case "rede_acervo_doc":
        return docParaTela(doc(s("p_id")), typeof a.p_versao === "number" ? a.p_versao : null, "");
      case "rede_acervo_doc_salvar": {
        const v = { titulo: s("p_titulo"), corpo: s("p_corpo"), resumo: s("p_resumo"), criado_em: new Date().toISOString(), editou: "Faísca" };
        if (!a.p_id) {
          const d = { id: novoId(), nucleo: s("p_nucleo"), versoes: [v] };
          DOCS.unshift(d);
          return { id: d.id, versao: 1 };
        }
        const d = doc(s("p_id"));
        if (a.p_base !== d.versoes.length) throw new BackendError("conflito");
        d.versoes.push(v);
        return { id: d.id, versao: d.versoes.length };
      }
      case "rede_acervo_doc_historico": {
        const d = doc(s("p_id"));
        const versoes: VersaoDoDoc[] = d.versoes.map((v, i) => ({ versao: i + 1, criado_em: v.criado_em, resumo: v.resumo, tamanho: v.corpo.length, editou: v.editou })).reverse();
        return { media: true, versoes };
      }
      case "rede_acervo_doc_restaurar": {
        const d = doc(s("p_id"));
        const velha = d.versoes[Number(a.p_versao) - 1];
        if (!velha) throw new BackendError("nao_encontrado");
        d.versoes.push({ ...velha, resumo: `Volta à versão ${String(a.p_versao)}`, criado_em: new Date().toISOString() });
        return { id: d.id, versao: d.versoes.length };
      }
      case "rede_acervo_doc_apagar":
        DOCS.splice(DOCS.indexOf(doc(s("p_id"))), 1);
        return { apagado: true };
      case "rede_acervo_arquivos":
        return { itens: ARQUIVOS, usado: ARQUIVOS.reduce((n, x) => n + x.tamanho, 0), cota: 209_715_200, por_arquivo: 10_485_760, media: true };
      case "acervo_enviar": {
        const arquivo: ArquivoDoNucleo = { id: novoId(), nome: s("nome"), ext: (s("ext") || "pdf") as ArquivoDoNucleo["ext"], tamanho: Number(a.tamanho) || 0, criado_em: new Date().toISOString(), caminho: "x/novo" };
        ARQUIVOS.unshift(arquivo);
        return { arquivo, desfazer: "0".repeat(32) };
      }
      case "acervo_apagar": {
        const i = ARQUIVOS.findIndex((x) => x.id === a.id);
        if (i >= 0) ARQUIVOS.splice(i, 1);
        return undefined;
      }
      case "rede_acervo_meses": {
        const mes = (d: number) => new Date(agora - d * DIA).toISOString().slice(0, 7);
        return { comunidade: s("p_slug"), meses: [{ mes: mes(0), posts: 214 }, { mes: mes(31), posts: 188 }, { mes: mes(62), posts: 97 }, { mes: mes(93), posts: null }, { mes: mes(330), posts: 12 }] };
      }
      case "rede_acervo_mes":
        return { mes: s("p_mes"), itens: [...POSTS].reverse(), proximo: null };
      case "rede_acervo_exportar":
        return {
          comunidade: { slug: s("p_slug"), nome: "Passe Livre SP", descricao: "Tarifa zero já.", categoria: "lutas", tipo: "aberta", criada_em: quando(400) },
          regras: [{ numero: 1, titulo: "Codinome sempre", texto: "" }],
          wiki: [],
          colecoes: COLECOES.filter((k) => k.slug === a.p_slug).map((k) => ({ titulo: k.titulo, descricao: k.descricao, posts: k.itens.map((i) => i.post) })),
          exportado_em: new Date().toISOString(),
          regra: "",
          posts: POSTS.map((p) => ({ id: p.id, criado_em: p.criado_em, tipo: p.tipo, titulo: p.titulo, texto: p.texto, corpo: p.corpo, resposta_a: p.resposta_a, autor: p.autor.codinome })),
          proximo: null,
        };
      case "rede_alumia_buscar": {
        const q = s("p_q").replace(/^c:\S+\s*/, "").toLowerCase();
        return { itens: POSTS.filter((p) => !q || `${p.titulo ?? ""} ${p.texto}`.toLowerCase().includes(q)), proximo: null, fim_por_teto: false };
      }
      case "rede_acervo_wiki_regras":
        return { quem: quemEdita, modera: true, pode_desfazer: Boolean(a.p_pagina) };
      case "rede_acervo_wiki_quem":
        quemEdita = a.p_quem as QuemEditaAWiki;
        return { quem: quemEdita };
      case "rede_acervo_wiki_desfazer":
        return { pagina: s("p_pagina"), versao: 4 };
      default:
        throw new BackendError("sem_servico");
    }
  })();
  return r as T;
}
