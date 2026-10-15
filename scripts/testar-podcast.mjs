// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as regras do podcast no banco: quem pode o quê, as etapas, a aprovação, a lista de conferência, o rodízio
// do depósito, a votação de pautas, as perguntas. Uso: npm run testar:podcast
import { criarBanco } from "./banco-local.mjs";

const banco = await criarBanco();
const { rpc, dono, criarUsuario } = banco;
let certos = 0;
const falhas = [];

async function espera(nome, promessa, conferir) {
  try {
    const valor = await promessa();
    if (conferir && !conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
    return valor;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
    return null;
  }
}
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro.message}"`);
  }
}

const anon = { papel: "anon" };
const como = (sub) => ({ papel: "authenticated", sub });
const ids = {};
const nomes = { coord: "Jonathan", jornal: "Joana Jornalista", editor: "Edu Editor", sup: "Sara Supervisora", designer: "Davi Designer", med: "Mauro Mediador", leitora: "Lia Leitora" };
for (const chave of Object.keys(nomes)) ids[chave] = await criarUsuario(`${chave}@teste.local`, nomes[chave]);
for (const chave of Object.keys(nomes)) {
  await rpc(como(ids[chave]), "eu");
  await rpc(como(ids[chave]), "perfil_salvar", { p_nome: nomes[chave], p_bio: "" });
}
await dono("select public.promover_coordenacao('coord@teste.local')");
await dono("update interno.configuracoes set valor = valor || '{\"exigir_2fa\": false}'::jsonb where chave = 'seguranca'");
const coord = como(ids.coord);
for (const [quem, papel] of [["jornal", "jornalismo"], ["editor", "jornalismo"], ["designer", "design"], ["med", "mediacao"]]) {
  await rpc(coord, "papel_conceder", { p_usuario: ids[quem], p_papel: papel, p_disciplina: null });
}
const jornal = como(ids.jornal);
const editor = como(ids.editor);
const sup = como(ids.sup);
const designer = como(ids.designer);
const med = como(ids.med);
const leitora = como(ids.leitora);

// ── Instalação ──
await espera("instalar de novo não quebra o podcast", () => banco.instalarDeNovo());
await espera("tabelas do podcast fora do alcance da API", () => dono("select count(*)::int as n from information_schema.role_table_grants where table_schema = 'interno' and table_name like 'podcast%' and grantee in ('anon', 'authenticated', 'PUBLIC')"), (r) => r.rows[0].n === 0);
await recusa("função interna do podcast não é chamável de fora", () => banco.exclusivo(async () => { await banco.pg.exec("set role anon"); try { return await banco.pg.query("select interno.podcast_rodizio()"); } finally { await banco.pg.exec("reset role"); } }), "permission denied");

// ── Quem entra ──
await recusa("quem não é da equipe não abre o podcast", () => rpc(leitora, "podcast_painel"), "sem_permissao");
await recusa("anônimo não abre o podcast", () => rpc(anon, "podcast_painel"), "entre_primeiro");
await espera("jornalismo abre com produção e edição", () => rpc(jornal, "podcast_painel"), (r) => r.eu.producao && r.eu.edicao && !r.eu.supervisao);
await espera("mediação lê e comenta, mas não produz", () => rpc(med, "podcast_painel"), (r) => r.eu.revisor && !r.eu.producao && !r.eu.time);
await espera("design abre só os pedidos de arte", () => rpc(designer, "podcast_painel"), (r) => r.eu.design && !r.eu.revisor && r.episodios.length === 0);
await recusa("só a coordenação separa tarefas", () => rpc(jornal, "podcast_funcoes_definir", { p_usuario: ids.editor, p_funcoes: ["edicao"] }), "sem_permissao");
await espera("coordenação deixa o editor só com a edição", () => rpc(coord, "podcast_funcoes_definir", { p_usuario: ids.editor, p_funcoes: ["edicao"] }));
await espera("coordenação nomeia uma supervisora de fora do jornalismo", () => rpc(coord, "podcast_funcoes_definir", { p_usuario: ids.sup, p_funcoes: ["supervisao"] }));
await espera("a supervisora entra no podcast", () => rpc(sup, "podcast_painel"), (r) => r.eu.supervisao && !r.eu.producao);
await recusa("edição não cria episódio", () => rpc(editor, "podcast_salvar", { p_id: null, p: { titulo: "Não pode" } }), "sem_permissao");

// ── Episódio ──
const novo = await espera("jornalismo cria um episódio", () => rpc(jornal, "podcast_salvar", { p_id: null, p: { titulo: "A Comuna de Paris em 72 dias", temas: ["historia"], disciplina: "historia" } }), (r) => r.id && r.versao >= 1);
const ep = novo?.id;
await recusa("tema fora da lista", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { temas: ["futebol"] } }), "invalido:temas");
await recusa("capítulo sem tempo", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { capitulos: [{ t: "abc", titulo: "Abertura" }] } }), "invalido:capitulos");
await recusa("sala precisa ser https", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { sala: "http://meet.example.org/x" } }), "invalido:sala");
await recusa("legenda que não é WebVTT", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { legendas: "1\n00:00:01,000 --> 00:00:02,000\noi" } }), "invalido:legendas");
const salvo = await espera("jornalismo preenche a pauta e o roteiro", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: {
  resumo: "Os 72 dias em que o povo de Paris governou a cidade, e o que ficou para nós.",
  roteiro: "## Abertura\nVinheta.\n\n## Bloco 1\nO cerco de Paris.", pauta: "Contexto, decretos, a Semana Sangrenta.", duracao_prevista: "35",
  capitulos: [{ t: 95, titulo: "O cerco" }, { t: 0, titulo: "Abertura" }], gravacao_em: "2026-10-20",
  obras: [{ id: "a-guerra-civil-na-franca", titulo: "A guerra civil na França", autor: "Karl Marx", licenca: "Domínio público", fonte: "marxists.org" }],
} }), (r) => r.versao > novo.versao);
await espera("capítulos ficam em ordem de tempo", () => rpc(jornal, "podcast_ver", { p_id: ep }), (r) => r.capitulos[0].titulo === "Abertura" && r.duracao_prevista === 35);
await recusa("edição não muda o título", () => rpc(editor, "podcast_salvar", { p_id: ep, p: { titulo: "Outro título" } }), "sem_permissao");
await espera("edição mexe na transcrição e na conferência", () => rpc(editor, "podcast_salvar", { p_id: ep, p: { transcricao: "Transcrição. ".repeat(30), checklist: { volume: true, ruido: true, fontes: true, trilhas: true, intruso: true } } }), (r) => !r.pendencias.includes("transcricao"));
await recusa("salvar por cima de alteração de outra pessoa", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { resumo: "Resumo antigo que chegou atrasado demais." }, p_versao: salvo?.versao }), "mudou_enquanto_editava");

// ── Convidado ──
const convidado = await espera("ficha do convidado", () => rpc(jornal, "podcast_convidado_salvar", { p_id: null, p: { nome: "Maria Historiadora", contato: "maria@exemplo.org", minibio: "Professora de história." } }), (r) => r.id);
await recusa("autorização sem termo não vale", () => rpc(jornal, "podcast_convidado_salvar", { p_id: convidado?.id, p: { autoriza_voz: true } }), "falta_termo_convidado");
await espera("convidado entra no episódio", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { convidados: [convidado?.id] } }), (r) => r.pendencias.includes("convidados"));
await espera("mediação não vê o contato do convidado", () => rpc(med, "podcast_ver", { p_id: ep }), (r) => r.convidados_dados[0].contato === "");
const link = await espera("link do convidado", () => rpc(jornal, "podcast_convidado_link", { p_id: convidado?.id }), (r) => /^[0-9a-f]{64}$/.test(r.token));
await espera("o convidado vê o termo pelo link, sem conta", () => rpc(anon, "podcast_convidado_ver", { p_token: link?.token }), (r) => r.nome === "Maria Historiadora" && !r.aceito);
await recusa("aceite sem a voz não vale", () => rpc(anon, "podcast_convidado_aceitar", { p_token: link?.token, p_nome: "Maria da Silva", p_voz: false, p_imagem: false }), "invalido:voz");
await espera("o convidado aceita", () => rpc(anon, "podcast_convidado_aceitar", { p_token: link?.token, p_nome: "Maria da Silva", p_voz: true, p_imagem: true }));
await recusa("link inventado não abre", () => rpc(anon, "podcast_convidado_ver", { p_token: "0".repeat(64) }), "nao_encontrado");

// ── Arquivos ──
const final = await espera("anota a versão final no depósito público", () => rpc(editor, "podcast_arquivo_registrar", { p_episodio: ep, p: { tipo: "final", deposito: "podcast", caminho: `ep/${ep}/final-a1b2c3d4.mp3`, nome: "comuna-final.mp3", bytes: 24000000, mime: "audio/mpeg" } }), (r) => r.id);
await recusa("versão bruta não vai para o depósito público", () => rpc(editor, "podcast_arquivo_registrar", { p_episodio: ep, p: { tipo: "bruto", deposito: "podcast", caminho: `ep/${ep}/bruto-a1b2c3d4.wav`, nome: "bruto.wav" } }), "invalido:deposito");
await recusa("caminho de outro episódio", () => rpc(editor, "podcast_arquivo_registrar", { p_episodio: ep, p: { tipo: "bruto", deposito: "podcast-producao", caminho: "ep/00000000-0000-0000-0000-000000000000/bruto-a1b2c3d4.wav", nome: "bruto.wav" } }), "invalido:caminho");
await espera("versão bruta grande entra como link", () => rpc(jornal, "podcast_arquivo_registrar", { p_episodio: ep, p: { tipo: "bruto", link: "https://archive.org/details/comuna-bruto", nome: "Bruto no Internet Archive" } }));
await recusa("forma de onda inválida", () => rpc(editor, "podcast_audio_definir", { p_episodio: ep, p_arquivo: final?.id, p_duracao: 2100, p_picos: [10, "x"] }), "invalido:picos");
await espera("define o áudio que vai ao ar", () => rpc(editor, "podcast_audio_definir", { p_episodio: ep, p_arquivo: final?.id, p_duracao: 2100, p_picos: [0, 12.4, 55, 100] }), (r) => r.audio_guardado && r.duracao === 2100);
await recusa("o design não põe áudio", () => rpc(designer, "podcast_audio_definir", { p_episodio: ep, p_arquivo: final?.id, p_duracao: 2100, p_picos: [] }), "sem_permissao");
await espera("pedido de arte ao design", () => rpc(jornal, "podcast_design_pedir", { p_episodio: ep, p_texto: "Capa com a barricada e o número do episódio." }));
await espera("o design vê o pedido e o episódio", () => rpc(designer, "podcast_painel"), (r) => r.episodios.length === 1 && r.contagens.pedidos === 1);
await recusa("capa fora da pasta de capas", () => rpc(designer, "podcast_capa_definir", { p_episodio: ep, p_capa: `ep/${ep}/capa.jpg`, p_capa_mini: "capas/x/mini-12345678.jpg" }), "invalido:capa");
await espera("o design põe a capa", () => rpc(designer, "podcast_capa_definir", { p_episodio: ep, p_capa: `capas/${ep}/capa-12345678.jpg`, p_capa_mini: `capas/${ep}/mini-12345678.jpg` }), (r) => r.capa !== "");

// ── Comentários com tempo ──
const comentario = await espera("mediação pede ajuste aos 12:40", () => rpc(med, "podcast_comentar", { p_episodio: ep, p_texto: "Cortar a respiração longa.", p_tempo: 760 }), (r) => r.id);
await recusa("leitora não comenta", () => rpc(leitora, "podcast_comentar", { p_episodio: ep, p_texto: "Oi" }), "sem_permissao");
await espera("quem cuida do episódio vê o comentário na contagem", () => rpc(jornal, "podcast_contagem"), (n) => n >= 1);
await espera("resolve o comentário", () => rpc(jornal, "podcast_comentario_resolver", { p_id: comentario?.id, p_resolvido: true }));

// ── Aprovação ──
await espera("notas do episódio", () => rpc(jornal, "podcast_salvar", { p_id: ep, p: { notas: "Notas do episódio com as fontes, as obras citadas e os capítulos para quem quer estudar mais." } }));
await recusa("publicar sem aprovação", () => rpc(jornal, "podcast_publicar", { p_id: ep }), "lista_incompleta");
await espera("envia para aprovação", () => rpc(jornal, "podcast_etapa", { p_id: ep, p_status: "revisao" }), (r) => r.status === "revisao");
await espera("a supervisão vê o que espera por ela", () => rpc(sup, "podcast_contagem"), (n) => n === 1);
await recusa("jornalismo não aprova", () => rpc(jornal, "podcast_aprovar", { p_id: ep, p_aprovar: true }), "sem_permissao");
await recusa("devolver sem dizer o quê", () => rpc(sup, "podcast_aprovar", { p_id: ep, p_aprovar: false, p_nota: "" }), "invalido:nota");
await espera("a supervisão devolve com pedido de ajuste", () => rpc(sup, "podcast_aprovar", { p_id: ep, p_aprovar: false, p_nota: "Falta citar a fonte do número de mortos." }), (r) => r.status === "edicao" && r.comentarios === 1);
await espera("reenvia", () => rpc(jornal, "podcast_etapa", { p_id: ep, p_status: "revisao" }));
await espera("a supervisão aprova", () => rpc(sup, "podcast_aprovar", { p_id: ep, p_aprovar: true, p_nota: "Pode ir." }), (r) => r.status === "aprovado");
const revisao = await espera("link privado de revisão", () => rpc(jornal, "podcast_revisao_link", { p_id: ep }), (r) => /^[0-9a-f]{64}$/.test(r.token));
await espera("o link abre o rascunho sem publicar", () => rpc(anon, "podcast_revisao", { p_token: revisao?.token }), (r) => r.titulo.includes("Comuna") && r.roteiro.includes("Bloco 1") && !r.pode_comentar);
await espera("o rascunho não aparece no site", () => rpc(anon, "podcast_catalogo"), (r) => r.episodios.length === 0);

// ── Publicação ──
const publicado = await espera("publica com a lista completa", () => rpc(jornal, "podcast_publicar", { p_id: ep }), (r) => r.slug === "a-comuna-de-paris-em-72-dias" && r.topico);
await espera("a conversa do episódio abre na comunidade", () => rpc(anon, "topico_ver", { p_id: publicado?.topico }), (r) => r.titulo.startsWith("Podcast:"));
await espera("o episódio aparece no site", () => rpc(anon, "podcast_catalogo"), (r) => r.episodios.length === 1 && r.episodios[0].audio === `ep/${ep}/final-a1b2c3d4.mp3`);
await espera("página do episódio com notas e convidados autorizados", () => rpc(anon, "podcast_episodio", { p_slug: "a-comuna-de-paris-em-72-dias" }), (r) => r.notas && r.convidados[0].nome === "Maria Historiadora" && r.obras.length === 1 && r.picos[2] === 55);
await espera("aparece na disciplina", () => rpc(anon, "podcast_por_disciplina", { p_disciplina: "historia" }), (r) => r.length === 1);
await espera("feed RSS", () => rpc(anon, "podcast_feed"), (r) => r.episodios.length === 1 && r.config.nome && r.config.guardados === undefined);
await recusa("episódio publicado não volta de etapa", () => rpc(jornal, "podcast_etapa", { p_id: ep, p_status: "edicao" }), "ja_publicado");
await recusa("jornalismo não apaga episódio que já foi ao ar", () => rpc(jornal, "podcast_apagar", { p_id: ep }), "sem_permissao");
await recusa("o áudio no ar não sai por engano", () => rpc(editor, "podcast_arquivo_remover", { p_id: final?.id }), "em_uso");
await espera("conta uma audição", () => rpc(anon, "podcast_ouvir", { p_id: ep }), (r) => r.ok);
await espera("estatísticas", () => rpc(jornal, "podcast_estatisticas"), (r) => r.episodios[0].total === 1 && r.dias.length === 30);

// ── Rodízio do depósito ──
await recusa("só a supervisão muda a configuração", () => rpc(jornal, "podcast_config_salvar", { p: { nome: "Podcast", descricao: "Uma descrição longa o bastante.", autor: "Instituto Lúcia", guardados: 2 } }), "sem_permissao");
await espera("a supervisão define dois episódios guardados", () => rpc(sup, "podcast_config_salvar", { p: { nome: "Podcast do Instituto Lúcia", descricao: "Uma descrição longa o bastante.", autor: "Instituto Lúcia", guardados: 2, links: { spotify: "https://open.spotify.com/show/x" } } }), (r) => r.guardados === 2);
const pronto = async (titulo, externo = "") => {
  const { id } = await rpc(jornal, "podcast_salvar", { p_id: null, p: { titulo } });
  await rpc(jornal, "podcast_salvar", { p_id: id, p: { resumo: "Um resumo com mais de vinte letras.", notas: "Notas com mais de cinquenta letras para passar na lista de conferência.", transcricao: "Fala. ".repeat(60), checklist: { volume: true, ruido: true, fontes: true, trilhas: true }, audio_externo: externo } });
  const arquivo = await rpc(jornal, "podcast_arquivo_registrar", { p_episodio: id, p: { tipo: "final", deposito: "podcast", caminho: `ep/${id}/final-12345678.mp3`, nome: "final.mp3", bytes: 1000, mime: "audio/mpeg" } });
  await rpc(jornal, "podcast_audio_definir", { p_episodio: id, p_arquivo: arquivo.id, p_duracao: 600, p_picos: [] });
  await rpc(jornal, "podcast_capa_definir", { p_episodio: id, p_capa: `capas/${id}/capa-12345678.jpg`, p_capa_mini: `capas/${id}/mini-12345678.jpg` });
  await rpc(jornal, "podcast_etapa", { p_id: id, p_status: "revisao" });
  await rpc(sup, "podcast_aprovar", { p_id: id, p_aprovar: true });
  return id;
};
const segundo = await pronto("Segundo episódio do teste");
await espera("segundo episódio no ar", () => rpc(jornal, "podcast_publicar", { p_id: segundo }), (r) => r.liberar.every((x) => !x.caminho.includes(ep)));
const terceiro = await pronto("Terceiro episódio do teste", "https://archive.org/download/terceiro/terceiro.mp3");
const rodada = await espera("o terceiro empurra o primeiro para fora do depósito", () => rpc(jornal, "podcast_publicar", { p_id: terceiro }), (r) => r.liberar.some((x) => x.caminho === `ep/${ep}/final-a1b2c3d4.mp3`));
await espera("sem cópia de fora, o primeiro sai do site e do feed", () => rpc(anon, "podcast_catalogo"), (r) => r.episodios.length === 2 && !r.episodios.some((x) => x.id === ep));
await espera("o painel avisa quem sai na próxima", () => rpc(jornal, "podcast_painel"), (r) => r.armazenamento.guardados === 2 && r.armazenamento.proximos.length === 1);
await espera("o painel confirma o que apagou", () => rpc(jornal, "podcast_liberados", { p_itens: rodada?.liberar ?? [] }), (r) => r.liberados >= 1);
await espera("com a cópia de fora, o primeiro volta a tocar", async () => {
  await rpc(jornal, "podcast_salvar", { p_id: ep, p: { audio_externo: "https://archive.org/download/comuna/comuna.mp3" } });
  return rpc(anon, "podcast_catalogo");
}, (r) => r.episodios.length === 3 && r.episodios.find((x) => x.id === ep)?.audio === "");

// ── Pautas e perguntas ──
const pauta = await espera("a leitora sugere uma pauta", () => rpc(leitora, "podcast_pauta_sugerir", { p_titulo: "A greve geral de 1917", p_descricao: "Como foi organizada em São Paulo." }), (r) => r.id);
await espera("sugestão não aparece antes da equipe pôr em votação", () => rpc(anon, "podcast_pautas_publicas"), (r) => r.votacao.length === 0);
await recusa("leitora não decide pauta", () => rpc(leitora, "podcast_pauta_decidir", { p_id: pauta?.id, p_status: "votacao" }), "sem_permissao");
await espera("a equipe põe em votação", () => rpc(jornal, "podcast_pauta_decidir", { p_id: pauta?.id, p_status: "votacao" }));
await espera("a leitora vota", () => rpc(leitora, "podcast_pauta_votar", { p_id: pauta?.id, p_votar: true }), (r) => r.votos === 1);
await espera("votar de novo não conta duas vezes", () => rpc(leitora, "podcast_pauta_votar", { p_id: pauta?.id, p_votar: true }), (r) => r.votos === 1);
await espera("o site mostra a votação", () => rpc(leitora, "podcast_pautas_publicas"), (r) => r.votacao[0].votos === 1 && r.votacao[0].meu_voto);
await recusa("anônimo não vota", () => rpc(anon, "podcast_pauta_votar", { p_id: pauta?.id, p_votar: true }), "entre_primeiro");
const escolhida = await espera("escolher a pauta cria a ideia de episódio", () => rpc(jornal, "podcast_pauta_decidir", { p_id: pauta?.id, p_status: "escolhida" }), (r) => r.episodio);
await espera("a ideia nasce com a pauta", () => rpc(jornal, "podcast_ver", { p_id: escolhida?.episodio }), (r) => r.status === "ideia" && r.titulo === "A greve geral de 1917");
await recusa("pergunta com áudio de outra pessoa", () => rpc(leitora, "podcast_perguntar", { p_texto: "", p_audio: `perguntas/${ids.jornal}/pergunta-12345678.webm`, p_assinatura: "Lia" }), "invalido:audio");
await espera("pergunta por texto e áudio", () => rpc(leitora, "podcast_perguntar", { p_texto: "Por que a Comuna caiu tão rápido?", p_audio: `perguntas/${ids.leitora}/pergunta-12345678.webm`, p_assinatura: "Lia, de Recife" }));
await espera("a equipe vê a pergunta", () => rpc(jornal, "podcast_perguntas_listar"), (r) => r.length === 1 && r[0].assinatura === "Lia, de Recife");
await recusa("leitora não lê as perguntas", () => rpc(leitora, "podcast_perguntas_listar"), "sem_permissao");

// ── Agenda, trilhas e séries ──
await espera("agenda um corte no Instagram", () => rpc(jornal, "podcast_postagem_salvar", { p_id: null, p: { episodio: ep, rede: "instagram", formato: "corte", quando: "2026-10-22T18:00:00-03:00", legenda: "Corte da Comuna" } }));
await espera("a agenda do mês", () => rpc(jornal, "podcast_postagens_listar", { p_de: "2026-10-01", p_ate: "2026-10-31" }), (r) => r.length === 1);
await recusa("trilha sem licença", () => rpc(jornal, "podcast_trilha_salvar", { p_id: null, p: { titulo: "Vinheta", licenca: "" } }), "invalido:licenca");
await espera("trilha com licença", () => rpc(jornal, "podcast_trilha_salvar", { p_id: null, p: { titulo: "Vinheta de abertura", autor: "Kevin MacLeod", tipo: "vinheta", licenca: "CC BY 4.0", fonte: "https://incompetech.com" } }), (r) => r.id);
await espera("série nova", () => rpc(jornal, "podcast_serie_salvar", { p_id: null, p: { titulo: "Revoluções", descricao: "As grandes revoluções contadas de baixo." } }), (r) => r.id);
await espera("a coordenação despublica", () => rpc(coord, "podcast_despublicar", { p_id: terceiro, p_nota: "Erro de data no título." }), (r) => r.status === "aprovado");

console.log(`podcast: ${certos} conferências certas, ${falhas.length} falhas`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
await banco.pg.close();
process.exit(falhas.length ? 1 : 0);
