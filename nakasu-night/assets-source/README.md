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
