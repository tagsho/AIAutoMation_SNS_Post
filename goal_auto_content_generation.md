# Goal: Auto Content Generation Implementation

Created: 2026-05-25
Status: completed

## Goal

Implement automatic scheduled post generation for both Threads accounts:

- Fortune account
- Side-hustle account

The system should avoid reusing the same text, keep affiliate/link posts sparse, and work from GitHub Actions so the local PC does not need to stay open.

## Completed

- Added `content_generation_config.json`
  - account-specific times
  - account-specific links
  - content pillars
  - days-ahead and CTA ratio settings
- Added `scripts/generate_threads_schedule.mjs`
  - top-ups future schedule inventory
  - generates account-specific posts
  - avoids duplicate text
  - marks generated posts with `kind`, `pillar`, and `generated_at`
- Updated `.github/workflows/threads-scheduler.yml`
  - generation runs before publishing
  - schedule updates are committed back to the repo
- Generated local future inventory through 2026-06-01.
- Left the remote `threads_schedule.json` untouched to avoid overwriting publish statuses already written by GitHub Actions. The updated workflow will generate future inventory on the next run.

## Verification

Commands run successfully with the bundled Node runtime:

```bash
node scripts/generate_threads_schedule.mjs --dry-run --days-ahead=10
node scripts/generate_threads_schedule.mjs --days-ahead=7
node scripts/generate_threads_schedule.mjs --dry-run --days-ahead=7
node --check scripts/generate_threads_schedule.mjs
node --check scripts/publish_due_threads.mjs
```

Result:

- Initial local generation added 16 posts total.
- Follow-up dry run added 0 posts, confirming the generator does not keep duplicating the same date range.

## Next Improvement

After one week of data:

- keep pillars that get likes/replies/profile visits
- replace weak pillars
- optionally add an AI API generation mode after the deterministic generator is stable
