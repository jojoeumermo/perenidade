// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BellRing, Eraser, Send, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Aviso, dataHora, papelAposentado, papeis, useAcao, useLista } from "./comum";
import { Area, Botao, CabecalhoDeSecao, Campo, Cartao, confirmarFrase, Esqueleto, Lista, ItemDeLista, Marca, Selecao, Selo, Vazio } from "./ui";

interface AvisoGeral {
  id: string;
  titulo: string;
  texto: string;
  autor: string;
  importante: boolean;
  para: string[];
  criado_em: string;
  expira_em?: string;
  vistos?: number;
}

/** Para quem um aviso pode ir: a equipe do podcast e cada função. */
const destinos: [string, string][] = [["podcast", "Equipe do podcast"], ...(Object.entries(papeis) as [string, string][]).filter(([id]) => id !== "coordenacao" && !papelAposentado(id))];
const nomeDoDestino = (id: string) => destinos.find(([chave]) => chave === id)?.[1] ?? id;
const prazos = [1, 3, 7, 14, 30, 60];

/** O quadro do aviso, com um Cartao por dentro: o cabeçalho (de quem, para quem), o texto que rola e o "Entendi". */
function Quadro({ aviso, restantes, fechar, ocupado }: { aviso: AvisoGeral; restantes: number; fechar?: () => void; ocupado?: boolean }) {
  return (
    <Cartao
      as="div"
      // Só o quadro de verdade (com "Entendi") é janela modal; a prévia na seção é um exemplo dentro da página.
      role={fechar ? "dialog" : "group"}
      aria-modal={fechar ? true : undefined}
      aria-labelledby={`aviso-${aviso.id}`}
      variante={aviso.importante ? "alerta" : "destaque"}
      className="painel-ir flex max-h-full w-full max-w-lg flex-col !p-0"
      style={{ boxShadow: "var(--pn-sombra-flutuante)" }}
      rodape={
        fechar && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="pn-ajuda">{restantes > 1 ? `Mais ${restantes} avisos depois deste.` : restantes === 1 ? "Mais 1 aviso depois deste." : "Último aviso."}</span>
            <Botao variante="principal" disabled={ocupado} onClick={fechar} autoFocus>
              Entendi
            </Botao>
          </div>
        )
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-2.5">
        <Selo tom={aviso.importante ? "erro" : "bordo"}>
          {aviso.importante ? <Star aria-hidden width={12} height={12} /> : <BellRing aria-hidden width={12} height={12} />}
          {aviso.importante ? "Aviso importante" : "Aviso à equipe"}
        </Selo>
        <span className="flex items-center gap-2">
          <span className="pn-rotulo-mono">{aviso.para.length === 0 ? "toda a equipe" : aviso.para.map(nomeDoDestino).join(" · ")}</span>
          {fechar && <Botao icone pequeno variante="discreto" simbolo={X} onClick={fechar} disabled={ocupado} aria-label="Fechar o aviso" dica="Fechar" />}
        </span>
      </div>
      {/* Aviso longo no celular: o texto rola dentro do quadro, e o cabeçalho (com o fechar) e o "Entendi" ficam à vista. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <h2 id={`aviso-${aviso.id}`} className="pn-dialogo-titulo text-[1.75rem]">{aviso.titulo}</h2>
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed" data-original>{aviso.texto}</p>
        <p className="pn-ajuda mt-4">
          {aviso.autor || "Coordenação"} · {dataHora(aviso.criado_em)}
        </p>
      </div>
    </Cartao>
  );
}

/**
 * O quadro que aparece por cima do painel quando a coordenação, a vice-coordenação ou a supervisão mandam um aviso.
 * Chega na hora pelo canal de tempo real (e, por garantia, de minuto em minuto). Some quando a pessoa aperta "Entendi":
 * até lá, bloqueia a tela (o véu do tema por cima de tudo).
 */
export function QuadroDeAvisos() {
  const lista = useLista<AvisoGeral[]>("avisos_gerais_pendentes");
  const { recarregar } = lista;
  const acao = useAcao(recarregar);
  useEffect(() => {
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 60_000);
    return () => window.clearInterval(relogio);
  }, [recarregar]);
  const atual = lista.dados?.[0];
  if (!atual) return null;
  return (
    <div className="painel-veu fixed inset-0 z-50 flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))]" style={{ background: "var(--pn-veu)" }}>
      <Quadro aviso={atual} restantes={(lista.dados?.length ?? 1) - 1} ocupado={acao.ocupado} fechar={() => void acao.agir("aviso_geral_fechar", { p_id: atual.id }, "")} />
    </div>
  );
}
/** A seção do painel para quem manda avisos: escrever um, ver quem já fechou os que estão no ar e apagar. */
export function AvisosEquipe() {
  const lista = useLista<AvisoGeral[]>("avisos_gerais_listar");
  const acao = useAcao(lista.recarregar);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [todos, setTodos] = useState(true);
  const [para, setPara] = useState<string[]>([]);
  const [importante, setImportante] = useState(false);
  const [dias, setDias] = useState(14);
  const pronto = titulo.trim().length >= 2 && texto.trim().length >= 2 && (todos || para.length > 0);

  async function enviar() {
    const ok = await acao.agir(
      "aviso_geral_enviar",
      { p: { titulo, texto, para: todos ? [] : para, importante, dias } },
      "Aviso enviado. Aparece na hora para quem está com o painel aberto e, para os outros, assim que entrarem.",
    );
    if (ok) {
      setTitulo("");
      setTexto("");
      setImportante(false);
    }
  }

  const previa: AvisoGeral = { id: "previa", titulo: titulo || "Título do aviso", texto: texto || "O texto do aviso aparece aqui, como um quadro por cima do painel de cada pessoa.", autor: "você", importante, para: todos ? [] : para, criado_em: new Date().toISOString() };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <form className="grid content-start gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <p className="pn-ajuda max-w-2xl">
          O aviso aparece como um quadro por cima do painel, para toda a equipe ou só para algumas funções, até a pessoa apertar “Entendi”. Para recado a uma pessoa só, use as Conversas.
        </p>
        <Campo rotulo="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required />
        <Area rotulo="Texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={2000} required />
        <fieldset>
          <legend className="pn-rotulo-mono">Para quem</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="pn-marca">
              <input type="radio" checked={todos} onChange={() => setTodos(true)} /> Toda a equipe
            </label>
            <label className="pn-marca">
              <input type="radio" checked={!todos} onChange={() => setTodos(false)} /> Só algumas funções
            </label>
          </div>
          {!todos && (
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {destinos.map(([id, nome]) => (
                <li key={id}>
                  <Marca rotulo={nome} checked={para.includes(id)} onChange={(e) => setPara(e.target.checked ? [...para, id] : para.filter((x) => x !== id))} />
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <div className="flex flex-wrap items-end gap-5">
          <Marca rotulo="Importante (quadro vermelho)" checked={importante} onChange={(e) => setImportante(e.target.checked)} />
          <div className="w-40">
            <Selecao rotulo="Fica no ar por" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              {prazos.map((n) => (
                <option key={n} value={n}>{n === 1 ? "1 dia" : `${n} dias`}</option>
              ))}
            </Selecao>
          </div>
        </div>
        <p>
          <Botao type="submit" variante="principal" simbolo={Send} carregando={acao.ocupado} disabled={!pronto}>Enviar o aviso</Botao>
        </p>
        <Aviso texto={acao.aviso || lista.erro} />

        <section className="grid gap-3 pt-4">
          <CabecalhoDeSecao nivel={2} titulo="No ar" simbolo={BellRing} />
          {lista.dados === null && !lista.erro && <Esqueleto linhas={2} rotulo="Carregando os avisos…" />}
          {lista.dados?.length === 0 && <Vazio simbolo={BellRing} titulo="Nenhum aviso no ar." />}
          {lista.dados && lista.dados.length > 0 && (
            <Lista rotulo="No ar">
              {lista.dados.map((aviso) => (
                <ItemDeLista
                  key={aviso.id}
                  titulo={
                    <span className="flex flex-wrap items-center gap-2">
                      {aviso.titulo}
                      {aviso.importante && <Selo tom="erro">importante</Selo>}
                    </span>
                  }
                  meta={
                    <>
                      <span className="line-clamp-2">{aviso.texto}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3">
                        <span>{aviso.para.length === 0 ? "toda a equipe" : aviso.para.map(nomeDoDestino).join(", ")}</span>
                        <span>{aviso.autor} · {dataHora(aviso.criado_em)}</span>
                        <span>{aviso.vistos ?? 0} {aviso.vistos === 1 ? "pessoa fechou" : "pessoas fecharam"}</span>
                        {aviso.expira_em && <span>sai do ar em {dataHora(aviso.expira_em)}</span>}
                      </span>
                    </>
                  }
                  acoes={
                    <Botao variante="discreto" pequeno perigo simbolo={Trash2} disabled={acao.ocupado} onClick={async () => { if ((await confirmarFrase("Tirar este aviso do ar?"))) void acao.agir("aviso_geral_apagar", { p_id: aviso.id }, "Aviso retirado."); }}>
                      Tirar do ar
                    </Botao>
                  }
                />
              ))}
            </Lista>
          )}
        </section>
      </form>
      <aside className="grid content-start gap-3">
        <p className="pn-rotulo-mono">Como vai aparecer</p>
        <Quadro aviso={previa} restantes={0} />
        <p>
          <Botao simbolo={Eraser} onClick={() => { setTitulo(""); setTexto(""); }}>Limpar</Botao>
        </p>
      </aside>
    </div>
  );
}