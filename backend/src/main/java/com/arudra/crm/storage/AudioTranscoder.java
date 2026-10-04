package com.arudra.crm.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Converts uploaded audio that browsers can't play (phone call recordings in .amr/.3gp/.awb, .wma,
 * .wav, .ogg, and in-browser .webm recordings that carry no duration) into AAC .m4a, which every
 * browser — including iPhone Safari — plays and seeks. Runs the system {@code ffmpeg}; when ffmpeg
 * isn't installed or the conversion fails, the caller simply keeps the original file.
 */
@Slf4j
@Component
public class AudioTranscoder {

    /** Already plays everywhere — stored untouched. */
    private static final Set<String> PLAYABLE = Set.of("mp3", "m4a", "aac", "mp4");

    @Value("${app.audio.ffmpeg-path:ffmpeg}")
    private String ffmpegPath;

    @Value("${app.audio.ffprobe-path:ffprobe}")
    private String ffprobePath;

    @Value("${app.audio.transcode-timeout-seconds:180}")
    private long timeoutSeconds;

    public record Result(byte[] bytes, String contentType, String fileName) {}

    /** Audio codecs every browser decodes — a file already in one of these is stored untouched. */
    private static final Set<String> PLAYABLE_CODECS = Set.of("aac", "mp3");

    /**
     * True when this upload should be converted. Decided by the audio actually inside the file, not
     * its name: Android call recorders often save AMR audio in a file named ".m4a", which no browser
     * plays. When the codec can't be read (no ffprobe), falls back to the file extension.
     */
    public boolean needsTranscode(String contentType, String fileName, byte[] bytes) {
        String ext = extension(fileName);
        boolean audio = (contentType != null && contentType.startsWith("audio/"))
                || Set.of("amr", "3gp", "3ga", "awb", "wma", "wav", "ogg", "oga", "opus", "webm", "flac", "aiff", "caf",
                        "m4a", "aac", "mp3").contains(ext);
        if (!audio) return false;
        String codec = probeCodec(bytes, fileName);
        if (codec != null) return !PLAYABLE_CODECS.contains(codec);
        return !PLAYABLE.contains(ext);
    }

    /** Codec name of the first audio stream (e.g. "aac", "mp3", "amr_nb") via ffprobe; null if unknown. */
    public String probeCodec(byte[] input, String fileName) {
        String out = ffprobe(input, fileName, "-select_streams", "a:0", "-show_entries", "stream=codec_name");
        return out == null || out.isBlank() ? null : out.lines().findFirst().orElse("").trim().toLowerCase(Locale.ROOT);
    }

    /** Converts to mono AAC .m4a; returns null (keep the original) when ffmpeg is missing or fails. */
    public Result toM4a(byte[] input, String fileName) {
        Path in = null;
        Path out = null;
        try {
            String ext = extension(fileName);
            in = Files.createTempFile("aud-in-", ext.isEmpty() ? ".bin" : "." + ext);
            out = Files.createTempFile("aud-out-", ".m4a");
            Files.write(in, input);
            Process p = new ProcessBuilder(ffmpegPath, "-hide_banner", "-loglevel", "error", "-y",
                    "-i", in.toString(), "-vn", "-ac", "1", "-c:a", "aac", "-b:a", "64k",
                    "-movflags", "+faststart", out.toString())
                    .redirectErrorStream(true)
                    .start();
            String output = new String(p.getInputStream().readAllBytes());
            if (!p.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                log.warn("ffmpeg timed out converting {}", fileName);
                return null;
            }
            if (p.exitValue() != 0 || Files.size(out) == 0) {
                log.warn("ffmpeg could not convert {}: {}", fileName, output.trim());
                return null;
            }
            String base = fileName.contains(".") ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
            return new Result(Files.readAllBytes(out), "audio/mp4", base + ".m4a");
        } catch (java.io.IOException e) {
            log.warn("Audio conversion unavailable ({}); keeping original {}", e.getMessage(), fileName);
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } finally {
            deleteQuietly(in);
            deleteQuietly(out);
        }
    }

    /** Length of an audio file in whole seconds via {@code ffprobe}; null when it can't be read. */
    public Integer probeDurationSec(byte[] input, String fileName) {
        String out = ffprobe(input, fileName, "-show_entries", "format=duration");
        if (out == null) return null;
        try {
            double sec = Double.parseDouble(out.lines().findFirst().orElse("").trim());
            return sec > 0 ? (int) Math.round(sec) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Runs ffprobe on the bytes with the given query args; its plain output, or null on any failure. */
    private String ffprobe(byte[] input, String fileName, String... query) {
        Path in = null;
        try {
            String ext = extension(fileName);
            in = Files.createTempFile("aud-probe-", ext.isEmpty() ? ".bin" : "." + ext);
            Files.write(in, input);
            java.util.List<String> cmd = new java.util.ArrayList<>(java.util.List.of(ffprobePath, "-v", "error"));
            cmd.addAll(java.util.List.of(query));
            cmd.addAll(java.util.List.of("-of", "default=noprint_wrappers=1:nokey=1", in.toString()));
            Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            String output = new String(p.getInputStream().readAllBytes()).trim();
            if (!p.waitFor(30, TimeUnit.SECONDS) || p.exitValue() != 0) return null;
            return output;
        } catch (java.io.IOException e) {
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } finally {
            deleteQuietly(in);
        }
    }

    private static String extension(String name) {
        if (name == null || !name.contains(".")) return "";
        return name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private static void deleteQuietly(Path p) {
        if (p == null) return;
        try { Files.deleteIfExists(p); } catch (java.io.IOException ignored) { }
    }
}
