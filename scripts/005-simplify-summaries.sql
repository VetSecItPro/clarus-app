-- This script removes the tables related to the multi-model summary and voting system,
-- which are no longer needed.
-- Using CASCADE to automatically remove any dependent objects like foreign key constraints.

DROP TABLE IF EXISTS models CASCADE;
DROP TABLE IF EXISTS summary_votes CASCADE;
