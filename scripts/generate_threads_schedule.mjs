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
  const { year, month, day } = tokyoDateParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatTokyoLocal(date, time) {
  return `${formatDateKey(date)}T${time}:00`;
}

function startOfTokyoDay(date) {
  const { year, month, day } = tokyoDateParts(date);
  return new Date(Date.UTC(year, month - 1, day) - JST_OFFSET_MS);
}

function addTokyoDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function hashNumber(seed, modulo) {
  const hash = createHash("sha256").update(seed).digest("hex").slice(0, 12);
  return Number.parseInt(hash, 16) % modulo;
}

function pick(list, seed) {
  return list[hashNumber(seed, list.length)];
}

function postId(accountId, scheduledAt, pillar) {
  const compactDate = scheduledAt.replaceAll(/[-:T]/g, "").slice(0, 12);
  const suffix = createHash("sha1").update(`${accountId}:${scheduledAt}:${pillar}`).digest("hex").slice(0, 6);
  return `${accountId}-${compactDate}-${pillar.replaceAll("_", "-")}-${suffix}`;
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

const fortuneParts = {
  reply_waiting: {
    openers: ["返信が来ない夜は、不安の声が大きくなる。", "既読のまま止まると、悪い想像ばかり増えやすい。", "待つ時間が長いほど、自分の価値まで下げて考えやすい。"],
    middles: ["でも返信の遅さだけで、好意の有無まで決めなくていい。", "その想像は事実ではなく、不安が作った仮説かもしれない。", "返事の速さとあなたの大切さは、同じものではない。"],
    closes: ["今日は結論より、落ち着いて待てる距離を作る日。", "送る前に一度だけ、深呼吸してからでいい。", "急いで確かめなくても、少し置いていい。"],
  },
  before_sending: {
    openers: ["寂しいときに送る一言ほど、本音より不安が前に出やすい。", "連絡したくなったときは、まず文章を下書きに置く。", "不安なまま送ると、確認したい言葉が責めているように見えることがある。"],
    middles: ["「何を返してほしいのか」だけ書き出してみる。", "すぐ送らないだけで、責める言葉と伝えたい言葉を分けやすくなる。", "相手ではなく、自分の不安を先に見てあげる。"],
    closes: ["それだけで、言葉の温度は少し変わる。", "恋は勢いより、余白が残る一言のほうが届く日もある。", "それは我慢ではなく、自分を守る準備。"],
  },
  reconciliation: {
    openers: ["復縁したい気持ちが強いほど、今すぐ動きたくなる。", "忘れられないのは、弱いからではなく大切にしていた証拠でもある。", "復縁で一番苦しいのは、可能性が見えない時間。"],
    middles: ["でも未練が一番強い日に送る言葉は、重くなりやすい。", "その気持ちを全部そのまま渡す前に、少しだけ形を整えたい。", "相手の反応を追い続ける前に、自分の望みを整理する。"],
    closes: ["動く日と整える日は、分けて考えていい。", "相手に届く言葉は、焦りが抜けたあとに残る。", "連絡するかどうかは、そのあとでいい。"],
  },
  uncertain_relation: {
    openers: ["曖昧な関係ほど、優しい一言に期待して沈黙で崩れやすい。", "都合のいい関係かもしれないと感じたとき、答えを急ぐほど苦しくなる。", "好きだから待てる日もある。"],
    middles: ["相手の態度を読む前に、自分がどんな扱いを望むのかを見る。", "相手を責める前に、自分が無理している場面を数える。", "待つことが自分を削るだけなら、一度立ち止まる合図かもしれない。"],
    closes: ["恋は我慢の量で深くなるわけではない。", "見えてきた違和感は、ちゃんと大事にしていい。", "恋の中でも、自分の生活は置き去りにしなくていい。"],
  },
  fortune_question: {
    openers: ["占いに聞くなら「彼は私を好きですか」だけで終わらせない。", "相談するときは、聞きたいことを一つに絞るほど楽になる。", "占いは未来を決めてもらう場所というより、本音を言葉にする場所として使うほうがいい。"],
    middles: ["今は待つ時期か、動くなら何を避けるべきかまで聞く。", "復縁、連絡、相性、不安。全部を一度に抱えると苦しい。", "何が怖いのか、何を期待しているのかを見ていく。"],
    closes: ["答えを丸投げせず、気持ちを整理する使い方がいい。", "まず今夜いちばん重い悩みだけでいい。", "そこが見えるだけで、次の一言は変わる。"],
  },
  self_respect: {
    openers: ["恋で苦しいときほど、相手の気持ちばかり見に行ってしまう。", "好きな人に合わせすぎると、自分の予定も機嫌も後回しになる。", "相手に選ばれるかどうかだけで、自分の価値を決めなくていい。"],
    middles: ["でも本当は、自分がどれだけ無理をしているかも同じくらい大切。", "恋を続けたいなら、自分の生活を崩しすぎないことも必要。", "恋の結果とあなたの魅力は、同じものではない。"],
    closes: ["大事にされたい気持ちは、わがままではない。", "待つ時間にも、あなたの人生は進んでいる。", "今日は少し、自分側に戻ってくる。"],
  },
};

const sideParts = {
  market_selection: {
    openers: ["副業で最初に見るべきなのは、作業量より市場の強さ。", "稼げる人は、投稿文だけを見ていない。", "低単価案件を積み上げるほど、時間だけが削られることがある。"],
    middles: ["同じ1投稿でも、欲求が強い場所と弱い場所では反応が変わる。", "誰のどんな悩みに刺すか、最後に何へ流すかまで決めている。", "少ない成約で月の数字が動く導線を先に考える。"],
    closes: ["先に市場を選ぶと、努力の空振りが減る。", "副業は作業より、設計で差がつく。", "量を増やす前に、単価と需要を見る。"],
  },
  high_ticket: {
    openers: ["高単価アフィリは、クリック数が少なくても勝てる可能性がある。", "安い商品ほど勢いで売れることがある。", "1件100円の案件を100件取るのと、1件1万円の案件を1件取るのは別ゲーム。"],
    middles: ["その代わり、雑な煽りでは売れにくい。", "高い商品ほど、なぜ今それを見るべきかの理由が必要になる。", "初心者ほど、どちらを選ぶかで作業量が変わる。"],
    closes: ["悩みを整理して、比較して、納得してもらう導線がいる。", "投稿は売り込みより、判断材料を渡す場所。", "自分の時間単価から逆算したほうがいい。"],
  },
  ai_workflow: {
    openers: ["AI副業で大事なのは、AIに丸投げすることではない。", "AIツールは稼ぐ道具というより、試行回数を増やす道具。", "自動化で最初に楽にするのは、収益ではなく継続。"],
    middles: ["調べる、構成する、言い換える、予約する。面倒な部分を分解して任せる。", "投稿案、導線案、比較表、改善案を速く出せる。", "投稿を考える、保存する、予約する。この詰まりを減らす。"],
    closes: ["仕組みにすると、毎日の迷いが減る。", "市場選びまで外すと、量だけ増えても伸びにくい。", "続けられる状態を作ると、改善する余裕が残る。"],
  },
  sns_funnel: {
    openers: ["SNSアフィリは、投稿だけで完結させようとすると弱い。", "Threadsは短い文章で温度を作りやすい。", "投稿は入口、固定投稿は説明、リンク先は比較。"],
    middles: ["投稿で興味を作って、プロフィールで整理して、リンク先で選ばせる。", "でもリンクを毎回貼ると、読まれる前に広告っぽく見える。", "この3つを分けるだけで、同じ案件でも見え方が変わる。"],
    closes: ["役割を分けるほど、売り込み感は薄くなる。", "普段は考え方、たまに導線くらいがちょうどいい。", "いきなり売るより、迷わず選べる状態を作る。"],
  },
  rakuten_workstyle: {
    openers: ["副業を続けるなら、教材より先に作業環境を整えるのも大事。", "在宅で作業する人ほど、椅子と机まわりの小さなストレスを甘く見ないほうがいい。", "楽天アフィリで扱いやすいのは、生活の悩みと商品がすぐつながるジャンル。"],
    middles: ["肩こり、机の狭さ、集中しにくさ。こういう悩みは、商品紹介に自然につなげやすい。", "商品名から入るより、まず悩みを言葉にしたほうが読まれやすい。", "在宅ワーク用品、収納、時短グッズは、売り込みより選び方を出すほうが自然。"],
    closes: ["高単価だけでなく、日常の小さな悩みから入口を作る。", "まずは1ジャンル、1記事、1投稿で反応を見る。", "リンクを貼る前に、なぜ見るべきかを作る。"],
  },
  adult_adjacent_safe: {
    openers: ["男性向け市場は需要が強い。", "成人向けに近い市場は、ただ刺激的に書けばいいわけではない。", "需要が強いジャンルほど、雑に扱うとアカウントが短命になる。"],
    middles: ["ただし強い市場ほど、表現と導線を間違えると危ない。", "プラットフォームの規約、広告先の条件、投稿の見せ方を分ける。", "表では市場設計、リンク先で適性確認、最終商品で詳細。"],
    closes: ["露骨に寄せるより、ルールと境界線を理解して設計するほうが長く残る。", "攻めるなら、先に守る線を決める。", "この距離感を作れる人が強い。"],
  },
  beginner_mistake: {
    openers: ["初心者が詰まりやすいのは、案件を決める前に投稿を増やすこと。", "教材を読むだけで満足すると、収益は動かない。", "副業で完璧な準備を待つと、だいたい始まらない。"],
    middles: ["誰に何を売るかが曖昧だと、伸びた投稿も収益に変わりにくい。", "1つ読んだら、投稿を3本、導線を1つ、検証を1回。", "雑に始めるのではなく、小さく試す。"],
    closes: ["先に出口を決める。", "小さく使って初めて元が取れる。", "1週間で反応を見て、弱いところだけ直せばいい。"],
  },
};

const fortuneFooters = ["今日は、答えより呼吸を先に置く。", "焦らない選択も、ちゃんと前に進むこと。", "不安な夜ほど、自分側に戻ってくる。", "相手を読む前に、自分の本音を拾う。", "今夜は結論を出さない勇気でいい。"]; 
const sideFooters = ["先に出口を決めると、投稿の迷いが減る。", "作業量より、設計のズレを減らすほうが先。", "小さく試して、反応がある場所に寄せる。", "売る前に、選ばれる理由を作る。", "リンクを貼る前に、読む理由を作る。"]; 

function compose(parts, seed, footers) {
  return [
    pick(parts.openers, `${seed}:open`),
    pick(parts.middles, `${seed}:middle`),
    pick(parts.closes, `${seed}:close`),
    pick(footers, `${seed}:footer`),
  ].join("\n\n");
}

function ctaPost(accountId, links, seed) {
  const ctas = accountId === "fortune" ? [
    ["復縁で迷っているときほど、相手に送る前に一度だけ気持ちを整理したほうがいい。", "今連絡していいのか。待つべきなのか。まだ可能性があるのか。", `ひとりで考えすぎる夜用に置いておきます。\n\n${links.reconciliation}`],
    ["恋愛や復縁で頭がいっぱいになる夜は、答えを急ぐほど苦しくなりやすい。", "まずは相談したいことを一つに絞るところから。", `気持ちを整理する入口として置いておきます。\n\n${links.note}`],
    ["占いに聞くなら、決断を丸投げするより「今どう動くか」を整理する使い方がいい。", "連絡、待つ、距離を置く。迷いが強い夜ほど、質問を一つに絞る。", `話しながら整理したい人向けです。\n\n${links.chat}`],
  ] : [
    ["低単価で消耗したくないなら、最初に見るべきは投稿数より導線。", "どの市場に、どんな切り口で、最後に何を置くか。", `SNSアフィリ系の教材候補をまとめています。\n\n${links.note}`],
    ["AIで副業を回したい人ほど、先に作業の流れを決めたほうがいい。", "投稿作成、予約、リンク導線、改善。この順番で仕組みにする。", `AI自動化寄りで見るならこれ。\n\n${links.ai_automation}`],
    ["Threadsで高単価ASPを狙うなら、毎回リンクを貼るより固定導線を作るほうが自然。", "投稿は興味、プロフィールは整理、リンク先で比較。", `Threads向けの入口として置いておきます。\n\n${links.threads_asp}`],
    ["楽天型のアフィリは、商品リンクを貼るだけだと弱い。", "悩み、選び方、比較、注意点まで出すと、日用品でも自然な導線になる。", `副業アカウントで使う導線メモとして置いておきます。\n\n${links.rakuten_note}`],
    ["#PR 夜に副業するなら、机まわりの明るさはかなり大事。", "眠い、目が疲れる、集中が切れる人は、ツールより先に作業環境を見直すのもあり。", `デスクライト候補です。\n\n${links.rakuten_desk_light}`],
    ["#PR ノートPCだけで作業してると、目線が下がって肩が重くなりやすい。", "高い椅子を買う前に、まず目線を上げる小物から試すほうが始めやすい。", `ノートPCスタンド候補です。\n\n${links.rakuten_laptop_stand}`],
    ["高額教材から入るのが怖い人は、まず低単価で市場の仕組みを見たほうがいい。", "スマホだけで始める系の需要と導線を確認する入口です。", `今週の低単価候補として置いておきます。\n\n${links.urakaku}`],
    ["成人向けに近い市場は、勢いよりルールと導線設計が大事。", "表の投稿で煽らず、リンク先で適性を見てもらう形が安全です。", `リール寄りで見るならこれ。\n\n${links.mudo_reels}`],
  ];
  return pick(ctas, seed).join("\n\n");
}

function makePost({ accountId, scheduledAt, sequence, config }) {
  const account = config.accounts[accountId];
  const linkEvery = config.generation.link_every;
  const linkSlot = sequence > 0 && sequence % linkEvery === 0;
  const pillars = account.pillars.filter((pillar) => pillar !== "soft_cta");
  const pillar = linkSlot ? "soft_cta" : pillars[sequence % pillars.length];
  const seed = `${accountId}:${scheduledAt}:${sequence}:${pillar}`;
  const text = linkSlot
    ? ctaPost(accountId, account.links, seed)
    : accountId === "fortune"
      ? compose(fortuneParts[pillar] ?? fortuneParts.reply_waiting, seed, fortuneFooters)
      : compose(sideParts[pillar] ?? sideParts.market_selection, seed, sideFooters);

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

if (!args.dryRun && additions.length > 0) {
  await writeFile(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  dry_run: args.dryRun,
  days_ahead: daysAhead,
  from: formatDateKey(now),
  added: additions.length,
  by_account: Object.fromEntries(accountIds.map((accountId) => [accountId, additions.filter((post) => post.account_id === accountId).length])),
  first_added: additions[0]?.scheduled_at ?? null,
  last_added: additions.at(-1)?.scheduled_at ?? null,
}, null, 2));
