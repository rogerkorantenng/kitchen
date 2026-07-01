# Privacy Policy

**Drift Kitchen**
Last updated: July 1, 2026

---

Drift Kitchen is a game that runs on Reddit as a custom post type built with Devvit. This policy explains what data we collect, how we use it, and how it is stored.

---

## What we collect

**Reddit user ID**
When you play, Devvit provides your Reddit user ID from your existing Reddit session. We use this to save your game state and track leaderboard scores. We do not collect your email address, password, or any information beyond what Reddit's platform provides.

**Reddit username**
We fetch your Reddit username once and cache it in Redis so it can be displayed on leaderboards and the community cookbook. We do not store it anywhere outside of Reddit's infrastructure.

**Game state**
Your kitchen progress, coin balance, upgrades, hired staff, and shift history are stored in Redis under your user ID. This is what allows your game to persist between sessions.

**Community contributions**
Dishes you submit to the cookbook (name, emoji, category, optional blurb) are stored and visible to all players on the subreddit. There is no way to submit a dish anonymously — your Reddit username is shown as the creator.

**Aggregate data**
The Community Feast counter is a subreddit-wide total — it records how many dishes have been served collectively, not who served what individually. Leaderboard scores are stored as sorted sets keyed by user ID.

---

## What we do not collect

- Email addresses
- IP addresses
- Device identifiers
- Browser fingerprints
- Payment information
- Any data beyond what is described above

---

## How data is used

- Game state is used solely to restore your progress when you return
- Your username is used only for display on leaderboards and the cookbook
- Leaderboard scores are used to rank players within the subreddit
- Community Feast progress is used to display the subreddit-wide goal
- Cookbook entries are used to populate the in-game dish browser

We do not sell data. We do not share data with third parties. We do not use your data for advertising.

---

## Data storage

All data is stored in Redis on Devvit's infrastructure, which runs on Reddit's servers. Data is subject to Reddit's own data handling and infrastructure policies. We do not operate independent servers.

---

## Data retention

Your game state persists until you use the in-game "Reset Progress" option, which wipes your save. Cookbook submissions and leaderboard entries are retained as long as the app is installed on the subreddit. If the app is removed from a subreddit, all associated data may be deleted.

---

## Children's privacy

Drift Kitchen does not knowingly collect data from users under 13. Access to the game requires a Reddit account, which is subject to Reddit's own age requirements and terms of service.

---

## Changes to this policy

If we update this policy, the "last updated" date at the top will change. Continued use of the game after any update means you accept the revised policy.

---

## Contact

If you have questions about this policy, post in the subreddit where Drift Kitchen is installed or contact the developer through Reddit.
