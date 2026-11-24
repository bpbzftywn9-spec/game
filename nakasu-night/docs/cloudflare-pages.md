# Web版を Cloudflare Pages で公開する手順

公開するのは `nakasu-night/web/` フォルダだけです（約13MB、いちばん大きいファイルでも約2MB）。
ビルドは不要で、静的ファイルをそのまま配信します。

## 費用
- Cloudflare Pages の無料プランで公開できます（転送量の上限なし、商用利用可、1ファイル25MBまで）。
- 独自ドメイン（例：`nakasu-night.jp`）を使う場合だけ、ドメイン代が年に数千円かかります。使わなければ `nakasu-night.pages.dev` のようなURLになります。

## 準備済みのもの
| ファイル | 内容 |
|---|---|
| `web/lib/three/` | three.js r128 を同梱（CDNに頼らない。MITライセンスの文書も同梱） |
| `web/models/*.glb` | 人物モデルを base64入りJSON から元の `.glb` に戻した（約0.75MB軽くなった） |
| `web/_headers` | ゲーム本体は毎回更新を確認し、素材は1日キャッシュ。基本的なセキュリティヘッダー |
| `wrangler.toml` | プロジェクト名 `nakasu-night`、公開フォルダ `web` |

外部から読み込むのは Google Fonts（Dela Gothic One）だけです。

## 公開の手順（どちらか一方）

### A. GitHub と連携する（おすすめ：プッシュするたびに自動で更新される）
1. Cloudflare のアカウントを作り、ダッシュボードで **Workers & Pages → 作成 → Pages → Git に接続** を選ぶ。
2. GitHub と連携して、このリポジトリを選ぶ。
3. ビルドの設定：
   - 本番ブランチ：公開したいブランチ（このリポジトリの既定ブランチは `claude/gta6-yakuza-mobile-game-yoz8wt`。中洲ナイトが入っているブランチを選ぶ）
   - フレームワーク：なし
   - ビルドコマンド：空欄
   - ビルド出力ディレクトリ：`web`
   - ルートディレクトリ（詳細設定）：`nakasu-night`
4. 「保存してデプロイ」。数分で `https://nakasu-night.pages.dev`（名前が使われていれば別の名前）が発行される。

※ このリポジトリには「仁義サンシャイン」も入っています。ルートディレクトリを `nakasu-night` にすれば、中洲ナイトだけが公開されます。
※ 本番以外のブランチにプッシュすると、プレビュー用のURLが別に作られます。不要なら Pages の設定で、プレビューのデプロイを止められます。

### B. 手元のパソコンからアップロードする
```bash
cd nakasu-night
npx wrangler@4 login     # ブラウザで Cloudflare にサインイン
npm run deploy           # = wrangler pages deploy（wrangler.toml の設定で web/ を公開）
```
初回はプロジェクトの作成を聞かれるので、本番ブランチ名を答えます。

## 公開した後に確認すること
- [ ] スマホ（iPhone・Android）の縦画面・横画面でタイトルから第一章まで遊べる
- [ ] カットシーンの動画（序章 v0）が再生される
- [ ] セーブして再読み込みすると続きから遊べる
- [ ] BAR YAHMAN の店内に「お酒は20歳になってから」とフィクションの表示が出ている

## 公開前の確認（2026年11月24日、オーナーが全て確認済み）
- [x] Higgsfield で作った画像・動画の商用利用の条件（契約しているプラン）
- [x] 人物モデルの元データ（readyplayer.me のサンプル、Mixamo の Michelle）の利用条件
- [x] BAR YAHMAN の店舗情報とSNSのリンクが正しいか（店と確認）
- [x] セリフの「県警」：Web版はこのまま出す（App Store版では架空名に置き換える）
