// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { getClient } from "@/lib/backend";

/**
 * "Esqueci a senha": pede ao serviço de contas (Supabase Auth, resetPasswordForEmail) o link de senha nova. O link volta para a
 * própria tela de entrar com "type=recovery", que já abre a escolha da senha nova (SignIn.tsx). A resposta é sempre a mesma, haja
 * conta ou não, para a tela não revelar quem tem conta. Os textos ficam aqui (seis idiomas, curtos) para não mexer no dicionário
 * da entrada; en, es, fr, ru e zh são rascunho até a revisão.
 */
const TEXTOS: Record<string, { link: string; botao: string; enviado: string; falhou: string }> = {
  pt: { link: "Esqueci a senha", botao: "Enviar o link de senha nova", enviado: "Se existe uma conta com esse e-mail, o link de senha nova já está a caminho. Ele vale por pouco tempo.", falhou: "Não deu para enviar agora. Tente de novo daqui a pouco." },
  en: { link: "Forgot password", botao: "Send the new-password link", enviado: "If an account exists for this e-mail, the new-password link is on its way. It is valid for a short time.", falhou: "We could not send it now. Please try again shortly." },
  es: { link: "Olvidé la contraseña", botao: "Enviar el enlace de contraseña nueva", enviado: "Si existe una cuenta con ese correo, el enlace de contraseña nueva va en camino. Vale poco tiempo.", falhou: "No se pudo enviar ahora. Inténtalo de nuevo en un rato." },
  fr: { link: "Mot de passe oublié", botao: "Envoyer le lien de nouveau mot de passe", enviado: "Si un compte existe pour cet e-mail, le lien est en route. Il est valable peu de temps.", falhou: "Envoi impossible pour le moment. Réessayez dans un instant." },
  ru: { link: "Забыли пароль", botao: "Отправить ссылку для нового пароля", enviado: "Если аккаунт с этим адресом есть, ссылка уже в пути. Она действует недолго.", falhou: "Сейчас отправить не удалось. Попробуйте чуть позже." },
  zh: { link: "忘记密码", botao: "发送重置密码链接", enviado: "如果该邮箱有账号，重置链接已在路上，有效期很短。", falhou: "现在无法发送，请稍后再试。" },
};

export function EsqueciASenha({ lang, email, token, esperandoDesafio, aoUsarDesafio }: { lang: string; email: string; token: string; esperandoDesafio: boolean; aoUsarDesafio: () => void }) {
  const x = TEXTOS[lang] ?? TEXTOS.pt;
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "falhou">("parado");

  if (!aberto) {
    return (
      <p>
        <button type="button" className="cursor-pointer font-medium underline hover:text-oxblood" onClick={() => setAberto(true)}>
          {x.link}
        </button>
      </p>
    );
  }
  async function enviar() {
    setEstado("enviando");
    try {
      const supabase = await getClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/${lang}/entrar`, captchaToken: token || undefined });
      if (error && (error.code === "captcha_failed" || (error.status !== 400 && error.status !== 422))) throw error;
      // Conta inexistente ou e-mail inválido voltam como sucesso: a tela não diz quem tem conta.
      setEstado("enviado");
    } catch {
      setEstado("falhou");
    } finally {
      aoUsarDesafio();
    }
  }
  return (
    <div className="space-y-2 border-l-2 border-ink pl-3">
      <button
        type="button"
        disabled={estado === "enviando" || !email.includes("@") || esperandoDesafio}
        onClick={() => void enviar()}
        className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50"
      >
        {x.botao}
      </button>
      {estado === "enviado" && <p role="status">{x.enviado}</p>}
      {estado === "falhou" && <p role="alert" className="text-oxblood">{x.falhou}</p>}
    </div>
  );
}
