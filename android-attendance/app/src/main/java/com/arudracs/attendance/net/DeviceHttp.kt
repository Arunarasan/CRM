package com.arudracs.attendance.net

import com.arudracs.attendance.BuildConfig
import com.arudracs.attendance.core.api.*
import com.google.gson.Gson
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import retrofit2.HttpException
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.io.IOException
import java.net.URI
import java.util.concurrent.TimeUnit

/** Retrofit description of /api/device/** (terminal) and /api/auth/login (admin unlock only). */
interface DeviceService {
    @GET("device/register/options") suspend fun options(): RegistrationOptions
    @POST("device/register") suspend fun register(@Body body: RegisterRequest): RegisterResponse
    @POST("device/register/status") suspend fun registrationStatus(@Body body: RegistrationStatusRequest): RegistrationStatusResponse
    @POST("device/auth/token") suspend fun token(@Body body: TokenRequest): TokenResponse

    @POST("device/heartbeat") suspend fun heartbeat(@Header("Authorization") auth: String, @Body body: HeartbeatRequest): HeartbeatResponse
    @GET("device/employees/lookup") suspend fun lookup(@Header("Authorization") auth: String, @Query("code") code: String): TerminalEmployee
    @GET("device/employees") suspend fun roster(@Header("Authorization") auth: String): List<TerminalEmployee>
    @POST("device/attendance/punch") suspend fun punch(@Header("Authorization") auth: String, @Body body: PunchRequest): PunchResponse
    @POST("device/attendance/sync") suspend fun sync(@Header("Authorization") auth: String, @Body body: SyncRequest): SyncResponse
    @GET("device/biometric/enrollments") suspend fun enrollments(@Header("Authorization") auth: String): List<TerminalEnrollment>
    @POST("device/biometric/sessions/{id}/start") suspend fun startEnrollment(@Header("Authorization") auth: String, @Path("id") id: Long): PendingEnrollment
    @POST("device/biometric/sessions/{id}/complete")
    suspend fun completeEnrollment(@Header("Authorization") auth: String, @Path("id") id: Long, @Body body: EnrollmentCompleteRequest): TerminalEnrollment
    @POST("device/biometric/sessions/{id}/fail")
    suspend fun failEnrollment(@Header("Authorization") auth: String, @Path("id") id: Long, @Body body: EnrollmentFailRequest): Response<Unit>

    @POST("auth/login") suspend fun login(@Body body: Map<String, String>): LoginResponse
}

data class LoginResponse(val token: String?, val name: String?, val email: String?, val roles: List<String>?)

/** Shape of the backend's ApiError. */
private data class ApiErrorBody(val status: Int?, val error: String?, val message: String?)

object DeviceHttp {
    private val gson = Gson()

    fun service(): DeviceService {
        val base = BuildConfig.API_BASE_URL.let { if (it.endsWith("/")) it else "$it/" }
        require(base.startsWith("https://")) { "API_BASE_URL must be HTTPS" }
        val client = OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .apply {
                val pins = BuildConfig.CERT_PINS.split(',').map(String::trim).filter(String::isNotEmpty)
                if (pins.isNotEmpty()) {
                    val host = URI(base).host
                    certificatePinner(CertificatePinner.Builder().apply { pins.forEach { add(host, it) } }.build())
                }
            }
            .build()
        return Retrofit.Builder().baseUrl(base).client(client)
            .addConverterFactory(GsonConverterFactory.create(gson)).build()
            .create(DeviceService::class.java)
    }

    private val DEVICE_CODES = setOf(
        "DEVICE_BLOCKED", "DEVICE_REVOKED", "DEVICE_REJECTED", "DEVICE_PENDING", "DEVICE_UNKNOWN", "DEVICE_UNASSIGNED",
        "CREDENTIAL_REVOKED", "INVALID_CREDENTIAL", "DEVICE_ALREADY_ACTIVE", "DEVICE_ALREADY_REGISTERED",
    )

    /** Maps transport and HTTP failures onto the core exception contract. */
    suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (e: HttpException) {
        val body = runCatching { gson.fromJson(e.response()?.errorBody()?.string(), ApiErrorBody::class.java) }.getOrNull()
        val code = body?.error
        val message = body?.message ?: e.message()
        when {
            e.code() >= 500 -> throw TransportException("Server error ${e.code()}", e)
            e.code() == 429 -> throw TransportException(message, e)
            code != null && code in DEVICE_CODES -> throw DeviceRejectedException(code, message, e.code())
            e.code() == 401 && code == "TOKEN_INVALID" -> throw TokenExpired()
            e.code() == 401 || e.code() == 403 -> throw DeviceRejectedException(code ?: "UNAUTHORIZED", message, e.code())
            else -> throw ApiErrorException(code, message, e.code())
        }
    } catch (e: IOException) {
        throw TransportException(e.message ?: "Network unavailable", e)
    }

    class TokenExpired : Exception("Device token expired")
}
