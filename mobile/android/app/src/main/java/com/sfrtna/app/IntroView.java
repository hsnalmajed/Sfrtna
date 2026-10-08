package com.sfrtna.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Color;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;

/**
 * The opening of the app: the Sfrtna mark, large, and then a plane that
 * flies across and writes «لكل سفره حكاية» in its wake, leaving a dashed
 * gold trail ({@link TaglineFlightView}) — the plane and trail the mark
 * itself is drawn from, said once, while the first page loads underneath.
 *
 * The system launch screen is released at once and this view takes over
 * from the same white. It stays at least {@link #MIN_SHOW_MS} so the line
 * can be read, and leaves as soon as the page has drawn after that
 * (MainActivity calls {@link #finish}); a slow network never holds it past
 * MainActivity's own limit.
 *
 * Text from res/values (Arabic) and res/values-en; the tagline is set in
 * Tajawal ExtraBold, the site's display face (res/font, SIL OFL —
 * mobile/licenses). With the phone's "remove animations" setting on,
 * everything simply appears.
 */
class IntroView extends FrameLayout {

    /** Long enough to watch the line written and read it once. */
    static final long MIN_SHOW_MS = 2300;

    private final long shownAt = SystemClock.uptimeMillis();
    private boolean leaving = false;
    private final ImageView mark;
    private final TaglineFlightView tagline;

    /** @param english the language the visitor last used (MainActivity reads it). */
    IntroView(Context context, boolean english) {
        super(context);
        setBackgroundColor(Color.WHITE);
        setClickable(true); // Taps stay off the page while it loads.

        LinearLayout column = new LinearLayout(context);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        LayoutParams cp = new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        cp.bottomMargin = dp(48); // A little above centre, where the eye rests.
        addView(column, cp);

        mark = new ImageView(context);
        mark.setImageResource(R.drawable.intro_mark);
        mark.setAdjustViewBounds(true);
        column.addView(mark, new LinearLayout.LayoutParams(dp(176), dp(170)));

        String line = context.getString(english ? R.string.intro_tagline_en : R.string.intro_tagline_ar);
        tagline = new TaglineFlightView(context, line, !english);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        tp.topMargin = dp(4);
        column.addView(tagline, tp);

        if (!animationsOn(context)) {
            tagline.setProgress(1f);
            return;
        }

        // The mark arrives with a small overshoot…
        mark.setAlpha(0f);
        mark.setScaleX(0.7f);
        mark.setScaleY(0.7f);
        mark.animate().alpha(1f).scaleX(1f).scaleY(1f)
            .setDuration(560).setInterpolator(new OvershootInterpolator(1.4f)).start();

        // …then the plane writes the line.
        ValueAnimator write = ValueAnimator.ofFloat(0f, 1f);
        write.setStartDelay(480);
        write.setDuration(1250);
        write.setInterpolator(new AccelerateDecelerateInterpolator());
        write.addUpdateListener(a -> tagline.setProgress((float) a.getAnimatedValue()));
        write.start();
    }

    /** How long until the intro may leave. */
    long remainingMs() {
        return Math.max(0, MIN_SHOW_MS - (SystemClock.uptimeMillis() - shownAt));
    }

    /** Fade away, the mark lifting slightly, and leave the window. */
    void finish() {
        if (leaving) return;
        leaving = true;
        if (!animationsOn(getContext())) {
            removeSelf();
            return;
        }
        mark.animate().translationY(-dp(12)).setDuration(320).start();
        animate().alpha(0f).setDuration(340).setListener(new AnimatorListenerAdapter() {
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
