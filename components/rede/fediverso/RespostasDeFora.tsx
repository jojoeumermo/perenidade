// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { deFora } from "@/lib/rede/fediverso/tela/cliente";
import { deForaVale } from "@/lib/rede/fediverso/tela/linha";
import { preencher } from "@/lib/rede/preencher";
import { textoDoErroDeFora, useTextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { contagemVisivel, type CartaoDeFora } from "@/lib/rede/fediverso/tela/tipos";
import { useAlumia2 } from "../publicar/alumia2/contexto";
import CartaoRemoto from "./CartaoRemoto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Na conversa de um post daqui, logo depois do fio: as respostas que vieram de outros servidores, cada uma no cartão de fora
 * (CartaoRemoto, densidade compacta), da mais antiga à mais nova. Quem lê é o servidor (deFora.respostasDe → GET
 * /api/fediverso/remoto?respostas=<id do post>), que troca avatar e mídia pela rota-proxy; a função do banco nunca é chamada
 * daqui direto. Sem resposta de fora (ou sem sessão), não desenha nada. O número só aparece a partir de 3. Só com
 * "fediverso-total" ligado e dentro da casca nova; na prévia vem a resposta de exemplo da prancha, sem pedido nenhum.
 *
 * `logado`: a rota só responde a quem entrou, então, fora da prévia, quem vê alguma resposta aqui tem sessão.
 */
export default function RespostasDeFora({ post, lang, logado = true }: { post: { id: string } | string; lang: string; logado?: boolean }) {
  const al2 = useAlumia2();
  const tf = useTextosDoFediverso(lang);
  const id = typeof post === "string" ? post : post.id;
  const previa = al2?.previa === true;
  const pode = al2 !== null && deForaVale(previa) && (previa || (logado && UUID.test(id)));
  const [dado, setDado] = useState<{ id: string; itens: CartaoDeFora[]; proximo: string | null; total: number } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    // Falha na primeira página (sem sessão, federação desligada): a conversa daqui segue igual, sem aviso.
    deFora.respostasDe(id).then((r) => vivo && r.ok && setDado({ id, ...r.dado }));
    return () => {
      vivo = false;
    };
  }, [id, pode]);

  const atual = pode && dado?.id === id ? dado : null;
  const mais = useCallback(async () => {
    if (!atual?.proximo || carregando) return;
    setCarregando(true);
    setErro("");
    const r = await deFora.respostasDe(atual.id, atual.proximo);
    setCarregando(false);
    if (!r.ok) return setErro(r.erro);
    setDado((d) => {
      if (!d || d.id !== atual.id) return d;
      const vistos = new Set(d.itens.map((c) => c.id));
      return { id: d.id, itens: [...d.itens, ...r.dado.itens.filter((c) => !vistos.has(c.id))], proximo: r.dado.proximo, total: r.dado.total };
    });
  }, [atual, carregando]);

  if (!atual || !tf || atual.itens.length === 0) return null;
  const n = contagemVisivel(atual.total);
  return (
    <section aria-labelledby={`fed-respostas-${id}`} className="border-t border-[var(--al-superficie-2)] font-sans">
      <h2 id={`fed-respostas-${id}`} className="px-4 pb-1 pt-4 text-[0.8125rem] font-extrabold uppercase tracking-wide text-[var(--al-texto-3)]">
        {n === null ? tf.fio.respostasDeFora : preencher(tf.fio.respostasDeForaN, { n })}
      </h2>
      <ol className="alumia-lista">
        {atual.itens.map((c) => (
          <li key={c.id}>
            <CartaoRemoto post={c} lang={lang} logado={logado} densidade="compacta" />
          </li>
        ))}
      </ol>
      {atual.proximo && (
        <div className="px-4 py-3 text-center">
          {erro && (
            <p role="alert" className="pb-2 text-sm text-[var(--al-vermelho)]">
              {textoDoErroDeFora(tf, erro)}
            </p>
          )}
          <button type="button" onClick={() => void mais()} disabled={carregando} aria-busy={carregando} className="al-botao al-botao-contorno al-botao-m al2-aperta">
            {tf.fio.maisRespostas}
          </button>
        </div>
      )}
    </section>
  );
}
