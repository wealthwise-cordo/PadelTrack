# PadelTrack — App Store listing (version 1.0)

Paste these into App Store Connect. Character limits are Apple's.

## App Information

| Field | Value |
|---|---|
| Name (30) | PadelTrack |
| Subtitle (30) | Padel ratings & match tracker |
| Primary category | Sports |
| Privacy Policy URL | https://www.padeltrack.co.uk/privacy.html |

## Version page

**Promotional text** (170, can be changed any time without review)

> Record your padel matches, get a rating that moves with every result, and see where you rank among the people you actually play with. Free.

**Description** (4,000)

> PadelTrack is the home for your padel results. Record your matches, get a rating that moves with every result, and see where you really rank among the people you play with.
>
> A RATING THAT MEANS SOMETHING
> Pick your level when you sign up and your rating starts there. Every ranked match moves it: beat a stronger pair and you climb further, lose to a weaker one and you drop. Levels follow the familiar 1.0–7.0 padel scale.
>
> RESULTS BOTH SIDES AGREE ON
> Record the score and an opponent confirms it. No made-up wins, no arguments. Anything left unconfirmed settles itself after 48 hours.
>
> YOUR CIRCLE, YOUR RANKING
> Everyone you play a ranked match with joins your circle. See who's top, who's on a streak and who just pulled off an upset.
>
> SET UP MATCHES AHEAD
> Plan a match for later, leave spots open and share a link so friends can grab a place. Everyone gets a reminder the day before and a nudge to add the score afterwards.
>
> RUN THE SOCIAL NIGHTS
> Americano, Round Robin, Snake and Ladders and leagues: PadelTrack draws the rounds and courts and keeps the scores.
>
> HEAD-TO-HEADS AND STATS
> Your record against every opponent and alongside every partner, plus your rating history, sets, games and best streak.
>
> FRIENDLIES TOO
> Just knocking about? Save it as a friendly. It's on your record without touching anyone's rating.
>
> Playing with someone who isn't on PadelTrack yet? Add them as a guest and send them an invite link.
>
> PadelTrack is free, with no ads.

**Keywords** (100, comma-separated, no spaces)

```
padel,ranking,rating,tracker,score,match,league,americano,club,doubles,level,leaderboard,results
```

| Field | Value |
|---|---|
| Support URL | https://www.padeltrack.co.uk |
| Marketing URL (optional) | https://www.padeltrack.co.uk |
| Copyright | 2026 Cord van Eck |
| Version release | Manually release this version |

## App Review Information

**Sign-in required:** Yes. Create this account on the live site first, named "App Review", with its own unique password, and record two or three friendlies against made-up guests. Then enter it here:

- Username: `review@padeltrack.co.uk`
- Password: (the one you chose)

This account is hidden from player search, so real players never see it. If you use a different email, add it to Vercel as `REVIEW_ACCOUNT_EMAILS` (comma-separated) so it stays hidden.

**Notes** (for the reviewer)

> PadelTrack records padel (a doubles racket sport) results and calculates a rating for each player.
>
> The demo account above has some matches already. To try it:
> 1. Ranking (first tab): the player's rating and their ranking among people they have played with.
> 2. "+ New": record a match. Please add the other players as guests by typing any name (for example "Test Player"), rather than searching for real PadelTrack users, who would be sent a notification. Enter set scores and save. A ranked match waits for an opponent to confirm; a friendly is saved straight away.
> 3. Match Centre: matches waiting for confirmation, upcoming matches and results.
> 4. A player's profile: rating history and head-to-heads. At the bottom of another player's profile are "Report" and "Block".
> 5. Account menu (initials, top right): notifications, Terms of Use and Privacy, Sign out. Account deletion is under My profile → Edit profile.
>
> Contact: hello@padeltrack.co.uk

## Screenshots

iPhone with Dynamic Island (1206 × 2622), in `app-store/screenshots/`, taken with made-up demo players. Raw captures are in `app-store/raw/`; regenerate with `node scripts/frame-screenshots.mjs`.
