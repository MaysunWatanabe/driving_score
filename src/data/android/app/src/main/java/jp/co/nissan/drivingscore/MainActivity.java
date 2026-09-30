package jp.co.nissan.drivingscore;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // アプリ自身に置いた Capacitor プラグインは自動検出されないため、
        // super.onCreate() より前に登録する（proposal #303 §3）
        registerPlugin(HiyariWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
