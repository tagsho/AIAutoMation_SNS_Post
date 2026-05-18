import argparse
import csv
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import requests
import schedule
import tweepy
from dotenv import load_dotenv


PLATFORMS = ("x", "instagram", "threads")
DEFAULT_STATE_PATH = Path("post_state.json")


@dataclass(frozen=True)
class PostRow:
    row_id: str
    platform: str
    text: str
    media_url: str | None
    publish_date: str | None


class SocialPoster:
    def post_to_x(self, text: str) -> str:
        client = tweepy.Client(
            consumer_key=require_env("X_API_KEY"),
            consumer_secret=require_env("X_API_SECRET"),
            access_token=require_env("X_ACCESS_TOKEN"),
            access_token_secret=require_env("X_ACCESS_TOKEN_SECRET"),
        )
        response = client.create_tweet(text=text)
        tweet_id = response.data["id"]
        logging.info("Posted to X: %s", tweet_id)
        return str(tweet_id)

    def post_to_instagram(self, text: str, media_url: str | None) -> str:
        if not media_url:
            raise ValueError("Instagram投稿にはCSVのmedia_urlが必要です。")

        api_version = os.getenv("META_GRAPH_API_VERSION", "v24.0")
        user_id = require_env("INSTAGRAM_USER_ID")
        token = require_env("INSTAGRAM_ACCESS_TOKEN")
        base_url = f"https://graph.facebook.com/{api_version}/{user_id}"

        container = post_json(
            f"{base_url}/media",
            {
                "image_url": media_url,
                "caption": text,
                "access_token": token,
            },
        )
        creation_id = container["id"]

        published = post_json(
            f"{base_url}/media_publish",
            {
                "creation_id": creation_id,
                "access_token": token,
            },
        )
        media_id = published["id"]
        logging.info("Posted to Instagram: %s", media_id)
        return str(media_id)

    def post_to_threads(self, text: str, media_url: str | None) -> str:
        token = require_env("THREADS_ACCESS_TOKEN")
        user_id = require_env("THREADS_USER_ID")
        base_url = f"https://graph.threads.net/{user_id}"

        payload = {
            "text": text,
            "access_token": token,
        }
        if media_url:
            payload.update({"media_type": "IMAGE", "image_url": media_url})
        else:
            payload["media_type"] = "TEXT"

        container = post_json(f"{base_url}/threads", payload)
        creation_id = container["id"]

        published = post_json(
            f"{base_url}/threads_publish",
            {
                "creation_id": creation_id,
                "access_token": token,
            },
        )
        thread_id = published["id"]
        logging.info("Posted to Threads: %s", thread_id)
        return str(thread_id)

    def post(self, row: PostRow) -> str:
        if row.platform == "x":
            return self.post_to_x(row.text)
        if row.platform == "instagram":
            return self.post_to_instagram(row.text, row.media_url)
        if row.platform == "threads":
            return self.post_to_threads(row.text, row.media_url)
        raise ValueError(f"未対応のplatformです: {row.platform}")


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"環境変数 {name} が設定されていません。")
    return value


def post_json(url: str, data: dict[str, str]) -> dict[str, Any]:
    response = requests.post(url, data=data, timeout=60)
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}

    if not response.ok:
        raise RuntimeError(f"API request failed: {response.status_code} {payload}")

    return payload


def load_posts(csv_path: Path) -> list[PostRow]:
    rows: list[PostRow] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        required = {"id", "platform", "text"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSVに必要な列がありません: {', '.join(sorted(missing))}")

        for raw in reader:
            text = (raw.get("text") or "").strip()
            if not text:
                continue

            platform = (raw.get("platform") or "").strip().lower()
            if platform == "all":
                platforms = PLATFORMS
            elif platform in PLATFORMS:
                platforms = (platform,)
            else:
                raise ValueError(f"CSVのplatformが不正です: {platform}")

            row_id = (raw.get("id") or "").strip()
            media_url = (raw.get("media_url") or "").strip() or None
            publish_date = (raw.get("date") or "").strip() or None
            for target_platform in platforms:
                rows.append(
                    PostRow(
                        row_id=f"{row_id}:{target_platform}",
                        platform=target_platform,
                        text=text,
                        media_url=media_url,
                        publish_date=publish_date,
                    )
                )
    return rows


def load_state(state_path: Path) -> dict[str, Any]:
    if not state_path.exists():
        return {"posted": {}}
    with state_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_state(state_path: Path, state: dict[str, Any]) -> None:
    with state_path.open("w", encoding="utf-8") as file:
        json.dump(state, file, ensure_ascii=False, indent=2)
        file.write("\n")


def should_post_today(row: PostRow, posted: dict[str, Any]) -> bool:
    if row.row_id in posted:
        return False
    if row.publish_date and row.publish_date != date.today().isoformat():
        return False
    return True


def publish_next(csv_path: Path, state_path: Path, dry_run: bool = False) -> None:
    posts = load_posts(csv_path)
    state = load_state(state_path)
    posted = state.setdefault("posted", {})

    next_row = next((row for row in posts if should_post_today(row, posted)), None)
    if not next_row:
        logging.info("投稿対象はありません。")
        return

    logging.info("投稿対象: id=%s platform=%s", next_row.row_id, next_row.platform)
    if dry_run:
        logging.info("[dry-run] %s", next_row.text)
        return

    remote_id = SocialPoster().post(next_row)
    posted[next_row.row_id] = {
        "platform": next_row.platform,
        "remote_id": remote_id,
        "posted_at": datetime.now().isoformat(timespec="seconds"),
    }
    save_state(state_path, state)


def run_scheduler(csv_path: Path, state_path: Path, post_time: str, dry_run: bool) -> None:
    schedule.every().day.at(post_time).do(publish_next, csv_path, state_path, dry_run)
    logging.info("毎日 %s に投稿します。Ctrl+Cで終了します。", post_time)
    while True:
        schedule.run_pending()
        time.sleep(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="CSVからSNS投稿文を読み込み、X/Instagram/Threadsへ予約投稿します。")
    parser.add_argument("--csv", default="posts.csv", help="投稿CSVのパス")
    parser.add_argument("--time", default=os.getenv("POST_TIME", "09:00"), help="毎日投稿する時刻 HH:MM")
    parser.add_argument("--state", default=str(DEFAULT_STATE_PATH), help="投稿済み状態を保存するJSON")
    parser.add_argument("--once", action="store_true", help="スケジューラを起動せず、今すぐ1件だけ投稿")
    parser.add_argument("--dry-run", action="store_true", help="API投稿せず、対象行だけ確認")
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = parse_args()
    csv_path = Path(args.csv)
    state_path = Path(args.state)

    if args.once:
        publish_next(csv_path, state_path, args.dry_run)
    else:
        run_scheduler(csv_path, state_path, args.time, args.dry_run)


if __name__ == "__main__":
    main()
