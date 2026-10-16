package com.arudra.crm.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

/** Spring's User plus the "must change password before doing anything else" flag. */
public class AppUserDetails extends User {

    private final boolean mustChangePassword;

    public AppUserDetails(String username, String password, boolean enabled, boolean accountNonLocked,
                          Collection<? extends GrantedAuthority> authorities, boolean mustChangePassword) {
        super(username, password, enabled, true, true, accountNonLocked, authorities);
        this.mustChangePassword = mustChangePassword;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }
}
