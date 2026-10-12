-- Move existing players onto the new reliability curve (1% at 0 matches,
-- then 1 - 0.99 * e^(-0.02773 * matches)) and record their latest ranked
-- match date, which reliability decay is measured from.
UPDATE "Player"
SET reliability = GREATEST(0.01, 1 - 0.99 * EXP(-0.02773 * "matchesPlayed"));

UPDATE "Player" p
SET "lastRankedPlayedAt" = last.played
FROM (
  SELECT h."playerId", MAX(m."playedAt") AS played
  FROM "PTRHistory" h
  JOIN "Match" m ON m.id = h."matchId"
  GROUP BY h."playerId"
) last
WHERE last."playerId" = p.id;
