// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 133 (/alumia/fio/[id], atrás de "alumia-p4-pontes"): o fio de uma autora como texto corrido, numa página limpa,
// com o modo foco e o "Ouvir" com a voz do aparelho (nada vai à rede). O banco só junta o que quem lê já pode ver (interno.rede_ve),
// sem post cifrado nem de núcleo; a resposta de outra pessoa fica na conversa.
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { escolherVoz, ETIQUETA_DA_LINGUA, trechosParaFalar } from "@/lib/rede/midia/voz";
import { pontes, type FioComoTexto } from "@/lib/rede/p4/pontes/cliente";
import { paragrafosDoFio, textoDoFioParaOuvir } from "@/lib/rede/p4/pontes/fio";
import { arvoreDeExemplo } from "@/lib/rede/conversa/exemplos";
import { enderecos } from "@/lib/rede/tipos";
import { previa } from "../../conversa/base3";
import type { PropsDaTelaDoPacote } from "../../registro";
import { por, textoDoErro } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

const botao = "inline-flex min-h-11 items-center rounded-full border border-current px-4 font-semibold";

function fioDaPrevia(id: string): FioComoTexto {
  const a = arvoreDeExemplo(id);
  if (!a) throw new Error("nao_encontrado");
  const autora = a.post.autor.handle;
  const partes = [a.post, ...a.respostas.filter((r) => autora && r.autor.handle === autora)];
  return { autor: a.post.autor.codinome, itens: partes.map((p) => ({ id: p.id, titulo: p.titulo ?? null, texto: p.texto, corpo: p.corpo ?? null, criado_em: p.criado_em })) };
}

export default function TelaDoFio({ lang, params }: PropsDaTelaDoPacote) {
  const id = params.id ?? "";
  const t = useTextosDasPontes(lang);
  const [fio, setFio] = useState<FioComoTexto | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [foco, setFoco] = useState(false);
  const [falando, setFalando] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Na prévia (dados de exemplo, sem banco): o post de exemplo e as respostas da mesma autora, montados aqui.
    const pedido = previa() ? Promise.resolve(fioDaPrevia(id)) : pontes.fio(id);
    pedido
      .then((r) => vivo && setFio(r))
      .catch((e: unknown) => vivo && setErro(e ?? "generico"));
    return () => {
      vivo = false;
    };
  }, [id]);

  // Sair da página para a voz.
  useEffect(() => () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.cancel() : undefined), []);

  if (!t) return null;
  if (erro) return <p role="alert" className="px-4 py-6">{textoDoErro(t.erros, erro)}</p>;
  if (!fio) return <p className="px-4 py-6" aria-busy="true">{t.carregando}</p>;

  const blocos = paragrafosDoFio(fio);
  const temVoz = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

  function ouvir() {
    const s = window.speechSynthesis;
    if (falando) {
      s.cancel();
      setFalando(false);
      return;
    }
    // Só voz do próprio aparelho (localService); sem ela, nada toca.
    const voz = escolherVoz(s.getVoices(), lang);
    if (!voz) return;
    const trechos = trechosParaFalar(textoDoFioParaOuvir(fio));
    s.cancel();
    trechos.forEach((x, i) => {
      const u = new SpeechSynthesisUtterance(x);
      u.voice = voz;
      u.lang = ETIQUETA_DA_LINGUA[lang] ?? lang;
      if (i === trechos.length - 1) u.onend = () => setFalando(false);
      s.speak(u);
    });
    setFalando(true);
  }

  return (
    <article
      className={foco ? "fixed inset-0 z-50 overflow-y-auto bg-[var(--al-fundo,#f4efe6)] px-4 py-6 text-[1.25rem] leading-relaxed text-[var(--al-texto,#1f1a14)]" : "px-4 py-6 text-[1.125rem] leading-relaxed"}
      aria-labelledby="p4-fio-titulo"
      data-p4-fio
      data-foco={foco ? "sim" : "nao"}
    >
      <div className="mx-auto max-w-[68ch]">
        <header className="mb-4 flex flex-col gap-2">
          <h1 id="p4-fio-titulo" className="text-2xl font-bold">{por(t.fio.de, { autor: fio.autor })}</h1>
          <p className="text-sm opacity-80">{por(t.fio.partes, { n: blocos.length })} · {t.fio.nota}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botao} aria-pressed={foco} onClick={() => setFoco(!foco)}>{foco ? t.fio.sairFoco : t.fio.foco}</button>
            {temVoz && <button type="button" className={botao} aria-pressed={falando} onClick={ouvir}>{falando ? t.fio.parar : t.fio.ouvir}</button>}
            {!foco && <Link href={enderecos.post(lang, id)} className={botao}>{t.fio.voltar}</Link>}
          </div>
        </header>
        {blocos.map((b) => (
          <section key={b.id} className="mb-5">
            {b.titulo && <h2 className="mb-2 text-xl font-bold">{b.titulo}</h2>}
            {b.linhas.map((l, i) => (
              <p key={i} className="mb-3 break-words">{l}</p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
