import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const schedulePath = new URL("../threads_schedule.json", import.meta.url);
const configPath = new URL("../content_generation_config.json", import.meta.url);
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  return argv.reduce((args, arg) => {
    if (arg === "--dry-run") args.dryRun = true;
    if (arg.startsWith("--days-ahead=")) args.daysAhead = Number(arg.split("=")[1]);
    if (arg.startsWith("--account=")) args.account = arg.split("=")[1];
    if (arg.startsWith("--from=")) args.from = arg.split("=")[1];
    return args;
  }, { dryRun: false, account: "all" });
}

function parseTokyoLocal(value) {
  if (/[zZ]|[+-]\d\d:\d\d$/.test(value)) return new Date(value);
  return new Date(`${value}+09:00`);
}

function tokyoDateParts(date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function pad(value) { return String(value).padStart(2, "0"); }
function formatDateKey(date) { const p = tokyoDateParts(date); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; }
function formatTokyoLocal(date, time) { return `${formatDateKey(date)}T${time}:00`; }
function startOfTokyoDay(date) { const p = tokyoDateParts(date); return new Date(Date.UTC(p.year, p.month - 1, p.day) - JST_OFFSET_MS); }
function addTokyoDays(date, days) { return new Date(date.getTime() + days * DAY_MS); }

function hashNumber(seed, modulo) {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hash, 16) % modulo;
}

function pick(list, seed) { return list[hashNumber(seed, list.length)]; }
function normalizeText(text) { return text.replace(/\s+/g, " ").trim(); }

function postId(accountId, scheduledAt, pillar) {
  const compactDate = scheduledAt.replaceAll(/[-:T]/g, "").slice(0, 12);
  const suffix = createHash("sha1").update(`${accountId}:${scheduledAt}:${pillar}`).digest("hex").slice(0, 6);
  return `${accountId}-${compactDate}-${pillar.replaceAll("_", "-")}-${suffix}`;
}

const banks = {
  fortune: {
    openers: [
      "返信が来ない夜は、不安の声が大きくなる。",
      "既読のまま止まると、悪い想像ばかり増えやすい。",
      "復縁したい気持ちが強いほど、今すぐ動きたくなる。",
      "寂しいときに送る一言ほど、本音より不安が前に出やすい。",
      "曖昧な関係ほど、優しい一言に期待して沈黙で崩れやすい。",
      "占いに聞くなら、まず悩みを一つに絞る。",
      "恋で苦しいときほど、相手の気持ちばかり見に行ってしまう。",
      "好きだから待てる日もある。",
      "返事を待つ時間が長いほど、自分の価値まで下げて考えやすい。",
      "不安なまま送ると、確認したい言葉が責めているように見えることがある。"
    ],
    middles: [
      "でも返信の遅さだけで、好意の有無まで決めなくていい。",
      "その想像は事実ではなく、不安が作った仮説かもしれない。",
      "未練が一番強い日に送る言葉は、重くなりやすい。",
      "送る前に、何を返してほしいのかだけ書き出してみる。",
      "相手の態度を読む前に、自分がどんな扱いを望むのかを見る。",
      "今は待つ時期か、動くなら何を避けるべきかまで考える。",
      "自分がどれだけ無理をしているかも同じくらい大切。",
      "待つことが自分を削るだけなら、一度立ち止まる合図かもしれない。",
      "返事の速さとあなたの大切さは、同じものではない。",
      "相手ではなく、自分の不安を先に見てあげる。"
    ],
    closes: [
      "今日は結論より、落ち着いて待てる距離を作る日。",
      "送る前に一度だけ、深呼吸してからでいい。",
      "動く日と整える日は、分けて考えていい。",
      "それだけで、言葉の温度は少し変わる。",
      "恋は我慢の量で深くなるわけではない。",
      "答えを丸投げせず、気持ちを整理する使い方がいい。",
      "大事にされたい気持ちは、わがままではない。",
      "恋の中でも、自分の生活は置き去りにしなくていい。",
      "急いで確かめなくても、今日は少し置いていい。",
      "それは我慢ではなく、自分を守る準備。"
    ],
    footers: ["今日は、答えより呼吸を先に置く。", "焦らない選択も、ちゃんと前に進むこと。", "不安な夜ほど、自分側に戻ってくる。", "相手を読む前に、自分の本音を拾う。", "今夜は結論を出さない勇気でいい。"]
  },
  side_hustle: {
    openers: [
      "副業で最初に見るべきなのは、作業量より市場の強さ。",
      "稼げる人は、投稿文だけを見ていない。",
      "低単価案件を積み上げるほど、時間だけが削られることがある。",
      "高単価アフィリは、クリック数が少なくても勝てる可能性がある。",
      "AI副業で大事なのは、AIに丸投げすることではない。",
      "SNSアフィリは、投稿だけで完結させようとすると弱い。",
      "男性向け市場は需要が強い。",
      "初心者が詰まりやすいのは、案件を決める前に投稿を増やすこと。",
      "Threadsは短い文章で温度を作りやすい。",
      "自動化で最初に楽にするのは、収益ではなく継続。"
    ],
    middles: [
      "同じ1投稿でも、欲求が強い場所と弱い場所では反応が変わる。",
      "誰のどんな悩みに刺すか、最後に何へ流すかまで決めている。",
      "少ない成約で月の数字が動く導線を先に考える。",
      "雑な煽りではなく、比較して納得してもらう導線がいる。",
      "調べる、構成する、言い換える、予約する。面倒な部分を分解して任せる。",
      "投稿で興味を作って、プロフィールで整理して、リンク先で選ばせる。",
      "強い市場ほど、表現と導線を間違えると危ない。",
      "誰に何を売るかが曖昧だと、伸びた投稿も収益に変わりにくい。",
      "リンクを毎回貼ると、読まれる前に広告っぽく見える。",
      "投稿を考える、保存する、予約する。この詰まりを減らす。"
    ],
    closes: [
      "先に市場を選ぶと、努力の空振りが減る。",
      "副業は作業より、設計で差がつく。",
      "量を増やす前に、単価と需要を見る。",
      "投稿は売り込みより、判断材料を渡す場所。",
      "仕組みにすると、毎日の迷いが減る。",
      "役割を分けるほど、売り込み感は薄くなる。",
      "ルールと境界線を理解して設計するほうが長く残る。",
      "先に出口を決める。",
      "普段は考え方、たまに導線くらいがちょうどいい。",
      "続けられる状態を作ると、改善する余裕が残る。"
    ],
    footers: ["先に出口を決めると、投稿の迷いが減る。", "作業量より、設計のズレを減らすほうが先。", "小さく試して、反応がある場所に寄せる。", "売る前に、選ばれる理由を作る。", "リンクを貼る前に、読む理由を作る。"]
  }
};

function compose(accountId, seed) {
  const bank = banks[accountId];
  return [
    pick(bank.openers, `${seed}:open`),
    pick(bank.middles, `${seed}:middle`),
    pick(bank.closes, `${seed}:close`),
    pick(bank.footers, `${seed}:footer`)
  ].join("\n\n");
}

function ctaPost(accountId, links, seed) {
  const ctas = accountId === "fortune" ? [
    ["復縁で迷っているときほど、相手に送る前に一度だけ気持ちを整理したほうがいい。", "今連絡していいのか。待つべきなのか。まだ可能性があるのか。", `ひとりで考えすぎる夜用に置いておきます。\n\n${links.reconciliation}`],
    ["恋愛や復縁で頭がいっぱいになる夜は、答えを急ぐほど苦しくなりやすい。", "まずは相談したいことを一つに絞るところから。", `気持ちを整理する入口として置いておきます。\n\n${links.note}`],
    ["占いに聞くなら、決断を丸投げするより今どう動くかを整理する使い方がいい。", "連絡、待つ、距離を置く。迷いが強い夜ほど、質問を一つに絞る。", `話しながら整理したい人向けです。\n\n${links.chat}`]
  ] : [
    ["低単価で消耗したくないなら、最初に見るべきは投稿数より導線。", "どの市場に、どんな切り口で、最後に何を置くか。", `SNSアフィリ系の教材候補をまとめています。\n\n${links.note}`],
    ["AIで副業を回したい人ほど、先に作業の流れを決めたほうがいい。", "投稿作成、予約、リンク導線、改善。この順番で仕組みにする。", `AI自動化寄りで見るならこれ。\n\n${links.ai_automation}`],
    ["Threadsで高単価ASPを狙うなら、毎回リンクを貼るより固定導線を作るほうが自然。", "投稿は興味、プロフィールは整理、リンク先で比較。", `Threads向けの入口として置いておきます。\n\n${links.threads_asp}`],
    ["高額教材から入るのが怖い人は、まず低単価で市場の仕組みを見たほうがいい。", "スマホだけで始める系の需要と導線を確認する入口です。", `今週の低単価候補として置いておきます。\n\n${links.urakaku}`],
    ["成人向けに近い市場は、勢いよりルールと導線設計が大事。", "表の投稿で煽らず、リンク先で適性を見てもらう形が安全です。", `リール寄りで見るならこれ。\n\n${links.mudo_reels}`]
  ];
  return pick(ctas, seed).join("\n\n");
}

function makePost({ accountId, scheduledAt, sequence, config }) {
  const account = config.accounts[accountId];
  const linkSlot = sequence > 0 && sequence % config.generation.link_every === 0;
  const pillars = account.pillars.filter((pillar) => pillar !== "soft_cta");
  const pillar = linkSlot ? "soft_cta" : pillars[sequence % pillars.length];
  const seed = `${accountId}:${scheduledAt}:${sequence}:${pillar}`;
  const text = linkSlot ? ctaPost(accountId, account.links, seed) : compose(accountId, seed);
  if (text.length > config.generation.max_length && !text.includes("http")) throw new Error(`Generated post is too long (${text.length}) for ${accountId} ${scheduledAt}`);
  return { id: postId(accountId, scheduledAt, pillar), account_id: accountId, scheduled_at: scheduledAt, status: "scheduled", kind: linkSlot ? "generated_cta" : "generated_trust", pillar, generated_at: new Date().toISOString(), text };
}

function latestScheduledDate(posts, accountId) {
  const dates = posts.filter((post) => post.account_id === accountId && post.scheduled_at).map((post) => parseTokyoLocal(post.scheduled_at)).sort((a, b) => b - a);
  return dates[0];
}

function buildAccountPosts({ schedule, config, accountId, now, daysAhead }) {
  const account = config.accounts[accountId];
  const horizon = addTokyoDays(startOfTokyoDay(now), daysAhead);
  const latest = latestScheduledDate(schedule.posts, accountId) ?? startOfTokyoDay(now);
  let cursor = addTokyoDays(startOfTokyoDay(latest), 1);
  let sequence = schedule.posts.filter((post) => post.account_id === accountId).length;
  const usedTexts = new Set(schedule.posts.map((post) => normalizeText(post.text ?? "")));
  const newPosts = [];
  while (cursor <= horizon) {
    for (const time of account.times) {
      const scheduledAt = formatTokyoLocal(cursor, time);
      if (schedule.posts.some((post) => post.account_id === accountId && post.scheduled_at === scheduledAt)) continue;
      let post = makePost({ accountId, scheduledAt, sequence, config });
      let attempts = 0;
      while (usedTexts.has(normalizeText(post.text)) && attempts < 25) {
        sequence += 1;
        attempts += 1;
        post = makePost({ accountId, scheduledAt, sequence, config });
      }
      if (usedTexts.has(normalizeText(post.text))) throw new Error(`Could not create unique post for ${accountId} ${scheduledAt}`);
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
const additions = accountIds.flatMap((accountId) => buildAccountPosts({ schedule, config, accountId, now, daysAhead }));
if (additions.length > 0) {
  schedule.posts.push(...additions);
  schedule.posts.sort((a, b) => parseTokyoLocal(a.scheduled_at) - parseTokyoLocal(b.scheduled_at) || a.account_id.localeCompare(b.account_id));
}
if (!args.dryRun && additions.length > 0) await writeFile(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ dry_run: args.dryRun, days_ahead: daysAhead, from: formatDateKey(now), added: additions.length, by_account: Object.fromEntries(accountIds.map((accountId) => [accountId, additions.filter((post) => post.account_id === accountId).length])), first_added: additions[0]?.scheduled_at ?? null, last_added: additions.at(-1)?.scheduled_at ?? null }, null, 2));
