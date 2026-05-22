# Tachi Docs

Documentation for Tachi, built with [mdbook](https://rust-lang.github.io/mdBook/).

Hosted at [https://docs.tachi.ac](https://docs.tachi.ac).

## Setup

Install mdbook via cargo:

```sh
cargo install mdbook
```

Or use the Justfile recipe:

```sh
just docs-install
```

## Development

Serve locally with live-reload on http://localhost:3001:

```sh
just docs-serve
```

## Contributing

Fork the repository and PR your changes to `main`. Source files live in `docs/src/`.
