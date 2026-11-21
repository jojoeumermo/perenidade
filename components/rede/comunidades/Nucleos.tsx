// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { enderecos, idOk } from "@/lib/rede/tipos";
import { enderecosCom } from "@/lib/rede/tipos-comunidades";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDeComunidades } from "@/lib/rede/textos-comunidades";
import { useNomesDasTrilhas } from "../estudo/conquistas/usarNomesDasTrilhas";
import { estudoLigado } from "../estudo/turma/ligado";
import { codigoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { botao, erroCom, mesDeHoje, textosDe, useCarregar } from "./util";

// R2 (membros escondidos): o acervo, a sala de voz e a busca do núcleo saíram desta página, porque dependiam de o servidor saber
// quem é do núcleo. Eles voltam pelo grupo, nos aparelhos (lib/rede/membros), quando o chat novo for ligado.

/** A turma do mês: a pessoa inscrita (turmas) entra na comunidade fechada dela; quem não se inscreveu só vê o aviso. */
function TurmaDoMes({ lang, s, sc }: { lang: string; s: TextosDaRede; sc: TextosDeComunidades }) {
  const mes = mesDeHoje();
  const { dado, erro, pronto, recarregar } = useCarregar(() => comunidades.turma(mes), `turma:${mes}`);
  const [ocupado, setOcupado] = useState(false);
  const [falha, setFalha] = useState("");
  const n = sc.nucleos;
  async function entrar() {
    if (ocupado) return;
    setOcupado(true);
    setFalha("");
    try {
      await comunidades.entrarNaTurma(mes);
      recarregar();
    } catch (e) {
      setFalha(erroCom(s, sc, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section aria-labelledby="turma-do-mes" className="border-b border-rule px-[18px] py-4">
      <h2 id="turma-do-mes" className="font-serif text-xl font-semibold">{n.turma}</h2>
      <p className="mt-1 text-sm text-ink-soft">{n.turmaIntro}</p>
      {!pronto ? (
        <p className="mt-2 text-sm text-ink-soft">{s.estados.carregando}</p>
      ) : !dado ? (
        <p role={codigoDoErro(erro) === "sem_servico" ? "status" : "alert"} className={`mt-2 text-sm ${codigoDoErro(erro) === "sem_servico" ? "text-ink-soft" : "text-oxblood"}`}>{erro ? erroCom(s, sc, erro) : s.estados.erro}</p>
      ) : dado.entrou ? (
        <Link href={enderecos.comunidade(lang, dado.slug)} className="mt-2 inline-block font-bold underline">{n.turmaAbrir}</Link>
      ) : dado.inscrito ? (
        <button type="button" disabled={ocupado} onClick={entrar} className={`mt-2 ${botao}`}>{ocupado ? sc.acao.trabalhando : n.turmaEntrar}</button>
      ) : (
        <p className="mt-2 text-sm">{n.turmaNao}</p>
      )}
      {falha && <p role="alert" className="mt-2 text-sm text-oxblood">{falha}</p>}
    </section>
  );
}

/**
 * A página de um núcleo. Desde a R2 (membros escondidos), o servidor não sabe quem é do núcleo: ele dá só o perfil público e a entrada
 * (caixa e chave X-Wing, assinadas pela chave de gestão do núcleo). Mural, encontros, mediação e saída moram no grupo, nos aparelhos
 * de quem é do núcleo (lib/rede/membros); o pedido para entrar vai cifrado do aparelho para a mediação.
 */
function PaginaDoNucleo({ id, lang, s, sc }: { id: string; lang: string; s: TextosDaRede; sc: TextosDeComunidades }) {
  const n = sc.nucleos;
  // O título da trilha ("Introdução ao marxismo"), não o fim do endereço.
  const trilhas = useNomesDasTrilhas(lang);
  const pagina = useCarregar(() => comunidades.nucleo(id), `nucleo:${id}`);

  if (!pagina.pronto) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const dado = pagina.dado;
  if (!dado) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{pagina.erro ? erroCom(s, sc, pagina.erro) : s.estados.naoEncontrado}</p>;

  return (
    <div className="font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{dado.nome}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {dado.cidade && `${n.cidade}: ${dado.cidade}`}
          {dado.trilha && ` · ${n.trilha}: ${trilhas.nome(dado.trilha)}`}
        </p>
        <p className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
          <Link href={enderecosCom.nucleos(lang)} className="underline">{n.voltar}</Link>
        </p>
      </header>
      <section aria-labelledby="no-aparelho" className="px-[18px] py-4">
        <h2 id="no-aparelho" className="font-serif text-xl font-semibold">{n.noAparelhoTitulo}</h2>
        <p className="mt-2 max-w-prose text-sm">{n.noAparelho}</p>
        <p role="status" className="mt-3 text-sm text-ink-soft">{dado.entrada ? n.entradaPronta : n.semEntrada}</p>
      </section>
    </div>
  );
}

/**
 * Núcleos e turma (R4, item 40): a lista dos núcleos de que a pessoa faz parte, com a turma do mês no alto; com `id` nos parâmetros,
 * a página de um núcleo (só o perfil público e a entrada: quem é do núcleo mora nos aparelhos, R2).
 */
export default function Nucleos({ lang, s, situacao, params }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const id = params.id ?? "";
  const lista = useCarregar(() => (situacao.logado && situacao.membro && !id ? comunidades.nucleos() : Promise.resolve({ itens: [] })), `nucleos:${situacao.membro}:${id}`);
  const trilhas = useNomesDasTrilhas(lang);
  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  if (!situacao.logado || !situacao.membro) return <p className="px-[18px] py-8 font-sans text-ink-soft">{sc.acao.entrePrimeiro}</p>;
  if (id) {
    if (!idOk(id)) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.naoEncontrado}</p>;
    return <PaginaDoNucleo id={id} lang={lang} s={s} sc={sc} />;
  }
  const n = sc.nucleos;
  return (
    <div className="font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{n.titulo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{n.intro}</p>
        {/* P5 (A12): as turmas de estudo têm tela própria; daqui a pessoa acha o caminho (antes era só um link escondido). */}
        {estudoLigado() && (
          <Link href={`${enderecos.linha(lang)}/turmas`} className="mt-2 inline-flex min-h-11 items-center font-bold underline">
            {n.turmasDeEstudo}
          </Link>
        )}
      </header>
      <TurmaDoMes lang={lang} s={s} sc={sc} />
      <section aria-labelledby="meus-nucleos" className="px-[18px] py-4">
        <h2 id="meus-nucleos" className="font-serif text-xl font-semibold">{n.meus}</h2>
        {!lista.pronto ? (
          <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={2} />
        ) : !lista.dado ? (
          <p role={codigoDoErro(lista.erro) === "sem_servico" ? "status" : "alert"} className={`mt-1 ${codigoDoErro(lista.erro) === "sem_servico" ? "text-ink-soft" : "text-oxblood"}`}>{lista.erro ? erroCom(s, sc, lista.erro) : s.estados.erro}</p>
        ) : lista.dado.itens.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">{n.vazio}</p>
        ) : (
          // Cada núcleo num cartão com o anel colorido (prancha traga-sua-organizacao: a lista de núcleos).
          <ul className="mt-3 grid gap-2.5">
            {lista.dado.itens.map((x, i) => (
              <li key={x.id} className={`al2-cartao-com al3-cor-${(i % 5) + 1} flex items-center gap-3 px-4 py-3`}>
                <span aria-hidden className="al3-anel" />
                <span className="min-w-0 flex-1">
                  <Link href={enderecosCom.nucleo(lang, x.id)} className="al2-nome-link block font-extrabold">{x.nome}</Link>
                  <span className="block text-sm text-ink-soft">{x.cidade}{x.trilha ? ` · ${trilhas.nome(x.trilha)}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

