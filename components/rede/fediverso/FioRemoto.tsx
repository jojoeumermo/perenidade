// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O fio de uma nota de FORA no desenho da conversa nova (classes al3-* de ../conversa/alumia3.css): o que veio antes, a nota em
// destaque, as respostas e a caixa "Responder para @conta@servidor". Post DAQUI no meio do fio vira um link para a conversa dele
// na Alumia. Quem lê lá fora é o servidor daqui (lib/rede/fediverso/tela/cliente.ts); nenhuma lista de quem curtiu ou impulsionou.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent as EventoDeMouse } from "react";
import Link from "@/components/Link";
import { deFora } from "@/lib/rede/fediverso/tela/cliente";
import { deForaVale } from "@/lib/rede/fediverso/tela/linha";
import { textoDoErroDeFora, useTextosDoFediverso, type TextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { contagemVisivel, eDeFora, type CartaoDeFora, type FioDeFora, type PostDaquiNoFio } from "@/lib/rede/fediverso/tela/tipos";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { IconeVoltar } from "../conversa/base3";
import { EsqueletoDaLinha } from "../Esqueletos";
import { useAlumia2 } from "../publicar/alumia2/contexto";
import { Botao } from "../ui/Botao";
import ResponderDeFora, { podeResponderDeFora } from "./ResponderDeFora";
import "../conversa/alumia3.css";

const CartaoRemoto = dynamic(() => import("./CartaoRemoto"), { ssr: false });

/** O servidor de um endereço de nota (para o botão "buscar este post em …"); vazio se o endereço não se lê. */
const servidorDe = (endereco: string): string => {
  try {
    return new URL(endereco).hostname;
  } catch {
    return "";
  }
};

type Estado = { nota: string; dado: FioDeFora | null; erro: string };

/** Um item do fio: de fora, o cartão compacto; daqui, o link para a conversa na Alumia (com um trecho, se o banco mandou o post). */
function ItemDoFio({ item, lang, logado, t }: { item: CartaoDeFora | PostDaquiNoFio; lang: string; logado: boolean; t: TextosDoFediverso }) {
  if (eDeFora(item)) return <CartaoRemoto post={item} lang={lang} logado={logado} densidade="compacta" />;
  const trecho = item.post?.texto?.trim().slice(0, 140);
  return (
    <p className="al3-aviso">
      {item.post && <strong className="al3-nome">{item.post.autor.codinome}: </strong>}
      {trecho && <span>{trecho}{(item.post?.texto.trim().length ?? 0) > 140 ? "…" : ""} </span>}
      <Link href={enderecos.post(lang, item.local)} className="underline">{t.fio.postDaqui}</Link>
    </p>
  );
}

const chaveDe = (item: CartaoDeFora | PostDaquiNoFio) => (eDeFora(item) ? item.id : `daqui:${item.local}`);

/**
 * A conversa de uma nota de fora (/alumia/fediverso?nota=<endereço https da nota>). Só aparece dentro da casca nova, com
 * "fediverso-total" ligado ou na prévia. Nota que a Alumia ainda não guarda NÃO é buscada ao abrir a página: a tela oferece
 * "buscar este post em <servidor>", e só esse toque faz o servidor daqui ir até a origem (um link armado não basta).
 */
export default function FioRemoto({ nota, lang, logado = true }: { nota: string; lang: string; logado?: boolean }) {
  const t = useTextosDoFediverso(lang);
  const casca = useAlumia2();
  const router = useRouter();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [versao, setVersao] = useState(0);
  // A nota que a pessoa mandou buscar na origem (vale só para ela: outra nota volta a pedir o toque).
  const [buscada, setBuscada] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const vale = casca !== null && deForaVale(casca.previa);
  const buscarLa = buscada === nota;

  useEffect(() => {
    if (!vale) return;
    let vivo = true;
    // Na prévia o cliente devolve o fio de exemplo, sem rota nem banco.
    deFora.fio(nota, buscarLa).then((r) => {
      if (vivo) setEstado(r.ok ? { nota, dado: r.dado, erro: "" } : { nota, dado: null, erro: r.erro });
    });
    return () => {
      vivo = false;
    };
  }, [nota, vale, versao, buscarLa]);

  if (!vale || !casca) return null;

  const pronto = estado && estado.nota === nota ? estado : null;
  const total = contagemVisivel(pronto?.dado?.post.respostas);
  // Voltar: a página de onde a pessoa veio, se veio de dentro da Alumia; senão o Início (o link vale sem script e no clique do meio).
  const voltar = (e: EventoDeMouse<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let deDentro = false;
    try {
      deDentro = window.history.length > 1 && (!document.referrer || new URL(document.referrer).origin === window.location.origin);
    } catch {
      deDentro = false;
    }
    if (!deDentro) return;
    e.preventDefault();
    router.back();
  };
  const barra = (
    <div className="al3-barra">
      <Link href={enderecos.linha(lang)} className="al3-voltar" aria-label={t?.fio.voltar} onClick={voltar}>
        <IconeVoltar />
      </Link>
      <h1 className="al3-cond">{t?.fio.titulo}</h1>
      {total !== null && <p className="al3-barra-conta">{preencher(casca.t.cartao.respostas, { n: total })}</p>}
    </div>
  );

  if (!t || !pronto) return <EsqueletoDaLinha rotulo={t?.comum.carregando ?? "…"} quantos={3} />;

  if (!pronto.dado) {
    const codigo = pronto.erro.split(":")[0];
    const servidor = servidorDe(nota);
    // A Alumia não guarda esta nota: nada foi pedido lá fora. A pessoa decide se busca.
    if (codigo === "so_na_origem" && servidor) {
      return (
        <div className="al3">
          {barra}
          <p className="al3-aviso">{preencher(t.fio.buscarLaAjuda, { servidor })}</p>
          <p className="px-4 pb-6">
            <Botao variante="contorno" onClick={() => (setEstado(null), setBuscada(nota))}>{preencher(t.fio.buscarLa, { servidor })}</Botao>
          </p>
        </div>
      );
    }
    return (
      <div className="al3">
        {barra}
        <p className="al3-aviso" role="alert">{textoDoErroDeFora(t, pronto.erro)}</p>
        {codigo !== "instancia_bloqueada" && (
          <p className="px-4 pb-6">
            <Botao variante="contorno" onClick={() => (setEstado(null), setVersao((v) => v + 1))}>{t.comum.tentarDeNovo}</Botao>
          </p>
        )}
      </div>
    );
  }

  const { post, acima, respostas } = pronto.dado;
  const podeResponder = logado && podeResponderDeFora(post);
  const responder = () => {
    campo.current?.scrollIntoView({ block: "center" });
    campo.current?.focus();
  };

  return (
    <div className="al3 al3-conversa">
      {barra}

      {acima.length > 0 && (
        <section aria-labelledby="fed-fio-acima" className="border-b border-[var(--al-linha)]">
          <h2 id="fed-fio-acima" className="al3-cinza px-4 pt-3 text-[0.85rem] font-bold">{t.fio.acima}</h2>
          <ol className="m-0 list-none p-0">
            {acima.map((item) => (
              <li key={chaveDe(item)}>
                <ItemDoFio item={item} lang={lang} logado={logado} t={t} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* A nota aberta: o mesmo cartão de gente de fora, na densidade "aberta". */}
      <div className="al3-raiz al3-raiz-cartao">
        <CartaoRemoto key={post.id} post={post} lang={lang} logado={logado} densidade="aberta" aoResponder={podeResponder ? responder : undefined} />
      </div>

      <section aria-labelledby="fed-fio-respostas">
        <h2 id="fed-fio-respostas" className="al3-cond px-4 pt-4 text-[1.5rem]">{t.fio.respostas}</h2>
        {respostas.length === 0 ? (
          <p className="al3-vazio">{t.fio.semRespostas}</p>
        ) : (
          <ol className="m-0 list-none p-0">
            {respostas.map((item) => (
              <li key={chaveDe(item)}>
                <ItemDoFio item={item} lang={lang} logado={logado} t={t} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {logado && (
        <ResponderDeFora
          key={post.id}
          post={post}
          t={t}
          campo={campo}
          // A resposta nova é um post daqui: o fio é lido de novo e ela aparece no lugar (na prévia nada é gravado).
          aoEnviar={(id) => id && setVersao((v) => v + 1)}
        />
      )}
    </div>
  );
}
