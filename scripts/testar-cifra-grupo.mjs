// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os grupos cifrados da rede saíram da ts-mls para o OpenMLS (@wireapp/core-crypto) na R2: a prova do banco e da cifra de ponta a
// ponta está em scripts/testar-r2-grupos-banco.mjs (supabase/migracoes/20261124-r2-grupos.sql) e a do motor, com os ataques, em
// scripts/testar-r2-grupos-motor.mjs. Este nome fica para quem ainda roda `npm run testar:cifra-grupo`.
await import("./testar-r2-grupos-banco.mjs");
