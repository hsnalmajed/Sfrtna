package com.sfrtna.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.net.URISyntaxException;

/**
 * Decides where each navigation goes.
 *
 *  - Our own pages stay in the app.
 *  - Another site opened in the page itself (a partner link, an official visa
 *    site) opens in a browser tab over the app. The partner gets a real
 *    browser — its cookies, its sign-in, our affiliate tracking — and the
 *    traveller returns to the app with one tap.
 *  - Navigations inside an embedded widget (Stay22 map, Aviasales results)
 *    stay inside that widget, as they do on the website.
 *  - tel:, mailto:, whatsapp:, intent: … go to the app that owns them.
 */
class AppWebViewClient extends BridgeWebViewClient {

    private final MainActivity activity;

    AppWebViewClient(Bridge bridge, MainActivity activity) {
        super(bridge);
        this.activity = activity;
    }

    static boolean isOurHost(Uri url) {
        String host = url.getHost();
        if (host == null) return false;
        host = host.toLowerCase(java.util.Locale.ROOT);
        return host.equals("sfrtna.com") || host.equals("www.sfrtna.com");
    }

    static boolean isWeb(Uri url) {
        String scheme = url.getScheme();
        return "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase(java.util.Locale.ROOT);

        if (isWeb(url)) {
            if (isOurHost(url)) {
                if ("https".equals(scheme)) return false;
                view.loadUrl(url.buildUpon().scheme("https").build().toString());
                return true;
            }
            if (!request.isForMainFrame()) return false;
            ExternalLinks.open(activity, url);
            return true;
        }
        switch (scheme) {
            case "blob":
            case "data":
            case "about":
            case "javascript":
                return false;
            case "intent":
                openIntentUri(url.toString());
                return true;
            default:
                openWithSystem(url);
                return true;
        }
    }

    private void openIntentUri(String raw) {
        try {
            Intent intent = Intent.parseUri(raw, Intent.URI_INTENT_SCHEME);
            // Never let a web page start a component of ours or anything private.
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.setComponent(null);
            intent.setSelector(null);
            try {
                activity.startActivity(intent);
            } catch (ActivityNotFoundException e) {
                String fallback = intent.getStringExtra("browser_fallback_url");
                if (fallback != null) ExternalLinks.open(activity, Uri.parse(fallback));
            }
        } catch (URISyntaxException ignored) {
            // A malformed intent: nothing sensible to open.
        }
    }

    private void openWithSystem(Uri url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, url);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            activity.startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            // No app for this kind of link on this phone.
        }
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        activity.onMainPageFinished(url);
    }

    /**
     * The page has painted its first frame — earlier than onPageFinished,
     * which also waits for every image and script. The opening leaves here,
     * so the app shows the page as soon as there is one to show.
     */
    @Override
    public void onPageCommitVisible(WebView view, String url) {
        super.onPageCommitVisible(view, url);
        activity.onMainPageFinished(url);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (!request.isForMainFrame()) return;
        switch (error.getErrorCode()) {
            case WebViewClient.ERROR_HOST_LOOKUP:
            case WebViewClient.ERROR_CONNECT:
            case WebViewClient.ERROR_TIMEOUT:
            case WebViewClient.ERROR_IO:
            case WebViewClient.ERROR_PROXY_AUTHENTICATION:
            case WebViewClient.ERROR_FAILED_SSL_HANDSHAKE:
            case WebViewClient.ERROR_UNKNOWN:
                activity.showOffline(request.getUrl().toString());
                break;
            default:
                break;
        }
    }
}
