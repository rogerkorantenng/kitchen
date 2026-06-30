import { Devvit } from '@devvit/public-api';
import type { Context } from '@devvit/public-api';
import type { StationType } from '../core/save-schema.js';
import type { WebViewMessage } from './types/messages.js';
import { getState, getStateAndOffline, saveState, resetState, incrementFeast } from './handlers/state.js';
import { getTodayCravings, rerollHarbor } from './handlers/cravings.js';
import { buyUpgrade, buyNewStation, hireCook, hireServer, newVoyage } from './handlers/upgrades.js';
import { buyMetaUpgrade, buyExtraReroll, getLeaderboard, updateRenownLeaderboard } from './handlers/prestige.js';
import { prefetchAllCravings, dailyRollover } from './handlers/scheduler.jsx';
import { buyIngredients, recruitCrew, getCrewSlots, getIngredientStock } from './handlers/supply-chain.js';
import { submitRecipe, getRecipeBook } from './handlers/recipes.js';

Devvit.configure({
  redditAPI: true,
  redis: true,
  realtime: true,
});

// ── Scheduler jobs ──────────────────────────────────────────────────────────
const JOB_CRAVING_PREFETCH = 'dk-craving-prefetch'; // 00:00 UTC — cache all 50 pool subs
const JOB_DAILY_ROLLOVER   = 'dk-daily-rollover';   // 00:05 UTC — assign harbor, create post, settle streaks

Devvit.addSchedulerJob({
  name: JOB_CRAVING_PREFETCH,
  onRun: async (_event, context) => {
    await prefetchAllCravings(context as unknown as Context);
  },
});

Devvit.addSchedulerJob({
  name: JOB_DAILY_ROLLOVER,
  onRun: async (_event, context) => {
    await dailyRollover(context as unknown as Context);
  },
});

// Idempotently (re)arm cron jobs — cancels stale duplicates first.
// Copied from Trapline pattern (trapline/src/main.tsx:44-55)
async function ensureJobs(context: { scheduler: Context['scheduler'] }): Promise<void> {
  const existing = await context.scheduler.listJobs();
  const wanted: Record<string, string> = {
    [JOB_CRAVING_PREFETCH]: '0 0 * * *',
    [JOB_DAILY_ROLLOVER]:   '5 0 * * *',
  };
  for (const job of existing) {
    if (job.name in wanted) await context.scheduler.cancelJob(job.id);
  }
  for (const [name, cron] of Object.entries(wanted)) {
    await context.scheduler.runJob({ name, cron });
  }
}

Devvit.addTrigger({ event: 'AppInstall', onEvent: async (_e, context) => ensureJobs(context) });
Devvit.addTrigger({ event: 'AppUpgrade', onEvent: async (_e, context) => ensureJobs(context) });

function postMsg(ctx: Context, payload: unknown): void {
  ctx.ui.webView.postMessage('dk-webview', JSON.parse(JSON.stringify(payload)));
}

// ── Menu item to create a game post ─────────────────────────────────────────
Devvit.addMenuItem({
  label: 'Create Drift Kitchen Game',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title: '🍳 Drift Kitchen — Cook for the community',
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="center middle" backgroundColor="#0d1117">
          <text size="xxlarge" weight="bold" color="#f97316">DRIFT KITCHEN</text>
          <text size="medium" color="#8b8b8b">Your barge is docking…</text>
        </vstack>
      ),
    });
    context.ui.navigateTo(post);
  },
});

// ── Main post type ───────────────────────────────────────────────────────────
Devvit.addCustomPostType({
  name: 'Drift Kitchen',
  height: 'tall',
  render: (context) => {
    const handleMessage = async (rawMsg: unknown) => {
      const msg = rawMsg as WebViewMessage;
      const userId = context.userId ?? 'anon';

      switch (msg.type) {
        case 'INIT': {
          try {
            // Arm jobs on INIT for older installs (lazy re-arm)
            ensureJobs(context).catch(() => {});

            const user = await context.reddit.getCurrentUser();
            const username = user?.username ?? 'Anonymous';
            const { state, offlineEarned } = await getStateAndOffline(context);
            const { harborId, cravings } = await getTodayCravings(context, userId);

            postMsg(context, {
              type: 'INIT_RESPONSE',
              data: { username, userId, state, cravings: { harborId, cravings }, offlineEarned },
            });
          } catch (err) {
            // Surface the error to the client so the splash shows something useful
            postMsg(context, {
              type: 'INIT_RESPONSE',
              data: {
                username: 'Chef',
                userId,
                state: { saveVersion: 1, coins: 0, renown: 0, tradeTokens: 0,
                  lifetimeCoinsThisRun: 0, stations: [], crew: [], voyageCount: 0,
                  unlockedCuisineTiers: 0, incomeMultiplierLevel: 0, offlineCapLevel: 0,
                  offlineEffLevel: 0, cookSpeedLevel: 0, startingCoinsLevel: 0,
                  extraRerollUnlocked: false, royaltyBoostLevel: 0,
                  streak: 0, lastStreakDate: '', rerollsToday: 0,
                  lastSeen: Date.now(), incomePerSec: 0 },
                cravings: { harborId: 'Cooking', cravings: { multipliers: [], crazeCategory: null, derivedFrom: 'fallback' as const, subredditId: 'Cooking', date: '' } },
                error: String(err),
              },
            });
          }
          break;
        }

        case 'GET_STATE': {
          const state = await getState(context);
          postMsg(context, { type: 'STATE_RESPONSE', data: { state } });
          break;
        }

        case 'SAVE_STATE': {
          await saveState(context, msg.data.state);
          // Keep the "Top Chefs" leaderboard fresh from the player's best coin run.
          // (Renown is unused in this build, so the renown board ranks chefs by coins.)
          try {
            const best = Math.max(
              msg.data.state.lifetimeCoinsThisRun ?? 0,
              msg.data.state.coins ?? 0
            );
            // Leaderboard must never go DOWN (spending coins on upgrades shouldn't
            // drop your rank), so only write when this run beats the stored best.
            const prev = (await context.redis.zScore('leaderboard:renown', userId)) ?? 0;
            if (best > prev) {
              await context.redis.zAdd('leaderboard:renown', { member: userId, score: best });
              // Cache the username once — avoids a getCurrentUser() API call on every autosave.
              const nameKey = `username:${userId}`;
              const have = await context.redis.get(nameKey);
              if (!have) {
                const user = await context.reddit.getCurrentUser();
                await context.redis.set(nameKey, user?.username ?? 'Anonymous');
              }
            }
          } catch {
            /* leaderboard is best-effort; never block a save on it */
          }
          break;
        }

        case 'GET_CRAVINGS': {
          const { harborId, cravings } = await getTodayCravings(context, userId);
          postMsg(context, { type: 'CRAVINGS_RESPONSE', data: { harborId, cravings } });
          break;
        }

        case 'RESET_STATE': {
          const fresh = await resetState(context);
          postMsg(context, { type: 'STATE_RESPONSE', data: { state: fresh, __reqId: msg.data?.__reqId } });
          break;
        }

        case 'REROLL_HARBOR': {
          const reqId = msg.data.__reqId;
          const { harborId, cravings } = await rerollHarbor(context, userId);
          postMsg(context, {
            type: 'HARBOR_REROLLED',
            data: { harborId, cravings, __reqId: reqId },
          });
          break;
        }

        case 'CLAIM_OFFLINE': {
          // Offline earnings are already computed and granted in getState()
          // This message just acknowledges the claim and returns fresh state
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          postMsg(context, {
            type: 'OFFLINE_CLAIMED',
            data: { coinsGranted: 0, state, __reqId: reqId },
          });
          break;
        }

        case 'BUY_UPGRADE': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const result = await buyUpgrade(context, state, msg.data.stationId);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
          break;
        }

        case 'BUY_NEW_STATION': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const stType = msg.data.stationType as StationType;
          const result = await buyNewStation(context, state, stType);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
          break;
        }

        case 'HIRE_COOK': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const result = await hireCook(context, state, msg.data.stationId);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
          break;
        }

        case 'HIRE_SERVER': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const result = await hireServer(context, state, msg.data.stationId);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
          break;
        }

        case 'NEW_VOYAGE': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const result = await newVoyage(context, state);
          if (result.ok && result.renownGained > 0) {
            const user = await context.reddit.getCurrentUser();
            const username = user?.username ?? 'Anonymous';
            await updateRenownLeaderboard(context, userId, username, result.state.renown);
          }
          postMsg(context, {
            type: 'VOYAGE_COMPLETE',
            data: { renownGained: result.renownGained, state: result.state, __reqId: reqId },
          });
          break;
        }

        case 'BUY_META_UPGRADE': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const result = await buyMetaUpgrade(context, state, msg.data.field as Parameters<typeof buyMetaUpgrade>[2]);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
          break;
        }

        case 'BUY_EXTRA_REROLL': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const result = await buyExtraReroll(context, state);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ...result, __reqId: reqId } });
          break;
        }

        case 'DISH_SERVED': {
          // Track feast progress (Redis HINCRBY — realtime publish batched separately)
          const weekId = `week-${Math.floor(Date.now() / (7 * 24 * 3600 * 1000))}`;
          await incrementFeast(context, weekId);
          break;
        }

        case 'BUY_INGREDIENTS': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          await getTodayCravings(context, userId);
          const result = await buyIngredients(context, state, msg.data.ingredientId, msg.data.quantity);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ok: result.ok, state: result.state, __reqId: reqId } });
          break;
        }

        case 'RECRUIT_CREW': {
          const reqId = msg.data.__reqId;
          const state = await getState(context);
          const { harborId } = await getTodayCravings(context, userId);
          const personality = msg.data.personality as import('../core/save-schema.js').CrewMember['personality'];
          const result = await recruitCrew(context, state, personality, harborId);
          postMsg(context, { type: 'UPGRADE_RESPONSE', data: { ok: result.ok, state: result.state, __reqId: reqId } });
          break;
        }

        case 'GET_CREW': {
          const crew = await getCrewSlots(context);
          postMsg(context, { type: 'STATE_RESPONSE', data: { state: { ...await getState(context), crew } } });
          break;
        }

        case 'GET_STOCK': {
          await getIngredientStock(context);
          postMsg(context, { type: 'STATE_RESPONSE', data: { state: await getState(context) } });
          break;
        }

        case 'SUBMIT_RECIPE': {
          const { name, emoji, blurb, category } = msg.data;
          const result = await submitRecipe(context, name, emoji, blurb, category);
          postMsg(context, { type: 'RECIPE_SUBMITTED', data: { ok: result.ok, dishId: result.dishId } });
          break;
        }

        case 'GET_RECIPE_BOOK': {
          const dishes = await getRecipeBook(context);
          postMsg(context, { type: 'RECIPE_BOOK', data: { dishes } });
          break;
        }

        case 'GET_LEADERBOARD': {
          const entries = await getLeaderboard(context, msg.data.kind);
          postMsg(context, { type: 'LEADERBOARD_DATA', data: { entries } });
          break;
        }

        case 'GET_FEAST_PROGRESS': {
          const weekId = `week-${Math.floor(Date.now() / (7 * 24 * 3600 * 1000))}`;
          const raw = await context.redis.get(`feast:goal:${weekId}:progress`) ?? '0';
          postMsg(context, {
            type: 'FEAST_PROGRESS',
            data: {
              progress: parseInt(raw, 10),
              threshold: 1000,
              status: 'active' as const,
              weekId,
            },
          });
          break;
        }
      }
    };

    return (
      <vstack height="100%" width="100%">
        <webview
          id="dk-webview"
          url="index.html"
          width="100%"
          height="100%"
          onMessage={handleMessage}
        />
      </vstack>
    );
  },
});

export default Devvit;
