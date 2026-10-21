// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { type Corretor, criarCorretor } from "@/lib/ferramentas/hunspell";
import { palavrasDoTexto } from "@/lib/ferramentas/ortografia";
import { Bancada, BotaoClaro, Leitura } from "../../labs/kit";
import { lerComprimido } from "./Chines";
import { ComoUsar } from "./comum";

let corretor: Promise<Corretor> | null = null;
const carregar = () => (corretor ??= Promise.all([lerComprimido("/dados/ortografia/pt-br.aff.gzip"), lerComprimido("/dados/ortografia/pt-br.dic.gzip")]).then(([aff, dic]) => criarCorretor(aff, dic)));

const CHAVE = "lucia:ortografia-ignoradas";
const lerIgnoradas = (): string[] => { try { return JSON.parse(window.localStorage.getItem(CHAVE) ?? "[]") as string[]; } catch { return []; } };

/** Corretor ortográfico de português do Brasil, no aparelho: nada do texto sai daqui. */
export function CorretorOrtografico() {
  const [c, setC] = useState<Corretor | null>(null);
  const [erro, setErro] = useState(false);
  const [texto, setTexto] = useState("Escreva aqui o seu texto. Por exenplo: a educassão popular nasse da conversa e do trabalho de todo mundo.");
  const [aberta, setAberta] = useState<number | null>(null);
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    carregar().then((x) => vivo && setC(x)).catch(() => vivo && setErro(true));
    void Promise.resolve().then(() => setIgnoradas(lerIgnoradas()));
    return () => { vivo = false; };
  }, []);
  const palavras = useMemo(() => palavrasDoTexto(texto), [texto]);
  const erradas = useMemo(() => (c ? palavras.filter((p) => !/^\p{Lu}{2,5}$/u.test(p.palavra) && !ignoradas.includes(p.palavra.toLocaleLowerCase("pt-BR")) && !c.correta(p.palavra)) : []), [c, palavras, ignoradas]);
  const ignorar = (w: string) => {
    const lista = [...new Set([...ignoradas, w.toLocaleLowerCase("pt-BR")])].slice(-500);
    setIgnoradas(lista);
    try { window.localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* sem espaço: vale até fechar */ }
  };
  const trocar = (inicio: number, antes: string, depois: string) => {
    setTexto((t) => t.slice(0, inicio) + depois + t.slice(inicio + antes.length));
    setAberta(null);
  };
  // O texto com as palavras erradas marcadas, para tocar e ver as sugestões.
  const partes: React.ReactNode[] = [];
  let pos = 0;
  for (const e of erradas) {
    partes.push(texto.slice(pos, e.inicio));
    const sugestoes = aberta === e.inicio && c ? c.sugestoes(e.palavra) : [];
    partes.push(
      <span key={e.inicio} className="relative inline-block">
        <button type="button" onClick={() => setAberta(aberta === e.inicio ? null : e.inicio)} aria-expanded={aberta === e.inicio} className="cursor-pointer underline decoration-[#c21f16] decoration-wavy underline-offset-4">{e.palavra}</button>
        {aberta === e.inicio && (
          <span className="absolute top-full left-0 z-10 mt-1 flex min-w-40 flex-col rounded border-2 border-ink bg-parchment p-1 text-sm shadow-lg">
            {sugestoes.length ? sugestoes.map((s) => <button key={s} type="button" onClick={() => trocar(e.inicio, e.palavra, s)} className="cursor-pointer rounded px-2 py-1 text-left font-semibold hover:bg-[#ffd27a]">{s}</button>) : <span className="px-2 py-1 text-ink-soft">sem sugestão</span>}
            <button type="button" onClick={() => { ignorar(e.palavra); setAberta(null); }} className="cursor-pointer border-t border-rule px-2 py-1 text-left text-xs underline">Está certa: aceitar neste aparelho</button>
          </span>
        )}
      </span>,
    );
    pos = e.inicio + e.palavra.length;
  }
  partes.push(texto.slice(pos));
  return (
    <div>
      <Bancada titulo="Corretor ortográfico" subtitulo="Português do Brasil, conferido no seu aparelho">
        <label className="block text-sm font-semibold">Seu texto
          <textarea value={texto} onChange={(e) => { setTexto(e.target.value.slice(0, 20000)); setAberta(null); }} rows={6} spellCheck={false} lang="pt-BR" className="mt-1 w-full border-2 border-ink/30 bg-parchment p-2 text-base" />
        </label>
        {!c && !erro && <p className="mt-2 text-sm text-ink-soft">Carregando o dicionário (cerca de 1,3 MB, só na primeira vez)…</p>}
        {erro && <p className="mt-2 text-sm text-oxblood">Não deu para carregar o dicionário. Confira a conexão e recarregue a página.</p>}
        {c && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Leitura rotulo="Palavras" valor={String(palavras.length)} />
              <Leitura rotulo="Para conferir" valor={String(erradas.length)} destaque={erradas.length > 0} />
            </div>
            <p className="mt-3 rounded border-2 border-ink bg-white p-3 text-lg leading-loose text-[#17130e]" lang="pt-BR">{partes}</p>
            <p className="mt-2 text-sm">{erradas.length ? "Toque numa palavra marcada para ver as sugestões." : "✓ Nenhuma palavra desconhecida."}</p>
            {ignoradas.length > 0 && <p className="mt-1 text-xs text-ink-soft">Palavras aceitas neste aparelho: {ignoradas.length}. <button type="button" className="cursor-pointer underline" onClick={() => { setIgnoradas([]); try { window.localStorage.removeItem(CHAVE); } catch { /* nada */ } }}>Esquecer todas</button></p>}
          </>
        )}
        <p className="mt-3 text-xs text-ink-soft">O corretor confere a grafia das palavras, não a gramática: “mas” e “mais”, “há” e “a” só a leitura atenta separa. Nomes próprios e palavras novas podem aparecer marcados. O texto não sai do aparelho e não é guardado.</p>
        <div className="mt-2"><BotaoClaro onClick={() => { setTexto(""); setAberta(null); }}>Limpar o texto</BotaoClaro></div>
      </Bancada>
      <ComoUsar
        passos={["Escreva ou cole o texto na caixa.", "As palavras que o dicionário não conhece ficam sublinhadas; toque para ver sugestões.", "Escolha a sugestão ou marque que a palavra está certa (vale só neste aparelho)."]}
        atividades={["Escreva um parágrafo sobre o seu bairro sem olhar o corretor e depois confira: que tipo de erro mais aparece (acento, s/ss/ç, h)?", "Teste palavras parecidas: “concerto” e “conserto”, “sessão” e “seção”. O corretor aceita todas: por quê? Qual é a diferença de sentido?", "Cole a sua redação do ENEM de treino e corrija a grafia antes de revisar a argumentação."]}
        fonte={<>Dicionário <a href="https://pt-br.libreoffice.org/projetos/projeto-vero-verificador-ortografico/" target="_blank" rel="noopener noreferrer nofollow" className="underline">VERO</a>, de Raimundo Moura e equipe (LibreOffice), sob LGPL-3.0 ou MPL-2.0. A conferência é feita por um verificador do próprio site, no aparelho.</>}
      />
    </div>
  );
}
