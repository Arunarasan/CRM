package com.arudra.crm.controller;

import com.arudra.crm.service.AdmsParser;
import com.arudra.crm.service.MachinePunchService;
import com.arudra.crm.util.RequestIp;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * ADMS ("iclock") endpoint that ZKTeco / eSSL fingerprint machines push to. Machines can't log in, so
 * this path is open in SecurityConfig and every request is admitted by serial number instead: only a
 * machine HR registered (and left active) is served. Responses are the plain-text replies the
 * protocol expects.
 *
 *   GET  /iclock/cdata?SN=..&options=all   handshake → push settings
 *   POST /iclock/cdata?SN=..&table=ATTLOG  punch lines → "OK: n"
 *   POST /iclock/cdata?SN=..&table=OPERLOG etc. → acknowledged, not stored
 *   GET  /iclock/getrequest?SN=..          poll for commands (our heartbeat) → "OK"
 *   POST /iclock/devicecmd?SN=..           command results → "OK"
 *
 * Older firmware uses the same paths with an ".aspx" suffix.
 */
@RestController
@RequestMapping("/iclock")
public class AdmsController {

    private static final Logger log = LoggerFactory.getLogger(AdmsController.class);
    private static final MediaType TEXT = new MediaType("text", "plain", StandardCharsets.UTF_8);
    private static final int MAX_BODY_BYTES = 2 * 1024 * 1024;

    private final MachinePunchService punchService;

    public AdmsController(MachinePunchService punchService) {
        this.punchService = punchService;
    }

    @GetMapping({"/cdata", "/cdata.aspx"})
    public ResponseEntity<String> handshake(@RequestParam(value = "SN", required = false) String sn,
                                            @RequestParam(value = "pushver", required = false) String pushVer,
                                            HttpServletRequest request) {
        MachinePunchService.Gate gate = punchService.admit(sn, RequestIp.of(request), pushVer);
        if (!gate.ok()) return refuse(sn, gate);
        // ATTLOGStamp=None asks for the full log on first contact; duplicates are ignored on our side.
        String body = "GET OPTION FROM: " + gate.machine().getSerialNumber() + "\n"
                + "ATTLOGStamp=None\n"
                + "OPERLOGStamp=9999\n"
                + "ATTPHOTOStamp=None\n"
                + "ErrorDelay=30\n"
                + "Delay=10\n"
                + "TransTimes=00:00;14:05\n"
                + "TransInterval=1\n"
                + "TransFlag=TransData AttLog\tOpLog\n"
                + "Realtime=1\n"
                + "Encrypt=None\n";
        return text(body);
    }

    @PostMapping({"/cdata", "/cdata.aspx"})
    public ResponseEntity<String> upload(@RequestParam(value = "SN", required = false) String sn,
                                         @RequestParam(value = "table", required = false) String table,
                                         HttpServletRequest request) throws IOException {
        MachinePunchService.Gate gate = punchService.admit(sn, RequestIp.of(request), null);
        if (!gate.ok()) return refuse(sn, gate);
        String body = readBody(request);
        if ("ATTLOG".equalsIgnoreCase(table)) {
            MachinePunchService.IngestResult r = punchService.ingestAttLog(gate.machine(), body);
            return text("OK: " + r.received());
        }
        // OPERLOG (enrolments, admin actions), ATTPHOTO, etc.: acknowledge so the machine moves on.
        return text("OK: " + AdmsParser.countLines(body));
    }

    @GetMapping({"/getrequest", "/getrequest.aspx"})
    public ResponseEntity<String> poll(@RequestParam(value = "SN", required = false) String sn,
                                       HttpServletRequest request) {
        MachinePunchService.Gate gate = punchService.admit(sn, RequestIp.of(request), null);
        if (!gate.ok()) return refuse(sn, gate);
        return text("OK");
    }

    @PostMapping({"/devicecmd", "/devicecmd.aspx"})
    public ResponseEntity<String> commandResult(@RequestParam(value = "SN", required = false) String sn,
                                                HttpServletRequest request) {
        MachinePunchService.Gate gate = punchService.admit(sn, RequestIp.of(request), null);
        if (!gate.ok()) return refuse(sn, gate);
        return text("OK");
    }

    @GetMapping({"/ping", "/ping.aspx"})
    public ResponseEntity<String> ping(@RequestParam(value = "SN", required = false) String sn,
                                       HttpServletRequest request) {
        MachinePunchService.Gate gate = punchService.admit(sn, RequestIp.of(request), null);
        if (!gate.ok()) return refuse(sn, gate);
        return text("OK");
    }

    private static ResponseEntity<String> refuse(String sn, MachinePunchService.Gate gate) {
        log.debug("ADMS request from machine {} refused: {}", sn, gate.access());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).contentType(TEXT).body("UNAUTHORIZED");
    }

    private static ResponseEntity<String> text(String body) {
        return ResponseEntity.ok().contentType(TEXT).body(body);
    }

    /** Reads the raw body whatever content type the firmware claims (often "application/push"). */
    private static String readBody(HttpServletRequest request) throws IOException {
        byte[] bytes = request.getInputStream().readNBytes(MAX_BODY_BYTES);
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
