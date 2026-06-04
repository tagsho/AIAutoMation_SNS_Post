import { readFile, writeFile } from "node:fs/promises";

const schedulePath = new URL("../threads_schedule.json", import.meta.url);
const configPath = new URL("../content_generation_config.json", import.meta.url);

const accountSecrets = {
  fortune: "THREADS_FORTUNE_TOKEN",
  side_hustle: "THREADS_SIDE_HUSTLE_TOKEN",
};

function parseTokyoTime(value) {
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) {
    return new Date(value);
  }
  return new Date(`${value}+09:00`);
}

function mask(value = "") {
  if (!value) return "";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

async function postForm(url, fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    body: form,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response ${response.status}: ${text}`);
  }

  if (!response.ok || json.error) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

async function publishThread({ userId, token, text }) {
  const create = await postForm(`https://graph.threads.net/v1.0/${userId}/threads`, {
    media_type: "TEXT",
    text,
    access_token: token,
  });

  if (!create.id) {
    throw new Error(`Create returned no id: ${JSON.stringify(create)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const publish = await postForm(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    creation_id: create.id,
    access_token: token,
  });

  if (!publish.id) {
    throw new Error(`Publish returned no id: ${JSON.stringify(publish)}`);
  }

  return {
    creation_id: create.id,
    post_id: publish.id,
  };
}

const schedule = JSON.parse(await readFile(schedulePath, "utf8"));
const config = JSON.parse(await readFile(configPath, "utf8"));
const now = new Date();
const accounts = new Map(schedule.accounts.map((account) => [account.id, account]));
const disabledAccounts = new Set(Object.entries(config.accounts ?? {})
  .filter(([, account]) => account.enabled === false)
  .map(([accountId]) => accountId));

let changed = false;
let published = 0;
let failed = 0;
let skipped = 0;

for (const post of schedule.posts) {
  if (post.status !== "scheduled") continue;

  if (disabledAccounts.has(post.account_id)) {
    skipped += 1;
    continue;
  }

  const dueAt = parseTokyoTime(post.scheduled_at);
  if (dueAt > now) continue;

  const account = accounts.get(post.account_id);
  if (!account) {
    post.status = "failed";
    post.error = `Account not found: ${post.account_id}`;
    post.failed_at = new Date().toISOString();
    changed = true;
    failed += 1;
    continue;
  }

  const secretName = accountSecrets[account.id];
  const token = process.env[secretName];
  if (!token) {
    post.status = "failed";
    post.error = `Missing GitHub secret: ${secretName}`;
    post.failed_at = new Date().toISOString();
    changed = true;
    failed += 1;
    continue;
  }

  try {
    const result = await publishThread({
      userId: account.user_id,
      token,
      text: post.text,
    });

    post.status = "published";
    post.creation_id = result.creation_id;
    post.post_id = result.post_id;
    post.published_at = new Date().toISOString();
    changed = true;
    published += 1;

    console.log(`published ${post.id} account=${account.id} post_id=${result.post_id}`);
  } catch (error) {
    post.status = "failed";
    post.error = error.message.replaceAll(process.env[secretName] ?? "", mask(process.env[secretName]));
    post.failed_at = new Date().toISOString();
    changed = true;
    failed += 1;
    console.log(`failed ${post.id} account=${account.id}: ${post.error}`);
  }
}

if (changed) {
  await writeFile(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
}

if (published === 0 && failed === 0) {
  console.log(skipped === 0 ? "no due posts" : `no due posts; skipped disabled=${skipped}`);
} else {
  console.log(`summary published=${published} failed=${failed} skipped_disabled=${skipped}`);
}
