import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const schedulePath = new URL("../threads_schedule.json", import.meta.url);
const configPath = new URL("../content_generation_config.json", import.meta.url);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const args = { daysAhead: undefined, dryRun: false, account: "all", from: undefined };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--days-ahead=")) args.daysAhead = Number(arg.split("=")[1]);
    else if (arg.startsWith("--account=")) args.account = arg.split("=")[1];
    else if (arg.startsWith("--from=")) args.from = arg.split("=")[1];
  }
  return args;
}

function parseTokyoLocal(value) {
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) return new Date(value);
  return new Date(`${value}+09:00`);
}

function toTokyoParts(date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateKey(date) {
  const parts = toTokyoParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatTokyoLocal(date, time) {
  return `${formatDateKey(date)}T${time}:00`;
}

function addTokyoDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfTokyoDay(date) {
  const parts = toTokyoParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - JST_OFFSET_MS);
}

function stableNumber(seed, modulo) {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hash, 16) % modulo;
}

function pick(list, seed) {
  return list[stableNumber(seed, list.length)];
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function postId(accountId, scheduledAt, pillar) {
  const compactDate = scheduledAt.replaceAll(/[-:T]/g, "").slice(0, 12);
  const suffix = createHash("sha1").update(`${accountId}:${scheduledAt}:${pillar}`).digest("hex").slice(0, 6);
  return `${accountId}-${compactDate}-${pillar.replaceAll("_", "-")}-${suffix}`;
}

function isLinkSlot(sequence, linkEvery) {
  return sequence > 0 && sequence % linkEvery === 0;
}

const fortuneTopics = {
  reply_waiting: [
    ["返信が来ない夜は、相手の気持ちより先に自分の不安が大きくなる。", "でも返信の遅さだけで、好意の有無まで決めなくていい。", "今日は結論より、落ち着いて待てる距離を作る日。"],
    ["既読がついたまま止まると、頭の中で悪い答えばかり増えていく。", "その想像は事実ではなく、不安が作った仮説かもしれない。", "送る前に一度だけ、深呼吸してからでいい。"],
    ["返事を待つ時間が長いほど、自分の価値まで下げて考えやすい。", "でも、返事の速さとあなたの大切さは同じではない。", "急いで確かめなくても、今日は少し置いていい。"],
  ],
  before_sending: [
    ["寂しいときに送る一言ほど、本音より不安が前に出やすい。", "送る前に「何を返してほしいのか」だけ書き出してみる。", "それだけで、言葉の温度は少し変わる。"],
    ["連絡したくなったときは、まず文章を下書きに置く。", "すぐ送らないだけで、責める言葉と伝えたい言葉を分けやすくなる。", "恋は勢いより、余白が残る一言のほうが届く日もある。"],
    ["不安なまま送ると、確認したいだけの言葉が責めているように見えることがある。", "今日は送る前に、相手ではなく自分の不安を先に見てあげる。", "それは我慢ではなく、自分を守る準備。"],
  ],
  reconciliation: [
    ["復縁したい気持ちが強いほど、今すぐ動きたくなる。", "でも未練が一番強い日に送る言葉は、重くなりやすい。", "動く日と整える日は、分けて考えていい。"],
    ["忘れられないのは、弱いからではなく大切にしていた証拠でもある。", "ただ、その気持ちを全部そのまま渡す前に、少しだけ形を整えたい。", "相手に届く言葉は、焦りが抜けたあとに残る。"],
    ["復縁で一番苦しいのは、可能性があるのかないのか分からない時間。", "だからこそ、相手の反応を追い続ける前に自分の望みを整理する。", "連絡するかどうかは、そのあとでいい。"],
  ],
  uncertain_relation: [
    ["曖昧な関係ほど、優しい一言に期待して冷たい沈黙で崩れやすい。", "相手の態度を読む前に、自分がどんな扱いを望むのかを見ておきたい。", "恋は我慢の量で深くなるわけではない。"],
    ["都合のいい関係かもしれないと感じたとき、答えを急ぐほど苦しくなる。", "まずは相手を責める前に、自分が無理している場面を数える。", "見えてきた違和感は、ちゃんと大事にしていい。"],
    ["好きだから待てる日もある。", "でも、待つことが自分を削るだけになっているなら、一度立ち止まる合図かもしれない。", "恋の中でも、自分の生活は置き去りにしなくていい。"],
  ],
  fortune_question: [
    ["占いに聞くなら「彼は私を好きですか」だけで終わらせない。", "今は待つ時期か、動くなら何を避けるべきかまで聞くと、次の行動に変えやすい。", "答えを丸投げせず、気持ちを整理する使い方がいい。"],
    ["相談するときは、聞きたいことを一つに絞るほど楽になる。", "復縁、連絡、相性、不安。全部を一度に抱えると苦しい。", "まず今夜いちばん重い悩みだけでいい。"],
    ["占いは未来を決めてもらう場所というより、自分の本音を言葉にする場所として使うほうがいい。", "何が怖いのか、何を期待しているのか。", "そこが見えるだけで、次の一言は変わる。"],
  ],
  self_respect: [
    ["恋で苦しいときほど、相手の気持ちばかり見に行ってしまう。", "でも本当は、自分がどれだけ無理をしているかも同じくらい大切。", "大事にされたい気持ちは、わがままではない。"],
    ["好きな人に合わせすぎると、いつの間にか自分の予定も機嫌も後回しになる。", "恋を続けたいなら、自分の生活を崩しすぎないことも必要。", "待つ時間にも、あなたの人生は進んでいる。"],
    ["相手に選ばれるかどうかだけで、自分の価値を決めなくていい。", "恋の結果とあなたの魅力は、同じものではない。", "今日は少し、自分側に戻ってくる。"],
  ],
};

const sideHustleTopics = {
  market_selection: [
    ["副業で最初に見るべきなのは、作業量より市場の強さ。", "同じ1投稿でも、欲求が強い場所と弱い場所では反応が変わる。", "先に市場を選ぶと、努力の空振りが減る。"],
    ["稼げる人は、投稿文だけを見ていない。", "誰のどんな悩みに刺すか、最後に何へ流すかまで決めている。", "副業は作業より、設計で差がつく。"],
    ["低単価案件を積み上げるほど、時間だけが削られることがある。", "少ない成約で月の数字が動く導線を先に考える。", "量を増やす前に、単価と需要を見る。"],
  ],
  high_ticket: [
    ["高単価アフィリは、クリック数が少なくても勝てる可能性がある。", "その代わり、雑な煽りでは売れにくい。", "悩みを整理して、比較して、納得してもらう導線がいる。"],
    ["安い商品ほど勢いで売れることがある。", "高い商品ほど、なぜ今それを見るべきかの理由が必要になる。", "投稿は売り込みより、判断材料を渡す場所。"],
    ["1件100円の案件を100件取るのと、1件1万円の案件を1件取るのは別ゲーム。", "初心者ほど、どちらを選ぶかで作業量が変わる。", "自分の時間単価から逆算したほうがいい。"],
  ],
  ai_workflow: [
    ["AI副業で大事なのは、AIに丸投げすることではない。", "調べる、構成する、言い換える、予約する。面倒な部分を分解して任せる。", "仕組みにすると、毎日の迷いが減る。"],
    ["AIツールは稼ぐ道具というより、試行回数を増やす道具。", "投稿案、導線案、比較表、改善案を速く出せる。", "市場選びまで外すと、量だけ増えても伸びにくい。"],
    ["自動化で最初に楽にするのは、収益ではなく継続。", "投稿を考える、保存する、予約する。この詰まりを減らす。", "続けられる状態を作ると、改善する余裕が残る。"],
  ],
  sns_funnel: [
    ["SNSアフィリは、投稿だけで完結させようとすると弱い。", "投稿で興味を作って、プロフィールで整理して、リンク先で選ばせる。", "役割を分けるほど、売り込み感は薄くなる。"],
    ["Threadsは短い文章で温度を作りやすい。", "でもリンクを毎回貼ると、読まれる前に広告っぽく見える。", "普段は考え方、たまに導線くらいがちょうどいい。"],
    ["投稿は入口、固定投稿は説明、リンク先は比較。", "この3つを分けるだけで、同じ案件でも見え方が変わる。", "いきなり売るより、迷わず選べる状態を作る。"],
  ],
  adult_adjacent_safe: [
    ["男性向け市場は需要が強い。", "ただし強い市場ほど、表現と導線を間違えると危ない。", "露骨に寄せるより、ルールと境界線を理解して設計するほうが長く残る。"],
    ["成人向けに近い市場は、ただ刺激的に書けばいいわけではない。", "プラットフォームの規約、広告先の条件、投稿の見せ方を分ける。", "攻めるなら、先に守る線を決める。"],
    ["需要が強いジャンルほど、雑に扱うとアカウントが短命になる。", "表では市場設計、リンク先で適性確認、最終商品で詳細。", "この距離感を作れる人が強い。"],
  ],
  beginner_mistake: [
    ["初心者が詰まりやすいのは、案件を決める前に投稿を増やすこと。", "誰に何を売るかが曖昧だと、伸びた投稿も収益に変わりにくい。", "先に出口を決める。"],
    ["教材を読むだけで満足すると、収益は動かない。", "1つ読んだら、投稿を3本、導線を1つ、検証を1回。", "小さく使って初めて元が取れる。"],
    ["副業で完璧な準備を待つと、だいたい始まらない。", "雑に始めるのではなく、小さく試す。", "1週間で反応を見て、弱いところだけ直せばいい。"],
  ],
};

function fortunePost({ seed, pillar, linkSlot, links }) {
  if (linkSlot || pillar === "soft_cta") {
    const ctas = [
      ["復縁で迷っているときほど、相手に送る前に一度だけ気持ちを整理したほうがいい。", "今連絡していいのか。待つべきなのか。まだ可能性があるのか。", `ひとりで考えすぎる夜用に置いておきます。\n\n${links.reconciliation}`],
      ["恋愛や復縁で頭がいっぱいになる夜は、答えを急ぐほど苦しくなりやすい。", "まずは相談したいことを一つに絞るところから。", `気持ちを整理する入口として置いておきます。\n\n${links.note}`],
      ["占いに聞くなら、決断を丸投げするより「今どう動くか」を整理する使い方がいい。", "連絡、待つ、距離を置く。迷いが強い夜ほど、質問を一つに絞る。", `話しながら整理したい人向けです。\n\n${links.chat}`],
    ];
    return pick(ctas, seed).join("\n\n");
  }
  return pick(fortuneTopics[pillar] ?? fortuneTopics.reply_waiting, seed).join("\n\n");
}

function sideHustlePost({ seed, pillar, linkSlot, links }) {
  if (linkSlot || pillar === "soft_cta") {
    const ctas = [
      ["低単価で消耗したくないなら、最初に見るべきは投稿数より導線。", "どの市場に、どんな切り口で、最後に何を置くか。", `SNSアフィリ系の教材候補をまとめています。\n\n${links.note}`],
      ["AIで副業を回したい人ほど、先に作業の流れを決めたほうがいい。", "投稿作成、予約、リンク導線、改善。この順番で仕組みにする。", `AI自動化寄りで見るならこれ。\n\n${links.ai_automation}`],
      ["Threadsで高単価ASPを狙うなら、毎回リンクを貼るより固定導線を作るほうが自然。", "投稿は興味、プロフィールは整理、リンク先で比較。", `Threads向けの入口として置いておきます。\n\n${links.threads_asp}`],
    ];
    return pick(ctas, seed).join("\n\n");
  }
  return pick(sideHustleTopics[pillar] ?? sideHustleTopics.market_selection, seed).join("\n\n");
}

function makePost({ accountId, scheduledAt, sequence, config }) {
  const account = config.accounts[accountId];
  const linkEvery = config.generation.link_every;
  const linkSlot = isLinkSlot(sequence, linkEvery);
  const pillars = account.pillars.filter((pillar) => (linkSlot ? true : pillar !== "soft_cta"));
  const pillar = linkSlot ? "soft_cta" : pillars[sequence % pillars.length];
  const seed = `${accountId}:${scheduledAt}:${sequence}:${pillar}`;
  const text = accountId === "fortune"
    ? fortunePost({ seed, pillar, linkSlot, links: account.links })
    : sideHustlePost({ seed, pillar, linkSlot, links: account.links });

  if (text.length > config.generation.max_length && !text.includes("http")) {
    throw new Error(`Generated post is too long (${text.length}) for ${accountId} ${scheduledAt}`);
  }

  return {
    id: postId(accountId, scheduledAt, pillar),
    account_id: accountId,
    scheduled_at: scheduledAt,
    status: "scheduled",
    kind: linkSlot ? "generated_cta" : "generated_trust",
    pillar,
    generated_at: new Date().toISOString(),
    text,
  };
}

function latestScheduledDate(posts, accountId) {
  const dates = posts
    .filter((post) => post.account_id === accountId && post.scheduled_at)
    .map((post) => parseTokyoLocal(post.scheduled_at))
    .sort((a, b) => b - a);
  return dates[0];
}

function countAccountPosts(posts, accountId) {
  return posts.filter((post) => post.account_id === accountId).length;
}

function scheduledAtExists(posts, accountId, scheduledAt) {
  return posts.some((post) => post.account_id === accountId && post.scheduled_at === scheduledAt);
}

function buildAccountPosts({ schedule, config, accountId, now, daysAhead }) {
  const account = config.accounts[accountId];
  const horizon = addTokyoDays(startOfTokyoDay(now), daysAhead);
  const latest = latestScheduledDate(schedule.posts, accountId) ?? startOfTokyoDay(now);
  let cursor = addTokyoDays(startOfTokyoDay(latest), 1);
  let sequence = countAccountPosts(schedule.posts, accountId);
  const usedTexts = new Set(schedule.posts.map((post) => normalizeText(post.text ?? "")));
  const newPosts = [];

  while (cursor <= horizon) {
    for (const time of account.times) {
      const scheduledAt = formatTokyoLocal(cursor, time);
      if (scheduledAtExists(schedule.posts, accountId, scheduledAt)) continue;

      let post = makePost({ accountId, scheduledAt, sequence, config });
      let attempts = 0;
      while (usedTexts.has(normalizeText(post.text)) && attempts < 12) {
        sequence += 1;
        attempts += 1;
        post = makePost({ accountId, scheduledAt, sequence, config });
      }

      usedTexts.add(normalizeText(post.text));
      newPosts.push(post);
      sequence += 1;
    }
    cursor = addTokyoDays(cursor, 1);
  }

  return newPosts;
}

const args = parseArgs(process.argv.slice(2));
const schedule = JSON.parse(await readFile(schedulePath, "utf8"));
const config = JSON.parse(await readFile(configPath, "utf8"));
const daysAhead = args.daysAhead ?? config.generation.days_ahead;
const now = args.from ? parseTokyoLocal(args.from) : new Date();
const accountIds = args.account === "all" ? Object.keys(config.accounts) : [args.account];
const unknownAccounts = accountIds.filter((accountId) => !config.accounts[accountId]);
if (unknownAccounts.length) throw new Error(`Unknown account(s): ${unknownAccounts.join(", ")}`);

const additions = [];
for (const accountId of accountIds) {
  additions.push(...buildAccountPosts({ schedule, config, accountId, now, daysAhead }));
}

if (additions.length > 0) {
  schedule.posts.push(...additions);
  schedule.posts.sort((a, b) => {
    const byDate = parseTokyoLocal(a.scheduled_at) - parseTokyoLocal(b.scheduled_at);
    if (byDate !== 0) return byDate;
    return a.account_id.localeCompare(b.account_id);
  });
}

if (!args.dryRun && additions.length > 0) {
  await writeFile(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  dry_run: args.dryRun,
  days_ahead: daysAhead,
  from: formatDateKey(now),
  added: additions.length,
  by_account: accountIds.reduce((acc, accountId) => {
    acc[accountId] = additions.filter((post) => post.account_id === accountId).length;
    return acc;
  }, {}),
  first_added: additions[0]?.scheduled_at ?? null,
  last_added: additions.at(-1)?.scheduled_at ?? null,
}, null, 2));
