開発者向けガイド

# 認証・認可

## API Key認証フロー

NoLang APIはAPI Key形式の認証を使用します。

```
Authorization: Bearer YOUR_API_KEY
```

## APIキーの管理

- **生成**: サイドバー: NoLang API > APIキーからAPIキーを生成
- **権限**: APIキーはユーザーアカウントと同じ権限を持ちます
- **削除**: 使用しなくなったキーは速やかに削除してください

## セキュリティベストプラクティス

1. **環境変数で管理**: ハードコーディングを避ける
    
    ```bash
    # キーを非表示で入力
    read -rsp "NoLang APIキーを入力してください: " NOLANG_API_KEY && echo
    
    # そのまま API を呼び出す
    curl -X POST https://api.no-lang.com/v1/videos/generate/ \
      -H "Authorization: Bearer $NOLANG_API_KEY" \
      -F "video_setting_id=$VIDEO_SETTING_ID" \
      -F "text=こんにちは、NoLang APIのテストです。"
    
    # 使い終わったら念のため変数を消去
    unset NOLANG_API_KEY
    ```
    
2. **HTTPS通信のみ**: すべてのAPI通信はHTTPS経由
3. **定期的に鍵をローテーションする**

---

# 共通仕様

## ベースURL・バージョン

- **Production**: `https://api.no-lang.com/v1`
- **バージョニング**: URLパスにバージョンを含む（現在は`v1`）

## リクエスト形式

### Headers

```
Authorization: Bearer YOUR_API_KEY
Content-Type: multipart/form-data  # ファイルアップロード時
Content-Type: application/json      # JSONリクエスト時

```

### Pagination

リスト系エンドポイントでは以下のクエリパラメータを使用：

- `page`: ページ番号（1から開始）
- 1ページあたり50件固定

```bash
curl "<https://api.no-lang.com/v1/videos/?page=2>" \\
  -H "Authorization: Bearer YOUR_API_KEY"

```

## レスポンス形式

### 成功レスポンス

```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "estimated_wait_time": 120
}

```

### リストレスポンス

```json
{
  "results": [...],
  "count": 150,
  "next": "<https://api.no-lang.com/v1/videos/?page=2>",
  "previous": null
}

```

## Rate Limit・同時実行制限

### Rate Limit

### 動画生成エンドポイント (`POST /videos/generate/`)

- **制限**: 10秒に2回まで
- **サーバー混雑時**: 503エラーが返される場合があります

### その他のNoLang APIエンドポイント

- **制限**: 10秒に5回まで（2秒に1回）
- 対象: `/videos/`, `/videos/{video_id}/`, `/video-settings/` など

### 同時実行制限

- **動画生成**: 1ユーザーアカウントあたり最大2つまで同時生成可能。これを超える場合は503エラーが返されます。
- **注意**: APIキー単位ではなく、ユーザーアカウント単位での制限です
- 複数のAPIキーを発行しても、同時生成数は増えません

## エラーハンドリング

### エラーレスポンス形式

```json
{
  "code": "ERROR_CODE",
  "error": "エラーの詳細説明"
}

```

### 主要エラーコード

| コード | HTTPステータス | 説明 | 対処法 |
| --- | --- | --- | --- |
| `INVALID_REQUEST` | 400 | リクエストが不正 | パラメータを確認 |
| `VIDEO_SETTING_NOT_FOUND` | 400 | 指定された動画設定が存在しない | video_setting_idを確認 |
| `NORMAL_MODE_TEXT_REQUIRED` | 400 | 通常モードでテキストが未指定 | textパラメータを追加 |
| `SLIDESHOW_MODE_PDF_REQUIRED` | 400 | スライドショーモードでPDF/PPTXが未指定 | pdf_fileまたはpptx_fileを追加 |
| `SPEECH2VIDEO_MODE_AUDIO_REQUIRED` | 400 | 音声動画モードで音声ファイルが未指定 | speech_audio_fileを追加 |
| `SLIDESHOW_PDF_PAGE_LIMIT_EXCEEDED` | 400 | PDFページ数が上限超過 | ページ数を削減 |
| `INSUFFICIENT_CREDIT` | 429 | チャージ不足 | チャージ残高を確認・追加 |
| `NOT_FOUND` | 404 | リソースが見つからない | IDを確認 |
| `UNKNOWN_ERROR` | 500 | サーバーエラー | 時間をおいて再試行 |
| `SIMULTANEOUS_GENERATE_LIMIT` | 503 | サーバーが混雑しています | 時間をおいて再試行 |

### リトライ戦略

- 5xx系エラー: 指数バックオフで最大3回リトライ
- 503エラー: サーバー負荷が下がるまで待機（推奨: 30秒〜1分後）
- 429エラー: レート制限解除まで待機
- その他: リトライ不要

---

# API リファレンス

## 動画生成

### `POST /videos/generate/`

新しい動画の生成をリクエストします。

**権限**: APIキー認証必須

**Rate Limit**: 10秒に2回まで

**Content-Type**: `multipart/form-data`

**注意事項**:

- サーバー混雑時は503エラーが返される場合があります
- 1ユーザーアカウントあたり最大2つまで同時生成可能です

**パラメータ**:

| 名前 | 型 | 対応ファイル形式 | サイズ数 | 必須 | 説明 |
| --- | --- | --- | --- | --- | --- |
| video_setting_id | string (UUID) |  |  | ○ | 使用する動画設定のID |
| text | string |  |  | △ | 動画生成用テキスト（質問/指示から作るモード時必須） |
| pdf_file | file | .pdf | 100MB | △ | PDFファイル（資料から作るモード時、pptx_fileとどちらか一方必須） |
| pptx_file | file | .pptx | 100MB | △ | PPTXファイル（資料から作るモード時、pdf_fileとどちらか一方必須） |
| audio_file | file | .mp3, .wav, .m4a, .aac | 50MB | △ | 音声ファイル（音声から作るモード時必須） |
| video_file | file | .mp4 | 50MB | △ | 動画ファイル（動画から作るモード時必須） |
| image_files | list of file | .png, .jpg, .jpeg, .webp | 10MB x 10枚 | × | 画像ファイルのリスト（質問/指示から作るモード時に指定可能） |

**リクエスト例（通常モード）**:

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=123e4567-e89b-12d3-a456-426614174000" \
  -F "text=AIの進化について5分で解説します。"

```

**リクエスト例（スライドショーモード - PDF）**:

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=123e4567-e89b-12d3-a456-426614174000" \
  -F "pdf_file=@presentation.pdf"

```

**リクエスト例（スライドショーモード - PPTX）**:

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=123e4567-e89b-12d3-a456-426614174000" \
  -F "pptx_file=@presentation.pptx"

```

**レスポンス例**:

```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "estimated_wait_time": 120
}

```

### 動画モード別の必須パラメータ

`/videos/generate/`エンドポイントは、`video_setting_id`によって指定される動画モードに応じて、必要なパラメータが異なります。必須パラメータが不足している場合、対応するエラーコードが返されます。

#### 質問・指示から作る

**質問への回答**
- 必須: `video_setting_id`, `text`
- オプション: `image_files`

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "text=機械学習とは何ですか？簡潔に説明してください"
```

**台本ベースの動画作成**
- 必須: `video_setting_id`, `text`
- オプション: `image_files`

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "text=NoLangとは、Mavericks 社によって開発されたリアルタイムで動画を生成するサービスです。"
```

#### 資料から作る

**プレゼン資料をそのまま動画化**
- 必須: `video_setting_id`, `pdf_file` または `pptx_file`

```bash
# PDFファイルの場合
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "pdf_file=@company_presentation.pdf"

# PPTXファイルの場合
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "pptx_file=@company_presentation.pptx"
```

**資料を要約して動画化**
- 必須: `video_setting_id`, `pdf_file` または `pptx_file`

```bash
# PDFファイルの場合
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "pdf_file=@annual_report.pdf"

# PPTXファイルの場合
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "pptx_file=@annual_report.pptx"
```

**資料を分析する**
- 必須: `video_setting_id`, `text`, `pdf_file`

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "text=競合他社と比較しながら、この企業の強みと弱みを分析してください" \
  -F "pdf_file=@company_report_2024.pdf"
```

#### 音声から作る

**音声ファイルから動画を作成**
- 必須: `video_setting_id`, `audio_file`

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "audio_file=@lecture_recording.mp3"
```

#### 音声動画から作る

**既存動画から新しい動画を生成**
- 必須: `video_setting_id`, `video_file`

```bash
curl -X POST https://api.no-lang.com/v1/videos/generate/ \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "video_setting_id=YOUR_VIDEO_SETTING_ID" \
  -F "video_file=@original_video.mp4"
```

## 動画リスト取得

### `GET /videos/`

生成した動画のリストを取得します。

**権限**: APIキー認証必須

**Rate Limit**: 10秒に5回まで

**クエリパラメータ**:

| 名前 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| page | integer | × | ページ番号（デフォルト: 1） |

**レスポンス例**:

```json
{
  "results": [
    {
      "video_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2024-01-15T09:30:00Z",
      "prompt": "AIの進化について5分で解説します。"
    },
    {
      "video_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2024-01-15T08:20:00Z",
      "prompt": "マーケティング戦略の基礎"
    }
  ],
  "count": 150,
  "next": "<https://api.no-lang.com/v1/videos/?page=2>",
  "previous": null
}

```

## 動画ステータス取得

### `GET /videos/{video_id}/`

特定の動画の生成ステータスとダウンロードURLを取得します。

**重要**: API経由で生成された動画をダウンロードする唯一の方法です。NoLang Web アプリでは閲覧・ダウンロードできません。

**権限**: APIキー認証必須

**Rate Limit**: 10秒に5回まで

**パスパラメータ**:

| 名前 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| video_id | string (UUID) | ○ | 動画ID |

**レスポンス例（生成中）**:

```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "download_url": ""
}

```

**レスポンス例（生成完了）**:

```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "download_url": "<https://example.s3.amazonaws.com/videos/example.mp4?X-Amz-Algorithm=>..."
}

```

**ステータス値**:

- `running`: 生成処理中
- `completed`: 生成完了（ダウンロード可能）
- `failed`: 生成失敗
- `expired`: 有効期限切れ

**動画ダウンロードについて**:

- `completed`状態の動画のみダウンロード可能
- `download_url`は一時的なプリサインドURLです（有効期限あり）
- 動画ファイルは専用ストレージに保存され、このAPIでのみアクセス可能

## 動画設定リスト取得

### `GET /video-settings/`

利用可能な動画設定のリストを取得します。

**権限**: APIキー認証必須

**Rate Limit**: 10秒に5回まで

**レスポンス例**:

```json
{
  "results": [
    {
      "video_setting_id": "123e4567-e89b-12d3-a456-426614174000",
      "updated_at": "2024-01-15T10:00:00Z",
      "created_at": "2024-01-10T10:00:00Z",
      "title": "教育コンテンツ用設定",
      "request_fields": ["text"]
    },
    {
      "video_setting_id": "223e4567-e89b-12d3-a456-426614174001",
      "updated_at": "2024-01-14T09:00:00Z",
      "created_at": "2024-01-09T09:00:00Z",
      "title": "プレゼンテーション変換用",
      "request_fields": ["pdf_file"]
    }
  ],
  "has_next": false,
  "total_count": 5,
  "page": 1,
  "items_per_page": 50
}

```

# サンプルコード

## Python

```python
import os
import time
import requests
from typing import Optional

class NoLangAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.no-lang.com/v1"
        self.headers = {"Authorization": f"Bearer {api_key}"}

    def generate_video_from_text(self, video_setting_id: str, text: str) -> dict:
        """テキストから動画を生成"""
        url = f"{self.base_url}/videos/generate/"
        data = {
            "video_setting_id": video_setting_id,
            "text": text
        }
        response = requests.post(url, headers=self.headers, data=data)
        response.raise_for_status()
        return response.json()

    def generate_video_from_pdf(self, video_setting_id: str, pdf_path: str) -> dict:
        """PDFから動画を生成"""
        url = f"{self.base_url}/videos/generate/"
        data = {"video_setting_id": video_setting_id}
        files = {"pdf_file": open(pdf_path, "rb")}
        response = requests.post(url, headers=self.headers, data=data, files=files)
        response.raise_for_status()
        return response.json()

    def get_video_status(self, video_id: str) -> dict:
        """動画のステータスを取得"""
        url = f"{self.base_url}/videos/{video_id}/"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def wait_for_completion(self, video_id: str, timeout: int = 600) -> Optional[str]:
        """動画生成の完了を待機し、ダウンロードURLを返す"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            status_data = self.get_video_status(video_id)
            if status_data["status"] == "completed":
                return status_data["download_url"]
            elif status_data["status"] == "failed":
                raise Exception("Video generation failed")
            time.sleep(10)  # 10秒ごとにポーリング
        raise TimeoutError("Video generation timed out")

# 使用例
api = NoLangAPI(os.environ["NOLANG_API_KEY"])

# テキストから動画生成
result = api.generate_video_from_text(
    video_setting_id="123e4567-e89b-12d3-a456-426614174000",
    text="Pythonプログラミングの基礎を学びましょう"
)
print(f"Video ID: {result['video_id']}")
print(f"Estimated wait time: {result['estimated_wait_time']} seconds")

# 完了を待機してダウンロード
download_url = api.wait_for_completion(result['video_id'])
print(f"Download URL: {download_url}")

```

## Node.js (JavaScript)

```jsx
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class NoLangAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.no-lang.com/v1';
    this.headers = { 'Authorization': `Bearer ${apiKey}` };
  }

  async generateVideoFromText(videoSettingId, text) {
    const formData = new FormData();
    formData.append('video_setting_id', videoSettingId);
    formData.append('text', text);

    const response = await axios.post(
      `${this.baseUrl}/videos/generate/`,
      formData,
      {
        headers: {
          ...this.headers,
          ...formData.getHeaders()
        }
      }
    );
    return response.data;
  }

  async generateVideoFromPDF(videoSettingId, pdfPath) {
    const formData = new FormData();
    formData.append('video_setting_id', videoSettingId);
    formData.append('pdf_file', fs.createReadStream(pdfPath));

    const response = await axios.post(
      `${this.baseUrl}/videos/generate/`,
      formData,
      {
        headers: {
          ...this.headers,
          ...formData.getHeaders()
        }
      }
    );
    return response.data;
  }

  async getVideoStatus(videoId) {
    const response = await axios.get(
      `${this.baseUrl}/videos/${videoId}/`,
      { headers: this.headers }
    );
    return response.data;
  }

  async waitForCompletion(videoId, timeout = 600000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getVideoStatus(videoId);

      if (status.status === 'completed') {
        return status.download_url;
      } else if (status.status === 'failed') {
        throw new Error('Video generation failed');
      }

      // 10秒待機
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    throw new Error('Video generation timed out');
  }
}

// 使用例
(async () => {
  const api = new NoLangAPI(process.env.NOLANG_API_KEY);

  try {
    // テキストから動画生成
    const result = await api.generateVideoFromText(
      '123e4567-e89b-12d3-a456-426614174000',
      'JavaScriptの非同期処理について解説します'
    );

    console.log(`Video ID: ${result.video_id}`);
    console.log(`Estimated wait time: ${result.estimated_wait_time} seconds`);

    // 完了を待機
    const downloadUrl = await api.waitForCompletion(result.video_id);
    console.log(`Download URL: ${downloadUrl}`);

  } catch (error) {
    console.error('Error:', error.message);
  }
})();

```

---

# 付録

## トラブルシューティング

| 問題 | 原因 | 解決策 |
| --- | --- | --- |
| 401 Unauthorized | APIキーが無効 | APIキーを確認、再生成 |
| 503 Service Unavailable | レート制限超過 | 時間をおいて再試行 |
| 動画生成が遅い | 高負荷時間帯 | オフピーク時間に実行 |
| PDFアップロードエラー | ファイルサイズ超過 | ファイルサイズを小さくする |

## サポート

- **お問い合わせ**:
 [https://docs.google.com/forms/d/e/1FAIpQLSc3UJZ_G7wyX3MgE5-s9aBO93Q8opNFqSUXC5TgwPntiNoi3Q/viewform](https://docs.google.com/forms/d/e/1FAIpQLSc3UJZ_G7wyX3MgE5-s9aBO93Q8opNFqSUXC5TgwPntiNoi3Q/viewform)