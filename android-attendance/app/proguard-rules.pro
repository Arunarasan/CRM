# Gson maps the API DTOs (in :core) by field name.
-keep class com.arudracs.attendance.core.api.** { *; }
-keepattributes Signature, *Annotation*
# Retrofit
-keepattributes Exceptions, InnerClasses, EnclosingMethod
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn okio.**
# SQLCipher
-keep class net.zetetic.database.** { *; }
# Vendor scanner SDKs use JNI with fixed class/method names.
-keep class com.mantra.** { *; }
-dontwarn com.mantra.**
