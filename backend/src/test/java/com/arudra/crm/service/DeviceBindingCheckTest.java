package com.arudra.crm.service;

import com.arudra.crm.config.DeviceBindingSettings;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.User;
import com.arudra.crm.entity.UserDevice;
import com.arudra.crm.entity.UserDeviceEvent;
import com.arudra.crm.exception.DeviceNotAuthorizedException;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.UserDeviceEventRepository;
import com.arudra.crm.repository.UserDeviceRepository;
import com.arudra.crm.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Clock-action device gate: OFF / SOFT / HARD outcomes, replay protection and audit of mismatches. */
class DeviceBindingCheckTest {

    private UserDeviceRepository deviceRepo;
    private UserDeviceEventRepository eventRepo;
    private EmployeeRepository employeeRepo;
    private DeviceBindingService service;
    private User user;
    private Employee employee;
    private KeyPair phone;

    @BeforeEach
    void setUp() throws Exception {
        deviceRepo = mock(UserDeviceRepository.class);
        eventRepo = mock(UserDeviceEventRepository.class);
        employeeRepo = mock(EmployeeRepository.class);
        service = new DeviceBindingService(deviceRepo, eventRepo, employeeRepo, mock(UserRepository.class),
                mock(NotificationService.class), new DeviceBindingSettings("SOFT", 1, true, 120));

        user = new User();
        user.setId(7L);
        user.setEmail("field@arudra.test");
        employee = new Employee();
        employee.setAttendanceMethod("GEO");
        when(employeeRepo.findByEmailIgnoreCaseAndIsDeletedFalse(anyString())).thenReturn(Optional.of(employee));
        when(deviceRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        phone = g.generateKeyPair();
    }

    private UserDevice bound(String status) {
        UserDevice d = new UserDevice();
        d.setId(1L);
        d.setDeviceUuid("phone-uuid-1");
        d.setStatus(status);
        d.setPublicKey(Base64.getEncoder().encodeToString(phone.getPublic().getEncoded()));
        when(deviceRepo.findByUserIdAndDeviceUuidAndIsDeletedFalse(7L, "phone-uuid-1")).thenReturn(Optional.of(d));
        return d;
    }

    private String sign(String nonce) throws Exception {
        Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
        s.initSign(phone.getPrivate());
        s.update(nonce.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.sign());
    }

    private String nonce() {
        return (String) service.issueChallenge(user).get("nonce");
    }

    @Test
    void activePhoneWithValidSignatureIsVerified() throws Exception {
        bound(UserDevice.ACTIVE);
        String n = nonce();
        DeviceBindingService.DeviceCheck c = service.check(user, "phone-uuid-1", n, sign(n), "1.2.3.4", "Clock-in");
        assertTrue(c.verified());
        verify(eventRepo, never()).save(any());
    }

    @Test
    void nonceCannotBeReplayed() throws Exception {
        bound(UserDevice.ACTIVE);
        String n = nonce();
        String sig = sign(n);
        assertTrue(service.check(user, "phone-uuid-1", n, sig, null, "Clock-in").verified());
        DeviceBindingService.DeviceCheck replay = service.check(user, "phone-uuid-1", n, sig, null, "Clock-out");
        assertEquals(DeviceBindingService.Outcome.BAD_CHALLENGE, replay.verification().outcome());
    }

    @Test
    void softModeFlagsButDoesNotThrowAndAudits() {
        DeviceBindingService.DeviceCheck c = service.check(user, null, null, null, null, "Clock-in");
        assertEquals("SOFT", c.mode());
        assertEquals(DeviceBindingService.Outcome.NO_PROOF, c.verification().outcome());
        ArgumentCaptor<UserDeviceEvent> ev = ArgumentCaptor.forClass(UserDeviceEvent.class);
        verify(eventRepo).save(ev.capture());
        assertEquals("MISMATCH_PUNCH", ev.getValue().getEvent());
    }

    @Test
    void hardModeRefusesUnregisteredPhone() throws Exception {
        employee.setDeviceBindingMode("HARD");
        String n = nonce();
        DeviceNotAuthorizedException ex = assertThrows(DeviceNotAuthorizedException.class,
                () -> service.check(user, "some-other-phone", n, sign(n), null, "Clock-in"));
        assertTrue(ex.getMessage().contains("registered phone"));
        verify(eventRepo).save(any());
    }

    @Test
    void hardModeRefusesPendingPhoneWithApprovalMessage() throws Exception {
        employee.setDeviceBindingMode("HARD");
        bound(UserDevice.PENDING);
        String n = nonce();
        DeviceNotAuthorizedException ex = assertThrows(DeviceNotAuthorizedException.class,
                () -> service.check(user, "phone-uuid-1", n, sign(n), null, "Clock-in"));
        assertTrue(ex.getMessage().contains("approval"));
    }

    @Test
    void wrongKeyIsBadSignature() throws Exception {
        bound(UserDevice.ACTIVE);
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair cloned = g.generateKeyPair();
        String n = nonce();
        Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
        s.initSign(cloned.getPrivate());
        s.update(n.getBytes(StandardCharsets.UTF_8));
        String sig = Base64.getEncoder().encodeToString(s.sign());
        assertEquals(DeviceBindingService.Outcome.BAD_SIGNATURE,
                service.check(user, "phone-uuid-1", n, sig, null, "Clock-in").verification().outcome());
    }

    @Test
    void offModeAndOfficeDeviceEmployeesSkipTheCheck() {
        employee.setDeviceBindingMode("OFF");
        assertFalse(service.check(user, null, null, null, null, "Clock-in").enforced());

        employee.setDeviceBindingMode(null);
        employee.setAttendanceMethod("OFFICE_DEVICE");
        assertFalse(service.check(user, null, null, null, null, "Clock-in").enforced());
        verify(eventRepo, never()).save(any());
    }
}
