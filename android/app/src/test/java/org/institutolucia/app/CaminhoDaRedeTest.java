// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Auditoria interna da R3: as páginas do CHAT do site não abrem na RedeActivity (fora da casca, sem trava e sem o cofre). O mesmo
 * teste de caminhoDaRede (lib/rede/casca/plataforma.ts), no nativo. Uso: cd android && ./gradlew :app:testDebugUnitTest
 */
public class CaminhoDaRedeTest {

    @Test
    public void aRedeSocialAbre() {
        for (String c : new String[] { "/alumia", "/alumia/perfil/bia", "/pt/alumia/p/1?a=b#c", "/alumia/conversas-antigas" }) {
            assertTrue(c, AlumiaApp.caminhoValido(c));
        }
    }

    @Test
    public void ataqueAsPaginasDoChatNaoAbrem() {
        for (String c : new String[] { "/alumia/conversas", "/pt/alumia/conversas?c=1", "/alumia/%63onversas", "/ALUMIA/Conversas",
            "/alumia/aparelhos", "/painel", "/en/painel/equipe", "/pt-br/alumia/conversas/x", "/alumia/./conversas", "/alumia/x/../conversas" }) {
            assertFalse(c, AlumiaApp.caminhoValido(c));
        }
    }

    @Test
    public void ataqueEnderecoDeFora() {
        for (String c : new String[] { "//outro.site/login", "javascript:alert(1)", "/a\\b", "/a b", "/%2F%2Foutro.site", "/%zz", null }) {
            assertFalse(String.valueOf(c), AlumiaApp.caminhoValido(c));
        }
    }
}
