// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { alumia } from "@/lib/rede/cliente-alumia";
import { rede } from "@/lib/rede/cliente";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDaAlumia, type TextosDaAlumia } from "@/lib/rede/textos-alumia";
import type { Post } from "@/lib/rede/tipos";
import type { PastaDeSalvos } from "@/lib/rede/tipos-b1";
import { useTextosDoAcabamento } from "../aparencia/base";
import { erroDaB1, useTextosB1 } from "../b1/base";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Confirmar, FaixaDaPrevia, PostCompacto, previa, Torradas, useTextosAlumia3, useTorrada } from "../conversa/base3";
import { salvosDaPrevia } from "../descoberta/previa";
import { EscolherPasta, fonteDasPastas, NovaPasta, quantosPosts, usePastas } from "./Pastas";
import { PastaPublica } from "../p4/cartao/PastaPublica";
import { CARTAO_P4 } from "../p4/cartao/usar";
import { useBuscaNosSalvos } from "../p4/pontes/BuscaNosSalvos";
import { pontesP4Ligado } from "@/lib/rede/p4/pontes/ligado";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

type Lista = { de: string; itens: Post[]; proximo: string | null };

/**
 * Salvos (/alumia/salvos): o que a pessoa guardou para ler depois, do mais novo ao mais antigo, e as PASTAS dela ("ler depois"
 * por assunto). A lista é privada (rede_salvos, só a própria pessoa lê) e passa pela mesma matriz de visibilidade de sempre: post
 * apagado, retido ou que ela deixou de poder ver some. As pastas são da B1 (rede_alumia_pastas…): privadas, ou do núcleo, onde
 * quem é do núcleo vê e guarda e ninguém fica sabendo quem guardou. Num banco sem as pastas, a tela é a de antes.
 */
export default function Salvos({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDaAlumia | null>(null);
  const t3 = useTextosAlumia3(lang);
  const tb = useTextosB1(lang);
  const ta = useTextosDoAcabamento(lang);
  const torradas = useTorrada();
  // Os que a pessoa tirou agora: o cartão encolhe e some, e "Desfazer" traz de volta no mesmo lugar.
  const [tirados, setTirados] = useState<ReadonlySet<string>>(() => new Set());
  const [voltas, setVoltas] = useState<Record<string, number>>({});
  // A pasta aberta ("" = todos os salvos) e a lista dela.
  const [aberta, setAberta] = useState("");
  const [lista, setLista] = useState<Lista | null>(null);
  const [erro, setErro] = useState<{ de: string; texto: string } | null>(null);
  const [vez, setVez] = useState(0);
  const [mais, setMais] = useState(false);
  const [criando, setCriando] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const [escolhendo, setEscolhendo] = useState<Post | null>(null);
  const botaoDeApagar = useRef<HTMLButtonElement | null>(null);
  const membro = situacao.logado && situacao.membro;
  const { estado: pastas, recarregar: recarregarPastas } = usePastas(membro, s, tb);
  // Prompt 4, item 130: a busca nos salvos e nas pastas, só no aparelho (o termo não sai daqui). A próxima página vem pelo caminho
  // de sempre: o servidor não sabe de busca nenhuma.
  const buscarPagina = useCallback((cursor: string) => (aberta ? fonteDasPastas.posts(aberta, cursor) : alumia.salvos(cursor, 50)), [aberta]);
  const busca = useBuscaNosSalvos({
    ativo: pontesP4Ligado() && situacao.logado,
    lang,
    de: aberta,
    base: lista && lista.de === aberta ? lista : null,
    buscar: buscarPagina,
  });

  useEffect(() => {
    let vivo = true;
    carregarTextosDaAlumia(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    const pedido = aberta ? fonteDasPastas.posts(aberta) : previa() ? Promise.resolve({ itens: salvosDaPrevia(), proximo: null }) : alumia.salvos(null, 20);
    pedido
      .then((r) => {
        if (!vivo) return;
        setLista({ de: aberta, itens: r.itens ?? [], proximo: r.proximo ?? null });
        setErro(null);
      })
      .catch((e) => vivo && setErro({ de: aberta, texto: textoDoErro(s, e) }));
    return () => {
      vivo = false;
    };
    // `vez` muda no "Tentar de novo".
  }, [s, situacao.logado, aberta, vez]);

  async function carregarMais() {
    if (!lista?.proximo || mais) return;
    setMais(true);
    try {
      const r = aberta ? await fonteDasPastas.posts(aberta, lista.proximo) : await alumia.salvos(lista.proximo, 20);
      setLista((atual) => (atual && atual.de === aberta ? { de: aberta, itens: [...atual.itens, ...r.itens.filter((p) => !atual.itens.some((x) => x.id === p.id))], proximo: r.proximo } : atual));
    } catch (e) {
      torradas.mostrar({ texto: textoDoErro(s, e), erro: true });
    } finally {
      setMais(false);
    }
  }

  function tirar(p: Post, salvo: boolean) {
    if (!t3) return;
    setTirados((atual) => {
      const n = new Set(atual);
      if (salvo) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    if (salvo) return;
    torradas.mostrar({
      texto: t3.comum.tiradoDosSalvos,
      acao: {
        rotulo: t3.comum.desfazer,
        fazer: () => {
          setTirados((atual) => {
            const n = new Set(atual);
            n.delete(p.id);
            return n;
          });
          // O cartão volta como novo (com "Salvo" aceso) e, de verdade, salva de novo no banco (na prévia, fica só na tela).
          setVoltas((v) => ({ ...v, [p.id]: (v[p.id] ?? 0) + 1 }));
          if (!previa()) rede.salvar(p.id, true).catch((e) => torradas.mostrar({ texto: textoDoErro(s, e), erro: true }));
        },
      },
    });
  }

  function abrir(id: string) {
    setAberta(id);
    setCriando(false);
    setRenomeando(null);
    setTirados(new Set());
  }

  if (!t || !t3 || !tb || !ta) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const daVez = lista && lista.de === aberta ? lista : null;
  const erroDaVez = erro && erro.de === aberta ? erro.texto : null;
  const itens = busca.achados ?? daVez?.itens ?? [];
  const dasPastas = pastas.fase === "ok" ? pastas.dados : null;
  const pastaAberta: PastaDeSalvos | null = aberta ? (dasPastas?.itens.find((p) => p.id === aberta) ?? null) : null;
  const erroB1 = (e: unknown) => torradas.mostrar({ texto: erroDaB1(s, tb, e), erro: true });

  return (
    <section aria-labelledby="alumia-salvos-titulo" className="al3-tela ac-tela">
      <FaixaDaPrevia t={t3} />
      <header className="ac-cabeca">
        <h1 id="alumia-salvos-titulo" className="al-cond ac-titulo">{t.salvos.titulo}</h1>
        <p className="ac-lead">{t.salvos.lead}</p>

        {/* As pastas: "Todos os salvos", uma ficha por pasta (com quantos posts tem) e "Nova pasta". Sem a B1 no banco, nada disto. */}
        {membro && pastas.fase !== "sem" && (
          <nav aria-label={tb.pastas.titulo} className="mt-4">
            {pastas.fase === "carregando" ? (
              <p role="status" className="ac-dica">{s.estados.carregando}</p>
            ) : pastas.fase === "erro" ? (
              <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--al-texto-2)]">
                {ta.pastas.naoCarregou}
                <button type="button" className="min-h-11 cursor-pointer font-bold underline" onClick={recarregarPastas}>{ta.pastas.tentar}</button>
              </p>
            ) : (
              <>
                <ul className="ac-fichas ac-fichas-rolam">
                  <li>
                    <button type="button" className="ac-ficha" aria-pressed={aberta === ""} onClick={() => abrir("")}>
                      <Icone nome="marcador" />
                      {tb.pastas.todas}
                    </button>
                  </li>
                  {pastas.dados.itens.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={`ac-ficha${p.nucleo ? " ac-ficha-nucleo" : ""}`} aria-pressed={aberta === p.id} aria-label={`${preencher(ta.pastas.abrir, { nome: p.nome })} (${quantosPosts(tb, p.posts)})`} title={p.nucleo ? `${tb.pastas.doNucleo}: ${p.nucleo.nome}` : tb.pastas.privada} onClick={() => abrir(p.id)}>
                        <Icone nome="pasta" />
                        <span className="max-w-[14rem] truncate">{p.nome}</span>
                        <span className="ac-ficha-n">{p.posts}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button type="button" className="ac-ficha ac-ficha-nova" aria-expanded={criando} onClick={() => setCriando((v) => !v)}>
                      <Icone nome="pastaMais" />
                      {tb.pastas.nova}
                    </button>
                  </li>
                </ul>
                {criando && (
                  <div className="mt-3">
                    <NovaPasta
                      tb={tb}
                      t={ta}
                      nucleos={pastas.dados.nucleos}
                      aoCancelar={() => setCriando(false)}
                      aoErro={erroB1}
                      aoCriar={() => {
                        setCriando(false);
                        recarregarPastas();
                        torradas.mostrar({ texto: tb.pastas.criada });
                      }}
                    />
                  </div>
                )}
                {pastas.dados.itens.length === 0 && !criando && <p className="ac-dica">{ta.pastas.lead}</p>}
              </>
            )}
          </nav>
        )}
      </header>

      {busca.campo}

      {/* A pasta aberta: o nome, de quem é, e renomear ou apagar (os posts continuam nos salvos). */}
      {pastaAberta && (
        <div className="ac-barra">
          {renomeando !== null ? (
            <form
              className="ac-form flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const nome = renomeando.trim();
                if (!nome) return;
                fonteDasPastas.mudar(pastaAberta.id, nome).then(() => {
                  setRenomeando(null);
                  recarregarPastas();
                }, erroB1);
              }}
            >
              <label className="sr-only" htmlFor="salvos-renomear">{tb.pastas.nomeRotulo}</label>
              <input id="salvos-renomear" className="ac-campo" value={renomeando} onChange={(e) => setRenomeando(e.target.value)} maxLength={60} autoFocus autoComplete="off" />
              <Botao type="submit" variante="primario" tamanho="p" disabled={!renomeando.trim()}>{ta.pastas.salvarNome}</Botao>
              <Botao variante="fantasma" tamanho="p" onClick={() => setRenomeando(null)}>{ta.pastas.cancelar}</Botao>
            </form>
          ) : (
            <>
              <p className="ac-barra-nome">
                {pastaAberta.nome}
                <span className="ac-barra-n block">{pastaAberta.nucleo ? `${tb.pastas.doNucleo}: ${pastaAberta.nucleo.nome}` : tb.pastas.privada} · {quantosPosts(tb, pastaAberta.posts)}</span>
              </p>
              <Botao variante="contorno" tamanho="p" onClick={() => setRenomeando(pastaAberta.nome)}>{tb.pastas.renomear}</Botao>
              <button ref={botaoDeApagar} type="button" className="ac-icone" aria-label={tb.pastas.apagar} title={tb.pastas.apagar} onClick={() => setApagando(true)}>
                <Icone nome="lixeira" className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Prompt 4, item 35: a pasta PRIVADA aberta pode virar coleção pública do perfil (a do núcleo, nunca). */}
      {CARTAO_P4 && situacao.logado && pastaAberta && !pastaAberta.nucleo && renomeando === null && (
        <PastaPublica lang={lang} pasta={pastaAberta.id} nucleo={pastaAberta.nucleo} handle={situacao.handle} />
      )}

      {!situacao.logado ? (
        <EstadoDaAlumia icone="cadeado" texto={t.salvos.entre} />
      ) : erroDaVez ? (
        <EstadoDaAlumia erro texto={erroDaVez}>
          <Botao variante="claro" onClick={() => { setErro(null); setVez((n) => n + 1); }}>{ta.pastas.tentar}</Botao>
        </EstadoDaAlumia>
      ) : !daVez ? (
        <EsqueletoDaLinha rotulo={aberta ? ta.pastas.carregando : s.estados.carregando} quantos={3} />
      ) : itens.length === 0 ? (
        <EstadoDaAlumia mosaico texto={aberta ? tb.pastas.vazia : t.salvos.vazio}>
          {aberta && <Botao variante="claro" onClick={() => abrir("")}>{tb.pastas.todas}</Botao>}
        </EstadoDaAlumia>
      ) : (
        <>
          <ol aria-label={pastaAberta?.nome ?? t.salvos.titulo} className="al3-lista-entra">
            {itens.map((p, i) => (
              <li
                key={p.id}
                className="al3-saindo ac-salvo"
                data-saindo={tirados.has(p.id) ? "sim" : undefined}
                style={{ "--i": i } as React.CSSProperties}
                // Fora da lista para o leitor de tela e o teclado enquanto some (o "Desfazer" do aviso traz de volta).
                inert={tirados.has(p.id)}
              >
                <div>
                  <PostCompacto key={voltas[p.id] ?? 0} post={p} lang={lang} s={s} t={t3} logado={situacao.logado} comComunidade aoErro={(e) => torradas.mostrar({ texto: textoDoErro(s, e), erro: true })} aoSalvar={(salvo) => tirar(p, salvo)} />
                  {dasPastas && (
                    <p className="ac-salvo-pasta">
                      <button type="button" className="ac-ficha ac-ficha-quieta" aria-haspopup="dialog" onClick={() => setEscolhendo(p)}>
                        <Icone nome="pasta" />
                        {tb.pastas.mover}
                      </button>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {itens.every((p) => tirados.has(p.id)) && <p className="px-[18px] py-6 text-[var(--al-texto-2)]">{aberta ? tb.pastas.vazia : t.salvos.vazio}</p>}
          {busca.achados ? null : daVez.proximo ? (
            <div className="px-[18px] py-4 text-center">
              <Botao variante="contorno" disabled={mais} onClick={() => void carregarMais()}>{mais ? s.estados.carregando : s.estados.maisPosts}</Botao>
            </div>
          ) : (
            <p className="px-[18px] py-6 text-center text-sm text-[var(--al-texto-3)]">{s.estados.fim}</p>
          )}
        </>
      )}

      <EscolherPasta
        post={escolhendo}
        tb={tb}
        t={ta}
        s={s}
        aoFechar={() => setEscolhendo(null)}
        aoErro={erroB1}
        aoMudar={(pasta, dentro) => {
          recarregarPastas();
          torradas.mostrar({ texto: dentro ? preencher(tb.pastas.posta, { nome: pasta.nome }) : tb.pastas.tirada });
          // Tirou o post da pasta que está aberta: ele sai da lista na hora.
          if (!dentro && pasta.id === aberta && escolhendo) setLista((atual) => (atual && atual.de === aberta ? { ...atual, itens: atual.itens.filter((x) => x.id !== escolhendo.id) } : atual));
        }}
      />
      <Confirmar
        aberto={apagando && pastaAberta !== null}
        titulo={tb.pastas.apagar}
        texto={preencher(tb.pastas.confirmarApagar, { nome: pastaAberta?.nome ?? "" })}
        sim={tb.pastas.apagar}
        nao={ta.pastas.naoApagar}
        aoSim={() => {
          const id = pastaAberta?.id;
          setApagando(false);
          if (!id) return;
          fonteDasPastas.mudar(id, null).then(() => {
            abrir("");
            recarregarPastas();
            torradas.mostrar({ texto: tb.pastas.apagada });
          }, erroB1);
        }}
        aoFechar={() => setApagando(false)}
        voltarPara={botaoDeApagar}
      />
      <Torradas estado={torradas} />
    </section>
  );
}
