-- Needed for Like / Skip, mutual match, and Block (not in your current schema)
CREATE TABLE IF NOT EXISTS likes (
  like_id    SERIAL PRIMARY KEY,
  liker_id   INT4 NOT NULL REFERENCES users(user_id),
  liked_id   INT4 NOT NULL REFERENCES users(user_id),
  action     VARCHAR NOT NULL CHECK (action IN ('like','skip')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (liker_id, liked_id)
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INT4 NOT NULL REFERENCES users(user_id),
  blocked_id INT4 NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
-- A match = two rows: A likes B and B likes A.
