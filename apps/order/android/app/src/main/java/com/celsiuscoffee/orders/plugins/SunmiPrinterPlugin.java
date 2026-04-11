package com.celsiuscoffee.orders.plugins;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import woyou.aidlservice.jiuiv5.IWoyouService;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "SunmiPrinter")
public class SunmiPrinterPlugin extends Plugin {

    private static final String TAG = "SunmiPrinter";
    private IWoyouService printerService;
    private boolean isConnected = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IWoyouService.Stub.asInterface(service);
            isConnected = true;
            Log.i(TAG, "Sunmi printer service connected");
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            printerService = null;
            isConnected = false;
            Log.w(TAG, "Sunmi printer service disconnected");
        }
    };

    @Override
    public void load() {
        super.load();
        bindPrinterService();
    }

    private void bindPrinterService() {
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            Log.e(TAG, "Failed to bind Sunmi printer service", e);
        }
    }

    @PluginMethod
    public void isReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ready", isConnected && printerService != null);
        call.resolve(ret);
    }

    // ---- ESC/POS helpers ----

    private static final byte ESC = 0x1B;
    private static final byte GS  = 0x1D;
    private static final byte LF  = 0x0A;

    /** ESC @ — initialize printer */
    private byte[] cmdInit() {
        return new byte[]{ ESC, '@' };
    }

    /** ESC a n — set alignment: 0=left, 1=center, 2=right */
    private byte[] cmdAlign(int n) {
        return new byte[]{ ESC, 'a', (byte) n };
    }

    /** GS ! n — set character size (width/height multiplier)
     *  n = (widthMult << 4) | heightMult, where mult is 0-7 (0=1x, 1=2x, 2=3x, etc.)
     */
    private byte[] cmdCharSize(int widthMult, int heightMult) {
        int n = ((widthMult & 0x07) << 4) | (heightMult & 0x07);
        return new byte[]{ GS, '!', (byte) n };
    }

    /** ESC E n — bold on/off */
    private byte[] cmdBold(boolean on) {
        return new byte[]{ ESC, 'E', (byte)(on ? 1 : 0) };
    }

    /** Build raw bytes for a text line */
    private byte[] textBytes(String text) {
        try {
            return text.getBytes("UTF-8");
        } catch (Exception e) {
            return text.getBytes();
        }
    }

    /** Feed n lines */
    private byte[] cmdFeedLines(int n) {
        return new byte[]{ ESC, 'd', (byte) n };
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        if (!isConnected || printerService == null) {
            call.reject("Printer not connected");
            return;
        }

        String orderNumber = call.getString("orderNumber", "");
        String storeName = call.getString("storeName", "");
        String time = call.getString("time", "");
        String items = call.getString("items", "");
        String notes = call.getString("notes", "");
        String type = call.getString("type", "kitchen");
        String total = call.getString("total", "");
        String subtotal = call.getString("subtotal", "");
        String payment = call.getString("payment", "");

        String DASHES = "--------------------------------\n";

        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();

            // Initialize printer
            out.write(cmdInit());

            if (type.equals("kitchen")) {
                // --- Kitchen Slip ---
                // Header centered
                out.write(cmdAlign(1));
                out.write(cmdCharSize(0, 0));
                out.write(cmdBold(true));
                out.write(textBytes("KITCHEN ORDER\n"));
                out.write(cmdBold(false));

                out.write(cmdCharSize(0, 1));
                out.write(textBytes("Celsius Coffee\n"));
                out.write(cmdCharSize(0, 0));
                out.write(textBytes(storeName + "\n"));
                out.write(textBytes(DASHES));

                // Big order number
                out.write(cmdCharSize(1, 1));
                out.write(cmdBold(true));
                out.write(textBytes("#" + orderNumber + "\n"));
                out.write(cmdBold(false));
                out.write(cmdCharSize(0, 0));
                out.write(textBytes(time + "\n"));
                out.write(textBytes(DASHES));

                // Items left-aligned
                out.write(cmdAlign(0));
                out.write(textBytes(items + "\n"));

                // Notes
                if (notes != null && !notes.isEmpty()) {
                    out.write(textBytes(DASHES));
                    out.write(cmdBold(true));
                    out.write(textBytes("NOTE: " + notes + "\n"));
                    out.write(cmdBold(false));
                }

                // Footer
                out.write(cmdAlign(1));
                out.write(textBytes(DASHES));
                out.write(textBytes("SELF-PICKUP\n"));

            } else {
                // --- Receipt ---
                out.write(cmdAlign(1));
                out.write(cmdCharSize(0, 1));
                out.write(textBytes("Celsius Coffee\n"));
                out.write(cmdCharSize(0, 0));
                out.write(textBytes(storeName + "\n"));
                out.write(textBytes(time + "\n"));
                out.write(textBytes(DASHES));

                out.write(cmdCharSize(1, 1));
                out.write(cmdBold(true));
                out.write(textBytes("#" + orderNumber + "\n"));
                out.write(cmdBold(false));
                out.write(cmdCharSize(0, 0));
                out.write(textBytes(DASHES));

                // Items left-aligned
                out.write(cmdAlign(0));
                out.write(textBytes(items + "\n"));

                out.write(textBytes(DASHES));
                out.write(textBytes("Subtotal          " + subtotal + "\n"));
                out.write(textBytes(DASHES));

                out.write(cmdCharSize(0, 1));
                out.write(cmdBold(true));
                out.write(textBytes("TOTAL  " + total + "\n"));
                out.write(cmdBold(false));
                out.write(cmdCharSize(0, 0));
                out.write(textBytes("Payment: " + payment + "\n"));

                out.write(cmdAlign(1));
                out.write(textBytes(DASHES));
                out.write(textBytes("Thank you!\n"));
            }

            // Feed paper
            out.write(cmdFeedLines(4));

            byte[] data = out.toByteArray();
            Log.i(TAG, "Sending RAW ESC/POS data, " + data.length + " bytes, type=" + type + " order=#" + orderNumber);
            printerService.sendRAWData(data, null);
            Log.i(TAG, "RAW data sent successfully");
            call.resolve();

        } catch (RemoteException e) {
            Log.e(TAG, "Print RemoteException", e);
            call.reject("Print error: " + e.getMessage());
        } catch (IOException e) {
            Log.e(TAG, "Print IOException", e);
            call.reject("Print build error: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            getContext().unbindService(connection);
        } catch (Exception ignored) {}
    }
}
