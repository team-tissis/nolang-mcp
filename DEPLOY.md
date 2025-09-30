# Ubuntu Server Deployment Guide

## Docker + Cloudflared Tunnel での常時稼働

### 1. 前提条件
- Ubuntu Server (20.04+)
- Docker & Docker Compose がインストール済み

### 2. セットアップ

```bash
# 1. プロジェクトをクローン
git clone <your-repo-url> nolang-mcp
cd nolang-mcp

# 2. 環境変数を設定
cp env.example .env
nano .env
# NOLANG_API_KEY=your_actual_api_key_here に変更

# 3. Docker Composeで起動
docker-compose up -d

# 4. ログを確認
docker-compose logs -f
```

### 3. 動作確認

```bash
# コンテナの状態確認
docker-compose ps

# nolang-mcpサーバーの動作確認
curl http://localhost:7310/health

# cloudflaredのログからURLを取得
docker-compose logs cloudflared-tunnel | grep "https://"
```

### 4. 運用

```bash
# 停止
docker-compose down

# 再起動
docker-compose restart

# ログ確認
docker-compose logs -f nolang-mcp
docker-compose logs -f cloudflared-tunnel
```

### 5. 自動起動設定

サーバー再起動時の自動起動：
```bash
# docker-compose.ymlのrestart: unless-stoppedにより自動で起動されます
```

### トラブルシューティング

- **nolang-mcpが起動しない**: `.env`ファイルのAPI keyを確認
- **cloudflaredが接続できない**: nolang-mcpの起動を待つ（healthcheckで制御済み）
- **ポート競合**: `docker-compose.yml`でポート番号を変更
