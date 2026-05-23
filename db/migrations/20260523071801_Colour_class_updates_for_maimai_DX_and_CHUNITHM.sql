INSERT INTO game_profile_dirty (user_id, game)
SELECT user_id, game
FROM game_profile
WHERE game IN ('maimaidx', 'chunithm');
