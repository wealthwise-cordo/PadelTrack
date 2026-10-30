-- A match set up ahead can leave player spots open until a score is entered.
ALTER TABLE "Match" ALTER COLUMN "teamAPlayer1Id" DROP NOT NULL,
ALTER COLUMN "teamAPlayer2Id" DROP NOT NULL,
ALTER COLUMN "teamBPlayer1Id" DROP NOT NULL,
ALTER COLUMN "teamBPlayer2Id" DROP NOT NULL;
