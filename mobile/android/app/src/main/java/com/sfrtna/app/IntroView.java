package com.sfrtna.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * The opening of the app: the mark, then «لكل سفره حكاية» written in word by
 * word with a gold line drawn under it — the brand's own tagline, said once,
 * while the first page loads underneath.
 *
 * It replaces the bare system launch screen (a logo on white and nothing
 * else). The system screen is released at once and this view takes over
 * from the same white, so the change is invisible. It stays at least
 * {@link #MIN_SHOW_MS} so the line can be read, and leaves as soon as the
 * page has drawn after that (MainActivity calls {@link #finish}); a slow
 * network never holds it past MainActivity's own limit.
 *
 * Text comes from res/values (Arabic) and res/values-en. Animations follow
 * the phone's "remove animations" setting: with it on, everything simply
 * appears.
 */
class IntroView extends FrameLayout {

    /** Long enough to read the line once. */
    static final long MIN_SHOW_MS = 1700;

    private static final int NAVY = 0xFF0B2D5B;
    private static final int SUN = 0xFFFFA630;

    private final long shownAt = SystemClock.uptimeMillis();
    private boolean leaving = false;

    IntroView(Context context) {
        super(context);
        setBackgroundColor(Color.WHITE);
        setClickable(true); // Taps stay off the page while it loads.

        LinearLayout column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        addView(column, new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        ImageView mark = new ImageView(context);
        mark.setImageResource(R.drawable.splash_icon);
        column.addView(mark, new LinearLayout.LayoutParams(dp(132), dp(132)));

        // The tagline, one view per word so each can arrive on its own. The
        // row follows the language's direction: right to left in Arabic.
        LinearLayout words = new LinearLayout(context);
        words.setOrientation(LinearLayout.HORIZONTAL);
        words.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams wp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        wp.topMargin = dp(10);
        column.addView(words, wp);

        String[] parts = context.getString(R.string.intro_tagline).split(" ");
        TextView[] wordViews = new TextView[parts.length];
        for (int i = 0; i < parts.length; i++) {
            TextView w = new TextView(context);
            w.setText(parts[i]);
            w.setTextColor(NAVY);
            w.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
            w.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMarginStart(i == 0 ? 0 : dp(7));
            words.addView(w, lp);
            wordViews[i] = w;
        }

        View line = new View(context);
        line.setBackgroundColor(SUN);
        LinearLayout.LayoutParams linep = new LinearLayout.LayoutParams(dp(150), dp(3));
        linep.topMargin = dp(8);
        column.addView(line, linep);

        if (!animationsOn(context)) return;

        // The mark settles in with a small overshoot.
        mark.setAlpha(0f);
        mark.setScaleX(0.82f);
        mark.setScaleY(0.82f);
        mark.animate().alpha(1f).scaleX(1f).scaleY(1f)
            .setDuration(520).setInterpolator(new OvershootInterpolator(1.6f)).start();

        // Then the words, one after another, rising into place.
        long start = 380;
        for (int i = 0; i < wordViews.length; i++) {
            TextView w = wordViews[i];
            w.setAlpha(0f);
            w.setTranslationY(dp(14));
            w.animate().alpha(1f).translationY(0f)
                .setStartDelay(start + i * 190L).setDuration(380)
                .setInterpolator(new DecelerateInterpolator()).start();
        }

        // And the gold line drawn out from the start of the reading direction.
        line.setScaleX(0f);
        line.post(() -> {
            boolean rtl = getLayoutDirection() == LAYOUT_DIRECTION_RTL;
            line.setPivotX(rtl ? line.getWidth() : 0);
            line.animate().scaleX(1f)
                .setStartDelay(start + wordViews.length * 190L + 120).setDuration(420)
                .setInterpolator(new DecelerateInterpolator()).start();
        });
    }

    /** How long until the intro may leave. */
    long remainingMs() {
        return Math.max(0, MIN_SHOW_MS - (SystemClock.uptimeMillis() - shownAt));
    }

    /** Fade away and take this view out of the window. */
    void finish() {
        if (leaving) return;
        leaving = true;
        if (!animationsOn(getContext())) {
            removeSelf();
            return;
        }
        animate().alpha(0f).setDuration(320).setListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                removeSelf();
            }
        }).start();
    }

    private void removeSelf() {
        setVisibility(GONE);
        if (getParent() instanceof android.view.ViewGroup) {
            ((android.view.ViewGroup) getParent()).removeView(this);
        }
    }

    private static boolean animationsOn(Context context) {
        try {
            return android.provider.Settings.Global.getFloat(
                context.getContentResolver(), android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f;
        } catch (RuntimeException e) {
            return true;
        }
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
