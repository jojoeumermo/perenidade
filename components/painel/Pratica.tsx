// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import pt from "@/i18n/pt.json";
import type { Me } from "@/lib/backend";
import { type Exercicio, linguaDe, TIPOS, type TipoDeExercicio, validarPratica } from "@/lib/pratica";
import { horaDoRascunho, useRascunho } from "@/lib/rascunho";
import { useI18n } from "../I18n";
import { Pratica } from "../Pratica";
import { useTrackOptions } from "../useTrackOptions";
import { Aviso, botao, botaoClaro, campo, elo, rotulo, useAcao } from "./comum";
import { IDIOMAS } from "./GuiaDaAula";

const NOME: Record<TipoDeExercicio, string> = {
  escolha: "Escolha múltipla",
  traduzir: "Traduzir (digitando ou com banco de palavras)",
  pares: "Ligar os pares",
  lacuna: "Completar a lacuna",
  ordenar: "Ordenar as palavras",
  ouvir: "Ouvir e escrever",
  falar: "Falar (reconhecimento de voz)",
  cartoes: "Cartões de memória",
};
const SOBRE: Record<TipoDeExercicio, string> = {
  escolha: "Uma pergunta e de duas a seis alternativas. O botão de ouvir fala o texto em “áudio” (ou a pergunta).",
  traduzir: "A pessoa traduz a frase. Com banco de palavras, ela monta tocando (inclua palavras a mais para despistar).",
  pares: "Duas colunas embaralhadas: palavra e tradução, pergunta e resposta, pronúncia e escrita.",
  lacuna: "Uma frase com ___ no lugar da palavra que falta. Com alternativas vira escolha; sem, a pessoa digita.",
  ordenar: "A frase na língua estudada vira palavras embaralhadas; a tradução em português serve de guia.",
  ouvir: "O aparelho fala a frase na língua estudada e a pessoa escreve o que ouviu.",
  falar: "A pessoa lê a frase em voz alta; onde o navegador reconhece fala, o site confere; onde não, ela avalia a si mesma.",
  cartoes: "Frente e verso. A pessoa marca fácil ou difícil, e o site traz o cartão de volta no dia certo (repetição espaçada).",
};

const novo: Record<TipoDeExercicio, () => Exercicio> = {
  escolha: () => ({ tipo: "escolha", pergunta: "", opcoes: ["", "", ""], resposta: 0, audio: "", dica: "" }),
  traduzir: () => ({ tipo: "traduzir", frase: "", resposta: [""], palavras: [], na_lingua: false }),
  pares: () => ({ tipo: "pares", pares: [["", ""], ["", ""], ["", ""]] }),
  lacuna: () => ({ tipo: "lacuna", frase: "", resposta: "", opcoes: [], dica: "" }),
  ordenar: () => ({ tipo: "ordenar", frase: "", traducao: "" }),
  ouvir: () => ({ tipo: "ouvir", frase: "", traducao: "" }),
  falar: () => ({ tipo: "falar", frase: "", traducao: "" }),
  cartoes: () => ({ tipo: "cartoes", cartoes: [{ frente: "", verso: "" }, { frente: "", verso: "" }] }),
};

/** Tira o que está vazio antes de enviar ou pré-visualizar. */
function limpar(ex: Exercicio): Exercicio {
  switch (ex.tipo) {
    case "escolha": {
      const cheias = ex.opcoes.map((o, i) => [o.trim(), i] as const).filter(([o]) => o);
      return { ...ex, pergunta: ex.pergunta.trim(), opcoes: cheias.map(([o]) => o), resposta: Math.max(0, cheias.findIndex(([, i]) => i === ex.resposta)), audio: ex.audio?.trim() || undefined, dica: ex.dica?.trim() || undefined };
    }
    case "traduzir":
      return { ...ex, frase: ex.frase.trim(), resposta: ex.resposta.map((r) => r.trim()).filter(Boolean), palavras: ex.palavras?.map((p) => p.trim()).filter(Boolean).length ? ex.palavras.map((p) => p.trim()).filter(Boolean) : undefined };
    case "pares":
      return { tipo: "pares", pares: ex.pares.map(([a, b]) => [a.trim(), b.trim()] as [string, string]).filter(([a, b]) => a && b) };
    case "lacuna":
      return { ...ex, frase: ex.frase.trim(), resposta: ex.resposta.trim(), opcoes: ex.opcoes?.map((o) => o.trim()).filter(Boolean).length ? ex.opcoes.map((o) => o.trim()).filter(Boolean) : undefined, dica: ex.dica?.trim() || undefined };
    case "cartoes":
      return { tipo: "cartoes", cartoes: ex.cartoes.map((c) => ({ frente: c.frente.trim(), verso: c.verso.trim() })).filter((c) => c.frente && c.verso) };
    default:
      return { ...ex, frase: ex.frase.trim(), traducao: ex.traducao?.trim() || undefined };
  }
}

const lista = (valor: string[] | undefined) => (valor ?? []).join("\n");
const deLista = (texto: string) => texto.split("\n").map((l) => l.trim()).filter(Boolean);

function Linha({ rotuloTexto, children }: { rotuloTexto: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft">{rotuloTexto}</span>
      {children}
    </label>
  );
}

/** O formulário de um exercício, conforme o tipo. */
function Formulario({ ex, mudar, lingua }: { ex: Exercicio; mudar: (ex: Exercicio) => void; lingua: string }) {
  const input = (valor: string, ao: (v: string) => void, extra: Record<string, unknown> = {}) => <input value={valor} onChange={(e) => ao(e.target.value)} maxLength={300} className={campo} {...extra} />;
  switch (ex.tipo) {
    case "escolha":
      return (
        <div className="grid gap-2">
          <Linha rotuloTexto="Pergunta">{input(ex.pergunta, (v) => mudar({ ...ex, pergunta: v }))}</Linha>
          <div className="grid gap-1 sm:grid-cols-2">
            {ex.opcoes.map((o, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" checked={ex.resposta === i} onChange={() => mudar({ ...ex, resposta: i })} aria-label={`Alternativa ${i + 1} certa`} />
                <input value={o} onChange={(e) => mudar({ ...ex, opcoes: ex.opcoes.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={200} placeholder={`Alternativa ${i + 1}`} className={`${campo} mt-0`} lang={lingua} />
              </label>
            ))}
          </div>
          <p className="flex gap-4 text-xs">
            {ex.opcoes.length < 6 && <button type="button" className={elo} onClick={() => mudar({ ...ex, opcoes: [...ex.opcoes, ""] })}>+ alternativa</button>}
            {ex.opcoes.length > 2 && <button type="button" className={elo} onClick={() => mudar({ ...ex, opcoes: ex.opcoes.slice(0, -1), resposta: Math.min(ex.resposta, ex.opcoes.length - 2) })}>− alternativa</button>}
          </p>
          <Linha rotuloTexto="Áudio: o que o botão de ouvir fala, na língua estudada (opcional)">{input(ex.audio ?? "", (v) => mudar({ ...ex, audio: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto="Dica (opcional)">{input(ex.dica ?? "", (v) => mudar({ ...ex, dica: v }))}</Linha>
        </div>
      );
    case "traduzir":
      return (
        <div className="grid gap-2">
          <Linha rotuloTexto="Frase a traduzir">{input(ex.frase, (v) => mudar({ ...ex, frase: v }), { lang: ex.na_lingua ? lingua : undefined })}</Linha>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={Boolean(ex.na_lingua)} onChange={(e) => mudar({ ...ex, na_lingua: e.target.checked })} /> A frase está na língua estudada (a resposta é em português)
          </label>
          <Linha rotuloTexto="Traduções aceitas, uma por linha (qualquer uma vale)">
            <textarea value={lista(ex.resposta)} onChange={(e) => mudar({ ...ex, resposta: deLista(e.target.value) })} rows={2} className={campo} lang={ex.na_lingua ? undefined : lingua} />
          </Linha>
          <Linha rotuloTexto="Banco de palavras, uma por linha (opcional; inclua palavras a mais). Sem banco, a pessoa digita">
            <textarea value={lista(ex.palavras)} onChange={(e) => mudar({ ...ex, palavras: deLista(e.target.value) })} rows={3} className={campo} />
          </Linha>
        </div>
      );
    case "pares":
      return (
        <div className="grid gap-1">
          {ex.pares.map(([a, b], i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input value={a} onChange={(e) => mudar({ ...ex, pares: ex.pares.map((p, j) => (j === i ? [e.target.value, p[1]] : p)) })} maxLength={200} placeholder="Esquerda" aria-label={`Par ${i + 1}, esquerda`} className={`${campo} mt-0`} lang={lingua} />
              <input value={b} onChange={(e) => mudar({ ...ex, pares: ex.pares.map((p, j) => (j === i ? [p[0], e.target.value] : p)) })} maxLength={200} placeholder="Direita" aria-label={`Par ${i + 1}, direita`} className={`${campo} mt-0`} />
              <button type="button" className={elo} aria-label="Remover par" onClick={() => mudar({ ...ex, pares: ex.pares.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          {ex.pares.length < 8 && <button type="button" className={`${elo} text-xs`} onClick={() => mudar({ ...ex, pares: [...ex.pares, ["", ""]] })}>+ par</button>}
        </div>
      );
    case "lacuna":
      return (
        <div className="grid gap-2">
          <Linha rotuloTexto="Frase, com ___ no lugar da palavra que falta">{input(ex.frase, (v) => mudar({ ...ex, frase: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto="Palavra certa">{input(ex.resposta, (v) => mudar({ ...ex, resposta: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto="Alternativas, uma por linha (opcional; inclua a certa). Sem elas, a pessoa digita">
            <textarea value={lista(ex.opcoes)} onChange={(e) => mudar({ ...ex, opcoes: deLista(e.target.value) })} rows={3} className={campo} lang={lingua} />
          </Linha>
          <Linha rotuloTexto="Dica (opcional)">{input(ex.dica ?? "", (v) => mudar({ ...ex, dica: v }))}</Linha>
        </div>
      );
    case "cartoes":
      return (
        <div className="grid gap-1">
          {ex.cartoes.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input value={c.frente} onChange={(e) => mudar({ ...ex, cartoes: ex.cartoes.map((x, j) => (j === i ? { ...x, frente: e.target.value } : x)) })} maxLength={200} placeholder="Frente (na língua estudada)" aria-label={`Cartão ${i + 1}, frente`} className={`${campo} mt-0`} lang={lingua} />
              <input value={c.verso} onChange={(e) => mudar({ ...ex, cartoes: ex.cartoes.map((x, j) => (j === i ? { ...x, verso: e.target.value } : x)) })} maxLength={300} placeholder="Verso (tradução, explicação)" aria-label={`Cartão ${i + 1}, verso`} className={`${campo} mt-0`} />
              <button type="button" className={elo} aria-label="Remover cartão" onClick={() => mudar({ ...ex, cartoes: ex.cartoes.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          {ex.cartoes.length < 30 && <button type="button" className={`${elo} text-xs`} onClick={() => mudar({ ...ex, cartoes: [...ex.cartoes, { frente: "", verso: "" }] })}>+ cartão</button>}
        </div>
      );
    default:
      return (
        <div className="grid gap-2">
          <Linha rotuloTexto={ex.tipo === "ordenar" ? "Frase na língua estudada (as palavras serão embaralhadas)" : "Frase na língua estudada"}>{input(ex.frase, (v) => mudar({ ...ex, frase: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto={ex.tipo === "ordenar" ? "Tradução em português (serve de guia)" : "Tradução (opcional)"}>{input(ex.traducao ?? "", (v) => mudar({ ...ex, traducao: v }))}</Linha>
        </div>
      );
  }
}

interface Rascunho {
  trilha: string;
  aula: string;
  exercicios: Exercicio[];
}

/**
 * O educador de idiomas monta aqui a prática lúdica de uma aula: escolhe a trilha e a aula já escrita, acrescenta
 * exercícios de cada tipo, testa como estudante e envia. Vai pela fila de revisão como toda contribuição; aprovada,
 * a publicação grava os exercícios no cabeçalho da aula.
 */
export function EditorDePratica({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const trilhas = useTrackOptions(lang).filter((x) => IDIOMAS.includes(x.area));
  const [trilhaSlug, setTrilhaSlug] = useState("");
  const [aula, setAula] = useState("");
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [novoTipo, setNovoTipo] = useState<TipoDeExercicio>("escolha");
  const [testando, setTestando] = useState(false);
  const acao = useAcao();
  const trilha = trilhas.find((x) => x.slug === trilhaSlug) ?? trilhas[0];
  const lingua = linguaDe(trilha?.area ?? "");
  const aulas = trilha?.lessons ?? [];
  const escolhida = aulas.find((a) => a.slug === aula) ?? aulas[0];

  const estado: Rascunho = { trilha: trilha?.slug ?? "", aula: escolhida?.slug ?? "", exercicios };
  const rascunho = useRascunho<Rascunho>(
    "escrever:pratica",
    estado,
    (dados) => {
      if (dados.trilha) setTrilhaSlug(dados.trilha);
      if (dados.aula) setAula(dados.aula);
      setExercicios(dados.exercicios ?? []);
    },
    { vazio: (d) => d.exercicios.length === 0 },
  );

  const prontos = exercicios.map(limpar);
  let problema = "";
  try {
    validarPratica(prontos, "a prática");
  } catch (erro) {
    problema = (erro as Error).message.replace(/^Conteúdo inválido em a prática: pratica: /, "");
  }
  const trocar = (i: number, ex: Exercicio) => setExercicios(exercicios.map((x, j) => (j === i ? ex : x)));
  const mover = (i: number, passo: number) => {
    const j = i + passo;
    if (j < 0 || j >= exercicios.length) return;
    const copia = [...exercicios];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setExercicios(copia);
  };

  async function enviar() {
    if (!trilha || !escolhida) return acao.setAviso("Escolha a trilha e a aula.");
    if (problema) return acao.setAviso(problema);
    const ok = await acao.agir(
      "contribuir",
      { p: { tipo: "pratica", titulo: `Prática: ${escolhida.title}`, corpo: `Prática lúdica da aula "${escolhida.title}" (${trilha.title}): ${prontos.length} exercícios.`, disciplina: trilha.area, alvo: `${trilha.slug}/${escolhida.slug}`, dados: { exercicios: prontos }, fontes: [] } },
      "Recebido. A prática entrou na fila de revisão; aprovada, passa a aparecer no fim da aula.",
    );
    if (ok) {
      setExercicios([]);
      rascunho.limpar();
    }
  }

  if (trilhas.length === 0) return <p className="text-ink-soft">Carregando as trilhas de idioma…</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Trilha
          <select value={trilha?.slug ?? ""} onChange={(e) => { setTrilhaSlug(e.target.value); setAula(""); }} className={campo}>
            {trilhas.map((x) => (
              <option key={x.slug} value={x.slug}>{t.areas[x.area as keyof typeof t.areas]?.[0]} · {x.title}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Aula (já escrita)
          <select value={escolhida?.slug ?? ""} onChange={(e) => setAula(e.target.value)} className={campo}>
            {aulas.map((a) => (
              <option key={a.slug} value={a.slug}>{a.title}</option>
            ))}
          </select>
        </label>
      </div>
      {escolhida && <p className="text-ink-soft">“{escolhida.summary}” · a língua falada pelo aparelho nesta trilha: <code className="font-mono">{lingua}</code></p>}
      {rascunho.restaurado && rascunho.salvoEm && <p className="border border-rule bg-parchment-deep px-4 py-2 text-ink-soft">Recuperamos o rascunho guardado às {horaDoRascunho(rascunho.salvoEm)}.</p>}

      <ol className="space-y-4">
        {exercicios.map((ex, i) => (
          <li key={i} className="painel-cartao p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                <span className="mr-2 font-mono text-xs text-gold">{i + 1}</span>
                {NOME[ex.tipo]}
              </p>
              <p className="flex gap-3 text-xs">
                <button type="button" className={elo} onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" className={elo} onClick={() => mover(i, 1)} disabled={i === exercicios.length - 1}>↓</button>
                <button type="button" className={`${elo} text-oxblood`} onClick={() => setExercicios(exercicios.filter((_, j) => j !== i))}>Remover</button>
              </p>
            </div>
            <p className="mb-3 text-xs text-ink-soft">{SOBRE[ex.tipo]}</p>
            <Formulario ex={ex} mudar={(novo) => trocar(i, novo)} lingua={lingua} />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-64">
          Acrescentar exercício
          <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoDeExercicio)} className={campo}>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>{NOME[tipo]}</option>
            ))}
          </select>
        </label>
        <button type="button" className={botaoClaro} disabled={exercicios.length >= 60} onClick={() => setExercicios([...exercicios, novo[novoTipo]()])}>+ Acrescentar</button>
      </div>
      <p className="text-xs text-ink-soft">{SOBRE[novoTipo]}</p>

      {exercicios.length > 0 && (
        <p className={`${rotulo} pt-2`}>{prontos.length} exercícios · {problema ? <span className="normal-case tracking-normal text-oxblood">{problema}</span> : "tudo preenchido"}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className={botaoClaro} disabled={exercicios.length === 0 || Boolean(problema)} onClick={() => setTestando((v) => !v)}>{testando ? "Fechar o teste" : "Testar como estudante"}</button>
        <button type="button" className={botao} disabled={acao.ocupado || exercicios.length === 0 || Boolean(problema)} onClick={() => void enviar()}>Enviar para revisão</button>
      </div>
      <p className="text-ink-soft">
        Você assina como <strong>{me.nome}</strong>. {rascunho.salvoEm ? `Rascunho guardado às ${horaDoRascunho(rascunho.salvoEm)}.` : "O rascunho é guardado sozinho enquanto você monta."}
      </p>
      <Aviso texto={acao.aviso} />
      {testando && !problema && <Pratica id={`teste:${trilha?.slug}/${escolhida?.slug}`} exercicios={prontos} lingua={lingua} s={pt.practice} previa />}
    </div>
  );
}
