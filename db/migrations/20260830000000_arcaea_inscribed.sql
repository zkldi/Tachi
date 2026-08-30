UPDATE orphan_score
SET data[difficulty] = 'Inscribed'
WHERE data[difficulty] = 'Beyond' 
AND data[identifier] ~ '(dreadarea|rivenpilgrim|deinosphainein|cataclysmcry)';

INSERT INTO score_rederive (chart_id)
SELECT id as chart_id
FROM chart
WHERE chart.game = 'arcaea';