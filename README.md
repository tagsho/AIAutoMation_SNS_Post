# AIAutoMation_SNS_Post

CSVファイルから投稿文を読み込み、毎日決まった時間にX・Instagram・Threadsへ自動投稿するPythonスクリプトです。

## セットアップ

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
copy posts.csv.example posts.csv
```

`.env` に各SNSのAPI認証情報を設定してください。

## CSV形式

`posts.csv` は次の列を使います。

| 列 | 内容 |
| --- | --- |
| `id` | 投稿ID。一意にしてください。 |
| `platform` | `all`, `x`, `instagram`, `threads` のいずれか。 |
| `date` | 任意。`YYYY-MM-DD` を入れると、その日だけ投稿対象になります。空なら未投稿の先頭行から順に投稿します。 |
| `text` | 投稿文。 |
| `media_url` | 任意。Instagram投稿では必須です。外部からアクセス可能な画像URLを指定してください。 |

## 使い方

すぐに1件投稿する場合:

```bash
python sns_auto_post.py --once
```

投稿せず対象行だけ確認する場合:

```bash
python sns_auto_post.py --once --dry-run
```

毎日指定時刻に実行し続ける場合:

```bash
python sns_auto_post.py --time 09:00
```

常時稼働するPCやサーバーで実行してください。Windowsタスクスケジューラやcronで `python sns_auto_post.py --once` を毎日呼び出す運用でも使えます。

## 投稿済み管理

投稿済みの行は `post_state.json` に保存され、同じ `id` と `platform` の組み合わせは再投稿しません。再投稿したい場合は `post_state.json` の該当行を削除してください。

## 注意

- Xへの投稿にはX Developer Portalで発行したAPIキーとアクセストークンが必要です。
- Instagram投稿にはInstagramプロアカウント、Metaアプリ、`instagram_content_publish` 権限、公開アクセス可能な画像URLが必要です。
- Threads投稿にはThreads APIのユーザーIDとアクセストークンが必要です。
- 各SNSのAPI利用条件、投稿上限、審査要件に従ってください。
