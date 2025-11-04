-- 013_fix_column_types.sql
-- Change text columns to integer for proper calculations
-- Must drop defaults first, then change type, then re-add defaults

BEGIN;

-- Fix curriculum_progress table
ALTER TABLE curriculum_progress 
ALTER COLUMN mastery_level DROP DEFAULT,
ALTER COLUMN attempts DROP DEFAULT,
ALTER COLUMN correct_attempts DROP DEFAULT;

ALTER TABLE curriculum_progress 
ALTER COLUMN mastery_level TYPE INTEGER USING COALESCE(mastery_level::integer, 0),
ALTER COLUMN attempts TYPE INTEGER USING COALESCE(attempts::integer, 0),
ALTER COLUMN correct_attempts TYPE INTEGER USING COALESCE(correct_attempts::integer, 0);

ALTER TABLE curriculum_progress 
ALTER COLUMN mastery_level SET DEFAULT 0,
ALTER COLUMN attempts SET DEFAULT 0,
ALTER COLUMN correct_attempts SET DEFAULT 0;

-- Fix topic_progress table
ALTER TABLE topic_progress 
ALTER COLUMN mastery_level DROP DEFAULT;

ALTER TABLE topic_progress 
ALTER COLUMN mastery_level TYPE INTEGER USING COALESCE(mastery_level::integer, 0);

ALTER TABLE topic_progress 
ALTER COLUMN mastery_level SET DEFAULT 0;

-- Fix subtopic_progress table
ALTER TABLE subtopic_progress 
ALTER COLUMN mastery_level DROP DEFAULT,
ALTER COLUMN exercises_completed DROP DEFAULT;

ALTER TABLE subtopic_progress 
ALTER COLUMN mastery_level TYPE INTEGER USING COALESCE(mastery_level::integer, 0),
ALTER COLUMN exercises_completed TYPE INTEGER USING COALESCE(exercises_completed::integer, 0);

ALTER TABLE subtopic_progress 
ALTER COLUMN mastery_level SET DEFAULT 0,
ALTER COLUMN exercises_completed SET DEFAULT 0;

COMMIT;
