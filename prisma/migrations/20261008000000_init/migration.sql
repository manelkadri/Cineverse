-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "providerUserId" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "selectedProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "isKids" BOOLEAN NOT NULL DEFAULT false,
    "maturityLevel" INTEGER NOT NULL DEFAULT 18,
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'fr-FR',
    "parentalPinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "mediaType" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteItem" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "mediaType" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewingActivity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "mediaType" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "progressKey" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "preferredGenres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredLanguage" TEXT NOT NULL DEFAULT 'fr-FR',
    "subtitlesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "subtitleLanguage" TEXT NOT NULL DEFAULT 'fr',
    "includeMovies" BOOLEAN NOT NULL DEFAULT true,
    "includeSeries" BOOLEAN NOT NULL DEFAULT true,
    "excludePreviouslyViewed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "id" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_providerUserId_key" ON "User"("providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_selectedProfileId_idx" ON "User"("selectedProfileId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_isKids_idx" ON "Profile"("userId", "isKids");

-- CreateIndex
CREATE INDEX "WatchlistItem_profileId_addedAt_idx" ON "WatchlistItem"("profileId", "addedAt");

-- CreateIndex
CREATE INDEX "WatchlistItem_tmdbId_mediaType_idx" ON "WatchlistItem"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_profileId_mediaId_key" ON "WatchlistItem"("profileId", "mediaId");

-- CreateIndex
CREATE INDEX "FavoriteItem_profileId_addedAt_idx" ON "FavoriteItem"("profileId", "addedAt");

-- CreateIndex
CREATE INDEX "FavoriteItem_tmdbId_mediaType_idx" ON "FavoriteItem"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteItem_profileId_mediaId_key" ON "FavoriteItem"("profileId", "mediaId");

-- CreateIndex
CREATE INDEX "ViewingActivity_profileId_lastWatchedAt_idx" ON "ViewingActivity"("profileId", "lastWatchedAt");

-- CreateIndex
CREATE INDEX "ViewingActivity_tmdbId_mediaType_idx" ON "ViewingActivity"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "ViewingActivity_profileId_mediaId_key" ON "ViewingActivity"("profileId", "mediaId");

-- CreateIndex
CREATE INDEX "WatchProgress_profileId_updatedAt_idx" ON "WatchProgress"("profileId", "updatedAt");

-- CreateIndex
CREATE INDEX "WatchProgress_tmdbId_mediaType_idx" ON "WatchProgress"("tmdbId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_profileId_progressKey_key" ON "WatchProgress"("profileId", "progressKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_profileId_key" ON "UserPreferences"("profileId");

-- CreateIndex
CREATE INDEX "AuthAttempt_identifierHash_createdAt_idx" ON "AuthAttempt"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "AuthAttempt_createdAt_idx" ON "AuthAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteItem" ADD CONSTRAINT "FavoriteItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewingActivity" ADD CONSTRAINT "ViewingActivity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Block Supabase Data API (anon/authenticated) access; Prisma uses the postgres role, which bypasses RLS.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FavoriteItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ViewingActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WatchProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthAttempt" ENABLE ROW LEVEL SECURITY;
