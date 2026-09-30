package jp.co.nissan.drivingscore;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * ヒヤリ表示ウィジェット 2-1a の骨組み（proposal #298）
 *
 * 二次仕様（2026-09-25）で追加された「ウィジット」の技術検証用。
 * 表示とアプリ起動だけを行い、実データは参照しない。
 *
 * 確かめたいのは次の 3 点。
 * ・RemoteViews で 2-1a 相当のレイアウトが成立するか
 * ・npx cap sync でこのファイルが消えないか
 * ・タップでアプリへ戻せるか（RemoteViews に動画プレイヤーは置けないため、
 *   本番でも映像再生はアプリ側へ遷移させる必要がある）
 *
 * 本格実装で追加するもの（proposal #298 の対象外）。
 * ・実データとの受け渡し（SharedPreferences / ContentProvider / JSON）
 * ・ヒヤリ検知時の updateAppWidget() 呼び出し
 * ・JS からネイティブを呼ぶ Capacitor プラグイン
 */
public class HiyariWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context));
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
        ComponentName provider = new ComponentName(context, HiyariWidgetProvider.class);
        int[] appWidgetIds = AppWidgetManager.getInstance(context).getAppWidgetIds(provider);
        if (appWidgetIds == null || appWidgetIds.length == 0) {
            return;
        }

        Intent intent = new Intent(context, HiyariWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
        context.sendBroadcast(intent);
    }

    /**
     * ウィジェットの表示を組み立てる
     *
     * 文字列はすべて strings.xml の固定値をレイアウト側で参照している。
     * ここで setTextViewText() を呼ばないのは、骨組みの段階で
     * 「実データを参照しない」ことをコード上も明確にしておくため。
     */
    private RemoteViews buildRemoteViews(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_hiyari);
        views.setOnClickPendingIntent(R.id.widget_hiyari_root, buildLaunchIntent(context));
        return views;
    }

    /** ウィジェットをタップしたときにアプリを起動する PendingIntent */
    private PendingIntent buildLaunchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);

        // API 31 以降は可変フラグを明示しないと例外になる。
        // FLAG_IMMUTABLE は API 23 からなので minSdkVersion 22 では分岐が要る
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, 0, intent, flags);
    }
}
