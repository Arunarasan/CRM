package com.arudra.crm.service;

import com.arudra.crm.storage.PrivateFileStore;
import com.arudra.crm.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaTypeFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.NoSuchFileException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Moves sensitive files uploaded before private storage existed off the public bucket/path: every
 * text column holding a link to a private-module file ("/uploads/PAYMENT/…" or
 * "https://&lt;public-domain&gt;/CALL_RECORDING/…") is rewritten to "/api/files/private/…", the bytes are
 * copied into {@link PrivateFileStore}, and the public copy is deleted. Safe to run repeatedly.
 */
@Service
public class PrivateFileMigrationService {

    private static final Logger log = LoggerFactory.getLogger(PrivateFileMigrationService.class);
    private static final String MODULES = String.join("|", PrivateFileStore.PRIVATE_MODULES);

    private final JdbcTemplate jdbc;
    private final StorageService publicStorage;
    private final PrivateFileStore privateStore;
    private final Pattern linkPattern;

    public PrivateFileMigrationService(JdbcTemplate jdbc, @Qualifier("backendStorage") StorageService publicStorage,
                                       PrivateFileStore privateStore,
                                       @Value("${app.storage.s3.public-base-url:}") String publicBaseUrl) {
        this.jdbc = jdbc;
        this.publicStorage = publicStorage;
        this.privateStore = privateStore;
        // Our own links only: anything ending in /uploads/<key>, or <public-base-url>/<key>.
        String publicBase = StringUtils.hasText(publicBaseUrl) ? Pattern.quote(publicBaseUrl.replaceAll("/+$", "")) + "/" : null;
        String prefix = "(?:[^\\s\"'<>]*?/uploads/" + (publicBase != null ? "|" + publicBase : "") + ")";
        this.linkPattern = Pattern.compile(prefix + "((?:" + MODULES + ")/\\d{4}/\\d{2}/[^\\s\"'<>?#]+)");
    }

    public synchronized Map<String, Object> run() {
        int columnsScanned = 0, filesMoved = 0, missing = 0;
        long rowsUpdated = 0;
        List<Map<String, Object>> columns = jdbc.queryForList(
                "SELECT table_name AS t, column_name AS c FROM information_schema.columns "
                        + "WHERE table_schema = DATABASE() AND data_type IN ('varchar','text','mediumtext','longtext','json') "
                        + "AND table_name <> 'flyway_schema_history'");
        Map<String, String> moved = new LinkedHashMap<>(); // old link → new link
        for (Map<String, Object> col : columns) {
            String t = "`" + col.get("t") + "`", c = "`" + col.get("c") + "`";
            columnsScanned++;
            List<String> values = jdbc.queryForList("SELECT DISTINCT " + c + " FROM " + t
                    + " WHERE " + c + " REGEXP ?", String.class, "/(" + MODULES + ")/[0-9]{4}/[0-9]{2}/");
            Set<String> links = new LinkedHashSet<>();
            for (String v : values) {
                if (v == null) continue;
                Matcher m = linkPattern.matcher(v);
                while (m.find()) links.add(m.group());
            }
            for (String link : links) {
                if (PrivateFileStore.isPrivateUrl(link)) continue;
                String newLink = moved.get(link);
                if (newLink == null) {
                    Matcher m = linkPattern.matcher(link);
                    if (!m.matches()) continue;
                    String key = m.group(1);
                    try {
                        byte[] bytes = publicStorage.read(key);
                        privateStore.put(key, bytes, MediaTypeFactory.getMediaType(key).map(Object::toString).orElse(null));
                        publicStorage.delete(key);
                        filesMoved++;
                    } catch (NoSuchFileException e) {
                        missing++; // already gone from public storage — still repoint the link
                    } catch (Exception e) {
                        log.warn("Could not move {} to private storage: {}", key, e.getMessage());
                        continue;
                    }
                    newLink = PrivateFileStore.URL_PREFIX + key;
                    moved.put(link, newLink);
                }
                rowsUpdated += jdbc.update("UPDATE " + t + " SET " + c + " = REPLACE(" + c + ", ?, ?) WHERE INSTR(" + c + ", ?) > 0",
                        link, newLink, link);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("columnsScanned", columnsScanned);
        result.put("filesMoved", filesMoved);
        result.put("filesAlreadyMissing", missing);
        result.put("rowsUpdated", rowsUpdated);
        log.info("Private-file migration: {}", result);
        return result;
    }
}
