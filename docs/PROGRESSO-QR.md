# Progresso por QR

Levar o progresso e as anotações de um aparelho a outro, sem conta. Tela: Meus dados (`components/progresso/LevarProgresso.tsx`,
textos nos 6 idiomas em `i18n/progresso-qr/`). Código: `lib/progresso-qr.ts`. Banco: `supabase/migracoes/2026-11-progresso-qr.sql`
(o mesmo bloco está no fim do `supabase/install.sql`). Teste: `npm run testar:progresso-qr`.

## Como funciona

1. O aparelho de origem monta o pacote com as mesmas chaves que a cópia de segurança de Meus dados já leva (`entraNaCopia` e as chaves
   do site, menos a sessão da conta, o nome e a marca do aparelho). O privado da Escola não viaja.
2. O pacote é comprimido (deflate, quando o navegador sabe) e cifrado no aparelho com AES-GCM de 128 bits, chave aleatória e vetor novo
   (WebCrypto, o mesmo desenho do Sigilo da equipe: chave que só o aparelho tem, nada de frase combinada).
3. Se o texto do QR couber em 330 caracteres (QR de versão 14 ou menor, que a câmera lê fácil), o QR leva o próprio pacote cifrado e a
   chave: nenhum servidor participa. Caso contrário, o pacote cifrado vai para `public.progresso_qr_guardar` e o QR leva só o código do
   pacote (10 caracteres) e a chave (26 caracteres). Quem prefere digitar usa os 36 caracteres (grupos de 4).
4. O outro aparelho lê o QR (BarcodeDetector do navegador; sem ele, jsQR por dynamic import) ou o código digitado, busca o pacote
   (`public.progresso_qr_buscar`, que o entrega e o apaga na mesma hora), decifra e JUNTA com o que já tem.

## Regras do banco

- Tabela `interno.progresso_qr` (nenhuma no `public`): código, texto cifrado, criado e vence. Sem endereço, sem quem enviou, sem quando leu.
- Até 400 mil caracteres por pacote, 100 pacotes ao mesmo tempo, 6 pacotes por hora e 30 leituras por 10 minutos por origem.
- O pacote some ao ser lido ou em até 1 dia (limpeza a cada chamada e, havendo `pg_cron`, de hora em hora).
- Ler um código errado, já lido ou vencido dá a mesma resposta (`achou: false`), sem pista.

## Como junta (sem apagar nada)

Listas de textos (aulas concluídas) se unem; cadernos, cartões, erros e caderneta se juntam por id (vence o mais recente); registros por
item (testes, exercícios, datas) e o projeto da Escola se juntam como na cópia de segurança; objetos comuns se juntam chave a chave e o
item que já estava aqui fica; escolhas simples (tema, voz) só entram se aqui ainda não há nada.

## O que fica de fora de propósito

- Pacote maior que 400 mil caracteres cifrados: a tela manda usar a cópia de segurança em arquivo.
- Sem servidor configurado (`sem_servico`) ou sem internet: só o QR com o pacote dentro funciona; a tela avisa.
- Depois do envio por servidor, se a leitura falhar no meio da rede, o pacote já foi apagado: gere outro QR.

## Para quem mantém

- Privacidade: a página `/privacidade` descreve este recurso (parágrafo "Levar o progresso para outro aparelho (por QR)"); mudou o código, confira a página.
- jsQR 1.4.0 (Apache-2.0) está em `docs/NOTICE.md` e `THIRD_PARTY_LICENSES.md`. Nada daqui entra no layout raiz: a tela é um componente de
  cliente da página Meus dados e as bibliotecas de QR vêm por `import()` só quando a pessoa pede.
- Ordem no `install.sql`: este bloco é o último; os testes que comparam o fim do arquivo (`testar-escola-banco`, `testar-vale-o-escrito`,
  `testar-rede-integracao`, `testar-integracao-5689`) já o contam. Quem acrescentar outro bloco depois deve pô-lo na frente da lista deles.
