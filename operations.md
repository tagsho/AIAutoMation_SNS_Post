# Threads Affiliate Operation

## Current Shape

- GitHub Actions checks `threads_schedule.json` every 15 minutes.
- Only posts with `status: "scheduled"` and a past `scheduled_at` are published.
- Threads posts should mostly build trust and profile visits.
- Affiliate links live on landing pages, not in every Threads post.

## Weekly Routine

1. Add 7 days of posts to `threads_schedule.json`.
2. Keep each account at 1 to 2 posts per day while the accounts are young.
3. Use CTA posts sparingly, around 10% to 20% of total posts.
4. Check replies, likes, profile visits, and link clicks every Sunday.
5. Replace weak themes with stronger variants next week.

## Auto Content Generation

Implemented goal:

- Generate different scheduled post text for both accounts.
- Keep the same proven content pillars while varying the actual wording.
- Top up `threads_schedule.json` from GitHub Actions so the PC can be closed.
- Use CTA/link posts sparingly instead of posting affiliate links every time.

Files:

- `content_generation_config.json`
  - Posting times per account
  - Link destinations
  - CTA ratio via `generation.link_every`
  - Days of future inventory via `generation.days_ahead`
- `scripts/generate_threads_schedule.mjs`
  - Generates future scheduled posts
  - Avoids duplicate text already in `threads_schedule.json`
  - Adds `kind`, `pillar`, and `generated_at` metadata to generated posts
- `.github/workflows/threads-scheduler.yml`
  - Runs generation before publishing due posts
  - Commits generated schedule updates back to GitHub

Manual generation command:

```bash
node scripts/generate_threads_schedule.mjs --days-ahead=7
```

Preview without changing files:

```bash
node scripts/generate_threads_schedule.mjs --dry-run --days-ahead=7
```

Useful adjustments:

- Increase/decrease CTA frequency: edit `generation.link_every`
  - `10` means roughly 1 link post per 10 generated posts per account.
- Change posting times: edit `accounts.*.times`
- Change affiliate or note links: edit `accounts.*.links`
- Change recurring topic mix: edit `accounts.*.pillars`

Current recommendation:

- Keep `link_every` at `10` while the accounts are young.
- Review weekly and only increase CTA ratio after link clicks or profile visits appear.
- Replace weak pillars, not only weak individual posts.

## Content Ratio

- 70%: Trust posts
  - short insights
  - checklists
  - common mistakes
  - emotional validation
- 20%: Diagnostic posts
  - "if this applies, check..."
  - "before starting, confirm..."
  - "signs that..."
- 10%: CTA posts
  - "profileにまとめました"
  - "固定投稿に置きました"
  - "条件を確認しておく"

## Fortune Account

Profile link target:

- `landing_pages/fortune.html`

Fixed post role:

- Make the profile link feel safe.
- Explain that the page is for free trials and initial free consultation.
- Avoid "必ず当たる", "必ず復縁", "運命が変わる" style wording.

Good offer types:

- free registration
- first consultation free
- initial points
- love, compatibility, reconciliation consultation

## Side Hustle Account

Profile link target:

- `landing_pages/side-hustle.html`

Fixed post role:

- Position the page as a realistic starter list.
- Avoid exaggerated income claims.
- Emphasize small first wins and avoiding suspicious offers.

Good offer types:

- crowdsourcing registration
- AI productivity tools
- writing or Web production learning services
- skill marketplace or portfolio services

## Manual Steps After First Fixed Posts Publish

Threads API can publish the fixed-post candidates, but pinning them is a manual UI action.

1. Open the fortune account after `fortune-fixed-20260522` publishes.
2. Pin that post to the profile.
3. Open the side-hustle account after `side-fixed-20260522` publishes.
4. Pin that post to the profile.
5. Set each profile URL to the published landing page URL.

## Link Replacement

When affiliate links are ready, replace placeholders in the landing pages:

- `AFFILIATE_LINK_FORTUNE_MAIN`
- `AFFILIATE_LINK_FORTUNE_SUB_1`
- `AFFILIATE_LINK_FORTUNE_SUB_2`
- `AFFILIATE_LINK_SIDE_WORK`
- `AFFILIATE_LINK_SIDE_AI`
- `AFFILIATE_LINK_SIDE_LEARNING`
