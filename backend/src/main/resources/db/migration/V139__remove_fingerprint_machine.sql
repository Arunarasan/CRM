-- Remove the fingerprint-machine (ADMS) attendance feature added in V125.
-- Employees set to the MACHINE method go back to GEO (own-phone punch with location check).
UPDATE employees SET attendance_method = 'GEO' WHERE attendance_method = 'MACHINE';
UPDATE attendance_sessions SET check_in_source = 'PHONE' WHERE check_in_source = 'MACHINE';
UPDATE attendance_sessions SET check_out_source = 'PHONE' WHERE check_out_source = 'MACHINE';

ALTER TABLE attendance_sessions DROP FOREIGN KEY fk_att_session_machine;
ALTER TABLE attendance_sessions DROP COLUMN machine_id;

DROP TABLE machine_punches;
DROP TABLE attendance_machine_requests;
DROP TABLE attendance_machines;

ALTER TABLE employees DROP INDEX uq_employee_machine_pin;
ALTER TABLE employees DROP COLUMN machine_pin;
