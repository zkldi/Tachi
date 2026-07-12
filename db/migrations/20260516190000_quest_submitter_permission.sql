-- Add a permission flag allowing users to submit quest proposals to the repo.
-- Users must apply (via Discord) and be approved by an admin before they can
-- open PRs via the quest editor.

ALTER TABLE account ADD COLUMN can_submit_quests BOOLEAN NOT NULL DEFAULT FALSE;
