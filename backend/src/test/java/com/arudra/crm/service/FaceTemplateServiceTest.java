package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeFaceTemplate;
import com.arudra.crm.repository.EmployeeFaceTemplateRepository;
import com.arudra.crm.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Enrollment validation: sample count, self-consistency and the "already someone else" check. */
@ExtendWith(MockitoExtension.class)
class FaceTemplateServiceTest {

    @Mock EmployeeFaceTemplateRepository templateRepository;
    @Mock EmployeeRepository employeeRepository;
    @InjectMocks FaceTemplateService service;

    private Employee employee;

    @BeforeEach
    void setUp() {
        employee = new Employee();
        employee.setId(1L);
        employee.setFirstName("Ravi");
        employee.setLastName("K");
        employee.setIsDeleted(false);
        when(employeeRepository.findById(1L)).thenReturn(Optional.of(employee));
    }

    /** A 128-number vector: `base` everywhere, with the first value nudged by `shift`. */
    private static List<Double> vec(double base, double shift) {
        List<Double> v = new ArrayList<>();
        for (int i = 0; i < 128; i++) v.add(base);
        v.set(0, base + shift);
        return v;
    }

    private static EmployeeFaceTemplate template(Employee e, List<Double> v) {
        EmployeeFaceTemplate t = new EmployeeFaceTemplate();
        t.setEmployee(e);
        t.setDescriptor(v.toString()); // "[0.1, 0.1, ...]" is valid JSON
        return t;
    }

    @Test
    void tooFewSamplesAreRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, List.of(vec(0.1, 0), vec(0.1, 0.01)), null, null, "hr"));
        verify(templateRepository, never()).save(any());
    }

    @Test
    void wrongSizeDescriptorIsRejected() {
        List<Double> bad = new ArrayList<>(vec(0.1, 0));
        bad.remove(0);
        assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, List.of(vec(0.1, 0), vec(0.1, 0.01), bad), null, null, "hr"));
    }

    @Test
    void samplesOfDifferentFacesAreRejected() {
        // distance between the 1st and 3rd sample is 1.0, far above the 0.55 self-consistency limit
        var ex = assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, List.of(vec(0.1, 0), vec(0.1, 0.02), vec(0.1, 1.0)), null, null, "hr"));
        assertTrue(ex.getMessage().contains("do not match each other"));
        verify(templateRepository, never()).save(any());
    }

    @Test
    void faceAlreadyEnrolledForAnotherEmployeeIsRejected() {
        Employee other = new Employee();
        other.setId(2L);
        other.setFirstName("Meena");
        other.setLastName("S");
        when(templateRepository.findAllExcept(1L)).thenReturn(List.of(template(other, vec(0.1, 0.1)))); // distance 0.1
        var ex = assertThrows(IllegalArgumentException.class,
                () -> service.enroll(1L, List.of(vec(0.1, 0), vec(0.1, 0.01), vec(0.1, 0.02)), null, null, "hr"));
        assertTrue(ex.getMessage().contains("Meena"));
        verify(templateRepository, never()).deleteAllForEmployee(anyLong());
    }

    @Test
    void validEnrollmentReplacesOldSamples() {
        Employee other = new Employee();
        other.setId(2L);
        when(templateRepository.findAllExcept(1L)).thenReturn(List.of(template(other, vec(0.1, 2.0)))); // far away
        when(templateRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> status = service.enroll(1L,
                List.of(vec(0.1, 0), vec(0.1, 0.02), vec(0.1, 0.04), vec(0.1, 0.01)), List.of(0.9, 0.9, 0.9, 0.9), "/uploads/x.jpg", "hr");

        verify(templateRepository).deleteAllForEmployee(1L);
        assertEquals(true, status.get("enrolled"));
        assertEquals(4, status.get("samples"));
        assertEquals("/uploads/x.jpg", status.get("photoUrl"));
    }
}
