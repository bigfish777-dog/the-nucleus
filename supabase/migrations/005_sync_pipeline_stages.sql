-- Sync pipeline_stage enum with TypeScript PipelineStage type
-- The initial migration (001) defined: booked, showed, no_show, disqualified, qualified,
-- second_call_booked, proposal_sent, closed_won, closed_lost, abandoned
-- These values exist in the frontend type but are missing from the DB enum:

ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'spam';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'test';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'proposal_live';
ALTER TYPE pipeline_stage ADD VALUE IF NOT EXISTS 'second_call_no_show';
