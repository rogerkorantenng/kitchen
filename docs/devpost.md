# Drift Kitchen

## The idea

There's something about cooking with other people that just works. Not in a team-building-exercise way — in the actual way, where someone's stirring, someone's chopping, and the conversation flows because your hands are busy. Cooking together lowers the temperature of a room. It always has.

Reddit, at its best, does something similar. Strangers with nothing in common except a shared interest end up genuinely building something together. r/Cooking has millions of people posting recipes they grew up with. r/recipes has people asking "what do I do with half a butternut squash" and getting twelve real answers in an hour. That's community in the truest sense — and it's mostly untapped when it comes to how games are played on the platform.

Drift Kitchen started with one question: what if a cooking game actually *used* that?

---

## How it works

Drift Kitchen is a kitchen management game that lives inside Reddit as a custom post. You run shifts — timed rounds where customers walk in, place orders, and leave if you take too long. You grab ingredients from bins, drag them to cooking stations, assemble dishes on the plate, and serve before patience runs out. Get fast enough and you chain combos. Chain enough combos and your tips multiply. Serve a food critic during rush hour and the whole kitchen celebrates.

It's built with Phaser 3 for the game engine — isometric 2.5D grid, procedural customer graphics, tween animations, drag-and-drop input all running inside Reddit's WebView. Phaser handles the real-time game loop: the timer ticking down, patience bars draining color from green to red, floating coin numbers blooming off each successful serve. The state lives in Redis on Devvit's server layer. The Reddit API connects everything to the actual community around the post.

The kitchen scales as you play. You start with a grill and a drinks station. Upgrade enough and you unlock the wok, the smoker, the dessert station, a full nine-station grand kitchen. You can hire cooks who man stations autonomously, and waiters who deliver orders while you focus on complex tickets. The economy has idle earnings too — your hired crew keeps running while you're away, and you come back to coins waiting.

---

## Where the community actually comes in

Three things in Drift Kitchen couldn't exist without Reddit users:

**The Cookbook.** Anyone playing the game can create a dish — pick an emoji from the approved set, give it a name, choose a category (grilled, spicy, fresh, comfort, street, baked, artisan), add a short blurb. One submission per day, rate-limited server-side. That dish goes into the community cookbook immediately. Other players cook it during their shifts. The creator earns royalties tracked on a separate leaderboard. The Top Creators board ranks players not by how well they cooked, but by how many other people cooked their food.

**The Community Feast.** Every shift any player runs contributes to a subreddit-wide weekly goal. The collective target is 1,000 dishes served in a week. Every dish increments a shared counter in Redis. The feast screen shows your personal contribution alongside the community total. When the goal hits, everyone who played that week was part of it.

**Cravings.** Each day, the subreddit the game is installed in gets assigned a set of "cravings" — dish category multipliers pulled from real subreddit activity via the Reddit API. If the craving is "grilled," burgers pay out more. If it's "comfort," coffee orders are worth extra. The craving shifts daily, which means the optimal strategy shifts too. It's the game responding to the actual community around it.

---

## The leaderboard

Two tracks, different enough that different types of players care about different ones.

Top Chefs ranks by coins earned — the competitive side, where speed and combos matter. Top Creators ranks by royalties from community dishes — the creative side, where the best recipes rise based on how much the community actually wants to cook them. Both boards show the top 50 players with Reddit usernames, live from Redis sorted sets.

---

## What we built this with

- **Phaser 3** — game engine running in WebView. Handles rendering, input, animations, scene management
- **Devvit** — Reddit's developer platform. Custom post type, Redis for all persistence, Reddit API for user identity and subreddit cravings, scheduler jobs for daily rollover
- **Redis** — per-user game state, leaderboards (sorted sets), cookbook entries, feast progress counters, username cache
- **Scheduled jobs** — cron at midnight UTC to prefetch cravings from a 50-subreddit pool and run daily streak/harbor assignment

The architecture is a WebView (Phaser) talking to a Devvit server layer via postMessage. Every meaningful action — saving state, buying upgrades, hiring staff, submitting recipes, fetching leaderboards — goes through typed message handlers. The server validates, persists to Redis, and responds. Nothing meaningful lives only in the browser.

---

## The kitchen tiers

| Tier | Stations | Grid | What unlocks |
|------|----------|------|--------------|
| 1 | Grill + Drinks | 5×4 | Starting kitchen |
| 2 | + Fryer | 6×5 | Fries |
| 3 | + Wok | 7×5 | Asian dishes |
| 4 | + Bakery, Prep | 8×6 | Baked goods, salads |
| 5 | + Smoker, Dessert, second Grill | 9×7 | Full grand kitchen |

Unlocking a tier costs coins (T2: 600, T3: 2,400, T4: 9,000, T5: 28,000). The recipe complexity scales with it — tier 5 customers order 3-4 item combos with mains, sides, and drinks.

---

## Rush Hour

At 42% through every shift, rush hour fires. Customer spawn rate doubles. Every tip doubles. The HUD banner appears and the pacing changes completely. It lasts 22 seconds. If you're not set up for it, it ends your combo streak. If you are, it's where the biggest coin runs happen.

---

## Why this fits Reddit specifically

Drift Kitchen isn't a game that happens to be on Reddit. It's a game that doesn't quite work anywhere else.

The cookbook only means something if the players are real Reddit users with usernames that carry reputation. The community feast only works if the subreddit has enough players for a collective goal to feel real. The cravings system only makes sense if the subreddit around the post is an actual cooking community. The leaderboard means more when the names on it are people you might have just played alongside.

Most Reddit games treat the platform as a distribution mechanism. Drift Kitchen treats it as the actual venue.

---

## What's next

Right now it's one subreddit at a time. The thing we keep coming back to is cross-subreddit feast events — r/Cooking versus r/food, a shared weekly target, two communities racing it. The cookbook has community voting half-built in our heads. The cravings system could pull from live post trends instead of a daily assignment.

None of that requires rebuilding anything. The Redis sorted sets already exist. The Reddit API integration is already running. Honestly the main thing left is deciding which to ship first.
