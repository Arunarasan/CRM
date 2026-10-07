package com.arudra.crm.controller;

import com.arudra.crm.storage.S3StorageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

import org.springframework.http.HttpRange;

import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.channels.FileChannel;
import java.nio.channels.WritableByteChannel;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.List;

/**
 * Serves "/uploads/..." links from S3 / R2 when that storage is active. Those links are what the
 * app saves when no public bucket URL is configured ({@code app.storage.s3.public-base-url}), so
 * without this they pointed at the backend's local disk — where the file isn't — and every
 * uploaded recording, voice note and photo came back 404. Forwards the browser's Range header so
 * audio and video can seek. Takes precedence over the local /uploads/** resource handler.
 * A file still on the server disk (saved there while the bucket was unreachable) is served from
 * disk first.
 */
@RestController
@ConditionalOnExpression("'${app.storage.type:local}'.equalsIgnoreCase('s3') || '${app.storage.type:local}'.equalsIgnoreCase('r2')")
public class UploadsController {

    private final S3StorageService storage;

    public UploadsController(S3StorageService storage) {
        this.storage = storage;
    }

    @GetMapping("/uploads/**")
    public void serve(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        String key = java.net.URLDecoder.decode(path.substring("/uploads/".length()), java.nio.charset.StandardCharsets.UTF_8);
        if (key.isBlank() || key.contains("..")) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        String range = request.getHeader(HttpHeaders.RANGE);
        // Saved on the server disk while the bucket was unreachable (and not yet copied over).
        Path local = storage.diskCopy(key);
        if (local != null) {
            serveFromDisk(local, key, range, response);
            return;
        }
        ResponseInputStream<GetObjectResponse> in;
        try {
            in = storage.open(key, range);
        } catch (NoSuchFileException e) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        } catch (S3Exception e) {
            if (e.statusCode() == 416) {
                response.sendError(416);
                return;
            }
            response.sendError(e.statusCode() == 404 ? HttpServletResponse.SC_NOT_FOUND : HttpServletResponse.SC_BAD_GATEWAY);
            return;
        }
        try (InputStream body = in) {
            GetObjectResponse meta = in.response();
            String type = meta.contentType();
            if (type == null || type.isBlank() || type.equals("application/octet-stream")) {
                type = MediaTypeFactory.getMediaType(key).map(MediaType::toString).orElse("application/octet-stream");
            }
            response.setContentType(type);
            response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
            response.setHeader(HttpHeaders.CACHE_CONTROL, "public, max-age=86400");
            if (meta.contentRange() != null) {
                response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
                response.setHeader(HttpHeaders.CONTENT_RANGE, meta.contentRange());
            }
            if (meta.contentLength() != null) response.setContentLengthLong(meta.contentLength());
            body.transferTo(response.getOutputStream());
        }
    }

    /** Streams a disk file, honouring a single-range Range header so audio and video can seek. */
    private void serveFromDisk(Path file, String key, String range, HttpServletResponse response) throws IOException {
        long size = Files.size(file);
        long start = 0;
        long end = size - 1;
        response.setContentType(MediaTypeFactory.getMediaType(key).map(MediaType::toString).orElse("application/octet-stream"));
        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        response.setHeader(HttpHeaders.CACHE_CONTROL, "public, max-age=86400");
        if (range != null && !range.isBlank()) {
            try {
                List<HttpRange> ranges = HttpRange.parseRanges(range);
                if (!ranges.isEmpty()) {
                    start = ranges.get(0).getRangeStart(size);
                    end = ranges.get(0).getRangeEnd(size);
                    response.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
                    response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + size);
                }
            } catch (IllegalArgumentException e) {
                response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + size);
                response.sendError(416);
                return;
            }
        }
        long length = size == 0 ? 0 : end - start + 1;
        response.setContentLengthLong(length);
        try (FileChannel channel = FileChannel.open(file);
             WritableByteChannel out = Channels.newChannel(response.getOutputStream())) {
            long position = start;
            long remaining = length;
            while (remaining > 0) {
                long sent = channel.transferTo(position, remaining, out);
                if (sent <= 0) break;
                position += sent;
                remaining -= sent;
            }
        }
    }
}
