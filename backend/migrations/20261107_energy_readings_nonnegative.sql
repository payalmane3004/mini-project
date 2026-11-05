-- Read-only preflight found no negative energy readings on 2026-11-05.
-- Review and apply through the approved production migration process only.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.energy_readings'::regclass
          AND conname = 'energy_readings_energy_kwh_check'
    ) THEN
        ALTER TABLE public.energy_readings
            ADD CONSTRAINT energy_readings_energy_kwh_check
            CHECK (energy_kwh >= 0) NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.energy_readings
    VALIDATE CONSTRAINT energy_readings_energy_kwh_check;
