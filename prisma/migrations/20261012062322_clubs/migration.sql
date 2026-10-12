-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "clubId" TEXT;

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'GB',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Club_city_active_idx" ON "Club"("city", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Club_name_area_city_key" ON "Club"("name", "area", "city");

-- CreateIndex
CREATE INDEX "Match_clubId_idx" ON "Match"("clubId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: padel clubs in London
INSERT INTO "Club" ("id", "name", "area", "city", "country", "updatedAt") VALUES
  (gen_random_uuid()::text, 'All Star Padel', 'Wandsworth', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Barn Elms Sports Centre', 'Barnes', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Battersea Park Millennium Arena', 'Battersea', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bexley Padel Club', 'Bexley', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Bromley Sports Club', 'Bromley', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Catford Padel Collective', 'Catford', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'David Lloyd Club', 'Acton Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'David Lloyd Club', 'Raynes Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Georgians Padel', 'Crouch End', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GrassRoots Padel', 'Wimbledon Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Harbour Club', 'Chelsea', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Hazelwood Sports Club', 'Winchmore Hill', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'House of Racquet', 'King''s Cross', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Instantpadel', 'Canada Water', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, '¡PADEL PADEL!', 'Eltham', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel and Coffee', 'Greenford', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Box', 'Bermondsey', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Pals', 'Sydenham', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel People', 'Wimbledon', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Play', 'Finsbury Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Social Club', 'Earl''s Court', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Social Club', 'Paddington', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Social Club', 'The O2 (Greenwich)', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Tree', 'Finchley', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel United', 'Willesden', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padel Zest', 'Merton Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Padium', 'Canary Wharf', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Park Sports', 'Ealing', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Park Sports', 'Hyde Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Park Sports', 'The Regent''s Park', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Parkside Padel', 'Southall', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Playtime Padel', 'Tolworth', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Powerleague', 'Mill Hill', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Powerleague', 'Romford', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Powerleague', 'Shoreditch', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Rocket Padel', 'Battersea', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Rocket Padel', 'Beckton', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Rocket Padel', 'Ilford', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'S3 Padel Finchley Road', 'Hampstead', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'S3 Padel Sutton', 'Sutton', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Social Sports Society', 'Wembley', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Stratford Padel Club', 'Stratford', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'The Padel Hub', 'Whetstone', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'The Padel Yard', 'Vauxhall', 'London', 'GB', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'The Padel Yard', 'Wandsworth', 'London', 'GB', CURRENT_TIMESTAMP)
ON CONFLICT ("name", "area", "city") DO NOTHING;
