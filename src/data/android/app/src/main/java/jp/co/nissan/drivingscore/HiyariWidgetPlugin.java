package jp.co.nissan.drivingscore;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 本日のヒヤリ件数をウィジェットへ渡す Capacitor プラグイン（proposal #303 §3）
 *
 * ウィジェットは別プロセスの BroadcastReceiver で、cordova-sqlite-storage の
 * DB を直接は読めない。そこでアプリ側が表示用の値だけを SharedPreferences へ
 * 書き出し、ウィジェットはそれを読む。ContentProvider で SQLite を共有する案は
 * 表示項目が少なく実装量に見合わないため採らない。
 *
 * メソッドは update({ count }) の 1 つだけ（proposal #303 §3）。
 *
 * このクラスは src/main に置く（proposal #303 §3 で配置を指定）。ウィジェットの
 * receiver は src/debug にしか無い（fact #4761）ため、release ビルドでは
 * updateAppWidget() の対象が 0 件になり、SharedPreferences へ書くだけの
 * 実質 no-op になる。release にウィジェットは現れない。
 */
@CapacitorPlugin(name = "HiyariWidget")
public class HiyariWidgetPlugin extends Plugin {

    /** SharedPreferences の名前（proposal #303 §3） */
    public static final String PREFS_NAME = "hiyari_widget";
    /** 本日のヒヤリ件数 */
    public static final String KEY_COUNT = "count";
    /** 書き込み時刻（epoch ms）。値が無いときは 0（proposal #303 §3） */
    public static final String KEY_UPDATED_AT = "updatedAt";

    @PluginMethod
    public void update(PluginCall call) {
        final int count = call.getInt(KEY_COUNT, 0);
        final Context context = getContext();

        SharedPreferences.Editor editor = context
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
        editor.putInt(KEY_COUNT, count);
        editor.putLong(KEY_UPDATED_AT, System.currentTimeMillis());
        editor.apply();

        // 書き込んだ値を即座に画面へ出す。updatePeriodMillis=0（fact #4760）なので
        // ここで呼ばないと、ランチャーが再描画するまで表示は変わらない
        HiyariWidgetProvider.refreshAll(context);

        call.resolve();
    }
}
