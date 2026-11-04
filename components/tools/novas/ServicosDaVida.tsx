// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bancada, BotaoClaro, Escolha, Leitura } from "../../labs/kit";
import { avaliarCircuito, CLAUSULAS_ALUGUEL, CLAUSULAS_EMPRESTIMO, EXEMPLOS_DE_APARELHOS, explicarClausulas, pedidoDeEndereco, PROVAS_DE_SEMPRE, proximo, resumirCasa, resumoParaLevar, SERVICOS, UFS, type Gravidade, type TipoDeCircuito } from "@/lib/ferramentas/vida-real";
import { ComoUsar } from "./comum";
import { Apagar, Aviso, Folha, usePersistente } from "./VidaReal";

/*
 * Quatro ferramentas da vida real (Etapa 3): emergências trabalhistas, cláusulas de contrato, carga elétrica da casa e
 * mapa de serviços públicos. Tudo é calculado no navegador. O que a pessoa digita só fica guardado no próprio aparelho
 * (localStorage, chaves "lucia:ferramenta:<nome>") e pode ser apagado pelo botão "Apagar o que ficou guardado".
 * O texto colado de um contrato NÃO é guardado nem enviado. Nenhum link recebe dado da pessoa.
 */

const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5";
const n = (x: string) => { const v = Number(String(x).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const fmt = (x: number) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—");

/** O idioma da página (primeiro trecho do endereço), para os links internos das trilhas; cai em "pt". */
function useLang(): string {
  const p = usePathname() ?? "";
  const l = p.split("/")[1] ?? "";
  return /^[a-z]{2}$/.test(l) ? l : "pt";
}

const SELO: Record<Gravidade, [string, string]> = {
  ilegal: ["border-oxblood", "A lei vai contra esta cláusula"],
  atencao: ["border-gold", "Atenção: confira"],
  informa: ["border-ink/30", "Para saber"],
};

/* ───────────────────────── 1. Emergências trabalhistas ───────────────────────── */

const EMERG_INICIAL = { vai: "inicio", marcadas: [] as string[], fatos: "" };

export function EmergenciaTrabalhista() {
  const lang = useLang();
  const [f, setF, apagar] = usePersistente("emergencia-trabalhista", EMERG_INICIAL);
  const atual = proximo(f.vai) ?? proximo("inicio");
  const resultado = atual?.tipo === "resultado" ? atual : null;
  const marcar = (p: string) => setF({ ...f, marcadas: f.marcadas.includes(p) ? f.marcadas.filter((x) => x !== p) : [...f.marcadas, p] });
  return (
    <div>
      <Aviso>Não substitui o sindicato, a Defensoria Pública nem um advogado trabalhista: ajuda a organizar as provas e a saber a lei do seu caso antes de procurá-los. A convenção coletiva da sua categoria pode garantir mais do que a CLT.</Aviso>
      <Bancada titulo="Emergência no trabalho" subtitulo="Responda uma pergunta, junte as provas e leve ao sindicato ou à Defensoria">
        {!resultado && atual?.tipo === "pergunta" && (
          <div>
            <p className="font-serif text-lg font-semibold">{atual.no.pergunta}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {atual.no.opcoes.map((o) => (
                <li key={o.vai}><button type="button" onClick={() => setF({ ...f, vai: o.vai, marcadas: [] })} className="w-full cursor-pointer border-2 border-ink bg-folha px-3 py-2 text-left text-sm font-semibold hover:shadow-[3px_3px_0_var(--sombra)]">{o.texto}</button></li>
              ))}
            </ul>
          </div>
        )}
        {resultado && (
          <div className="text-sm">
            <h3 className="font-serif text-xl font-semibold">{resultado.resultado.titulo}</h3>
            {resultado.resultado.cuidado && <p role="note" className="mt-3 border-l-4 border-oxblood bg-parchment-deep px-3 py-2">{resultado.resultado.cuidado}</p>}
            <h4 className="mt-4 font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">1. Junte as provas (marque as que já tem)</h4>
            <ul className="mt-2 space-y-1.5">
              {resultado.resultado.provas.map((p) => (
                <li key={p}><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={f.marcadas.includes(p)} onChange={() => marcar(p)} /><span>{p}</span></label></li>
              ))}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">O que levar sempre, em qualquer caso</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">{PROVAS_DE_SEMPRE.map((p) => <li key={p}>{p}</li>)}</ul>
            </details>
            <h4 className="mt-4 font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">2. O que fazer, na ordem</h4>
            <ol className="mt-2 list-decimal space-y-1 pl-5">{resultado.resultado.passos.map((p) => <li key={p}>{p}</li>)}</ol>
            <h4 className="mt-4 font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">3. A lei do seu caso</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">{resultado.resultado.lei.map((p) => <li key={p}>{p}</li>)}</ul>
            <label className="mt-4 block font-semibold">O que aconteceu, com as suas palavras (fica só neste aparelho)
              <textarea value={f.fatos} onChange={(e) => setF({ ...f, fatos: e.target.value.slice(0, 2000) })} rows={4} className={campo} placeholder="Datas, nomes, valores, o que foi dito" />
            </label>
            <Folha texto={resumoParaLevar(resultado.id, f.marcadas, f.fatos)} aviso="Copie ou imprima e leve ao sindicato ou à Defensoria. O texto não é enviado a ninguém." />
            <div className="mt-3 flex flex-wrap gap-2 font-sans">
              <BotaoClaro onClick={() => setF({ ...EMERG_INICIAL, fatos: f.fatos })}>Voltar às perguntas</BotaoClaro>
              <a className="botao botao-papel botao-menor" href={`/${lang}/ferramentas/mapa-de-servicos`}>Onde fica a Defensoria e o Procon</a>
              <a className="botao botao-papel botao-menor" href={`/${lang}/ferramentas/direitos-trabalhistas`}>Calculadora de direitos</a>
              <a className="botao botao-papel botao-menor" href={`/${lang}/trilhas/direitos-no-trabalho`}>Trilha Direitos no trabalho</a>
            </div>
          </div>
        )}
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Escolha o que está acontecendo com você.", "Marque as provas que já tem e veja o que falta juntar.", "Copie o resumo e leve ao sindicato da sua categoria ou à Defensoria Pública."]}
        atividades={["Escolha \"Trabalho sem carteira assinada\" e liste três provas que você poderia juntar hoje.", "Veja o prazo de dez dias da rescisão: de que data ele conta?", "Compare \"pedido de demissão\" e \"dispensa sem justa causa\": o que muda nas verbas?"]}
        revisao
        fonte={<>Artigos conferidos no texto da <a className="underline" href="https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm" target="_blank" rel="noopener noreferrer">CLT</a> e da <a className="underline" href="https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" target="_blank" rel="noopener noreferrer">Lei 8.213/1991</a>, em planalto.gov.br.</>}
      />
    </div>
  );
}

/* ───────────────────────── 2. Cláusulas de aluguel e de empréstimo ───────────────────────── */

export function ClausulasDeContrato() {
  const [tipo, setTipo] = useState<"aluguel" | "emprestimo">("aluguel");
  const [texto, setTexto] = useState("");
  const lang = useLang();
  const lista = tipo === "aluguel" ? CLAUSULAS_ALUGUEL : CLAUSULAS_EMPRESTIMO;
  const r = texto.trim().length >= 20 ? explicarClausulas(tipo, texto) : null;
  const ordem: Gravidade[] = ["ilegal", "atencao", "informa"];
  const mostrar = (c: (typeof lista)[number], trecho?: string) => (
    <li key={c.id} className={`border-l-4 bg-parchment px-3 py-2 ${SELO[c.gravidade][0]}`}>
      <p className="font-mono text-[0.62rem] uppercase tracking-widest text-ink-soft">{SELO[c.gravidade][1]}</p>
      <p className="font-semibold">{c.tema}</p>
      <p className="mt-1">{c.explica}</p>
      <p className="mt-1 text-xs text-ink-soft">{c.lei}</p>
      {trecho && <p className="mt-1 text-xs"><span className="font-semibold">Achei perto de:</span> “…{trecho}…”</p>}
    </li>
  );
  return (
    <div>
      <Aviso>Não é parecer jurídico. A ferramenta procura palavras no texto que você colar e mostra o que a lei diz sobre cada assunto; ela não entende o contrato inteiro. Leve o contrato ao Procon, à Defensoria ou a um advogado antes de assinar. O texto colado não é guardado nem enviado.</Aviso>
      <Bancada titulo="Explicador de cláusulas" subtitulo="Aluguel (Lei do Inquilinato) e empréstimo (Código de Defesa do Consumidor)">
        <Escolha rotulo="Que contrato é?" valor={tipo} opcoes={[["aluguel", "Aluguel (Lei 8.245/1991)"], ["emprestimo", "Empréstimo ou compra a prazo (CDC, Lei 8.078/1990)"]]} mudar={setTipo} />
        <label className="mt-4 block text-sm font-semibold">Cole aqui o trecho do contrato (ou o contrato inteiro)
          <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 30000))} rows={8} className={campo} placeholder="Cole o texto das cláusulas. Quanto mais completo, melhor a conferência." />
        </label>
        <div className="mt-2"><BotaoClaro onClick={() => setTexto("")}>Limpar o texto</BotaoClaro></div>
        {r && (
          <div className="mt-4 text-sm">
            <h3 className="font-serif text-lg font-semibold">O que achei no texto</h3>
            {r.achados.length === 0 ? <p className="mt-2">Não achei assuntos conhecidos. Leia a lista abaixo e confira o contrato à mão.</p> : (
              <ul className="mt-2 space-y-2">{ordem.flatMap((g) => r.achados.filter((a) => a.clausula.gravidade === g)).map((a) => mostrar(a.clausula, a.trecho))}</ul>
            )}
            {r.faltam.length > 0 && (
              <div role="note" className="mt-4 border-2 border-gold bg-parchment-deep px-3 py-2">
                <p className="font-semibold">Não achei no texto colado:</p>
                <ul className="mt-1 list-disc pl-5">{r.faltam.map((f) => <li key={f.nome}>{f.nome} <span className="text-xs text-ink-soft">({f.lei})</span></li>)}</ul>
                <p className="mt-1 text-xs">Pode estar em outra página do contrato. Se não estiver, peça por escrito.</p>
              </div>
            )}
            {r.gerais.length > 0 && <ul className="mt-4 space-y-2">{r.gerais.map((c) => mostrar(c))}</ul>}
          </div>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">Ver todos os assuntos que a ferramenta confere ({lista.length})</summary>
          <ul className="mt-2 space-y-2">{lista.map((c) => mostrar(c))}</ul>
        </details>
        <p className="mt-4 text-sm">Veja também: <a className="underline" href={`/${lang}/trilhas/dividas-e-nome-sujo`}>trilha Dívidas e nome sujo</a>, <a className="underline" href={`/${lang}/ferramentas/dividas-e-renegociacao`}>simulador de dívida</a> e <a className="underline" href={`/${lang}/ferramentas/mapa-de-servicos`}>onde achar o Procon e a Defensoria</a>.</p>
      </Bancada>
      <ComoUsar
        passos={["Escolha o tipo de contrato e cole o texto.", "Leia primeiro o que está marcado como contra a lei, depois o que pede atenção.", "Leve as dúvidas, com a lei citada, ao Procon ou à Defensoria antes de assinar."]}
        atividades={["Cole uma cláusula com fiador e caução juntos: o que a ferramenta diz?", "Cole um contrato de empréstimo sem a taxa de juros: o que ela avisa que falta?", "Procure a multa por atraso no seu contrato: ela passa de 2% da prestação?"]}
        revisao
        fonte={<>Leis conferidas em planalto.gov.br: <a className="underline" href="https://www.planalto.gov.br/ccivil_03/leis/l8245.htm" target="_blank" rel="noopener noreferrer">Lei 8.245/1991</a> e <a className="underline" href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noopener noreferrer">Lei 8.078/1990</a>.</>}
      />
    </div>
  );
}

/* ───────────────────────── 3. Carga elétrica da casa ───────────────────────── */

interface Ap { nome: string; watts: string; circuito: string }
interface Cfg { tipo: TipoDeCircuito; fio: string; disj: string }
const CARGA_INICIAL: { tensao: "127" | "220"; agrupados: string; aparelhos: Ap[]; cfg: Record<string, Cfg> } = {
  tensao: "127", agrupados: "3", aparelhos: [{ nome: "Chuveiro elétrico (veja a etiqueta)", watts: "5500", circuito: "1" }, { nome: "Micro-ondas", watts: "1200", circuito: "2" }, { nome: "Geladeira", watts: "300", circuito: "2" }], cfg: {},
};
const NOME_TIPO: Record<TipoDeCircuito, string> = { iluminacao: "Iluminação", tomadas: "Tomadas", exclusivo: "Só um aparelho" };

export function CargaEletrica() {
  const lang = useLang();
  const [f, setF, apagar] = usePersistente("carga-eletrica", CARGA_INICIAL);
  const tensao = f.tensao === "220" ? 220 : 127;
  const aparelhos = f.aparelhos.map((a) => ({ nome: a.nome, watts: n(a.watts), circuito: Math.round(n(a.circuito)) || 1 }));
  const resumo = resumirCasa(aparelhos, tensao);
  const mudarAp = (i: number, k: keyof Ap, v: string) => setF({ ...f, aparelhos: f.aparelhos.map((a, j) => (j === i ? { ...a, [k]: v.slice(0, k === "nome" ? 60 : 6) } : a)) });
  const mudarCfg = (c: number, parte: Partial<Cfg>, padrao: Cfg) => setF({ ...f, cfg: { ...f.cfg, [c]: { ...padrao, ...f.cfg[c], ...parte } } });
  return (
    <div>
      <p role="note" className="mb-4 border-2 border-oxblood bg-parchment-deep px-4 py-3 font-sans text-sm"><strong>Aviso de segurança.</strong> Esta conta é uma <strong>estimativa de estudo</strong>, pela tabela simplificada de um manual baseado na NBR 5410. Ela não substitui o projeto nem a vistoria de um eletricista habilitado. Antes de mexer em fio, tomada ou quadro, <strong>desligue o disjuntor geral</strong> e confirme com um medidor que não há tensão. Nunca troque um disjuntor por outro maior para &quot;parar de desarmar&quot;: é assim que o fio esquenta dentro da parede. Nada do que você digita sai do aparelho.</p>
      <Bancada titulo="Carga elétrica da casa" subtitulo="Some os aparelhos, divida em circuitos e veja se o fio e o disjuntor aguentam">
        <div className="grid gap-3 sm:grid-cols-2">
          <Escolha rotulo="Tensão da tomada" valor={f.tensao} opcoes={[["127", "127 V"], ["220", "220 V"]]} mudar={(v) => setF({ ...f, tensao: v })} />
          <label className="block text-sm font-semibold">Circuitos passando juntos no mesmo eletroduto
            <select value={f.agrupados} onChange={(e) => setF({ ...f, agrupados: e.target.value })} className={campo}>{["1", "2", "3", "4"].map((x) => <option key={x} value={x}>{x === "4" ? "4 ou mais" : x}</option>)}</select>
          </label>
        </div>
        <h3 className="mt-4 font-mono text-[0.68rem] uppercase tracking-widest text-oxblood">Aparelhos (a potência está na etiqueta: W ou VA)</h3>
        <ul className="mt-2 space-y-2">
          {f.aparelhos.map((a, i) => (
            <li key={i} className="grid grid-cols-[1fr_5.5rem_4rem_auto] items-end gap-2 text-sm">
              <label>Aparelho<input value={a.nome} onChange={(e) => mudarAp(i, "nome", e.target.value)} className={campo} /></label>
              <label>Watts<input value={a.watts} onChange={(e) => mudarAp(i, "watts", e.target.value)} inputMode="decimal" className={campo} /></label>
              <label>Circ.<input value={a.circuito} onChange={(e) => mudarAp(i, "circuito", e.target.value)} inputMode="numeric" className={campo} /></label>
              <BotaoClaro onClick={() => setF({ ...f, aparelhos: f.aparelhos.filter((_, j) => j !== i) })}>Tirar</BotaoClaro>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <BotaoClaro onClick={() => setF({ ...f, aparelhos: [...f.aparelhos, { nome: "", watts: "", circuito: "1" }].slice(0, 30) })}>Adicionar aparelho</BotaoClaro>
          {EXEMPLOS_DE_APARELHOS.map((e) => <BotaoClaro key={e.nome} onClick={() => setF({ ...f, aparelhos: [...f.aparelhos, { nome: e.nome, watts: String(e.watts), circuito: "1" }].slice(0, 30) })}>+ {e.nome.replace(/ \(.*\)/, "")}</BotaoClaro>)}
        </div>
        <p className="mt-1 text-xs text-ink-soft">Os valores dos botões são só exemplos. O certo é o da etiqueta do seu aparelho. Aparelhos no mesmo número de circuito dividem o mesmo fio e o mesmo disjuntor.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Leitura rotulo="Potência somada da casa" valor={`${fmt(resumo.totalWatts)} W`} />
          <Leitura rotulo="Corrente somada (se tudo ligasse junto)" valor={`${fmt(resumo.correnteTotal)} A`} />
        </div>
        <div className="mt-4 space-y-4">
          {resumo.porCircuito.map((c) => {
            const padrao: Cfg = { tipo: c.watts / tensao > 10 && c.itens.length === 1 ? "exclusivo" : "tomadas", fio: "0", disj: "" };
            const cfg = { ...padrao, ...f.cfg[c.circuito] };
            const s = avaliarCircuito({ watts: c.watts, tensao, agrupados: n(f.agrupados), tipo: cfg.tipo, fioAtual: Number(cfg.fio) || 0, disjuntorAtual: n(cfg.disj) });
            const cor = s.nivel === "perigo" ? "border-oxblood" : s.nivel === "atencao" ? "border-gold" : "border-ink/30";
            return (
              <section key={c.circuito} className={`border-2 bg-parchment p-3 text-sm ${cor}`}>
                <h4 className="font-serif text-lg font-semibold">Circuito {c.circuito}: {fmt(c.watts)} W, {fmt(s.corrente)} A</h4>
                <p className="text-xs text-ink-soft">{c.itens.join(", ")}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Escolha rotulo="Tipo" valor={cfg.tipo} opcoes={(Object.keys(NOME_TIPO) as TipoDeCircuito[]).map((t) => [t, NOME_TIPO[t]])} mudar={(v) => mudarCfg(c.circuito, { tipo: v }, padrao)} />
                  <label className="block font-semibold">Fio que existe hoje<select value={cfg.fio} onChange={(e) => mudarCfg(c.circuito, { fio: e.target.value }, padrao)} className={campo}><option value="0">Não sei</option>{["1.5", "2.5", "4", "6", "10", "16"].map((x) => <option key={x} value={x}>{x.replace(".", ",")} mm²</option>)}</select></label>
                  <label className="block font-semibold">Disjuntor que existe hoje (A)<input value={cfg.disj} onChange={(e) => mudarCfg(c.circuito, { disj: e.target.value.slice(0, 3) }, padrao)} inputMode="numeric" placeholder="não sei" className={campo} /></label>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Leitura rotulo="Fio mínimo" valor={s.fioMinimo ? `${fmt(s.fioMinimo)} mm²` : "—"} destaque />
                  <Leitura rotulo="Disjuntor" valor={s.disjuntor ? `${s.disjuntor} A` : "—"} destaque />
                  <Leitura rotulo="Interruptor DR mínimo" valor={s.dr ? `${s.dr} A` : "—"} />
                </div>
                {s.avisos.length > 0 && <ul role="alert" className="mt-3 list-disc space-y-1 pl-5">{s.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
              </section>
            );
          })}
        </div>
        <p className="mt-4 text-xs">Fonte da tabela: manual &quot;Instalações elétricas residenciais&quot; (ELEKTRO e Pirelli, baseado na NBR 5410) e a aula <a className="underline" href={`/${lang}/trilhas/instalacoes-eletricas-residenciais/dimensionar-um-circuito`}>Dimensionar um circuito</a>. O método completo da norma leva em conta a maneira de instalar, a temperatura e a queda de tensão em circuitos compridos. A entrada de energia e o medidor dependem da distribuidora da sua cidade: consulte-a.</p>
        <p className="mt-2 text-sm">Quer aprender a fazer a conta e a instalação com segurança? <a className="underline" href={`/${lang}/trilhas/eletricidade-basica-e-seguranca`}>Eletricidade básica e segurança</a>, <a className="underline" href={`/${lang}/trilhas/instalacoes-eletricas-residenciais`}>Instalações elétricas residenciais</a> e <a className="underline" href={`/${lang}/trilhas/manutencao-e-diagnostico-eletrico`}>Manutenção e diagnóstico elétrico</a> (trilha de eletricista).</p>
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Escolha a tensão da sua tomada e liste os aparelhos com a potência da etiqueta.", "Ponha em cada aparelho o número do circuito em que ele está ligado.", "Diga o fio e o disjuntor que existem e leia os avisos: vermelho é risco."]}
        atividades={["Ponha o chuveiro sozinho no circuito 1, em 220 V: qual fio e qual disjuntor a tabela pede?", "Ligue o micro-ondas e o ferro no mesmo circuito de tomadas em 127 V: passa de 10 A?", "Diga que o fio é de 2,5 mm² e o disjuntor de 40 A: por que o aviso fica vermelho?"]}
        revisao
      />
    </div>
  );
}

/* ───────────────────────── 4. Mapa de serviços públicos ───────────────────────── */

const MAPA_INICIAL = { municipio: "", uf: "" };

export function MapaDeServicos() {
  const [f, setF, apagar] = usePersistente("mapa-de-servicos", MAPA_INICIAL);
  const [copiado, setCopiado] = useState("");
  const copiar = async (id: string, t: string) => {
    try { await navigator.clipboard.writeText(t); setCopiado(id); } catch { setCopiado("erro"); }
  };
  return (
    <div>
      <Aviso>Esta página não mostra endereços: eles mudam e um endereço errado atrapalha. Ela leva aos buscadores oficiais (gov.br e órgãos públicos), onde você escolhe o estado e o município. O município que você digitar abaixo fica só neste aparelho, serve para montar a sua mensagem e não vai em nenhum link. O site não pede nem usa o GPS.</Aviso>
      <Bancada titulo="Mapa de serviços públicos" subtitulo="CRAS, UBS, CAPS, Defensoria, Procon e EJA: o que cada um faz e onde procurar">
        <div className="grid max-w-xl gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block text-sm font-semibold">Seu município (opcional)<input value={f.municipio} onChange={(e) => setF({ ...f, municipio: e.target.value.slice(0, 60) })} className={campo} autoComplete="off" /></label>
          <label className="block text-sm font-semibold">Estado<select value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} className={campo}><option value="">--</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
        </div>
        <ul className="mt-5 space-y-4">
          {SERVICOS.map((s) => (
            <li key={s.id} className="border-2 border-ink bg-parchment p-4 text-sm">
              <h3 className="font-serif text-xl font-semibold">{s.sigla}: {s.nome}</h3>
              <p className="mt-1">{s.paraQue}</p>
              <p className="mt-2 font-semibold">Procure quando:</p>
              <ul className="list-disc pl-5">{s.quando.map((q) => <li key={q}>{q}</li>)}</ul>
              <p className="mt-2"><span className="font-semibold">Como chegar:</span> {s.chegar}</p>
              <p className="mt-2 font-semibold">Onde achar a unidade (sites oficiais):</p>
              <ul className="list-disc pl-5">{s.links.map((l) => <li key={l.url}><a className="underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.texto}</a></li>)}</ul>
              {s.semBuscaNacional && <p className="mt-2 text-xs">{s.semBuscaNacional}</p>}
              {s.lei && <p className="mt-2 text-xs text-ink-soft">{s.lei}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <BotaoClaro onClick={() => copiar(s.id, pedidoDeEndereco(s, f.municipio, f.uf))}>Copiar mensagem para pedir o endereço</BotaoClaro>
                {copiado === s.id && <span role="status" className="text-xs text-ink-soft">Copiado.</span>}
              </div>
            </li>
          ))}
        </ul>
        {copiado === "erro" && <p role="status" className="mt-2 text-xs">Não deu para copiar sozinho: selecione o texto e copie.</p>}
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Leia o que cada serviço faz e escolha o que combina com o seu problema.", "Abra o site oficial e escolha o seu estado e o seu município por lá.", "Se não achar, copie a mensagem pronta e peça o endereço à prefeitura."]}
        atividades={["Descubra qual CRAS atende o seu bairro.", "Veja onde fica a Defensoria Pública do seu estado.", "Confira a idade mínima do Encceja para você ou para alguém da sua família."]}
        revisao
        fonte={<>Links de gov.br, Ministério da Saúde, Inep, DPU, ANADEP e consumidor.gov.br, conferidos em 4/11/2026. Se um link mudar, avise pela página &quot;Relatar erro&quot;.</>}
      />
    </div>
  );
}
