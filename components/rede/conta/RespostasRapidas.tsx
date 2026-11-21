// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 111. Respostas rápidas: textos prontos guardados SÓ neste aparelho (a chave começa com "lucia", então o Sair rápido apaga). No chat,
// um botão abre a lista e cola o texto escolhido no campo de escrever: daí em diante é uma mensagem como outra qualquer (cifrada
// pelo chat, como sempre). Nada vai ao servidor por aqui.
import { useId, useState, type FormEvent } from "react";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { arrumarRespostas, MAX_LETRAS_DA_RESPOSTA, MAX_RESPOSTAS } from "@/lib/rede/conta/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { guarda, useTextosDaConta, type TextosDaConta } from "./textos";

export const CHAVE_DAS_RESPOSTAS = "lucia:rede:conta:respostas";

export function lerRespostas(): string[] {
  try {
    return arrumarRespostas(JSON.parse(guarda.getItem(CHAVE_DAS_RESPOSTAS) ?? "[]"));
  } catch {
    return [];
  }
}
function guardarRespostas(lista: string[]) {
  guarda.setItem(CHAVE_DAS_RESPOSTAS, JSON.stringify(arrumarRespostas(lista)));
}

/** A parte de Conta › Atendimento: guardar e apagar as respostas. */
export function EditarRespostas({ t }: { t: TextosDaConta }) {
  const id = useId();
  const [lista, setLista] = useState<string[]>(() => lerRespostas());
  const [novo, setNovo] = useState("");
  function adicionar(e: FormEvent) {
    e.preventDefault();
    const nova = arrumarRespostas([...lista, novo]);
    guardarRespostas(nova);
    setLista(nova);
    setNovo("");
  }
  function apagar(r: string) {
    const nova = lista.filter((x) => x !== r);
    guardarRespostas(nova);
    setLista(nova);
  }
  return (
    <section className="ct-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ct-subtitulo al-cond">{t.respostas.titulo}</h2>
      <p className="ct-miudo">{t.respostas.sobre}</p>
      {lista.length === 0 && <p className="ct-miudo">{t.respostas.vazia}</p>}
      <ul className="ct-lista">
        {lista.map((r) => (
          <li key={r} className="ct-cartao">
            <p>{r}</p>
            <div className="ct-acoes">
              <Botao variante="fantasma" onClick={() => apagar(r)} aria-label={preencher(t.respostas.apagar, { texto: r.slice(0, 40) })}>×</Botao>
            </div>
          </li>
        ))}
      </ul>
      {lista.length < MAX_RESPOSTAS && (
        <form className="ct-form" onSubmit={adicionar}>
          <label htmlFor={`${id}-nova`}>{t.respostas.nova}
            <textarea id={`${id}-nova`} value={novo} maxLength={MAX_LETRAS_DA_RESPOSTA} onChange={(e) => setNovo(e.target.value)} />
          </label>
          <p className="ct-miudo">{preencher(t.respostas.limite, { n: MAX_RESPOSTAS, letras: MAX_LETRAS_DA_RESPOSTA })}</p>
          <div className="ct-acoes"><Botao type="submit" disabled={!novo.trim()}>{t.respostas.adicionar}</Botao></div>
        </form>
      )}
    </section>
  );
}

/**
 * No chat: o botão "Respostas rápidas" ao lado do campo de escrever. Só aparece com a rota "conta" ligada e alguma resposta
 * guardada. Escolher cola o texto no campo (a pessoa ainda revisa e envia).
 */
export function RespostasNoChat({ lang, aoEscolher }: { lang: string; aoEscolher: (texto: string) => void }) {
  const ligado = rotaNovaLigada("conta");
  const t = useTextosDaConta(lang);
  const [lista, setLista] = useState<string[]>(() => (ligado ? lerRespostas() : []));
  const [aberto, setAberto] = useState(false);
  const id = useId();
  if (!ligado || !t || lista.length === 0) return null;
  return (
    <div className="relative">
      <button type="button" className="inline-flex min-h-11 items-center underline" aria-expanded={aberto} aria-controls={`${id}-lista`} onClick={() => { setLista(lerRespostas()); setAberto((a) => !a); }}>
        {t.respostas.usar}
      </button>
      {aberto && (
        <ul id={`${id}-lista`} className="absolute bottom-full left-0 z-10 mb-1 grid max-h-64 w-72 max-w-[80vw] gap-1 overflow-y-auto rounded-lg border border-rule bg-parchment p-1 shadow">
          {lista.map((r) => (
            <li key={r}>
              <button type="button" className="min-h-11 w-full rounded px-2 py-1 text-left hover:bg-folha" aria-label={preencher(t.respostas.usarItem, { texto: r.slice(0, 60) })}
                onClick={() => { aoEscolher(r); setAberto(false); }}>
                {r.length > 80 ? `${r.slice(0, 80)}…` : r}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
