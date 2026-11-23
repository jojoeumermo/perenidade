// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 55. Mural "ofereço / preciso" da comunidade: doação, empréstimo, aula, cuidado, mudança. O pedido sai sob o codinome de quem pôs e
// é combinado por mensagem (o link leva ao perfil, de onde se escreve); sem endereço, telefone ou e-mail no texto (o banco recusa).
// Some sozinho em 30 dias. Ninguém vê quem se interessou. 63: vagas e bicos solidários usam a mesma tela (SecaoVagas), sem
// categoria, com um link https se quiser e sem perfil profissional de ninguém.
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { organizacao, type Mural, type PedidoDoMural, type TipoDoMural } from "@/lib/rede/organizacao/cliente";
import { linkSeguro } from "@/lib/rede/organizacao/regras";
import { enderecos } from "@/lib/rede/tipos";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaComunidade } from "./TelaDaOrganizacao";
import { dataCurta, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

/** Os textos da parte (o mural de ajuda ou o de vagas e bicos, que usa a mesma tela). */
interface TextosDaParte {
  titulo: string;
  sobre: string;
  novo: string;
  posto: string;
  vazio: string;
}

/** Os tipos do mural, na ordem dos botões. */
export const TIPOS_DO_MURAL: readonly TipoDoMural[] = ["preciso", "ofereco"];
const CATEGORIAS = ["doacao", "emprestimo", "aula", "cuidado", "mudanca", "outro"] as const;

export function SecaoMural({ t, lang, comunidade, tipos = TIPOS_DO_MURAL, textos = t.mural }: PropsDaSecaoDaComunidade & { tipos?: readonly TipoDoMural[]; textos?: TextosDaParte }) {
  const [filtro, setFiltro] = useState<TipoDoMural | null>(null);
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Mural>(`mural-${comunidade.slug}-${filtro ?? ""}-${tipos.join()}`, () => organizacao.mural(comunidade.slug, filtro ?? undefined));
  const [abrir, setAbrir] = useState(false);
  const [tipo, setTipo] = useState<TipoDoMural>(tipos[0]);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const m = textos;
  const nomesDosTipos = t.mural.tipos as Record<string, string>;
  const comCategoria = tipo === "ofereco" || tipo === "preciso";
  const itens = (dado?.itens ?? []).filter((x) => tipos.includes(x.tipo));

  async function por(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await organizacao.porNoMural({
        comunidade: comunidade.slug, tipo, categoria: comCategoria ? String(f.get("categoria") ?? "outro") : undefined,
        titulo: String(f.get("titulo") ?? ""), texto: String(f.get("texto") ?? ""), link: f.get("link") ? String(f.get("link")) : undefined,
      });
      setMensagem({ texto: m.posto, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function tirar(x: PedidoDoMural) {
    if (!(await confirmar(preencher(t.mural.tirarPergunta, { titulo: x.titulo }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      await organizacao.tirarDoMural(x.id);
      if (dado) trocar({ ...dado, itens: dado.itens.filter((y) => y.id !== x.id) });
    } catch (e) {
      setMensagem({ texto: fraseDoErro(t, e), erro: true });
    }
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{m.titulo}</h2>
      <p className="or-miudo">{m.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {tipos.length > 1 && (
        <div className="or-acoes" role="group" aria-label={t.mural.filtrar}>
          <Botao variante={filtro === null ? "contorno" : "fantasma"} tamanho="p" pressionado={filtro === null} onClick={() => setFiltro(null)}>{t.mural.todos}</Botao>
          {tipos.map((k) => <Botao key={k} variante={filtro === k ? "contorno" : "fantasma"} tamanho="p" pressionado={filtro === k} onClick={() => setFiltro(k)}>{nomesDosTipos[k]}</Botao>)}
        </div>
      )}
      {dado?.posso_por && (abrir ? (
        <form className="or-form" onSubmit={por} aria-label={m.novo}>
          <fieldset>
            <legend>{t.mural.tipo}</legend>
            {tipos.map((k) => (
              <label key={k} className="or-opcao"><input type="radio" name="tipo" value={k} checked={tipo === k} onChange={() => setTipo(k)} />{nomesDosTipos[k]}</label>
            ))}
          </fieldset>
          {comCategoria && (
            <label>{t.mural.categoria}
              <select name="categoria" defaultValue="outro">
                {CATEGORIAS.map((c) => <option key={c} value={c}>{(t.mural.categorias as Record<string, string>)[c]}</option>)}
              </select>
            </label>
          )}
          <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={100} /></label>
          <label>{t.comum.texto} {t.comum.opcional}<textarea name="texto" maxLength={600} /></label>
          {!comCategoria && <label>{t.mural.link} {t.comum.opcional}<input type="url" name="link" maxLength={300} placeholder="https://" /></label>}
          <p className="or-miudo">{t.mural.semEndereco}</p>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{m.novo}</Botao></div>
      ))}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado && itens.length === 0 && <p className="or-miudo">{m.vazio}</p>}
      {itens.length > 0 && (
        <ul className="or-lista">
          {itens.map((x) => {
            const link = linkSeguro(x.link);
            return (
              <li key={x.id} className="or-cartao">
                <p className="or-etiqueta">{nomesDosTipos[x.tipo]}{x.tipo === "ofereco" || x.tipo === "preciso" ? ` · ${(t.mural.categorias as Record<string, string>)[x.categoria] ?? ""}` : ""}</p>
                <h3>{x.titulo}</h3>
                {x.texto && <p>{x.texto}</p>}
                {link && <a className="or-link" href={link} target="_blank" rel="noopener noreferrer nofollow">{t.mural.abrirLink}</a>}
                <p className="or-miudo">{preencher(t.mural.ate, { dia: dataCurta(lang, x.expira_em) })}</p>
                <div className="or-acoes">
                  {x.autor && !x.meu && <Link className="or-link" href={enderecos.perfil(lang, x.autor.handle)}>{preencher(t.mural.combinar, { codinome: x.autor.codinome })}</Link>}
                  {(x.meu || dado?.modero) && <Botao variante="fantasma" tamanho="p" onClick={() => tirar(x)}>{t.comum.tirar}</Botao>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** 63. Vagas e bicos solidários: o mesmo mural, só com vaga e bico. */
export function SecaoVagas(props: PropsDaSecaoDaComunidade) {
  return <SecaoMural {...props} tipos={["vaga", "bico"]} textos={props.t.vagas} />;
}
