-- Add dedicated rescheduled stage so it is distinct from cancelled in reporting/UI
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'rescheduled';
