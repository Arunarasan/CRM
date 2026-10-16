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

    /**
     * Progressive lockout: 15 minutes for the first 5 failures, doubling for each further batch of
     * 5, capped at 24 hours. Short enough that a stranger can't keep a staff member locked out.
     */
    public static java.time.Duration lockDuration(int failedAttempts) {
        int batches = Math.max(1, failedAttempts / MAX_FAILED_ATTEMPTS);
        long minutes = 15L << Math.min(batches - 1, 7);
        return java.time.Duration.ofMinutes(Math.min(minutes, 24 * 60));
    }
}
