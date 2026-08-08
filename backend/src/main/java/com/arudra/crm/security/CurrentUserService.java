package com.arudra.crm.security;

import com.arudra.crm.entity.User;
import com.arudra.crm.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Resolves the authenticated {@link User} entity from the security context.
 * The JWT principal's username is the user's email (see CustomUserDetailsService),
 * so a lookup by email yields the acting user for audit/ownership fields.
 */
@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            return null;
        }
        return userRepository.findByEmail(auth.getName()).orElse(null);
    }
}
