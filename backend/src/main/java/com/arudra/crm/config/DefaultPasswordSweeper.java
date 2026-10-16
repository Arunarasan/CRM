package com.arudra.crm.config;

import com.arudra.crm.entity.User;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.security.PasswordPolicy;
import com.arudra.crm.service.EmailService;
import com.arudra.crm.service.RefreshTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;

/**
 * Security sweep on every start: any account still on a password this app once handed out by
 * default ("password123" for auto-created employee logins; "Admin@123" for the old seeded admin,
 * prod only) gets a fresh random temporary password e-mailed to it, must change it on next sign-in,
 * and loses its existing sessions. Runs in the background because each BCrypt check is slow;
 * once an account is fixed it no longer matches, so later starts change nothing.
 */
@Component
public class DefaultPasswordSweeper {

    private static final Logger log = LoggerFactory.getLogger(DefaultPasswordSweeper.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;
    private final TransactionTemplate tx;
    private final Environment environment;

    public DefaultPasswordSweeper(UserRepository userRepository, PasswordEncoder passwordEncoder,
                                  RefreshTokenService refreshTokenService, EmailService emailService,
                                  TransactionTemplate tx, Environment environment) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
        this.emailService = emailService;
        this.tx = tx;
        this.environment = environment;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        Thread t = new Thread(this::sweep, "default-password-sweep");
        t.setDaemon(true);
        t.start();
    }

    void sweep() {
        try {
            List<String> defaults = new ArrayList<>(List.of("password123"));
            if (environment.acceptsProfiles(Profiles.of("prod"))) defaults.add("Admin@123");

            int reset = 0;
            for (User candidate : userRepository.findAll()) {
                String hash = candidate.getPassword();
                if (hash == null || hash.isBlank()) continue;
                boolean isDefault = defaults.stream().anyMatch(d -> passwordEncoder.matches(d, hash));
                if (!isDefault) continue;
                resetOne(candidate.getId());
                reset++;
            }
            if (reset > 0) log.warn("Reset {} account(s) that were still using a default password.", reset);
        } catch (Exception e) {
            log.error("Default-password sweep failed", e);
        }
    }

    private void resetOne(Long userId) {
        String temp = PasswordPolicy.generateTemporary();
        User user = tx.execute(status -> {
            User u = userRepository.findById(userId).orElse(null);
            if (u == null) return null;
            u.setPassword(passwordEncoder.encode(temp));
            u.setMustChangePassword(true);
            userRepository.save(u);
            refreshTokenService.revokeAll(u);
            return u;
        });
        if (user == null) return;
        emailService.send(user.getEmail(), "Your password has been reset",
                "Hi " + user.getName() + ",\n\n"
                + "For security, the default password on your account has been replaced. Sign in with "
                + "this temporary password and you will be asked to choose your own:\n\n"
                + "Temporary password: " + temp + "\n\n"
                + "You can also use \"Forgot password\" on the sign-in page, or ask your administrator.");
    }
}
