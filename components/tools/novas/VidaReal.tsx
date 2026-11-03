// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { Bancada, BotaoClaro, Escolha, Leitura } from "../../labs/kit";
import { ComoUsar } from "./comum";

/*
 * Cinco ferramentas da vida real: quanto cobrar, currículo, orçamento e contrato, dívida e modelos de documentos.
 * Tudo é calculado no navegador. O que a pessoa digita só fica guardado no próprio aparelho (localStorage, chaves
 * "lucia:ferramenta:<nome>") e pode ser apagado pelo botão "Apagar o que ficou guardado".
 */

const real = (x: number) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const n = (x: string) => { const v = Number(String(x).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5";
const linhas = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const lista = (s: string) => linhas(s).map((l) => `- ${l.replace(/^[-•*]\s*/, "")}`).join("\n");
const bloco = (titulo: string, corpo: string) => (corpo.trim() ? `${titulo}\n${corpo.trim()}\n\n` : "");
const dataLonga = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "____/____/________";
};

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="mb-4 border-2 border-oxblood bg-parchment-deep px-4 py-3 font-sans text-sm">
      <strong>Ferramenta informativa, em revisão.</strong> {children} Nada do que você digita sai do aparelho.
    </p>
  );
}

/** Guarda os campos no aparelho (localStorage, chave "lucia:ferramenta:<nome>"). Lê depois de abrir, para o servidor e o navegador casarem. */
function usePersistente<T extends object>(nome: string, inicial: T): [T, (v: T) => void, () => void] {
  const chave = `lucia:ferramenta:${nome}`;
  const [valor, setValor] = useState<T>(inicial);
  useEffect(() => {
    // Depois de abrir (e não durante): o servidor e o navegador começam iguais.
    const id = window.setTimeout(() => {
      try {
        const x = window.localStorage.getItem(chave);
        if (x) setValor({ ...inicial, ...(JSON.parse(x) as Partial<T>) });
      } catch { /* sem armazenamento: segue sem guardar */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, [chave, inicial]);
  const mudar = (v: T) => {
    setValor(v);
    try { window.localStorage.setItem(chave, JSON.stringify(v)); } catch { /* ignora */ }
  };
  const apagar = () => {
    setValor(inicial);
    try { window.localStorage.removeItem(chave); } catch { /* ignora */ }
  };
  return [valor, mudar, apagar];
}

/** A folha de papel: o texto pronto, com copiar e imprimir. Na impressão só a folha aparece. */
function Folha({ texto, aviso }: { texto: string; aviso?: string }) {
  const [msg, setMsg] = useState("");
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setMsg("Texto copiado."); } catch { setMsg("Não deu para copiar sozinho: selecione o texto e copie."); }
  };
  return (
    <div className="mt-4">
      <style>{"@media print { body * { visibility: hidden !important; } [data-folha], [data-folha] * { visibility: visible !important; } [data-folha] { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; } }"}</style>
      <pre data-folha className="max-h-[32rem] overflow-auto whitespace-pre-wrap border-2 border-ink/40 bg-white p-4 font-serif text-[0.95rem] leading-relaxed text-black">{texto}</pre>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-sans text-sm">
        <BotaoClaro onClick={copiar}>Copiar texto</BotaoClaro>
        <BotaoClaro onClick={() => window.print()}>Imprimir ou salvar em PDF</BotaoClaro>
        <span role="status" className="text-xs text-ink-soft">{msg}</span>
      </div>
      {aviso && <p className="mt-2 font-sans text-xs text-ink-soft">{aviso}</p>}
    </div>
  );
}

function Apagar({ onClick }: { onClick: () => void }) {
  return <div className="mt-3 font-sans"><BotaoClaro onClick={onClick}>Apagar o que ficou guardado neste aparelho</BotaoClaro></div>;
}

function Entrada({ rotulo, valor, mudar, tipo = "text", modo, max = 120, dica }: { rotulo: string; valor: string; mudar: (v: string) => void; tipo?: string; modo?: "numeric" | "decimal"; max?: number; dica?: string }) {
  return <label className="block text-sm font-semibold">{rotulo}<input type={tipo} value={valor} onChange={(e) => mudar(e.target.value.slice(0, max))} inputMode={modo} placeholder={dica} className={campo} /></label>;
}

function Texto({ rotulo, valor, mudar, linhasN = 3, dica }: { rotulo: string; valor: string; mudar: (v: string) => void; linhasN?: number; dica?: string }) {
  return <label className="block text-sm font-semibold">{rotulo}<textarea value={valor} onChange={(e) => mudar(e.target.value.slice(0, 2000))} rows={linhasN} placeholder={dica} className={campo} /></label>;
}

/* ───────────────────────────── 1. Quanto cobrar ───────────────────────────── */

const COBRAR_INICIAL = { querGanhar: "2500", custos: "400", diasSemana: "5", horasDia: "6", semTrabalhoMes: "3", feriasSemanas: "3", decimo: true, inss: "mei", minimo: "1621" };

/** Contribuição mensal ao INSS por tipo, com a regra de 2026 (salário mínimo editável). */
export function inssDoMes(tipo: string, minimo: number, ganho: number): number {
  if (tipo === "mei") return minimo * 0.05 + 5; // DAS-MEI: 5% do salário mínimo + R$ 5 de ISS (serviços)
  if (tipo === "simplificado") return minimo * 0.11; // plano simplificado: 11% do salário mínimo
  if (tipo === "normal") return Math.max(minimo, ganho) * 0.2; // plano normal: 20% sobre o que ganha (mínimo e teto do INSS)
  return 0;
}

export function QuantoCobrar() {
  const [f, setF, apagar] = usePersistente("quanto-cobrar", COBRAR_INICIAL);
  const mudar = (k: keyof typeof COBRAR_INICIAL, v: string | boolean) => setF({ ...f, [k]: v });
  const ganhar = n(f.querGanhar);
  const inss = inssDoMes(f.inss, n(f.minimo), ganhar);
  const mensal = ganhar + n(f.custos) + inss;
  const anual = mensal * 12 + (f.decimo ? ganhar : 0);
  const diasSemana = Math.min(7, Math.max(1, n(f.diasSemana)));
  const diasNoAno = diasSemana * 52 - diasSemana * Math.max(0, n(f.feriasSemanas)) - Math.max(0, n(f.semTrabalhoMes)) * 12;
  const horasDia = Math.max(0.5, Math.min(16, n(f.horasDia)));
  const dia = diasNoAno > 0 ? anual / diasNoAno : NaN;
  const hora = dia / horasDia;
  return (
    <div>
      <Aviso>Não substitui um contador nem a orientação do Sebrae. O resultado é o valor mínimo para fechar a conta; os valores de INSS são da regra de 2026, que muda: confira no gov.br (portal do MEI, do INSS e da Receita) antes de decidir.</Aviso>
      <Bancada titulo="Quanto cobrar" subtitulo="O valor mínimo da sua hora e do seu dia de trabalho por conta própria">
        <div className="grid gap-3 sm:grid-cols-3">
          <Entrada rotulo="Quanto quer ganhar por mês (R$)" valor={f.querGanhar} mudar={(v) => mudar("querGanhar", v)} modo="decimal" max={12} />
          <Entrada rotulo="Custos fixos por mês (R$)" valor={f.custos} mudar={(v) => mudar("custos", v)} modo="decimal" max={12} dica="ferramentas, transporte, celular" />
          <Entrada rotulo="Salário mínimo do ano (R$)" valor={f.minimo} mudar={(v) => mudar("minimo", v)} modo="decimal" max={10} />
          <Entrada rotulo="Dias de trabalho por semana" valor={f.diasSemana} mudar={(v) => mudar("diasSemana", v)} modo="numeric" max={1} />
          <Entrada rotulo="Horas de serviço pago por dia" valor={f.horasDia} mudar={(v) => mudar("horasDia", v)} modo="decimal" max={4} dica="só as horas que cobra" />
          <Entrada rotulo="Dias sem trabalho por mês" valor={f.semTrabalhoMes} mudar={(v) => mudar("semTrabalhoMes", v)} modo="decimal" max={4} dica="doença, chuva, falta de serviço" />
          <Entrada rotulo="Semanas de férias por ano" valor={f.feriasSemanas} mudar={(v) => mudar("feriasSemanas", v)} modo="decimal" max={4} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Escolha rotulo="INSS (regra de 2026)" valor={f.inss} opcoes={[["mei", "MEI"], ["simplificado", "Autônomo simplificado"], ["normal", "Autônomo normal"], ["nenhum", "Não pago"]]} mudar={(v) => mudar("inss", v)} />
          <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={f.decimo} onChange={(e) => mudar("decimo", e.target.checked)} />Guardar um 13º para mim (um mês a mais por ano)</label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Leitura rotulo="INSS por mês" valor={real(inss)} />
          <Leitura rotulo="Preciso fechar por mês" valor={real(mensal)} />
          <Leitura rotulo="Valor mínimo do dia" valor={real(dia)} destaque />
          <Leitura rotulo="Valor mínimo da hora" valor={real(hora)} destaque />
        </div>
        <p className="mt-3 text-sm">{diasNoAno > 0 ? <>Conta: {real(anual)} por ano, divididos por {Math.round(diasNoAno)} dias que de fato rendem dinheiro.</> : "Os dias sem trabalho e as férias deixaram zero dias de serviço no ano: confira os números."}</p>
        <p className="mt-2 text-xs">MEI: contribuição de 5% do salário mínimo mais R$ 5 de ISS (quem presta serviço); autônomo simplificado: 11% do mínimo, sem direito a aposentadoria por tempo de contribuição; autônomo normal: 20% sobre o que ganha, dentro do mínimo e do teto do INSS. As regras e os valores mudam todo ano: confira no gov.br. Este valor é o mínimo: some o risco do serviço, o material e a sua experiência. Se o cliente paga menos, o trabalho dá prejuízo.</p>
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Ponha quanto quer ganhar e os custos que você paga todo mês.", "Conte com honestidade os dias sem serviço e as férias: ninguém trabalha 365 dias.", "Escolha o seu INSS e veja o mínimo da hora; nunca cobre abaixo dele."]}
        atividades={["Troque \"MEI\" por \"Não pago\": quanto a hora diminui? E o que você perde por não contribuir?", "Dobre os dias sem trabalho no mês: quanto sobe o valor do dia?", "Compare a sua hora com a de quem tem carteira assinada: eles têm férias, 13º e FGTS pagos pela empresa."]}
        revisao
      />
    </div>
  );
}

/* ───────────────────────────── 2. Currículo ───────────────────────────── */

const CURRICULO_INICIAL = { nome: "", local: "", telefone: "", email: "", objetivo: "", sei: "", carteira: "", bicos: "", estudos: "", disponibilidade: "", carta: true, vaga: "", empresa: "" };

export function montarCurriculo(f: typeof CURRICULO_INICIAL): string {
  const contato = [f.local, f.telefone, f.email].map((x) => x.trim()).filter(Boolean).join(" | ");
  let t = `${(f.nome.trim() || "SEU NOME").toUpperCase()}\n${contato}\n\n`;
  t += bloco("OBJETIVO", f.objetivo);
  t += bloco("O QUE SEI FAZER", lista(f.sei));
  t += bloco("EXPERIÊNCIA COM CARTEIRA ASSINADA", lista(f.carteira));
  t += bloco("TRABALHOS SEM CARTEIRA (BICOS E SERVIÇOS POR CONTA PRÓPRIA)", lista(f.bicos));
  t += bloco("ESTUDOS E CURSOS", lista(f.estudos));
  t += bloco("DISPONIBILIDADE", f.disponibilidade);
  if (f.carta) {
    const vaga = f.vaga.trim() || "a vaga";
    const sei = linhas(f.sei).slice(0, 3).join(", ").toLowerCase();
    const bico = linhas(f.bicos)[0];
    t += `CARTA DE APRESENTAÇÃO\nPrezados(as)${f.empresa.trim() ? ` da ${f.empresa.trim()}` : ""},\n\nMeu nome é ${f.nome.trim() || "(seu nome)"} e tenho interesse em ${vaga}. ${sei ? `Sei ${sei}. ` : ""}${bico ? `Já trabalhei por conta própria: ${bico.replace(/^[-•*]\s*/, "").replace(/[.;]$/, "")}. ` : ""}Sou pessoa responsável, aprendo rápido e cumpro o combinado.\n\nFico à disposição para uma conversa. ${f.telefone.trim() ? `Meu telefone é ${f.telefone.trim()}.` : ""}\n\nAtenciosamente,\n${f.nome.trim() || "(seu nome)"}\n`;
  }
  return t.trim();
}

export function GeradorDeCurriculo() {
  const [f, setF, apagar] = usePersistente("curriculo", CURRICULO_INICIAL);
  const mudar = (k: keyof typeof CURRICULO_INICIAL, v: string | boolean) => setF({ ...f, [k]: v });
  const todo = Object.values(f).filter((v): v is string => typeof v === "string").join("\n");
  const perigo = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(todo) || /\b(cpf|rg|identidade)\b/i.test(todo) || /\b(rua|avenida|av\.|travessa|alameda)\b/i.test(todo);
  return (
    <div>
      <Aviso>Um currículo é só um modelo; ajuste ao seu jeito. Revise o texto antes de mandar.</Aviso>
      <p role="note" className="mb-4 border-2 border-ink bg-parchment px-4 py-3 font-sans text-sm"><strong>Cuidado com os seus dados.</strong> Não coloque CPF, RG nem endereço completo no currículo: são dados pessoais protegidos pela LGPD (Lei 13.709/2018) e podem ser usados em golpes. Basta o bairro ou a cidade, um telefone e um e-mail. A empresa pede os documentos quando contratar.</p>
      {perigo && <p role="alert" className="mb-4 border-2 border-oxblood bg-parchment-deep px-4 py-3 font-sans text-sm font-semibold">Parece que há CPF, RG ou endereço de rua nos campos. Tire antes de mandar o currículo a alguém.</p>}
      <Bancada titulo="Gerador de currículo" subtitulo="Para quem tem carteira assinada e para quem só fez bico">
        <div className="grid gap-3 sm:grid-cols-2">
          <Entrada rotulo="Nome" valor={f.nome} mudar={(v) => mudar("nome", v)} />
          <Entrada rotulo="Bairro e cidade" valor={f.local} mudar={(v) => mudar("local", v)} dica="sem rua e sem número" />
          <Entrada rotulo="Telefone ou WhatsApp" valor={f.telefone} mudar={(v) => mudar("telefone", v)} modo="numeric" max={20} />
          <Entrada rotulo="E-mail" valor={f.email} mudar={(v) => mudar("email", v)} tipo="email" />
        </div>
        <div className="mt-3 grid gap-3">
          <Entrada rotulo="Que trabalho você procura" valor={f.objetivo} mudar={(v) => mudar("objetivo", v)} dica="ex.: ajudante de cozinha" max={200} />
          <Texto rotulo="O que sei fazer (uma coisa por linha)" valor={f.sei} mudar={(v) => mudar("sei", v)} dica={"Cozinhar para muita gente\nAtender o público\nUsar o celular para vender"} />
          <Texto rotulo="Trabalhos com carteira assinada (uma linha para cada)" valor={f.carteira} mudar={(v) => mudar("carteira", v)} dica="Padaria Sol, auxiliar de balcão, 2021 a 2023" />
          <Texto rotulo="Trabalhos sem carteira: bicos e serviços por conta própria" valor={f.bicos} mudar={(v) => mudar("bicos", v)} dica={"Diarista em casas de família, 2019 a 2024\nVenda de bolo de pote no bairro, desde 2022"} />
          <Texto rotulo="Estudos e cursos" valor={f.estudos} mudar={(v) => mudar("estudos", v)} linhasN={2} dica="Ensino médio completo; curso de informática básica" />
          <Entrada rotulo="Disponibilidade" valor={f.disponibilidade} mudar={(v) => mudar("disponibilidade", v)} dica="ex.: manhã e tarde, de segunda a sábado" />
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.carta} onChange={(e) => mudar("carta", e.target.checked)} />Incluir carta de apresentação curta</label>
          </div>
          {f.carta && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Entrada rotulo="Vaga da carta" valor={f.vaga} mudar={(v) => mudar("vaga", v)} dica="ex.: a vaga de auxiliar de cozinha" />
              <Entrada rotulo="Nome da empresa (se souber)" valor={f.empresa} mudar={(v) => mudar("empresa", v)} />
            </div>
          )}
        </div>
        <Folha texto={montarCurriculo(f)} aviso="Dica: quem só fez bico tem experiência de verdade. Conte o que fez, por quanto tempo e o que aprendeu: responsabilidade, clientes que voltaram, horário cumprido." />
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Preencha os campos; os que ficarem vazios somem do currículo.", "Em \"trabalhos sem carteira\", conte seus bicos como experiência.", "Copie o texto ou use \"Imprimir ou salvar em PDF\" e escolha \"Salvar como PDF\"."]}
        atividades={["Escreva três coisas que você sabe fazer e que nunca pensou em pôr num currículo.", "Leia a carta em voz alta: soa como você falaria? Mude o que não soar.", "Peça a alguém de confiança para ler e dizer o que ficou confuso."]}
        revisao
      />
    </div>
  );
}

/* ───────────────────────────── 3. Orçamento e contrato ───────────────────────────── */

interface Item { d: string; t: "mao" | "material"; q: string; v: string }
const ORCAMENTO_INICIAL = {
  prestador: "", cliente: "", servico: "", local: "", prazo: "", pagamento: "50% na entrada e 50% na entrega", validade: "10", garantia: "", multa: "2", cidade: "", data: "",
  itens: [{ d: "Mão de obra", t: "mao", q: "1", v: "" }, { d: "Material", t: "material", q: "1", v: "" }] as Item[],
};

export function montarOrcamento(f: typeof ORCAMENTO_INICIAL): string {
  const itens = f.itens.filter((i) => i.d.trim() || n(i.v));
  const total = (t?: Item["t"]) => itens.filter((i) => !t || i.t === t).reduce((s, i) => s + n(i.q || "1") * n(i.v), 0);
  const linha = (i: Item) => `- ${i.d.trim() || "Item"} (${i.t === "mao" ? "mão de obra" : "material"}): ${n(i.q || "1")} x ${real(n(i.v))} = ${real(n(i.q || "1") * n(i.v))}`;
  return `ORÇAMENTO DE SERVIÇO\n\nPrestador: ${f.prestador.trim() || "__________"}\nCliente: ${f.cliente.trim() || "__________"}\nData: ${dataLonga(f.data)}\n\nServiço: ${f.servico.trim() || "__________"}\nLocal do serviço: ${f.local.trim() || "__________"}\n\nITENS\n${itens.map(linha).join("\n") || "- (sem itens)"}\n\nMão de obra: ${real(total("mao"))}\nMaterial: ${real(total("material"))}\nTOTAL: ${real(total())}\n\nPrazo de execução: ${f.prazo.trim() || "a combinar"}\nForma de pagamento: ${f.pagamento.trim() || "a combinar"}\nValidade deste orçamento: ${n(f.validade) || 10} dias\n${f.garantia.trim() ? `Garantia: ${f.garantia.trim()}\n` : ""}\nModelo informativo, não substitui orientação jurídica.`;
}

export function montarContrato(f: typeof ORCAMENTO_INICIAL): string {
  const itens = f.itens.filter((i) => i.d.trim() || n(i.v));
  const total = itens.reduce((s, i) => s + n(i.q || "1") * n(i.v), 0);
  const mat = itens.filter((i) => i.t === "material").reduce((s, i) => s + n(i.q || "1") * n(i.v), 0);
  return `CONTRATO SIMPLES DE PRESTAÇÃO DE SERVIÇO\n\nCONTRATADO(A): ${f.prestador.trim() || "__________"}\nCONTRATANTE: ${f.cliente.trim() || "__________"}\n\nCláusula 1ª. O(A) contratado(a) fará o seguinte serviço: ${f.servico.trim() || "__________"}, no local: ${f.local.trim() || "__________"}.\n\nCláusula 2ª. O preço total é de ${real(total)}, sendo ${real(total - mat)} de mão de obra e ${real(mat)} de material. Forma de pagamento: ${f.pagamento.trim() || "a combinar"}.\n\nCláusula 3ª. O serviço será feito no prazo de: ${f.prazo.trim() || "a combinar"}. Se o(a) contratante atrasar a liberação do local ou mudar o serviço, o prazo muda por conversa entre as partes.\n\nCláusula 4ª. O material comprado pelo(a) contratado(a) está incluído no preço. Qualquer serviço ou material a mais só será feito com a concordância do(a) contratante, de preferência por escrito (inclusive por mensagem).\n\nCláusula 5ª. ${f.garantia.trim() ? `Garantia do serviço: ${f.garantia.trim()}.` : "A garantia do serviço será combinada entre as partes."} O Código de Defesa do Consumidor continua valendo quando for o caso.\n\nCláusula 6ª. Atraso no pagamento tem multa de ${n(f.multa)}% sobre o valor atrasado. Se uma das partes desistir, avisará a outra e pagarão o que já foi feito e comprado.\n\n${f.cidade.trim() || "Cidade"}, ${dataLonga(f.data)}.\n\n\n______________________________\n${f.prestador.trim() || "Contratado(a)"}\n\n\n______________________________\n${f.cliente.trim() || "Contratante"}\n\n\nTestemunha 1: ______________________\nTestemunha 2: ______________________\n\nModelo informativo, não substitui orientação jurídica.`;
}

export function OrcamentoEContrato() {
  const [f, setF, apagar] = usePersistente("orcamento-e-contrato", ORCAMENTO_INICIAL);
  const [qual, setQual] = useState<"orcamento" | "contrato">("orcamento");
  const mudar = (k: keyof typeof ORCAMENTO_INICIAL, v: string) => setF({ ...f, [k]: v });
  const item = (i: number, k: keyof Item, v: string) => setF({ ...f, itens: f.itens.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const total = f.itens.reduce((s, i) => s + n(i.q || "1") * n(i.v), 0);
  return (
    <div>
      <Aviso>Modelo informativo, não substitui orientação jurídica. Para valores altos, procure a Defensoria Pública ou um advogado.</Aviso>
      <Bancada titulo="Orçamento e contrato simples" subtitulo="Itens, material, mão de obra, prazo e pagamento">
        <div className="grid gap-3 sm:grid-cols-2">
          <Entrada rotulo="Seu nome (quem faz o serviço)" valor={f.prestador} mudar={(v) => mudar("prestador", v)} />
          <Entrada rotulo="Nome do cliente" valor={f.cliente} mudar={(v) => mudar("cliente", v)} />
          <Entrada rotulo="Serviço" valor={f.servico} mudar={(v) => mudar("servico", v)} dica="ex.: pintura da sala e do quarto" max={200} />
          <Entrada rotulo="Onde será feito" valor={f.local} mudar={(v) => mudar("local", v)} dica="bairro ou ponto de referência" max={200} />
        </div>
        <div className="mt-4 text-sm">
          <p className="font-semibold">Itens</p>
          {f.itens.map((i, idx) => (
            <div key={idx} className="mt-1.5 grid grid-cols-[1fr_6.5rem_3.5rem_6rem_auto] items-end gap-1.5">
              <input aria-label={`Descrição do item ${idx + 1}`} value={i.d} onChange={(e) => item(idx, "d", e.target.value.slice(0, 80))} placeholder="Descrição" className={campo} />
              <select aria-label={`Tipo do item ${idx + 1}`} value={i.t} onChange={(e) => item(idx, "t", e.target.value)} className={campo}><option value="mao">Mão de obra</option><option value="material">Material</option></select>
              <input aria-label={`Quantidade do item ${idx + 1}`} value={i.q} onChange={(e) => item(idx, "q", e.target.value.slice(0, 6))} inputMode="decimal" placeholder="Qtd" className={campo} />
              <input aria-label={`Valor de cada unidade do item ${idx + 1}`} value={i.v} onChange={(e) => item(idx, "v", e.target.value.slice(0, 10))} inputMode="decimal" placeholder="R$" className={campo} />
              <button type="button" aria-label={`Tirar o item ${idx + 1}`} onClick={() => setF({ ...f, itens: f.itens.filter((_, j) => j !== idx) })} className="mb-0.5 cursor-pointer border-2 border-ink/40 px-2 py-1 text-xs font-semibold">Tirar</button>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-3"><BotaoClaro onClick={() => f.itens.length < 30 && setF({ ...f, itens: [...f.itens, { d: "", t: "mao", q: "1", v: "" }] })}>Pôr mais um item</BotaoClaro><span className="font-mono">Total: {real(total)}</span></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Entrada rotulo="Prazo" valor={f.prazo} mudar={(v) => mudar("prazo", v)} dica="ex.: 5 dias úteis, a partir de 10/12" />
          <Entrada rotulo="Forma de pagamento" valor={f.pagamento} mudar={(v) => mudar("pagamento", v)} max={200} />
          <Entrada rotulo="Garantia do serviço" valor={f.garantia} mudar={(v) => mudar("garantia", v)} dica="ex.: 90 dias para defeitos do serviço" max={200} />
          <Entrada rotulo="Validade do orçamento (dias)" valor={f.validade} mudar={(v) => mudar("validade", v)} modo="numeric" max={3} />
          <Entrada rotulo="Multa por atraso no pagamento (%)" valor={f.multa} mudar={(v) => mudar("multa", v)} modo="decimal" max={4} />
          <Entrada rotulo="Cidade" valor={f.cidade} mudar={(v) => mudar("cidade", v)} />
          <Entrada rotulo="Data" valor={f.data} mudar={(v) => mudar("data", v)} tipo="date" />
        </div>
        <div className="mt-4"><Escolha rotulo="Texto para imprimir" valor={qual} opcoes={[["orcamento", "Orçamento"], ["contrato", "Contrato simples"]]} mudar={setQual} /></div>
        <Folha texto={qual === "orcamento" ? montarOrcamento(f) : montarContrato(f)} aviso="Modelo informativo, não substitui orientação jurídica. Imprima em duas vias e assine as duas; guarde uma." />
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Ponha o serviço e cada item, separando material e mão de obra.", "Combine prazo, pagamento e garantia e escreva aqui, para não ter dúvida depois.", "Mande o orçamento; se o cliente aceitar, imprima o contrato em duas vias e assinem."]}
        atividades={["Faça o orçamento de um serviço que você já fez: o preço cobrava a sua hora? (veja \"Quanto cobrar\")", "Escreva a garantia em uma frase que o cliente entenda sem advogado.", "O cliente pediu um serviço a mais no meio da obra: como você registraria isso por mensagem?"]}
        revisao
      />
    </div>
  );
}

/* ───────────────────────────── 4. Dívida e renegociação ───────────────────────────── */

export function quitarDivida(saldo: number, juros: number, parcela: number): { meses: number; total: number } | null {
  if (!(saldo > 0) || !(parcela > 0) || juros < 0) return null;
  if (parcela <= saldo * juros) return null; // a parcela nem paga os juros: a dívida só cresce
  let s = saldo; let total = 0; let meses = 0;
  while (s > 0.005 && meses < 1200) {
    s += s * juros;
    const paga = Math.min(parcela, s);
    total += paga; s -= paga; meses++;
  }
  return meses >= 1200 ? null : { meses, total };
}

/** A taxa mensal escondida numa proposta: a que faz as parcelas valerem o saldo, depois da entrada (busca por bisseção). */
export function taxaDaProposta(saldo: number, entrada: number, parcela: number, vezes: number): number {
  const devido = saldo - entrada;
  if (!(devido > 0) || !(parcela > 0) || !(vezes >= 1)) return NaN;
  if (parcela * vezes <= devido) return 0;
  const valor = (i: number) => (i === 0 ? parcela * vezes : (parcela * (1 - (1 + i) ** -vezes)) / i);
  let lo = 0; let hi = 5;
  for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (valor(mid) > devido) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

const DIVIDA_INICIAL = { saldo: "5000", juros: "8", parcela: "300", propEntrada: "0", propParcela: "200", propVezes: "24" };
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% ao mês` : "—");
const tempo = (m: number) => { const a = Math.floor(m / 12); const r = m % 12; return `${a ? `${a} ${a === 1 ? "ano" : "anos"}` : ""}${a && r ? " e " : ""}${r || !a ? `${r} ${r === 1 ? "mês" : "meses"}` : ""}`; };

export function SimuladorDeDivida() {
  const [f, setF, apagar] = usePersistente("dividas", DIVIDA_INICIAL);
  const mudar = (k: keyof typeof DIVIDA_INICIAL, v: string) => setF({ ...f, [k]: v });
  const saldo = n(f.saldo);
  const i = n(f.juros) / 100;
  const atual = quitarDivida(saldo, i, n(f.parcela));
  const entrada = n(f.propEntrada);
  const vezes = Math.round(n(f.propVezes));
  const totalProposta = entrada + n(f.propParcela) * vezes;
  const taxa = taxaDaProposta(saldo, entrada, n(f.propParcela), vezes);
  const diferenca = atual ? atual.total - totalProposta : NaN;
  return (
    <div>
      <Aviso>Não substitui a orientação do Procon, da Defensoria Pública ou de um advogado. A conta é uma estimativa: juros, taxas e seguros de cada contrato podem mudar o valor real; peça sempre o contrato e o extrato.</Aviso>
      <Bancada titulo="Dívida e renegociação" subtitulo="Quanto tempo e quanto você paga no total, e se a proposta vale a pena">
        <div className="grid gap-3 sm:grid-cols-3">
          <Entrada rotulo="Saldo devedor hoje (R$)" valor={f.saldo} mudar={(v) => mudar("saldo", v)} modo="decimal" max={12} />
          <Entrada rotulo="Juros ao mês (%)" valor={f.juros} mudar={(v) => mudar("juros", v)} modo="decimal" max={6} />
          <Entrada rotulo="Parcela que você paga por mês (R$)" valor={f.parcela} mudar={(v) => mudar("parcela", v)} modo="decimal" max={12} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {atual ? (<><Leitura rotulo="Tempo para quitar" valor={tempo(atual.meses)} /><Leitura rotulo="Total que você paga" valor={real(atual.total)} destaque /><Leitura rotulo="Só de juros" valor={real(atual.total - saldo)} /></>) : <p className="text-sm font-semibold text-oxblood sm:col-span-3">Com essa parcela a dívida não acaba: ela não cobre nem os juros do mês ({real(saldo * i)}). Procure renegociar.</p>}
        </div>
        <h3 className="mt-5 font-serif text-lg font-semibold">Proposta de renegociação</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Entrada rotulo="Entrada (R$)" valor={f.propEntrada} mudar={(v) => mudar("propEntrada", v)} modo="decimal" max={12} />
          <Entrada rotulo="Valor de cada parcela (R$)" valor={f.propParcela} mudar={(v) => mudar("propParcela", v)} modo="decimal" max={12} />
          <Entrada rotulo="Número de parcelas" valor={f.propVezes} mudar={(v) => mudar("propVezes", v)} modo="numeric" max={3} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Leitura rotulo="Total da proposta" valor={real(totalProposta)} destaque />
          <Leitura rotulo="Juros da proposta" valor={pct(taxa)} />
          <Leitura rotulo={Number.isFinite(diferenca) && diferenca < 0 ? "Você pagaria a mais" : "Você economiza"} valor={Number.isFinite(diferenca) ? real(Math.abs(diferenca)) : "—"} />
        </div>
        <p className="mt-2 text-xs">Se a proposta cobra juros maiores do que o contrato antigo, desconfie. Compare sempre o total, não só a parcela. Quitar antes da data dá direito a abatimento proporcional dos juros (CDC, art. 52, § 2º).</p>
        <div className="mt-4 border-2 border-ink/30 bg-parchment p-3 text-sm">
          <h3 className="font-semibold">A Lei do Superendividamento (Lei 14.181/2021)</h3>
          <p className="mt-1">A lei mudou o Código de Defesa do Consumidor para proteger a pessoa que, de boa-fé, não consegue pagar todas as dívidas de consumo sem comprometer o básico. Ela garante o &quot;mínimo existencial&quot;: a renda de que você precisa para comer, pagar luz, água e remédio não pode ser levada pelas parcelas. Dá direito à conciliação com todos os credores de uma vez, com plano de pagamento de até cinco anos (CDC, art. 104-A). Obriga o credor a informar o custo total antes do contrato e proíbe propaganda que esconda os juros ou assedie o idoso. O valor do mínimo existencial é fixado por decreto federal e muda; confira o valor em vigor.</p>
          <p className="mt-2 font-semibold">Onde pedir ajuda, sem pagar:</p>
          <ul className="mt-1 list-disc pl-5"><li>Procon da sua cidade ou do estado: audiência de conciliação com os credores.</li><li>Defensoria Pública: orienta e, se precisar, entra na Justiça por você, de graça.</li><li>consumidor.gov.br: reclamação direta à empresa, pelo site do governo.</li></ul>
          <p className="mt-2 text-xs">Antes de assinar qualquer acordo, peça tudo por escrito. Desconfie de quem cobra para &quot;limpar o nome&quot; adiantado.</p>
        </div>
        <Apagar onClick={apagar} />
      </Bancada>
      <ComoUsar
        passos={["Ponha o saldo, os juros do contrato e a parcela que você paga.", "Veja quanto tempo leva e quanto pagará no total.", "Ponha a proposta do banco ou da loja e compare o total e os juros dela."]}
        atividades={["Dobre a parcela: quanto tempo e quanto de juros você economiza?", "Ponha uma parcela menor que os juros do mês: o que acontece com a dívida?", "Liste as dívidas que você tem hoje e o que sobra da renda depois delas: isso é o seu mínimo existencial em jogo."]}
        revisao
      />
    </div>
  );
}

/* ───────────────────────────── 5. Modelos de documentos ───────────────────────────── */

type Modelo = "procon" | "demissao" | "inss" | "locador";
interface Campo { k: string; rotulo: string; area?: boolean; tipo?: string; dica?: string }

const MODELOS: Record<Modelo, { nome: string; campos: Campo[]; gerar: (v: Record<string, string>) => string }> = {
  procon: {
    nome: "Reclamação ao Procon",
    campos: [
      { k: "nome", rotulo: "Seu nome" }, { k: "contato", rotulo: "Telefone ou e-mail", dica: "para o Procon responder" }, { k: "cidade", rotulo: "Cidade e estado" }, { k: "data", rotulo: "Data", tipo: "date" },
      { k: "empresa", rotulo: "Empresa reclamada" }, { k: "produto", rotulo: "Produto ou serviço" }, { k: "dataCompra", rotulo: "Data da compra ou do contrato", tipo: "date" }, { k: "valor", rotulo: "Valor pago (R$)" },
      { k: "fato", rotulo: "O que aconteceu", area: true }, { k: "tentou", rotulo: "O que você já tentou (protocolos, datas)", area: true }, { k: "pedido", rotulo: "O que você quer", area: true, dica: "ex.: o conserto, a troca ou o dinheiro de volta" },
    ],
    gerar: (v) => `AO PROCON DE ${v.cidade || "__________"}\n\nReclamação de consumidor\n\nEu, ${v.nome || "__________"}, contato: ${v.contato || "__________"}, venho reclamar da empresa ${v.empresa || "__________"}.\n\n1. O que comprei: ${v.produto || "__________"}, em ${dataLonga(v.dataCompra)}, pelo valor de R$ ${v.valor || "__________"}.\n\n2. O que aconteceu: ${v.fato || "__________"}\n\n3. O que já tentei para resolver: ${v.tentou || "__________"}\n\n4. O que peço: ${v.pedido || "__________"}\n\nO Código de Defesa do Consumidor (Lei 8.078/1990) garante a reparação, a troca ou a devolução do valor quando o produto ou o serviço tem defeito ou não é entregue como combinado (arts. 18 a 20). Peço a abertura de uma reclamação e a marcação de audiência de conciliação com a empresa.\n\nAnexo: notas, contratos, protocolos e conversas que provam o que escrevi.\n\n${v.cidade || "Cidade"}, ${dataLonga(v.data)}.\n\n______________________________\n${v.nome || "Seu nome"}`,
  },
  demissao: {
    nome: "Pedido de demissão",
    campos: [
      { k: "nome", rotulo: "Seu nome" }, { k: "cargo", rotulo: "Seu cargo" }, { k: "empresa", rotulo: "Nome da empresa" }, { k: "cidade", rotulo: "Cidade" }, { k: "data", rotulo: "Data da carta", tipo: "date" }, { k: "ultimo", rotulo: "Último dia de trabalho", tipo: "date" },
      { k: "aviso", rotulo: "Aviso prévio (digite: cumprir ou dispensa)", dica: "cumprir ou dispensa" }, { k: "obs", rotulo: "Algo mais que queira escrever (opcional)", area: true },
    ],
    gerar: (v) => `À ${v.empresa || "__________"}\n\nAssunto: Pedido de demissão\n\nEu, ${v.nome || "__________"}, ocupante do cargo de ${v.cargo || "__________"}, comunico que desejo me desligar da empresa por vontade própria.\n\n${/disp/i.test(v.aviso || "") ? "Peço a dispensa do cumprimento do aviso prévio, se a empresa concordar." : `Cumprirei o aviso prévio de 30 dias (CLT, art. 487), sendo meu último dia de trabalho ${dataLonga(v.ultimo)}.`}\n\nSolicito que a empresa faça o pagamento das verbas rescisórias no prazo de 10 dias contados do fim do contrato (CLT, art. 477, § 6º) e me entregue o termo de rescisão e os documentos do desligamento. Peço também que a anotação de saída seja feita na minha carteira de trabalho.\n${v.obs ? `\n${v.obs}\n` : ""}\nAgradeço pelo tempo de trabalho.\n\n${v.cidade || "Cidade"}, ${dataLonga(v.data)}.\n\n______________________________\n${v.nome || "Seu nome"}\n\nCiente da empresa em: ____/____/________   Assinatura: ______________________`,
  },
  inss: {
    nome: "Recurso ao INSS",
    campos: [
      { k: "nome", rotulo: "Seu nome" }, { k: "protocolo", rotulo: "Número do requerimento (protocolo do Meu INSS)", dica: "não é o CPF" }, { k: "beneficio", rotulo: "Benefício pedido", dica: "ex.: auxílio por incapacidade temporária" }, { k: "dataDecisao", rotulo: "Data da decisão do INSS", tipo: "date" },
      { k: "motivo", rotulo: "Motivo que o INSS deu para negar", area: true }, { k: "argumentos", rotulo: "Por que você acha que tem direito", area: true }, { k: "provas", rotulo: "Documentos que você anexa", area: true, dica: "laudos, carteira de trabalho, contribuições" }, { k: "cidade", rotulo: "Cidade" }, { k: "data", rotulo: "Data", tipo: "date" },
    ],
    gerar: (v) => `À JUNTA DE RECURSOS DO CONSELHO DE RECURSOS DA PREVIDÊNCIA SOCIAL (CRPS)\n(por meio da Agência da Previdência Social ou do Meu INSS)\n\nAssunto: Recurso ordinário contra decisão que negou benefício\nRequerimento nº ${v.protocolo || "__________"}\n\nEu, ${v.nome || "__________"}, não concordo com a decisão do INSS de ${dataLonga(v.dataDecisao)}, que negou o benefício: ${v.beneficio || "__________"}, e apresento este recurso dentro do prazo de 30 dias.\n\nMotivo da negativa informado pelo INSS:\n${v.motivo || "__________"}\n\nPor que tenho direito:\n${v.argumentos || "__________"}\n\nDocumentos que anexo:\n${v.provas || "__________"}\n\nPeço que a decisão seja revista e o benefício concedido, com pagamento desde a data do primeiro pedido. Peço, se necessário, a juntada de novos documentos e a análise de todo o meu histórico de contribuições.\n\n${v.cidade || "Cidade"}, ${dataLonga(v.data)}.\n\n______________________________\n${v.nome || "Seu nome"}\n\nLembrete: o prazo do recurso é de 30 dias, contados da ciência da decisão. Confira o prazo e o passo a passo no Meu INSS (gov.br/inss).`,
  },
  locador: {
    nome: "Notificação ao locador",
    campos: [
      { k: "inquilino", rotulo: "Seu nome (inquilino)" }, { k: "locador", rotulo: "Nome do locador ou da imobiliária" }, { k: "imovel", rotulo: "Imóvel (rua e bairro, só para este documento)" }, { k: "assunto", rotulo: "Assunto", dica: "ex.: vazamento no telhado, devolução da caução" },
      { k: "fato", rotulo: "O que está acontecendo, desde quando", area: true }, { k: "pedido", rotulo: "O que você pede", area: true }, { k: "prazo", rotulo: "Prazo para resposta (dias)", dica: "ex.: 10" }, { k: "cidade", rotulo: "Cidade" }, { k: "data", rotulo: "Data", tipo: "date" },
    ],
    gerar: (v) => `NOTIFICAÇÃO EXTRAJUDICIAL\n\nPara: ${v.locador || "__________"}\nDe: ${v.inquilino || "__________"}\nImóvel: ${v.imovel || "__________"}\nAssunto: ${v.assunto || "__________"}\n\nEu, ${v.inquilino || "__________"}, inquilino(a) do imóvel acima, notifico o(a) senhor(a) do seguinte:\n\n${v.fato || "__________"}\n\nPeço que: ${v.pedido || "__________"}\n\nA Lei do Inquilinato (Lei 8.245/1991, art. 22) obriga o locador a entregar o imóvel em estado de servir ao uso a que se destina e a garantir esse uso durante o contrato. Peço que o assunto seja resolvido no prazo de ${v.prazo || "10"} dias, contados do recebimento desta notificação. Se não houver resposta, buscarei os meus direitos pelos meios legais, como o Juizado Especial Cível ou a Defensoria Pública.\n\n${v.cidade || "Cidade"}, ${dataLonga(v.data)}.\n\n______________________________\n${v.inquilino || "Seu nome"}\n\nRecebido em: ____/____/________   Assinatura: ______________________\n\nDica: envie por um meio que prove a entrega (carta com aviso de recebimento, ou mensagem guardada com data) e fique com uma cópia.`,
  },
};

export function ModelosDeDocumentos() {
  const [modelo, setModelo] = useState<Modelo>("procon");
  // Os documentos têm dados pessoais: não ficam guardados; somem quando a página fecha.
  const [vals, setVals] = useState<Record<Modelo, Record<string, string>>>({ procon: {}, demissao: {}, inss: {}, locador: {} });
  const m = MODELOS[modelo];
  const v = vals[modelo];
  const mudar = (k: string, x: string) => setVals({ ...vals, [modelo]: { ...v, [k]: x.slice(0, 2000) } });
  return (
    <div>
      <Aviso>Modelo informativo, não substitui orientação jurídica. Cada caso tem as suas regras e prazos: na dúvida, procure o sindicato, o Procon, o INSS ou a Defensoria Pública. Estes textos não ficam guardados: somem quando você fecha a página.</Aviso>
      <Bancada titulo="Modelos de documentos" subtitulo="Preencha os campos e leve o texto pronto para copiar ou imprimir">
        <Escolha rotulo="Documento" valor={modelo} opcoes={(Object.keys(MODELOS) as Modelo[]).map((id) => [id, MODELOS[id].nome] as [Modelo, string])} mudar={setModelo} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {m.campos.map((c) => (
            <div key={`${modelo}-${c.k}`} className={c.area ? "sm:col-span-2" : ""}>
              {c.area ? <Texto rotulo={c.rotulo} valor={v[c.k] ?? ""} mudar={(x) => mudar(c.k, x)} dica={c.dica} /> : <Entrada rotulo={c.rotulo} valor={v[c.k] ?? ""} mudar={(x) => mudar(c.k, x)} tipo={c.tipo} dica={c.dica} max={200} />}
            </div>
          ))}
        </div>
        <Folha texto={m.gerar(v)} aviso="Modelo informativo, não substitui orientação jurídica. Confira os dados e guarde uma cópia assinada, com a prova de entrega." />
      </Bancada>
      <ComoUsar
        passos={["Escolha o documento e preencha os campos com o que aconteceu, em frases simples.", "Leia o texto pronto e troque o que não for a sua realidade.", "Copie ou imprima, assine, entregue e guarde uma cópia com a prova da entrega."]}
        atividades={["Escreva a sua reclamação como se contasse a um vizinho; depois cole no campo \"o que aconteceu\".", "Confira se o prazo que o modelo cita ainda vale: pergunte ao Procon, ao INSS ou ao sindicato.", "Troque de modelo e volte: os campos que você escreveu ficam, porque nada some até fechar a página."]}
        revisao
      />
    </div>
  );
}
