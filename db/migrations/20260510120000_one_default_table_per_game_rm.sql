-- This just makes seeds apply miserable, and isn't a perf optimisation or whatever
-- realistically, seeds migrations should be done in a different way; some sort of
-- db branching and then "swapping in" of the data. but that's just not possible.
DROP INDEX one_default_table_per_game;

