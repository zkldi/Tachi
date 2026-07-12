-- Allow ORPHANS_RESTORED inbox notifications (payload matches tachi-common NotificationBody).

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_kind_check;

ALTER TABLE notification ADD CONSTRAINT notification_kind_check CHECK (
	kind IN (
		'rivaled_by',
		'quest_changed',
		'site_announcement',
		'orphans_restored'
	)
);
