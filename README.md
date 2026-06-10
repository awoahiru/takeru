# たけるとにんケット

スマホ写真をアップロードし、アプリ内に固定した男の子と相棒のオロチを自然に合成する小さなWebアプリです。既存人物の顔をオロチモチーフのお面で隠すかどうかを生成前に選べます。

## 使い方

`.env.example` を参考に、このフォルダに `.env` を作ってAPIキーを入れます。

```bash
npm start
```

ブラウザで `http://localhost:4173` を開きます。

## できること

- 元写真のアップロード
- 男の子とオロチの自動合成
- 既存人物の顔をオロチデザインのお面で隠すオプション
- `gpt-image-2` を使った画像編集
- PNGダウンロード

## 設定

- `OPENAI_API_KEY`: OpenAI APIキー
- `OPENAI_IMAGE_MODEL`: 画像モデル。未指定時は `gpt-image-2`
- `NODE_ENV`: 公開環境では `production`
- `PORT`: 起動ポート。未指定時は `4173`

## 公開する

このアプリはOpenAI APIキーをサーバ側で使うため、静的サイトではなくNode.jsのWebサービスとして公開します。Renderなら、GitHubにこのフォルダをpushし、Render Dashboardで新しいWeb Serviceを作成します。

- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables:
  - `OPENAI_API_KEY`
  - `OPENAI_IMAGE_MODEL=gpt-image-2`
  - `NODE_ENV=production`

`.env` は公開リポジトリへpushしないでください。公開後は誰でも生成できるため、OpenAIの利用料金が発生します。
