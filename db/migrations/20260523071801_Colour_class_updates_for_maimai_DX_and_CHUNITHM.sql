UPDATE game_profile 
SET classes['colour'] = CASE
    WHEN (ratings->>'naiveRate')::int >= 16750 THEN '"RAINBOW_EX_IV"'
    WHEN (ratings->>'naiveRate')::int >= 16500 THEN '"RAINBOW_EX_III"'
    WHEN (ratings->>'naiveRate')::int >= 16250 THEN '"RAINBOW_EX_II"'
    WHEN (ratings->>'naiveRate')::int >= 16000 THEN '"RAINBOW_EX_I"'
    WHEN (ratings->>'naiveRate')::int >= 15750 THEN '"RAINBOW_IV"'
    WHEN (ratings->>'naiveRate')::int >= 15500 THEN '"RAINBOW_III"'
    WHEN (ratings->>'naiveRate')::int >= 15250 THEN '"RAINBOW_II"'
    WHEN (ratings->>'naiveRate')::int >= 15000 THEN '"RAINBOW"'
    WHEN (ratings->>'naiveRate')::int >= 14750 THEN '"PLATINUM_II"'
    WHEN (ratings->>'naiveRate')::int >= 14500 THEN '"PLATINUM"'
    WHEN (ratings->>'naiveRate')::int >= 14250 THEN '"GOLD_II"'
    WHEN (ratings->>'naiveRate')::int >= 14000 THEN '"GOLD"'
    ELSE classes['colour']
END
WHERE game = 'maimaidx';

UPDATE game_profile
SET classes['colour'] = CASE
    WHEN (ratings->>'naiveRating')::numeric >= 16.00 THEN classes['colour']
    WHEN (ratings->>'naiveRating')::numeric >= 15.75 THEN '"PLATINUM_III"'
    WHEN (ratings->>'naiveRating')::numeric >= 15.50 THEN '"PLATINUM_II"'
    ELSE classes['colour']
END
WHERE game = 'chunithm';
