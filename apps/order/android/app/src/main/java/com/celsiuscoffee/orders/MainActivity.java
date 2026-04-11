package com.celsiuscoffee.orders;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.celsiuscoffee.orders.plugins.SunmiPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SunmiPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
