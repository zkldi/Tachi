# Tachi Client

Tachi-Client is the frontend for Tachi.

## Setup

Run `pnpm install` to install dependencies.

## Dev Server

`pnpm start` launches a development server for rapid iteration. Use this if you're developing.

## Building

`pnpm build` compiles the source code into `build/`. This directory can then be shipped around and
served by tools like nginx. This should be used for production use cases only, as
compiling the client takes around 20-30 seconds, whereas the dev server is near instant.

## Config

For local development, use the `bootstrap.sh` script in `../_scripts` to set everything up.

Other configuration variables are as follows:
```sh
# Stop react from launching a browser when you run pnpm start.
BROWSER="none"

# KAI API Client IDs.
VITE_EAG_CLIENT_ID=""
VITE_MIN_CLIENT_ID=""
VITE_FLO_CLIENT_ID=""

# How long users should have to read the rules for, in seconds.
# Defaults to 30, but useful to lower for localdev.
VITE_RULES_READ_TIME=30

# Whether to require login to view the site.
VITE_MANDATE_LOGIN=true

# What git repo to read from by default in the seeds viewer.
VITE_GIT_REPO=""

# What client mode to use. Should be boku, kamai or omni.
# This affects some things, like what buttons should appear in certain places and what colours the site should be.
VITE_TCHIC_MODE="omni"

# hCaptcha site key (optional in local dev — omit to hide the widget; required for prod/staging server captcha enforcement).
VITE_HCAPTCHA_SITEKEY=""