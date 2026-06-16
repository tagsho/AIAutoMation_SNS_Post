import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const schedulePath = new URL("../threads_schedule.json", import.meta.url);
const configPath = new URL("../content_generation_config.json", import.meta.url);

function normalizeText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function textBlocks(text) {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((block) => normalizeText(block))
    .filter(Boolean);
}

function sharedBlockCount(left, right) {
  const rightBlocks = new Set(textBlocks(right));
  return textBlocks(left).filter((block) => rightBlocks.has(block)).length;
}

function hashNumber(seed, modulo) {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hash, 16) % modulo;
}

function pick(list, seed) {
  return list[hashNumber(seed, list.length)];
}

const replacements = {
  adult_adjacent_safe: {
    angles: [
      "成人向けに近い市場は、刺激で押すより、匿名性・悩み・比較の3つを分けて設計したほうが残りやすい。",
      "表の投稿では欲を煽らず、市場の構造と失敗しやすい導線を話すくらいがちょうどいい。",
      "強い需要ほど、言い方を間違えると削除や警戒につながる。先に境界線を決める。",
      "夜系の案件は、入口を柔らかくして、リンク先で選べる状態を作るほうが安全に回しやすい。",
      "露骨な単語を増やすより、なぜその市場が動くのかを説明したほうが長く使える投稿になる。",
      "攻めるなら、投稿・プロフィール・リンク先の役割を分ける。全部を1投稿で売ろうとしない。",
    ],
    closes: [
      "短期で刺すより、消されにくい導線を積む。",
      "強い市場ほど、表現は一段落として設計する。",
      "伸ばす前に、守る線を決める。",
      "欲求ではなく、選び方から入る。",
      "刺激より、違和感の少ない入口を作る。",
      "売る前に、警戒されない順番を作る。",
    ],
  },
  default: {
    angles: [
      "同じ話でも、悩み・比較・手順のどこから入るかで読まれ方は変わる。",
      "投稿は増やすより、入口の角度をずらしたほうが検証しやすい。",
      "毎回同じ結論に見えるなら、先に読者の悩みを変える。",
      "反応を見るなら、言い切りより具体例を混ぜたほうが判断しやすい。",
    ],
    closes: [
      "まずは小さく出して、反応がある角度に寄せる。",
      "売る前に、読む理由を作る。",
      "作業量より、導線のズレを減らす。",
      "入口を変えるだけで、同じ案件でも見え方は変わる。",
    ],
  },
};

function parseTime(value) {
  return /[zZ]|[+-]\d\d:\d\d$/.test(value) ? new Date(value) : new Date(`${value}+09:00`);
}

function diversify(post, priorTexts) {
  const originalBlocks = textBlocks(post.text);
  if (originalBlocks.length < 4) return null;

  const pools = replacements[post.pillar] ?? replacements.default;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const blocks = [...originalBlocks];
    blocks[2] = pick(pools.angles, `${post.id}:angle:${attempt}`);
    blocks[3] = pick(pools.closes, `${post.id}:close:${attempt}`);
    const candidate = blocks.join("\n\n");
    if (candidate.length > 300 && !candidate.includes("http")) continue;
    if (!priorTexts.some((text) => sharedBlockCount(candidate, text) >= 3)) return candidate;
  }

  return null;
}

const schedule = JSON.parse(await readFile(schedulePath, "utf8"));
const config = JSON.parse(await readFile(configPath, "utf8"));
const allowedPillars = new Set(config.accounts?.side_hustle?.pillars ?? []);
const posts = schedule.posts
  .filter((post) => post.account_id === "side_hustle" && post.kind === "generated_trust" && post.pillar)
  .sort((a, b) => parseTime(a.scheduled_at) - parseTime(b.scheduled_at));

const priorTextsByPillar = new Map();
let changed = 0;

for (const post of posts) {
  const priorTexts = priorTextsByPillar.get(post.pillar) ?? [];
  const isAllowed = allowedPillars.size === 0 || allowedPillars.has(post.pillar);
  const tooSimilar = priorTexts.some((text) => sharedBlockCount(post.text, text) >= 3);

  if (post.status === "scheduled" && isAllowed && tooSimilar) {
    const diversified = diversify(post, priorTexts);
    if (diversified) {
      post.text = diversified;
      post.diversified_at = new Date().toISOString();
      changed += 1;
    }
  }

  if (!priorTextsByPillar.has(post.pillar)) priorTextsByPillar.set(post.pillar, []);
  priorTextsByPillar.get(post.pillar).push(post.text);
}

if (changed > 0) {
  await writeFile(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({ changed }, null, 2));
