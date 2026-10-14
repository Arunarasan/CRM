package com.arudra.crm.service;

import java.util.Random;

/**
 * A procedurally generated fingerprint-like image for tests: parallel ridges bent around a handful of
 * point dislocations (each one makes a ridge ending / bifurcation, which is what a matcher keys on).
 * Different seeds are different "fingers"; the same seed rendered with different noise, shift and
 * rotation is the "same finger touched again". It proves the plumbing, NOT real-world accuracy.
 */
final class SyntheticFingerprint {

    static final int W = 300;
    static final int H = 400;

    private SyntheticFingerprint() {}

    /** 8-bit grayscale pixels, row-major, W x H. */
    static byte[] render(long fingerSeed, long touchSeed) {
        Random finger = new Random(fingerSeed);
        double angle = finger.nextDouble() * Math.PI;
        double period = 9 + finger.nextDouble() * 1.5; // ridge spacing in pixels at 500 dpi
        int n = 14;
        double[] px = new double[n], py = new double[n], charge = new double[n];
        for (int i = 0; i < n; i++) {
            px[i] = 40 + finger.nextDouble() * (W - 80);
            py[i] = 50 + finger.nextDouble() * (H - 100);
            charge[i] = finger.nextBoolean() ? 1 : -1;
        }

        Random touch = new Random(touchSeed);
        double dx = (touch.nextDouble() - 0.5) * 16, dy = (touch.nextDouble() - 0.5) * 16; // finger lands a bit differently
        double rot = (touch.nextDouble() - 0.5) * 0.10;                                    // up to ~3 degrees
        double cos = Math.cos(rot), sin = Math.sin(rot);

        byte[] out = new byte[W * H];
        for (int y = 0; y < H; y++) {
            for (int x = 0; x < W; x++) {
                double cx = x - W / 2.0, cy = y - H / 2.0;
                double u = cos * cx - sin * cy + W / 2.0 + dx;
                double v = sin * cx + cos * cy + H / 2.0 + dy;
                double phase = 2 * Math.PI / period * (u * Math.cos(angle) + v * Math.sin(angle));
                for (int i = 0; i < n; i++) phase += charge[i] * Math.atan2(v - py[i], u - px[i]);
                double value = 128 + 95 * Math.cos(phase) + touch.nextGaussian() * 9;
                // fade to white at the edges like the border of a real scan
                double edge = Math.min(Math.min(x, W - 1 - x), Math.min(y, H - 1 - y));
                if (edge < 12) value = 255 - (255 - value) * (edge / 12.0);
                out[y * W + x] = (byte) Math.max(0, Math.min(255, Math.round(value)));
            }
        }
        return out;
    }
}
