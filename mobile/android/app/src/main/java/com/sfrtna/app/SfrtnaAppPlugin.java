package com.sfrtna.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * The two site buttons a WebView cannot carry out by itself.
 *
 * The site calls these through window.Capacitor.Plugins.SfrtnaApp, only
 * when it is running inside the app (src/lib/nativeApp.ts). Capacitor only
 * exposes the bridge to pages on sfrtna.com, never to partner widgets.
 *
 *  - shareFile: the KML/GPX map files. A browser saves a download; on a
 *    phone the useful thing is the share sheet — open in Google Earth /
 *    Organic Maps, save to Files or Drive, send on WhatsApp.
 *  - print: the "save as PDF" button. window.print() does nothing in a
 *    WebView, so the page goes to Android's own print / save-as-PDF screen.
 */
@CapacitorPlugin(name = "SfrtnaApp")
public class SfrtnaAppPlugin extends Plugin {

    private static final int MAX_FILE_CHARS = 5_000_000;

    @PluginMethod
    public void shareFile(PluginCall call) {
        String name = call.getString("name", "");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String content = call.getString("content");
        if (content == null || content.length() > MAX_FILE_CHARS) {
            call.reject("bad_content");
            return;
        }
        // Only a plain file name: no folders, nothing outside our share folder.
        String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (safe.isEmpty() || safe.startsWith(".")) safe = "sfrtna" + safe;

        try {
            Context ctx = getContext();
            File dir = new File(ctx.getCacheDir(), "shared");
            if (!dir.exists() && !dir.mkdirs()) throw new IOException("mkdir");
            File file = new File(dir, safe);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(content.getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);

            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mimeType);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, safe);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(chooser);
                    call.resolve();
                } catch (ActivityNotFoundException e) {
                    call.reject("no_app");
                }
            });
        } catch (IOException | IllegalArgumentException e) {
            call.reject("write_failed");
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        String title = call.getString("title", "Sfrtna");
        getActivity().runOnUiThread(() -> {
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            if (pm == null) {
                call.reject("no_print");
                return;
            }
            PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter(title);
            pm.print(title, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            call.resolve();
        });
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        String version = "";
        try {
            version = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName;
        } catch (android.content.pm.PackageManager.NameNotFoundException ignored) {
            // Our own package is always installed.
        }
        ret.put("version", version);
        call.resolve(ret);
    }
}
