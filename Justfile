import "Justfile-gen"
import "Justfile-apps"
import "Justfile-java"
import "Justfile-db"
import "Justfile-backup"
import "Justfile-misc"
import "Justfile-migrate"
import "Justfile-observability"
import "Justfile-test"
import "Justfile-bench"
import "Justfile-dataset"
import "Justfile-repo"

[private]
interactive:
	-@just --choose
