pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "arudracs-attendance"

// :core — pure Kotlin (no Android): biometric abstraction + matching orchestration, trusted clock,
//         offline queue / sync planning, punch flow. Unit-tested on the JVM.
// :app  — Android kiosk terminal: Compose UI, vendor scanner drivers, encrypted storage, device-owner lockdown.
include(":core", ":app")
