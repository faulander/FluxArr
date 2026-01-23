-- Add last_run column to job_configs
ALTER TABLE job_configs ADD COLUMN last_run TEXT;
