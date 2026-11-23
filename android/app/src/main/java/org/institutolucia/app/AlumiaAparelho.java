// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.view.accessibility.AccessibilityManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * A checagem do aparelho (Prompt 4, item 110; interface e avaliação em lib/rede/conta/aparelho.ts). Só LÊ o que o próprio Android
 * diz a qualquer app, sem permissão nova: a versão do sistema, a data da última atualização de segurança, se há bloqueio de tela
 * (senha, PIN, padrão ou digital) e os nomes dos apps com permissão de acessibilidade ligada (que podem ler a tela). Nada sai do
 * aparelho: a resposta vai só para a tela da casca, que mostra os avisos. Nenhum dado de outro app além do nome visível.
 */
@CapacitorPlugin(name = "AlumiaAparelho")
public class AlumiaAparelho extends Plugin {

    /** No máximo 20 nomes, cada um com até 60 letras (só para mostrar na tela). */
    private static final int MAX_APPS = 20;
    private static final int MAX_NOME = 60;

    @PluginMethod
    public void checar(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("patch", Build.VERSION.SECURITY_PATCH == null ? "" : Build.VERSION.SECURITY_PATCH);
        KeyguardManager km = (KeyguardManager) ctx.getSystemService(Context.KEYGUARD_SERVICE);
        r.put("bloqueio", km != null && km.isDeviceSecure());
        JSArray nomes = new JSArray();
        AccessibilityManager am = (AccessibilityManager) ctx.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am != null) {
            List<AccessibilityServiceInfo> lista = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
            PackageManager pm = ctx.getPackageManager();
            for (AccessibilityServiceInfo s : lista) {
                if (nomes.length() >= MAX_APPS) break;
                String nome;
                try {
                    nome = String.valueOf(s.getResolveInfo().loadLabel(pm));
                } catch (Exception e) {
                    nome = "?";
                }
                nomes.put(nome.length() > MAX_NOME ? nome.substring(0, MAX_NOME) : nome);
            }
        }
        r.put("acessibilidade", nomes);
        call.resolve(r);
    }
}
