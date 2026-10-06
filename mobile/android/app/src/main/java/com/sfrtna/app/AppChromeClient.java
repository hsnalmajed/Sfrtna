package com.sfrtna.app;

import android.net.Uri;
import android.os.Message;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * New windows: target="_blank" links and window.open(), from our pages or
 * from inside a partner widget.
 *
 * WebView has no tabs, so each request for a new window gets a throw-away
 * WebView that is never shown. The first address it is sent to is opened in
 * a browser tab (or, for one of our own pages, in the app), and the
 * throw-away view is destroyed. This also covers widgets that open an empty
 * window first and set its address a moment later.
 */
class AppChromeClient extends BridgeWebChromeClient {

    private final Bridge bridge;
    private final MainActivity activity;
    private long lastWindowAt = 0;

    AppChromeClient(Bridge bridge, MainActivity activity) {
        super(bridge);
        this.bridge = bridge;
        this.activity = activity;
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        // Some widgets open their window only after a network round-trip, so
        // the tap is no longer "fresh" — gestures are not required. Bursts
        // are: one new window per second at most.
        long now = android.os.SystemClock.uptimeMillis();
        if (now - lastWindowAt < 1000) return false;
        lastWindowAt = now;

        final WebView popup = new WebView(view.getContext());
        // Some pages write a small redirect script into the new window.
        popup.getSettings().setJavaScriptEnabled(true);
        popup.setWebViewClient(new WebViewClient() {
            private boolean handled = false;

            private boolean route(Uri url) {
                if (handled) return true;
                String scheme = url.getScheme();
                if (scheme == null || "about".equalsIgnoreCase(scheme)) return false;
                handled = true;
                if (AppWebViewClient.isOurHost(url)) {
                    bridge.getWebView().loadUrl(url.toString());
                } else if (AppWebViewClient.isWeb(url)) {
                    ExternalLinks.open(activity, url);
                }
                popup.post(popup::destroy);
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                return route(request.getUrl());
            }

            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap favicon) {
                if (url != null && !handled) {
                    Uri u = Uri.parse(url);
                    if (u.getScheme() != null && !"about".equalsIgnoreCase(u.getScheme())) {
                        v.stopLoading();
                        route(u);
                    }
                }
            }
        });

        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(popup);
        resultMsg.sendToTarget();
        return true;
    }
}
