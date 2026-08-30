UPDATE orphan_score
SET data = jsonb_set(data, '{difficulty}', '"AnyBeyond"')
WHERE data->>'difficulty' = 'Beyond' 
AND data->>'identifier' ~ '(dreadarea|rivenpilgrim|deinosphainein|cataclysmcry)';

UPDATE orphan_score
SET data = jsonb_set(data, '{matchType}', '"arcaeaInGameStrID"')
WHERE data->>'matchType' = 'inGameStrID'
AND context->>'game' = 'arcaea';

INSERT INTO score_rederive (chart_id)
SELECT id as chart_id
FROM chart
WHERE chart.game = 'arcaea';