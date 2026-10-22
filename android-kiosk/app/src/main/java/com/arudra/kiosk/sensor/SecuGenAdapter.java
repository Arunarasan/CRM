package com.arudra.kiosk.sensor;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import SecuGen.FDxSDKPro.JSGFPLib;
import SecuGen.FDxSDKPro.SGDeviceInfoParam;
import SecuGen.FDxSDKPro.SGFDxDeviceName;
import SecuGen.FDxSDKPro.SGFDxErrorCode;

/**
 * SecuGen Hamster Pro 20 / Hamster IV and the rest of the family (USB vendor id 0x1162), through the
 * vendor's "FDx SDK Pro for Android" (jars in app/libs, native libraries in app/src/main/jniLibs).
 * Follows the SDK's own demo app: Init(auto) -> OpenDevice(0) -> GetDeviceInfo -> GetImageEx.
 * Returns the raw 8-bit grayscale image; the server builds the template itself, the same way for every brand.
 */
public class SecuGenAdapter implements SensorAdapter {
    private static final int VENDOR_SECUGEN = 0x1162;
    private static final long MIN_QUALITY = 50;   // the SDK keeps reading until the image is at least this good (0-100)

    private JSGFPLib lib;
    private int width, height, dpi;
    private boolean deviceOpen;
    private volatile boolean cancelled;

    @Override public String name() { return "SecuGen"; }

    @Override public boolean supports(UsbDevice d) { return d.getVendorId() == VENDOR_SECUGEN; }

    @Override public synchronized void open(Context context, UsbDevice device) throws SensorException {
        close();
        UsbManager usb = (UsbManager) context.getSystemService(Context.USB_SERVICE);
        JSGFPLib l = new JSGFPLib(context, usb);
        long err = l.Init(SGFDxDeviceName.SG_DEV_AUTO);
        if (err != SGFDxErrorCode.SGFDX_ERROR_NONE) {
            l.Close();
            throw new SensorException(describe(err, "Could not start the fingerprint scanner. Unplug it and plug it back in."));
        }
        err = l.OpenDevice(0);
        if (err != SGFDxErrorCode.SGFDX_ERROR_NONE) {
            l.Close();
            throw new SensorException(describe(err, "Could not open the fingerprint scanner. Unplug it and plug it back in."));
        }
        SGDeviceInfoParam info = new SGDeviceInfoParam();
        err = l.GetDeviceInfo(info);
        if (err != SGFDxErrorCode.SGFDX_ERROR_NONE || info.imageWidth <= 0 || info.imageHeight <= 0) {
            l.CloseDevice();
            l.Close();
            throw new SensorException("Could not read the scanner details. Unplug it and plug it back in.");
        }
        width = info.imageWidth;
        height = info.imageHeight;
        dpi = info.imageDPI > 0 ? info.imageDPI : 500;
        lib = l;
        deviceOpen = true;
    }

    @Override public Capture capture(int timeoutMs) throws SensorException {
        JSGFPLib l;
        synchronized (this) { l = lib; }
        if (l == null || !deviceOpen) throw new SensorException("Plug in the fingerprint scanner.");
        cancelled = false;
        byte[] image = new byte[width * height];
        try { l.SetLedOn(true); } catch (RuntimeException ignored) { }
        try {
            long err = l.GetImageEx(image, timeoutMs, MIN_QUALITY);
            if (cancelled) throw new SensorException("Scan cancelled.");
            if (err != SGFDxErrorCode.SGFDX_ERROR_NONE) throw new SensorException(describe(err, "Could not read the finger. Try again."));
        } finally {
            try { l.SetLedOn(false); } catch (RuntimeException ignored) { }
        }
        return new Capture("RAW", width, height, dpi, image);
    }

    @Override public void cancel() { cancelled = true; }

    @Override public synchronized void close() {
        JSGFPLib l = lib;
        lib = null;
        if (l != null) {
            try { if (deviceOpen) l.CloseDevice(); } catch (RuntimeException ignored) { }
            try { l.Close(); } catch (RuntimeException ignored) { }
        }
        deviceOpen = false;
    }

    /** Short plain messages for the person at the kiosk; the SDK's numeric codes mean nothing to them. */
    private static String describe(long err, String fallback) {
        if (err == SGFDxErrorCode.SGFDX_ERROR_TIME_OUT) return "No finger was placed on the scanner. Try again.";
        if (err == SGFDxErrorCode.SGFDX_ERROR_DEVICE_NOT_FOUND) return "The fingerprint scanner was not found. Plug it in.";
        if (err == SGFDxErrorCode.SGFDX_ERROR_WRONG_IMAGE || err == SGFDxErrorCode.SGFDX_ERROR_LINE_DROPPED
                || err == SGFDxErrorCode.SGFDX_ERROR_NO_IMAGE) return "The scan was unclear. Press the finger flat and try again.";
        if (err == SGFDxErrorCode.SGFDX_ERROR_FAKE_FINGER) return "That does not look like a live finger. Try again.";
        if (err == SGFDxErrorCode.SGFDX_ERROR_JNI_DLLLOAD_FAILED || err == SGFDxErrorCode.SGFDX_ERROR_DLLLOAD_FAILED
                || err == SGFDxErrorCode.SGFDX_ERROR_DLLLOAD_FAILED_DRV || err == SGFDxErrorCode.SGFDX_ERROR_DLLLOAD_FAILED_ALG) {
            return "The scanner driver could not load on this phone. Tell your administrator (error " + err + ").";
        }
        return fallback + " (error " + err + ")";
    }
}
