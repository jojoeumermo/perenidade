// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Onda R3, item 2.3, no aparelho (emulador): o cofre (Keystore), o disfarce, os caminhos da rede social e o que não abre.
 * Uso: cd android && ./gradlew connectedDebugAndroidTest (scripts/testar-r3-android-aparelho.mjs roda isto e o resto).
 */
@RunWith(AndroidJUnit4.class)
public class CofreNoAparelhoTest {

    private Context ctx() {
        return InstrumentationRegistry.getInstrumentation().getTargetContext();
    }

    @Test
    public void aChaveDoCofreEstaNoKeystoreENaoSeExporta() throws Exception {
        Context c = ctx();
        SecretKey k = AlumiaCofre.chave(c);
        // Não exportável: o Keystore não entrega os bytes da chave.
        assertNull(k.getEncoded());
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        assertTrue(ks.containsAlias(AlumiaCofre.APELIDO));
        KeyInfo info = (KeyInfo) SecretKeyFactory.getInstance(k.getAlgorithm(), "AndroidKeyStore").getKeySpec(k, KeyInfo.class);
        assertEquals(256, info.getKeySize());
        String nivel = AlumiaCofre.nivel(c);
        assertTrue(nivel, Arrays.asList("strongbox", "tee", "software").contains(nivel));
        if (Build.VERSION.SDK_INT >= 31 && c.getPackageManager().hasSystemFeature("android.hardware.strongbox_keystore")) {
            assertEquals(KeyProperties.SECURITY_LEVEL_STRONGBOX, info.getSecurityLevel());
        }
    }

    @Test
    public void embrulhaEDesembrulhaComAFinalidade() throws Exception {
        Context c = ctx();
        byte[] segredo = "chave da loja do chat 32 bytes!!".getBytes(StandardCharsets.UTF_8);
        byte[] e1 = AlumiaCofre.embrulhar(c, "loja/v1", segredo);
        byte[] e2 = AlumiaCofre.embrulhar(c, "loja/v1", segredo);
        assertEquals(12 + segredo.length + 16, e1.length);
        // iv sorteado pelo cofre: dois embrulhos do mesmo segredo nunca saem iguais.
        assertFalse(Arrays.equals(e1, e2));
        assertArrayEquals(segredo, AlumiaCofre.desembrulhar(c, "loja/v1", e1));
        // Ataques: outra finalidade, um bit trocado, cortado.
        assertNull(AlumiaCofre.desembrulhar(c, "trava/v1", e1));
        byte[] mexido = e1.clone();
        mexido[20] ^= 1;
        assertNull(AlumiaCofre.desembrulhar(c, "loja/v1", mexido));
        assertNull(AlumiaCofre.desembrulhar(c, "loja/v1", Arrays.copyOf(e1, 20)));
        assertNull(AlumiaCofre.desembrulhar(c, "loja/v1", null));
    }

    @Test
    public void limiteDasSenhas() {
        assertTrue(AlumiaCofre.limiteValido(0));
        assertTrue(AlumiaCofre.limiteValido(3));
        assertTrue(AlumiaCofre.limiteValido(50));
        assertFalse(AlumiaCofre.limiteValido(1));
        assertFalse(AlumiaCofre.limiteValido(2));
        assertFalse(AlumiaCofre.limiteValido(51));
        assertFalse(AlumiaCofre.limiteValido(-1));
    }

    @Test
    public void disfarceTrocaONomeDaTelaInicial() {
        Context c = ctx();
        try {
            AlumiaApp.aplicarDisfarce(c, "calculadora");
            assertEquals("calculadora", AlumiaApp.disfarceAtual(c));
            AlumiaApp.aplicarDisfarce(c, "notas");
            assertEquals("notas", AlumiaApp.disfarceAtual(c));
            assertFalse(AlumiaApp.disfarceValido("outro"));
            assertFalse(AlumiaApp.disfarceValido(null));
        } finally {
            AlumiaApp.aplicarDisfarce(c, "padrao");
        }
        assertEquals("padrao", AlumiaApp.disfarceAtual(c));
    }

    @Test
    public void caminhosDaRedeSocial() {
        assertTrue(AlumiaApp.caminhoValido("/alumia"));
        assertTrue(AlumiaApp.caminhoValido("/alumia/u/ana?aba=posts"));
        assertFalse(AlumiaApp.caminhoValido("//outro.site/x"));
        assertFalse(AlumiaApp.caminhoValido("/\\outro.site"));
        assertFalse(AlumiaApp.caminhoValido("https://outro.site"));
        assertFalse(AlumiaApp.caminhoValido("javascript:alert(1)"));
        assertFalse(AlumiaApp.caminhoValido("/a b"));
        assertFalse(AlumiaApp.caminhoValido(null));
    }

    @Test
    public void soOInstitutoAbreNaTelaDaRede() {
        Uri base = Uri.parse("https://institutolucia.org");
        assertTrue(RedeActivity.doInstituto(base, Uri.parse("https://institutolucia.org/alumia")));
        assertTrue(RedeActivity.doInstituto(base, Uri.parse("https://alumia.institutolucia.org/x")));
        assertFalse(RedeActivity.doInstituto(base, Uri.parse("https://institutolucia.org.outro.site/x")));
        assertFalse(RedeActivity.doInstituto(base, Uri.parse("https://outroinstitutolucia.org/x")));
        assertFalse(RedeActivity.doInstituto(base, Uri.parse("http://institutolucia.org/x")));
        assertFalse(RedeActivity.doInstituto(base, Uri.parse("https://institutolucia.org:8443/x")));
    }

    @Test
    public void aCascaNaoNavegaParaFora() {
        AlumiaApp app = new AlumiaApp();
        assertNull(app.shouldOverrideLoad(Uri.parse("https://localhost/index.html")));
        assertEquals(Boolean.TRUE, app.shouldOverrideLoad(Uri.parse("https://institutolucia.org/alumia")));
        assertEquals(Boolean.TRUE, app.shouldOverrideLoad(Uri.parse("http://localhost/")));
        assertEquals(Boolean.TRUE, app.shouldOverrideLoad(Uri.parse("intent://x#Intent;end")));
        assertEquals(Boolean.TRUE, app.shouldOverrideLoad(Uri.parse("tel:123")));
        assertNotEquals(null, app.shouldOverrideLoad(Uri.parse("https://localhost.outro.site/")));
    }
}
