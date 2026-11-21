// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { rede } from "@/lib/rede/cliente";
import { useAlumia2 } from "../publicar/alumia2/contexto";
import { grupoDoPost, LIMITE_DO_POST_CIFRADO, pedidoCifrado } from "../publicar/restrito/grupo";
import { SeloDaCifra } from "../publicar/restrito/NaTela";
import { textoDaCifra, useTextosDoRestrito } from "../publicar/restrito/textos";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import type { PedidoDePost, Post } from "@/lib/rede/tipos";
import { cargos } from "./cargos/cliente";
import { textoDoErro as erroDosCargos } from "./cargos/textos";
import { useTextosDosCargos } from "./cargos/usarTextos";
import { botao, botaoClaro, campo, erroCom } from "./util";

/**
 * Um escritor enxuto para os dois lugares em que o post já nasce preso a algo: a conversa de uma aula e o mural de um núcleo.
 * Dúvida e discussão (título e texto) ou post curto. O destino (comunidade, ou núcleo com público "nucleo") vem do pai, que também
 * liga o post à aula depois de publicado (`aoPublicar` pode devolver uma promessa: erro dela aparece aqui, dentro da página).
 * Numa comunidade que pede as regras antes de postar (onda 10, frente 10B), as regras aparecem antes do formulário com o "Li e
 * aceito"; o banco confere de novo no gatilho, e o erro "leia_as_regras" traz as regras de volta.
 *
 * Posts restritos (P21, docs/rede/POSTS-RESTRITOS.md): no mural do núcleo (e numa comunidade FECHADA, com `tipoDaComunidade`), o
 * post é curto e vai cifrado em MLS deste aparelho (lib/rede/grupos/chaveiro.ts): o banco recebe o texto vazio, o grupo e o corpo "p2.…".
 * `grupo_suspeito` (a chave de alguém mudou) não publica.
 */
export function Compositor({
  s,
  sc,
  destino,
  aoPublicar,
  aoCancelar,
  lang: langDado,
  tipoDaComunidade = null,
}: {
  s: TextosDaRede;
  sc: TextosDeComunidades;
  destino: Pick<PedidoDePost, "comunidade" | "nucleo" | "publico">;
  aoPublicar: (post: Post) => Promise<void> | void;
  aoCancelar?: () => void;
  /** O idioma da página; sem ele, o primeiro pedaço do endereço (/pt/…). */
  lang?: string;
  /** O tipo da comunidade do destino: "fechada" com público "comunidade" cifra o post (P21). */
  tipoDaComunidade?: string | null;
}) {
  const a = sc.aula;
  const caminho = usePathname();
  const lang = langDado ?? (caminho?.split("/")[1] || "pt");
  // O grupo da chave quando o post vai cifrado (núcleo, comunidade fechada); nulo: o post de sempre.
  const grupo = grupoDoPost({ publico: destino.publico, nucleo: destino.nucleo, comunidade: destino.comunidade, tipoDaComunidade });
  const tr = useTextosDoRestrito(lang, grupo !== null);
  const previa = Boolean(useAlumia2()?.previa);
  const [tipoEscolhido, setTipo] = useState<"duvida" | "discussao" | "post">("post");
  // Cifrado, só o post curto (o título de uma dúvida ou discussão iria aberto).
  const tipo = grupo ? "post" : tipoEscolhido;
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const longo = tipo !== "post";
  const regras = useRegrasAntes(destino.comunidade ?? null, lang);

  // Quem abre o grupo já deixa o aparelho pronto para receber o que for escrito (os pacotes de chave publicados).
  useEffect(() => {
    if (!grupo || previa) return;
    void import("../publicar/restrito/aparelho").then((m) => m.prepararOAparelho());
  }, [grupo, previa]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setMensagem(null);
    try {
      const pedido: PedidoDePost = longo ? { ...destino, tipo, titulo: titulo.trim(), corpo: texto.trim() } : { ...destino, tipo: "post", texto: texto.trim() };
      if (grupo) {
        if (!tr) return;
        if (previa) {
          setMensagem({ texto: tr.previa, erro: false });
          return;
        }
        setMensagem({ texto: tr.cifrando, erro: false });
        const { cifrarNoAparelho } = await import("../publicar/restrito/aparelho");
        const cifra = await cifrarNoAparelho(grupo, texto.trim());
        if (!cifra.ok) {
          setMensagem({ texto: textoDaCifra(tr, cifra.codigo), erro: true });
          return;
        }
        const post = await rede.publicar(pedidoCifrado(pedido, cifra));
        await aoPublicar(post);
        setTexto("");
        setMensagem({ texto: a.publicado, erro: false });
        return;
      }
      const post = await rede.publicar(pedido);
      await aoPublicar(post);
      setTitulo("");
      setTexto("");
      setMensagem({ texto: a.publicado, erro: false });
    } catch (erro) {
      if (codigoDe(erro) === "leia_as_regras") regras.pedir();
      setMensagem({ texto: regras.t && codigoDe(erro) === "leia_as_regras" ? erroDosCargos(regras.t.erros, erro) : erroCom(s, sc, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  if (regras.precisa && regras.t) {
    const tc = regras.t;
    return (
      <section aria-label={tc.regras.titulo} className="space-y-3 border-b border-rule px-[18px] py-4 font-sans">
        <p className="text-sm font-bold">{tc.antes.compositor}</p>
        {regras.lista.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            {regras.lista.map((r) => (
              <li key={r.numero}>
                <strong className="text-ink">{r.titulo}</strong>
                {r.texto && <span> {r.texto}</span>}
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={regras.ocupado} className={botao} onClick={() => void regras.aceitar()}>{regras.ocupado ? tc.regras.aceitando : tc.regras.aceitar}</button>
          {aoCancelar && <button type="button" onClick={aoCancelar} className={botaoClaro}>{a.cancelar}</button>}
        </div>
        {regras.erro && <p role="alert" className="text-sm text-oxblood">{regras.erro}</p>}
      </section>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-3 border-b border-rule px-[18px] py-4 font-sans">
      {!grupo && (
        <label className="block text-sm text-ink-soft">
          {a.tipo}
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={campo}>
            <option value="post">{a.post}</option>
            <option value="duvida">{a.duvida}</option>
            <option value="discussao">{a.discussao}</option>
          </select>
        </label>
      )}
      {longo && (
        <label className="block text-sm text-ink-soft">
          {a.titulo_campo}
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} minLength={5} maxLength={140} required className={campo} />
        </label>
      )}
      <label className="block text-sm text-ink-soft">
        {destino.nucleo ? a.textoNucleo : a.texto}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} minLength={longo ? 10 : 1} maxLength={longo ? 10000 : grupo ? LIMITE_DO_POST_CIFRADO : 500} rows={longo ? 6 : 3} required className={campo} />
      </label>
      {grupo && tr && <SeloDaCifra t={tr} onde={destino.publico === "nucleo" ? "nucleo" : "comunidade"} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado || (grupo !== null && !tr)} className={botao}>{ocupado ? a.publicando : a.publicar}</button>
        {aoCancelar && <button type="button" onClick={aoCancelar} className={botaoClaro}>{a.cancelar}</button>}
      </div>
      {mensagem && <p role={mensagem.erro ? "alert" : "status"} className={`text-sm ${mensagem.erro ? "text-oxblood" : "text-ink-soft"}`}>{mensagem.texto}</p>}
    </form>
  );
}

function codigoDe(erro: unknown): string {
  return typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code) : "";
}

/**
 * As regras antes de postar, para o compositor: pergunta ao banco se esta pessoa precisa aceitar (só em comunidade), e, se
 * precisa, traz as regras para ler ali mesmo. Se a pergunta falhar, segue sem o passo (o gatilho do banco confere de novo).
 */
function useRegrasAntes(comunidade: string | null, lang: string) {
  const t = useTextosDosCargos(lang);
  const [precisa, setPrecisa] = useState(false);
  const [lista, setLista] = useState<{ numero: number; titulo: string; texto: string }[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    if (!comunidade) return;
    let vivo = true;
    cargos
      .regrasParaPostar(comunidade)
      .then(async (r) => {
        if (!vivo) return;
        setPrecisa(r.precisa);
        if (r.precisa) {
          const painel = await cargos.painel(comunidade);
          if (vivo) setLista(painel.regras);
        }
      })
      .catch(() => {
        // sem a resposta, o compositor segue; o banco confere ao gravar
      });
    return () => {
      vivo = false;
    };
  }, [comunidade, rodada]);
  async function aceitar() {
    if (!comunidade || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      await cargos.aceitarRegras(comunidade);
      setPrecisa(false);
    } catch (e) {
      setErro(t ? erroDosCargos(t.erros, e) : "");
    } finally {
      setOcupado(false);
    }
  }
  return { t, precisa, lista, ocupado, erro, aceitar, pedir: () => setRodada((n) => n + 1) };
}
