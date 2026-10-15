package com.arudra.crm.service;

import lombok.extern.slf4j.Slf4j;
import com.arudra.crm.storage.S3StorageService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * On-demand backups that are streamed straight to the admin's browser — nothing is kept on the server.
 * The database dump is written in plain JDBC (no {@code mysqldump} binary needed, so it also works against a
 * remote managed MySQL): schema + multi-row INSERTs, read inside one consistent-snapshot transaction.
 */
@Slf4j
@Service
public class BackupService {

    private static final int INSERT_BATCH = 200;

    private final DataSource dataSource;
    private final String uploadDir;
    private final String storageType;
    private final ObjectProvider<S3StorageService> bucket;

    /** One-time download tickets (a plain link cannot carry the login header). ticket -> expiry + kind. */
    private record Ticket(long expiresAtMs, String kind) { }
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    public BackupService(DataSource dataSource,
                         @Value("${app.upload.dir:./uploads}") String uploadDir,
                         @Value("${app.storage.type:local}") String storageType,
                         ObjectProvider<S3StorageService> bucket) {
        this.dataSource = dataSource;
        this.uploadDir = uploadDir;
        this.storageType = storageType;
        this.bucket = bucket;
    }

    /** Issues a single-use ticket (valid 2 minutes) that lets the browser start a download by plain link. */
    public String issueTicket(String kind) {
        long now = System.currentTimeMillis();
        tickets.values().removeIf(t -> t.expiresAtMs() < now);
        byte[] b = new byte[24];
        random.nextBytes(b);
        String id = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        tickets.put(id, new Ticket(now + 120_000, kind));
        return id;
    }

    /** True once, only for an unexpired ticket of the same kind. */
    public boolean redeemTicket(String id, String kind) {
        if (id == null) return false;
        Ticket t = tickets.remove(id);
        return t != null && t.expiresAtMs() >= System.currentTimeMillis() && t.kind().equals(kind);
    }

    /** Table → approximate row count, plus where uploaded files live. */
    public Map<String, Object> info() throws SQLException {
        Map<String, Object> out = new LinkedHashMap<>();
        long rows = 0;
        int tables = 0;
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT table_rows FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'")) {
            while (rs.next()) { tables++; rows += rs.getLong(1); }
        }
        out.put("tables", tables);
        out.put("approxRows", rows);
        out.put("storageType", storageType);
        out.put("filesIncluded", true);
        long[] f = localFileStats();
        S3StorageService s3 = bucket.getIfAvailable();
        if (s3 != null) {
            try {
                s3.forEachObject((k, size) -> { f[0]++; f[1] += size; });
            } catch (RuntimeException e) {
                log.warn("Could not list the storage bucket for backup info: {}", e.getMessage());
                out.put("bucketError", true);
            }
        }
        out.put("fileCount", f[0]);
        out.put("fileBytes", f[1]);
        return out;
    }

    public boolean isLocalStorage() {
        return "local".equalsIgnoreCase(storageType);
    }

    /** Streams a gzip-compressed SQL dump of every base table. */
    public void writeDatabaseDump(OutputStream target) throws IOException, SQLException {
        try (GZIPOutputStream gz = new GZIPOutputStream(target, 64 * 1024);
             BufferedWriter w = new BufferedWriter(new OutputStreamWriter(gz, StandardCharsets.UTF_8), 64 * 1024);
             Connection c = dataSource.getConnection()) {
            c.setReadOnly(true);
            c.setAutoCommit(false);
            c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            try (Statement st = c.createStatement()) {
                st.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT");
            } catch (SQLException ignored) {
                // Non-MySQL / already in a transaction: the REPEATABLE READ above still applies.
            }

            w.write("-- Arudra CRM database backup\n");
            w.write("-- Generated " + java.time.OffsetDateTime.now() + "\n\n");
            w.write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\nSET time_zone='+00:00';\n\n");

            List<String> tables = new ArrayList<>();
            try (Statement st = c.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name")) {
                while (rs.next()) tables.add(rs.getString(1));
            }

            for (String table : tables) {
                dumpTable(c, w, table);
            }
            w.write("SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n");
            w.flush();
            c.rollback();
            gz.finish();
        }
        log.info("Database backup streamed ({} tables)", "all");
    }

    private void dumpTable(Connection c, BufferedWriter w, String table) throws SQLException, IOException {
        String q = "`" + table.replace("`", "``") + "`";
        w.write("-- ----------------------------\n-- Table " + table + "\n-- ----------------------------\n");
        w.write("DROP TABLE IF EXISTS " + q + ";\n");
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SHOW CREATE TABLE " + q)) {
            if (rs.next()) w.write(rs.getString(2) + ";\n\n");
        }

        try (Statement st = c.createStatement(ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY)) {
            st.setFetchSize(Integer.MIN_VALUE); // stream rows instead of loading the table into memory
            try (ResultSet rs = st.executeQuery("SELECT * FROM " + q)) {
                ResultSetMetaData md = rs.getMetaData();
                int cols = md.getColumnCount();
                StringBuilder head = new StringBuilder("INSERT INTO " + q + " (");
                for (int i = 1; i <= cols; i++) {
                    if (i > 1) head.append(',');
                    head.append('`').append(md.getColumnName(i).replace("`", "``")).append('`');
                }
                head.append(") VALUES\n");

                int inBatch = 0;
                while (rs.next()) {
                    w.write(inBatch == 0 ? head.toString() : ",\n");
                    w.write('(');
                    for (int i = 1; i <= cols; i++) {
                        if (i > 1) w.write(',');
                        w.write(literal(rs, md, i));
                    }
                    w.write(')');
                    if (++inBatch >= INSERT_BATCH) {
                        w.write(";\n");
                        inBatch = 0;
                    }
                }
                if (inBatch > 0) w.write(";\n");
            }
        }
        w.write("\n");
    }

    private static String literal(ResultSet rs, ResultSetMetaData md, int i) throws SQLException {
        int type = md.getColumnType(i);
        switch (type) {
            case Types.BIT:
            case Types.BINARY:
            case Types.VARBINARY:
            case Types.LONGVARBINARY:
            case Types.BLOB: {
                byte[] b = rs.getBytes(i);
                if (b == null) return "NULL";
                if (b.length == 0) return "''";
                StringBuilder sb = new StringBuilder(2 + b.length * 2).append("0x");
                for (byte x : b) sb.append(Character.forDigit((x >> 4) & 0xF, 16)).append(Character.forDigit(x & 0xF, 16));
                return sb.toString();
            }
            case Types.TINYINT:
            case Types.SMALLINT:
            case Types.INTEGER:
            case Types.BIGINT:
            case Types.DECIMAL:
            case Types.NUMERIC:
            case Types.FLOAT:
            case Types.REAL:
            case Types.DOUBLE: {
                String s = rs.getString(i);
                return s == null ? "NULL" : s;
            }
            case Types.BOOLEAN: {
                String s = rs.getString(i);
                if (s == null) return "NULL";
                return "true".equalsIgnoreCase(s) ? "1" : ("false".equalsIgnoreCase(s) ? "0" : s);
            }
            default: {
                // Dates/times are taken as text so no timezone conversion is applied.
                String s = rs.getString(i);
                return s == null ? "NULL" : quote(s);
            }
        }
    }

    private static String quote(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 2).append('\'');
        for (int k = 0; k < s.length(); k++) {
            char ch = s.charAt(k);
            switch (ch) {
                case '\0': sb.append("\\0"); break;
                case '\'': sb.append("\\'"); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\u001a': sb.append("\\Z"); break;
                default: sb.append(ch);
            }
        }
        return sb.append('\'').toString();
    }

    /**
     * Streams a zip of every uploaded file: whatever is on the server disk, plus (when cloud storage is
     * active) every object in the bucket. A file present in both places is only added once.
     */
    public void writeFilesZip(OutputStream target) throws IOException {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Set<String> added = new HashSet<>();
        try (ZipOutputStream zip = new ZipOutputStream(target)) {
            zip.setLevel(1); // photos/audio are already compressed
            if (Files.isDirectory(root)) {
                try (Stream<Path> walk = Files.walk(root)) {
                    for (Path p : (Iterable<Path>) walk.filter(Files::isRegularFile)::iterator) {
                        String name = root.relativize(p).toString().replace(java.io.File.separatorChar, '/');
                        if (name.startsWith(".")) continue;
                        zip.putNextEntry(new ZipEntry("uploads/" + name));
                        Files.copy(p, zip);
                        zip.closeEntry();
                        added.add(name);
                    }
                }
            }
            S3StorageService s3 = bucket.getIfAvailable();
            if (s3 != null) {
                List<String> keys = new ArrayList<>();
                s3.forEachObject((k, size) -> { if (!added.contains(k)) keys.add(k); });
                for (String key : keys) {
                    try (java.io.InputStream in = s3.open(key, null)) {
                        zip.putNextEntry(new ZipEntry("uploads/" + key));
                        in.transferTo(zip);
                        zip.closeEntry();
                    } catch (java.nio.file.NoSuchFileException e) {
                        log.warn("Backup skipped {} (deleted while listing)", key);
                    }
                }
            }
        }
    }

    private long[] localFileStats() {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        long[] out = new long[2];
        if (!Files.isDirectory(root)) return out;
        try (Stream<Path> walk = Files.walk(root)) {
            walk.filter(Files::isRegularFile).forEach(p -> {
                out[0]++;
                try { out[1] += Files.size(p); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
        return out;
    }
}
