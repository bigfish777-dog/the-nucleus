-- Add explicit unbooked lead stage for captured-but-not-booked records
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'leads';
