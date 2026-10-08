package com.sfrtna.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.util.TypedValue;
import android.view.View;
import androidx.core.content.ContextCompat;
import androidx.core.content.res.ResourcesCompat;

/**
 * The tagline, written by a plane.
 *
 * A small plane flies across in the reading direction on a shallow arc,
 * the words appearing in its wake and a dashed gold trail behind it — the
 * same plane-and-trail the Sfrtna mark is drawn from. {@link #setProgress}
 * moves it (IntroView animates 0 → 1); at 1 the whole line is shown, the
 * plane has left and only the line remains.
 */
class TaglineFlightView extends View {

    private static final int NAVY = 0xFF0B2D5B;
    private static final int SUN = 0xFFFFA630;

    private final String text;
    private final boolean rtl;
    private final Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint trailPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Drawable plane;
    private final Path trail = new Path();
    private float progress = 0f;

    TaglineFlightView(Context context, String text, boolean rtl) {
        super(context);
        this.text = text;
        this.rtl = rtl;

        Typeface face = null;
        try {
            face = ResourcesCompat.getFont(context, rtl ? R.font.tajawal_arabic_800 : R.font.tajawal_latin_800);
        } catch (RuntimeException ignored) {
            // The system font, bold, if the bundled one cannot be read.
        }
        textPaint.setTypeface(face != null ? face : Typeface.DEFAULT_BOLD);
        textPaint.setColor(NAVY);
        textPaint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 30, getResources().getDisplayMetrics()));
        textPaint.setTextAlign(Paint.Align.CENTER);

        trailPaint.setStyle(Paint.Style.STROKE);
        trailPaint.setColor(SUN);
        trailPaint.setStrokeCap(Paint.Cap.ROUND);
        trailPaint.setStrokeWidth(dp(2.5f));
        trailPaint.setPathEffect(new DashPathEffect(new float[] { dp(7), dp(6) }, 0));

        plane = ContextCompat.getDrawable(context, R.drawable.ic_intro_plane);
    }

    void setProgress(float p) {
        progress = Math.max(0f, Math.min(1f, p));
        invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int w = MeasureSpec.getSize(widthMeasureSpec);
        int h = Math.round(textPaint.getTextSize() * 2.6f);
        setMeasuredDimension(w, h);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth();
        float textW = textPaint.measureText(text);
        float pad = dp(18);
        float start = rtl ? (w + textW) / 2f + pad : (w - textW) / 2f - pad;
        float end = rtl ? (w - textW) / 2f - pad : (w + textW) / 2f + pad;
        float baseline = getHeight() * 0.78f;
        float flyY = baseline - textPaint.getTextSize() * 1.25f;
        float lift = dp(14);

        // Where the plane is now: along the line, on a shallow arc above it.
        float t = progress;
        float x = start + (end - start) * t;
        float y = flyY - (float) Math.sin(Math.PI * t) * lift;

        // The words, uncovered up to the plane.
        canvas.save();
        if (rtl) canvas.clipRect(Math.min(x, w), 0, w, getHeight());
        else canvas.clipRect(0, 0, Math.max(x, 0), getHeight());
        canvas.drawText(text, w / 2f, baseline, textPaint);
        canvas.restore();

        // The trail behind it, fading out once the plane has gone.
        if (t > 0f) {
            trail.reset();
            int steps = 40;
            for (int i = 0; i <= steps; i++) {
                float ti = t * i / steps;
                float xi = start + (end - start) * ti;
                float yi = flyY - (float) Math.sin(Math.PI * ti) * lift;
                if (i == 0) trail.moveTo(xi, yi);
                else trail.lineTo(xi, yi);
            }
            trailPaint.setAlpha(Math.round(255 * (t < 0.85f ? 1f : (1f - t) / 0.15f)));
            canvas.drawPath(trail, trailPaint);
        }

        // The plane, nose along its path; it fades as it leaves.
        if (plane != null && t < 1f) {
            float size = dp(26);
            // Direction of travel; the glyph points up, so turn it to face it.
            double dx = end - start;
            double dy = -lift * Math.PI * Math.cos(Math.PI * t);
            float heading = (float) Math.toDegrees(Math.atan2(dx, -dy));
            canvas.save();
            canvas.translate(x, y);
            canvas.rotate(heading);
            plane.setBounds(Math.round(-size / 2), Math.round(-size / 2), Math.round(size / 2), Math.round(size / 2));
            plane.setAlpha(Math.round(255 * (t < 0.9f ? 1f : (1f - t) / 0.1f)));
            plane.draw(canvas);
            canvas.restore();
        }
    }

    private float dp(float v) {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }
}
