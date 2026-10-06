package com.sfrtna.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

/** Opens another site in a browser tab over the app (Chrome Custom Tabs). */
final class ExternalLinks {

    private static final int NAVY = 0xFF0B2D5B;

    private ExternalLinks() {}

    static void open(Activity activity, Uri url) {
        if (url == null || !AppWebViewClient.isWeb(url)) return;
        try {
            CustomTabColorSchemeParams colors = new CustomTabColorSchemeParams.Builder()
                .setToolbarColor(NAVY)
                .setNavigationBarColor(NAVY)
                .build();
            CustomTabsIntent tab = new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(colors)
                .setShowTitle(true)
                .setShareState(CustomTabsIntent.SHARE_STATE_ON)
                .build();
            tab.launchUrl(activity, url);
        } catch (ActivityNotFoundException e) {
            try {
                activity.startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (ActivityNotFoundException ignored) {
                // No browser at all on this phone.
            }
        }
    }
}
