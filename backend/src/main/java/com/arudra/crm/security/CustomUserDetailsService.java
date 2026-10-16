package com.arudra.crm.security;

import com.arudra.crm.entity.User;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        java.util.Set<GrantedAuthority> authorities = new java.util.HashSet<>();
        
        user.getRoles().forEach(role -> {
            authorities.add(new SimpleGrantedAuthority(role.getName()));
            if (role.getPermissions() != null) {
                role.getPermissions().forEach(permission -> {
                    authorities.add(new SimpleGrantedAuthority(permission.getName()));
                });
            }
        });

        // Auto-unlock once the lock has run its course. failedAttempts is kept (only a successful
        // login clears it) so each further batch of failures locks for longer.
        if (!user.isAccountNonLocked()) {
            if (user.getLockTime() == null
                    || user.getLockTime().plus(lockDuration(user.getFailedAttempts())).isBefore(java.time.LocalDateTime.now())) {
                user.setAccountNonLocked(true);
                user.setLockTime(null);
                userRepository.save(user); // Auto-unlock
            }
        }

        return new AppUserDetails(
                user.getEmail(),
                user.getPassword(),
                user.isEmailVerified(), // enabled
                user.isAccountNonLocked(), // accountNonLocked
                authorities,
                user.isMustChangePassword()
        );
    }

    /** Failed sign-ins before a lock, and how long each lock lasts. */
    public static final int MAX_FAILED_ATTEMPTS = 5;

    /** After the first lock, each further batch of this many failures locks again. */
    public static final int REPEAT_FAILED_ATTEMPTS = 3;

    /** Every lock lasts the same short time. */
    public static java.time.Duration lockDuration(int failedAttempts) {
        return java.time.Duration.ofSeconds(30);
    }

    /** True when this failure count should lock: the 5th failure, then every 3rd after it. */
    public static boolean shouldLock(int failedAttempts) {
        return failedAttempts >= MAX_FAILED_ATTEMPTS
                && (failedAttempts - MAX_FAILED_ATTEMPTS) % REPEAT_FAILED_ATTEMPTS == 0;
    }
}
