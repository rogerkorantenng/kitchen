# Drift Kitchen

A kitchen management game built natively on Reddit. Run shifts, cook orders, build your restaurant — without leaving the platform.

## What it is

Drift Kitchen is a custom Reddit post type built with Devvit. You play as a chef running timed shifts: grab ingredients, cook them at stations, assemble dishes, and serve customers before their patience runs out. Speed earns combos. Combos multiply tips. Hire staff to cook and serve autonomously while you handle the hard tickets.

The community layer is what makes it a Reddit game specifically. Every player contributes to a subreddit-wide weekly feast goal. Anyone can submit a dish to the community cookbook — name it, pick an emoji, write a blurb — and earn royalties on the leaderboard every time another player cooks it. Daily subreddit cravings, pulled from Reddit's API, shift which dishes pay out more.

## How to play

1. Open a Drift Kitchen post in any subreddit where the app is installed
2. Tap **Play** to start a shift
3. Tap an ingredient bin to pick up a raw item, drag it to a cooking station
4. Once cooked, drop it on the plate to assemble a dish
5. Tap a waiting customer to serve them
6. Chain serves quickly to build your combo multiplier
7. Watch for Rush Hour mid-shift — customer rate doubles and so do tips

Hire **Cooks** to man stations automatically and **Waiters** to handle delivery so you can focus on complex orders.

## Features

- 8 station types across 5 kitchen tiers (Grill, Fryer, Wok, Bakery, Prep, Smoker, Dessert, Drinks)
- 4 customer types with different patience and pay multipliers (Regular, Impatient, VIP, Critic)
- Combo system with streak multipliers up to 3×
- Rush Hour event at 42% of every shift (2× tips, faster spawns)
- Community Cookbook — submit dishes, earn royalties
- Community Feast — subreddit-wide weekly collective goal
- Subreddit Cravings — daily dish multipliers from real subreddit activity
- Two leaderboards: Top Chefs (coins) and Top Creators (royalties)
- Offline idle earnings from hired crew
- Upgrades: station levels, chef speed, kitchen tier unlocks, staff hires

## Tech stack

- **Phaser 3** — game engine running in WebView (isometric grid, animations, drag-and-drop)
- **Devvit** — Reddit developer platform (custom post type, Redis, Reddit API, scheduler)
- **Redis** — per-user game state, leaderboards, cookbook, feast progress, username cache
- **Reddit API** — user identity, subreddit cravings, daily harbor assignment

## Architecture

WebView (Phaser) ↔ Devvit server layer via `postMessage`. All game state persists in Redis. The server handles validation, upgrades, recipe submissions, leaderboard writes, and feast progress. Cron jobs at midnight UTC prefetch cravings and run daily rollover.

## Development

```bash
npm install
npm run build       # build the app
devvit upload       # upload to Reddit
devvit playtest     # start live playtest session
```

Requires [Devvit CLI](https://developers.reddit.com/docs/devvit) and a Reddit account with developer access.

## License

MIT
