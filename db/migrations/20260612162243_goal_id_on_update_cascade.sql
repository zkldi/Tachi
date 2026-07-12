-- When a goal's canonical id changes (content hash), child rows should follow.
-- Used by reconcile-goal-ids and other goal-id maintenance scripts.

ALTER TABLE "goal_sub" DROP CONSTRAINT goal_sub_goal_id_fkey;

ALTER TABLE "goal_sub"
	ADD CONSTRAINT goal_sub_goal_id_fkey
	FOREIGN KEY (goal_id) REFERENCES goal (id) ON UPDATE CASCADE;

ALTER TABLE "import_goal" DROP CONSTRAINT import_goal_goal_id_fkey;

ALTER TABLE "import_goal"
	ADD CONSTRAINT import_goal_goal_id_fkey
	FOREIGN KEY (goal_id) REFERENCES goal (id) ON UPDATE CASCADE;
