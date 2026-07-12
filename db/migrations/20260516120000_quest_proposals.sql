CREATE TABLE "quest_proposal" (
	row_id UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
	user_id BIGINT REFERENCES account(id) NOT NULL,
	github_pr_number INT NOT NULL,
	github_branch TEXT NOT NULL,
	-- Serialised RawQuestDocument[] (the editor's inline-goal format)
	raw_quests JSONB NOT NULL,
	-- Serialised RawQuestlineDocument[] (may be empty array)
	raw_questlines JSONB NOT NULL DEFAULT '[]',
	-- 'open' | 'merged' | 'closed'
	status TEXT NOT NULL DEFAULT 'open',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
