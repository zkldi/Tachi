# Sieglinde

Sieglinde is a simple rating algorithm for BMS, developed for [Bokutachi](https://boku.tachi.ac).

## Goals

Making a perfect rating algorithm is a fools endeavour and not actually possible. Here's
our goals.

- Unify all of the popular tables into one number (Insane, Stella, Satellite, etc.)
- Make small adjustments to the rating of the chart depending on LR2IR clear rate.
- Leverage the fact that table authors have already done a lot of the proper rating for us.

## Usage

```
pnpm install
pnpm calc-v1
```

## Synchronising with seeds

Run `bun typescript/seeds-scripts/rerunners/bms-pms/apply-sieglinde.js` from the repository root (or run the same path after `cd` to the repo).