---
titulo: "Relatórios de auditoria"
sobretitulo: "Transparência"
resumo: "Auditorias externas de segurança da Alumia e do site, publicadas na íntegra, com o arquivo conferível e a resposta do Instituto a cada achado."
---

Uma auditoria externa é quando uma equipe de fora, especialista em segurança, lê o código e tenta atacar o sistema. O Instituto publica cada relatório **na íntegra**, como foi entregue, com o resumo SHA-256 do arquivo (para você conferir que é o mesmo) e a resposta a cada achado. O que é auditado, em que ordem e quando está no plano: [docs/AUDITORIAS.md](https://github.com/jojoeumermo/perenidade/blob/master/docs/AUDITORIAS.md).

Para conferir um arquivo baixado: `sha256sum relatorio.pdf` (Linux), `shasum -a 256 relatorio.pdf` (macOS) ou `Get-FileHash relatorio.pdf` (Windows), e compare com o resumo da lista.
