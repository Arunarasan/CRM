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

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.NoSuchFileException;

/**
 * Serves "/uploads/..." links from S3 / R2 when that storage is active. Those links are what the
 * app saves when no public bucket URL is configured ({@code app.storage.s3.public-base-url}), so
 * without this they pointed at the backend's local disk — where the file isn't — and every
 * uploaded recording, voice note and photo came back 404. Forwards the browser's Range header so
 * audio and video can seek. Takes precedence over the local /uploads/** resource handler.
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
}
