import ".just/gen.just"
import ".just/apps.just"
import ".just/docs.just"
import ".just/java.just"
import ".just/db.just"
import ".just/backup.just"
import ".just/misc.just"
import ".just/observability.just"
import ".just/test.just"
import ".just/bench.just"
import ".just/dataset.just"
import ".just/repo.just"

[private]
interactive:
	-@just --choose
