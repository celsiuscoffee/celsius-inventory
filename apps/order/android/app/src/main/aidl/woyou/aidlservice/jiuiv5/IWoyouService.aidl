package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;

interface IWoyouService {
    void printerInit(in ICallback callback);
    void printerSelfChecking(in ICallback callback);
    void getPrinterSerialNo(in ICallback callback);
    void getPrinterVersion(in ICallback callback);
    void getPrinterModal(in ICallback callback);
    void getPrintedLength(in ICallback callback);

    void lineWrap(int n, in ICallback callback);

    void sendRAWData(in byte[] data, in ICallback callback);

    void setAlignment(int alignment, in ICallback callback);
    void setFontName(String typeface, in ICallback callback);
    void setFontSize(float fontsize, in ICallback callback);

    void printText(String text, in ICallback callback);
    void printTextWithFont(String text, String typeface, float fontsize, in ICallback callback);
    void printOriginalText(String text, in ICallback callback);

    void printBarCode(String data, int symbology, int height, int width, int textposition, in ICallback callback);
    void printQRCode(String data, int modulesize, int errorlevel, in ICallback callback);

    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);
    void printColumnsString(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);

    void printBitmap(in android.graphics.Bitmap bitmap, in ICallback callback);
    void printBitmapCustom(in android.graphics.Bitmap bitmap, int type, in ICallback callback);

    void commitPrinterBuffer();
    void enterPrinterBuffer(boolean clean);
    void exitPrinterBuffer(boolean commit);

    void getPrinterFactory(in ICallback callback);
    void clearBuffer();

    void commitPrinterBufferWithCallback(in ICallback callback);
    void exitPrinterBufferWithCallback(boolean commit, in ICallback callback);

    void printString(String text, in ICallback callback);

    int updatePrinterState();
}
