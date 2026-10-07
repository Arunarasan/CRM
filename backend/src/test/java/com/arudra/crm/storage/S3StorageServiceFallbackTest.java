package com.arudra.crm.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/** The bucket is unreachable (nothing listens on the endpoint): uploads must land on disk, not fail. */
class S3StorageServiceFallbackTest {

    @TempDir
    Path uploads;

    private S3StorageService storage;

    @BeforeEach
    void setUp() {
        S3StorageProperties props = new S3StorageProperties();
        props.setBucket("test-bucket");
        props.setRegion("auto");
        props.setEndpoint("http://127.0.0.1:9"); // discard port — connection refused
        props.setAccessKey("test");
        props.setSecretKey("test");
        props.setPublicBaseUrl("https://files.example.com");
        storage = new S3StorageService(props);
        ReflectionTestUtils.setField(storage, "uploadDir", uploads.toString());
        storage.init();
    }

    @Test
    void uploadFallsBackToDiskWithRelativeLink() throws Exception {
        byte[] bytes = "photo-bytes".getBytes(StandardCharsets.UTF_8);

        StoredFile stored = storage.store(bytes, "image/jpeg", "LEAD", "site photo.jpg");

        assertTrue(stored.fileUrl().startsWith("/uploads/LEAD/"), "disk fallback must use a server link: " + stored.fileUrl());
        assertEquals("site_photo.jpg", stored.fileName());
        String key = stored.fileUrl().substring("/uploads/".length());
        Path onDisk = storage.diskCopy(key);
        assertNotNull(onDisk, "file must be on disk");
        assertArrayEquals(bytes, Files.readAllBytes(onDisk));
        assertArrayEquals(bytes, storage.read(key), "read() must find the disk copy first");
        try (var files = Files.walk(uploads)) {
            assertTrue(files.noneMatch(p -> p.getFileName().toString().startsWith(".part-")), "no temp files left behind");
        }
    }

    @Test
    void copyJobKeepsDiskFileWhileBucketIsUnreachable() throws Exception {
        StoredFile stored = storage.store("x".getBytes(StandardCharsets.UTF_8), "image/jpeg", "LEAD", "a.jpg");
        String key = stored.fileUrl().substring("/uploads/".length());
        Path onDisk = storage.diskCopy(key);
        Files.setLastModifiedTime(onDisk, FileTime.from(Instant.now().minusSeconds(600)));

        storage.copyDiskFilesToBucket();

        assertTrue(Files.exists(onDisk), "must not delete the disk copy when the bucket upload failed");
    }

    @Test
    void copyJobMovesDiskFileIntoBucketOnceReachable() throws Exception {
        StoredFile stored = storage.store("hello-bucket".getBytes(StandardCharsets.UTF_8), "image/jpeg", "LEAD", "b.jpg");
        String key = stored.fileUrl().substring("/uploads/".length());
        Path onDisk = storage.diskCopy(key);
        Files.setLastModifiedTime(onDisk, FileTime.from(Instant.now().minusSeconds(600)));

        // A minimal stand-in for the bucket: PUT stores the body, HEAD reports its size.
        java.util.Map<String, byte[]> bucket = new java.util.concurrent.ConcurrentHashMap<>();
        com.sun.net.httpserver.HttpServer server = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            if ("PUT".equals(ex.getRequestMethod())) {
                byte[] body = ex.getRequestBody().readAllBytes();
                String sha = ex.getRequestHeaders().getFirst("x-amz-content-sha256");
                if (sha != null && sha.startsWith("STREAMING-")) body = decodeAwsChunked(body);
                bucket.put(path, body);
                try { // the SDK checks the ETag against the body's MD5
                    String md5 = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("MD5").digest(body));
                    ex.getResponseHeaders().add("ETag", "\"" + md5 + "\"");
                } catch (java.security.NoSuchAlgorithmException e) {
                    throw new IllegalStateException(e);
                }
                ex.sendResponseHeaders(200, -1);
            } else if ("HEAD".equals(ex.getRequestMethod()) && bucket.containsKey(path)) {
                ex.getResponseHeaders().add("Content-Length", String.valueOf(bucket.get(path).length));
                ex.sendResponseHeaders(200, -1);
            } else {
                ex.sendResponseHeaders(404, -1);
            }
            ex.close();
        });
        server.start();
        try {
            S3StorageProperties props = new S3StorageProperties();
            props.setBucket("test-bucket");
            props.setRegion("auto");
            props.setEndpoint("http://127.0.0.1:" + server.getAddress().getPort());
            props.setAccessKey("test");
            props.setSecretKey("test");
            S3StorageService reachable = new S3StorageService(props);
            ReflectionTestUtils.setField(reachable, "uploadDir", uploads.toString());
            reachable.init();

            reachable.copyDiskFilesToBucket();

            assertArrayEquals("hello-bucket".getBytes(StandardCharsets.UTF_8), bucket.get("/test-bucket/" + key));
            assertFalse(Files.exists(onDisk), "disk copy is removed once the bucket holds it");
        } finally {
            server.stop(0);
        }
    }

    /** "size;chunk-signature=…\r\n data \r\n" repeated, ending with a 0-size chunk (and optional trailers). */
    private static byte[] decodeAwsChunked(byte[] in) {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        int i = 0;
        while (i < in.length) {
            int lineEnd = i;
            while (lineEnd + 1 < in.length && !(in[lineEnd] == '\r' && in[lineEnd + 1] == '\n')) lineEnd++;
            String header = new String(in, i, lineEnd - i, StandardCharsets.US_ASCII);
            int size = Integer.parseInt(header.split(";")[0].trim(), 16);
            if (size == 0) break;
            out.write(in, lineEnd + 2, size);
            i = lineEnd + 2 + size + 2;
        }
        return out.toByteArray();
    }

    @Test
    void diskCopyRejectsPathTraversal() {
        assertNull(storage.diskCopy("../../etc/passwd"));
    }
}
