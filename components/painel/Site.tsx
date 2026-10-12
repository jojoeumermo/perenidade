// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { KEYS, setItem } from "@/lib/storage";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, textoDoErro, useLista } from "./comum";

export interface Controles {
  faixa: string;
  pausa: boolean;
  motivo: string;
}

/** O que a coordenação muda no site inteiro, na hora, sem publicar nada. */
export function Site() {
  const atual = useLista<Controles>("site");
  const [aviso, setAviso] = useState("");
  if (!atual.dados) return <Aviso texto={atual.erro || "Carregando…"} />;
  // A chave refaz os campos com o que acabou de ser guardado; o aviso mora aqui em cima para não sumir junto.
  return <Formulario key={JSON.stringify(atual.dados)} inicial={atual.dados} recarregar={atual.recarregar} aviso={aviso} setAviso={setAviso} />;
}

function Formulario({ inicial, recarregar, aviso, setAviso }: { inicial: Controles; recarregar: () => void; aviso: string; setAviso: (texto: string) => void }) {
  const { t } = useI18n();
  const [faixa, setFaixa] = useState(inicial.faixa);
  const [motivo, setMotivo] = useState(inicial.motivo);
  const [ocupado, setOcupado] = useState(false);
  const cartao = "border border-rule bg-parchment-deep p-5";

  async function salvar(novo: Controles, sucesso: string) {
    setOcupado(true);
    setAviso("");
    try {
      const guardado = await rpc<Controles>("site_salvar", { p: novo });
      // Este aparelho já mostra a mudança; os outros visitantes passam a ver em poucos minutos.
      setItem(KEYS.site, JSON.stringify({ ...guardado, em: Date.now() }));
      setAviso(sucesso);
      recarregar();
    } catch (erro) {
      setAviso(textoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={cartao}>
        <h2 className="font-serif text-xl font-semibold">Faixa do alto</h2>
        <p className="mt-1 text-ink-soft">A linha escura que aparece no topo de todas as páginas. Serve para um chamado curto: um ato, uma campanha, um aviso. Deixe em branco para voltar ao texto de sempre.</p>
        <label className="mt-3 block">
          Texto da faixa
          <input value={faixa} onChange={(e) => setFaixa(e.target.value)} maxLength={140} placeholder={t.common.strip} className={campo} />
        </label>
        <p className="mt-1 text-right font-mono text-xs text-ink-soft">{faixa.length}/140</p>
        <p className="mt-2 text-xs uppercase tracking-widest text-ink-soft">Como vai aparecer</p>
        <p className="mt-1 bg-ink px-4 py-1.5 text-center font-mono text-xs tracking-wide text-parchment">{faixa.trim() || t.common.strip}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={botao} disabled={ocupado || faixa.trim() === inicial.faixa} onClick={() => salvar({ faixa, pausa: inicial.pausa, motivo: inicial.motivo }, "Faixa trocada.")}>
            Guardar a faixa
          </button>
          {inicial.faixa && (
            <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => salvar({ faixa: "", pausa: inicial.pausa, motivo: inicial.motivo }, "A faixa voltou ao texto de sempre.")}>
              Voltar ao texto de sempre
            </button>
          )}
        </div>
      </section>

      <section className={inicial.pausa ? "border-2 border-oxblood bg-parchment-deep p-5" : cartao}>
        <h2 className="font-serif text-xl font-semibold">Pausa geral de envios</h2>
        <p className="mt-1 text-ink-soft">
          Fecha, na hora, tudo o que o público pode enviar: anúncios do mural, pedidos de reforço, assinaturas do boletim, contribuições e mensagens da comunidade. Ler e estudar continua normal, e a equipe continua trabalhando. É o freio para um ataque de mensagens ou uma manutenção.
        </p>
        <p className="mt-3 font-semibold">{inicial.pausa ? "Os envios estão pausados agora." : "Os envios estão abertos."}</p>
        <label className="mt-3 block">
          Recado para quem visita (opcional)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ex.: Voltamos a receber mensagens amanhã cedo." className={campo} />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          {inicial.pausa ? (
            <>
              <button type="button" className={botao} disabled={ocupado} onClick={() => salvar({ faixa: inicial.faixa, pausa: false, motivo: "" }, "Envios reabertos.")}>
                Reabrir os envios
              </button>
              <button type="button" className={botaoClaro} disabled={ocupado || motivo.trim() === inicial.motivo} onClick={() => salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Recado trocado.")}>
                Trocar o recado
              </button>
            </>
          ) : (
            <button
              type="button"
              className="cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50"
              disabled={ocupado}
              onClick={() => {
                if (window.confirm("Pausar agora tudo o que o público pode enviar?")) void salvar({ faixa: inicial.faixa, pausa: true, motivo }, "Envios pausados.");
              }}
            >
              Pausar os envios
            </button>
          )}
        </div>
      </section>

      <div className="lg:col-span-2">
        <Aviso texto={aviso} />
        <p className="max-w-3xl text-ink-soft">
          As duas mudanças valem na hora no serviço. Quem já está com o site aberto passa a ver a faixa nova em até dez minutos. Tudo o que é mexido aqui fica no registro de atividades.
        </p>
      </div>
    </div>
  );
}
