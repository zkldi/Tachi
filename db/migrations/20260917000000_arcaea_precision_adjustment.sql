INSERT INTO game_profile_dirty (user_id, game)
SELECT DISTINCT user_id, game
FROM game_profile
WHERE game = 'arcaea'
ON CONFLICT DO NOTHING;