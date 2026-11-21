---
titulo: "Transparência"
sobretitulo: "O que o servidor tem, e o que ele entrega"
resumo: "Tudo o que o servidor do Instituto guarda, cada pedido de órgão público e o que foi entregue, os relatórios de auditoria na íntegra, o relatório trimestral de segurança e o canário."
---

A Alumia foi desenhada para o servidor ter o mínimo: as conversas são cifradas nos aparelhos, os pacotes do chat passam por caixas anônimas, e ninguém (nem a coordenação) lê o que é cifrado, vê voto ou puxa lista de pessoas. Estas páginas mostram o que sobra, e o que acontece quando alguém pede.

## As páginas

- [O que o servidor guarda](/transparencia/o-que-o-servidor-guarda): a lista completa, tabela por tabela, tirada do próprio banco. Se uma coluna nova aparece sem entrar na lista, o teste do código falha.
- [Pedidos de órgãos públicos](/transparencia/pedidos): cada pedido (ordem judicial, requisição, ofício), o que pediram e o que foi entregue.
- [Relatório trimestral](/transparencia/trimestral): as falhas de segurança achadas, corrigidas e em aberto; os pedidos do trimestre; o que mudou na lista do que guardamos.
- [Canário](/transparencia/canario): um texto assinado e com data dizendo o que **não** aconteceu. Se ele parar de ser renovado, leia como um aviso.
- [Relatórios de auditoria](/transparencia/relatorios): auditorias externas de segurança, publicadas na íntegra.

## Achou uma falha?

Leia o [SECURITY.md](https://github.com/jojoeumermo/perenidade/blob/master/SECURITY.md): como avisar com o texto cifrado, em quanto tempo respondemos e quando a falha é publicada. A versão curta está em [/.well-known/security.txt](/.well-known/security.txt).

## O código

Todo o código do site, da Alumia e do banco é aberto ([AGPL-3.0](https://github.com/jojoeumermo/perenidade)). A lista do que o servidor guarda é gerada desse código, e o plano de auditorias está em [docs/AUDITORIAS.md](https://github.com/jojoeumermo/perenidade/blob/master/docs/AUDITORIAS.md).
