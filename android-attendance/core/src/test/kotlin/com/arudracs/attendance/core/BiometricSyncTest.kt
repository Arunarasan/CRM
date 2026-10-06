package com.arudracs.attendance.core

import com.arudracs.attendance.core.api.PendingEnrollment
import com.arudracs.attendance.core.api.TerminalEnrollment
import com.arudracs.attendance.core.biometric.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class BiometricSyncTest {
    private val driver = FakeDriver()
    private val store = MemoryTemplateStore()
    private val provider = ExternalScannerProvider(driver, store, EnrollmentPolicy(), Dispatchers.Unconfined)
    private val api = FakeApi()
    private val sync = BiometricSync(provider, store, api)
    private val pending = PendingEnrollment(9, 1, "E1", "Arun", "LEFT_INDEX", "PENDING", null)

    @Test
    fun enrollmentReportsOnlyTheReference() = runTest {
        driver.queue.addAll(List(3) { driver.finger(1) })
        assertIs<BiometricSync.Outcome.Enrolled>(sync.enroll(pending) {})
        val sent = api.completed.single()
        assertEquals("LEFT_INDEX", sent.fingerPosition)
        assertEquals(store.items.keys.single(), sent.templateRef)
    }

    @Test
    fun serverRefusalDeletesTheLocalTemplate() = runTest {
        api.completeFails = true
        driver.queue.addAll(List(3) { driver.finger(1) })
        assertIs<BiometricSync.Outcome.Failed>(sync.enroll(pending) {})
        assertTrue(store.items.isEmpty())
    }

    @Test
    fun captureFailureIsReportedToTheServer() = runTest {
        assertIs<BiometricSync.Outcome.Failed>(sync.enroll(pending) {}) // no finger → timeout
        assertEquals(1, api.failed.size)
    }

    @Test
    fun reconcileDeletesTemplatesTheServerRevoked() = runTest {
        store.save(StoredTemplate("keep", 1, "E1", "A", FingerPosition.RIGHT_INDEX, 80, "p", byteArrayOf(1)))
        store.save(StoredTemplate("gone", 2, "E2", "B", FingerPosition.RIGHT_INDEX, 80, "p", byteArrayOf(2)))
        api.serverEnrollments += TerminalEnrollment(1, 1, "E1", "A", "keep", "RIGHT_INDEX")
        assertEquals(1, sync.reconcile())
        assertEquals(setOf("keep"), store.items.keys)
    }
}
