// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { areasPublicas } from "@/lib/interdicao";
import { can, getClient, hasBackend, leads, manages, type Me, porNivel, type Role, rpc, signOut, useMe } from "@/lib/backend";
import { limparIndice } from "@/lib/busca-local";
import { registerDevice } from "@/lib/device";
import { avisar, avisosDisponiveis, escolherModo, type ModoDeAviso, modoDeAviso, permissaoDeAviso } from "@/lib/notificacoes";
import { ligarTrava, travaDisponivel, travaLigada, travarAgora } from "@/lib/trava";
import { applyPrefs, readPrefs } from "@/lib/prefs";
import { senhaVazada } from "@/lib/senha";
import { getItem, KEYS, setItem } from "@/lib/storage";
import { L, useI18n } from "../I18n";
import { Star } from "../Masthead";
import { AulasAoVivo } from "./AoVivo";
import { Avatar } from "./Avatar";
import { AvisosEquipe, QuadroDeAvisos } from "./Avisos";
import { Estatisticas } from "./Estatisticas";
import { TermoDeVoluntario } from "./Termo";
import { Aviso, botao, botaoClaro, campo, data, elo, localDoPainel, oQueFaz, PAINEL_MUDOU, papeis, rotulo, situacoes, useAcao, useLista } from "./comum";
import { Comunidade, MuralFila, SugerirEmissora } from "./Cuidar";
import { Apoio } from "./Apoio";
import { Boletim } from "./Boletim";
import { CadernoNoPainel } from "./Caderno";
import { EstudioDeDesign } from "./design/EstudioDeDesign";
import { PorOndeComecar } from "./Comecar";
import { AcervoPorDentro, MinhasContribuicoes, ParaVoceHoje, Tarefas } from "./Tarefas";
import { Conversas } from "./Conversas";
import { Curriculo as DisciplinasETrilhas } from "./Curriculo";
import { Divulgacao } from "./Divulgacao";
import { Equipe, type Membro } from "./Equipe";
import { Repasse } from "./Sigilo";
import { Escrever } from "./Escrever";
import { FontesAbertas } from "./FontesAbertas";
import { Fila } from "./Fila";
import { GavetaFila } from "./GavetaFila";
import { Horas } from "./Horas";
import { IdiomaDoPainel, TraduzirPainel } from "./Idioma";
import { Interdicao } from "./Interdicao";
import { AvisoDeAbertura, RegistroDeAtividades, SegurancaSucessao } from "./Lideranca";
import { Materiais } from "./Materiais";
import { MinhaConta } from "./MinhaConta";
import { Pessoas } from "./Pessoas";
import { Reunioes } from "./Reunioes";
import { Podcast } from "./podcast/Podcast";
import { Reforco } from "./Reforco";
import { Supervisao } from "./Supervisao";
import { Tecnico } from "./Tecnico";
import { Traducoes } from "./Traducoes";
import { Recados, SegundoFator } from "./Seguranca";
import { type Controles, Site } from "./Site";
import { Videoaulas } from "./Videoaulas";

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

/** Um ícone de traço para cada seção do menu, no mesmo desenho dos ícones do site. */
const icones: Record<string, string> = {
  mesa: "M4 20V9l8-5 8 5v11M9 20v-6h6v6",
  conversas: "M4 5h16v11H10l-4.5 4v-4H4z",
  rede: "M4 4h16v16H4zM8 9h8M8 13h5",
  escrever: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  videoaulas: "M3 6h12v12H3zM15 10l6-3v10l-6-3",
  minhas: "M4 6h16M4 12h16M4 18h10",
  juntas: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 2.7-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M18 20c0-2.2-1-3.9-2.6-4.6",
  fila: "M4 7l2 2 4-4M4 17l2 2 4-4M13 7h7M13 17h7",
  triagem: "M3 5h18l-7 8v6l-4 2v-8z",
  materiais: "M3 6h6l2 2h10v11H3z",
  fontes: "M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z",
  comunidade: "M4 5h12v8H9l-4 3v-3H4zM18 9h2v8h-1v3l-4-3h-4",
  reforco: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  mural: "M3 4h18v12H3zM8 20h8M12 16v4",
  boletim: "M3 6h18v12H3zM3 6l9 7 9-7",
  pessoas: "M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6",
  horas: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  site: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4",
  abertura: "M3 4h18v16H3zM3 9h18M7 13h10M7 16h6",
  podcast: "M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8",
  apoiadores: "M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 5.4 8.8 10.9 8.8 10.9s8.8-5.5 8.8-10.9z",
  seguranca: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  registro: "M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5",
  estatisticas: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  emissoras: "M3 9h18v11H3zM7 9l10-5M8.5 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M14 13h4M14 16h4",
  reunioes: "M3 7h12v10H3zM15 10l6-3v10l-6-3M6 20h6",
  curriculo: "M4 4h16v16H4zM4 10h16M10 10v10",
  conta: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8",
  aovivo: "M3 7h13v10H3zM16 10l5-3v10l-5-3M6 4h7",
  estudio: "M4 20l4-1 11-11-3-3L5 16zM13 8l3 3M4 20v-4",
  caderno: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4",
  avisos: "M4 11h3l7-5v12l-7-5H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11",
  traducoes: "M4 5h8M8 3v2M5 5c0 4 3 7 6 8M11 5c-1 3-3 6-6 8M13 21l4-9 4 9M14.5 18h5",
  divulgacao: "M3 10v4h3l7 5V5l-7 5zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11",
  supervisao: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  tecnico: "M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12",
  interdicao: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  gaveta: "M3 4h18v6H3zM3 10v10h18V10M10 7h4M10 15h4",
};

function Icone({ id, className = "h-[18px] w-[18px]" }: { id: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={icones[id] ?? icones.mesa} />
    </svg>
  );
}

/** Sem acento e em minúsculas, para a busca do "Ir para" achar "seguranca" em "Segurança". */
const simples = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * "Ir para…": Ctrl+K (ou /) abre uma caixa que procura entre as seções pelo nome, pela área ou pelo que
 * cada uma faz. Setas escolhem, Enter abre, Esc fecha. Com mais de vinte seções, é o caminho mais curto.
 */
// Montada só enquanto está aberta: cada abertura começa com a busca vazia e o cursor no campo.
function IrPara({ secoes, fechar, ir }: { secoes: Secao[]; fechar: () => void; ir: (id: string) => void }) {
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const achadas = useMemo(() => {
    const termo = simples(busca.trim());
    if (!termo) return secoes;
    return secoes.filter((secao) => simples(`${secao.nome} ${secao.grupo} ${secao.sobre}`).includes(termo));
  }, [busca, secoes]);

  const escolher = (id: string) => {
    fechar();
    ir(id);
  };
  return (
    <div className="painel-veu fixed inset-0 z-50 flex items-start justify-center bg-[#17130e]/60 px-4 pt-[12vh]" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Ir para uma seção" className="painel-ir w-full max-w-lg border-2 border-ink bg-parchment text-ink" onClick={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-3 border-b-2 border-ink px-4">
          <span className="sr-only">Procurar seção</span>
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 text-oxblood" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input
            autoFocus
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setIndice(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") fechar();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndice((i) => Math.min(i + 1, achadas.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndice((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && achadas[indice]) escolher(achadas[indice].id);
            }}
            placeholder="Ir para… (fila, horas, rádio)"
            className="min-w-0 flex-1 bg-transparent py-3.5 text-base outline-none placeholder:text-ink-soft"
          />
          <kbd className="font-mono text-[0.65rem] text-ink-soft">Esc</kbd>
        </label>
        <ul className="max-h-[55vh] overflow-y-auto py-1">
          {achadas.length === 0 && <li className="px-4 py-3 text-ink-soft">Nenhuma seção com esse nome.</li>}
          {achadas.map((secao, i) => (
            <li key={secao.id}>
              <button
                type="button"
                onMouseEnter={() => setIndice(i)}
                onClick={() => escolher(secao.id)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left ${i === indice ? "bg-ink text-parchment" : ""}`}
              >
                <Icone id={secao.id} className={`h-5 w-5 ${i === indice ? "text-[#e0372b]" : "text-oxblood"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{secao.nome}</span>
                  <span className={`block truncate text-xs ${i === indice ? "text-[#cdbb91]" : "text-ink-soft"}`}>{secao.sobre}</span>
                </span>
                {Boolean(secao.conta) && <span className="bg-[#c21f16] px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold text-white">{secao.conta}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Sem uso por este tempo, o painel se fecha sozinho: aparelho esquecido aberto não vira porta de entrada. */
const OCIOSO = 30 * 60 * 1000;


/** Claro ou escuro, como no site: a escolha fica guardada no navegador. */
function Tema() {
  // O cabeçalho do site não existe aqui dentro, então é o painel que reaplica o tema e as preferências de leitura.
  useLayoutEffect(() => {
    const tema = getItem(KEYS.theme);
    if (tema === "light" || tema === "dark") document.documentElement.setAttribute("data-theme", tema);
    applyPrefs(readPrefs());
  }, []);

  function trocar() {
    const atual = document.documentElement.getAttribute("data-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const novo = atual === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", novo);
    setItem(KEYS.theme, novo);
  }

  return (
    <button type="button" onClick={trocar} className="cursor-pointer underline hover:text-white">
      Claro / escuro
    </button>
  );
}

/** Tela inteira para os estados em que o painel ainda não abriu (carregando, sem conta, segundo fator). */
function Porta({ children }: { children: React.ReactNode }) {
  return (
    <div className="painel relative flex min-h-screen items-center justify-center overflow-hidden bg-[#17130e] px-4 py-10 font-sans text-sm text-[#efe4c8]">
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

  // Fecha a sessão depois de meia hora sem ninguém mexer.
  useEffect(() => {
    if (!dentro) return;
    let ultimo = Date.now();
    const tocar = () => {
      ultimo = Date.now();
    };
    const sinais = ["pointerdown", "keydown", "scroll"] as const;
    for (const sinal of sinais) window.addEventListener(sinal, tocar, { passive: true });
    const relogio = window.setInterval(() => {
      if (Date.now() - ultimo > OCIOSO) void signOut().then(() => router.replace(`/${lang}/entrar`));
    }, 30_000);
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

function Dentro({ eu, recarregar, sair, aba, menu, setMenu }: { eu: Me; recarregar: () => void; sair: () => void; aba: string; menu: boolean; setMenu: (aberto: boolean) => void }) {
  const router = useRouter();
  const { lang } = useI18n();
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
        .then((lista) => avisar(lista.filter((c) => c.nao_lidas > 0 && !c.silenciada && !c.arquivada && c.ultima && !c.ultima.minha).map((c) => c.ultima!.autor)))
        .catch(() => avisar([]));
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
  const voluntario = eu.papeis.length > 0;
  // Quem produz para o site: educação, curadoria, revisão, tradução, jornalismo, design, marketing e a liderança.
  const produz = can(eu, "coordenacao", "supervisao", "curadoria", "educacao", "revisao", "traducao", "jornalismo", "design", "marketing");
  const lidera = can(eu, "coordenacao");
  // A supervisão é um papel próprio: can() só estende a vice-coordenação à coordenação, não à supervisão.
  const supervisiona = can(eu, "supervisao");
  // Cada função enxerga só as ferramentas dela. A coordenação e a vice-coordenação enxergam todas.
  const secoes: Secao[] = (
    [
      { id: "mesa", nome: "Mesa", sobre: "O que espera por você hoje.", grupo: "", mostra: true, conta: eu.avisos },
      { id: "conversas", nome: "Conversas", sobre: "Mensagens privadas, grupos e o grupo de cada departamento, cifrados de ponta a ponta.", grupo: "", mostra: voluntario, conta: aba === "conversas" ? 0 : presenca.dados?.conversas },
      { id: "rede", nome: "Mural da equipe", sobre: "Publicações e pedidos de ajuda para todos ou por função, cifrados neste aparelho.", grupo: "", mostra: voluntario },
      { id: "escrever", nome: "Escrever", sobre: "Aulas, matérias, verbetes e tudo o que vai para o site.", grupo: "Produção", mostra: produz },
      { id: "videoaulas", nome: "Aulas em vídeo", sobre: "Gravar ou enviar aulas curtas em vídeo, de até 10 minutos, e revisar as da sua disciplina.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "educacao"), conta: videos.dados ?? undefined },
      { id: "aovivo", nome: "Aulas ao vivo", sobre: "Marcar aulas na agenda pública, chamar colegas para dar junto e abrir a sala, com vídeo e bate-papo.", grupo: "Produção", mostra: can(eu, "coordenacao", "educacao", "mentoria") },
      { id: "estudio", nome: "Estúdio de design", sobre: "Estúdio rápido (modelos da marca) e editor avançado (PhotoCraft): posts, stories, cartazes e capas com a identidade do instituto.", grupo: "Produção", mostra: eu.desenha === true || can(eu, "coordenacao", "design", "jornalismo") },
      { id: "caderno", nome: "Caderno de estudos", sobre: "Fontes, resumo, cartões, questionário, mapa e leitura em voz alta: a sala de estudo para preparar aulas e episódios.", grupo: "Produção", mostra: true },
      { id: "tarefas", nome: "Tarefas", sobre: "Microtarefas do acervo e das aulas para 5, 15 ou 30 minutos, a revisão rápida, mutirões e projetos.", grupo: "Produção", mostra: voluntario },
      { id: "acervo-dentro", nome: "Acervo por dentro", sobre: "Cada obra com o selo da ficha (completa, parcial ou faltando), para escolher o que cuidar.", grupo: "Produção", mostra: voluntario },
      { id: "minhas", nome: "Meus envios", sobre: "O que você enviou e em que pé está.", grupo: "Produção", mostra: produz },
      { id: "juntas", nome: "Compartilhadas comigo", sobre: "Contribuições de colegas que chamaram você para trabalhar junto.", grupo: "Produção", mostra: voluntario, conta: r?.juntas },
      { id: "fila", nome: "Fila de revisão", sobre: "Ler, dar parecer e decidir o que vai ao ar.", grupo: "Produção", mostra: can(eu, "coordenacao", "supervisao", "curadoria", "revisao", "educacao"), conta: r?.fila },
      { id: "traducoes", nome: "Traduções", sobre: "As aulas que ainda não têm tradução e as traduções a caminho.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "traducao", "revisao") },
      { id: "triagem", nome: "Triagem", sobre: "A primeira leitura do que o público envia: o que passa segue para a fila de revisão.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "mediacao"), conta: r?.triagem },
      { id: "curriculo", nome: "Disciplinas e trilhas", sobre: "Criar, editar e remover disciplinas e trilhas (coordenação e coordenação pedagógica); todo voluntário sugere.", grupo: "Produção", mostra: voluntario },
      { id: "fontes", nome: "Fontes abertas", sobre: "Obras, verbetes e datas em acervos e enciclopédias livres, para escrever com fonte à vista.", grupo: "Produção", mostra: voluntario },
      { id: "materiais", nome: "Materiais e arquivos", sobre: "Zines, cartazes, imagens e PDFs.", grupo: "Produção", mostra: can(eu, "coordenacao", "curadoria", "design", "marketing") },
      { id: "divulgacao", nome: "Divulgação", sobre: "Calendário de posts e stories, kit da marca e acesso ao Instagram.", grupo: "Produção", mostra: can(eu, "coordenacao", "marketing"), conta: r?.divulgacao },
      { id: "comunidade", nome: "Comunidade", sobre: "Fila de revisão, banimentos, denúncias, anotações e o filtro de palavras.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "curadoria", "mediacao", "educacao"), conta: r ? r.denuncias + r.anotacoes + r.retidos : undefined },
      { id: "reforco", nome: "Aula de reforço", sobre: "Dúvidas de estudantes esperando resposta.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "mentoria", "educacao"), conta: r?.reforco },
      { id: "mural", nome: "Mural dos Trabalhadores", sobre: "Anúncios esperando a decisão da coordenação ou da mediação.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "mediacao"), conta: r?.mural },
      { id: "gaveta", nome: "Gaveta Aberta", sobre: "Trabalhos de estudantes esperando a decisão: conferir, publicar ou recusar.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "curadoria", "mediacao"), conta: r?.gaveta },
      { id: "boletim", nome: "Boletim do jornal", sobre: "Quem pediu para receber o jornal por e-mail.", grupo: "Atendimento", mostra: can(eu, "coordenacao", "jornalismo") },
      { id: "pessoas", nome: "Voluntários e convites", sobre: "Convidar, confiar funções e acompanhar a equipe.", grupo: "Pessoas", mostra: manages(eu), conta: r?.candidaturas },
      { id: "supervisao", nome: "Supervisão", sobre: "Proteções reversíveis, a equipe sem e-mails e os pedidos de voluntariado.", grupo: "Pessoas", mostra: supervisiona, conta: r?.candidaturas },
      { id: "reunioes", nome: "Reuniões", sobre: "Reuniões da equipe por vídeo, dentro do painel: a liderança marca, qualquer pessoa propõe, a presença e a ata ficam no histórico.", grupo: "Pessoas", mostra: voluntario },
      { id: "horas", nome: "Horas e certificados", sobre: "Termo de adesão, horas de trabalho e certificados.", grupo: "Pessoas", mostra: voluntario, conta: r ? r.horas + r.testemunhar + (r.pedidos ?? 0) : undefined },
      { id: "estatisticas", nome: "Estatísticas", sobre: "O que os estudantes procuram e o que a equipe produz, por disciplina: a base para decidir o que entra e o que sai.", grupo: "Pessoas", mostra: lidera || can(eu, "vice") },
      { id: "avisos", nome: "Avisos à equipe", sobre: "Um quadro que aparece por cima do painel de toda a equipe, ou só de algumas funções, até cada pessoa fechar.", grupo: "Pessoas", mostra: eu.supervisao === true || lidera || supervisiona },
      { id: "site", nome: "Controles do site", sobre: "A faixa do alto e a pausa geral de envios.", grupo: "Site", mostra: lidera },
      { id: "abertura", nome: "Aviso de abertura", sobre: "O quadro que aparece quando o site abre.", grupo: "Site", mostra: lidera },
      { id: "podcast", nome: "Podcast", sobre: "Episódios da pauta à publicação: roteiro, gravação, versões, revisão, capas, cortes e agenda.", grupo: "Produção", mostra: can(eu, "coordenacao", "jornalismo", "design", "mediacao", "curadoria"), conta: podcast.dados ?? undefined },
      { id: "emissoras", nome: "Rádios do povo", sobre: "Indicar emissoras populares e comunitárias para o diretório público de rádios.", grupo: "Site", mostra: can(eu, "coordenacao", "jornalismo") },
      { id: "apoiadores", nome: "Apoio e transparência", sobre: "A página de Apoie (faixas, metas, custos), o mural de apoiadores, as contas do mês e o texto para a Benfeitoria.", grupo: "Site", mostra: lidera },
      { id: "tecnico", nome: "Estado técnico", sobre: "Publicação, avaliação automática, faxina e sinais de varredura.", grupo: "Site", mostra: can(eu, "coordenacao", "desenvolvimento"), conta: r?.publicacao_atrasada },
      { id: "seguranca", nome: "Segurança e sucessão", sobre: "Segundo fator obrigatório, coordenação pedagógica e ordem de sucessão.", grupo: "Segurança", mostra: lidera },
      { id: "interdicao", nome: "Interdição e expurgo", sobre: "Tirar o site ou uma área do ar por um tempo, e apagar de uma vez uma chuva de spam.", grupo: "Segurança", mostra: lidera || supervisiona, conta: r?.pedidos_supervisao },
      { id: "registro", nome: "Registro de atividades", sobre: "Tudo o que foi decidido, por quem e quando.", grupo: "Segurança", mostra: lidera || supervisiona },
      { id: "contribuicoes", nome: "Minhas contribuições", sobre: "O que você fez, as horas estimadas, os selos e o comprovante de voluntariado.", grupo: "Você", mostra: voluntario },
      { id: "conta", nome: "Minha conta", sobre: "Seu nome, sua senha e a proteção da sua conta.", grupo: "Você", mostra: true },
    ] satisfies Secao[]
  ).filter((secao) => secao.mostra);

  const atual = secoes.find((secao) => secao.id === aba) ?? secoes[0];
  const interditado = estadoDoSite.dados?.interdicao && (estadoDoSite.dados.interdicao.geral || estadoDoSite.dados.interdicao.areas.length > 0) ? estadoDoSite.dados.interdicao : null;
  // Trocar de seção também refaz as contagens: o número da fila cai assim que a decisão é tomada.
  const ir = (id: string) => {
    setMenu(false);
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
  const [telaCheia, setTelaCheia] = useState(false);
  useEffect(() => {
    const mudou = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", mudou);
    return () => document.removeEventListener("fullscreenchange", mudou);
  }, []);
  const alternarCompacto = () => { setCompacto((c) => { setItem(KEYS.painelCompacto, c ? "0" : "1"); return !c; }); };
  const alternarFoco = () => { setFoco((f) => { setItem(KEYS.painelFoco, f ? "0" : "1"); return !f; }); };
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  // Ctrl+K (ou Cmd+K) de qualquer lugar; "/" fora de campos de texto.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const escrevendo = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIrPara((aberto) => !aberto);
      } else if (e.key === "/" && !escrevendo) {
        e.preventDefault();
        setIrPara(true);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const essenciais = ["mesa", "conversas", "escrever", "minhas", "fila", "caderno", "horas", "conta"];
  const noMenu = foco ? secoes.filter((secao) => essenciais.includes(secao.id) || secao.id === atual.id) : secoes;
  const grupos = [...new Set(noMenu.map((secao) => secao.grupo))];
  // O principal primeiro (o de maior nível) e, quando há mais de dois, "+N": a linha do menu é curta. A lista inteira vai no título.
  const todasAsFuncoes = [...new Set(porNivel(eu.papeis).map((papel) => papeis[papel.papel]))];
  const funcao = !voluntario ? "Comunidade" : todasAsFuncoes.length <= 2 ? todasAsFuncoes.join(" · ") : `${todasAsFuncoes[0]} +${todasAsFuncoes.length - 1}`;
  // O nome do ambiente diz de quem ele é: só a coordenação vê "Coordenação".
  const ambiente = lidera ? "Coordenação" : supervisiona ? "Supervisão" : voluntario ? "Equipe" : "Comunidade";

  return (
    <div className={`painel min-h-screen bg-parchment font-sans text-sm text-ink lg:grid ${compacto ? "lg:grid-cols-[4.25rem_minmax(0,1fr)]" : "lg:grid-cols-[17.5rem_minmax(0,1fr)]"}`}>
      <TraduzirPainel />
      {irPara && <IrPara secoes={secoes} fechar={() => setIrPara(false)} ir={ir} />}
      {/* Aviso da coordenação, da vice ou da supervisão: aparece por cima de tudo até a pessoa apertar "Entendi". */}
      {(voluntario || eu.supervisao) && <QuadroDeAvisos />}
      {/* O termo de voluntário: quem tem função aceita uma vez; quem recusa sai. Banco antigo não manda o campo e nada aparece. */}
      {voluntario && eu.termo_voluntario === false && <TermoDeVoluntario aceitou={recarregar} sair={sair} />}
      {/* Barra do alto no celular: a faixa bordô do site, o nome e o menu. */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b-[3px] border-[#d4a24c] bg-[#6e1f1a] px-4 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 text-[#f4ecd8] lg:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <Star className="h-5 w-5 shrink-0 text-[#f4ecd8]" />
          <span className="truncate font-serif text-lg font-semibold">Instituto Lúcia</span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#f0cf8e]">{ambiente}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setIrPara(true)} aria-label="Ir para uma seção" className="cursor-pointer border border-[#f4ecd8]/50 p-1.5">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          </button>
          <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="menu-do-painel" className="cursor-pointer border border-[#f4ecd8]/50 px-3 py-1.5 font-semibold">
            {menu ? "Fechar" : "Menu"}
          </button>
        </span>
      </div>

      {/* No celular, o menu aberto ocupa a tela toda (sem sobra clara embaixo) e o rodapé dele fica no fim. */}
      <aside id="menu-do-painel" className={`painel-lado no-print bg-[#17130e] text-[#efe4c8] max-lg:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r-4 lg:border-[#c21f16] ${menu ? "flex flex-col" : "hidden"}`}>
        <div className={`hidden pt-6 lg:block ${compacto ? "px-3" : "px-5"}`}>
          <L href="/" className="flex items-center gap-3" title={compacto ? "Instituto Lúcia · voltar ao site" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marca-96.png" alt="" width={44} height={44} className="h-11 w-11" />
            {!compacto && (
              <span>
                <span className="block font-serif text-xl font-semibold leading-none">Instituto Lúcia</span>
                <span className="mt-1.5 inline-block bg-[#c21f16] px-1.5 py-0.5 font-sans text-[0.6rem] font-extrabold uppercase italic tracking-[0.14em] text-white">Painel · {ambiente}</span>
              </span>
            )}
          </L>
          <button type="button" onClick={() => setIrPara(true)} title="Ir para uma seção (Ctrl K)" className={`mt-5 flex w-full cursor-pointer items-center gap-2 border border-[#3a3226] py-2 text-left text-[#b9ad90] transition-colors hover:border-[#d4a24c] hover:text-white ${compacto ? "justify-center px-0" : "px-3"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            {!compacto && <span className="flex-1">Ir para…</span>}
            {!compacto && <kbd className="font-mono text-[0.62rem] text-[#8f8468]">Ctrl K</kbd>}
          </button>
        </div>
        <nav aria-label="Seções do painel" className="flex-1 overflow-y-auto px-3 py-5 [scrollbar-color:#4a4032_transparent] [scrollbar-width:thin]">
          {grupos.map((grupo) => (
            <div key={grupo || "inicio"} className="mb-4">
              {grupo && (compacto ? <hr className="mx-2 mb-2 hidden border-[#3a3226] lg:block" /> : null)}
              {grupo && <p className={`painel-grupo px-2 pb-1.5 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#d4a24c] ${compacto ? "lg:hidden" : ""}`}>{grupo}</p>}
              <ul>
                {noMenu
                  .filter((secao) => secao.grupo === grupo)
                  .map((secao) => {
                    const ativa = secao.id === atual.id;
                    return (
                      <li key={secao.id}>
                        <button
                          type="button"
                          onClick={() => ir(secao.id)}
                          aria-current={ativa ? "page" : undefined}
                          title={compacto ? secao.nome : undefined}
                          className={`painel-item relative flex w-full cursor-pointer items-center gap-2.5 py-2 text-left ${compacto ? "px-3 lg:justify-center lg:px-0" : "px-3"} ${ativa ? "painel-item-ativo" : ""}`}
                        >
                          <Icone id={secao.id} />
                          <span className={`min-w-0 flex-1 truncate ${compacto ? "lg:hidden" : ""}`}>{secao.nome}</span>
                          {Boolean(secao.conta) && <span className={`painel-conta min-w-6 bg-[#c21f16] px-1.5 py-0.5 text-center font-mono text-[0.7rem] font-semibold leading-none text-white ${compacto ? "lg:absolute lg:top-0.5 lg:right-1 lg:min-w-4 lg:px-1 lg:text-[0.6rem]" : ""}`}>{secao.conta}</span>}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <div className={`border-t border-[#3a3226] pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] ${compacto ? "px-2" : "px-4"}`}>
          <p className={`flex items-center gap-3 ${compacto ? "lg:justify-center" : ""}`}>
            <button type="button" onClick={() => ir("conta")} title="Minha conta" className="cursor-pointer">
              <Avatar nome={eu.nome} avatar={eu.avatar} className="h-10 w-10" texto="font-sans font-black italic" />
            </button>
            <span className={`min-w-0 ${compacto ? "lg:hidden" : ""}`}>
              <span className="block truncate font-semibold">{eu.nome}</span>
              <span className="block truncate text-xs text-[#b9ad90]" title={todasAsFuncoes.join(" · ") || undefined}>{funcao}</span>
            </span>
          </p>
          <p className={`mt-3 flex flex-wrap items-center gap-2 ${compacto ? "lg:flex-col" : ""}`}>
            <button type="button" onClick={alternarCompacto} aria-pressed={compacto} title={compacto ? "Mostrar os nomes das seções" : "Recolher o menu (só ícones)"} className="hidden cursor-pointer border border-[#3a3226] p-1.5 text-[#b9ad90] hover:border-[#d4a24c] hover:text-white lg:block">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{compacto ? <path d="M9 6l6 6-6 6M4 4v16" /> : <path d="M15 6l-6 6 6 6M20 4v16" />}</svg>
            </button>
            <button type="button" onClick={alternarFoco} aria-pressed={foco} title={foco ? "Sair do modo foco: mostrar todas as seções" : "Modo foco: só o essencial no menu"} className={`cursor-pointer border p-1.5 hover:border-[#d4a24c] hover:text-white ${foco ? "border-[#d4a24c] text-[#d4a24c]" : "border-[#3a3226] text-[#b9ad90]"}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /></svg>
            </button>
            <button type="button" onClick={alternarTelaCheia} aria-pressed={telaCheia} title={telaCheia ? "Sair da tela cheia" : "Tela cheia"} className="cursor-pointer border border-[#3a3226] p-1.5 text-[#b9ad90] hover:border-[#d4a24c] hover:text-white">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{telaCheia ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}</svg>
            </button>
          </p>
          <p className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs ${compacto ? "lg:hidden" : ""}`}>
            <L href="/" className="underline hover:text-white">← Voltar ao site</L>
            <Tema />
            <button type="button" onClick={sair} className="cursor-pointer underline hover:text-white">Sair</button>
            <IdiomaDoPainel />
          </p>
          {compacto && <p className="mt-3 hidden justify-center lg:flex"><button type="button" onClick={sair} title="Sair" className="cursor-pointer text-xs text-[#b9ad90] underline hover:text-white">Sair</button></p>}
        </div>
      </aside>

      <div className={`min-w-0 ${menu ? "hidden lg:block" : ""}`}>
        {/* A abertura de cada seção, no desenho de cartaz do site: faixa preta, título pesado e a cunha com a estrela. */}
        <header key={`cabeca-${atual.id}`} className="painel-cabeca jornal-preto jornal-cartaz no-print">
          <div className="relative z-[1] py-6 pr-[24cqw] pl-5 sm:pl-8">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-[#d4a24c]">{atual.grupo || ambiente}</p>
            <h1 className="mt-1.5 flex items-center gap-3 font-sans text-3xl font-black uppercase italic leading-none tracking-tight sm:text-4xl">
              <Icone id={atual.id} className="h-7 w-7 text-[#e0372b] sm:h-8 sm:w-8" />
              {atual.nome}
            </h1>
            <p className="mt-2.5 max-w-2xl text-[#cdbb91]">{atual.sobre}</p>
          </div>
          <span className="jornal-cunha jornal-cunha-vermelha painel-cunha" aria-hidden>
            <Star className="jornal-cunha-estrela" />
          </span>
        </header>
        <div className="jornal-fio" />
        <div key={atual.id} className="painel-conteudo mx-auto max-w-5xl px-5 py-7 sm:px-8">
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
          {atual.id === "mesa" && <Mesa me={eu} resumo={r ?? null} recarregar={() => { recarregar(); resumo.recarregar(); }} ir={ir} />}
          {voluntario && <Repasse usuario={eu.id} />}
          {atual.id === "conversas" && <Conversas me={eu} />}
          {atual.id === "rede" && <Equipe usuario={eu.id} lider={leads(eu)} modera={lidera || supervisiona} aprendiz={eu.aprendizado} recarregar={recarregar} />}
          {atual.id === "escrever" && <Escrever me={eu} />}
          {atual.id === "videoaulas" && <Videoaulas me={eu} />}
          {atual.id === "aovivo" && <AulasAoVivo me={eu} />}
          {atual.id === "estudio" && <EstudioDeDesign me={eu} />}
          {atual.id === "caderno" && <CadernoNoPainel />}
          {atual.id === "tarefas" && <Tarefas me={eu} ir={ir} />}
          {atual.id === "acervo-dentro" && <AcervoPorDentro />}
          {atual.id === "contribuicoes" && <MinhasContribuicoes />}
          {atual.id === "avisos" && <AvisosEquipe />}
          {atual.id === "minhas" && <Fila key="minhas" me={eu} minhas />}
          {atual.id === "juntas" && <Fila key="juntas" me={eu} juntas />}
          {atual.id === "fila" && <Fila key="fila" me={eu} />}
          {atual.id === "traducoes" && <Traducoes irEscrever={() => ir("escrever")} />}
          {atual.id === "triagem" && <Fila key="triagem" me={eu} triagem />}
          {atual.id === "curriculo" && <DisciplinasETrilhas me={eu} />}
          {atual.id === "fontes" && <FontesAbertas />}
          {atual.id === "materiais" && <Materiais me={eu} />}
          {atual.id === "divulgacao" && <Divulgacao me={eu} />}
          {atual.id === "comunidade" && <Comunidade me={eu} />}
          {atual.id === "reforco" && <Reforco />}
          {atual.id === "mural" && <MuralFila me={eu} />}
          {atual.id === "gaveta" && <GavetaFila />}
          {atual.id === "boletim" && <Boletim />}
          {atual.id === "pessoas" && <Pessoas me={eu} />}
          {atual.id === "supervisao" && <Supervisao />}
          {atual.id === "reunioes" && <Reunioes me={eu} />}
          {atual.id === "horas" && <Horas me={eu} />}
          {atual.id === "site" && <Site />}
          {atual.id === "abertura" && <AvisoDeAbertura />}
          {atual.id === "podcast" && <Podcast />}
          {atual.id === "emissoras" && <SugerirEmissora />}
          {atual.id === "apoiadores" && <Apoio />}
          {atual.id === "tecnico" && <Tecnico />}
          {atual.id === "seguranca" && <SegurancaSucessao me={eu} />}
          {atual.id === "interdicao" && <Interdicao me={eu} aoMudar={estadoDoSite.recarregar} />}
          {atual.id === "registro" && <RegistroDeAtividades />}
          {atual.id === "estatisticas" && <Estatisticas />}
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

/** A primeira tela: só o que pede atenção agora. */
function Mesa({ me, resumo, recarregar, ir }: { me: Me; resumo: Resumo | null; recarregar: () => void; ir: (aba: string) => void }) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const r = resumo;
  const pendencias: [string, number, string][] = r
    ? (
        [
          ["Colegas chamaram você para trabalhar junto", r.juntas, "juntas"],
          ["Envios do público para a triagem", r.triagem ?? 0, "triagem"],
          ["Na fila de revisão", r.fila, "fila"],
          ["Aprovadas, esperando a publicação", r.aguardando_publicacao, "fila"],
          ["Pedidos de voluntariado", r.candidaturas, can(me, "coordenacao") ? "pessoas" : "supervisao"],
          ["Pedidos de ajuda para a sua função", r.pedidos_ajuda ?? 0, "rede"],
          ["Contas suspensas pela supervisão", r.suspensas ?? 0, can(me, "coordenacao") ? "pessoas" : "supervisao"],
          ["Posts para sair ou devolvidos", r.divulgacao ?? 0, "divulgacao"],
          ["Aprovadas há mais de três horas sem ir ao ar", r.publicacao_atrasada ?? 0, "tecnico"],
          ["Pedidos da supervisão esperando decisão", r.pedidos_supervisao ?? 0, "interdicao"],
          ["Denúncias abertas", r.denuncias, "comunidade"],
          ["Anotações para olhar", r.anotacoes, "comunidade"],
          ["Mensagens esperando a mediação", r.retidos, "comunidade"],
          ["Pedidos de reforço", r.reforco, "reforco"],
          ["Pedidos de certificado", r.pedidos ?? 0, "horas"],
          ["Horas para conferir", r.horas, "horas"],
          ["Certificados esperando a sua assinatura", r.testemunhar, "horas"],
          ["Anúncios do mural", r.mural, "mural"],
          ["Trabalhos na Gaveta Aberta", r.gaveta ?? 0, "gaveta"],
        ] as [string, number, string][]
      ).filter(([, total]) => total > 0)
    : [];

  const hora = new Date().getHours();
  const saudacao = hora < 5 ? "Boa noite" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const hoje = new Date().toLocaleDateString(localDoPainel(), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-10">
      <section className="painel-surge">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-ink-soft">{hoje}</p>
        <h2 className="mt-1 font-serif text-4xl font-semibold leading-tight">
          {saudacao}, <span className="italic text-oxblood">{me.nome.split(" ")[0]}</span>.
        </h2>
        {me.papeis.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suas funções">
            {porNivel(me.papeis).map((papel) => (
              <li key={papel.id} title={oQueFaz[papel.papel]} className="flex items-center gap-1.5 border-2 border-ink bg-parchment-deep px-3 py-1.5">
                <Star className="h-3.5 w-3.5 text-[#c21f16]" />
                <strong>{papeis[papel.papel]}</strong>
                {papel.disciplina && <span className="text-ink-soft"> · {nomeDaArea(papel.disciplina)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 max-w-2xl text-ink-soft">Você participa da comunidade e pode escrever e enviar contribuições. Para revisar, traduzir, ensinar ou cuidar de uma disciplina, peça uma função abaixo.</p>
        )}
      </section>

      <section>
        <h2 className="jornal-secao">
          <span className="jornal-editoria">Esperando por você</span>
        </h2>
        {pendencias.length === 0 ? (
          <p className="painel-surge mt-4 flex items-center gap-3 border-2 border-ink bg-parchment-deep px-4 py-5">
            {r ? (
              <>
                <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-ok" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
                <span className="text-base font-semibold">Nada pendente. Tudo em dia.</span>
              </>
            ) : (
              <span className="painel-carregando text-ink-soft">Carregando…</span>
            )}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendencias.map(([titulo, total, destino], i) => (
              <button key={titulo} type="button" onClick={() => ir(destino)} style={{ animationDelay: `${i * 45}ms` }} className="painel-quadro painel-surge flex cursor-pointer items-center gap-4 p-4 text-left">
                <span className="font-sans text-5xl font-black leading-none tracking-tight text-oxblood tabular-nums">{total}</span>
                <span className="min-w-0 flex-1 font-medium leading-snug">{titulo}</span>
                <span aria-hidden className="painel-seta text-lg text-ink-soft">→</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-5 flex flex-wrap gap-3">
          <button type="button" className={botao} onClick={() => ir("escrever")}>Escrever</button>
          {me.papeis.length > 0 && <button type="button" className={botaoClaro} onClick={() => ir("conversas")}>Abrir as conversas</button>}
          {(r?.minhas ?? 0) > 0 && <button type="button" className={botaoClaro} onClick={() => ir("minhas")}>Meus envios ({r?.minhas})</button>}
        </p>
      </section>

      {me.papeis.length > 0 && <ParaVoceHoje me={me} ir={ir} />}

      {me.papeis.length > 0 && (
        <details className="painel-cartao p-4">
          <summary className="cursor-pointer font-semibold">Guia de primeiros passos da sua função</summary>
          <div className="mt-3">
            <PorOndeComecar me={me} ir={ir} />
          </div>
        </details>
      )}

      {me.papeis.length > 0 && <Situacao lidera={can(me, "coordenacao")} supervisiona={can(me, "supervisao")} ir={ir} />}

      <Recados recarregar={recarregar} />

      {me.papeis.length > 0 && !can(me, "marketing") && <SugerirAoMarketing />}

      {/* Quem não tem função pede a primeira; quem já tem pode pedir outra: uma pessoa acumula quantas a coordenação confiar. */}
      {!can(me, "coordenacao") && <Candidatura me={me} />}
    </div>
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
  const quadro = "painel-quadro painel-surge p-4 text-left";
  const alerta = "painel-quadro painel-quadro-alerta painel-surge p-4 text-left";
  return (
    <section>
      <h2 className="jornal-secao">
        <span className="jornal-editoria">Como estamos</span>
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={() => ir("conversas")} className={`${quadro} cursor-pointer`}>
          <span className="block text-ink-soft">Equipe</span>
          <span className="mt-1 block font-serif text-2xl font-semibold leading-tight">{membros.dados ? <>{membros.dados.length} {membros.dados.length === 1 ? "pessoa" : "pessoas"}</> : "…"}</span>
          <span className="mt-1 flex items-center gap-1.5 text-ink-soft">
            {online > 0 && <span aria-hidden className="painel-pulso inline-block h-2 w-2 rounded-full bg-ok" />}
            {online > 0 ? `${online} online agora` : "Ninguém mais online agora"}
          </span>
        </button>
        {site.dados &&
          (lidera ? (
            <>
              <button type="button" onClick={() => ir(site.dados?.pausa ? "site" : "triagem")} className={`${site.dados.pausa ? alerta : quadro} cursor-pointer`}>
                <span className="block text-ink-soft">Envios do público</span>
                <span className={`mt-1 block font-serif text-2xl font-semibold leading-tight ${site.dados.pausa ? "text-oxblood" : ""}`}>{site.dados.pausa ? "Pausados" : "Abertos"}</span>
                <span className="mt-1 block text-ink-soft">{site.dados.pausa ? "Ninguém de fora envia nada até você reabrir (Controles do site)" : "Ver o que chegou na triagem · pausar em Controles do site"}</span>
              </button>
              <button type="button" onClick={() => ir("site")} className={`${quadro} cursor-pointer`}>
                <span className="block text-ink-soft">Faixa do alto</span>
                <span className="mt-1 block font-serif text-2xl font-semibold leading-tight">{site.dados.faixa ? "Com chamado" : "Texto de sempre"}</span>
                <span className="mt-1 block truncate text-ink-soft">{site.dados.faixa || "Nenhum chamado no ar"}</span>
              </button>
            </>
          ) : supervisiona ? (
            <button type="button" onClick={() => ir("supervisao")} className={`${site.dados.pausa ? alerta : `${quadro} hover:border-ink`} cursor-pointer`}>
              <span className="block text-ink-soft">Envios do público</span>
              <span className={`mt-1 block font-serif text-2xl font-semibold leading-tight ${site.dados.pausa ? "text-oxblood" : ""}`}>{site.dados.pausa ? "Pausados" : "Abertos"}</span>
              <span className="mt-1 block text-ink-soft">{site.dados.pausa ? "Ninguém de fora envia nada até a pausa sair" : "A pausa e o modo de segurança estão em Supervisão"}</span>
            </button>
          ) : (
            site.dados.pausa && (
              <div className={alerta}>
                <span className="block text-ink-soft">Envios do público</span>
                <span className="mt-1 block font-serif text-2xl font-semibold leading-tight text-oxblood">Pausados</span>
                <span className="mt-1 block text-ink-soft">A coordenação pausou o que vem de fora. O trabalho da equipe segue normal.</span>
              </div>
            )
          ))}
      </div>
    </section>
  );
}

/** Quem ainda não tem função pede uma aqui; quem já tem pede mais uma. A coordenação responde pelo próprio painel. */
function Candidatura({ me }: { me: Me }) {
  const { t } = useI18n();
  const pedidos = useLista<{ id: string; papel: Role["papel"]; disciplina: string | null; status: string; criado_em: string }[]>("candidaturas_minhas");
  const pedido = useAcao(pedidos.recarregar);
  const [aberto, setAberto] = useState(me.papeis.length === 0);
  // As funções que a pessoa ainda não tem (as por disciplina podem repetir em outra disciplina).
  const pediveis = (["educacao", "educacao_secundaria", "mentoria", "mediacao", "revisao", "traducao", "jornalismo", "curadoria", "design", "marketing", "desenvolvimento"] as const).filter(
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

