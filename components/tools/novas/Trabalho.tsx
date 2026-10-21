// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { decimoTerceiro, diasDeAviso, ferias, fgtsDoMes, horasExtras, mesesQueContam, multaDoFgts, rescisaoSemJustaCausa } from "@/lib/ferramentas/rodada";
import { Bancada, Escolha, Leitura } from "../../labs/kit";
import { ComoUsar } from "./comum";

const real = (x: number) => (Number.isFinite(x) ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
const n = (x: string) => { const v = Number(String(x).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };

/** Calculadoras de direitos do trabalhador (CLT), com a lei de cada conta. Informativas: não substituem o sindicato. */
export function DireitosDoTrabalhador() {
  const [aba, setAba] = useState<"ferias" | "decimo" | "extras" | "aviso" | "rescisao">("rescisao");
  const [salario, setSalario] = useState("2500");
  const [meses, setMeses] = useState("7");
  const [dias, setDias] = useState("0");
  const [horas, setHoras] = useState("10");
  const [adicional, setAdicional] = useState("50");
  const [divisor, setDivisor] = useState("220");
  const [anos, setAnos] = useState("3");
  const [resc, setResc] = useState({ dias: "12", feriasProp: "5", vencidas: false, meses13: "9", saldo: "7200", indenizado: true });
  const S = n(salario);
  const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5";
  const mesesContam = mesesQueContam(Math.floor(n(meses)), n(dias));
  const r = rescisaoSemJustaCausa({ salario: S, diasTrabalhadosNoMes: Math.min(31, Math.max(0, Math.round(n(resc.dias)))), mesesDeFeriasProporcionais: Math.min(11, Math.round(n(resc.feriasProp))), feriasVencidas: resc.vencidas, mesesDe13: Math.min(12, Math.round(n(resc.meses13))), anosCompletos: Math.round(n(anos)), saldoFgts: n(resc.saldo), avisoIndenizado: resc.indenizado });
  return (
    <div>
      <p role="note" className="mb-4 border-2 border-oxblood bg-parchment-deep px-4 py-3 font-sans text-sm"><strong>Ferramenta informativa, em revisão.</strong> Não substitui o sindicato, um advogado trabalhista ou o Ministério do Trabalho. Os valores são brutos, sem descontos de INSS e Imposto de Renda, e a convenção coletiva da sua categoria pode garantir mais. Nada do que você digita sai do aparelho.</p>
      <Bancada titulo="Direitos do trabalhador" subtitulo="Férias, 13º, horas extras, aviso prévio e rescisão">
        <Escolha rotulo="Conta" valor={aba} opcoes={[["rescisao", "Rescisão sem justa causa"], ["ferias", "Férias"], ["decimo", "13º salário"], ["extras", "Horas extras"], ["aviso", "Aviso prévio e FGTS"]]} mudar={setAba} />
        <label className="mt-4 block max-w-xs text-sm font-semibold">Salário mensal (R$)<input value={salario} onChange={(e) => setSalario(e.target.value.slice(0, 12))} inputMode="decimal" className={campo} /></label>
        {aba === "ferias" && (
          <div className="mt-4 text-sm">
            <div className="grid max-w-md grid-cols-2 gap-2"><label>Meses de trabalho no período (até 12)<input value={meses} onChange={(e) => setMeses(e.target.value)} inputMode="numeric" className={campo} /></label><label>Dias a mais no último mês<input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className={campo} /></label></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Leitura rotulo={`Férias (${mesesContam}/12)`} valor={real(ferias(S, mesesContam).base)} /><Leitura rotulo="Um terço a mais" valor={real(ferias(S, mesesContam).terco)} /><Leitura rotulo="Total" valor={real(ferias(S, mesesContam).total)} destaque /></div>
            <p className="mt-2 text-xs">Lei: CF, art. 7º, XVII (um terço a mais); CLT, art. 130 (30 dias após 12 meses, com redução por faltas) e art. 146, parágrafo único (proporcionais: mais de 14 dias conta como mês). Faltas sem justificativa podem diminuir os dias de férias.</p>
          </div>
        )}
        {aba === "decimo" && (
          <div className="mt-4 text-sm">
            <div className="grid max-w-md grid-cols-2 gap-2"><label>Meses trabalhados no ano<input value={meses} onChange={(e) => setMeses(e.target.value)} inputMode="numeric" className={campo} /></label><label>Dias a mais no último mês<input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className={campo} /></label></div>
            <div className="mt-3 grid max-w-md gap-2 sm:grid-cols-2"><Leitura rotulo={`13º (${mesesContam}/12)`} valor={real(decimoTerceiro(S, mesesContam))} destaque /><Leitura rotulo="1ª parcela (até 30/11)" valor={real(decimoTerceiro(S, mesesContam) / 2)} /></div>
            <p className="mt-2 text-xs">Lei 4.090/1962, art. 1º (1/12 por mês; 15 dias ou mais contam como mês inteiro) e Lei 4.749/1965 (a primeira metade até 30 de novembro, a segunda até 20 de dezembro). A primeira parcela não tem desconto; os descontos entram na segunda.</p>
          </div>
        )}
        {aba === "extras" && (
          <div className="mt-4 text-sm">
            <div className="grid max-w-xl grid-cols-3 gap-2"><label>Horas extras no mês<input value={horas} onChange={(e) => setHoras(e.target.value)} inputMode="decimal" className={campo} /></label><label>Adicional (%)<input value={adicional} onChange={(e) => setAdicional(e.target.value)} inputMode="decimal" className={campo} /></label><label>Divisor de horas<select value={divisor} onChange={(e) => setDivisor(e.target.value)} className={campo}><option value="220">220 (44 h/semana)</option><option value="200">200 (40 h/semana)</option><option value="180">180 (36 h/semana)</option><option value="150">150 (30 h/semana)</option></select></label></div>
            {(() => { const h = horasExtras(S, n(horas), n(adicional) / 100, n(divisor)); return <div className="mt-3 grid gap-2 sm:grid-cols-3"><Leitura rotulo="Valor da hora normal" valor={real(h.valorDaHora)} /><Leitura rotulo="Valor da hora extra" valor={real(h.valorDaHoraExtra)} /><Leitura rotulo="Total das horas extras" valor={real(h.total)} destaque /></div>; })()}
            <p className="mt-2 text-xs">CF, art. 7º, XVI (adicional de pelo menos 50%; aos domingos e feriados costuma ser 100%, conforme a convenção) e CLT, art. 59 (no máximo 2 horas extras por dia). As horas extras habituais também aumentam o descanso semanal remunerado, as férias, o 13º e o FGTS: essa conta depende de cada caso.</p>
          </div>
        )}
        {aba === "aviso" && (
          <div className="mt-4 text-sm">
            <label className="block max-w-xs">Anos completos na empresa<input value={anos} onChange={(e) => setAnos(e.target.value)} inputMode="numeric" className={campo} /></label>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Leitura rotulo="Dias de aviso prévio" valor={`${diasDeAviso(n(anos))} dias`} destaque /><Leitura rotulo="FGTS depositado por mês (8%)" valor={real(fgtsDoMes(S))} /><Leitura rotulo="Multa de 40% sobre R$ 10.000 de saldo" valor={real(multaDoFgts(10000))} /></div>
            <p className="mt-2 text-xs">Aviso prévio: CF, art. 7º, XXI, e Lei 12.506/2011 (30 dias, mais 3 por ano completo, até 90). FGTS: Lei 8.036/1990, art. 15 (8% do salário por mês) e art. 18, § 1º (multa de 40% na dispensa sem justa causa). Confira o saldo no aplicativo oficial do FGTS.</p>
          </div>
        )}
        {aba === "rescisao" && (
          <div className="mt-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <label>Dias trabalhados no último mês<input value={resc.dias} onChange={(e) => setResc({ ...resc, dias: e.target.value })} inputMode="numeric" className={campo} /></label>
              <label>Anos completos na empresa<input value={anos} onChange={(e) => setAnos(e.target.value)} inputMode="numeric" className={campo} /></label>
              <label>Saldo do FGTS (R$)<input value={resc.saldo} onChange={(e) => setResc({ ...resc, saldo: e.target.value })} inputMode="decimal" className={campo} /></label>
              <label>Meses de férias proporcionais (0 a 11)<input value={resc.feriasProp} onChange={(e) => setResc({ ...resc, feriasProp: e.target.value })} inputMode="numeric" className={campo} /></label>
              <label>Meses de 13º no ano (0 a 12)<input value={resc.meses13} onChange={(e) => setResc({ ...resc, meses13: e.target.value })} inputMode="numeric" className={campo} /></label>
              <div className="space-y-1 pt-5">
                <label className="flex items-center gap-2"><input type="checkbox" checked={resc.vencidas} onChange={(e) => setResc({ ...resc, vencidas: e.target.checked })} />Tem férias vencidas</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={resc.indenizado} onChange={(e) => setResc({ ...resc, indenizado: e.target.checked })} />Aviso prévio indenizado</label>
              </div>
            </div>
            <table className="mt-4 w-full max-w-3xl">
              <tbody>
                {r.itens.map((i) => <tr key={i.nome} className="border-t border-rule"><td className="py-1.5 pr-2">{i.nome}<span className="block text-xs text-ink-soft">{i.lei}</span></td><td className="text-right font-mono">{real(i.valor)}</td></tr>)}
                <tr className="border-t-2 border-ink font-semibold"><td className="py-1.5">Total das verbas (bruto)</td><td className="text-right font-mono">{real(r.verbas)}</td></tr>
              </tbody>
            </table>
            <div className="mt-3 grid max-w-3xl gap-2 sm:grid-cols-2"><Leitura rotulo="Multa de 40% do FGTS (paga pela empresa)" valor={real(r.multaFgts)} /><Leitura rotulo="Para sacar do FGTS (saldo + multa)" valor={real(r.saqueFgts)} destaque /></div>
            <p className="mt-2 text-xs">O aviso prévio indenizado conta como tempo de serviço (CLT, art. 487, § 1º): os dias dele podem completar mais um mês de férias e de 13º. O prazo para a empresa pagar é de 10 dias depois do fim do contrato (CLT, art. 477, § 6º). Quem é dispensado sem justa causa pode ter direito ao seguro-desemprego, conforme as regras do programa.</p>
          </div>
        )}
      </Bancada>
      <ComoUsar
        passos={["Escolha a conta e ponha o seu salário.", "Preencha os meses e dias; as dúvidas sobre cada campo estão na lei citada embaixo.", "Leve o resultado para conferir com o sindicato da sua categoria."]}
        atividades={["Calcule o 13º de quem começou a trabalhar em 10 de maio (contando até dezembro). O mês de maio conta?", "Uma pessoa com 5 anos de empresa é dispensada sem justa causa: quantos dias de aviso prévio ela tem? E com 25 anos?", "Compare o que a calculadora mostra com um termo de rescisão de verdade (pode ser um modelo da internet): que verbas aparecem lá e não aqui?"]}
        revisao
      />
    </div>
  );
}
