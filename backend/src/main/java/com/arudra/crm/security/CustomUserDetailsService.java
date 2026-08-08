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

        // Check if account lock has expired (e.g. 24 hours lock)
        if (!user.isAccountNonLocked()) {
            if (user.getLockTime() != null && user.getLockTime().plusHours(24).isBefore(java.time.LocalDateTime.now())) {
                user.setAccountNonLocked(true);
                user.setFailedAttempts(0);
                user.setLockTime(null);
                userRepository.save(user); // Auto-unlock
            }
        }

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                user.isEmailVerified(), // enabled
                true, // accountNonExpired
                true, // credentialsNonExpired
                user.isAccountNonLocked(), // accountNonLocked
                authorities
        );
    }
}
