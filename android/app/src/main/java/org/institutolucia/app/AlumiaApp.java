// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URLDecoder;
import java.util.regex.Pattern;

/**
 * O que é do app e não do cofre (onda R3, itens 1.2 e 2.3; interface em lib/rede/casca/android.ts e casca/app/iniciar.ts):
 *   - disfarce: o nome e o ícone na tela inicial (três activity-alias no manifesto; só um ligado de cada vez);
 *   - notificar: "Nova mensagem", sem remetente nem trecho, escondida na tela bloqueada (VISIBILITY_SECRET no canal e na notificação);
 *   - abrirRede: a rede social numa tela própria (RedeActivity), SEM ponte com o nativo e em outro processo;
 *   - abrirExterno: endereço de fora só depois de uma confirmação NATIVA com o endereço inteiro (a página não consegue pular);
 *   - paraOFundo; os eventos "fundo" e "frente" (a trava automática);
 *   - shouldOverrideLoad: nenhuma navegação sai da casca (https://localhost). O que não é dela é BLOQUEADO, não aberto.
 */
@CapacitorPlugin(name = "AlumiaApp")
public class AlumiaApp extends Plugin {

    static final String[] DISFARCES = { "padrao", "calculadora", "notas" };
    private static final String CANAL = "mensagens";
    private static final int ID_DA_NOTIFICACAO = 1;

    private static String alias(String nome) {
        switch (nome) {
            case "calculadora":
                return "org.institutolucia.app.Calculadora";
            case "notas":
                return "org.institutolucia.app.Notas";
            default:
                return "org.institutolucia.app.Padrao";
        }
    }

    static boolean disfarceValido(String nome) {
        if (nome == null) return false;
        for (String d : DISFARCES) if (d.equals(nome)) return true;
        return false;
    }

    private static final String PREFS = "alumia-app";

    /**
     * Liga o alias escolhido ANTES de desligar os outros (nunca fica sem ícone) e guarda a escolha no disco do app (commit, síncrono).
     * Por quê guardar: o sistema grava o estado dos componentes com atraso; reiniciar o aparelho logo depois de trocar o nome fazia o
     * disfarce voltar para "Instituto Lúcia" (achado na prova do emulador). A escolha guardada é reaplicada ao ligar o aparelho
     * (Reaplicar) e a cada abertura do app (MainActivity).
     */
    static void aplicarDisfarce(Context ctx, String nome) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("disfarce", nome).commit();
        ligarAlias(ctx, nome);
    }

    /** Reaplica o disfarce guardado, se o do sistema não for ele. Sem escolha guardada, não mexe. */
    static void reaplicarDisfarce(Context ctx) {
        String nome = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("disfarce", null);
        if (disfarceValido(nome) && !nome.equals(disfarceAtual(ctx))) ligarAlias(ctx, nome);
    }

    private static void ligarAlias(Context ctx, String nome) {
        PackageManager pm = ctx.getPackageManager();
        pm.setComponentEnabledSetting(new ComponentName(ctx, alias(nome)), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String d : DISFARCES) {
            if (d.equals(nome)) continue;
            pm.setComponentEnabledSetting(new ComponentName(ctx, alias(d)), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
        }
    }

    /** O nome que o disfarce mostra. */
    static String nomeDoDisfarce(Context ctx) {
        switch (disfarceAtual(ctx)) {
            case "calculadora":
                return ctx.getString(R.string.nome_calculadora);
            case "notas":
                return ctx.getString(R.string.nome_notas);
            default:
                return ctx.getString(R.string.app_name);
        }
    }

    /**
     * O título da tarefa na troca de apps: o nome do disfarce, não o rótulo da aplicação (que é neutro: res/values/strings.xml,
     * rotulo_do_app). Chamado ao abrir e ao voltar à frente pelas duas telas (MainActivity e RedeActivity).
     */
    @SuppressWarnings("deprecation")
    static void tituloDaTarefa(Activity a) {
        a.setTaskDescription(new ActivityManager.TaskDescription(nomeDoDisfarce(a)));
    }

    static String disfarceAtual(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        for (String d : DISFARCES) {
            int s = pm.getComponentEnabledSetting(new ComponentName(ctx, alias(d)));
            if (s == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return d;
        }
        return "padrao"; // o estado do manifesto
    }

    @PluginMethod
    public void disfarce(PluginCall call) {
        String nome = call.getString("nome");
        if (!disfarceValido(nome)) {
            call.reject("disfarce", "disfarce");
            return;
        }
        aplicarDisfarce(getContext(), nome);
        JSObject r = new JSObject();
        r.put("nome", nome);
        call.resolve(r);
    }

    @PluginMethod
    public void disfarceAtual(PluginCall call) {
        JSObject r = new JSObject();
        r.put("nome", disfarceAtual(getContext()));
        call.resolve(r);
    }

    /** O canal das mensagens: escondido na tela bloqueada, sem selo no ícone. */
    static void criarCanal(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel c = new NotificationChannel(CANAL, ctx.getString(R.string.canal_mensagens), NotificationManager.IMPORTANCE_DEFAULT);
        c.setLockscreenVisibility(NotificationCompat.VISIBILITY_SECRET);
        c.setShowBadge(false);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(c);
    }

    /** "Nova mensagem", sem nada da conversa. Devolve falso se a pessoa não deixou o app notificar. */
    static boolean notificar(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        criarCanal(ctx);
        Intent abrir = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent p = PendingIntent.getActivity(ctx, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(R.drawable.ic_notificacao)
            // Com o disfarce ligado, o título não diz "mensagem" (uma "Calculadora" que avisa mensagem chama atenção).
            .setContentTitle(ctx.getString("padrao".equals(disfarceAtual(ctx)) ? R.string.nova_mensagem : R.string.lembrete_neutro))
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setPublicVersion(null)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(p);
        try {
            NotificationManagerCompat.from(ctx).notify(ID_DA_NOTIFICACAO, b.build());
            return true;
        } catch (SecurityException semPermissao) {
            return false;
        }
    }

    @PluginMethod
    public void notificar(PluginCall call) {
        JSObject r = new JSObject();
        r.put("mostrada", notificar(getContext()));
        call.resolve(r);
    }

    /**
     * As páginas do CHAT do site (a conversa, os aparelhos, o painel com o chat da equipe), com ou sem o idioma na frente. Elas não
     * abrem na RedeActivity: lá, fora da casca, não há trava nem cofre (auditoria interna da R3). O mesmo de caminhoDaRede
     * (lib/rede/casca/plataforma.ts).
     */
    private static final Pattern PAGINA_DO_CHAT =
        Pattern.compile("^/(?:[a-z]{2}(?:-[a-z]{2,4})?/)?(?:alumia/(?:conversas|aparelhos)|painel)(?:[/?#]|$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PONTO_OU_BARRA_DUPLA = Pattern.compile("(^|/)\\.{1,2}(/|$)|//|\\\\");

    /** O caminho da rede social: começa com uma barra, não com duas, sem barra invertida nem espaço; nunca uma página do chat. */
    static boolean caminhoValido(String c) {
        if (c == null || c.length() > 512 || !c.matches("^/(?![/\\\\])[A-Za-z0-9\\-._~%/?=&#]*$")) return false;
        String decodificado;
        try {
            // Conferido já decodificado: um "%63onversas" não passa.
            decodificado = URLDecoder.decode(c.split("[?#]", 2)[0].replace("+", "%2B"), "UTF-8");
        } catch (Exception torto) {
            return false;
        }
        return !PONTO_OU_BARRA_DUPLA.matcher(decodificado).find() && !PAGINA_DO_CHAT.matcher(decodificado).find();
    }

    @PluginMethod
    public void abrirRede(PluginCall call) {
        String caminho = call.getString("caminho");
        if (!caminhoValido(caminho)) {
            call.reject("caminho", "caminho");
            return;
        }
        Intent i = new Intent(getContext(), RedeActivity.class).putExtra(RedeActivity.CAMINHO, caminho);
        getActivity().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void abrirExterno(PluginCall call) {
        String url = call.getString("url");
        Uri u = url == null ? null : Uri.parse(url);
        if (u == null || !"https".equals(u.getScheme()) || u.getHost() == null) {
            call.reject("endereco", "endereco");
            return;
        }
        getActivity().runOnUiThread(() ->
            new AlertDialog.Builder(getActivity())
                .setTitle(R.string.abrir_fora_titulo)
                .setMessage(u.toString())
                .setNegativeButton(R.string.cancelar, (d, w) -> {
                    JSObject r = new JSObject();
                    r.put("aberto", false);
                    call.resolve(r);
                })
                .setPositiveButton(R.string.abrir, (d, w) -> {
                    JSObject r = new JSObject();
                    r.put("aberto", ExternoSeguro.abrir(getActivity(), u));
                    call.resolve(r);
                })
                .setOnCancelListener((d) -> {
                    JSObject r = new JSObject();
                    r.put("aberto", false);
                    call.resolve(r);
                })
                .show()
        );
    }

    @PluginMethod
    public void paraOFundo(PluginCall call) {
        getActivity().moveTaskToBack(true);
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        notifyListeners("fundo", new JSObject());
    }

    @Override
    protected void handleOnResume() {
        tituloDaTarefa(getActivity());
        notifyListeners("frente", new JSObject());
    }

    /** Só a casca (https://localhost) carrega no WebView com a ponte; o resto é bloqueado, sem abrir nada. */
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url != null && "https".equals(url.getScheme()) && "localhost".equals(url.getHost())) return null;
        return true;
    }
}
