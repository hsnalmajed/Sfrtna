package com.sfrtna.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

/**
 * The app is sfrtna.com in a native window.
 *
 * The site itself is loaded live (capacitor.config.json → server.url), so
 * every change on the site reaches the app at once and the /api guard sees
 * the same same-origin requests it sees from a browser. What lives here is
 * only what a phone needs and a web page cannot do on its own:
 *
 *  - links to partners and other sites open in a browser tab over the app
 *    (Custom Tabs), never inside it — see {@link AppWebViewClient} and
 *    {@link AppChromeClient};
 *  - the back button walks back through pages, then leaves the app;
 *  - a native "no connection" screen that retries by itself;
 *  - an opening — the mark and «لكل سفره حكاية» animated in — that stays
 *    until the first page has drawn ({@link IntroView});
 *  - print and file sharing for the site's PDF / KML / GPX buttons
 *    ({@link SfrtnaAppPlugin}).
 */
public class MainActivity extends BridgeActivity {

    /** Never hold the opening longer than this, even on a slow network. */
    private static final long MAX_SPLASH_MS = 6000;

    private OfflineView offlineView;
    private IntroView introView;
    private String failedUrl;
    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The system launch screen only bridges to the opening (IntroView),
        // which starts from the same white: it is released at once.
        SplashScreen.installSplashScreen(this);

        registerPlugin(SfrtnaAppPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return; // No WebView on this device: Capacitor shows its own notice.

        WebView webView = bridge.getWebView();
        webView.getSettings().setSupportMultipleWindows(true);
        bridge.setWebViewClient(new AppWebViewClient(bridge, this));
        webView.setWebChromeClient(new AppChromeClient(bridge, this));

        offlineView = new OfflineView(this, this::retry);
        addContentView(offlineView, new android.widget.FrameLayout.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.MATCH_PARENT
        ));
        offlineView.setVisibility(View.GONE);

        // A process restored with the page already up skips the opening.
        if (savedInstanceState == null) {
            introView = new IntroView(this);
            addContentView(introView, new android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            ));
            // The ceiling: a slow network never keeps the opening up.
            introView.postDelayed(this::endIntro, MAX_SPLASH_MS);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = bridge.getWebView();
                if (wv.canGoBack()) {
                    // From the offline screen too: the page before may still load.
                    failedUrl = null;
                    offlineView.setVisibility(View.GONE);
                    wv.goBack();
                } else {
                    // Leave the app the way any Android app leaves on back.
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null && networkCallback == null) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    runOnUiThread(() -> {
                        if (offlineView != null && offlineView.getVisibility() == View.VISIBLE) retry();
                    });
                }
            };
            try {
                cm.registerDefaultNetworkCallback(networkCallback);
            } catch (RuntimeException ignored) {
                networkCallback = null;
            }
        }
    }

    @Override
    public void onStop() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null && networkCallback != null) {
            try {
                cm.unregisterNetworkCallback(networkCallback);
            } catch (RuntimeException ignored) {
                // Already gone.
            }
        }
        networkCallback = null;
        super.onStop();
    }

    /** A page of ours finished drawing. */
    void onMainPageFinished(String url) {
        endIntroWhenRead();
        if (offlineView != null && failedUrl == null) offlineView.setVisibility(View.GONE);
    }

    /** The page itself could not be fetched (no network, DNS, timeout). */
    void showOffline(String url) {
        endIntroWhenRead();
        failedUrl = url;
        if (offlineView != null) offlineView.setVisibility(View.VISIBLE);
    }

    /** Leave the opening once its line has had time to be read. */
    private void endIntroWhenRead() {
        if (introView == null) return;
        introView.postDelayed(this::endIntro, introView.remainingMs());
    }

    private void endIntro() {
        if (introView == null) return;
        introView.finish();
        introView = null;
    }

    private void retry() {
        if (bridge == null) return;
        String url = failedUrl != null ? failedUrl : bridge.getAppUrl();
        failedUrl = null;
        offlineView.setVisibility(View.GONE);
        bridge.getWebView().loadUrl(url);
    }
}
