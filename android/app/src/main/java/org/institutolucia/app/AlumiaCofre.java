// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.security.keystore.StrongBoxUnavailableException;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * O cofre do aparelho (onda R3, item 2.3; interface em lib/rede/casca/android.ts).
 *
 * Uma chave AES-256-GCM NÃO exportável no AndroidKeyStore, criada no StrongBox (chip de segurança separado) quando o aparelho tem,
 * senão no TEE. Ela nunca sai do cofre: o app só pede "embrulhe" e "desembrulhe". O embrulho é iv(12) ‖ cifra ‖ etiqueta(16); o
 * iv é sorteado pelo próprio cofre (KeyStore exige: setRandomizedEncryptionRequired) e a finalidade entra como dado associado (o
 * embrulho de uma finalidade não abre como outra). Criptografia da plataforma, nada feito à mão.
 *
 * A contagem das senhas erradas da trava do app fica aqui (SharedPreferences gravadas com commit(), síncrono): a casca conta a
 * tentativa ANTES de conferir, e desligar o aparelho no meio não perde a conta. O limite é 0 (desligado, o padrão) ou de 3 a 50.
 *
 * apagarTudo: apaga a chave do cofre (o que estava embrulhado vira lixo) e chama clearApplicationUserData(), que apaga TODOS os
 * dados do app (WebView, IndexedDB, OPFS, preferências, arquivos) e encerra o processo.
 */
@CapacitorPlugin(name = "AlumiaCofre")
public class AlumiaCofre extends Plugin {

    static final String APELIDO = "alumia-cofre-v1";
    private static final String LOJA = "AndroidKeyStore";
    private static final String PREFS = "alumia-trava";
    private static final int MAX_FINALIDADE = 64;

    private static boolean finalidadeValida(String f) {
        return f != null && f.length() >= 1 && f.length() <= MAX_FINALIDADE && f.matches("^[a-z0-9][a-z0-9:/._-]*$");
    }

    /** A chave do cofre: a que já existe, ou uma nova (StrongBox quando há; senão TEE). */
    static synchronized SecretKey chave(Context ctx) throws Exception {
        KeyStore ks = KeyStore.getInstance(LOJA);
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(APELIDO, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();
        boolean temStrongBox = Build.VERSION.SDK_INT >= 28 && ctx.getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE);
        if (temStrongBox) {
            try {
                return gerar(true);
            } catch (StrongBoxUnavailableException naoDeu) {
                // segue para o TEE
            }
        }
        return gerar(false);
    }

    private static SecretKey gerar(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(APELIDO, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true);
        if (Build.VERSION.SDK_INT >= 28) {
            b.setIsStrongBoxBacked(strongBox);
            // A chave só serve com o aparelho destravado (Android 9+): com a tela bloqueada, nada desembrulha.
            b.setUnlockedDeviceRequired(true);
        }
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, LOJA);
        g.init(b.build());
        return g.generateKey();
    }

    /** Onde a chave está: "strongbox", "tee" ou "software". */
    static String nivel(Context ctx) {
        try {
            SecretKey k = chave(ctx);
            SecretKeyFactory f = SecretKeyFactory.getInstance(k.getAlgorithm(), LOJA);
            KeyInfo info = (KeyInfo) f.getKeySpec(k, KeyInfo.class);
            if (Build.VERSION.SDK_INT >= 31) {
                int n = info.getSecurityLevel();
                if (n == KeyProperties.SECURITY_LEVEL_STRONGBOX) return "strongbox";
                if (n == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT) return "tee";
                return "software";
            }
            @SuppressWarnings("deprecation")
            boolean dentro = info.isInsideSecureHardware();
            return dentro ? "tee" : "software";
        } catch (Exception e) {
            return "software";
        }
    }

    static byte[] embrulhar(Context ctx, String finalidade, byte[] dados) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, chave(ctx));
        c.updateAAD(finalidade.getBytes(StandardCharsets.UTF_8));
        byte[] iv = c.getIV();
        byte[] cifra = c.doFinal(dados);
        byte[] saida = new byte[iv.length + cifra.length];
        System.arraycopy(iv, 0, saida, 0, iv.length);
        System.arraycopy(cifra, 0, saida, iv.length, cifra.length);
        return saida;
    }

    /** Nulo se o embrulho foi mexido, é de outra finalidade, de outro aparelho ou a chave sumiu. */
    static byte[] desembrulhar(Context ctx, String finalidade, byte[] embrulhado) {
        if (embrulhado == null || embrulhado.length < 12 + 16) return null;
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, chave(ctx), new GCMParameterSpec(128, Arrays.copyOfRange(embrulhado, 0, 12)));
            c.updateAAD(finalidade.getBytes(StandardCharsets.UTF_8));
            return c.doFinal(embrulhado, 12, embrulhado.length - 12);
        } catch (AEADBadTagException mexido) {
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean limiteValido(int n) {
        return n == 0 || (n >= 3 && n <= 50);
    }

    @PluginMethod
    public void embrulhar(PluginCall call) {
        String f = call.getString("finalidade");
        String d = call.getString("dados");
        if (!finalidadeValida(f) || d == null) {
            call.reject("finalidade", "finalidade");
            return;
        }
        try {
            byte[] e = embrulhar(getContext(), f, Base64.decode(d, Base64.NO_WRAP));
            JSObject r = new JSObject();
            r.put("embrulhado", Base64.encodeToString(e, Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("cofre", "cofre");
        }
    }

    @PluginMethod
    public void desembrulhar(PluginCall call) {
        String f = call.getString("finalidade");
        String e = call.getString("embrulhado");
        JSObject r = new JSObject();
        byte[] d = null;
        if (finalidadeValida(f) && e != null) {
            try {
                d = desembrulhar(getContext(), f, Base64.decode(e, Base64.NO_WRAP));
            } catch (IllegalArgumentException base64Torto) {
                d = null;
            }
        }
        r.put("dados", d == null ? JSObject.NULL : Base64.encodeToString(d, Base64.NO_WRAP));
        call.resolve(r);
    }

    @PluginMethod
    public void contarSenhaErrada(PluginCall call) {
        SharedPreferences p = prefs();
        int erros = p.getInt("erros", 0) + 1;
        int limite = p.getInt("limite", 0);
        // commit() e não apply(): a contagem fica no disco ANTES de a casca conferir a senha.
        boolean gravou = p.edit().putInt("erros", erros).commit();
        if (!gravou) {
            call.reject("contagem", "contagem");
            return;
        }
        JSObject r = new JSObject();
        r.put("erros", erros);
        r.put("limite", limiteValido(limite) ? limite : 0);
        call.resolve(r);
    }

    @PluginMethod
    public void zerarSenhas(PluginCall call) {
        prefs().edit().putInt("erros", 0).commit();
        call.resolve();
    }

    @PluginMethod
    public void definirLimite(PluginCall call) {
        Integer n = call.getInt("limite");
        if (n == null || !limiteValido(n)) {
            call.reject("limite", "limite");
            return;
        }
        prefs().edit().putInt("limite", n).commit();
        JSObject r = new JSObject();
        r.put("limite", n);
        call.resolve(r);
    }

    @PluginMethod
    public void estado(PluginCall call) {
        SharedPreferences p = prefs();
        int limite = p.getInt("limite", 0);
        JSObject r = new JSObject();
        r.put("erros", p.getInt("erros", 0));
        r.put("limite", limiteValido(limite) ? limite : 0);
        r.put("nivel", nivel(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void apagarTudo(PluginCall call) {
        apagarTudo(getContext());
        call.resolve();
    }

    /** Apaga a chave do cofre e TODOS os dados do app; o sistema encerra o processo. */
    static void apagarTudo(Context ctx) {
        try {
            KeyStore ks = KeyStore.getInstance(LOJA);
            ks.load(null);
            ks.deleteEntry(APELIDO);
        } catch (Exception e) {
            // segue: os dados saem do mesmo jeito
        }
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) am.clearApplicationUserData();
    }
}
