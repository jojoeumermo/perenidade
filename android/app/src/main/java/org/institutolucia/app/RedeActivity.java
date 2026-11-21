// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
package org.institutolucia.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A rede social FORA da casca do chat (onda R3, item 1.2). Roda em OUTRO processo (":rede", no manifesto), com o diretório de dados
 * do WebView separado (setDataDirectorySuffix): os cookies, o armazenamento e o cache da rede social não se misturam com os do chat.
 * Este WebView NÃO tem ponte nenhuma com o nativo (nenhum addJavascriptInterface, nenhum plugin): uma página remota aqui não alcança
 * o cofre, as notificações nem nada do app. Só o endereço do Instituto abre aqui dentro; qualquer outro pergunta antes e vai para o
 * navegador do aparelho. Sem acesso a arquivos do aparelho.
 */
public class RedeActivity extends Activity {

    static final String CAMINHO = "caminho";
    private WebView web;

    @Override
    protected void onCreate(Bundle salvo) {
        super.onCreate(salvo);
        if (Build.VERSION.SDK_INT >= 28) {
            try {
                WebView.setDataDirectorySuffix("rede");
            } catch (IllegalStateException jaUsado) {
                // o WebView deste processo já foi criado com o sufixo
            }
        }
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        final Uri base = Uri.parse(getString(R.string.alumia_base));
        String caminho = getIntent().getStringExtra(CAMINHO);
        if (!AlumiaApp.caminhoValido(caminho)) caminho = "/alumia";
        web = new WebViewSemAprendizado(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
                Uri u = pedido.getUrl();
                if (doInstituto(base, u)) return false;
                if ("https".equals(u.getScheme())) perguntarAntes(u);
                return true;
            }
        });
        setContentView(web);
        web.loadUrl(base.buildUpon().encodedPath("").build().toString().replaceAll("/$", "") + caminho);
    }

    /** O mesmo esquema do endereço do Instituto, e o mesmo domínio (ou um subdomínio dele). */
    static boolean doInstituto(Uri base, Uri u) {
        if (u == null || u.getHost() == null || base.getHost() == null) return false;
        if (!base.getScheme().equals(u.getScheme())) return false;
        if (base.getPort() != u.getPort()) return false;
        String h = u.getHost().toLowerCase();
        String b = base.getHost().toLowerCase();
        return h.equals(b) || h.endsWith("." + b);
    }

    private void perguntarAntes(Uri u) {
        new AlertDialog.Builder(this)
            .setTitle(R.string.abrir_fora_titulo)
            .setMessage(u.toString())
            .setNegativeButton(R.string.cancelar, null)
            .setPositiveButton(R.string.abrir, (d, w) -> ExternoSeguro.abrir(this, u))
            .show();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        AlumiaApp.tituloDaTarefa(this);
    }

    /**
     * A trava (auditoria interna da R3): a casca do chat trava ao ir para o fundo, mas esta tela fica fora dela. Saindo da frente
     * (outro app, tela desligada, botão de início), ela se FECHA: quem pegar o celular volta para a casca, que pede a senha, e não
     * para a rede social aberta.
     */
    @Override
    protected void onStop() {
        super.onStop();
        if (!isChangingConfigurations()) finish();
    }

    /** O WebView da rede social com o teclado SEM aprendizado (o mesmo pedido de CampoSemAprendizado, sem a ponte do Capacitor). */
    static final class WebViewSemAprendizado extends WebView {
        WebViewSemAprendizado(Context contexto) {
            super(contexto);
        }

        @Override
        public InputConnection onCreateInputConnection(EditorInfo saida) {
            InputConnection ligacao = super.onCreateInputConnection(saida);
            saida.imeOptions |= EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING;
            return ligacao;
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
