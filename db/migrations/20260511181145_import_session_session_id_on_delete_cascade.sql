-- When a session is removed, orphan import_session rows are meaningless and block DELETE
-- without manual cleanup (see revert import / profile wipe).
-- Mirror import_session -> import ON DELETE CASCADE.
ALTER TABLE "import_session" DROP CONSTRAINT import_session_session_id_fkey;

ALTER TABLE "import_session"
	ADD CONSTRAINT import_session_session_id_fkey
	FOREIGN KEY (session_id) REFERENCES session (id) ON DELETE CASCADE;
