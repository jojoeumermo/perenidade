// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import textos from "@/i18n/estudo/pt.json";
import { carregarVLibras, lembrarVLibras, vlibrasCarregado, vlibrasLembrado } from "@/lib/vlibras";

// A parte do VLibras no painel de acessibilidade (recurso "vlibras"). Este arquivo só é baixado quando o painel abre
// com o recurso ligado. Os textos vêm do português: o painel de acessibilidade não recebe o dicionário dos recursos novos.
const s = textos.vlibras;

type Estado = "desligado" | "confirmando" | "carregando" | "ligado" | "erro";

export default function AtivarVLibras() {
  const [estado, setEstado] = useState<Estado>(() => (vlibrasCarregado() ? "ligado" : "desligado"));
  const [lembrar, setLembrar] = useState(false);
  const [lembrado, setLembrado] = useState(vlibrasLembrado);

  function ativar() {
    setEstado("carregando");
    if (lembrar) {
      lembrarVLibras(true);
      setLembrado(true);
    }
    carregarVLibras().then(
      () => setEstado("ligado"),
      () => setEstado("erro"),
    );
  }

  return (
    <div>
      <p className="font-semibold">{s.titulo}</p>
      <p className="text-xs text-ink-soft">{s.dica}</p>
      {estado === "desligado" && (
        <button type="button" onClick={() => setEstado("confirmando")} className="mt-2 cursor-pointer border-2 border-ink px-4 py-2 font-medium hover:border-oxblood hover:text-oxblood">
          {s.ativar}
        </button>
      )}
      {estado === "confirmando" && (
        <div className="mt-2 border-l-4 border-gold pl-3">
          <p className="text-xs">{s.aviso}</p>
          <label className="mt-2 flex items-start gap-2 text-xs">
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} className="mt-0.5" />
            <span>{s.lembrar}</span>
          </label>
          <p className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={ativar} className="cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood">
              {s.confirmar}
            </button>
            <button type="button" onClick={() => setEstado("desligado")} className="cursor-pointer underline hover:text-oxblood">
              {s.cancelar}
            </button>
          </p>
        </div>
      )}
      <p role="status" className="mt-2 text-xs">
        {estado === "carregando" ? s.carregando : estado === "ligado" ? s.ligado : estado === "erro" ? s.erro : ""}
      </p>
      {lembrado && (
        <button
          type="button"
          className="cursor-pointer text-xs underline hover:text-oxblood"
          onClick={() => {
            lembrarVLibras(false);
            setLembrado(false);
          }}
        >
          {s.esquecer}
        </button>
      )}
    </div>
  );
}
