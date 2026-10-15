package com.arudra.kiosk.sensor;

import android.content.Context;
import android.hardware.usb.UsbDevice;

/**
 * SecuGen Hamster Pro 20 / Hamster IV (USB vendor id 0x1162).
 *
 * The SecuGen "FDx SDK Pro for Android" is a vendor download and is NOT in this repo. Until its jar
 * and .so files are added (see README), this adapter reports a clear error instead of crashing.
 *
 * To finish it, with the SDK in app/libs and app/src/main/jniLibs, follow SecuGen's sample app:
 *   open():    create the SDK's JSGFPLib with the context and UsbManager, Init with the auto device,
 *              OpenDevice(0), then read the device info (image width, height and DPI).
 *   capture(): allocate width*height bytes, ask the SDK for one image with the timeout, and
 *              return new Capture("RAW", width, height, dpi, bytes).
 *   close():   CloseDevice and Close the library.
 * If the SDK turns out not to expose the image, return an ISO 19794-2 template as
 * new Capture("ISO", 0, 0, 0, template) instead; the server accepts both.
 */
public class SecuGenAdapter implements SensorAdapter {
    private static final int VENDOR_SECUGEN = 0x1162;

    @Override public String name() { return "SecuGen"; }

    @Override public boolean supports(UsbDevice d) { return d.getVendorId() == VENDOR_SECUGEN; }

    @Override public void open(Context context, UsbDevice device) throws SensorException {
        throw new SensorException("Scanner driver not installed in this app yet.");
    }

    @Override public Capture capture(int timeoutMs) throws SensorException {
        throw new SensorException("Scanner driver not installed in this app yet.");
    }

    @Override public void cancel() { }

    @Override public void close() { }
}
