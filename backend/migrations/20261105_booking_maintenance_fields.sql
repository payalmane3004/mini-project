-- Prepare only. Apply through the production migration process after explicit approval.
ALTER TABLE room_bookings
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE maintenance_requests
    ADD COLUMN IF NOT EXISTS assignee_name VARCHAR(100);
