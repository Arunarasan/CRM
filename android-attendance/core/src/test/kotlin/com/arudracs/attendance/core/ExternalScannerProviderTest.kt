package com.arudracs.attendance.core

import com.arudracs.attendance.core.biometric.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class ExternalScannerProviderTest {
    private val driver = FakeDriver()
    private val store = MemoryTemplateStore()
    private val provider = ExternalScannerProvider(driver, store, EnrollmentPolicy(captures = 3, minQuality = 50, retriesPerSample = 1), Dispatchers.Unconfined)
    private fun req(id: Long, name: String = "E$id") = EnrollmentRequest(id, "C$id", name, FingerPosition.RIGHT_INDEX)

    @Test
    fun enrollsWithThreeConsistentSamplesAndStoresOnlyAReference() = runTest {
        driver.queue.addAll(listOf(driver.finger(7, 70), driver.finger(7, 90), driver.finger(7, 80)))
        val progress = mutableListOf<EnrollmentProgress>()
        val r = provider.enrollEmployee(req(1)) { progress += it }
        val ok = assertIs<EnrollmentResult.Success>(r)
        assertEquals(90, ok.enrollment.quality)
        assertTrue(ok.enrollment.templateRef.matches(Regex("tpl_[0-9a-f]{32}")))
        assertEquals("EXTERNAL_SCANNER:FAKE", ok.enrollment.providerId)
        assertEquals(1, store.items.size)
        assertEquals(3, progress.count { it is EnrollmentProgress.SampleAccepted })
    }

    @Test
    fun lowQualityIsRetriedThenFails() = runTest {
        driver.queue.addAll(listOf(driver.finger(7, 20), driver.finger(7, 30)))
        val r = assertIs<EnrollmentResult.Failure>(provider.enrollEmployee(req(1)))
        assertEquals(EnrollmentFailure.LOW_QUALITY, r.reason)
        assertTrue(store.items.isEmpty())
    }

    @Test
    fun differentFingerMidEnrollmentIsRejected() = runTest {
        driver.queue.addAll(listOf(driver.finger(7), driver.finger(8), driver.finger(9)))
        val r = assertIs<EnrollmentResult.Failure>(provider.enrollEmployee(req(1)))
        assertEquals(EnrollmentFailure.INCONSISTENT_SAMPLES, r.reason)
    }

    @Test
    fun aFingerAlreadyEnrolledForSomeoneElseIsRefused() = runTest {
        driver.queue.addAll(List(3) { driver.finger(7) })
        assertIs<EnrollmentResult.Success>(provider.enrollEmployee(req(1, "Arun")))
        driver.queue.addAll(List(3) { driver.finger(7) })
        val r = assertIs<EnrollmentResult.Failure>(provider.enrollEmployee(req(2, "Kumar")))
        assertEquals(EnrollmentFailure.ALREADY_ENROLLED_OTHER, r.reason)
        assertTrue(r.message.contains("Arun"))
    }

    @Test
    fun identifiesOneToMany() = runTest {
        driver.queue.addAll(List(3) { driver.finger(1) }); provider.enrollEmployee(req(1, "Arun"))
        driver.queue.addAll(List(3) { driver.finger(2) }); provider.enrollEmployee(req(2, "Kumar"))
        driver.queue.add(driver.finger(2))
        val m = assertIs<IdentifyResult.Match>(provider.identifyEmployee())
        assertEquals(2, m.employeeId)
        assertEquals("Kumar", m.employeeName)
        driver.queue.add(driver.finger(3))
        assertEquals(IdentifyResult.NoMatch, provider.identifyEmployee())
    }

    @Test
    fun ambiguousMatchAcrossEmployeesIdentifiesNobody() = runTest {
        val gallery = listOf(
            StoredTemplate("a", 1, "C1", "A", FingerPosition.RIGHT_INDEX, 80, "p", byteArrayOf(5)),
            StoredTemplate("b", 2, "C2", "B", FingerPosition.RIGHT_INDEX, 80, "p", byteArrayOf(5)),
        )
        assertEquals(IdentifyResult.NoMatch, provider.bestMatch(byteArrayOf(5), gallery))
    }

    @Test
    fun verifiesOneToOne() = runTest {
        driver.queue.addAll(List(3) { driver.finger(1) }); provider.enrollEmployee(req(1))
        driver.queue.add(driver.finger(1))
        assertIs<VerifyResult.Verified>(provider.verifyEmployee(1))
        driver.queue.add(driver.finger(9))
        assertEquals(VerifyResult.Rejected, provider.verifyEmployee(1))
        assertEquals(VerifyResult.NotEnrolled, provider.verifyEmployee(42))
    }

    @Test
    fun disconnectedScannerFailsCleanly() = runTest {
        driver.status = ScannerStatus.DISCONNECTED
        assertEquals(ScannerStatus.DISCONNECTED, provider.getScannerStatus())
        val r = assertIs<IdentifyResult.Failed>(provider.identifyEmployee())
        assertEquals(CaptureFailure.SCANNER_UNAVAILABLE, r.reason)
    }

    @Test
    fun deleteEmployeeRemovesAllTheirTemplates() = runTest {
        driver.queue.addAll(List(3) { driver.finger(1) }); provider.enrollEmployee(req(1))
        assertEquals(1, provider.deleteEmployee(1))
        assertTrue(store.items.isEmpty())
    }
}
