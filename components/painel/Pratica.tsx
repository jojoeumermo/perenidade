// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, ArrowUp, FlaskConical, Plus, Send, Trash2, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import pt from "@/i18n/pt.json";
import type { Me } from "@/lib/backend";
import { type Exercicio, linguaDe, TIPOS, type TipoDeExercicio, validarPratica } from "@/lib/pratica";
import { horaDoRascunho, useRascunho } from "@/lib/rascunho";
import { useI18n } from "../I18n";
import { Pratica } from "../Pratica";
import { useTrackOptions } from "../useTrackOptions";
import { Aviso, useAcao } from "./comum";
import { IDIOMAS } from "./GuiaDaAula";
import { Botao, Cartao, Esqueleto, Faixa, Marca, Selecao, Selo } from "./ui";

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

/** Um campo com o rótulo em cima (o campo vem de fora: pode ser linha ou caixa de texto). */
function Linha({ rotuloTexto, children }: { rotuloTexto: string; children: ReactNode }) {
  return (
    <label className="pn-campo-bloco">
      <span className="pn-rotulo">{rotuloTexto}</span>
      {children}
    </label>
  );
}

/**
 * O botão discreto de acrescentar ou tirar uma linha do exercício. O "+" e o "−" fazem parte da frase (é o que distingue
 * "+ alternativa" de "− alternativa" para o leitor de tela e para a tradução), então ficam no texto, sem ícone.
 */
function Mais({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Botao variante="discreto" pequeno onClick={onClick}>
      {children}
    </Botao>
  );
}

/** O formulário de um exercício, conforme o tipo. */
function Formulario({ ex, mudar, lingua }: { ex: Exercicio; mudar: (ex: Exercicio) => void; lingua: string }) {
  const input = (valor: string, ao: (v: string) => void, extra: Record<string, unknown> = {}) => <input value={valor} onChange={(e) => ao(e.target.value)} maxLength={300} className="pn-campo" {...extra} />;
  switch (ex.tipo) {
    case "escolha":
      return (
        <div className="grid gap-3">
          <Linha rotuloTexto="Pergunta">{input(ex.pergunta, (v) => mudar({ ...ex, pergunta: v }))}</Linha>
          <div className="grid gap-2 sm:grid-cols-2">
            {ex.opcoes.map((o, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" checked={ex.resposta === i} onChange={() => mudar({ ...ex, resposta: i })} aria-label={`Alternativa ${i + 1} certa`} className="accent-oxblood" />
                <input value={o} onChange={(e) => mudar({ ...ex, opcoes: ex.opcoes.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={200} placeholder={`Alternativa ${i + 1}`} className="pn-campo" lang={lingua} />
              </label>
            ))}
          </div>
          <p className="flex flex-wrap gap-2">
            {ex.opcoes.length < 6 && <Mais onClick={() => mudar({ ...ex, opcoes: [...ex.opcoes, ""] })}>+ alternativa</Mais>}
            {ex.opcoes.length > 2 && <Mais onClick={() => mudar({ ...ex, opcoes: ex.opcoes.slice(0, -1), resposta: Math.min(ex.resposta, ex.opcoes.length - 2) })}>− alternativa</Mais>}
          </p>
          <Linha rotuloTexto="Áudio: o que o botão de ouvir fala, na língua estudada (opcional)">{input(ex.audio ?? "", (v) => mudar({ ...ex, audio: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto="Dica (opcional)">{input(ex.dica ?? "", (v) => mudar({ ...ex, dica: v }))}</Linha>
        </div>
      );
    case "traduzir":
      return (
        <div className="grid gap-3">
          <Linha rotuloTexto="Frase a traduzir">{input(ex.frase, (v) => mudar({ ...ex, frase: v }), { lang: ex.na_lingua ? lingua : undefined })}</Linha>
          <Marca rotulo="A frase está na língua estudada (a resposta é em português)" checked={Boolean(ex.na_lingua)} onChange={(e) => mudar({ ...ex, na_lingua: e.target.checked })} />
          <Linha rotuloTexto="Traduções aceitas, uma por linha (qualquer uma vale)">
            <textarea value={lista(ex.resposta)} onChange={(e) => mudar({ ...ex, resposta: deLista(e.target.value) })} rows={2} className="pn-campo" lang={ex.na_lingua ? undefined : lingua} />
          </Linha>
          <Linha rotuloTexto="Banco de palavras, uma por linha (opcional; inclua palavras a mais). Sem banco, a pessoa digita">
            <textarea value={lista(ex.palavras)} onChange={(e) => mudar({ ...ex, palavras: deLista(e.target.value) })} rows={3} className="pn-campo" />
          </Linha>
        </div>
      );
    case "pares":
      return (
        <div className="grid gap-2">
          {ex.pares.map(([a, b], i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input value={a} onChange={(e) => mudar({ ...ex, pares: ex.pares.map((p, j) => (j === i ? [e.target.value, p[1]] : p)) })} maxLength={200} placeholder="Esquerda" aria-label={`Par ${i + 1}, esquerda`} className="pn-campo" lang={lingua} />
              <input value={b} onChange={(e) => mudar({ ...ex, pares: ex.pares.map((p, j) => (j === i ? [p[0], e.target.value] : p)) })} maxLength={200} placeholder="Direita" aria-label={`Par ${i + 1}, direita`} className="pn-campo" />
              <Botao variante="discreto" pequeno icone perigo simbolo={X} aria-label="Remover par" onClick={() => mudar({ ...ex, pares: ex.pares.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {ex.pares.length < 8 && (
            <p>
              <Mais onClick={() => mudar({ ...ex, pares: [...ex.pares, ["", ""]] })}>+ par</Mais>
            </p>
          )}
        </div>
      );
    case "lacuna":
      return (
        <div className="grid gap-3">
          <Linha rotuloTexto="Frase, com ___ no lugar da palavra que falta">{input(ex.frase, (v) => mudar({ ...ex, frase: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto="Palavra certa">{input(ex.resposta, (v) => mudar({ ...ex, resposta: v }), { lang: lingua })}</Linha>
          <Linha rotuloTexto="Alternativas, uma por linha (opcional; inclua a certa). Sem elas, a pessoa digita">
            <textarea value={lista(ex.opcoes)} onChange={(e) => mudar({ ...ex, opcoes: deLista(e.target.value) })} rows={3} className="pn-campo" lang={lingua} />
          </Linha>
          <Linha rotuloTexto="Dica (opcional)">{input(ex.dica ?? "", (v) => mudar({ ...ex, dica: v }))}</Linha>
        </div>
      );
    case "cartoes":
      return (
        <div className="grid gap-2">
          {ex.cartoes.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input value={c.frente} onChange={(e) => mudar({ ...ex, cartoes: ex.cartoes.map((x, j) => (j === i ? { ...x, frente: e.target.value } : x)) })} maxLength={200} placeholder="Frente (na língua estudada)" aria-label={`Cartão ${i + 1}, frente`} className="pn-campo" lang={lingua} />
              <input value={c.verso} onChange={(e) => mudar({ ...ex, cartoes: ex.cartoes.map((x, j) => (j === i ? { ...x, verso: e.target.value } : x)) })} maxLength={300} placeholder="Verso (tradução, explicação)" aria-label={`Cartão ${i + 1}, verso`} className="pn-campo" />
              <Botao variante="discreto" pequeno icone perigo simbolo={X} aria-label="Remover cartão" onClick={() => mudar({ ...ex, cartoes: ex.cartoes.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {ex.cartoes.length < 30 && (
            <p>
              <Mais onClick={() => mudar({ ...ex, cartoes: [...ex.cartoes, { frente: "", verso: "" }] })}>+ cartão</Mais>
            </p>
          )}
        </div>
      );
    default:
      return (
        <div className="grid gap-3">
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

  if (trilhas.length === 0) return <Esqueleto forma="linhas" linhas={3} rotulo="Carregando as trilhas de idioma…" />;

  return (
    <div className="pn-tela">
      <Cartao as="div">
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao
            rotulo="Trilha"
            value={trilha?.slug ?? ""}
            onChange={(e) => {
              setTrilhaSlug(e.target.value);
              setAula("");
            }}
          >
            {trilhas.map((x) => (
              <option key={x.slug} value={x.slug}>
                {t.areas[x.area as keyof typeof t.areas]?.[0]} · {x.title}
              </option>
            ))}
          </Selecao>
          <Selecao rotulo="Aula (já escrita)" value={escolhida?.slug ?? ""} onChange={(e) => setAula(e.target.value)}>
            {aulas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.title}
              </option>
            ))}
          </Selecao>
        </div>
        {escolhida && (
          <p className="pn-ajuda mt-3">
            “{escolhida.summary}” · a língua falada pelo aparelho nesta trilha: <code className="font-mono">{lingua}</code>
          </p>
        )}
      </Cartao>
      {rascunho.restaurado && rascunho.salvoEm && <Faixa tom="info">Recuperamos o rascunho guardado às {horaDoRascunho(rascunho.salvoEm)}.</Faixa>}

      {exercicios.length > 0 && (
        <ol className="grid gap-3" aria-label="Exercícios">
          {exercicios.map((ex, i) => (
            <li key={i}>
              <Cartao
                as="article"
                titulo={
                  <span className="flex items-baseline gap-2">
                    <span className="pn-rotulo-mono tabular-nums">{i + 1}</span>
                    {NOME[ex.tipo]}
                  </span>
                }
                nivelDoTitulo={3}
                sobre={SOBRE[ex.tipo]}
                acoes={
                  <>
                    <Botao variante="discreto" pequeno icone simbolo={ArrowUp} aria-label="Subir" dica="Subir" onClick={() => mover(i, -1)} disabled={i === 0} />
                    <Botao variante="discreto" pequeno icone simbolo={ArrowDown} aria-label="Descer" dica="Descer" onClick={() => mover(i, 1)} disabled={i === exercicios.length - 1} />
                    <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={() => setExercicios(exercicios.filter((_, j) => j !== i))}>
                      Remover
                    </Botao>
                  </>
                }
              >
                <div className="mt-3">
                  <Formulario ex={ex} mudar={(novo) => trocar(i, novo)} lingua={lingua} />
                </div>
              </Cartao>
            </li>
          ))}
        </ol>
      )}

      <Cartao as="div" variante="plano">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <Selecao rotulo="Acrescentar exercício" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoDeExercicio)}>
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {NOME[tipo]}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao simbolo={Plus} disabled={exercicios.length >= 60} onClick={() => setExercicios([...exercicios, novo[novoTipo]()])}>
            Acrescentar
          </Botao>
        </div>
        <p className="pn-ajuda mt-2">{SOBRE[novoTipo]}</p>
      </Cartao>

      {exercicios.length > 0 && (
        <p className="flex flex-wrap items-center gap-2" role="status">
          <span className="pn-rotulo-mono">{prontos.length} exercícios</span>
          {problema ? <Selo tom="aviso">{problema}</Selo> : <Selo tom="ok">tudo preenchido</Selo>}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Botao simbolo={FlaskConical} aria-pressed={testando} disabled={exercicios.length === 0 || Boolean(problema)} onClick={() => setTestando((v) => !v)}>
          {testando ? "Fechar o teste" : "Testar como estudante"}
        </Botao>
        <Botao variante="principal" simbolo={Send} carregando={acao.ocupado} disabled={exercicios.length === 0 || Boolean(problema)} onClick={() => void enviar()}>
          Enviar para revisão
        </Botao>
      </div>
      <p className="pn-ajuda">
        Você assina como <strong>{me.nome}</strong>. {rascunho.salvoEm ? `Rascunho guardado às ${horaDoRascunho(rascunho.salvoEm)}.` : "O rascunho é guardado sozinho enquanto você monta."}
      </p>
      <Aviso texto={acao.aviso} />
      {testando && !problema && <Pratica id={`teste:${trilha?.slug}/${escolhida?.slug}`} exercicios={prontos} lingua={lingua} s={pt.practice} previa />}
    </div>
  );
}
