// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowRight, ExternalLink, Footprints, LifeBuoy, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { getItem, setItem } from "@/lib/storage";
import { L } from "../I18n";
import { Aviso, textoDoErro } from "./comum";
import { Botao, CabecalhoDeSecao, Campo, Cartao, Selo } from "./ui";

// Quatro ideias do painel que são, no fundo, lugares para achar as coisas: a biblioteca da equipe (estatuto, modelos,
// formação militante interna), os ofícios de cada pessoa, a primeira semana guiada e a rede de apoio. Desenho só pelos
// componentes de ui/ e pelas classes pn-* do tema.

type Item = { nome: string; sobre: string } & ({ href: string } | { secao: string });

const ESTANTES: [string, Item[]][] = [
  [
    "Formação militante da equipe",
    [
      { nome: "Consciência de classe", sobre: "O percurso do zero à consciência de classe, em doze etapas. Bom para fazer em grupo, no núcleo.", href: "/despertar" },
      { nome: "Formação militante", sobre: "As trilhas de teoria, história das lutas e organização.", href: "/estantes/formacao-militante" },
      { nome: "Oratória e liderança", sobre: "Falar em assembleia, conduzir reunião, escutar.", href: "/estantes/oratoria-e-lideranca" },
      { nome: "Educação popular", sobre: "Paulo Freire e o jeito de ensinar do instituto.", href: "/estantes/educacao-popular" },
    ],
  ],
  [
    "Como o instituto funciona",
    [
      { nome: "Estatuto, missão e valores", sobre: "O que o instituto é, para quem e como decide.", href: "/instituto" },
      { nome: "Código de conduta", sobre: "Como a gente se trata, dentro e fora do painel.", href: "/conduta" },
      { nome: "Política de uso", sobre: "O que pode e o que não pode no site.", href: "/uso" },
      { nome: "Direitos autorais", sobre: "Licenças, créditos e o que fazer com material de terceiros.", href: "/direitos-autorais" },
      { nome: "Privacidade", sobre: "O que o instituto guarda e o que não guarda de ninguém.", href: "/privacidade" },
      { nome: "Contas do instituto", sobre: "A prestação de contas: o que entra, o que sai e para onde vai, mês a mês.", href: "/apoie" },
    ],
  ],
  [
    "Modelos e guias de trabalho",
    [
      { nome: "Guia da aula", sobre: "O modelo de aula, com os blocos prontos: abre ao lado do texto no Escrever.", secao: "escrever" },
      { nome: "Checklist de revisão", sobre: "O que conferir antes de aprovar: fica na Fila de revisão.", secao: "fila" },
      { nome: "Kit da marca e materiais", sobre: "Cores, letras, regras de uso e as peças para imprimir.", href: "/materiais" },
      { nome: "Modelos do Estúdio", sobre: "Posts, stories, cartazes e capas com a identidade do instituto.", secao: "estudio" },
      { nome: "Pautas e calendário", sobre: "O banco de pautas e o calendário único da equipe.", secao: "pautas" },
    ],
  ],
  [
    "Ferramentas de estudo e escrita",
    [
      { nome: "Fontes abertas", sobre: "Acervos e enciclopédias livres para escrever com fonte à vista.", secao: "fontes" },
      { nome: "Caderno de estudos", sobre: "Resumo, cartões, questionário e mapa a partir das fontes.", secao: "caderno" },
      { nome: "Escritório", sobre: "Documentos, planilhas e apresentações dentro do painel.", secao: "escritorio" },
    ],
  ],
];

export function Biblioteca({ ir }: { ir: (aba: string) => void }) {
  return (
    <div className="grid gap-8">
      {ESTANTES.map(([titulo, itens]) => (
        <section key={titulo} aria-labelledby={`estante-${titulo}`}>
          <CabecalhoDeSecao nivel={2} id={`estante-${titulo}`} titulo={titulo} />
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {itens.map((item) => {
              const miolo = (
                <>
                  <span className="flex items-center gap-1.5 font-semibold">
                    {item.nome}
                    {"href" in item ? <ExternalLink aria-hidden width={13} height={13} /> : <ArrowRight aria-hidden width={13} height={13} />}
                  </span>
                  <span className="pn-ajuda mt-0.5 block leading-snug">{item.sobre}</span>
                </>
              );
              const classe = "pn-cartao pn-cartao-interativo block h-full text-left no-underline";
              return (
                <li key={item.nome}>
                  {"href" in item ? (
                    <L href={item.href} target="_blank" className={classe}>{miolo}</L>
                  ) : (
                    <button type="button" onClick={() => ir(item.secao)} className={`${classe} w-full cursor-pointer`}>{miolo}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const SUGESTOES = ["edito vídeo", "design", "revisão de texto", "tradução para o espanhol", "tradução para o inglês", "fotografia", "redes sociais", "programação", "dar aula", "falar em público", "organizar evento", "acessibilidade", "Libras"];

/** Em Minha conta: o que a pessoa sabe fazer, para a equipe achar quem sabe o quê. */
export function Oficios() {
  const [lista, setLista] = useState<string[] | null>(null);
  const [novo, setNovo] = useState("");
  const [aviso, setAviso] = useState("");
  useEffect(() => {
    rpc<{ oficios: string[] }>("perfil_extras")
      .then((r) => setLista(r.oficios ?? []))
      .catch(() => setLista([]));
  }, []);
  async function guardar(proxima: string[]) {
    setAviso("");
    try {
      const r = await rpc<{ oficios: string[] }>("perfil_oficios_salvar", { p_oficios: proxima });
      setLista(r.oficios);
      setAviso("Guardado. A equipe vê ao lado do seu nome.");
    } catch (e) {
      setAviso(textoDoErro(e));
    }
  }
  if (!lista) return null;
  return (
    <Cartao nivelDoTitulo={3} titulo="O que você sabe fazer" sobre="Seus ofícios aparecem para a equipe na lista de pessoas e nos departamentos: assim, quem precisa de alguém que edite vídeo ou fale espanhol acha você. Até dez.">
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {lista.map((o) => (
          <li key={o}>
            <Selo>
              {o}
              <button type="button" aria-label={`Tirar ${o}`} className="-mr-1 inline-flex cursor-pointer rounded-full p-0.5 hover:text-oxblood focus-visible:outline-2 focus-visible:outline-[var(--pn-foco)]" onClick={() => void guardar(lista.filter((x) => x !== o))}>
                <X aria-hidden width={12} height={12} />
              </button>
            </Selo>
          </li>
        ))}
        {lista.length === 0 && <li className="pn-ajuda">Nenhum ainda.</li>}
      </ul>
      {lista.length < 10 && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (novo.trim().length >= 2) void guardar([...lista, novo.trim()]).then(() => setNovo(""));
          }}
        >
          <div className="min-w-0 flex-1">
            <Campo rotulo="Acrescentar" value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={40} list="sugestoes-oficios" placeholder="edito vídeo" />
            <datalist id="sugestoes-oficios">
              {SUGESTOES.filter((s) => !lista.includes(s)).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <Botao type="submit" simbolo={Plus} disabled={novo.trim().length < 2}>Acrescentar</Botao>
        </form>
      )}
      <Aviso texto={aviso} />
    </Cartao>
  );
}

const PASSOS: { id: string; texto: string; secao: string }[] = [
  { id: "departamento", texto: "Conheça o seu departamento e leia o “como trabalhamos”", secao: "departamentos" },
  { id: "tarefa", texto: "Faça uma tarefa de 5 minutos", secao: "tarefas" },
  { id: "mural", texto: "Apresente-se no Mural da equipe", secao: "rede" },
  { id: "conta", texto: "Proteja a conta com o segundo fator", secao: "conta" },
  { id: "oficios", texto: "Diga o que você sabe fazer (Minha conta › Perfil)", secao: "conta" },
];

/** Na Mesa, nas duas primeiras semanas: cinco passos para se achar. Os passos marcados ficam neste aparelho. */
export function PrimeiraSemana({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const chave = `lucia:primeira-semana:${me.id}`;
  const [chegada, setChegada] = useState<string | null>(null);
  const [feitos, setFeitos] = useState<string[]>(() => {
    try {
      return JSON.parse(getItem(chave) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [agora] = useState(() => Date.now());
  useEffect(() => {
    rpc<{ chegada: string | null }>("perfil_extras")
      .then((r) => setChegada(r.chegada))
      .catch(() => undefined);
  }, []);
  const tudo = PASSOS.every((p) => feitos.includes(p.id));
  if (!chegada || tudo || feitos.includes("fechado") || agora - new Date(chegada).getTime() > 14 * 86_400_000) return null;
  const marcar = (id: string) => {
    const proximos = feitos.includes(id) ? feitos.filter((x) => x !== id) : [...feitos, id];
    setFeitos(proximos);
    setItem(chave, JSON.stringify(proximos));
  };
  const prontos = PASSOS.filter((p) => feitos.includes(p.id)).length;
  return (
    <Cartao
      variante="destaque"
      titulo={
        <span className="flex items-center gap-2">
          <Footprints aria-hidden width={18} height={18} className="text-oxblood" />
          Sua primeira semana
        </span>
      }
      acoes={<span className="pn-rotulo-mono tabular-nums">{`${prontos} de ${PASSOS.length} passos`}</span>}
    >
      <p className="mt-1 text-sm">Bem-vindo à equipe. Cinco passos para se achar, no seu tempo:</p>
      <ol className="mt-3 space-y-1.5">
        {PASSOS.map((p) => (
          <li key={p.id} className="flex items-start gap-2">
            <input type="checkbox" checked={feitos.includes(p.id)} onChange={() => marcar(p.id)} aria-label={`Feito: ${p.texto}`} className="mt-1 accent-[var(--pn-destaque)]" />
            <button type="button" onClick={() => ir(p.secao)} className={`pn-elo cursor-pointer text-left ${feitos.includes(p.id) ? "line-through opacity-70" : ""}`}>
              {p.texto}
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3">
        <Botao variante="discreto" pequeno onClick={() => marcar("fechado")}>Já me achei: esconder</Botao>
      </p>
    </Cartao>
  );
}

/** Em Minha conta › Cuidado: para quando a coisa aperta. */
export function RedeDeApoio() {
  const contatos: [string, string, string][] = [
    ["188", "CVV — Centro de Valorização da Vida", "Conversa sigilosa, 24 horas, de graça. Também por chat em cvv.org.br."],
    ["192", "SAMU", "Emergência de saúde, inclusive crise de saúde mental."],
    ["180", "Central de Atendimento à Mulher", "Violência contra a mulher. Também pelo WhatsApp (61) 9610-0180."],
    ["100", "Disque Direitos Humanos", "Violência contra criança, pessoa idosa, LGBT, população de rua e outras violações."],
  ];
  return (
    <Cartao
      nivelDoTitulo={3}
      titulo={
        <span className="flex items-center gap-2">
          <LifeBuoy aria-hidden width={18} height={18} className="text-oxblood" />
          Rede de apoio
        </span>
      }
      sobre="Ninguém precisa dar conta de tudo sozinho. Se a coisa apertar, procure alguém de confiança da equipe nas Conversas, ou um destes serviços gratuitos:"
    >
      <ul className="mt-3 space-y-2">
        {contatos.map(([numero, nome, sobre]) => (
          <li key={numero} className="flex items-start gap-3">
            <span className="w-14 shrink-0 select-all font-mono text-lg font-bold tabular-nums text-oxblood">{numero}</span>
            <span className="text-sm">
              <strong>{nome}.</strong> {sobre}
            </span>
          </li>
        ))}
      </ul>
      <p className="pn-ajuda mt-3">A Defensoria Pública do seu estado atende de graça quem não pode pagar advogado.</p>
    </Cartao>
  );
}
