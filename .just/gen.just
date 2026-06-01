# Scripts that generate code/types/etc.
#
# `just gen` is the god command here; runs all generation scripts.

gen: gen-kanel gen-proto

# Generate kanel types from the postgres definitions in Tachi.
gen-kanel: (db-cheap-reset "templatedb")
	bun run kanel -d "{{ POSTGRES_URL }}/templatedb" -c db/kanel_config.js
	just fmt

# Generate protobuf types from the proto definitions in the server.
# Uses buf + protoc-gen-es (ESM message types) and protoc-gen-connect-es
# (Connect/gRPC service clients), both generating proper TypeScript/ESM.
gen-proto:
	cd typescript/server && PATH="../../node_modules/.bin:$PATH" buf generate
	just fmt