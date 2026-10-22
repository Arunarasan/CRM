package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeFingerprint;
import com.arudra.crm.repository.EmployeeFingerprintRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.service.FingerprintService.Capture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Enrolment and identification plumbing, on synthetic fingerprint images (see SyntheticFingerprint).
 * This proves the pipeline (image to template, same-finger matching, refusing mixed scans, duplicates,
 * blank scans, 1:N identification); it does NOT measure real-sensor accuracy.
 */
@ExtendWith(MockitoExtension.class)
class FingerprintServiceTest {

    @Mock EmployeeFingerprintRepository fingerprintRepository;
    @Mock EmployeeRepository employeeRepository;
    @InjectMocks FingerprintService service;

    private Employee ravi;

    @BeforeEach
    void setUp() {
        ravi = employee(1L, "Ravi", "K");
    }

    private static Employee employee(long id, String first, String last) {
        Employee e = new Employee();
        e.setId(id);
        e.setFirstName(first);
        e.setLastName(last);
        e.setIsDeleted(false);
        return e;
    }

    private static Capture scan(long finger, long touch) {
        byte[] px = SyntheticFingerprint.render(finger, touch);
        return new Capture("RAW", SyntheticFingerprint.W, SyntheticFingerprint.H, 500.0, Base64.getEncoder().encodeToString(px));
    }

    /** The same synthetic touch as an 8-bit grayscale BMP, the way SecuGen WebAPI returns a scan. */
    private static Capture bmpScan(long finger, long touch) throws java.io.IOException {
        byte[] px = SyntheticFingerprint.render(finger, touch);
        var img = new java.awt.image.BufferedImage(SyntheticFingerprint.W, SyntheticFingerprint.H, java.awt.image.BufferedImage.TYPE_BYTE_GRAY);
        img.getRaster().setDataElements(0, 0, SyntheticFingerprint.W, SyntheticFingerprint.H, px);
        var out = new java.io.ByteArrayOutputStream();
        assertTrue(javax.imageio.ImageIO.write(img, "bmp", out));
        return new Capture("BMP", SyntheticFingerprint.W, SyntheticFingerprint.H, 500.0, Base64.getEncoder().encodeToString(out.toByteArray()));
    }

    private static Capture blank() {
        byte[] px = new byte[SyntheticFingerprint.W * SyntheticFingerprint.H];
        java.util.Arrays.fill(px, (byte) 255);
        return new Capture("RAW", SyntheticFingerprint.W, SyntheticFingerprint.H, 500.0, Base64.getEncoder().encodeToString(px));
    }

    private EmployeeFingerprint stored(Employee e, int finger, Capture c) {
        EmployeeFingerprint f = new EmployeeFingerprint();
        f.setEmployee(e);
        f.setFinger(finger);
        f.setSampleNo(1);
        f.setTemplate(service.toTemplate(c).toByteArray());
        f.setEngineVersion("test");
        return f;
    }

    @Test
    void secugenBmpScanMatchesTheSameFingerAsRaw() throws Exception {
        var fromBmp = service.toTemplate(bmpScan(1, 100));
        var fromRaw = service.toTemplate(scan(1, 200));
        double same = new com.machinezoo.sourceafis.FingerprintMatcher(fromBmp).match(fromRaw);
        double other = new com.machinezoo.sourceafis.FingerprintMatcher(fromBmp).match(service.toTemplate(scan(2, 200)));
        assertTrue(same >= 40, "same finger score " + same);
        assertTrue(other < 40, "other finger score " + other);
    }

    @Test
    void enrolmentNeedsConsent() {
        assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, 2, List.of(scan(1, 100), scan(1, 200)), false, "hr"));
        verify(fingerprintRepository, never()).save(any());
    }

    @Test
    void oneScanIsNotEnough() {
        assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, 2, List.of(scan(1, 100)), true, "hr"));
    }

    @Test
    void scansOfDifferentFingersAreRejected() {
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(ravi));
        var ex = assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, 2, List.of(scan(1, 100), scan(2, 200)), true, "hr"));
        assertTrue(ex.getMessage().contains("do not match each other"));
        verify(fingerprintRepository, never()).save(any());
    }

    @Test
    void blankScanIsRejected() {
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(ravi));
        var ex = assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, 2, List.of(blank(), blank()), true, "hr"));
        assertTrue(ex.getMessage().contains("too faint"));
    }

    @Test
    void fingerAlreadyEnrolledForSomeoneElseIsRejected() {
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(ravi));
        Employee meena = employee(2L, "Meena", "S");
        when(fingerprintRepository.findAllExcept(1L)).thenReturn(List.of(stored(meena, 2, scan(1, 300))));
        var ex = assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, 2, List.of(scan(1, 100), scan(1, 200)), true, "hr"));
        assertTrue(ex.getMessage().contains("Meena"));
        verify(fingerprintRepository, never()).deleteFinger(any(), any());
    }

    @Test
    void validEnrolmentReplacesThatFingerOnly() {
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(ravi));
        when(fingerprintRepository.findAllExcept(1L)).thenReturn(List.of(stored(employee(2L, "Meena", "S"), 2, scan(2, 300))));
        List<EmployeeFingerprint> saved = new ArrayList<>();
        when(fingerprintRepository.save(any())).thenAnswer(i -> { saved.add(i.getArgument(0)); return i.getArgument(0); });
        when(fingerprintRepository.findByEmployeeIdOrderByFingerAscSampleNoAsc(1L)).thenAnswer(i -> saved);

        Map<String, Object> status = service.enroll(1L, 2, List.of(scan(1, 100), scan(1, 200)), true, "hr");

        verify(fingerprintRepository).deleteFinger(1L, 2);
        assertEquals(2, saved.size());
        assertNotNull(saved.get(0).getConsentAt());
        assertEquals(true, status.get("enrolled"));
        assertEquals(1, ((List<?>) status.get("fingers")).size());
    }

    @Test
    void identifiesTheRightEmployeeAmongSeveral() {
        Employee meena = employee(2L, "Meena", "S");
        when(fingerprintRepository.findAllActive()).thenReturn(List.of(
                stored(ravi, 2, scan(1, 100)), stored(meena, 2, scan(2, 100))));

        var d = service.identify(scan(1, 777)); // Ravi's finger, touched again
        assertEquals(FingerprintPolicy.Verdict.CONFIDENT, d.verdict());
        assertEquals(1L, d.employeeId());
    }

    @Test
    void unknownFingerIsNotRecognised() {
        when(fingerprintRepository.findAllActive()).thenReturn(List.of(
                stored(ravi, 2, scan(1, 100)), stored(employee(2L, "Meena", "S"), 2, scan(2, 100))));

        var d = service.identify(scan(3, 100));
        assertEquals(FingerprintPolicy.Verdict.NOT_RECOGNISED, d.verdict());
        assertNull(d.employeeId());
    }

    @Test
    void employeesNotActiveCannotBeIdentified() {
        Employee away = employee(3L, "Leave", "Guy");
        away.setStatus("ON_LEAVE");
        when(fingerprintRepository.findAllActive()).thenReturn(List.of(stored(away, 2, scan(1, 100))));
        assertEquals(FingerprintPolicy.Verdict.NOT_RECOGNISED, service.identify(scan(1, 200)).verdict());
    }

    @Test
    void garbageInputIsRejectedCleanly() {
        assertThrows(IllegalArgumentException.class, () -> service.identify(new Capture("PNG", null, null, null, "not base64 !!")));
        assertThrows(IllegalArgumentException.class, () -> service.identify(new Capture("RAW", 10, 10, 500.0, Base64.getEncoder().encodeToString(new byte[100]))));
        assertThrows(IllegalArgumentException.class, () -> service.identify(null));
    }
}
