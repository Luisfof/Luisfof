package br.com.moraago.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Invólucro WebView do MORAA GO: carrega a plataforma publicada em BASE_URL. */
public class MainActivity extends Activity {
  static final String BASE_URL = "__BASE_URL__";
  private WebView web;
  private ValueCallback<Uri[]> filePick;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor("#0B1220"));
    setContentView(web);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(true);
    s.setAllowFileAccess(false);
    s.setAllowContentAccess(true);
    s.setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    final String host = Uri.parse(BASE_URL).getHost();

    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if ("https".equals(u.getScheme()) && host != null && host.equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
        return true; // WhatsApp, mapas e outros sites abrem fora do app
      }
      @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
        if (!r.isForMainFrame()) return;
        String html = "<html><meta name=viewport content='width=device-width,initial-scale=1'><body style='margin:0;min-height:100vh;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:28px;background:#0b1220;color:#f6f1e7;font-family:sans-serif'>"
          + "<h1 style='margin:0;font-size:34px;text-transform:uppercase'>Sem <span style='color:#ffc21a'>conex&atilde;o.</span></h1>"
          + "<p style='margin:0;color:#aab0c0'>N&atilde;o foi poss&iacute;vel abrir o MORAA GO. Verifique a internet. Nesta vers&atilde;o de demonstra&ccedil;&atilde;o, o servidor tamb&eacute;m precisa estar ligado.</p>"
          + "<a href='" + BASE_URL + "' style='align-self:flex-start;background:#ffc21a;color:#0b1220;font-weight:800;padding:14px 22px;border-radius:3px;text-decoration:none;text-transform:uppercase'>Tentar de novo</a></body></html>";
        v.loadDataWithBaseURL(BASE_URL, html, "text/html", "utf-8", null);
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
        if (filePick != null) filePick.onReceiveValue(null);
        filePick = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("image/*");
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try { startActivityForResult(Intent.createChooser(i, "Escolher fotos"), 7); }
        catch (Exception e) { filePick = null; return false; }
        return true;
      }
    });
    if (b != null) web.restoreState(b); else web.loadUrl(BASE_URL + "/?origem=apk");
  }

  @Override protected void onActivityResult(int req, int res, Intent data) {
    if (req != 7 || filePick == null) return;
    Uri[] out = null;
    if (res == RESULT_OK && data != null) {
      if (data.getClipData() != null) {
        int n = data.getClipData().getItemCount();
        out = new Uri[n];
        for (int i = 0; i < n; i++) out[i] = data.getClipData().getItemAt(i).getUri();
      } else if (data.getData() != null) out = new Uri[] { data.getData() };
    }
    filePick.onReceiveValue(out);
    filePick = null;
  }

  @Override protected void onSaveInstanceState(Bundle b) { super.onSaveInstanceState(b); web.saveState(b); }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
