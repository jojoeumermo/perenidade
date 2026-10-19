// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { URL_KALI } from "@/lib/estudio";
import { useI18n } from "../I18n";

interface Desafio {
  id: string;
  tipo: "phishing" | "log" | "senha";
  titulo: string;
  texto: string;
  pergunta: string;
  opcoes: string[];
  certa: number;
  explicacao: string;
  defesa: string;
}

const DESAFIOS: Desafio[] = [
  { id: "ph-1", tipo: "phishing", titulo: "O e-mail do banco", texto: "De: Banco Seguro <seguranca@banco-seguro-atendimento.com>\nAssunto: URGENTE: sua conta será bloqueada em 24h\n\nPrezado cliente, detectamos atividade suspeita. Para evitar o bloqueio, confirme seus dados em http://banco-seguro.verificar-conta.ru/login dentro de 24 horas.", pergunta: "O que denuncia o golpe?", opcoes: ["O assunto em maiúsculas", "O domínio do link não é o do banco e termina em .ru", "Bancos nunca mandam e-mail", "Nada: o e-mail é legítimo"], certa: 1, explicacao: "O link aponta para verificar-conta.ru: um domínio que não pertence ao banco. Urgência e ameaça de bloqueio são o gatilho clássico.", defesa: "Nunca clique: abra o site do banco digitando o endereço ou pelo aplicativo. Passe o mouse sobre o link para ver o destino real. Ative o segundo fator." },
  { id: "ph-2", tipo: "phishing", titulo: "O chefe com pressa", texto: "De: Jonathan Santos <jonathan.santos@gmai1.com>\nAssunto: preciso de um favor rápido\n\nOi, estou numa reunião e não posso falar. Compra 5 gift cards de R$ 200 e me manda os códigos por aqui. Depois acerto com você. Urgente!", pergunta: "Qual é o sinal mais forte de golpe?", opcoes: ["O remetente usa gmai1 (com o número 1) em vez de gmail", "Chefes não pedem favores", "Gift cards são ilegais", "A reunião"], certa: 0, explicacao: "Troca de letras parecidas no domínio (gmai1 ≠ gmail) é o truque. O roteiro “não posso falar, é urgente, me manda códigos” é o golpe do falso chefe.", defesa: "Confirme por outro canal (ligue, chame no chat oficial). Nenhum pedido legítimo exige sigilo e gift cards." },
  { id: "ph-3", tipo: "phishing", titulo: "A entrega parada", texto: "SMS: Sua encomenda esta retida na alfandega. Pague a taxa de R$ 3,47 para liberar: bit.ly/3xK9a2", pergunta: "Por que a taxa pequena é parte do golpe?", opcoes: ["Porque taxas de verdade são maiores", "Porque o valor baixo faz a pessoa pagar sem pensar e entregar o cartão", "Não é golpe", "Porque os Correios não usam SMS"], certa: 1, explicacao: "O valor baixo derruba a desconfiança; o que o golpista quer é o número do cartão na página falsa. Link encurtado esconde o destino.", defesa: "Rastreie a encomenda só pelo site ou app oficial. Nunca pague por link de SMS." },
  { id: "log-1", tipo: "log", titulo: "Tentativas de login", texto: "01:12:03 login falhou usuario=admin ip=203.0.113.7\n01:12:04 login falhou usuario=admin ip=203.0.113.7\n01:12:05 login falhou usuario=admin ip=203.0.113.7\n01:12:06 login falhou usuario=root ip=203.0.113.7\n01:12:07 login falhou usuario=aluno ip=203.0.113.7\n09:30:11 login ok usuario=maria ip=198.51.100.4", pergunta: "O que o log mostra?", opcoes: ["Uma pessoa que esqueceu a senha", "Um ataque de força bruta: muitas tentativas por segundo, de um mesmo IP, em várias contas", "Um erro do servidor", "Nada de anormal"], certa: 1, explicacao: "Cinco falhas em cinco segundos, do mesmo IP, trocando de usuário: é automação tentando adivinhar senhas.", defesa: "Limite de tentativas e bloqueio temporário por IP, segundo fator, senhas longas e alerta para a equipe." },
  { id: "log-2", tipo: "log", titulo: "O caminho estranho", texto: "GET /aula/fracoes 200\nGET /acervo?busca=marx 200\nGET /index.php?page=../../../../etc/passwd 404\nGET /wp-login.php 404\nGET /.env 404", pergunta: "O que as três últimas linhas são?", opcoes: ["Visitantes perdidos", "Um robô procurando falhas conhecidas (path traversal, WordPress, arquivo .env)", "Um bug do site", "Buscas normais"], certa: 1, explicacao: "../../etc/passwd tenta ler arquivos do sistema; wp-login.php e .env são alvos comuns de varredura automática. O 404 mostra que não existem aqui.", defesa: "Manter tudo atualizado, nunca expor .env, responder 404 seco (como o site faz) e registrar a origem para bloqueio." },
  { id: "senha-1", tipo: "senha", titulo: "Qual senha aguenta?", texto: "Um atacante testa 10 bilhões de senhas por segundo contra o hash vazado de um site.", pergunta: "Qual destas senhas resiste por mais tempo?", opcoes: ["Lucia2026!", "P@ssw0rd", "arroz-feijao-cafe-pao-leite", "123456789"], certa: 2, explicacao: "Uma frase de cinco palavras comuns tem muito mais combinações do que uma palavra com trocas previsíveis (@ por a, 0 por o). Comprimento vale mais do que símbolo.", defesa: "Frases longas, únicas por site, guardadas num gerenciador de senhas; segundo fator sempre que houver." },
  { id: "senha-2", tipo: "senha", titulo: "A mesma senha em todo lugar", texto: "O fórum X vazou 2 milhões de e-mails e senhas. Ana usava a mesma senha no fórum e no e-mail.", pergunta: "Qual é o risco imediato?", opcoes: ["Nenhum: o fórum não era importante", "Credential stuffing: o atacante testa o par e-mail/senha no e-mail, no banco e nas redes", "Só spam", "Perder a conta do fórum"], certa: 1, explicacao: "Pares vazados são testados automaticamente em centenas de serviços. Com o e-mail tomado, o atacante redefine as outras senhas.", defesa: "Uma senha por serviço, troca imediata depois de vazamento (haveibeenpwned.com avisa) e segundo fator no e-mail." },
  { id: "ph-4", tipo: "phishing", titulo: "O painel pede a senha", texto: "Mensagem no chat da equipe: “Oi, sou do suporte do painel. Para migrar sua conta, me manda sua senha e o código do autenticador.”", pergunta: "O que fazer?", opcoes: ["Mandar, é o suporte", "Mandar só o código", "Não mandar nada: ninguém do instituto pede senha nem código; avisar a coordenação", "Pedir o e-mail do suporte e mandar por lá"], certa: 2, explicacao: "Nenhuma equipe legítima pede senha ou código do segundo fator. Quem pede está tentando entrar como você.", defesa: "Regra fixa: senha e código não se compartilham com ninguém. Denuncie pelo canal oficial." },
];

/**
 * O laboratório Kali: um Linux de verdade (emulador v86), com cara de Kali e ferramentas de treino de saída fictícia,
 * aberto dentro da página num quadro de outra origem (o estúdio isolado). Só carrega quando a pessoa pede, porque sobe
 * um sistema inteiro. Nada aqui tem rede nem toca sistema real.
 */
function LaboratorioKali() {
  const { t } = useI18n();
  const s = t.labs;
  const [aberto, setAberto] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);
  if (!URL_KALI) return <p className="mt-6 text-oxblood">{s.segurancaKaliForaDoAr}</p>;
  return (
    <section className="mt-6">
      <p className="border-l-4 border-gold bg-parchment-deep px-4 py-3 font-sans text-sm leading-relaxed">{s.segurancaKaliIntro}</p>
      {!aberto ? (
        <div className="mt-4 border-2 border-ink bg-parchment-deep p-6 text-center font-sans">
          <button type="button" onClick={() => setAberto(true)} className="cursor-pointer bg-oxblood px-6 py-3 text-lg font-semibold text-parchment hover:bg-ink">{s.segurancaKaliAbrir} →</button>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-soft">{s.segurancaKaliAviso}</p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="flex flex-wrap items-center justify-end gap-3 font-sans text-sm">
            <button type="button" onClick={() => void quadro.current?.requestFullscreen?.()} className="cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{s.segurancaKaliTelaCheia}</button>
          </p>
          <iframe
            ref={quadro}
            src={URL_KALI}
            title="Kali"
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="mt-2 block h-[calc(100dvh-9rem)] min-h-[34rem] w-full border-2 border-ink bg-black"
          />
        </div>
      )}
    </section>
  );
}

/** A página do laboratório de segurança: o Kali de treino e, abaixo, os desafios de defesa (reconhecer o ataque). */
export function LabSeguranca() {
  const { t } = useI18n();
  return (
    <div>
      <LaboratorioKali />
      <h2 className="mt-12 border-b border-rule pb-2 font-serif text-2xl font-semibold">{t.labs.segurancaKaliDefesa}</h2>
      <DesafiosDefesa />
    </div>
  );
}

/** Desafios de segurança num ambiente só de treino: reconhecer o ataque e aprender a defesa. Nada aqui ataca sistema nenhum. */
function DesafiosDefesa() {
  const [atual, setAtual] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [acertos, setAcertos] = useState<Record<string, boolean>>({});
  const d = DESAFIOS[atual];
  const tipos = { phishing: "Phishing", log: "Leitura de log", senha: "Senhas" };
  return (
    <div className="mt-6 font-sans text-sm">
      <p className="border-l-4 border-gold bg-parchment-deep px-4 py-3">Ambiente simulado e didático, no espírito do hacking ético: autorização e lei sempre. Aqui você aprende a reconhecer ataques e, para cada um, a defesa. Nada ataca sistemas reais.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <ol className="space-y-1">
          {DESAFIOS.map((x, i) => (
            <li key={x.id}><button type="button" onClick={() => { setAtual(i); setEscolha(null); }} className={`cursor-pointer text-left underline hover:text-oxblood ${i === atual ? "font-semibold" : ""}`}>{i + 1}. {x.titulo} {acertos[x.id] === true && <span className="text-ok">✓</span>}{acertos[x.id] === false && <span className="text-oxblood">✗</span>}</button></li>
          ))}
        </ol>
        <article className="border-2 border-ink bg-parchment-deep p-5">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-gold">{tipos[d.tipo]}</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">{d.titulo}</h2>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap border border-rule bg-parchment p-3 font-mono text-xs">{d.texto}</pre>
          <p className="mt-4 font-semibold">{d.pergunta}</p>
          <ul className="mt-2 space-y-2">
            {d.opcoes.map((o, i) => (
              <li key={i}>
                <button type="button" disabled={escolha !== null} onClick={() => { setEscolha(i); setAcertos((a) => ({ ...a, [d.id]: a[d.id] ?? i === d.certa })); }} className={`w-full cursor-pointer border-2 px-3 py-2 text-left disabled:cursor-default ${escolha === null ? "border-rule hover:border-ink" : i === d.certa ? "border-ok bg-ok/10" : i === escolha ? "border-oxblood bg-oxblood/10" : "border-rule opacity-60"}`}>{o}</button>
              </li>
            ))}
          </ul>
          {escolha !== null && (
            <div className="mt-4 space-y-2">
              <p><strong>{escolha === d.certa ? "Certo." : "Não é essa."}</strong> {d.explicacao}</p>
              <p className="border-l-4 border-oxblood pl-3"><strong>A defesa:</strong> {d.defesa}</p>
              {atual < DESAFIOS.length - 1 && <button type="button" className="cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood" onClick={() => { setAtual(atual + 1); setEscolha(null); }}>Próximo desafio →</button>}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
