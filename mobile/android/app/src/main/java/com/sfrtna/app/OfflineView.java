package com.sfrtna.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Shown over the page when sfrtna.com cannot be reached. Retries by itself
 * when the phone gets a connection back (MainActivity), or on the button.
 * Text comes from res/values (Arabic) and res/values-en.
 */
class OfflineView extends LinearLayout {

    private static final int NAVY = 0xFF0B2D5B;
    private static final int SUN = 0xFFF7A823;

    OfflineView(Context context, Runnable onRetry) {
        super(context);
        setOrientation(VERTICAL);
        setGravity(Gravity.CENTER);
        setBackgroundColor(Color.WHITE);
        setClickable(true); // Keep taps off the page underneath.
        int pad = dp(32);
        setPadding(pad, pad, pad, pad);

        ImageView mark = new ImageView(context);
        mark.setImageResource(R.drawable.splash_icon);
        addView(mark, new LayoutParams(dp(120), dp(120)));

        TextView title = new TextView(context);
        title.setText(R.string.offline_title);
        title.setTextColor(NAVY);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        LayoutParams tp = new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        tp.topMargin = dp(12);
        addView(title, tp);

        TextView body = new TextView(context);
        body.setText(R.string.offline_body);
        body.setTextColor(0xFF4A5B73);
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        body.setGravity(Gravity.CENTER);
        LayoutParams bp = new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        bp.topMargin = dp(8);
        addView(body, bp);

        Button retry = new Button(context);
        retry.setText(R.string.offline_retry);
        retry.setAllCaps(false);
        retry.setTextColor(NAVY);
        retry.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(SUN);
        bg.setCornerRadius(dp(12));
        retry.setBackground(bg);
        retry.setPadding(dp(28), 0, dp(28), 0);
        retry.setOnClickListener(v -> onRetry.run());
        LayoutParams rp = new LayoutParams(LayoutParams.WRAP_CONTENT, dp(48));
        rp.topMargin = dp(24);
        addView(retry, rp);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
