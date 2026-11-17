// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A seção "Levar e trazer" dos Ajustes (encaixe secoesDeAjustes, frente 13C): o caminho para /alumia/listas, onde a pessoa baixa a
// lista de quem segue, traz a de outra instância e pega o QR do próprio perfil.
import Link from "@/components/Link";
import type { ContextoDoEncaixe } from "../encaixes";
import { useTextosDoAlcance } from "./usar";
import "./alcance.css";

export default function SecaoNosAjustes({ lang }: ContextoDoEncaixe) {
  const t = useTextosDoAlcance(lang);
  if (!t) return null;
  return (
    <div className="alc">
      {/* Na Segurança, com o texto e o botão dos outros blocos (sg-texto, botão m): a coluna mantém uma hierarquia só. */}
      <p className="sg-texto">{t.ajustes.texto}</p>
      <div className="alc-acoes" style={{ marginTop: 0 }}>
        <Link href={`/${lang}/alumia/listas`} className="al-botao al-botao-contorno al-botao-m">
          {t.ajustes.abrir}
        </Link>
      </div>
    </div>
  );
}
