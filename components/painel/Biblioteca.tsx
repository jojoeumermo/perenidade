// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { type Me, rpc } from "@/lib/backend";
import { getItem, setItem } from "@/lib/storage";
import { L } from "../I18n";
import { Aviso, botao, campo, textoDoErro } from "./comum";

// Quatro ideias do painel que são, no fundo, lugares para achar as coisas: a biblioteca da equipe (estatuto, modelos,
// formação militante interna), os ofícios de cada pessoa, a primeira semana guiada e a rede de apoio.

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
    <div className="space-y-8">
      {ESTANTES.map(([titulo, itens]) => (
        <section key={titulo} aria-labelledby={`estante-${titulo}`}>
          <h2 id={`estante-${titulo}`} className="font-serif text-2xl font-semibold">{titulo}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {itens.map((item) => {
              const miolo = (
                <>
                  <span className="block font-semibold group-hover:text-prelo-texto">{item.nome} {"href" in item ? "↗" : "→"}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{item.sobre}</span>
                </>
              );
              const classe = "group block h-full border-2 border-ink bg-folha p-4 text-left text-ink shadow-[3px_3px_0_var(--sombra)] hover:text-ink hover:shadow-[3px_3px_0_var(--prelo)]";
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
    <section aria-labelledby="oficios" className="painel-cartao mt-6 p-5">
      <h3 id="oficios" className="font-serif text-xl font-semibold">O que você sabe fazer</h3>
      <p className="mt-1 text-sm text-ink-soft">Seus ofícios aparecem para a equipe na lista de pessoas e nos departamentos: assim, quem precisa de alguém que edite vídeo ou fale espanhol acha você. Até dez.</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {lista.map((o) => (
          <li key={o} className="flex items-center gap-1 border-2 border-ink bg-folha px-2 py-0.5 text-sm">
            {o}
            <button type="button" aria-label={`Tirar ${o}`} className="cursor-pointer text-ink-soft hover:text-oxblood" onClick={() => void guardar(lista.filter((x) => x !== o))}>✕</button>
          </li>
        ))}
        {lista.length === 0 && <li className="text-sm text-ink-soft">Nenhum ainda.</li>}
      </ul>
      {lista.length < 10 && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (novo.trim().length >= 2) void guardar([...lista, novo.trim()]).then(() => setNovo(""));
          }}
        >
          <label className="min-w-0 flex-1 text-sm">
            Acrescentar
            <input value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={40} list="sugestoes-oficios" className={campo} placeholder="edito vídeo" />
            <datalist id="sugestoes-oficios">
              {SUGESTOES.filter((s) => !lista.includes(s)).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <button type="submit" className={botao} disabled={novo.trim().length < 2}>Acrescentar</button>
        </form>
      )}
      <Aviso texto={aviso} />
    </section>
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
    <section aria-labelledby="primeira-semana" className="border-2 border-ink bg-[#f9e7a6] p-5 text-[#1f1a14] shadow-[4px_4px_0_var(--sombra)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="primeira-semana" className="font-serif text-2xl font-semibold">Sua primeira semana</h2>
        <span className="font-mono text-xs">{prontos} de {PASSOS.length}</span>
      </div>
      <p className="mt-1 text-sm">Bem-vindo à equipe. Cinco passos para se achar, no seu tempo:</p>
      <ol className="mt-3 space-y-1.5">
        {PASSOS.map((p) => (
          <li key={p.id} className="flex items-start gap-2">
            <input type="checkbox" checked={feitos.includes(p.id)} onChange={() => marcar(p.id)} aria-label={`Feito: ${p.texto}`} className="mt-1" />
            <button type="button" onClick={() => ir(p.secao)} className={`cursor-pointer text-left underline decoration-[#c21f16] underline-offset-2 ${feitos.includes(p.id) ? "line-through opacity-60" : ""}`}>
              {p.texto}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="mt-3 cursor-pointer text-sm underline" onClick={() => marcar("fechado")}>Já me achei: esconder</button>
    </section>
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
    <section aria-labelledby="rede-apoio" className="painel-cartao p-5">
      <h3 id="rede-apoio" className="font-serif text-xl font-semibold">Rede de apoio</h3>
      <p className="mt-1 text-sm text-ink-soft">Ninguém precisa dar conta de tudo sozinho. Se a coisa apertar, procure alguém de confiança da equipe nas Conversas, ou um destes serviços gratuitos:</p>
      <ul className="mt-3 space-y-2">
        {contatos.map(([numero, nome, sobre]) => (
          <li key={numero} className="flex items-start gap-3">
            <span className="w-14 shrink-0 select-all font-mono text-lg font-bold text-prelo-texto">{numero}</span>
            <span className="text-sm">
              <strong>{nome}.</strong> {sobre}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">A Defensoria Pública do seu estado atende de graça quem não pode pagar advogado.</p>
    </section>
  );
}
