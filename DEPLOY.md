# 本番公開の手順（Render ＋ Stripe）

所要時間の目安：1〜2時間（Stripe の審査待ちを除く）。
費用の目安：Render の Starter プラン（月 7 ドル程度）＋ディスク 1GB（月 0.25 ドル程度）、Stripe の決済手数料（国内カードで 3.6% 程度）。料金は変わることがあるので、各サービスの料金ページで確認してください。

サーバーは、Stripe と販売者情報の設定が全部そろうまで **販売を自動で止めた状態** で動きます。設定の途中で公開しても、お金が動くことはありません。

---

## まず無料で公開する（Free プラン・販売なし）
`render.yaml` は今、**Free プラン**（無料）になっています。カード登録なしで公開でき、ゲームはそのまま遊べます。
- しばらくアクセスがないとサーバーが停止し、次に開くときは起動に 1 分ほどかかります
- 停止・再起動のたびにサーバー側のデータ（購入記録など）は消えます。プレイヤーのセーブは端末側にも残るので、遊ぶぶんには支障ありません
- そのため `SALES_DISABLED=1` を設定してあり、**Stripe のキーを入れても販売は始まりません**

手順：
1. https://render.com に GitHub アカウントで登録する
2. ダッシュボード → **New → Blueprint** → このリポジトリ（`game`）を選ぶ（GitHub へのアクセス許可を求められたら、このリポジトリを許可する）
3. 入力欄は **`SELLER_NAME`（販売者名）と `SELLER_EMAIL`（問い合わせ用メール）だけ** 入れればよい。ほかは空のままでよい
4. **Apply** を押す。数分で `https://jingi-sunshine-xxxx.onrender.com` のようなURLができ、ゲームが公開される

## 販売を始めるとき（Starter プランに上げる）
1. 下の手順1（Stripe）を済ませ、Stripe の本番環境を有効化する
2. `render.yaml` の `plan: free` を `plan: starter` にし、`disk:` の4行のコメントを外し、`SALES_DISABLED` の2行を削除してプッシュする（Claude に頼んでもよい）
3. Render の画面で Stripe のキーなどを入力し、下の手順3〜5を行う

---

## 1. Stripe のアカウントを作る
1. https://dashboard.stripe.com/register でアカウントを作る
2. まだ「本番環境の有効化」はしなくてよい。最初は **テスト環境** で進める
3. 開発者 → API キー で **シークレットキー（`sk_test_...`）** をコピーしておく

### Stripe 側で確認しておく設定
- **Managed Payments**：このアカウントでは既定でオンです（Stripe が販売者（merchant of record）として各国の税金の計算・納付を代行する仕組み）。サーバーは商品に税コード `txcd_10201003`（ストリーミング型ゲームの期限付き利用権）を付けて送ります。税コードの選び方や、Managed Payments を使うかどうか（使わない場合は環境変数 `STRIPE_MANAGED_PAYMENTS=off`）は、税理士に確認してください
- **支払い方法**：テスト環境では今カード払いだけが有効です。コンビニ払いや PayPay などを使う場合は、Stripe → 設定 → 決済手段 で有効にしてください（サーバー側の変更は不要）

## 2. Render でサーバーを作る
1. https://render.com で GitHub アカウントを使って登録する
2. ダッシュボード → **New → Blueprint** → このリポジトリ（`game`）を選ぶ
   - Render が GitHub のリポジトリを読めるように、画面の案内に沿って許可する
3. `render.yaml` の内容が表示されるので、次の値を入力する

   | 項目 | 入れる値 |
   |---|---|
   | `STRIPE_SECRET_KEY` | 手順1のテストキー（`sk_test_...`） |
   | `STRIPE_WEBHOOK_SECRET` | まだ空でよい（手順3で入れる） |
   | `SELLER_NAME` | 販売者の氏名または屋号 |
   | `SELLER_EMAIL` | 問い合わせ用メールアドレス |
   | `SELLER_REPRESENTATIVE` | 運営責任者（空なら販売者名と同じ） |
   | `SELLER_ADDRESS` / `SELLER_PHONE` | 住所・電話番号。空にすると「請求があった場合には遅滞なく開示します」と表示 |
   | `LEGAL_EFFECTIVE_DATE` | 規約の制定日（例：2026年12月1日） |
   | `LEGAL_COURT` | 合意管轄裁判所（例：東京地方裁判所） |

4. **Apply** を押すとデプロイが始まる。数分で `https://jingi-sunshine-xxxx.onrender.com` のようなURLができる
5. そのURLを開いてゲームが動くこと、`/about` と `/legal/tokushoho.html` に販売者情報が出ることを確認する（【未設定】と出ていたら環境変数を見直す）

## 3. Stripe の Webhook をつなぐ
1. Stripe → 開発者 → Webhook → **エンドポイントを追加**
2. URL：`https://（手順2のURL）/api/stripe/webhook`
3. イベント：`checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`checkout.session.expired` の4つ
4. 作成後に表示される **署名シークレット（`whsec_...`）** をコピーする
5. Render → サービス → Environment → `STRIPE_WEBHOOK_SECRET` に貼り付けて保存（自動で再起動）
6. `https://（URL）/api/health` を開き、`"salesOpen":true` になっていれば販売が開く（`false` のときは `waitingFor` に足りない設定の名前が出る）

## 4. テスト購入する（お金は動かない）
1. ゲームを開き、一時停止 → 💎 プレミアムショップ → 確認にチェック → 商品を選ぶ
2. Stripe の決済画面でテストカード `4242 4242 4242 4242`（有効期限は未来の日付、CVCは任意の3桁）を入れる
3. ゲームに戻って「はじめから」か「つづきから」を押し、武器を受け取れることを確認する
4. Stripe → 取引 で支払いが記録されていることを確認する

## 5. 本番に切り替える
1. Stripe で **本番環境を有効化** する（事業者情報・本人確認・入金先口座の登録。審査に数日かかることがある）
   - **事業のウェブサイト（事業用URL）**には `https://（手順2のURL）/about` を入れる。事業内容・商品と価格（税込）・連絡先・特商法／規約／プライバシーへのリンクが1ページにまとまっています（販売者名とメールは Render の環境変数から表示）
   - 事業内容の説明には「オンラインゲームの運営（ゲーム内アイテムのデジタル販売）」のように書く
2. 本番の API キー（`sk_live_...`）を Render の `STRIPE_SECRET_KEY` に入れ替える
3. Stripe の **本番環境側** で手順3と同じ Webhook を作り直し、新しい `whsec_...` を `STRIPE_WEBHOOK_SECRET` に入れ替える
4. 自分で1回だけ本番購入（¥120）して受け取れることを確認し、Stripe から返金する

## 6. 独自ドメイン（任意）
Render → サービス → Settings → Custom Domains でドメインを追加し、表示される DNS 設定をドメイン会社で行う。
ドメインを変えたら、Stripe の Webhook URL も新しいドメインに変える。

## 7. 仁義 中洲ナイトの販売もこのサーバーで行う
中洲ナイトは Cloudflare Pages で公開し（手順は `nakasu-night/docs/cloudflare-pages.md`）、決済・セーブ・引き継ぎはこのサーバーを共用します。
1. Render → サービス → Environment に次を追加して保存する（再デプロイされる）
   - `NAKASU_URL`：中洲ナイトのURL（例 `https://nakasu-night.pages.dev/`。最後の `/` まで）
   - `NAKASU_MONTHLY_LIMIT_JPY`：中洲ナイトの月間購入上限（初期値 100000）
2. `nakasu-night/web/index.html` の `const NAKASU_API_URL=''` に、このサーバーのURL（例 `https://jingi-sunshine-xxxx.onrender.com`、最後の `/` なし）を入れてプッシュする
3. `https://（このサーバーのURL）/api/health` で `"nakasuSalesOpen":true` を確認する
- Stripe の Webhook は共通（追加の設定は不要）。Stripe の取引には、メタデータ `game: nakasu` が付きます
- `/about`（事業内容のページ）に、中洲ナイトの商品と価格も自動で表示されます

---

## 運用メモ
- **データ**：購入記録とセーブは Render のディスク（`/data/game.db`）にあります。Render のディスクには自動スナップショットがありますが、念のため定期的にダウンロードして保管すると安心です
- **更新**：このブランチにプッシュすると、Render が自動で再デプロイします
- **問い合わせ対応**：「購入したのに武器が届かない」と連絡が来たら、Stripe の取引画面で支払いを確認してください
- **返金**：Stripe の取引画面から返金できます（ゲーム内の武器は自動では消えません）
- **税金**：売上が出たら確定申告が必要になる場合があります
