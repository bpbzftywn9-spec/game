# 素材の出どころ

## 3Dモデル（assets-source/）
- man_q.glb: three.js公式サンプルの readyplayer.me.glb を圧縮（テクスチャ512px・量子化）。服・靴・帽子・ひげが別パーツ。
- woman_q.glb: three.js公式サンプルの Michelle.glb（Mixamo）を圧縮。
- web/models/anims.json: three.js公式サンプルの Xbot.glb（Mixamo）の idle/walk/run を、上記2体の骨格向けにワールド空間で変換した回転データ。
- web/models/*_q.glb: 上記GLBと同じもの（以前はbase64でJSONに包んでいたが、.glbに戻した）。

## 実写風の画像・動画（web/cut/）
Higgsfieldで生成（画像: gpt_image_2_6 / 動画: seedance_2_5）。元の高解像度版（2688x1520 PNG・720p MP4）はHiggsfieldのライブラリに残っている。
| ファイル | 場面 | Higgsfield job id |
|---|---|---|
| c0.jpg | 序章 雨の天神を歩く鉄二 | bcb7f5e9-9a23-4867-aa09-d00fab78d071 |
| c1.jpg | 第一章 スナック月光と千鶴ママ | 438d3711-015d-4c8c-b4fa-22b12089b806 |
| c2.jpg | 第二章 BAR玄の対峙 | f3c31d4e-92cc-4886-a8db-e59638ade76d |
| c3.jpg | 第四章 天神の逃走 | aa90bfe9-3453-4004-bcd0-1359adfdeffa |
| c4.jpg | 第六章 屋台通り | 786b8171-a368-4a19-9ecc-aff031fce721 |
| c5.jpg | 最終章 橋の上の対決 | 781d2f98-16c5-4694-a573-89d43db8d70e |
| c6.jpg | エンディング 屋台ラーメン | 1db9095a-8a69-487a-a279-b4ca28aa0d99 |
| s0.jpg | サブ ひったくり | 9fc072e5-f55f-4438-ae24-59872b0c061c |
| s1.jpg | サブ 酔っぱらい部長 | b1827f62-b8d4-4a92-915a-feeb439efe40 |
| s2.jpg | サブ ストリートファイト | 6f0000c3-cd9b-4649-9b37-c67edc037c85 |
| y1.jpg | 第三章 BAR YAHMAN店内 | e0343cf1-5506-4ad2-9de0-13ce826135ef |
| y2.jpg | 第五章 おにょ救出 | 6e8f66ad-6579-4a19-baba-64a3118fadec |
| y3.jpg | 最終章 YAHMANで祝杯 | 8e268ad0-9554-4c2a-9164-1c6ab82425ec |
| v0.mp4 | 序章 天神を歩く（動画） | f0364bf3-5ad7-4920-ac64-0edbadf27100 |
| v1.mp4 | 第四章 パトカー逃走（動画） | f2a9c914-9455-4983-95af-0def08c54dc1 |
| v2.mp4 | 最終章 決戦前（動画） | 1848fb71-63c2-44d3-b5cc-69260e51842f |
| v3.mp4 | 第三章 シャンパンコール（動画） | b1707fed-2db0-4fe4-9b6c-fa0ab8f7694f |

鉄二の顔の基準画像: 40e125e2-4ca7-4ac2-81b1-08c75651ac52
TAIKI・おにょの参照写真（本人提供・使用許可済み）: Higgsfield media aa706013-1da0-4121-b758-3edbd341fd70 / 00e96896-b0a2-40a4-aba5-36f2bf6b1d8e

## 街の写真の素材（web/tex/）
2026年11月25日、オーナーの承認（上限200クレジット）を受けて Higgsfield で生成（gpt_image_2_6、高画質・2k、1枚2クレジット）。使ったのは26枚・52クレジット。
外壁は、窓の並び（横の柱の間隔と階の高さ）に合わせて切り出し、つなぎ目なく繰り返せるようにした（切り出しの手順は下の「作り方」）。文字・ロゴ・看板の文字は入れないように指示している（看板の文字はゲームの中でプログラムが描く）。元の画像（PNG、1520x2688 など）はHiggsfieldのライブラリに残っている。
| ファイル | 内容 | Higgsfield job id |
|---|---|---|
| f_zakkyo.jpg | タイルの雑居ビル | a01c5398-53e4-42d9-b8f8-fcf9bc09e8cd |
| f_ribbon.jpg | 横長の窓のオフィス | 8d2220eb-e967-4779-8211-cd2db6029cb7 |
| f_barbldg.jpg | 中洲の古いバーのビル | f9355d3a-1a0b-456a-963e-cfa0a460738e |
| f_hotel.jpg | ビジネスホテル | 272eaf4a-6988-4fd9-9033-27c29944d414 |
| f_browntile.jpg | 茶色のタイルのビル | 031f1719-9c88-4fd5-8814-d72c80581dea |
| f_whitetile.jpg | 白いタイルのビル | b3b48b64-0e62-42b0-b03f-2b8e5126f7b2 |
| f_glass.jpg | ガラスのオフィス（天神） | 13333275-8162-42eb-aca1-7a072a7431f4 |
| f_glass2.jpg | 青緑のガラスのオフィス | 6b82a31d-5aff-43e2-90ff-1340cee1d19f |
| f_apt1.jpg | マンション | 1591c8a5-cbd5-49e3-b57d-c87ad25961c8 |
| f_apt2.jpg | 古い団地 | 257c4ff3-a413-4ca9-9885-ee70f21374b4 |
| machiya.jpg | 博多の町家 | 83d49141-ce6d-4fc3-92c2-545cfcff0699 |
| shops.jpg の1 | 居酒屋 | dc0e61c3-5282-4ef4-ab66-ce41f73e82ff |
| shops.jpg の2 | ラーメン屋 | 6154d5e9-e1f4-491d-9a57-1de34de277f5 |
| shops.jpg の3 | 酒屋 | f129ae3e-af75-47d7-9863-96412a01fc42 |
| shops.jpg の4 | シャッター | 57c72261-9ef5-406c-a839-8caeac9ffb84 |
| shops.jpg の5 | バーの入口 | 36ac7c0b-7cb7-4cdf-873e-14c62eb3f9bd |
| shops.jpg の6 | ドラッグストア（上の黄色い帯は切った） | f58e6e9b-9cdd-4ae9-a521-b8acb3b6e0a3 |
| shops.jpg の7 | カフェ | d68c005e-68d2-4299-92ce-df1ce3ad5362 |
| shops.jpg の8 | ビルの入口 | f00ab00b-32cf-4729-903f-f98a50e78118 |
| shops.jpg の9 | 和菓子屋 | de86c2b6-308f-462b-a401-d64131181807 |
| shops.jpg の10 | お茶・反物の店 | cea5877e-f954-4cb2-9327-0f9bd597e106 |
| station.jpg | 駅の正面（博多駅） | e5852f27-2634-4c6e-9103-84c5d9ab679e |
| shrine.jpg | 神社の拝殿（櫛田神社） | c5cdcf05-1515-4b45-82e9-541907e21eb1 |
| asphalt.jpg | アスファルト | e98e3e45-358c-4ad5-bc62-742e8fdd387f |
| sidewalk.jpg | 歩道のブロック | dfff1066-7707-4679-8765-67d82b49e347 |
| sky.jpg | 夜空と遠くの街並み | 39693eca-25dc-4286-856f-88a5e0a960c0 |

作り方：外壁は、画像の縦横の明るさの変化から窓と階の間隔を求め、その整数倍で切り出し、切れ目を16pxだけ重ねてなじませた。1枚が実際の何m分かは `index.html` の `PHOTO_M`。夜に光る窓の部分は、ゲームを起動するときに画像から取り出す（`photoGlow`）。地面は半分ずらして重ね、つなぎ目を消した。

### 追加（屋台・川沿い・デパート）
2026年11月25日、オーナーの指示で追加。同じ設定で11枚・22クレジット（ここまでの合計は37枚・74クレジット）。川沿いのビルの白紙の看板には、ゲームの中で架空の店名を書く（`PSIGN`, `signPhoto`）。
| ファイル | 内容 | Higgsfield job id |
|---|---|---|
| y_front1.jpg | 屋台の客側（赤いのれん） | 14b15f80-a513-4c08-9b85-71bb211d0ae9 |
| y_front2.jpg | 屋台の客側（紺ののれん） | 2f260498-0e25-4cf4-bc45-c76de5e9c08e |
| y_side.jpg | 屋台の横 | 444bde5a-0806-4505-8a49-892dfefe9af8 |
| y_back.jpg | 屋台の調理側 | e5c70f30-1f82-465e-bef9-09f483da4cd5 |
| r_signs1.jpg | 中洲の川沿いのビル（看板だらけ） | c0914b9d-1ee7-4b31-b617-b9d7b6c466cf |
| r_signs2.jpg | 中洲の川沿いの古いバーのビル | c1322f01-2154-4206-8a25-685ba56539bc |
| r_water.jpg | 川面のさざ波（凹凸に使う） | 8f393af7-cdd4-4b83-83f6-052a5583c58e |
| t_zelkova.webp | ケヤキ（紅葉、背景が透明） | f5a38ff9-5826-465e-b05d-1e3d07953fbf |
| t_willow.webp | 柳（背景が透明） | e03af467-2cb3-4147-bca8-c4c956efb41a |
| d_upper.jpg | 天神のデパートの上の階 | ec777ad6-e97a-4a2d-a261-52109ae24dc0 |
| d_ground.jpg | 天神のデパートのショーウィンドウ | 9ccd18fb-3b15-48d9-9385-ca5dce365fbb |
