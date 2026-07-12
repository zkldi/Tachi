INSERT INTO score_rederive (chart_id)
SELECT id as chart_id
FROM chart
WHERE chart.game = 'arcaea';
