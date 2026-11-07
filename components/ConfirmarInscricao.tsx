// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O clique no link do e-mail de confirmação (T33): /voluntarios?confirmar=<código>. A inscrição militante só passa a
// existir depois disso (public.inscricao_confirmar), para ninguém inscrever o e-mail de outra pessoa numa organização
// política (LGPD, arts. 8º, § 2º, e 11, I). O endereço da página é neutro de propósito: o e-mail pode ser lido por
// outras pessoas na caixa de quem recebe. Sem o parâmetro, não aparece nada. O código sai do endereço logo depois de lido.
import { useEffect, useState } from "react";
import { BackendError, rpc } from "@/lib/backend";

const TEXTOS: Record<string, { conferindo: string; ok: string; erro: string; falha: string }> = {
  pt: { conferindo: "Conferindo o seu e-mail…", ok: "E-mail confirmado. A sua inscrição chegou à coordenação, que vai responder neste mesmo endereço.", erro: "Este link não vale mais: ele só funciona uma vez e por 3 dias. Se precisar, preencha o formulário de novo.", falha: "Não deu para confirmar agora. Tente abrir o link de novo daqui a pouco." },
  en: { conferindo: "Checking your e-mail…", ok: "E-mail confirmed. Your sign-up has reached the coordination, which will answer at this same address.", erro: "This link is no longer valid: it works only once and for 3 days. If needed, fill in the form again.", falha: "It was not possible to confirm now. Try opening the link again in a moment." },
  es: { conferindo: "Comprobando tu correo…", ok: "Correo confirmado. Tu inscripción llegó a la coordinación, que responderá en esta misma dirección.", erro: "Este enlace ya no vale: funciona una sola vez y durante 3 días. Si hace falta, vuelve a llenar el formulario.", falha: "No se pudo confirmar ahora. Intenta abrir el enlace de nuevo en un rato." },
  fr: { conferindo: "Vérification de votre e-mail…", ok: "E-mail confirmé. Votre inscription est arrivée à la coordination, qui répondra à cette même adresse.", erro: "Ce lien n'est plus valable : il ne marche qu'une fois et pendant 3 jours. Si besoin, remplissez à nouveau le formulaire.", falha: "La confirmation n'a pas pu se faire maintenant. Réessayez d'ouvrir le lien dans un moment." },
  ru: { conferindo: "Проверяем ваш e-mail…", ok: "E-mail подтверждён. Ваша заявка дошла до координации, ответ придёт на этот же адрес.", erro: "Эта ссылка больше не действует: она работает один раз и 3 дня. При необходимости заполните форму снова.", falha: "Сейчас подтвердить не удалось. Попробуйте открыть ссылку ещё раз чуть позже." },
  zh: { conferindo: "正在确认你的电子邮箱…", ok: "邮箱已确认。你的报名已送到协调组，回复会发到这个地址。", erro: "此链接已失效：它只能使用一次，有效期 3 天。如有需要，请重新填写表格。", falha: "现在无法确认。请稍后再打开链接试试。" },
};

export function ConfirmarInscricao({ lang }: { lang: string }) {
  const s = TEXTOS[lang] ?? TEXTOS.pt;
  const [fase, setFase] = useState<"nada" | "conferindo" | "ok" | "erro" | "falha">("nada");

  useEffect(() => {
    const busca = new URLSearchParams(window.location.search);
    const codigo = busca.get("confirmar") ?? "";
    if (!codigo) return;
    // O código não fica no histórico do navegador nem vai adiante em links.
    busca.delete("confirmar");
    window.history.replaceState(null, "", `${window.location.pathname}${busca.size ? `?${busca}` : ""}${window.location.hash}`);
    let vivo = true;
    queueMicrotask(() => vivo && setFase("conferindo"));
    rpc("inscricao_confirmar", { p_codigo: codigo }).then(
      () => vivo && setFase("ok"),
      (erro) => vivo && setFase(erro instanceof BackendError && erro.code === "nao_encontrado" ? "erro" : "falha"),
    );
    return () => {
      vivo = false;
    };
  }, []);

  if (fase === "nada") return null;
  return (
    <p role="status" className={`mx-auto mt-6 max-w-3xl border-l-4 p-4 font-sans text-base ${fase === "ok" ? "border-ok" : fase === "conferindo" ? "border-gold" : "border-oxblood"}`}>
      {s[fase]}
    </p>
  );
}
