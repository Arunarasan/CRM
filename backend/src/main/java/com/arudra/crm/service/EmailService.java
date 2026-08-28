package com.arudra.crm.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Sends transactional emails (currently password-reset OTPs).
 *
 * Delivery is best-effort and degrades gracefully: if SMTP is not configured
 * (blank {@code spring.mail.username}) or the send throws, the message is logged
 * to the console instead of failing the caller. This keeps dev working without a
 * mail server while real emails go out the moment MAIL_USERNAME/MAIL_PASSWORD are set.
 */
@Service
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${app.mail.from:no-reply@arudra.com}")
    private String fromAddress;

    @Value("${app.name:Arudra CRM}")
    private String appName;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    /** True when real SMTP credentials are present. */
    public boolean isConfigured() {
        return smtpUsername != null && !smtpUsername.isBlank();
    }

    /** Sends the password-reset OTP, or logs it when SMTP is not configured. */
    public void sendPasswordResetOtp(String toEmail, String recipientName, String otp, int expiryMinutes) {
        String subject = appName + " — Password Reset Code";
        String body = "Hi " + (recipientName == null || recipientName.isBlank() ? "there" : recipientName) + ",\n\n"
                + "Your password reset code is: " + otp + "\n\n"
                + "This code is valid for " + expiryMinutes + " minutes. Enter it on the reset-password "
                + "screen to choose a new password.\n\n"
                + "If you did not request a password reset, you can safely ignore this email — your "
                + "password will not change.\n\n"
                + "— " + appName;
        send(toEmail, subject, body);
    }

    /** Sends the sign-up email-verification OTP, or logs it when SMTP is not configured. */
    public void sendEmailVerificationOtp(String toEmail, String recipientName, String otp, int expiryMinutes) {
        String subject = appName + " — Verify your email";
        String body = "Hi " + (recipientName == null || recipientName.isBlank() ? "there" : recipientName) + ",\n\n"
                + "Welcome to " + appName + "! Your email verification code is: " + otp + "\n\n"
                + "Enter it on the sign-up screen to activate your account. This code is valid for "
                + expiryMinutes + " minutes.\n\n"
                + "If you did not create an account, you can safely ignore this email.\n\n"
                + "— " + appName;
        send(toEmail, subject, body);
    }

    /** Low-level send with console fallback. Never throws to the caller. */
    public void send(String toEmail, String subject, String body) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (!isConfigured() || sender == null) {
            System.out.println("[EMAIL — console fallback, SMTP not configured]"
                    + "\n  To: " + toEmail
                    + "\n  Subject: " + subject
                    + "\n  Body:\n" + body);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
        } catch (Exception e) {
            // Don't leak SMTP failures to the API caller (also avoids email enumeration on
            // forgot-password). Log the OTP so recovery is still possible in an outage.
            System.out.println("[EMAIL — send failed, logging instead] To: " + toEmail
                    + " | Subject: " + subject + " | Error: " + e.getMessage()
                    + "\n  Body:\n" + body);
        }
    }
}
