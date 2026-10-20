package com.sfrtna.app;

import android.content.ActivityNotFoundException;
import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSArray;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
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
 * What the site asks of the phone that a WebView cannot do by itself.
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
 *  - openAuth: signing in. Google refuses its sign-in inside a WebView, so
 *    our sign-in page opens in the phone's browser (Custom Tab) and comes
 *    back through sfrtna://auth (MainActivity) — see src/lib/appAuth.ts.
 *  - googleSilent / googleSignOut: Google's own sign-in on the phone
 *    (Credential Manager), used only silently, for a Google account that
 *    already signed in to Sfrtna — the app then opens signed in. It works
 *    once the app's Android OAuth client (package + signing certificate) is
 *    registered with Google; until then it fails quietly.
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
        // What this build can do: the site checks before it offers a button.
        JSArray features = new JSArray();
        features.put("share");
        features.put("print");
        features.put("auth");
        features.put("google");
        ret.put("features", features);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAuth(PluginCall call) {
        String url = call.getString("url", "");
        // Only our own sign-in page, never another address.
        if (url == null || !url.matches("^https://sfrtna\\.com/(ar|en)/account/app\\?c=[A-Za-z0-9_-]{43}$")) {
            call.reject("bad_url");
            return;
        }
        getActivity().runOnUiThread(() -> {
            ExternalLinks.open(getActivity(), Uri.parse(url));
            call.resolve();
        });
    }

    @PluginMethod
    public void googleSilent(PluginCall call) {
        String clientId = call.getString("clientId", "");
        if (clientId == null || !clientId.endsWith(".apps.googleusercontent.com")) {
            call.reject("bad_client");
            return;
        }
        GetGoogleIdOption option = new GetGoogleIdOption.Builder()
            .setServerClientId(clientId)
            // Only an account that already signed in to us, and no chooser.
            .setFilterByAuthorizedAccounts(true)
            .setAutoSelectEnabled(true)
            .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager manager = CredentialManager.create(getContext());
        manager.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    Credential credential = response.getCredential();
                    if (credential instanceof CustomCredential
                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        try {
                            String token = GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
                            JSObject ret = new JSObject();
                            ret.put("idToken", token);
                            call.resolve(ret);
                            return;
                        } catch (RuntimeException e) {
                            call.reject("bad_credential");
                            return;
                        }
                    }
                    call.reject("no_google");
                }

                @Override
                public void onError(GetCredentialException e) {
                    call.reject(e.getType());
                }
            }
        );
    }

    @PluginMethod
    public void googleSignOut(PluginCall call) {
        CredentialManager manager = CredentialManager.create(getContext());
        manager.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    call.resolve();
                }

                @Override
                public void onError(ClearCredentialException e) {
                    call.resolve();
                }
            }
        );
    }
}
