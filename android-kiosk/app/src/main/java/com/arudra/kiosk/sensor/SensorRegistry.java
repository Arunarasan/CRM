package com.arudra.kiosk.sensor;

import android.hardware.usb.UsbDevice;

/** The list of supported scanner brands. Add a new adapter here to support another brand. */
public final class SensorRegistry {
    private SensorRegistry() { }

    public static SensorAdapter[] create() {
        return new SensorAdapter[] { new SecuGenAdapter() };
    }

    public static SensorAdapter forDevice(SensorAdapter[] all, UsbDevice device) {
        for (SensorAdapter a : all) if (a.supports(device)) return a;
        return null;
    }
}
