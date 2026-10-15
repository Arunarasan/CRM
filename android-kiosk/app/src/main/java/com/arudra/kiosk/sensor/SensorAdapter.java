package com.arudra.kiosk.sensor;

import android.content.Context;
import android.hardware.usb.UsbDevice;

/**
 * One implementation per scanner brand. The rest of the app only knows this interface, so adding a
 * brand means writing one adapter and listing it in {@link SensorRegistry}.
 */
public interface SensorAdapter {

    /** Result of one finger read, in the same shape the CRM page expects. */
    final class Capture {
        public final String format;   // RAW (8-bit grayscale), PNG, JPEG or ISO
        public final int width, height, dpi;
        public final byte[] data;

        public Capture(String format, int width, int height, int dpi, byte[] data) {
            this.format = format; this.width = width; this.height = height; this.dpi = dpi; this.data = data;
        }
    }

    /** Thrown with a short, plain message that is shown to the person at the kiosk. */
    class SensorException extends Exception {
        public SensorException(String message) { super(message); }
    }

    String name();

    /** True when this adapter drives the given USB device (match by vendor/product id). */
    boolean supports(UsbDevice device);

    /** Called once USB permission is granted. */
    void open(Context context, UsbDevice device) throws SensorException;

    /** Block until a finger is read or the timeout passes. Runs off the main thread. */
    Capture capture(int timeoutMs) throws SensorException;

    void cancel();

    void close();
}
