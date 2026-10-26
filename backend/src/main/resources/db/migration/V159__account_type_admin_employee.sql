-- Account type is only Admin or Employee. Users still carrying a work role (project manager,
-- sales, accounts, ...) become plain employees; the role rows themselves are left in place.
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, emp.id
FROM user_roles ur
JOIN roles old ON old.id = ur.role_id
JOIN roles emp ON emp.name = 'ROLE_EMPLOYEE'
WHERE old.name IN ('ROLE_MANAGER', 'ROLE_PROJECT_MANAGER', 'ROLE_SALES', 'ROLE_ACCOUNTS',
                   'ROLE_FINANCE_MANAGER', 'ROLE_SUPERVISOR', 'ROLE_ENGINEER', 'ROLE_ESTIMATOR',
                   'ROLE_INVENTORY_MANAGER', 'ROLE_STORE_KEEPER', 'ROLE_DESIGNER')
  AND NOT EXISTS (SELECT 1 FROM user_roles x JOIN roles xr ON xr.id = x.role_id
                  WHERE x.user_id = ur.user_id AND xr.name IN ('ROLE_ADMIN', 'ROLE_EMPLOYEE'));

DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id
WHERE r.name IN ('ROLE_MANAGER', 'ROLE_PROJECT_MANAGER', 'ROLE_SALES', 'ROLE_ACCOUNTS',
                 'ROLE_FINANCE_MANAGER', 'ROLE_SUPERVISOR', 'ROLE_ENGINEER', 'ROLE_ESTIMATOR',
                 'ROLE_INVENTORY_MANAGER', 'ROLE_STORE_KEEPER', 'ROLE_DESIGNER');
