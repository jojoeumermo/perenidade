// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useRef, useState } from "react";
import { creditosDo } from "../conferir";
import type { DadosDoElemento } from "../elementos";
import { Icone } from "../Icone";
import { ICONES_DAS_ARTES, type NomeDoIcone } from "../icones";
import {
  type Camada,
  type CamadaElemento,
  type CamadaForma,
  type CamadaImagem,
  type CamadaMarca,
  type CamadaTexto,
  COR,
  type Fonte,
  type Marcador,
  type Mascara,
  nomeDaCamada,
  NOMES_DAS_FONTES,
  type TipoDeAnimacao,
} from "../motor";
import { estiloDaCamada, LIMITE_DA_LEGENDA } from "../projeto";
import { ATIVO, BOTAO, BotaoIcone, CAMPO, Chave, Cores, Faixa, Numero, Secao, useEditor } from "../ui";

const ICONE_DO_TIPO = (c: Camada): NomeDoIcone => (c.tipo === "texto" ? "texto" : c.tipo === "imagem" ? "imagens" : c.tipo === "marca" ? "marca" : c.tipo === "elemento" ? (c.desenho === "icone" && c.icone ? c.icone : c.desenho === "qr" ? "qr" : "elementos") : "forma");
const NOME_DO_TIPO: Record<string, string> = { texto: "texto", imagem: "imagem", marca: "marca", elemento: "elemento" };

/** O painel da direita: Propriedades | Camadas. */
export function PainelDireito({ passos, voltarAte }: { passos: string[]; voltarAte: (i: number) => void }) {
  const ed = useEditor();
  const [aba, setAba] = useState<"propriedades" | "camadas">("propriedades");
  return (
    <aside className="flex w-[18.75rem] shrink-0 flex-col border-l border-e-fio bg-e-painel" aria-label="Propriedades e camadas">
      <div role="tablist" className="grid grid-cols-2 border-b border-e-fio">
        {(
          [
            ["propriedades", "Propriedades"],
            ["camadas", `Camadas · ${ed.doc.camadas.length}`],
          ] as const
        ).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`-mb-px cursor-pointer border-b-2 py-3 text-sm ${aba === id ? "border-e-bordo font-semibold text-e-bordo" : "border-transparent text-e-suave hover:text-e-tinta"}`}>
            {nome}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {aba === "propriedades" ? <Propriedades /> : <ListaDeCamadas passos={passos} voltarAte={voltarAte} />}
      </div>
    </aside>
  );
}

/** As propriedades do que está escolhido (nada: a página e o post; várias: alinhar e distribuir). */
export function Propriedades() {
  const ed = useEditor();
  if (ed.selecionadas.length > 1) return <PropriedadesDeVarias />;
  if (!ed.camada) return <PropriedadesDaPagina />;
  return <PropriedadesDaCamada key={ed.camada.id} c={ed.camada} />;
}

function Cabeca({ c }: { c: Camada }) {
  const ed = useEditor();
  return (
    <div className="flex items-center gap-2 border-b border-e-fio px-4 py-3">
      <Icone nome={ICONE_DO_TIPO(c)} className="h-5 w-5 text-e-suave" />
      <input value={c.nome ?? ""} placeholder={nomeDaCamada(c)} onChange={(e) => ed.mudar({ nome: e.target.value.slice(0, 40) }, false)} aria-label="Nome da camada" className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent font-semibold text-e-tinta hover:border-e-fio focus:border-e-bordo focus:outline-none" />
      <span className="text-xs text-e-suave">· {NOME_DO_TIPO[c.tipo] ?? "forma"}</span>
    </div>
  );
}

function Posicao({ c }: { c: Camada }) {
  const ed = useEditor();
  const altura = c.tipo !== "texto" || c.ajustar;
  return (
    <Secao titulo="Posição e tamanho">
      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo="X" valor={c.x} mudar={(x, fim) => ed.mudar({ x }, fim !== false)} />
        <Numero rotulo="Y" valor={c.y} mudar={(y, fim) => ed.mudar({ y }, fim !== false)} />
        <Numero rotulo="Largura" valor={c.w} min={8} mudar={(w, fim) => ed.mudar(c.tipo === "imagem" || c.tipo === "marca" ? { w, h: (w * c.h) / c.w } : { w }, fim !== false)} />
        {altura ? <Numero rotulo="Altura" valor={c.h} min={8} mudar={(h, fim) => ed.mudar({ h }, fim !== false)} /> : <Numero rotulo="Giro" valor={c.rot} sufixo="°" min={-180} max={180} mudar={(rot, fim) => ed.mudar({ rot }, fim !== false)} />}
        {altura && <Numero rotulo="Giro" valor={c.rot} sufixo="°" min={-180} max={180} mudar={(rot, fim) => ed.mudar({ rot }, fim !== false)} />}
      </div>
      <div className="flex justify-between" role="group" aria-label="Alinhar à página">
        {(["alinhar-esq", "alinhar-centro-h", "alinhar-dir", "alinhar-topo", "alinhar-meio", "alinhar-base"] as const).map((a) => (
          <BotaoIcone key={a} icone={a} rotulo={{ "alinhar-esq": "Encostar à esquerda", "alinhar-centro-h": "Centralizar na horizontal", "alinhar-dir": "Encostar à direita", "alinhar-topo": "Encostar em cima", "alinhar-meio": "Centralizar na vertical", "alinhar-base": "Encostar embaixo" }[a]} onClick={ed.acoes[a]} className="h-8 w-8" tamanho="h-4 w-4" />
        ))}
      </div>
    </Secao>
  );
}

function Aparencia({ c }: { c: Camada }) {
  const ed = useEditor();
  return (
    <Secao titulo="Aparência" aberta={false}>
      <Faixa rotulo="Opacidade" valor={Math.round(c.opacidade * 100)} min={0} max={100} sufixo="%" mudar={(v, fim) => ed.mudar({ opacidade: v / 100 }, Boolean(fim))} />
      <Chave rotulo="Textura de serigrafia" dica="A tinta falha em pontinhos, como impressão manual." ligado={Boolean(c.textura)} mudar={(textura) => ed.mudar({ textura })} />
      <Chave rotulo="Só guia (não sai na exportação)" ligado={Boolean(c.soGuia)} mudar={(soGuia) => ed.mudar({ soGuia })} />
    </Secao>
  );
}

const ANIMACOES: [TipoDeAnimacao | "", string][] = [
  ["", "Sem animação"],
  ["subir", "Subir"],
  ["aparecer", "Aparecer"],
  ["crescer", "Crescer"],
  ["revelar", "Revelar da esquerda"],
  ["cortina", "Cortina vermelha"],
  ["contador", "Contador (número sobe)"],
];

function Animacao({ c }: { c: Camada }) {
  const ed = useEditor();
  return (
    <Secao titulo="Animação (vídeo)" aberta={Boolean(c.anim)}>
      <select value={c.anim?.tipo ?? ""} onChange={(e) => ed.mudar({ anim: e.target.value ? { tipo: e.target.value as TipoDeAnimacao, inicio: c.anim?.inicio ?? 0.3, duracao: c.anim?.duracao ?? 0.8 } : null })} aria-label="Animação" className={CAMPO}>
        {ANIMACOES.map(([id, nome]) => (
          <option key={id} value={id}>
            {nome}
          </option>
        ))}
      </select>
      {c.anim && (
        <div className="grid grid-cols-2 gap-2">
          <Numero rotulo="Começa em" valor={c.anim.inicio} passo={0.1} casas={1} min={0} max={30} sufixo="s" mudar={(inicio, fim) => ed.mudar({ anim: { ...c.anim!, inicio } }, fim !== false)} />
          <Numero rotulo="Dura" valor={c.anim.duracao} passo={0.1} casas={1} min={0.1} max={10} sufixo="s" mudar={(duracao, fim) => ed.mudar({ anim: { ...c.anim!, duracao } }, fim !== false)} />
        </div>
      )}
      <p className="text-xs text-e-suave">Veja em Pré-visualizar › Vídeo; baixe em Baixar › Vídeo.</p>
    </Secao>
  );
}

function Acoes() {
  const ed = useEditor();
  return (
    <div className="flex flex-wrap gap-1 px-4 py-3">
      <BotaoIcone icone="frente" rotulo="Trazer para a frente" atalho="Ctrl+]" onClick={ed.acoes.frente} />
      <BotaoIcone icone="tras" rotulo="Mandar para trás" atalho="Ctrl+[" onClick={ed.acoes.tras} />
      <BotaoIcone icone="duplicar" rotulo="Duplicar" atalho="Ctrl+D" onClick={ed.acoes.duplicar} />
      <BotaoIcone icone="copiar-estilo" rotulo="Copiar estilo" atalho="Ctrl+Alt+C" onClick={ed.acoes.copiarEstilo} />
      <BotaoIcone icone="cadeado" rotulo="Travar" atalho="Ctrl+L" onClick={ed.acoes.travar} />
      <BotaoIcone icone="lixeira" rotulo="Apagar" atalho="Delete" onClick={ed.acoes.apagar} className="text-[#c21f16]" />
    </div>
  );
}

function PropriedadesDaCamada({ c }: { c: Camada }) {
  return (
    <div>
      <Cabeca c={c} />
      <Posicao c={c} />
      {c.tipo === "texto" && <PropriedadesTexto c={c} />}
      {c.tipo === "imagem" && <PropriedadesImagem c={c} />}
      {c.tipo === "marca" && <PropriedadesMarca c={c} />}
      {c.tipo === "elemento" && <PropriedadesElemento c={c} />}
      {c.tipo !== "texto" && c.tipo !== "imagem" && c.tipo !== "marca" && c.tipo !== "elemento" && <PropriedadesForma c={c} />}
      <Aparencia c={c} />
      <Animacao c={c} />
      <Acoes />
    </div>
  );
}

const PESOS = [400, 500, 600, 700, 800, 900] as const;

function PropriedadesTexto({ c }: { c: CamadaTexto }) {
  const ed = useEditor();
  const area = useRef<HTMLTextAreaElement>(null);
  const estilo = c.estilo ? ed.projeto.estilos.find((e) => e.id === c.estilo) : undefined;
  /** Envolve a seleção do campo com a marca (ex.: _ _ para itálico). */
  const marcar = (abre: string, fecha = abre) => {
    const t = area.current;
    if (!t) return;
    const [i, f] = [t.selectionStart, t.selectionEnd];
    const novo = `${c.texto.slice(0, i)}${abre}${c.texto.slice(i, f) || "palavra"}${fecha}${c.texto.slice(f)}`;
    ed.mudar({ texto: novo });
    window.setTimeout(() => {
      t.focus();
      t.setSelectionRange(i + abre.length, i + abre.length + (f - i || 7));
    }, 0);
  };
  return (
    <>
      <Secao titulo="Texto">
        <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Estilo de um trecho">
          <button type="button" className={`${BOTAO} h-8 px-2 font-serif font-bold`} onClick={() => marcar("**")} title="Negrito num trecho: **assim**">B</button>
          <button type="button" className={`${BOTAO} h-8 px-2 font-serif italic`} onClick={() => marcar("_")} title="Itálico num trecho: _assim_">I</button>
          <button type="button" className={`${BOTAO} h-8 px-2`} onClick={() => marcar("==")} title="Cor de destaque num trecho: ==assim==">
            <span className="h-3 w-3 rounded-full" style={{ background: c.destaque || COR["Vermelho da gráfica"] }} /> Destaque
          </button>
          <select className={`${CAMPO} h-8 w-auto`} value="" aria-label="Inserir variável" onChange={(e) => e.target.value && ed.mudar({ texto: `${c.texto}${e.target.value}` })}>
            <option value="">{"{ } Variável"}</option>
            {[...Object.keys(ed.projeto.variaveis), "pagina", "total"].map((v) => (
              <option key={v} value={`{${v}}`}>{`{${v}}`}</option>
            ))}
          </select>
        </div>
        <textarea ref={area} id="estudio-texto" value={c.texto} onChange={(e) => ed.mudar({ texto: e.target.value })} rows={4} spellCheck lang="pt-BR" aria-label="Texto" className="w-full rounded-md border border-e-fio bg-e-campo p-2.5 font-serif text-[0.95rem] text-e-tinta focus:border-e-bordo focus:outline-none" />
      </Secao>
      <Secao titulo="Tipografia">
        <div className="grid grid-cols-[1fr_5.5rem] gap-2">
          <label className="block text-xs text-e-suave">
            Fonte
            <select value={c.fonte} onChange={(e) => ed.mudar({ fonte: e.target.value as Fonte })} className={`${CAMPO} mt-1`}>
              {(Object.keys(NOMES_DAS_FONTES) as Fonte[]).map((f) => (
                <option key={f} value={f}>
                  {NOMES_DAS_FONTES[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-e-suave">
            Peso
            <select value={c.peso} onChange={(e) => ed.mudar({ peso: Number(e.target.value) as CamadaTexto["peso"] })} className={`${CAMPO} mt-1`}>
              {PESOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Numero rotulo="Tamanho" valor={c.tamanho} min={4} max={1200} mudar={(tamanho, fim) => ed.mudar({ tamanho }, fim !== false)} />
          <Numero rotulo="Entrelinha" valor={c.entrelinha} passo={0.01} casas={2} min={0.6} max={3} mudar={(entrelinha, fim) => ed.mudar({ entrelinha }, fim !== false)} />
          <Numero rotulo="Letras" valor={c.espacamento} passo={0.01} casas={2} min={-0.1} max={0.6} mudar={(espacamento, fim) => ed.mudar({ espacamento }, fim !== false)} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <BotaoIcone icone="italico" rotulo="Itálico" ativo={c.italico} onClick={() => ed.mudar({ italico: !c.italico })} className="h-8 w-8" tamanho="h-4 w-4" />
          <BotaoIcone icone="maiusculas" rotulo="Maiúsculas" ativo={c.maiusculas} onClick={() => ed.mudar({ maiusculas: !c.maiusculas })} className="h-8 w-8" tamanho="h-4 w-4" />
          <span className="mx-1 h-5 w-px bg-e-fio" />
          {(["left", "center", "right"] as const).map((a) => (
            <BotaoIcone key={a} icone={a === "left" ? "texto-esq" : a === "center" ? "texto-centro" : "texto-dir"} rotulo={a === "left" ? "À esquerda" : a === "center" ? "Centralizado" : "À direita"} ativo={c.alinhar === a} onClick={() => ed.mudar({ alinhar: a })} className="h-8 w-8" tamanho="h-4 w-4" />
          ))}
        </div>
      </Secao>
      <Secao titulo="Cor">
        <Cores valor={c.cor} mudar={(cor) => ed.mudar({ cor })} extras={ed.projeto.paleta} />
        <p className="text-xs text-e-suave">Cor do ==destaque==</p>
        <Cores valor={c.destaque || COR["Vermelho da gráfica"]} mudar={(destaque) => ed.mudar({ destaque })} extras={ed.projeto.paleta} />
      </Secao>
      {!ed.simples && (
        <>
          <Secao titulo="Estilo da marca" aberta={Boolean(estilo)}>
            {estilo ? (
              <>
                <p className="text-sm">
                  Ligado ao estilo <strong>{estilo.nome}</strong>: fonte, tamanho e cor mudam em todos os textos desse estilo, em todas as páginas.
                </p>
                <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => ed.mudar({ estilo: undefined })}>Desligar desta camada</button>
              </>
            ) : (
              <>
                <select value="" onChange={(e) => {
                  const s = ed.projeto.estilos.find((x) => x.id === e.target.value);
                  if (s) ed.mudar({ estilo: s.id, fonte: s.fonte, peso: s.peso, italico: s.italico, cor: s.cor, entrelinha: s.entrelinha, espacamento: s.espacamento, maiusculas: s.maiusculas, tamanho: s.tamanho * (ed.doc.w / 1080) });
                }} aria-label="Ligar a um estilo" className={CAMPO}>
                  <option value="">Ligar a um estilo…</option>
                  {ed.projeto.estilos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
                <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => {
                  const nome = window.prompt("Nome do estilo novo:", c.nome || "Meu estilo")?.trim();
                  if (!nome) return;
                  const novo = estiloDaCamada({ ...c, tamanho: c.tamanho / (ed.doc.w / 1080) }, nome.slice(0, 40));
                  ed.setProjeto((p) => ({ ...p, estilos: [...p.estilos, novo] }), true, `Estilo novo: ${nome}`);
                  ed.mudar({ estilo: novo.id });
                }}>
                  Criar estilo a partir desta camada
                </button>
              </>
            )}
          </Secao>
          <Secao titulo="Efeitos de cartaz" aberta={Boolean(c.contorno || c.vazado || c.sombra || c.curva)}>
            <Chave rotulo="Só o contorno (letra vazada)" ligado={Boolean(c.vazado)} mudar={(vazado) => ed.mudar({ vazado, espContorno: c.espContorno ?? Math.max(2, c.tamanho * 0.03) })} />
            <Chave rotulo="Contorno" ligado={Boolean(c.contorno)} mudar={(v) => ed.mudar({ contorno: v ? COR.Tinta : "", espContorno: c.espContorno ?? Math.max(2, c.tamanho * 0.04) })} />
            {(c.contorno || c.vazado) && (
              <>
                {c.contorno && <Cores valor={c.contorno} mudar={(contorno) => ed.mudar({ contorno })} />}
                <Faixa rotulo="Espessura do contorno" valor={c.espContorno ?? 2} min={1} max={Math.max(20, c.tamanho * 0.15)} mudar={(espContorno, fim) => ed.mudar({ espContorno }, Boolean(fim))} />
              </>
            )}
            <Chave rotulo="Sombra sólida deslocada" ligado={Boolean(c.sombra)} mudar={(v) => ed.mudar({ sombra: v ? COR["Vermelho da gráfica"] : "", sombraX: c.sombraX ?? Math.round(c.tamanho * 0.06), sombraY: c.sombraY ?? Math.round(c.tamanho * 0.06) })} />
            {c.sombra && (
              <>
                <Cores valor={c.sombra} mudar={(sombra) => ed.mudar({ sombra })} />
                <div className="grid grid-cols-2 gap-2">
                  <Numero rotulo="Deslocar →" valor={c.sombraX ?? 0} mudar={(sombraX, fim) => ed.mudar({ sombraX }, fim !== false)} />
                  <Numero rotulo="Deslocar ↓" valor={c.sombraY ?? 0} mudar={(sombraY, fim) => ed.mudar({ sombraY }, fim !== false)} />
                </div>
              </>
            )}
            <Faixa rotulo="Texto em arco" valor={c.curva ?? 0} min={-300} max={300} sufixo="°" mudar={(curva, fim) => ed.mudar({ curva: curva === 0 ? undefined : curva }, Boolean(fim))} />
          </Secao>
          <Secao titulo="Parágrafo" aberta={Boolean(c.marcador || c.ajustar || c.hifenizar)}>
            <label className="block text-xs text-e-suave">
              Lista
              <select value={c.marcador ?? ""} onChange={(e) => ed.mudar({ marcador: e.target.value as Marcador })} className={`${CAMPO} mt-1`}>
                <option value="">Sem marcador</option>
                <option value="estrela">Estrelas</option>
                <option value="ponto">Pontos</option>
                <option value="numero">Números</option>
                <option value="travessao">Travessões</option>
              </select>
            </label>
            <Chave rotulo="Hifenizar (dividir palavras longas)" ligado={Boolean(c.hifenizar)} mudar={(hifenizar) => ed.mudar({ hifenizar })} />
            <Chave rotulo="Diminuir a letra para caber na caixa" dica="A altura da caixa fica fixa; puxe as alças para mudar." ligado={Boolean(c.ajustar)} mudar={(ajustar) => ed.mudar(ajustar ? { ajustar, h: c.h } : { ajustar })} />
          </Secao>
          <Secao titulo="Tarja atrás do texto" aberta={Boolean(c.fundo)}>
            <Cores valor={c.fundo} semCor mudar={(fundo) => ed.mudar({ fundo, recuo: fundo && !c.recuo ? Math.round(c.tamanho * 0.5) : c.recuo })} />
            {c.fundo && <Faixa rotulo="Recuo da tarja" valor={c.recuo} min={0} max={200} mudar={(recuo, fim) => ed.mudar({ recuo }, Boolean(fim))} />}
          </Secao>
        </>
      )}
    </>
  );
}

function PropriedadesImagem({ c }: { c: CamadaImagem }) {
  const ed = useEditor();
  const ajuste = (rotulo: string, chave: "brilho" | "contraste" | "saturacao" | "temperatura") => <Faixa rotulo={rotulo} valor={c[chave] ?? 0} min={-100} max={100} mudar={(v, fim) => ed.mudar({ [chave]: v } as Partial<Camada>, Boolean(fim))} />;
  return (
    <>
      <Secao titulo="Foto">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => ed.setReenquadrar(c.id)}>
            <Icone nome="enquadrar" className="h-4 w-4" /> Reenquadrar
          </button>
          <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => ed.editarFoto(c.id)}>
            <Icone nome="recortar" className="h-4 w-4" /> Recortar e fundo
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["cobrir", "Cobrir (corta)"],
              ["conter", "Inteira"],
            ] as const
          ).map(([id, nome]) => (
            <button key={id} type="button" className={`${BOTAO} h-8 text-xs ${c.ajuste === id ? ATIVO : ""}`} aria-pressed={c.ajuste === id} onClick={() => ed.mudar({ ajuste: id })}>
              {nome}
            </button>
          ))}
        </div>
        {c.ajuste === "cobrir" && <Faixa rotulo="Aproximar a foto" valor={Math.round((c.enquadre?.zoom ?? 1) * 100)} min={100} max={400} sufixo="%" mudar={(v, fim) => ed.mudar({ enquadre: { x: c.enquadre?.x ?? 0, y: c.enquadre?.y ?? 0, zoom: v / 100 } }, Boolean(fim))} />}
        <label className="block text-xs text-e-suave">
          Crédito (autor, ano, licença)
          <input value={c.credito} onChange={(e) => ed.mudar({ credito: e.target.value.slice(0, 200) })} className={`${CAMPO} mt-1`} />
        </label>
      </Secao>
      <Secao titulo="Ajustes">
        {ajuste("Brilho", "brilho")}
        {ajuste("Contraste", "contraste")}
        {ajuste("Saturação", "saturacao")}
        {ajuste("Temperatura (fria ↔ quente)", "temperatura")}
        <div className="flex flex-wrap gap-1">
          <BotaoIcone icone="girar" rotulo="Girar 90°" onClick={() => ed.mudar({ girar: (((c.girar ?? 0) + 90) % 360) as CamadaImagem["girar"], w: c.h, h: c.w })} className="h-8 w-8" tamanho="h-4 w-4" />
          <BotaoIcone icone="espelhar" rotulo="Espelhar" ativo={c.espelhar} onClick={() => ed.mudar({ espelhar: !c.espelhar })} className="h-8 w-8" tamanho="h-4 w-4" />
          <BotaoIcone icone="espelhar" rotulo="Virar de cabeça para baixo" ativo={c.virar} onClick={() => ed.mudar({ virar: !c.virar })} className="h-8 w-8 rotate-90" tamanho="h-4 w-4" />
          <button type="button" className="ml-auto cursor-pointer text-xs text-e-suave underline" onClick={() => ed.mudar({ brilho: 0, contraste: 0, saturacao: 0, temperatura: 0, filtro: "nenhum" })}>Zerar</button>
        </div>
        <label className="block text-xs text-e-suave">
          Filtro
          <select value={c.filtro} onChange={(e) => ed.mudar({ filtro: e.target.value as CamadaImagem["filtro"] })} className={`${CAMPO} mt-1`}>
            <option value="nenhum">Nenhum</option>
            <option value="pb">Preto e branco</option>
            <option value="duotom">Duotom vermelho</option>
            <option value="sepia">Sépia</option>
            <option value="contraste">Mais contraste</option>
          </select>
        </label>
      </Secao>
      {!ed.simples && (
        <Secao titulo="Efeitos" aberta={Boolean(c.meioTom || c.mascara || c.moldura || c.borda)}>
          <label className="block text-xs text-e-suave">
            Forma da foto (máscara)
            <select value={c.mascara ?? ""} onChange={(e) => ed.mudar({ mascara: e.target.value as Mascara })} className={`${CAMPO} mt-1`}>
              <option value="">Retângulo</option>
              <option value="circulo">Círculo</option>
              <option value="estrela">Estrela</option>
              <option value="escudo">Escudo</option>
              <option value="arco">Arco</option>
              <option value="losango">Losango</option>
            </select>
          </label>
          <Chave rotulo="Foto revelada (borda branca, fita e legenda à mão)" ligado={c.moldura === "revelada"} mudar={(v) => ed.mudar({ moldura: v ? "revelada" : "", legendaFoto: c.legendaFoto ?? (v ? "1964" : "") })} />
          {c.moldura === "revelada" && (
            <label className="block text-xs text-e-suave">
              Legenda à mão
              <input value={c.legendaFoto ?? ""} onChange={(e) => ed.mudar({ legendaFoto: e.target.value.slice(0, 40) })} className={`${CAMPO} mt-1`} />
            </label>
          )}
          <Chave rotulo="Meio-tom de jornal (retícula)" ligado={Boolean(c.meioTom)} mudar={(v) => ed.mudar({ meioTom: v ? Math.max(4, Math.round(c.w / 90)) : 0, corMeioTom: c.corMeioTom || COR.Tinta })} />
          {Boolean(c.meioTom) && (
            <>
              <Faixa rotulo="Tamanho da retícula" valor={c.meioTom ?? 8} min={3} max={40} mudar={(meioTom, fim) => ed.mudar({ meioTom }, Boolean(fim))} />
              <Cores valor={c.corMeioTom || COR.Tinta} mudar={(corMeioTom) => ed.mudar({ corMeioTom })} />
            </>
          )}
          <p className="text-xs text-e-suave">Borda</p>
          <Cores valor={c.borda} semCor mudar={(borda) => ed.mudar({ borda, espessura: borda && !c.espessura ? 6 : c.espessura })} />
          {c.borda && <Faixa rotulo="Espessura da borda" valor={c.espessura} min={1} max={80} mudar={(espessura, fim) => ed.mudar({ espessura }, Boolean(fim))} />}
        </Secao>
      )}
    </>
  );
}

function PropriedadesForma({ c }: { c: CamadaForma }) {
  const ed = useEditor();
  return (
    <>
      <Secao titulo="Preenchimento">
        <Cores valor={c.preenchimento === "transparent" ? "" : c.preenchimento} semCor mudar={(cor) => ed.mudar({ preenchimento: cor || "transparent", gradiente: null })} extras={ed.projeto.paleta} />
        {c.tipo !== "linha" && (
          <>
            <Chave rotulo="Degradê" ligado={Boolean(c.gradiente)} mudar={(v) => ed.mudar({ gradiente: v ? { de: c.preenchimento !== "transparent" ? c.preenchimento : COR["Vermelho da gráfica"], para: COR.Tinta, angulo: 90 } : null })} />
            {c.gradiente && (
              <>
                <Cores valor={c.gradiente.de} mudar={(de) => ed.mudar({ gradiente: { ...c.gradiente!, de } })} />
                <Cores valor={c.gradiente.para} mudar={(para) => ed.mudar({ gradiente: { ...c.gradiente!, para } })} />
                <Faixa rotulo="Ângulo" valor={c.gradiente.angulo} min={0} max={360} sufixo="°" mudar={(angulo, fim) => ed.mudar({ gradiente: { ...c.gradiente!, angulo } }, Boolean(fim))} />
              </>
            )}
          </>
        )}
      </Secao>
      {c.tipo === "linha" ? (
        <Secao titulo="Linha">
          <Faixa rotulo="Espessura" valor={c.espessura} min={1} max={80} mudar={(espessura, fim) => ed.mudar({ espessura }, Boolean(fim))} />
        </Secao>
      ) : (
        c.tipo !== "raios" && (
          <Secao titulo="Borda" aberta={Boolean(c.borda)}>
            <Cores valor={c.borda} semCor mudar={(borda) => ed.mudar({ borda, espessura: borda && !c.espessura ? 4 : c.espessura })} />
            {c.borda && <Faixa rotulo="Espessura da borda" valor={c.espessura} min={1} max={80} mudar={(espessura, fim) => ed.mudar({ espessura }, Boolean(fim))} />}
            {c.tipo === "retangulo" && <Faixa rotulo="Cantos arredondados" valor={c.raio} min={0} max={300} mudar={(raio, fim) => ed.mudar({ raio }, Boolean(fim))} />}
          </Secao>
        )
      )}
    </>
  );
}

function PropriedadesMarca({ c }: { c: CamadaMarca }) {
  const ed = useEditor();
  return (
    <Secao titulo="Marca">
      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            ["simbolo", "Símbolo"],
            ["circulo", "No círculo"],
            ["nome", "Com o nome"],
          ] as const
        ).map(([id, nome]) => (
          <button key={id} type="button" className={`${BOTAO} h-8 px-1 text-xs ${c.variante === id ? ATIVO : ""}`} aria-pressed={c.variante === id} onClick={() => ed.mudar({ variante: id })}>
            {nome}
          </button>
        ))}
      </div>
      <p className="text-xs text-e-suave">Cor</p>
      <Cores valor={c.cor} mudar={(cor) => ed.mudar({ cor })} />
      {c.variante === "circulo" && (
        <>
          <p className="text-xs text-e-suave">Fundo do círculo</p>
          <Cores valor={c.fundo} mudar={(fundo) => ed.mudar({ fundo })} />
        </>
      )}
      <p className="text-xs text-e-suave">A marca não se distorce. Em fundo escuro ou vermelho, use pergaminho ou branco.</p>
    </Secao>
  );
}

function PropriedadesElemento({ c }: { c: CamadaElemento }) {
  const ed = useEditor();
  const comTraco: DadosDoElemento["desenho"][] = ["icone", "raios-traco", "ornamento", "seta-mao", "brasil-estados"];
  return (
    <Secao titulo="Elemento">
      {c.desenho === "icone" && (
        <div>
          <p className="mb-1 text-xs text-e-suave">Ícone</p>
          <div className="grid max-h-36 grid-cols-6 gap-1 overflow-y-auto">
            {ICONES_DAS_ARTES.map((i) => (
              <button key={i.nome} type="button" title={i.rotulo} aria-label={i.rotulo} aria-pressed={c.icone === i.nome} className={`flex aspect-square cursor-pointer items-center justify-center rounded ${c.icone === i.nome ? ATIVO : "hover:bg-e-bordo-claro"}`} onClick={() => ed.mudar({ icone: i.nome, nome: i.rotulo })}>
                <Icone nome={i.nome} className="h-5 w-5" />
              </button>
            ))}
          </div>
        </div>
      )}
      {c.desenho !== "figurinha" && (
        <>
          <p className="text-xs text-e-suave">Cor</p>
          <Cores valor={c.cor} mudar={(cor) => ed.mudar({ cor })} extras={ed.projeto.paleta} />
        </>
      )}
      {(c.desenho === "qr" || c.desenho === "selo" || c.desenho === "icone" || c.desenho === "brasil-estados") && (
        <>
          <p className="text-xs text-e-suave">{c.desenho === "qr" ? "Fundo do código" : c.desenho === "selo" ? "Miolo do selo" : c.desenho === "brasil-estados" ? "Estados em destaque" : "Preenchimento"}</p>
          <Cores valor={c.fundo} semCor mudar={(fundo) => ed.mudar({ fundo })} />
        </>
      )}
      {comTraco.includes(c.desenho) && <Faixa rotulo="Espessura do traço" valor={c.espessura || (c.desenho === "icone" ? 1.6 : 4)} min={c.desenho === "icone" ? 0.5 : 1} max={c.desenho === "icone" ? 4 : 60} passo={c.desenho === "icone" ? 0.1 : 1} mudar={(espessura, fim) => ed.mudar({ espessura }, Boolean(fim))} />}
      {(c.desenho === "raios-traco" || c.desenho === "louros" || c.desenho === "selo") && <Faixa rotulo={c.desenho === "louros" ? "Folhas" : c.desenho === "selo" ? "Dentes" : "Raios"} valor={c.quantidade ?? (c.desenho === "louros" ? 11 : c.desenho === "selo" ? 28 : 36)} min={c.desenho === "louros" ? 5 : 6} max={c.desenho === "louros" ? 20 : 96} mudar={(quantidade, fim) => ed.mudar({ quantidade }, Boolean(fim))} />}
      {(c.desenho === "qr" || c.desenho === "carimbo" || c.desenho === "selo" || c.desenho === "figurinha" || c.desenho === "brasil-estados") && (
        <label className="block text-xs text-e-suave">
          {c.desenho === "qr" ? "Endereço do QR" : c.desenho === "carimbo" ? "Texto de cima" : c.desenho === "selo" ? "Texto do selo (Enter quebra a linha)" : c.desenho === "brasil-estados" ? "Siglas dos estados em destaque (ex.: SP, RJ, BA)" : "Rótulo da guia"}
          {c.desenho === "selo" ? <textarea value={c.conteudo} rows={2} onChange={(e) => ed.mudar({ conteudo: e.target.value.slice(0, 60) })} className={`${CAMPO} mt-1 h-auto py-1.5`} /> : <input value={c.conteudo} onChange={(e) => ed.mudar({ conteudo: e.target.value.slice(0, 300) })} className={`${CAMPO} mt-1`} />}
        </label>
      )}
      {c.desenho === "carimbo" && (
        <label className="block text-xs text-e-suave">
          Texto de baixo
          <input value={c.conteudo2} onChange={(e) => ed.mudar({ conteudo2: e.target.value.slice(0, 60) })} className={`${CAMPO} mt-1`} />
        </label>
      )}
    </Secao>
  );
}

function PropriedadesDeVarias() {
  const ed = useEditor();
  const n = ed.selecionadas.length;
  const agrupadas = ed.selecionadas.every((c) => c.grupo && c.grupo === ed.selecionadas[0].grupo);
  return (
    <div>
      <div className="border-b border-e-fio px-4 py-3">
        <p className="font-semibold">{n} camadas escolhidas</p>
        <p className="text-xs text-e-suave">Shift+clique tira ou põe; arraste para mover tudo junto.</p>
      </div>
      <Secao titulo="Alinhar entre si">
        <div className="flex justify-between">
          {(["alinhar-esq", "alinhar-centro-h", "alinhar-dir", "alinhar-topo", "alinhar-meio", "alinhar-base"] as const).map((a) => (
            <BotaoIcone key={a} icone={a} rotulo={{ "alinhar-esq": "Pela esquerda", "alinhar-centro-h": "Pelo centro (horizontal)", "alinhar-dir": "Pela direita", "alinhar-topo": "Por cima", "alinhar-meio": "Pelo meio (vertical)", "alinhar-base": "Por baixo" }[a]} onClick={ed.acoes[a]} className="h-8 w-8" tamanho="h-4 w-4" />
          ))}
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={`${BOTAO} h-8 flex-1 text-xs`} disabled={n < 3} onClick={ed.acoes["distribuir-h"]}>
            <Icone nome="distribuir-h" className="h-4 w-4" /> Distribuir ↔
          </button>
          <button type="button" className={`${BOTAO} h-8 flex-1 text-xs`} disabled={n < 3} onClick={ed.acoes["distribuir-v"]}>
            <Icone nome="distribuir-v" className="h-4 w-4" /> Distribuir ↕
          </button>
        </div>
      </Secao>
      <Secao titulo="Grupo">
        <button type="button" className={`${BOTAO} w-full`} onClick={agrupadas ? ed.acoes.desagrupar : ed.acoes.agrupar}>
          <Icone nome={agrupadas ? "desagrupar" : "agrupar"} className="h-4 w-4" /> {agrupadas ? "Desagrupar" : "Agrupar"} ({agrupadas ? "Ctrl+Shift+G" : "Ctrl+G"})
        </button>
        <button type="button" className={`${BOTAO} w-full`} onClick={() => void import("./Biblioteca").then((b) => b.guardarBloco(ed))}>
          <Icone nome="bloco" className="h-4 w-4" /> Guardar como bloco reutilizável
        </button>
      </Secao>
      <Secao titulo="Aparência">
        <Faixa rotulo="Opacidade" valor={Math.round(Math.min(...ed.selecionadas.map((c) => c.opacidade)) * 100)} min={0} max={100} sufixo="%" mudar={(v, fim) => ed.mudar({ opacidade: v / 100 }, Boolean(fim))} />
      </Secao>
      <Acoes />
    </div>
  );
}

/** Sem nada escolhido: a página (nome, texto alternativo) e o post (legenda, hashtags, créditos). */
function PropriedadesDaPagina() {
  const ed = useEditor();
  const legenda = ed.projeto.legenda;
  const hashtags = (legenda.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const creditos = creditosDo(ed.projeto);
  const mudarLegenda = (l: string, lembrar = false) => ed.setProjeto((p) => ({ ...p, legenda: l.slice(0, 5000) }), lembrar, "Legenda");
  const modelosDeLegenda = useMemo(
    () =>
      ed.laboratorio
        ? [
            ["Evento", "Vem aí: [nome do evento]!\n\n{data}, às {hora}, em {local}. Entrada livre.\n\nMarque quem vai com você.\n\n#evento #cultura"],
            ["Dicas", "[Número] dicas para [assunto] →\n\n[resumo em uma frase]\n\nSalve para não esquecer.\n\n#dicas"],
            ["Carrossel", "Arraste para o lado →\n\n[resumo do carrossel em uma frase]\n\nSalve para ler depois e mande para quem precisa."],
          ]
        : [
      ["Lançamento", "Novidade no Instituto Lúcia!\n\n[conte o que mudou em duas frases]\n\nTudo de graça, sem anúncios, em {link}.\n\n#educaçãopopular #InstitutoLúcia"],
      ["Chamada para voluntariado", "Sabe explicar alguma coisa? Escreva uma aula.\n\nPrecisamos de gente para [funções]. Nenhuma função exige diploma.\n\nInscrições em {link}/voluntarios\n\n#voluntariado #educaçãopopular"],
      ["Aula ao vivo", "Hoje, às {hora}: [tema], com [educador(a)].\n\nDe graça, sem instalar nada: {link}/ao-vivo\n\n#aulaaovivo #educaçãopopular"],
      ["Memória", "[Nome], presente!\n\n[duas ou três frases sobre a vida e a luta]\n\n#memória #educaçãopopular"],
      ["Carrossel", "Arraste para o lado →\n\n[resumo do carrossel em uma frase]\n\nSalve para ler depois e mande para quem precisa.\n\n#educaçãopopular #InstitutoLúcia"],
    ],
    [ed.laboratorio],
  );
  const BANCO = ed.laboratorio
    ? ["#evento", "#cultura", "#dicas", "#educação", "#leitura", "#comunidade", "#arte", "#música", "#ciência", "#feira"]
    : ["#educaçãopopular", "#InstitutoLúcia", "#educaçãogratuita", "#PauloFreire", "#estudegraça", "#voluntariado", "#ENEM", "#saúdesolidária", "#memória", "#culturapopular", "#lutapopular", "#conhecimentolivre"];
  return (
    <div>
      <div className="border-b border-e-fio px-4 py-3">
        <p className="font-semibold">Página {ed.pagina + 1}</p>
        <p className="text-xs text-e-suave">Clique numa camada da arte para mudar texto, cor, tamanho e posição.</p>
      </div>
      <Secao titulo="Página">
        <label className="block text-xs text-e-suave">
          Nome da página
          <input value={ed.doc.nome ?? ""} onChange={(e) => ed.setDoc((d) => ({ ...d, nome: e.target.value.slice(0, 40) }), false)} placeholder={`Página ${ed.pagina + 1}`} className={`${CAMPO} mt-1`} />
        </label>
        <label className="block text-xs text-e-suave">
          Texto alternativo (para leitores de tela)
          <textarea value={ed.doc.alt ?? ""} onChange={(e) => ed.setDoc((d) => ({ ...d, alt: e.target.value.slice(0, 1000) }), false)} rows={3} spellCheck lang="pt-BR" placeholder="Descreva o que a imagem mostra, como para alguém que não vê." className="mt-1 w-full rounded-md border border-e-fio bg-e-campo p-2 text-sm text-e-tinta focus:border-e-bordo focus:outline-none" />
          <span className="block text-right">{(ed.doc.alt ?? "").length} / 1000</span>
        </label>
      </Secao>
      <Secao titulo="Legenda do post">
        <textarea value={legenda} onChange={(e) => mudarLegenda(e.target.value)} onBlur={() => mudarLegenda(legenda, true)} rows={7} spellCheck lang="pt-BR" aria-label="Legenda do post" placeholder="A legenda fica guardada junto com a arte." className="w-full rounded-md border border-e-fio bg-e-campo p-2.5 text-sm text-e-tinta focus:border-e-bordo focus:outline-none" />
        <p className={`flex justify-between text-xs ${legenda.length > LIMITE_DA_LEGENDA || hashtags > 30 ? "text-[#c21f16]" : "text-e-suave"}`}>
          <span>{hashtags} / 30 hashtags</span>
          <span>
            {legenda.length.toLocaleString("pt-BR")} / {LIMITE_DA_LEGENDA.toLocaleString("pt-BR")}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${legenda.trim()}${creditos.length ? `\n\nCréditos das imagens: ${creditos.join(" · ")}` : ""}`);
              ed.avisar("Legenda copiada.");
            } catch {
              ed.avisar("O navegador não deixou copiar.", "erro");
            }
          }}>
            <Icone nome="copiar" className="h-4 w-4" /> Copiar
          </button>
          {creditos.length > 0 && !legenda.includes("Créditos") && (
            <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => mudarLegenda(`${legenda.trim()}\n\nCréditos das imagens: ${creditos.join(" · ")}`, true)}>
              + Créditos ({creditos.length})
            </button>
          )}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-e-suave">Modelos de legenda</summary>
          <ul className="mt-1.5 space-y-1">
            {modelosDeLegenda.map(([nome, t]) => (
              <li key={nome}>
                <button type="button" className="w-full cursor-pointer rounded-md px-2 py-1 text-left hover:bg-e-bordo-claro" onClick={() => mudarLegenda(legenda ? `${legenda}\n\n${t}` : t, true)}>
                  {nome}
                </button>
              </li>
            ))}
          </ul>
        </details>
        <details className="text-sm">
          <summary className="cursor-pointer text-e-suave">Banco de hashtags</summary>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {BANCO.map((h) => (
              <button key={h} type="button" disabled={legenda.includes(h)} className="cursor-pointer rounded-full border border-e-fio px-2 py-0.5 text-xs hover:border-e-tinta disabled:opacity-40" onClick={() => mudarLegenda(`${legenda.trimEnd()} ${h}`.trim(), true)}>
                {h}
              </button>
            ))}
          </div>
        </details>
      </Secao>
      <Secao titulo="Conferir" aberta={false}>
        <button type="button" className={`${BOTAO} w-full`} onClick={ed.acoes.conferir}>
          <Icone nome="verificar" className="h-4 w-4" /> Conferir antes de postar
        </button>
      </Secao>
    </div>
  );
}

/** A lista de camadas (a de cima primeiro), com arrastar para reordenar, olho, cadeado e o histórico. */
export function ListaDeCamadas({ passos, voltarAte }: { passos: string[]; voltarAte: (i: number) => void }) {
  const ed = useEditor();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const lista = [...ed.doc.camadas].reverse();
  const mover = (id: string, paraAntesDe: string | null) => {
    ed.setDoc((d) => {
      const sem = d.camadas.filter((c) => c.id !== id);
      const c = d.camadas.find((k) => k.id === id)!;
      // A lista mostra de cima para baixo; no documento, a de cima é a última.
      const indice = paraAntesDe ? sem.findIndex((k) => k.id === paraAntesDe) + 1 : 0;
      sem.splice(indice, 0, c);
      return { ...d, camadas: sem };
    }, true, "Mudou a ordem");
  };
  const alternar = (id: string, campo: "oculta" | "travada") => ed.setDoc((d) => ({ ...d, camadas: d.camadas.map((k) => (k.id === id ? { ...k, [campo]: !k[campo] } : k)) }));
  return (
    <div>
      <ul className="p-2" role="listbox" aria-label="Camadas" aria-multiselectable="true">
        {lista.map((c) => {
          const escolhida = ed.selecionadas.some((s) => s.id === c.id);
          return (
            <li
              key={c.id}
              role="option"
              aria-selected={escolhida}
              draggable
              onDragStart={(e) => {
                setArrastando(c.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastando && arrastando !== c.id) mover(arrastando, c.id);
                setArrastando(null);
              }}
              onDragEnd={() => setArrastando(null)}
              className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1.5 ${escolhida ? ATIVO : "hover:bg-e-bordo-claro/60"} ${arrastando === c.id ? "opacity-40" : ""}`}
            >
              <Icone nome="alca" className="h-4 w-4 cursor-grab text-e-suave" />
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-e-fio bg-e-campo text-e-suave">
                <Icone nome={ICONE_DO_TIPO(c)} className="h-4 w-4" />
              </span>
              {renomeando === c.id ? (
                <input autoFocus defaultValue={c.nome ?? nomeDaCamada(c)} onBlur={(e) => { ed.mudarCamada(c.id, { nome: e.target.value.slice(0, 40) }); setRenomeando(null); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="min-w-0 flex-1 rounded border border-e-bordo bg-e-campo px-1 text-sm" aria-label="Nome da camada" />
              ) : (
                <button
                  type="button"
                  className={`min-w-0 flex-1 cursor-pointer truncate text-left text-sm ${c.oculta ? "text-e-suave line-through" : ""}`}
                  onClick={(e) => ed.selecionar(e.shiftKey || e.ctrlKey || e.metaKey ? (escolhida ? ed.selecionadas.filter((s) => s.id !== c.id).map((s) => s.id) : [...ed.selecionadas.map((s) => s.id), c.id]) : [c.id])}
                  onDoubleClick={() => setRenomeando(c.id)}
                  onKeyDown={(e) => {
                    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                      e.preventDefault();
                      ed.selecionar([c.id]);
                      window.setTimeout(() => ed.acoes[e.key === "ArrowUp" ? "frente" : "tras"](), 0);
                    }
                  }}
                  title="Clique para escolher; Shift+clique para várias; duplo clique para renomear; Alt+setas para mudar a ordem"
                >
                  {nomeDaCamada(c)}
                  {c.grupo && <span className="ml-1 text-xs text-e-suave">· grupo</span>}
                </button>
              )}
              <button type="button" className={`cursor-pointer p-1 ${c.oculta ? "text-e-bordo" : "text-e-suave opacity-60 group-hover:opacity-100"}`} aria-label={c.oculta ? "Mostrar" : "Esconder"} title={c.oculta ? "Mostrar" : "Esconder"} onClick={() => alternar(c.id, "oculta")}>
                <Icone nome={c.oculta ? "olho-fechado" : "olho"} className="h-4 w-4" />
              </button>
              <button type="button" className={`cursor-pointer p-1 ${c.travada ? "text-e-bordo" : "text-e-suave opacity-60 group-hover:opacity-100"}`} aria-label={c.travada ? "Destravar" : "Travar"} title={c.travada ? "Destravar" : "Travar"} onClick={() => alternar(c.id, "travada")}>
                <Icone nome={c.travada ? "cadeado" : "cadeado-aberto"} className="h-4 w-4" />
              </button>
            </li>
          );
        })}
        {!lista.length && <li className="px-2 py-6 text-center text-sm text-e-suave">Página vazia: comece por um modelo ou acrescente texto.</li>}
      </ul>
      {passos.length > 0 && (
        <Secao titulo="Histórico" aberta={false}>
          <ol className="space-y-0.5">
            {passos
              .map((r, i) => ({ r, i }))
              .slice(-20)
              .reverse()
              .map(({ r, i }) => (
                <li key={i}>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-1.5 truncate rounded px-1.5 py-1 text-left text-sm hover:bg-e-bordo-claro" title="Voltar para antes deste passo" onClick={() => voltarAte(i)}>
                    <Icone nome="desfazer" className="h-3.5 w-3.5 text-e-suave" />
                    {r}
                  </button>
                </li>
              ))}
          </ol>
        </Secao>
      )}
    </div>
  );
}

/** No celular: a folha de baixo com os controles rápidos da camada (e o resto, rolando). */
export function FolhaDoCelular({ fechar }: { fechar: () => void }) {
  const ed = useEditor();
  const [tudo, setTudo] = useState(false);
  const c = ed.camada;
  if (!c) return null;
  return (
    <div className="estudio-surge fixed inset-x-0 bottom-[3.6rem] z-[82] max-h-[60dvh] overflow-y-auto rounded-t-2xl border-t border-e-fio bg-e-painel shadow-[0_-12px_40px_rgba(0,0,0,0.35)]" role="dialog" aria-label="Controles da camada">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-e-fio bg-e-painel px-4 py-2">
        <span className="mx-auto h-1 w-10 rounded-full bg-e-fio" aria-hidden />
      </div>
      {!tudo ? (
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="truncate font-semibold">{nomeDaCamada(c)}</p>
            <button type="button" className="cursor-pointer p-1 text-e-suave" onClick={fechar} aria-label="Fechar">
              <Icone nome="fechar" className="h-5 w-5" />
            </button>
          </div>
          {c.tipo === "texto" && (
            <>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <select value={c.fonte} onChange={(e) => ed.mudar({ fonte: e.target.value as Fonte })} aria-label="Fonte" className={CAMPO}>
                  {(Object.keys(NOMES_DAS_FONTES) as Fonte[]).map((f) => (
                    <option key={f} value={f}>
                      {NOMES_DAS_FONTES[f]}
                    </option>
                  ))}
                </select>
                <input type="number" value={Math.round(c.tamanho)} onChange={(e) => Number(e.target.value) > 0 && ed.mudar({ tamanho: Number(e.target.value) })} aria-label="Tamanho" className={CAMPO} />
              </div>
              <Cores valor={c.cor} mudar={(cor) => ed.mudar({ cor })} />
              <div className="flex items-center gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <BotaoIcone key={a} icone={a === "left" ? "texto-esq" : a === "center" ? "texto-centro" : "texto-dir"} rotulo={a === "left" ? "À esquerda" : a === "center" ? "Centralizado" : "À direita"} ativo={c.alinhar === a} onClick={() => ed.mudar({ alinhar: a })} />
                ))}
                <button type="button" className={`${BOTAO} ml-auto h-9`} onClick={() => ed.editarTexto(c.id)}>
                  Editar o texto
                </button>
              </div>
            </>
          )}
          {c.tipo !== "texto" && (c.tipo === "elemento" || c.tipo === "marca") && <Cores valor={c.cor} mudar={(cor) => ed.mudar({ cor })} />}
          {c.tipo === "imagem" && (
            <div className="flex gap-2">
              <button type="button" className={BOTAO} onClick={() => ed.setReenquadrar(c.id)}>Reenquadrar</button>
              <button type="button" className={BOTAO} onClick={() => ed.editarFoto(c.id)}>Recortar e fundo</button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <BotaoIcone icone="duplicar" rotulo="Duplicar" onClick={ed.acoes.duplicar} />
            <BotaoIcone icone="frente" rotulo="Para a frente" onClick={ed.acoes.frente} />
            <BotaoIcone icone="tras" rotulo="Para trás" onClick={ed.acoes.tras} />
            <BotaoIcone icone="cadeado" rotulo="Travar" onClick={ed.acoes.travar} />
            <BotaoIcone icone="lixeira" rotulo="Apagar" onClick={ed.acoes.apagar} className="text-[#c21f16]" />
            <button type="button" className={`${BOTAO} ml-auto`} onClick={() => setTudo(true)}>
              Mais <Icone nome="seta-cima" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className="flex w-full cursor-pointer items-center gap-1 px-4 py-2 text-sm text-e-suave" onClick={() => setTudo(false)}>
            <Icone nome="seta" className="h-4 w-4" /> Menos
          </button>
          <Propriedades />
        </div>
      )}
    </div>
  );
}

