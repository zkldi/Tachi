-- Migrate existing orphans to arcaeaInGameStrID
UPDATE orphan_score
SET data = jsonb_set(data, '{difficulty}', '"AnyBeyond"')
WHERE data->>'difficulty' = 'Beyond' 
AND context->>'game' = 'arcaea';

UPDATE orphan_score
SET data = jsonb_set(data, '{matchType}', '"arcaeaInGameStrID"')
WHERE data->>'matchType' = 'inGameStrID'
AND context->>'game' = 'arcaea';

-- Recalc everything because of the +0.2 clear bonus
INSERT INTO score_rederive (chart_id)
SELECT id as chart_id
FROM chart
WHERE chart.game = 'arcaea';