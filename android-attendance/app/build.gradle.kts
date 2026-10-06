import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

// Server + signing come from keystore.properties / environment so no secret or URL is hard-coded.
val local = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use(::load)
}
fun prop(name: String, default: String = ""): String = (local.getProperty(name) ?: System.getenv(name) ?: default)

android {
    namespace = "com.arudracs.attendance"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.arudracs.attendance"
        minSdk = 28          // Android 9: device-owner lock-task features, EncryptedSharedPreferences, StrongBox where present
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        // HTTPS base of the CRM backend, e.g. https://crm.arudra.com/api/
        buildConfigField("String", "API_BASE_URL", "\"${prop("ATTENDANCE_API_BASE_URL", "https://crm.arudra.com/api/")}\"")
        // Optional OkHttp certificate pins: comma-separated "sha256/AAAA…=" values for the API host.
        buildConfigField("String", "CERT_PINS", "\"${prop("ATTENDANCE_CERT_PINS")}\"")
    }

    signingConfigs {
        create("release") {
            val store = prop("ATTENDANCE_KEYSTORE")
            if (store.isNotEmpty()) {
                storeFile = file(store)
                storePassword = prop("ATTENDANCE_KEYSTORE_PASSWORD")
                keyAlias = prop("ATTENDANCE_KEY_ALIAS")
                keyPassword = prop("ATTENDANCE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    // One flavour per supported scanner SDK. Only the driver differs; everything else is shared.
    flavorDimensions += "scanner"
    productFlavors {
        create("mantra") {
            dimension = "scanner"
            buildConfigField("String", "SCANNER_VENDOR", "\"MANTRA\"")
        }
        // Software scanner for UI / flow testing without hardware. Never shipped: see the guard below.
        create("simulated") {
            dimension = "scanner"
            buildConfigField("String", "SCANNER_VENDOR", "\"SIMULATED\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
        jniLibs.useLegacyPackaging = true
    }
}

// The simulated scanner accepts any "finger"; a release build of it would be a security hole.
tasks.configureEach {
    if (name.startsWith("assembleSimulatedRelease") || name.startsWith("bundleSimulatedRelease")) {
        doFirst { throw GradleException("The simulated scanner flavour must never be built for release.") }
    }
}

dependencies {
    implementation(project(":core"))

    // Vendor SDK (licensed, supplied by the scanner manufacturer — not in the repo). See README.
    "mantraImplementation"(fileTree(mapOf("dir" to "libs/mantra", "include" to listOf("*.jar", "*.aar"))))

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("net.zetetic:sqlcipher-android:4.6.1@aar")
    implementation("androidx.sqlite:sqlite-ktx:2.4.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
