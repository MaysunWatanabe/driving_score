package jp.co.nissan.drivingscore;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * ヒヤリ表示ウィジェット 2-1a（proposal #303 / #304 / #305）
 *
 * 本日のヒヤリ件数をホーム画面に出す。先方へ「こんな感じでどうですか」と
 * 見せるためのプロトタイプで、色・文言・アイコンは提案であり確定仕様ではない
 * （proposal #303 §5）。
 *
 * 値はアプリが HiyariWidgetPlugin 経由で SharedPreferences へ書いたものを読む。
 * ウィジェットは別プロセスの BroadcastReceiver で、cordova-sqlite-storage の
 * DB を直接は読めないため（proposal #303 §3）。
 *
 * 再描画は updatePeriodMillis=0（fact #4760）のため OS 任せにできない。
 * 起こすのは次の 3 つ。
 * ・HiyariWidgetPlugin.update() → refreshAll()
 * ・深夜 0 時のアラーム（proposal #304）
 * ・端末再起動 / ランチャーの再描画 / リサイズ
 *
 * receiver は src/debug/AndroidManifest.xml にしかない（fact #4761）。
 * release ビルドではこのクラスは読み込まれるが OS から参照されない。
 */
public class HiyariWidgetProvider extends AppWidgetProvider {

    /** 日付が変わったことを自分へ知らせる内部アクション（proposal #304） */
    private static final String ACTION_DATE_CHANGED =
            "jp.co.nissan.drivingscore.WIDGET_DATE_CHANGED";

    /** 0 件のときの色。落ち着いた緑（proposal #303 §5） */
    private static final int COLOR_OK = 0xFF2E7D32;
    /** 1 件以上のときの色。既存アプリの紺（proposal #303 §5） */
    private static final int COLOR_ALERT = 0xFF0B2D5B;

    /** 日時行の書式（proposal #303 §5 のモック「9/30 (火) 15:41」に合わせる） */
    private static final String DATETIME_PATTERN = "M/d (E) HH:mm";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        RemoteViews views = buildRemoteViews(context);
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
        // 描き直すたびに次の深夜 0 時を取り直す。遅れて起きた場合も
        // ここで先へずらせる（proposal #304）
        scheduleMidnight(context);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        scheduleMidnight(context);
    }

    @Override
    public void onDisabled(Context context) {
        // 最後のウィジェットが外された。予約を残すと無駄に起きる（proposal #304）
        cancelMidnight(context);
        super.onDisabled(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_DATE_CHANGED.equals(intent.getAction())) {
            // 日付が変わった。描画経路は onUpdate() の 1 本に保つ
            refreshAll(context);
        }
    }

    /**
     * 配置済みのウィジェットをすべて描き直す（proposal #303 §3）
     *
     * HiyariWidgetPlugin が SharedPreferences へ書いた直後に呼ぶ。
     * updatePeriodMillis=0（fact #4760）のため、ここで起こさないと
     * ランチャーが再描画するまで表示は変わらない。
     *
     * updateAppWidget() を直接呼ばず ACTION_APPWIDGET_UPDATE を投げるのは、
     * 描画経路を onUpdate() の 1 本に保つため。深夜 0 時のアラーム
     * （proposal #304）も同じ経路を通る。
     *
     * release ビルドでは receiver が宣言されていない（fact #4761）ので
     * getAppWidgetIds() が空を返し、何もせずに戻る。
     */
    public static void refreshAll(Context context) {
        int[] appWidgetIds = currentWidgetIds(context);
        if (appWidgetIds.length == 0) {
            return;
        }

        Intent intent = new Intent(context, HiyariWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
        context.sendBroadcast(intent);
    }

    /** 配置済みウィジェットの id。1 つも無ければ長さ 0 の配列 */
    private static int[] currentWidgetIds(Context context) {
        ComponentName provider = new ComponentName(context, HiyariWidgetProvider.class);
        int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(provider);
        return ids == null ? new int[0] : ids;
    }

    /**
     * ウィジェットの表示を組み立てる（proposal #303 §5 / #304 / #305）
     *
     * 件数は SharedPreferences の値をそのまま使わない。updatedAt が本日でなければ
     * 0 件として描く（proposal #304）。SharedPreferences 側は書き換えない。
     * 翌日以降にアプリが上書きするため、描いた瞬間さえ正しければよい。
     *
     * 日時行は「最終更新時刻」。本日の更新が無ければ行ごと隠す（proposal #305）。
     * 未走行時は updatedAt=0 なので、そのまま整形すると 1970 年が出てしまう。
     */
    private static RemoteViews buildRemoteViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(
                HiyariWidgetPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        long updatedAt = prefs.getLong(HiyariWidgetPlugin.KEY_UPDATED_AT, 0L);

        boolean updatedToday = isToday(updatedAt);
        int count = updatedToday ? prefs.getInt(HiyariWidgetPlugin.KEY_COUNT, 0) : 0;

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hiyari);

        views.setTextViewText(R.id.widget_hiyari_count,
                context.getString(R.string.widget_hiyari_count_format, count));
        views.setTextColor(R.id.widget_hiyari_count, count == 0 ? COLOR_OK : COLOR_ALERT);
        views.setImageViewResource(R.id.widget_hiyari_icon, count == 0
                ? R.drawable.widget_hiyari_icon_ok
                : R.drawable.widget_hiyari_icon_alert);

        if (updatedToday) {
            SimpleDateFormat format = new SimpleDateFormat(DATETIME_PATTERN, Locale.JAPAN);
            views.setTextViewText(R.id.widget_hiyari_datetime, format.format(new Date(updatedAt)));
            views.setViewVisibility(R.id.widget_hiyari_datetime, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.widget_hiyari_datetime, View.GONE);
        }

        views.setOnClickPendingIntent(R.id.widget_hiyari_root, buildLaunchIntent(context));
        return views;
    }

    /**
     * 指定時刻が端末のローカル日付で本日かどうか（proposal #304 §5）
     *
     * hiyari テーブルの日毎集計が date(..., 'localtime') を使っており
     * （proposal #300 §3）、判定の基準をそれと揃える。
     */
    private static boolean isToday(long timeMillis) {
        if (timeMillis <= 0L) {
            return false;
        }
        Calendar target = Calendar.getInstance();
        target.setTimeInMillis(timeMillis);
        Calendar now = Calendar.getInstance();
        return target.get(Calendar.YEAR) == now.get(Calendar.YEAR)
                && target.get(Calendar.DAY_OF_YEAR) == now.get(Calendar.DAY_OF_YEAR);
    }

    /**
     * 次の深夜 0 時に自分あてのブロードキャストを予約する（proposal #304 §3）
     *
     * 描画時の日付比較だけでは「描かれた瞬間は正しい」までしか言えず、
     * 日付が変わっても画面は前日の件数を映したままになる。
     *
     * AlarmManager.setExact() は使わない。API 31 以降は SCHEDULE_EXACT_ALARM が
     * 要るが、targetSdkVersion 32 のまま権限を増やしたくないうえ、日付表示の
     * 切り替えに分単位の精度は要らない。RTC（非 WAKEUP）なので端末が眠って
     * いれば遅れるが、起きたときの描画は日付比較により必ず正しい。
     * つまり遅れるのは切り替わりであって、表示が誤るわけではない。
     */
    private static void scheduleMidnight(Context context) {
        AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            return;
        }

        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_YEAR, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 0);
        // 0 時ちょうどだと端末の時計の誤差で前日と判定されうるので少しずらす
        next.set(Calendar.SECOND, 5);
        next.set(Calendar.MILLISECOND, 0);

        alarmManager.set(AlarmManager.RTC, next.getTimeInMillis(), buildMidnightIntent(context));
    }

    /** 深夜 0 時の予約を取り消す（proposal #304 §3） */
    private static void cancelMidnight(Context context) {
        AlarmManager alarmManager =
                (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(buildMidnightIntent(context));
        }
    }

    /** 深夜 0 時に投げる自分あての PendingIntent。予約と取り消しで同じものを作る */
    private static PendingIntent buildMidnightIntent(Context context) {
        Intent intent = new Intent(context, HiyariWidgetProvider.class);
        intent.setAction(ACTION_DATE_CHANGED);
        return PendingIntent.getBroadcast(context, 1, intent, pendingIntentFlags());
    }

    /** ウィジェットをタップしたときにアプリを起動する PendingIntent */
    private static PendingIntent buildLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        return PendingIntent.getActivity(context, 0, intent, pendingIntentFlags());
    }

    /**
     * PendingIntent のフラグ
     *
     * API 31 以降は可変・不変を明示しないと例外になる。
     * FLAG_IMMUTABLE は API 23 からなので minSdkVersion 22 では分岐が要る。
     */
    private static int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }
}
