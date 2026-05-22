# Documentation Guide

The documentation component of Tachi powers the website you're currently viewing. Hi!

## Pre-Setup

You must have [Setup a local dev environment](../setup.md) in order to work nicely with the docs!

## Component Overview

All of the content for this component is inside the `docs/` folder.

It contains another folder, inconveniently called `docs/`, which contains all of the markdown files that are our documentation.

There's another folder called `includes/`, which contains some things that are constantly
referenced throughout the documentation.

At the top level, there's `mkdocs.yml` which configures how our documentation works later.

## Software Overview

We use [MKDocs Material](https://squidfunk.github.io/mkdocs-material/) for our documentation.
It extends markdown a bit to let us add things like admonitions and references.

Their documentation is **incredibly** good, so check their stuff out there if you want to see what features are available.

Other than that, our documentation is [markdown](https://www.markdownguide.org/basic-syntax/). If you know how to format a discord message, you know how to write documentation!

## Running the Documentation

Use `just docs start` inside Tachi to start up a local documentation viewer on http://localhost:8001.

This will automatically refresh when you edit anything related to the documentation, so you can quickly see how your stuff goes.

## A bit about mkdocs.yml

MKDocs has only one configuration file -- `mkdocs.yml`. This is a [YAML](https://en.wikipedia.org/wiki/YAML) file that configures the documentation we output.

It also manages the order of pages on the site. **You need to edit this if you're adding new pages! They aren't automatically added!**

## Contributing Back

It's just documentation. Make the changes and commit them up, ideally with `docs:` as the commit prefix.

That is to say: your commit messages should look like `docs: fixed typo in API route`.
