package com.arudracs.attendance.scanner

import android.content.Context
import com.arudracs.attendance.core.biometric.ScannerDriver

/** Flavour "mantra": the Mantra MFS100 driver. Add a flavour + factory to support another vendor. */
object ScannerDriverFactory {
    fun create(context: Context): ScannerDriver = MantraMfs100Driver(context)

    /** Only the simulated flavour can inject fingers. */
    val debugPress: ((Int) -> Unit)? = null
}
