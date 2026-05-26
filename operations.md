# Threads Affiliate Operation

## Current Shape

- GitHub Actions checks `threads_schedule.json` every 15 minutes.
- Only posts with `status: "scheduled"` and a past `scheduled_at` are published.
- Threads posts should mostly build trust and profile visits.
- Affiliate links live on landing pages, not in every Threads post.

## Weekly Routine

1. Keep 7 days of posts in `threads_schedule.json`.
2. Keep each account at 4 posts per day during the first monetization sprint.
3. Use CTA posts at about 1 per 6 generated posts while monetization is being tested.
4. Check replies, likes, profile visits, and link clicks every 2 to 3 days.
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
  - `6` means roughly 1 link post per 6 generated posts per account.
- Change posting times: edit `accounts.*.times`
- Change affiliate or note links: edit `accounts.*.links`
- Change recurring topic mix: edit `accounts.*.pillars`

Current monetization sprint settings:

- Fortune: 07:40, 12:20, 18:10, 22:30
- Side hustle: 08:10, 12:50, 18:40, 21:50
- Keep `link_every` at `6` for this week, then review.
- Review weekly and only increase CTA ratio after link clicks or profile visits appear.
- Replace weak pillars, not only weak individual posts.

## Content Ratio

- Most posts: Trust posts
  - short insights
  - common mistakes
  - emotional validation
  - market/funnel thinking
- Some posts: Diagnostic posts
  - "if this applies, check..."
  - "before starting, confirm..."
  - "signs that..."
- CTA posts
  - Note link
  - VERNIS direct link
  - Deeps direct link

## Fortune Account

Current monetization links:

- VERNIS reconciliation LP: https://afi2.vernis.co.jp/r/3ebu5o6
- VERNIS chat LP: https://afi2.vernis.co.jp/r/3edu5o6
- Fortune Note: https://note.com/idoljp/n/n7fe85e1645c8

Fixed post role:

- Make the profile link feel safe.
- Explain that the page is for first consultation / emotional organization.
- Avoid "必ず当たる", "必ず復縁", "運命が変わる" style wording.
- Avoid "free only is enough" wording.

## Side Hustle Account

Current monetization links:

- Side-hustle Note: https://note.com/idoljp/n/n50b93e6a4b1c
- Threads x high-ticket ASP: https://deeps.me/u/chiruchiru/a/tamaafi/r/8R3swzVWYy
- AI automation pack: https://deeps.me/u/rLK5dxngFm/a/UaHm2p7C3n/r/8R3swzVWYy
- AI x hidden Instagram strategy: https://deeps.me/u/mobuemon01/a/PYpooWS7kO/r/8R3swzVWYy

Fixed post role:

- Position the page as a realistic starter list.
- Avoid exaggerated income claims.
- Emphasize market selection, funnel design, and avoiding low-ticket fatigue.

## Rakuten Affiliate Track

Use Rakuten-style content as a low-friction trust layer for the side-hustle account.

Current role:

- Keep Deeps offers as the high-ticket monetization path.
- Add a recurring everyday-product pillar around work environment and time-saving goods.
- Route Rakuten-style CTAs to a note first, then replace with a dedicated Rakuten note after links are obtained.

Content angle:

- AIで副業を続ける人の作業環境
- 在宅ワークの肩こり、机まわり、集中しにくさ
- 一人暮らしや時短グッズ
- 悩み、選び方、比較、注意点、商品リンク

Compliance notes:

- Avoid "放置で稼げる" as a literal promise.
- Do not use non-Rakuten URL shorteners for Rakuten affiliate links.
- Do not send affiliate links via DM or closed channels.
- Keep product posts useful even without a purchase.

## Next Link Expansion

When approved, add opt-in links:

- A8 media member recruitment for side hustle
- A8 fortune/chat/phone fortune programs for fortune
- carefully vetted LINE registration offers
