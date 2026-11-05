// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Atalhos, useAtalhos } from "./Atalhos";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import nesteDia from "@/content/neste-dia.json";
import { areaSlugs } from "@/lib/areas";
import { areasPublicas } from "@/lib/interdicao";
import { can, getClient, hasBackend, leads, manages, type Me, nivelDe, porNivel, type Role, rpc, signOut, useMe } from "@/lib/backend";
import { limparIndice } from "@/lib/busca-local";
import { registerDevice } from "@/lib/device";
import { avisar, avisosDisponiveis, escolherModo, type ModoDeAviso, modoDeAviso, permissaoDeAviso } from "@/lib/notificacoes";
import { ligarTrava, travaDisponivel, travaLigada, travarAgora } from "@/lib/trava";
import { applyPrefs, readPrefs } from "@/lib/prefs";
import { senhaVazada } from "@/lib/senha";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { minutosOcioso } from "./ocioso";
import { L, useI18n } from "../I18n";
import { Star } from "../Masthead";
import { AulasAoVivo } from "./AoVivo";
import { AtividadeDoSite, useAtividadeAoVivo } from "./Atividade";
import { AvisosEquipe, QuadroDeAvisos } from "./Avisos";
import { Estatisticas } from "./Estatisticas";
import { Confirmacoes, ControlesAvancados } from "./BackendUm";
import { ConviteEixos, EixosEquipe } from "./EixosEquipe";
import { Operacao } from "./Operacao";
import { CaixaDeImprensa } from "./Imprensa";
import { Ensino } from "./Ensino";
import { Previa } from "./Previa";
import { TermoDeVoluntario } from "./Termo";
import { AgoraAoVivo, Continuar, DicaDoTutorial, meuDepartamento, NoSiteAgora, SuasHoras } from "./MesaAoLado";
import { Agradecimentos, CuidadoDaEquipe, FeriasNaMesa, Termometro } from "./Cuidado";
import { Departamentos } from "./Departamentos";
import { Assembleias } from "./Assembleias";
import { Pautas } from "./Pautas";
import { Biblioteca, PrimeiraSemana } from "./Biblioteca";
import { RetornoDosAlunos } from "./RetornoDosAlunos";
import { ConquistasDaEquipe, Nucleos } from "./Nucleos";
import { FilaDeAulas } from "./FilaDeAulas";
import { abrirTutorial, TutorialDoPainel } from "./Tutorial";
import { TermosAceitos } from "./PessoasExtras";
import { SaudeNoPainel } from "./Saude";
import { RadioNoAr } from "./RadioNoAr";
import { CentroDeControle } from "./controles/CentroDeControle";
import { RadioCanais } from "./controles/RadioCanais";
import { ErrosRelatados } from "./Erros";
import { Aviso, botao, botaoClaro, campo, data, elo, localDoPainel, oQueFaz, PAINEL_MUDOU, papeis, rotulo, situacoes, useAcao, useLista } from "./comum";
import { Comunidade, MuralFila, SugerirEmissora } from "./Cuidar";
import { Apoio } from "./Apoio";
import { Boletim } from "./Boletim";
import { CadernoNoPainel } from "./Caderno";
import { EstudioDeDesign } from "./design/EstudioDeDesign";
import { EscritorioNoPainel } from "./Escritorio";
import { PorOndeComecar } from "./Comecar";
import { AcervoPorDentro, MinhasContribuicoes, ParaVoceHoje, Tarefas } from "./Tarefas";
import { Exercicios } from "./Exercicios";
import { Conversas } from "./Conversas";
import { Curriculo as DisciplinasETrilhas } from "./Curriculo";
import { Divulgacao } from "./Divulgacao";
import { Equipe, type Membro } from "./Equipe";
import { Repasse } from "./Sigilo";
import { Escrever } from "./Escrever";
import { FontesAbertas } from "./FontesAbertas";
import { ValeOEscritoCuradoria } from "./ValeOEscrito";
import { RedePropostas } from "./RedePropostas";
import { Fila } from "./Fila";
import { GavetaFila } from "./GavetaFila";
import { Horas } from "./Horas";
import { IdiomaDoPainel, TraduzirPainel, traduzirNoPainel } from "./Idioma";
import { Interdicao } from "./Interdicao";
import { AvisoDeAbertura, RegistroDeAtividades, SegurancaSucessao } from "./Lideranca";
import { Materiais } from "./Materiais";
import { MinhaConta } from "./MinhaConta";
import { Pessoas } from "./Pessoas";
import { Podcast } from "./podcast/Podcast";
import { Reforco } from "./Reforco";
import { Supervisao } from "./Supervisao";
import { Tecnico } from "./Tecnico";
import { Traducoes } from "./Traducoes";
import { Recados, SegundoFator } from "./Seguranca";
import { type Controles, Site } from "./Site";
import { Videoaulas } from "./Videoaulas";
import { GuiaDaSecao } from "./GuiaDaSecao";
import { GLOSSARIO } from "./guias";
import { Icone } from "./icones";
import "@/styles/painel-tema.css";
import { MenuDoPainel } from "./Menu";
import { espacoDe, nomeDoEspaco } from "./estrutura";
import { MesaOrganizada } from "./MesaOrganizada";
import { type FuncaoDaMesa, funcoesDaPessoa, montarPendencias, somar } from "./mesa-funcoes";
import { AvisosDoPainel, DialogosDoPainel, Paleta } from "./ui";

interface Resumo {
  fila: number;
  aguardando_publicacao: number;
  candidaturas: number;
  denuncias: number;
  anotacoes: number;
  retidos: number;
  mural: number;
  /** Envios do público que a mediação ainda não leu. */
  triagem?: number;
  reforco: number;
  horas: number;
  /** Pedidos de certificado esperando o coordenador. */
  pedidos?: number;
  testemunhar: number;
  minhas: number;
  /** Contribuições pendentes de colegas que me chamaram para trabalhar junto. */
  juntas: number;
  /** Pedidos de ajuda do mural da equipe endereçados a uma função minha. */
  pedidos_ajuda?: number;
  /** Contas suspensas pela supervisão (a supervisão e a coordenação acompanham). */
  suspensas?: number;
  /** Posts prontos com a data chegando e itens devolvidos pela coordenação. */
  divulgacao?: number;
  /** Aprovado há mais de três horas e ainda fora do ar: a rotina de publicação parou. */
  publicacao_atrasada?: number;
  /** Trabalhos da Gaveta Aberta esperando a decisão de quem media. */
  gaveta?: number;
  /** Pedidos da supervisão (interdição, liberação, expurgo) esperando a coordenação. */
  pedidos_supervisao?: number;
}

interface Secao {
  id: string;
  nome: string;
  /** Uma linha que diz para que a seção serve. */
  sobre: string;
  grupo: string;
  mostra: boolean;
  /** Quantas coisas esperam por alguém nesta seção. */
  conta?: number;
}

/** Sem acento e em minúsculas, para a busca do "Ir para" achar "seguranca" em "Segurança". */
const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * "Ir para…": Ctrl+K (ou /) abre uma caixa que procura entre as seções pelo nome, pela área ou pelo que
 * cada uma faz. Setas escolhem, Enter abre, Esc fecha. Com mais de vinte seções, é o caminho mais curto.
 */
// Montada só enquanto está aberta: cada abertura começa com a busca vazia e o cursor no campo.
interface Comando {
  id: string;
  nome: string;
  sobre: string;
  fazer: () => void;
}

function trocarTema() {
  const atual = document.documentElement.getAttribute("data-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const novo = atual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  setItem(KEYS.theme, novo);
}

/** "g" e uma letra: vai direto à seção (se a pessoa enxerga a seção). */
const ATALHOS_G: Record<string, string> = { d: "departamentos", m: "mesa", e: "escrever", c: "conversas", f: "fila", h: "horas", t: "tarefas", a: "atividade", v: "videoaulas", r: "rede", p: "pessoas", o: "conta" };

/** O glossário do painel: as palavras das seções, em linguagem simples, com busca. */
function Glossario({ fechar }: { fechar: () => void }) {
  const [busca, setBusca] = useState("");
  const termo = simples(busca.trim());
  const vistos = termo ? GLOSSARIO.filter(([palavra, sentido]) => simples(`${palavra} ${sentido}`).includes(termo)) : GLOSSARIO;
  return (
    <div className="painel-veu fixed inset-0 z-50 flex items-start justify-center bg-[#17130e]/60 px-4 pt-[8vh]" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Glossário do painel" className="flex max-h-[84vh] w-full max-w-xl flex-col border-2 border-ink bg-parchment text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink p-4">
          <h2 className="font-serif text-2xl font-semibold">Glossário do painel</h2>
          <button type="button" onClick={fechar} className="cursor-pointer border-2 border-ink px-2 py-0.5 text-xs font-bold hover:bg-ink hover:text-parchment">Fechar</button>
        </div>
        <label className="border-b border-rule px-4 py-2">
          <span className="sr-only">Procurar no glossário</span>
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === "Escape" && fechar()} placeholder="Procurar uma palavra" className="w-full bg-transparent py-1.5 outline-none placeholder:text-ink-soft" />
        </label>
        <dl className="min-h-0 flex-1 divide-y divide-dashed divide-rule overflow-y-auto px-4 py-2">
          {vistos.map(([palavra, sentido]) => (
            <div key={palavra} className="py-2">
              <dt className="font-semibold">{palavra}</dt>
              <dd className="text-[0.92rem] leading-snug text-ink-soft">{sentido}</dd>
            </div>
          ))}
          {vistos.length === 0 && <p className="py-3 text-ink-soft">Nenhuma palavra com isso. Pergunte no Mural da equipe.</p>}
        </dl>
      </div>
    </div>
  );
}

/** A lista dos atalhos de teclado do painel ("?" abre e fecha). */
function AjudaDoTeclado({ secoes, fechar }: { secoes: Secao[]; fechar: () => void }) {
  const nome = (id: string) => secoes.find((secao) => secao.id === id)?.nome;
  const linhas: [string, string][] = [
    ["Ctrl K", "Ir para uma seção ou rodar um comando"],
    ["/", "Ir para… (fora de campos de texto)"],
    ["?", "Abrir e fechar esta lista"],
    ...Object.entries(ATALHOS_G)
      .filter(([, id]) => nome(id))
      .map(([letra, id]) => [`g ${letra}`, nome(id) as string] as [string, string]),
    ["Esc", "Fechar janelas e caixas"],
  ];
  return (
    <div className="painel-veu fixed inset-0 z-50 flex items-start justify-center bg-[#17130e]/60 px-4 pt-[10vh]" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Atalhos de teclado" className="w-full max-w-md border-2 border-ink bg-parchment p-5 text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold">Atalhos de teclado</h2>
          <button type="button" onClick={fechar} className="cursor-pointer border-2 border-ink px-2 py-0.5 text-xs font-bold hover:bg-ink hover:text-parchment">Fechar</button>
        </div>
        <dl className="mt-4 divide-y divide-dashed divide-rule">
          {linhas.map(([tecla, o]) => (
            <div key={tecla} className="flex items-center justify-between gap-4 py-1.5">
              <dt><kbd className="border border-ink bg-folha px-1.5 py-0.5 font-mono text-xs">{tecla}</kbd></dt>
              <dd className="text-right">{o}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-soft">“g” e uma letra: aperte g, solte, e aperte a letra logo depois.</p>
      </div>
    </div>
  );
}

/** Claro ou escuro, como no site: a escolha fica guardada no navegador. */
function Tema() {
  // O cabeçalho do site não existe aqui dentro, então é o painel que reaplica o tema e as preferências de leitura.
  useLayoutEffect(() => {
    const tema = getItem(KEYS.theme);
    if (tema === "light" || tema === "dark") document.documentElement.setAttribute("data-theme", tema);
    applyPrefs(readPrefs());
  }, []);

  return (
    <button type="button" onClick={trocarTema} className="cursor-pointer underline hover:text-prelo-texto">
      Claro / escuro
    </button>
  );
}

/** Tela inteira para os estados em que o painel ainda não abriu (carregando, sem conta, segundo fator). */
function Porta({ children }: { children: React.ReactNode }) {
  return (
    <div className="painel painel-porta relative flex min-h-screen items-center justify-center overflow-hidden bg-[#17130e] px-4 py-10 font-sans text-sm text-[#efe4c8]">
      <Star className="pointer-events-none absolute -right-24 -bottom-28 h-[28rem] w-[28rem] rotate-12 text-[#6e1f1a]" />
      <TraduzirPainel />
      <div className="painel-surge relative w-full max-w-md">
        <p className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca-96.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span>
            <span className="block font-serif text-2xl font-semibold leading-none">Instituto Lúcia</span>
            <span className="mt-1 block font-mono text-[0.65rem] uppercase tracking-[0.3em] text-[#c9a84a]">Painel</span>
          </span>
        </p>
        <div className="mt-8 border-2 border-[#efe4c8] border-t-[6px] border-t-[#c21f16] bg-[#1f1a14] p-6 shadow-[6px_6px_0_#6e1f1a]">{children}</div>
        <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <L href="/" className="underline hover:text-white">← Voltar ao site</L>
          <IdiomaDoPainel />
        </p>
      </div>
    </div>
  );
}

/**
 * O ambiente de trabalho de quem faz o instituto. É uma tela à parte do site: menu lateral por área,
 * uma seção de cada vez, e cada pessoa vê só o que diz respeito à função que recebeu.
 */
export function Painel() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useI18n();
  const [menu, setMenu] = useState(false);
  const dentro = me.status === "in";

  // Avisa o serviço de que a conta foi aberta neste navegador (gera alerta se for um aparelho novo).
  useEffect(() => {
    if (dentro) void registerDevice();
  }, [dentro]);

  // Fecha a sessão depois do tempo escolhido sem ninguém mexer em nenhuma aba do painel neste navegador.
  useEffect(() => {
    if (!dentro) return;
    let ultimoLocal = 0;
    const tocar = () => {
      // No máximo uma escrita a cada 15 s: rolar a página não pode virar uma enxurrada no armazenamento.
      const agora = Date.now();
      if (agora - ultimoLocal < 15_000) return;
      ultimoLocal = agora;
      setItem(KEYS.painelUltimoUso, String(agora));
    };
    tocar();
    const sinais = ["pointerdown", "keydown", "scroll"] as const;
    for (const sinal of sinais) window.addEventListener(sinal, tocar, { passive: true });
    const relogio = window.setInterval(() => {
      const minutos = minutosOcioso();
      if (minutos === 0) return;
      const ultimo = Number(getItem(KEYS.painelUltimoUso)) || Date.now();
      if (Date.now() - ultimo > minutos * 60_000) void signOut().then(() => router.replace(`/${lang}/entrar`));
    }, 60_000);
    return () => {
      for (const sinal of sinais) window.removeEventListener(sinal, tocar);
      window.clearInterval(relogio);
    };
  }, [dentro, router, lang]);

  if (!hasBackend) return <Porta><p>O painel ainda não foi ligado neste endereço.</p></Porta>;
  if (me.status === "loading") return <Porta><p className="font-mono text-xs">Abrindo…</p></Porta>;
  if (me.status === "out") {
    return (
      <Porta>
        <p className="text-base">Esta é a área de trabalho da equipe.</p>
        <p className="mt-4">
          <L href="/entrar" className="inline-block bg-[#efe4c8] px-5 py-2.5 font-medium text-[#17130e] hover:bg-white">Entrar com a minha conta</L>
        </p>
      </Porta>
    );
  }

  const eu = me.me;
  const sair = async () => {
    // O índice de busca das conversas é deste aparelho; sai com a conta.
    await limparIndice().catch(() => undefined);
    travarAgora();
    await signOut();
    router.replace(`/${lang}`);
  };

  // Função sensível com a exigência ligada: nada do painel abre antes do código do aplicativo autenticador.
  if (eu.exige_segundo_fator && !eu.segundo_fator) {
    return (
      <Porta>
        <h1 className="font-serif text-2xl font-semibold">Confirme que é você</h1>
        <p className="mt-2 text-[#b9ad90]">A sua função exige uma segunda confirmação antes de abrir o painel.</p>
        <div className="mt-5 bg-parchment p-4 text-ink">
          <SegundoFator me={eu} recarregar={me.reload} />
        </div>
        <button type="button" className="mt-6 cursor-pointer underline hover:text-white" onClick={sair}>Sair</button>
      </Porta>
    );
  }

  // A coordenação redefiniu a senha: antes de qualquer coisa, a pessoa escolhe uma que só ela conhece.
  if (eu.trocar_senha) {
    return (
      <Porta>
        <SenhaNova recarregar={me.reload} sair={sair} />
      </Porta>
    );
  }

  return <Dentro eu={eu} recarregar={me.reload} sair={sair} aba={params.get("aba") ?? "mesa"} menu={menu} setMenu={setMenu} />;
}

/** A porta de quem teve a senha redefinida pela coordenação: a senha recebida serviu para entrar, não para ficar. */
function SenhaNova({ recarregar, sair }: { recarregar: () => void; sair: () => void }) {
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function trocar() {
    setOcupado(true);
    setAviso("");
    try {
      if ((await senhaVazada(senha)) === true) {
        setAviso("Essa senha já apareceu em vazamentos de outros sites. Escolha outra.");
        return;
      }
      const supabase = await getClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      await rpc("senha_trocada");
      recarregar();
    } catch {
      setAviso("Não foi possível trocar a senha agora. Saia, entre de novo e tente outra vez.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h1 className="font-serif text-2xl font-semibold">Escolha uma senha nova</h1>
      <p className="mt-2 text-[#b9ad90]">A coordenação redefiniu a sua senha. Escolha agora uma que só você conheça: pelo menos 12 caracteres (uma frase de quatro ou cinco palavras funciona bem).</p>
      <form className="mt-5 space-y-3" onSubmit={(e) => { e.preventDefault(); void trocar(); }}>
        <label className="block">
          Senha nova
          <input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1 w-full border border-[#5a4e3a] bg-[#17130e] px-3 py-2 text-[#efe4c8]" />
        </label>
        <label className="block">
          Repita a senha
          <input type="password" autoComplete="new-password" maxLength={72} value={repete} onChange={(e) => setRepete(e.target.value)} className="mt-1 w-full border border-[#5a4e3a] bg-[#17130e] px-3 py-2 text-[#efe4c8]" />
        </label>
        <button type="submit" disabled={ocupado || senha.length < 12 || senha !== repete} className="cursor-pointer bg-[#efe4c8] px-5 py-2.5 font-medium text-[#17130e] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
          Guardar e abrir o painel
        </button>
      </form>
      <p role="status" className="mt-3 min-h-5 text-[#e0837a]">{aviso}</p>
      <button type="button" className="mt-4 cursor-pointer underline hover:text-white" onClick={sair}>Sair</button>
    </>
  );
}

function Dentro({ eu: euReal, recarregar, sair, aba, menu, setMenu }: { eu: Me; recarregar: () => void; sair: () => void; aba: string; menu: boolean; setMenu: (aberto: boolean) => void }) {
  const router = useRouter();
  const { lang } = useI18n();
  // Prévia por função: a coordenação vê o painel como uma função veria (menu, seções e botões). Os dados continuam os
  // da conta dela (o banco confere a permissão de verdade em cada pedido), e a escolha não sai deste aparelho.
  const [previa, setPrevia] = useState<{ papel: Role["papel"]; disciplina: string | null } | null>(null);
  const eu: Me = previa && leads(euReal) ? previaComo(euReal, previa.papel, previa.disciplina) : euReal;
  const resumo = useLista<Resumo>("painel_resumo");
  // O que espera por esta pessoa no podcast (aprovação, comentários, perguntas, pedidos de arte).
  const podcast = useLista<number>("podcast_contagem");
  // Aulas em vídeo esperando a curadoria.
  const videos = useLista<number>("videoaulas_contagem");
  const r = resumo.dados;
  const atualizarResumo = resumo.recarregar;
  // De minuto em minuto o painel diz que a pessoa está por aqui, pergunta se chegou mensagem nova e refaz as
  // contagens do menu. Ao voltar para a aba do navegador, as contagens também se refazem na hora.
  const presenca = useLista<{ conversas: number }>("presenca");
  const avisarPresenca = presenca.recarregar;
  // Aviso do navegador quando a contagem de conversas pendentes sobe com a aba escondida. Sem prévia: o aviso diz só
  // que chegou mensagem (e, se a pessoa quis, de quem). O nome vem da lista de conversas, nunca do conteúdo.
  const pendentes = presenca.dados?.conversas;
  const [vistasAntes, setVistasAntes] = useState<number | null>(null);
  useEffect(() => {
    if (pendentes === undefined) return;
    if (vistasAntes !== null && pendentes > vistasAntes && document.visibilityState !== "visible" && modoDeAviso() !== "nenhum") {
      void rpc<{ nao_lidas: number; silenciada: boolean; arquivada: boolean; ultima: { autor: string; minha: boolean } | null }[]>("chat_conversas")
        .then((lista) => avisar(lista.filter((c) => c.nao_lidas > 0 && !c.silenciada && !c.arquivada && c.ultima && !c.ultima.minha).map((c) => c.ultima!.autor), traduzirNoPainel))
        .catch(() => avisar([], traduzirNoPainel));
    }
    const marca = window.setTimeout(() => setVistasAntes(pendentes), 0);
    return () => window.clearTimeout(marca);
  }, [pendentes, vistasAntes]);
  const estadoDoSite = useLista<{ interdicao?: { geral: boolean; areas: string[] } }>("site");
  const lerSite = estadoDoSite.recarregar;
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      avisarPresenca();
      atualizarResumo();
      lerSite();
    }, 60_000);
    const voltou = () => {
      if (document.visibilityState === "visible") atualizarResumo();
    };
    document.addEventListener("visibilitychange", voltou);
    window.addEventListener(PAINEL_MUDOU, atualizarResumo);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", voltou);
      window.removeEventListener(PAINEL_MUDOU, atualizarResumo);
    };
  }, [avisarPresenca, atualizarResumo, lerSite]);
  // O profissional de saúde da vitrine não é da equipe de produção: vê a mesa, o próprio perfil na vitrine e a conta.
  const soSaude = eu.papeis.length > 0 && eu.papeis.every((p) => p.papel === "saude");
  const voluntario = eu.papeis.length > 0 && !soSaude;
  const educa = can(eu, "educacao") || (eu.convites?.length ?? 0) > 0;
  // Quem produz para o site: educação, curadoria, revisão, tradução, jornalismo, design, marketing e a liderança.
  const produz = can(eu, "coordenacao", "supervisao", "curadoria", "educacao", "revisao", "traducao", "jornalismo", "design", "marketing");
  const lidera = can(eu, "coordenacao");
  // O representante do Departamento de Saúde cuida da vitrine junto com a coordenação.
  const cuidaDaSaude = lidera || eu.papeis.some((p) => p.papel === "representante" && p.disciplina === "saude");
  // A supervisão é um papel próprio: can() só estende a vice-coordenação à coordenação, não à supervisão.
  const supervisiona = can(eu, "supervisao");
  // O que a galera posta, para a coordenação acompanhar: o número do menu e o aviso do navegador.
  // Quem acompanha o que a galera posta: coordenação, coordenação pedagógica, supervisão, revisão e mediação.
  const acompanha = can(eu, "coordenacao", "supervisao", "revisao", "mediacao");
  const atividadeNova = useAtividadeAoVivo(acompanha, aba === "atividade");
  // Cada função enxerga só as ferramentas dela. A coordenação e a vice-coordenação enxergam todas.
  const secoes: Secao[] = (
    [
      { id: "mesa", nome: "Mesa", sobre: "O que espera por você hoje.", grupo: "", mostra: true, conta: eu.avisos },
      { id: "atividade", nome: "Atividade do site", sobre: "Tudo o que a galera posta no site e no painel, na hora em que acontece, com aviso por e-mail se você quiser.", grupo: "", mostra: acompanha, conta: atividadeNova || undefined },
      { id: "conversas", nome: "Conversas e reuniões", sobre: "Os canais de cada departamento, grupos, mensagens diretas e as reuniões por vídeo, num lugar só e cifrado de ponta a ponta.", grupo: "", mostra: voluntario, conta: aba === "conversas" || aba === "reunioes" ? 0 : presenca.dados?.conversas },
      { id: "rede", nome: "Mural da equipe", sobre: "Publicações e pedidos de ajuda para todos ou por função, cifrados neste aparelho.", grupo: "", mostra: voluntario },
      { id: "escrever", nome: "Escrever", sobre: "Aulas, matérias, verbetes e tudo o que vai para o site.", grupo: "Produção", mostra: produz },
      { id: "videoaulas", nome: "Aulas em vídeo", sobre: "Gravar ou enviar aulas curtas em vídeo, de até 10 minutos, e revisar as da sua disciplina.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "educacao"), conta: videos.dados ?? undefined },
      { id: "aovivo", nome: "Aulas ao vivo", sobre: "Marcar aulas na agenda pública, chamar colegas para dar junto e abrir a sala, com vídeo e bate-papo.", grupo: "Produção", mostra: can(eu, "coordenacao", "educacao", "mentoria") },
      { id: "estudio", nome: "Estúdio de design", sobre: "Estúdio rápido (modelos da marca) e editor avançado (PhotoCraft): posts, stories, cartazes e capas com a identidade do instituto.", grupo: "Produção", mostra: eu.desenha === true || can(eu, "coordenacao", "design", "jornalismo") },
      { id: "escritorio", nome: "Escritório", sobre: "Documentos, planilhas e apresentações (WordCraft, GridCraft e DeckCraft), dentro do painel.", grupo: "Produção", mostra: true },
      { id: "caderno", nome: "Caderno de estudos", sobre: "Fontes, resumo, cartões, questionário, mapa e leitura em voz alta: a sala de estudo para preparar aulas e episódios.", grupo: "Produção", mostra: true },
      { id: "aulas-a-escrever", nome: "Aulas a escrever", sobre: "As aulas previstas nas trilhas que ainda não têm texto: reservar, escrever com o modelo e pedir revisão de um colega.", grupo: "Produção", mostra: produz },
      { id: "tarefas", nome: "Tarefas", sobre: "Microtarefas do acervo e das aulas para 5, 15 ou 30 minutos, a revisão rápida, mutirões e projetos.", grupo: "Produção", mostra: voluntario },
      { id: "acervo-dentro", nome: "Acervo por dentro", sobre: "Cada obra com o selo da ficha (completa, parcial ou faltando), para escolher o que cuidar: só a curadoria mexe no acervo.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "revisao") },
      { id: "exercicios", nome: "Exercícios de prática", sobre: "Exercícios ligados às aulas (vídeo, animação, imagem) com o programa do Estúdio de prática, e as entregas para comentar.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "educacao") },
      { id: "pautas", nome: "Pautas e calendário", sobre: "O banco de pautas (matéria, episódio, post, aula, vídeo) e o calendário único com pautas, posts, aulas ao vivo e reuniões.", grupo: "Produção", mostra: voluntario },
      { id: "minhas", nome: "Meus envios", sobre: "O que você enviou e em que pé está.", grupo: "Produção", mostra: produz },
      { id: "juntas", nome: "Compartilhadas comigo", sobre: "Contribuições de colegas que chamaram você para trabalhar junto.", grupo: "Produção", mostra: voluntario, conta: r?.juntas },
      { id: "fila", nome: "Fila de revisão", sobre: "Ler, dar parecer e decidir o que vai ao ar.", grupo: "Produção", mostra: can(eu, "coordenacao", "supervisao", "curadoria", "revisao", "educacao"), conta: r?.fila },
      { id: "vale-curadoria", nome: "Vale o Escrito: curadoria", sobre: "O observatório de crimes de interesse público: fila de sugestões do robô e do público, entrada manual, situação jurídica, correções e direito de resposta.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria") },
      { id: "traducoes", nome: "Traduções", sobre: "As aulas que ainda não têm tradução e as traduções a caminho.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "traducao", "revisao") },
      { id: "triagem", nome: "Triagem", sobre: "A primeira leitura do que o público envia: o que passa segue para a fila de revisão.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "mediacao"), conta: r?.triagem },
      { id: "curriculo", nome: "Disciplinas e trilhas", sobre: "As suas disciplinas e trilhas: sugerir mudanças e convidar colegas de outras disciplinas para ajudar (a coordenação cria, edita e remove).", grupo: "Produção", mostra: educa || can(eu, "coordenacao", "supervisao", "curadoria") },
      { id: "fontes", nome: "Fontes abertas", sobre: "Obras, verbetes e datas em acervos e enciclopédias livres, para escrever com fonte à vista.", grupo: "Produção", mostra: produz },
      { id: "materiais", nome: "Materiais e arquivos", sobre: "Zines, cartazes, imagens e PDFs.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "design", "marketing") },
      { id: "divulgacao", nome: "Divulgação", sobre: "Calendário de posts e stories, kit da marca e acesso ao Instagram.", grupo: "Produção", mostra: can(eu, "coordenacao", "marketing"), conta: r?.divulgacao },
      { id: "comunidade", nome: "Comunidade", sobre: "Fila de revisão, banimentos, denúncias, anotações e o filtro de palavras.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "curadoria", "mediacao", "educacao"), conta: r ? r.denuncias + r.anotacoes + r.retidos : undefined },
      { id: "rede-propostas", nome: "Rede: propostas de comunidade", sobre: "Comunidade nova da Rede Lúcia só nasce por proposta: ler o objetivo e as regras, conferir os moderadores e aprovar ou recusar com o motivo.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "vice") },
      { id: "reforco", nome: "Aula de reforço", sobre: "Dúvidas de estudantes esperando resposta.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "mentoria", "educacao"), conta: r?.reforco },
      { id: "mural", nome: "Mural dos Trabalhadores", sobre: "Anúncios esperando a decisão da coordenação ou da mediação.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "mediacao"), conta: r?.mural },
      { id: "gaveta", nome: "Gaveta Aberta", sobre: "Trabalhos de estudantes esperando a decisão: conferir, publicar ou recusar.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "curadoria", "mediacao"), conta: r?.gaveta },
      { id: "boletim", nome: "Boletim do jornal", sobre: "Quem pediu para receber o jornal por e-mail.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "jornalismo") },
      { id: "assembleias", nome: "Assembleias", sobre: "Decisões da equipe por voto: secreto de verdade, com o resultado só no fim.", grupo: "Pessoas", mostra: voluntario },
      { id: "nucleos", nome: "Núcleos", sobre: "O mapa dos núcleos de estudo por estado e cidade, sem endereço nem nome de quem participa.", grupo: "Pessoas", mostra: voluntario },
      { id: "departamentos", nome: "Departamentos", sobre: "Cada departamento com a meta do mês, o quadro da semana, os pedidos de outros departamentos com prazo, quem responde e como trabalha.", grupo: "Pessoas", mostra: voluntario },
      { id: "pessoas", nome: "Voluntários e convites", sobre: "Convidar, confiar funções e acompanhar a equipe.", grupo: "Pessoas", mostra: manages(eu), conta: r?.candidaturas },
      { id: "supervisao", nome: "Supervisão", sobre: "Proteções reversíveis, a equipe sem e-mails e os pedidos de voluntariado.", grupo: "Pessoas", mostra: supervisiona, conta: r?.candidaturas },
      // As reuniões moram dentro de Conversas e reuniões; o endereço antigo (?aba=reunioes) abre a agenda de lá.
      { id: "reunioes", nome: "Reuniões", sobre: "A agenda de reuniões, dentro de Conversas e reuniões.", grupo: "Pessoas", mostra: voluntario && aba === "reunioes" },
      { id: "horas", nome: "Horas e certificados", sobre: "Termo de adesão, horas de trabalho e certificados.", grupo: "Pessoas", mostra: voluntario, conta: r ? r.horas + r.testemunhar + (r.pedidos ?? 0) : undefined },
      { id: "saude", nome: cuidaDaSaude ? "Mural de Saúde" : "Meu perfil no mural", sobre: "O mural de contatos de profissionais de saúde com registro ativo: o perfil de cada um, o termo, a conferência do registro e a chave geral.", grupo: "Pessoas", mostra: can(eu, "coordenacao", "saude") || cuidaDaSaude },
      { id: "termos", nome: "Termos assinados", sobre: "O termo de voluntário, o termo de adesão e o da vitrine de saúde, aceitos por cada pessoa: o texto exato, a versão, a data e a impressão digital. Ninguém apaga.", grupo: "Pessoas", mostra: can(eu, "coordenacao", "supervisao") },
      { id: "estatisticas", nome: "Estatísticas", sobre: "O que os estudantes procuram e o que a equipe produz, por disciplina: a base para decidir o que entra e o que sai.", grupo: "Pessoas", mostra: lidera || can(eu, "vice") },
      { id: "operacao", nome: "Operação do site", sobre: "Ver a última publicação e a última cópia do banco, limpar o cache e acompanhar o vencimento do token do Instagram.", grupo: "Site", mostra: can(eu, "coordenacao") },
      { id: "imprensa", nome: "Caixa de imprensa", sobre: "Pedidos de jornalistas feitos em /imprensa, para o porta-voz responder.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "porta_voz") },
      { id: "ensino", nome: "Resultado e lacunas", sobre: "Para quem ensina: como foram os testes de cada aula (somas anônimas) e o que ainda falta cobrir na disciplina.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "educacao") },
      { id: "previa", nome: "Resumo diário e prévia", sobre: "Ligar o resumo diário por e-mail (opcional) e ver telas novas com dados de exemplo.", grupo: "Pessoas", mostra: voluntario },
      { id: "eixos-equipe", nome: "Pesquisa dos 12 eixos", sobre: "Tarefa opcional e anônima: o teste dos 12 eixos para a equipe. A coordenação vê só a média e a distribuição, nunca a resposta de alguém.", grupo: "Pessoas", mostra: voluntario },
      { id: "controles-avancados", nome: "Controles avançados", sobre: "Recursos ligados sem publicar de novo, destaques da home, aula da semana, apresentação das trilhas, conteúdo em arquivo por PR, correções aprovadas, constantes do site e limites.", grupo: "Site", mostra: can(eu, "coordenacao", "vice", "curadoria", "desenvolvimento") },
      { id: "confirmacoes", nome: "Confirmações de segunda pessoa", sobre: "Pedidos que esperam uma segunda pessoa da coordenação: ligar a Escola, o Vale o Escrito e a Rede v2, zerar segundo fator e aparelhos, segunda avaliação externa.", grupo: "Segurança", mostra: lidera || can(eu, "vice") },
      { id: "avisos", nome: "Avisos à equipe", sobre: "Um quadro que aparece por cima do painel de toda a equipe, ou só de algumas funções, até cada pessoa fechar.", grupo: "Pessoas", mostra: eu.supervisao === true || lidera || supervisiona },
      { id: "centro", nome: "Centro de controle", sobre: "Os controles do coordenador num lugar só: canais no celular, sala da equipe, rádio, moderadores, núcleos da Rede, arquivos bloqueados e Publicar agora.", grupo: "Site", mostra: lidera },
      { id: "site", nome: "Controles do site", sobre: "A faixa do alto e a pausa geral de envios.", grupo: "Site", mostra: lidera },
      { id: "abertura", nome: "Aviso de abertura", sobre: "O quadro que aparece quando o site abre.", grupo: "Site", mostra: lidera },
      { id: "podcast", nome: "Podcast", sobre: "Episódios da pauta à publicação: roteiro, gravação, versões, revisão, capas, cortes e agenda.", grupo: "Produção", mostra: can(eu, "coordenacao", "jornalismo", "design", "mediacao", "curadoria"), conta: podcast.dados ?? undefined },
      { id: "emissoras", nome: "Rádio", sobre: "Pôr a Rádio Lúcia no ar (live do YouTube ou áudio) e indicar emissoras populares e comunitárias para o diretório público.", grupo: "Site", mostra: can(eu, "coordenacao", "jornalismo") },
      { id: "apoiadores", nome: "Apoio e transparência", sobre: "A página de Apoie (faixas, metas, custos), o mural de apoiadores, as contas do mês e o texto para a Benfeitoria.", grupo: "Site", mostra: lidera },
      { id: "erros", nome: "Erros relatados", sobre: "O que o público relatou na página Achei um erro.", grupo: "Site", mostra: can(eu, "coordenacao", "desenvolvimento") },
      { id: "tecnico", nome: "Estado técnico", sobre: "Publicação, avaliação automática, faxina e sinais de varredura.", grupo: "Site", mostra: can(eu, "coordenacao", "desenvolvimento"), conta: r?.publicacao_atrasada },
      { id: "seguranca", nome: "Segurança e sucessão", sobre: "Segundo fator obrigatório, coordenação pedagógica e ordem de sucessão.", grupo: "Segurança", mostra: lidera },
      { id: "interdicao", nome: "Interdição e expurgo", sobre: "Tirar o site ou uma área do ar por um tempo, e apagar de uma vez uma chuva de spam.", grupo: "Segurança", mostra: lidera || supervisiona, conta: r?.pedidos_supervisao },
      { id: "registro", nome: "Registro de atividades", sobre: "Tudo o que foi decidido, por quem e quando.", grupo: "Segurança", mostra: lidera || supervisiona },
      { id: "biblioteca", nome: "Biblioteca da equipe", sobre: "Formação militante da equipe, estatuto, conduta, modelos de trabalho e as ferramentas de estudo, num lugar só.", grupo: "Você", mostra: voluntario },
      { id: "contribuicoes", nome: "Minhas contribuições", sobre: "O que você fez, as horas estimadas, os selos e o comprovante de voluntariado.", grupo: "Você", mostra: voluntario },
      { id: "conta", nome: "Minha conta", sobre: "Seu nome, sua senha e a proteção da sua conta.", grupo: "Você", mostra: true },
    ] satisfies Secao[]
  ).filter((secao) => secao.mostra);

  const atual = secoes.find((secao) => secao.id === aba) ?? secoes[0];
  // As conversas ocupam a tela inteira (como o Discord): cabeçalho baixinho e sem a margem das outras seções.
  const amplo = atual.id === "conversas" || atual.id === "reunioes";
  const interditado = estadoDoSite.dados?.interdicao && (estadoDoSite.dados.interdicao.geral || estadoDoSite.dados.interdicao.areas.length > 0) ? estadoDoSite.dados.interdicao : null;
  // Trocar de seção também refaz as contagens: o número da fila cai assim que a decisão é tomada.
  const atalhos = useAtalhos();
  const ir = (id: string) => {
    setMenu(false);
    atalhos.lembrar(id);
    // Cada seção entra no histórico: o voltar do celular (e do navegador) volta para a seção anterior.
    router.push(`/${lang}/painel?aba=${id}`, { scroll: false });
    window.scrollTo(0, 0);
    atualizarResumo();
  };
  const [irPara, setIrPara] = useState(false);
  // Menu só com ícones (no computador) e modo foco (só o essencial no menu): preferências deste aparelho.
  // (Dentro só monta no navegador, depois de carregar a conta: dá para ler o armazenamento já na primeira renderização.)
  const [compacto, setCompacto] = useState(() => getItem(KEYS.painelCompacto) === "1");
  const [foco, setFoco] = useState(() => getItem(KEYS.painelFoco) === "1");
  const [leve, setLeve] = useState(() => getItem(KEYS.painelLeve) === "1");
  const [ajudaDoTeclado, setAjudaDoTeclado] = useState(false);
  const [glossario, setGlossario] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  useEffect(() => {
    const mudou = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);
  const alternarCompacto = () => { setCompacto((c) => { setItem(KEYS.painelCompacto, c ? "0" : "1"); return !c; }); };
  const alternarFoco = () => { setFoco((f) => { setItem(KEYS.painelFoco, f ? "0" : "1"); return !f; }); };
  const alternarLeve = () => { setLeve((l) => { setItem(KEYS.painelLeve, l ? "0" : "1"); return !l; }); };
  const abrirEm = (caminho: string) => {
    setMenu(false);
    router.push(`/${lang}/painel?${caminho}`, { scroll: false });
    window.scrollTo(0, 0);
  };
  const tem = (id: string) => secoes.some((secao) => secao.id === id);
  const comandos: Comando[] = [
    ...(tem("escrever") ? [{ id: "aula", nome: "Escrever uma aula", sobre: "Abre o Escrever já no tipo aula de uma trilha.", fazer: () => abrirEm("aba=escrever&tipo=aula") }] : []),
    ...(tem("escrever") ? [{ id: "artigo", nome: "Escrever uma matéria para o jornal", sobre: "Abre o Escrever no tipo matéria.", fazer: () => abrirEm("aba=escrever&tipo=artigo") }] : []),
    ...(tem("videoaulas") ? [{ id: "gravar", nome: "Gravar uma aula em vídeo", sobre: "Abre as Aulas em vídeo para gravar.", fazer: () => ir("videoaulas") }] : []),
    ...(tem("aovivo") ? [{ id: "marcar", nome: "Marcar uma aula ao vivo", sobre: "Abre a agenda das aulas ao vivo.", fazer: () => ir("aovivo") }] : []),
    { id: "tema", nome: "Trocar claro / escuro", sobre: "Muda o tema do painel e do site neste aparelho.", fazer: trocarTema },
    { id: "leve", nome: leve ? "Sair do modo leve" : "Modo leve", sobre: "Sem animações, sombras e texturas: bom para aparelho fraco e internet ruim.", fazer: alternarLeve },
    { id: "foco", nome: foco ? "Sair do modo foco" : "Modo foco", sobre: "Só o essencial no menu.", fazer: alternarFoco },
    { id: "recolher", nome: compacto ? "Abrir o menu" : "Recolher o menu", sobre: "Deixa só o trilho de ícones, no computador.", fazer: alternarCompacto },
    { id: "tutorial", nome: "Abrir o tutorial", sobre: "O passeio pelo painel, do começo.", fazer: abrirTutorial },
    { id: "teclado", nome: "Atalhos de teclado", sobre: "A lista de atalhos do painel.", fazer: () => setAjudaDoTeclado(true) },
    { id: "glossario", nome: "Glossário do painel", sobre: "O que quer dizer triagem, parecer, retido, passagem de bastão e as outras palavras do painel.", fazer: () => setGlossario(true) },
    { id: "sair", nome: "Sair do painel", sobre: "Fecha a sua sessão neste aparelho.", fazer: sair },
  ];
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  // Ctrl+K (ou Cmd+K) de qualquer lugar; "/" fora de campos de texto; "?" mostra os atalhos; "g" e uma letra vai
  // direto a uma seção (g m: Mesa, g e: Escrever, g c: Conversas…), como nos programas de e-mail.
  const irRef = useRef(ir);
  useEffect(() => {
    irRef.current = ir;
  });
  useEffect(() => {
    let g = 0;
    const tecla = (e: KeyboardEvent) => {
      const escrevendo = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIrPara((aberto) => !aberto);
        return;
      }
      if (escrevendo || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setIrPara(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setAjudaDoTeclado((aberta) => !aberta);
      } else if (e.key === "Escape") {
        setAjudaDoTeclado(false);
      } else if (e.key.toLowerCase() === "g") {
        g = Date.now();
      } else if (Date.now() - g < 1200) {
        const destino = ATALHOS_G[e.key.toLowerCase()];
        g = 0;
        if (destino) {
          e.preventDefault();
          irRef.current(destino);
        }
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const essenciais = ["mesa", "conversas", "escrever", "minhas", "fila", "caderno", "horas", "conta"];
  const noMenu = foco ? secoes.filter((secao) => essenciais.includes(secao.id) || secao.id === atual.id) : secoes;
  // O principal primeiro (o de maior nível) e, quando há mais de dois, "+N": a linha do menu é curta. A lista inteira vai no título.
  const todasAsFuncoes = [...new Set(porNivel(eu.papeis).map((papel) => papeis[papel.papel]))];
  const funcao = !voluntario ? "Comunidade" : todasAsFuncoes.length <= 2 ? todasAsFuncoes.join(" · ") : `${todasAsFuncoes[0]} +${todasAsFuncoes.length - 1}`;
  // O nome do ambiente diz de quem ele é: só a coordenação vê "Coordenação".
  const ambiente = lidera ? "Coordenação" : supervisiona ? "Supervisão" : voluntario ? "Equipe" : "Comunidade";

  return (
    <div className={`painel min-h-screen bg-parchment font-sans text-sm text-ink lg:grid ${leve ? "painel-leve" : ""} lg:grid-cols-[auto_minmax(0,1fr)]`}>
      <TraduzirPainel />
      <TutorialDoPainel
        pronto={!(voluntario && eu.termo_voluntario === false)}
        extras={[
          { rotulo: "Glossário do painel", fazer: () => setGlossario(true) },
          { rotulo: "Atalhos de teclado", fazer: () => setAjudaDoTeclado(true) },
        ]}
      />
      <Paleta aberto={irPara} aoMudar={setIrPara} secoes={secoes} comandos={comandos} ir={ir} />
      <DialogosDoPainel />
      <AvisosDoPainel />
      {ajudaDoTeclado && <AjudaDoTeclado secoes={secoes} fechar={() => setAjudaDoTeclado(false)} />}
      {glossario && <Glossario fechar={() => setGlossario(false)} />}
      {/* Aviso da coordenação, da vice ou da supervisão: aparece por cima de tudo até a pessoa apertar "Entendi". */}
      {(voluntario || eu.supervisao) && <QuadroDeAvisos />}
      {/* O termo de voluntário: quem tem função aceita uma vez; quem recusa sai. Banco antigo não manda o campo e nada aparece. */}
      {voluntario && eu.termo_voluntario === false && <TermoDeVoluntario aceitou={recarregar} sair={sair} />}
      {/* Convite opcional para a pesquisa anônima dos 12 eixos (B6): só para quem já aceitou o termo e ainda não respondeu. */}
      {voluntario && eu.termo_voluntario !== false && <ConviteEixos ir={ir} />}
      {/* Barra do alto no celular: a faixa bordô do site, o nome e o menu. */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-rule bg-folha px-4 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 text-ink lg:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <Star className="h-5 w-5 shrink-0 text-prelo-texto" />
          <span className="truncate font-serif text-lg font-semibold">Instituto Lúcia</span>
          <span className="text-xs text-ink-soft">{ambiente}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setIrPara(true)} aria-label="Ir para uma seção" data-tour="ir-para" className="cursor-pointer border border-rule p-1.5">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="menu-do-painel"
            data-tour="menu-celular"
            className="cursor-pointer border border-rule px-3 py-1.5 font-semibold"
          >
            {menu ? "Fechar" : "Menu"}
          </button>
        </span>
      </div>

      {/* O menu: o trilho das áreas e a lista da área (components/painel/Menu.tsx). No celular, a folha inteira. */}
      <MenuDoPainel
        secoes={noMenu}
        atual={atual}
        ir={ir}
        departamento={foco ? null : meuDepartamento(eu, noMenu.map((secao) => secao.id))}
        fixadas={atalhos.fixadas}
        compacto={compacto}
        alternarCompacto={alternarCompacto}
        aberto={menu}
        alternarMenu={() => setMenu(!menu)}
        eu={{ nome: eu.nome, avatar: eu.avatar }}
        funcao={funcao}
        todasAsFuncoes={todasAsFuncoes}
        ambiente={ambiente}
        ferramentas={
          <>
            <button type="button" onClick={alternarFoco} aria-pressed={foco} title={foco ? "Sair do modo foco: mostrar todas as seções" : "Modo foco: só o essencial no menu"} className={`cursor-pointer border-2 border-ink p-1.5 hover:bg-ink hover:text-parchment ${foco ? "bg-ink text-parchment" : ""}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /></svg>
              <span className="sr-only">Modo foco</span>
            </button>
            <button type="button" onClick={alternarLeve} aria-pressed={leve} title={leve ? "Sair do modo leve" : "Modo leve: sem animações, sombras e texturas"} className={`cursor-pointer border-2 border-ink p-1.5 hover:bg-ink hover:text-parchment ${leve ? "bg-ink text-parchment" : ""}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-4 4-6 7-6 10a6 6 0 0 0 12 0c0-3-2-6-6-10z" /></svg>
              <span className="sr-only">Modo leve</span>
            </button>
            <button type="button" onClick={alternarTelaCheia} aria-pressed={telaCheia} title={telaCheia ? "Sair da tela cheia" : "Tela cheia"} className="cursor-pointer border-2 border-ink p-1.5 hover:bg-ink hover:text-parchment">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{telaCheia ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}</svg>
              <span className="sr-only">Tela cheia</span>
            </button>
          </>
        }
        rodape={
          <>
            <L href="/" className="underline hover:text-prelo-texto">← Voltar ao site</L>
            <Tema />
            <button type="button" onClick={sair} className="cursor-pointer underline hover:text-prelo-texto">Sair</button>
            <IdiomaDoPainel />
          </>
        }
      />

      <div className={`min-w-0 ${menu ? "hidden lg:block" : ""}`}>
        {/* O alto de cada seção: a barra fina com o caminho e os atalhos, e o título no papel, com o selo da seção. */}
        <header key={`cabeca-${atual.id}`} className="painel-cabeca no-print border-b border-rule bg-folha">
          <div className="painel-barra flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-5 py-2.5 sm:px-8">
            <p className="min-w-0 truncate font-mono text-[0.66rem] uppercase tracking-[0.2em] text-ink-soft">
              Painel · {ambiente}
              {" · "}{nomeDoEspaco(espacoDe(atual.id, atual.grupo))}
              {amplo && <span className="ml-2 font-sans text-sm font-bold normal-case tracking-normal text-ink">{atual.nome}</span>}
            </p>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {leads(euReal) && <PreviaDeFuncao previa={previa} mudar={setPrevia} />}
              <button type="button" onClick={() => setIrPara(true)} data-tour="ir-para" className="pn-botao pn-botao-pequeno pn-so-computador">
                <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
                Ir para… <kbd className="font-mono text-[0.6rem]">Ctrl K</kbd>
              </button>
              {amplo && <GuiaDaSecao key={`guia-${atual.id}`} id={atual.id} nome={atual.nome} />}
              <button type="button" onClick={abrirTutorial} data-tour="tutorial" className="pn-botao pn-botao-pequeno">
                Tutorial
              </button>
              {produz && atual.id !== "escrever" && (
                <button type="button" onClick={() => ir("escrever")} data-tour="escrever" className="pn-botao pn-botao-principal pn-botao-pequeno">
                  ＋ Escrever
                </button>
              )}
            </span>
          </div>
          {previa && (
            <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink bg-[#c21f16] px-5 py-2 text-sm font-semibold text-white sm:px-8">
              <span>
                Prévia: você está vendo o painel como <strong>{papeis[previa.papel]}</strong>
                {previa.disciplina ? ` (${previa.disciplina})` : ""}. O menu e os botões são os dessa função; os dados e as ações continuam com a sua conta.
              </span>
              <button type="button" onClick={() => setPrevia(null)} className="ml-auto cursor-pointer border-2 border-white px-2.5 py-0.5 text-xs font-bold hover:bg-white hover:text-[#c21f16]">
                Sair da prévia
              </button>
            </p>
          )}
          {!amplo && (
            <div className="px-5 pt-6 pb-6 sm:px-8">
              <h1 className="flex items-center gap-3.5 font-serif text-[1.9rem] font-semibold leading-none sm:text-[2.2rem]">
                <span className="selo h-11 w-11 shrink-0 bg-parchment">
                  <Icone id={atual.id} className="h-7 w-7 text-prelo-texto" />
                </span>
                {atual.nome}
              </h1>
              <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">{atual.sobre}</p>
              <div className="mt-4">
                <GuiaDaSecao key={atual.id} id={atual.id} nome={atual.nome} />
              </div>
            </div>
          )}
        </header>
        <div key={atual.id} className={`painel-conteudo mx-auto ${amplo ? "max-w-none px-2 py-2 sm:px-3" : atual.id === "rede" ? "max-w-7xl px-4 py-6 sm:px-6" : "max-w-5xl px-5 py-7 sm:px-8"}`}>
          {eu.suspenso && <p className="mb-6 border-l-4 border-oxblood bg-parchment-deep px-4 py-3 text-oxblood">Esta conta está suspensa: você pode ler, mas não enviar.</p>}
          {interditado && (
            <p role="status" className="mb-6 border-2 border-oxblood bg-parchment-deep px-4 py-3 font-semibold text-oxblood">
              {interditado.geral
                ? "O site está fora do ar: o público vê só um aviso. A entrada e o painel continuam funcionando."
                : `Áreas fechadas ao público agora: ${interditado.areas.map((id) => areasPublicas.find((area) => area.id === id)?.nome ?? id).join(", ")}.`}{" "}
              {(lidera || supervisiona) && (
                <button type="button" className="cursor-pointer font-normal underline" onClick={() => ir("interdicao")}>
                  Ver em Interdição e expurgo
                </button>
              )}
            </p>
          )}
          {atual.id === "mesa" && <Mesa me={eu} resumo={r ?? null} recarregar={() => { recarregar(); resumo.recarregar(); }} ir={ir} secoes={secoes} acompanha={acompanha} />}
          {voluntario && <Repasse usuario={eu.id} />}
          {atual.id === "conversas" && <Conversas me={eu} />}
          {atual.id === "rede" && <Equipe usuario={eu.id} lider={leads(eu)} modera={lidera || supervisiona} aprendiz={eu.aprendizado} recarregar={recarregar} />}
          {atual.id === "escrever" && <Escrever me={eu} />}
          {atual.id === "videoaulas" && <Videoaulas me={eu} />}
          {atual.id === "aovivo" && <AulasAoVivo me={eu} />}
          {atual.id === "estudio" && <EstudioDeDesign me={eu} />}
          {atual.id === "caderno" && <CadernoNoPainel />}
          {atual.id === "escritorio" && <EscritorioNoPainel />}
          {atual.id === "tarefas" && <Tarefas me={eu} ir={ir} />}
          {atual.id === "exercicios" && <Exercicios me={eu} />}
          {atual.id === "acervo-dentro" && <AcervoPorDentro />}
          {atual.id === "contribuicoes" && <MinhasContribuicoes />}
          {atual.id === "avisos" && <AvisosEquipe />}
          {atual.id === "minhas" && <Fila key="minhas" me={eu} minhas />}
          {atual.id === "juntas" && <Fila key="juntas" me={eu} juntas />}
          {atual.id === "fila" && <Fila key="fila" me={eu} />}
          {atual.id === "vale-curadoria" && <ValeOEscritoCuradoria me={eu} />}
          {atual.id === "rede-propostas" && <RedePropostas />}
          {atual.id === "traducoes" && <Traducoes irEscrever={() => ir("escrever")} />}
          {atual.id === "triagem" && <Fila key="triagem" me={eu} triagem />}
          {atual.id === "curriculo" && <DisciplinasETrilhas me={eu} />}
          {atual.id === "atividade" && <AtividadeDoSite />}
          {atual.id === "fontes" && <FontesAbertas />}
          {atual.id === "materiais" && <Materiais me={eu} />}
          {atual.id === "divulgacao" && <Divulgacao me={eu} />}
          {atual.id === "comunidade" && <Comunidade me={eu} />}
          {atual.id === "reforco" && <Reforco />}
          {atual.id === "mural" && <MuralFila me={eu} />}
          {atual.id === "gaveta" && <GavetaFila />}
          {atual.id === "boletim" && <Boletim />}
          {atual.id === "pessoas" && <Pessoas me={eu} />}
          {atual.id === "supervisao" && (
            <>
              <Supervisao />
              <CuidadoDaEquipe />
            </>
          )}
          {atual.id === "reunioes" && <Conversas me={eu} inicial="reunioes" />}
          {atual.id === "horas" && <Horas me={eu} />}
          {atual.id === "centro" && <CentroDeControle ir={ir} />}
          {atual.id === "site" && <Site />}
          {atual.id === "abertura" && <AvisoDeAbertura />}
          {atual.id === "podcast" && <Podcast />}
          {atual.id === "emissoras" && (
            <>
              <RadioNoAr />
              <RadioCanais />
              <SugerirEmissora />
            </>
          )}
          {atual.id === "apoiadores" && <Apoio />}
          {atual.id === "tecnico" && <Tecnico />}
          {atual.id === "seguranca" && <SegurancaSucessao me={eu} />}
          {atual.id === "interdicao" && <Interdicao me={eu} aoMudar={estadoDoSite.recarregar} />}
          {atual.id === "registro" && <RegistroDeAtividades />}
          {atual.id === "departamentos" && <Departamentos me={eu} ir={ir} />}
          {atual.id === "assembleias" && <Assembleias me={eu} />}
          {atual.id === "pautas" && <Pautas me={eu} ir={ir} />}
          {atual.id === "biblioteca" && <Biblioteca ir={ir} />}
          {atual.id === "nucleos" && <Nucleos me={eu} />}
          {atual.id === "aulas-a-escrever" && <FilaDeAulas />}
          {atual.id === "estatisticas" && (
            <>
              <Estatisticas />
              <RetornoDosAlunos />
              <CuidadoDaEquipe />
            </>
          )}
          {atual.id === "termos" && <TermosAceitos />}
          {atual.id === "operacao" && <Operacao />}
          {atual.id === "imprensa" && <CaixaDeImprensa />}
          {atual.id === "ensino" && <Ensino />}
          {atual.id === "previa" && <Previa />}
          {atual.id === "eixos-equipe" && <EixosEquipe coordena={lidera || can(eu, "vice")} />}
          {atual.id === "saude" && <SaudeNoPainel me={eu} />}
          {atual.id === "erros" && <ErrosRelatados />}
          {atual.id === "controles-avancados" && <ControlesAvancados coordena={lidera || can(eu, "vice")} edita={can(eu, "coordenacao", "vice", "curadoria", "desenvolvimento")} cura={can(eu, "coordenacao", "vice", "curadoria")} />}
          {atual.id === "confirmacoes" && <Confirmacoes />}
          {atual.id === "conta" && (
            <MinhaConta
              me={eu}
              recarregar={recarregar}
              sair={sair}
              curriculo={eu.papeis.some((p) => p.papel === "educacao" || p.papel === "educacao_secundaria") ? <Curriculo me={eu} recarregar={recarregar} /> : null}
              avisosETrava={<AvisosETrava />}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A primeira tela (B39): a saudação e, logo abaixo, cinco partes que nunca se misturam (pendências, recados, avisos de
 * segurança, saúde da casa e atalhos), na ordem da função da pessoa. A regra está em mesa-funcoes.ts e o desenho em
 * MesaOrganizada.tsx; aqui só se juntam as peças que o painel já tinha. Nada que a Mesa mostrava deixou de aparecer.
 */
function Mesa({ me, resumo, recarregar, ir, secoes, acompanha }: { me: Me; resumo: Resumo | null; recarregar: () => void; ir: (aba: string) => void; secoes: Secao[]; acompanha: boolean }) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const r = resumo;
  const coordena = can(me, "coordenacao");
  const funcoes = funcoesDaPessoa(me.papeis.map((papel) => papel.papel));
  const abre = (id: string) => secoes.some((secao) => secao.id === id && secao.mostra);
  const dadosDoResumo = r as unknown as Record<string, number | undefined> | null;
  const pendenciasDe = (funcao: FuncaoDaMesa) => montarPendencias(dadosDoResumo, { funcao, coordena, abre });
  const total = somar(pendenciasDe(funcoes[0]));
  const voluntario = me.papeis.length > 0;

  const hora = new Date().getHours();
  const saudacao = hora < 5 ? "Boa noite" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const hoje = new Date().toLocaleDateString(localDoPainel(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Data de luta: se hoje está no quadro "Neste dia" (content/neste-dia.json), a Mesa lembra.
  const diaMes = `${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
  const dataDeLuta = (nesteDia.fatos as { dia: string; ano: number; texto: string; link: string }[]).find((f) => f.dia === diaMes);
  const resumoDoDia = !r ? null : total === 0 ? "Tudo em dia." : total === 1 ? "Uma coisa espera por você." : `${total} coisas esperam por você.`;

  const cabeca = (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="pn-rotulo">{hoje}</p>
          <h2 className="pn-titulo text-[2rem] leading-tight max-sm:text-[1.7rem]">
            {saudacao}, {me.nome.split(" ")[0]}.
          </h2>
        </div>
        <p className="pn-sobre">{resumoDoDia ?? <span className="painel-carregando">Carregando…</span>}</p>
      </div>
      {dataDeLuta && (
        <p className="pn-cartao max-w-2xl text-[0.95rem] leading-snug">
          <span className="pn-rotulo">Hoje, em {dataDeLuta.ano} · </span>
          {dataDeLuta.texto}{" "}
          <a href={dataDeLuta.link} target="_blank" rel="noopener noreferrer" className="pn-ajuda underline">fonte</a>
        </p>
      )}
      {voluntario ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Suas funções">
          {porNivel(me.papeis).map((papel) => (
            <li key={papel.id} title={oQueFaz[papel.papel]} className="pn-selo pn-selo-neutro">
              <strong>{papeis[papel.papel]}</strong>
              {papel.disciplina && <span> · {nomeDaArea(papel.disciplina)}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="pn-sobre">Você participa da comunidade e pode escrever e enviar contribuições. Para revisar, traduzir, ensinar ou cuidar de uma disciplina, peça uma função mais abaixo.</p>
      )}
    </section>
  );

  return (
    <MesaOrganizada
      funcoes={funcoes}
      todasAsFuncoes={coordena}
      pendencias={pendenciasDe}
      carregando={!r}
      abre={abre}
      nomeDe={(id) => secoes.find((secao) => secao.id === id)?.nome ?? id}
      ir={ir}
      recadosNovos={me.avisos ?? 0}
      icone={(id) => <Icone id={id} />}
      pecas={{
        cabeca,
        agora: (
          <>
            <AgoraAoVivo me={me} ir={ir} />
            <FeriasNaMesa />
            {voluntario && <PrimeiraSemana me={me} ir={ir} />}
          </>
        ),
        continuar: (
          <div className="grid gap-4 empty:hidden sm:grid-cols-2">
            <Continuar />
            {voluntario && <SuasHoras me={me} ir={ir} />}
          </div>
        ),
        tarefas: voluntario ? <ParaVoceHoje me={me} ir={ir} /> : undefined,
        recados: <Recados recarregar={recarregar} />,
        agradecimentos: voluntario ? <Agradecimentos /> : undefined,
        casa: voluntario ? (
          <>
            <Situacao lidera={can(me, "coordenacao")} supervisiona={can(me, "supervisao")} ir={ir} />
            <ConquistasDaEquipe />
          </>
        ) : undefined,
        // Sem função e sem acompanhar o site não há nada para mostrar: a parte "Saúde da casa" nem aparece vazia.
        movimento:
          voluntario || acompanha ? (
            <div className="grid items-start gap-4 empty:hidden md:grid-cols-2">
              {voluntario && <Termometro />}
              <NoSiteAgora acompanha={acompanha} ir={ir} />
            </div>
          ) : undefined,
        fixadas: voluntario ? <Atalhos secoes={secoes} ir={ir} icone={(id) => <Icone id={id} />} /> : undefined,
        apoio: (
          <>
            {/* Para a equipe e para quem chega: a sugestão à divulgação, o pedido de função e os guias. */}
            {voluntario && !can(me, "marketing") && <SugerirAoMarketing />}
            {/* Quem não tem função pede a primeira; quem já tem pode pedir outra: uma pessoa acumula quantas a coordenação confiar. */}
            {!can(me, "coordenacao") && <Candidatura me={me} />}
            <div className="grid items-start gap-4 md:grid-cols-2">
              {voluntario && (
                <details className="pn-cartao">
                  <summary className="cursor-pointer font-semibold">Guia de primeiros passos da sua função</summary>
                  <div className="mt-3">
                    <PorOndeComecar me={me} ir={ir} />
                  </div>
                </details>
              )}
              <DicaDoTutorial abrir={abrirTutorial} />
            </div>
          </>
        ),
      }}
    />
  );
}

/** Qualquer pessoa da equipe manda uma ideia para a divulgação: uma data, uma pauta, um post. Cai na caixa do marketing. */
function SugerirAoMarketing() {
  const acao = useAcao();
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <h2 className="jornal-secao">
        <span className="jornal-editoria">Ideia para a divulgação</span>
      </h2>
      {!aberto ? (
        <p className="mt-3"><button type="button" className={botaoClaro} onClick={() => setAberto(true)}>Sugerir um post, uma data ou uma pauta ao marketing</button></p>
      ) : (
        <form className="painel-cartao mt-3 max-w-2xl p-4" onSubmit={async (e) => { e.preventDefault(); if (await acao.agir("marketing_sugerir", { p_texto: texto, p_quando: quando || null }, "Sugestão enviada ao marketing.")) { setTexto(""); setQuando(""); } }}>
          <label className="block">
            O que você sugere
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000} placeholder="Uma data importante, um post, uma campanha, uma pauta para as redes…" className={campo} />
          </label>
          <label className="mt-2 block max-w-xs">
            Para quando (opcional)
            <input type="date" value={quando} onChange={(e) => setQuando(e.target.value)} className={campo} />
          </label>
          <p className="mt-3 flex gap-3">
            <button type="submit" className={botao} disabled={acao.ocupado || texto.trim().length < 5}>Enviar</button>
            <button type="button" className={botaoClaro} onClick={() => setAberto(false)}>Fechar</button>
          </p>
          <Aviso texto={acao.aviso} />
        </form>
      )}
    </section>
  );
}

/** Como o instituto está agora, em três quadros: quem é a equipe e, para a coordenação, o estado do site. */
function Situacao({ lidera, supervisiona, ir }: { lidera: boolean; supervisiona: boolean; ir: (aba: string) => void }) {
  const membros = useLista<Membro[]>("equipe_membros");
  const site = useLista<Controles>("site");
  const online = membros.dados?.filter((membro) => membro.online && !membro.eu).length ?? 0;
  const celula = "painel-surge flex min-w-0 flex-col gap-1 border-r border-b border-rule px-4 py-3.5 text-left";
  const clicavel = `${celula} cursor-pointer hover:bg-parchment`;
  const etiqueta = "font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-soft";
  const etiquetaDeAlerta = "font-mono text-[0.62rem] uppercase tracking-[0.16em] text-prelo-texto";
  const valor = "font-serif text-2xl font-semibold leading-tight";
  const detalhe = "text-[0.8rem] leading-snug text-ink-soft";
  return (
    <div className="overflow-hidden border-2 border-ink bg-folha">
      <div className="-mr-px -mb-px grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        <button type="button" onClick={() => ir("conversas")} className={clicavel}>
          <span className={etiqueta}>Equipe</span>
          <span className={valor}>{membros.dados ? <>{membros.dados.length} {membros.dados.length === 1 ? "pessoa" : "pessoas"}</> : "…"}</span>
          <span className={`flex items-center gap-1.5 ${detalhe}`}>
            {online > 0 && <span aria-hidden className="painel-pulso inline-block h-2 w-2 rounded-full bg-ok" />}
            {online > 0 ? `${online} online agora` : "Ninguém mais online agora"}
          </span>
        </button>
        {site.dados &&
          (lidera ? (
            <>
              <button type="button" onClick={() => ir(site.dados?.pausa ? "site" : "triagem")} className={`${clicavel} ${site.dados.pausa ? "bg-parchment" : ""}`}>
                <span className={site.dados.pausa ? etiquetaDeAlerta : etiqueta}>Envios do público{site.dados.pausa ? " · atenção" : ""}</span>
                <span className={`${valor} ${site.dados.pausa ? "text-oxblood" : ""}`}>{site.dados.pausa ? "Pausados" : "Abertos"}</span>
                <span className={detalhe}>{site.dados.pausa ? "Ninguém de fora envia nada até você reabrir (Controles do site)" : "Ver o que chegou na triagem · pausar em Controles do site"}</span>
              </button>
              <button type="button" onClick={() => ir("site")} className={clicavel}>
                <span className={etiqueta}>Faixa do alto</span>
                <span className={valor}>{site.dados.faixa ? "Com chamado" : "Texto de sempre"}</span>
                <span className={`truncate ${detalhe}`}>{site.dados.faixa || "Nenhum chamado no ar"}</span>
              </button>
            </>
          ) : supervisiona ? (
            <button type="button" onClick={() => ir("supervisao")} className={`${clicavel} ${site.dados.pausa ? "bg-parchment" : ""}`}>
              <span className={site.dados.pausa ? etiquetaDeAlerta : etiqueta}>Envios do público{site.dados.pausa ? " · atenção" : ""}</span>
              <span className={`${valor} ${site.dados.pausa ? "text-oxblood" : ""}`}>{site.dados.pausa ? "Pausados" : "Abertos"}</span>
              <span className={detalhe}>{site.dados.pausa ? "Ninguém de fora envia nada até a pausa sair" : "A pausa e o modo de segurança estão em Supervisão"}</span>
            </button>
          ) : (
            site.dados.pausa && (
              <div className={`${celula} bg-parchment`}>
                <span className={etiquetaDeAlerta}>Envios do público · atenção</span>
                <span className={`${valor} text-oxblood`}>Pausados</span>
                <span className={detalhe}>A coordenação pausou o que vem de fora. O trabalho da equipe segue normal.</span>
              </div>
            )
          ))}
      </div>
    </div>
  );
}

/** Quem ainda não tem função pede uma aqui; quem já tem pede mais uma. A coordenação responde pelo próprio painel. */
function Candidatura({ me }: { me: Me }) {
  const { t } = useI18n();
  const pedidos = useLista<{ id: string; papel: Role["papel"]; disciplina: string | null; status: string; criado_em: string }[]>("candidaturas_minhas");
  const pedido = useAcao(pedidos.recarregar);
  const [aberto, setAberto] = useState(me.papeis.length === 0);
  // As funções que a pessoa ainda não tem (as por disciplina podem repetir em outra disciplina).
  const pediveis = (["educacao", "educacao_secundaria", "mentoria", "mediacao", "revisao", "traducao", "jornalismo", "curadoria", "marketing", "desenvolvimento"] as const).filter(
    (papel) => ["educacao", "educacao_secundaria", "mentoria"].includes(papel) || !me.papeis.some((item) => item.papel === papel),
  );
  const [quero, setQuero] = useState<{ papel: string; disciplina: string; mensagem: string }>({ papel: pediveis[0] ?? "educacao", disciplina: "", mensagem: "" });
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  const porDisciplina = quero.papel === "educacao" || quero.papel === "educacao_secundaria" || quero.papel === "mentoria";
  if (pediveis.length === 0) return null;
  if (!aberto) {
    return (
      <p>
        <button type="button" className={elo} onClick={() => setAberto(true)}>
          Pedir outra função
        </button>
        <span className="text-ink-soft"> · Uma pessoa pode acumular funções: jornalista e tradutora, educadora e curadora…</span>
      </p>
    );
  }
  return (
    <section className="painel-cartao p-5">
      <h2 className="font-serif text-2xl font-semibold">{me.papeis.length === 0 ? "Quero ser voluntário" : "Pedir outra função"}</h2>
      <p className="mt-1 text-ink-soft">{me.papeis.length === 0 ? "Diga em que quer ajudar e conte um pouco da sua experiência." : "As funções se somam: você continua com as que já tem e ganha as ferramentas da nova."}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          Em que função
          <select value={quero.papel} onChange={(e) => setQuero({ ...quero, papel: e.target.value })} className={campo}>
            {pediveis.map((papel) => (
              <option key={papel} value={papel}>{papeis[papel]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Disciplina{porDisciplina ? "" : " (opcional)"}
          <select value={quero.disciplina} onChange={(e) => setQuero({ ...quero, disciplina: e.target.value })} className={campo}>
            <option value="">{porDisciplina ? "Escolha…" : "Todo o site"}</option>
            {areaSlugs.map((area) => (
              <option key={area} value={area}>{t.areas[area][0]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        Sua experiência e por que quer ajudar
        <textarea value={quero.mensagem} onChange={(e) => setQuero({ ...quero, mensagem: e.target.value })} rows={3} maxLength={2000} className={campo} />
      </label>
      <p className="mt-1 text-ink-soft">{oQueFaz[quero.papel as Role["papel"]]}</p>
      <button
        type="button"
        className={`mt-3 ${botao}`}
        disabled={pedido.ocupado || quero.mensagem.trim().length < 20 || (porDisciplina && !quero.disciplina)}
        onClick={async () => {
          const ok = await pedido.agir("candidatar", { p_papel: quero.papel, p_disciplina: quero.disciplina || null, p_mensagem: quero.mensagem }, "Pedido enviado à coordenação.");
          if (ok) setQuero({ ...quero, mensagem: "" });
        }}
      >
        Enviar pedido
      </button>
      <Aviso texto={pedido.aviso} />
      {(pedidos.dados?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1 text-ink-soft">
          {pedidos.dados?.map((item) => (
            <li key={item.id}>
              {papeis[item.papel]} · {nomeDaArea(item.disciplina)} · {data(item.criado_em)} · <span className={rotulo}>{situacoes[item.status] ?? item.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Tudo o que é da própria pessoa: como aparece, como entra e como se protege. */
/** Avisos do navegador (sem prévia) e a trava das conversas com a digital. Os dois ficam só neste aparelho. */
function AvisosETrava() {
  const [modo, setModo] = useState<ModoDeAviso>(() => modoDeAviso());
  const [trava, setTrava] = useState(() => travaLigada());
  const [temDigital, setTemDigital] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState("");
  useEffect(() => { void travaDisponivel().then(setTemDigital); }, []);
  async function trocarModo(novo: ModoDeAviso) {
    setAviso("");
    const ok = await escolherModo(novo);
    setModo(ok ? novo : modoDeAviso());
    if (!ok && novo !== "nenhum") setAviso(permissaoDeAviso() === "denied" ? "O navegador está bloqueando avisos deste site. Libere nas configurações do site e tente de novo." : "Não foi possível ligar os avisos neste navegador.");
  }
  return (
    <div className="mt-4 space-y-3 border-t border-rule pt-3">
      <div>
        <p className="font-semibold">Avisos de mensagem neste aparelho</p>
        <p className="text-xs text-ink-soft">O aviso nunca mostra o texto: diz só que chegou mensagem (e, se você quiser, de quem). Só funciona com o painel aberto em alguma aba.</p>
        {avisosDisponiveis() ? (
          <select value={modo} onChange={(e) => void trocarModo(e.target.value as ModoDeAviso)} className={`${campo} max-w-sm`} aria-label="Avisos de mensagem">
            <option value="nenhum">Sem avisos</option>
            <option value="generico">Avisar que chegou mensagem (sem dizer de quem)</option>
            <option value="nome">Avisar com o nome de quem mandou</option>
          </select>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Este navegador não mostra avisos.</p>
        )}
      </div>
      <div>
        <p className="font-semibold">Trancar as conversas com a digital</p>
        <p className="text-xs text-ink-soft">Usa a mesma digital cadastrada para entrar. Pede a digital ao abrir as conversas (e, nas conversas que você trancar uma a uma, a cada vez). Vale só neste aparelho.</p>
        {temDigital === false && <p className="mt-1 text-sm text-ink-soft">Cadastre a digital deste aparelho (ao lado) para poder trancar.</p>}
        {temDigital && (
          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={trava} onChange={(e) => { ligarTrava(e.target.checked); setTrava(e.target.checked); if (e.target.checked) travarAgora(); }} />
            <span>Pedir a digital ao abrir as conversas</span>
          </label>
        )}
      </div>
      <Aviso texto={aviso} />
    </div>
  );
}

/** O cartão público do educador: formação em uma linha e endereços (portfólio, Lattes, site, redes). Tudo opcional. */
function Curriculo({ me, recarregar }: { me: Me; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const campos: [string, string, string][] = [
    ["formacao", "Formação, em uma linha", "Ex.: Licenciada em História (UERJ), mestranda em Educação"],
    ["portfolio", "Portfólio", "https://"],
    ["lattes", "Currículo Lattes", "https://lattes.cnpq.br/…"],
    ["site", "Site pessoal", "https://"],
    ["instagram", "Instagram", "https://instagram.com/…"],
    ["youtube", "YouTube", "https://youtube.com/…"],
    ["linkedin", "LinkedIn", "https://linkedin.com/in/…"],
    ["github", "GitHub", "https://github.com/…"],
  ];
  const [valores, setValores] = useState<Record<string, string>>(() => ({ ...(me.curriculo ?? {}) }));
  return (
    <section className="painel-cartao p-5">
      <h2 className="font-serif text-xl font-semibold">Seu cartão de educador</h2>
      <p className="mt-1 text-ink-soft">Aparece no fim das aulas da sua disciplina e em “Quem somos”, com o seu nome, o “sobre você” e o ícone. Tudo aqui é opcional: o que ficar vazio não aparece.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {campos.map(([chave, rotuloDoCampo, dica]) => (
          <label key={chave} className={`block ${chave === "formacao" ? "sm:col-span-2" : ""}`}>
            {rotuloDoCampo}
            <input value={valores[chave] ?? ""} onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))} maxLength={chave === "formacao" ? 160 : 300} placeholder={dica} className={campo} />
          </label>
        ))}
      </div>
      <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado} onClick={() => acao.agir("perfil_curriculo", { p: valores }, "Cartão guardado.")}>Guardar o cartão</button>
      <Aviso texto={acao.aviso} />
    </section>
  );
}


const PAPEIS_DA_PREVIA: Role["papel"][] = ["vice", "supervisao", "curadoria", "mediacao", "educacao", "educacao_secundaria", "revisao", "traducao", "jornalismo", "mentoria", "marketing", "desenvolvimento", "representante", "porta_voz", "saude"];
const POR_DISCIPLINA: Role["papel"][] = ["educacao", "educacao_secundaria", "mentoria", "representante"];

/** A conta como se tivesse só a função escolhida: o resto (nome, id, preferências) continua o de quem está olhando. */
function previaComo(eu: Me, papel: Role["papel"], disciplina: string | null): Me {
  const papeisDaPrevia: Role[] = [{ id: `previa-${papel}`, papel, disciplina }];
  return {
    ...eu,
    papeis: papeisDaPrevia,
    nivel: nivelDe(papeisDaPrevia),
    supervisao: papel === "vice" || papel === "supervisao",
    desenha: ["design", "marketing", "jornalismo"].includes(papel),
    convites: [],
    termo_voluntario: true,
  };
}

/** "Ver como…": a coordenação escolhe uma função (e a disciplina, quando a função é por disciplina). */
function PreviaDeFuncao({ previa, mudar }: { previa: { papel: Role["papel"]; disciplina: string | null } | null; mudar: (p: { papel: Role["papel"]; disciplina: string | null } | null) => void }) {
  const { t } = useI18n();
  const [papel, setPapel] = useState<Role["papel"] | "">(previa?.papel ?? "");
  const [disciplina, setDisciplina] = useState(previa?.disciplina ?? areaSlugs[0]);
  const porDisciplina = papel !== "" && POR_DISCIPLINA.includes(papel);
  return (
    <span className="flex items-center gap-1.5" title="Ver o painel como uma função veria">
      <label className="sr-only" htmlFor="previa-papel">Ver como</label>
      <select
        id="previa-papel"
        value={papel}
        onChange={(e) => {
          const novo = e.target.value as Role["papel"] | "";
          setPapel(novo);
          mudar(novo ? { papel: novo, disciplina: POR_DISCIPLINA.includes(novo) ? disciplina : null } : null);
        }}
        className="max-w-44 cursor-pointer border-2 border-ink bg-folha px-1.5 py-0.5 text-xs font-semibold"
      >
        <option value="">Ver como… (prévia)</option>
        {PAPEIS_DA_PREVIA.map((p) => (
          <option key={p} value={p}>{papeis[p]}</option>
        ))}
      </select>
      {porDisciplina && (
        <select
          aria-label="Disciplina da prévia"
          value={disciplina}
          onChange={(e) => {
            setDisciplina(e.target.value);
            if (papel) mudar({ papel, disciplina: e.target.value });
          }}
          className="max-w-36 cursor-pointer border-2 border-ink bg-folha px-1.5 py-0.5 text-xs"
        >
          {areaSlugs.map((a) => (
            <option key={a} value={a}>{t.areas[a][0]}</option>
          ))}
        </select>
      )}
    </span>
  );
}
