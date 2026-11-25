-- Makes sure the enum values the app uses exist. Safe to run more than once.
ALTER TYPE request_status    ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE request_status    ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE request_status    ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE trip_status       ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE trip_status       ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE trip_status       ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE report_status     ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE report_status     ADD VALUE IF NOT EXISTS 'reviewed';
ALTER TYPE report_status     ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE auth_provider_type ADD VALUE IF NOT EXISTS 'email';
