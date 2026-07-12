# `tachidb` CLI

This CLI is made accessible under `tachidb` in the dev container.

It is modelled after the `sqlx` cli and entirely one-shot by claude. I have not really reviewed it.

The `tachi-db-migration-engine` is an embeddable typescript library that lets you run migrations from
a typescript codebase (e.g. on server startup like sqlx::migrate!()).
