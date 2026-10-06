package com.arudracs.attendance.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object Brand {
    val Navy = Color(0xFF0B2C6B)
    val DeepNavy = Color(0xFF071A3D)
    val Gold = Color(0xFFD4AF37)
    val Background = Color(0xFFF8F9FC)
    val Success = Color(0xFF15803D)
    val SuccessBg = Color(0xFFECFDF3)
    val Warning = Color(0xFFB45309)
    val WarningBg = Color(0xFFFFFBEB)
    val Error = Color(0xFFB91C1C)
    val ErrorBg = Color(0xFFFEF2F2)
    val Muted = Color(0xFF64748B)
}

@Composable
fun KioskTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Brand.Navy, onPrimary = Color.White, secondary = Brand.Gold,
            background = Brand.Background, surface = Color.White, error = Brand.Error,
        ),
        content = content,
    )
}
