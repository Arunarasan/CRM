-- The primary admin (admin@jbdecor.com) was left with email_verified = 0. The login flow treats
-- an unverified account as disabled (enabled == emailVerified in CustomUserDetailsService), so
-- authentication fails with 403 (DisabledException). Activate it, clear any lockout, and make sure
-- it holds ROLE_ADMIN. No-op on databases where the row doesn't exist (e.g. fresh installs, which
-- provision their admin via BOOTSTRAP_ADMIN_* already verified).

UPDATE users
   SET email_verified = 1,
       account_non_locked = 1,
       failed_attempts = 0,
       lock_time = NULL
 WHERE email = 'admin@jbdecor.com';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM users u
  JOIN roles r ON r.name = 'ROLE_ADMIN'
 WHERE u.email = 'admin@jbdecor.com';
