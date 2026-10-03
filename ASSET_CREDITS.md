# 素材・ライブラリの出典

## 採用

| 用途 | 配布元 | ライセンス | 出典 |
| --- | --- | --- | --- |
| 3D描画・glTF読み込み・アニメーション・静的メッシュ結合 | Three.js 0.180.0 | MIT | https://github.com/mrdoob/three.js |
| 地面、足場、植物、コイン、ハート、敵キャラクター | Kenney Platformer Kit 4.1 | CC0 1.0 | https://kenney.nl/assets/platformer-kit |
| 石のアーチ、城壁、塔、遠景、橋 | Kenney Castle Kit | CC0 1.0 | https://kenney.nl/assets/castle-kit |
| 主人公と待機・走行・ジャンプ・射撃のアニメーション | KayKit Adventurers Character Pack 1.0 / Rogue | CC0 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 |

Kenney / KayKit の CC0 素材にクレジット表示義務はありませんが、作者と出典を記録しています。
Three.js の著作権・MITライセンス全文は `public/licenses/three-LICENSE.txt` に保持しています。
素材の配布時ライセンスは、それぞれの `public/assets/<pack>/LICENSE.txt` に保持しています。

KayKit の取得元コミット: `672074b73ba276876a19e8816ecdc5241817ab47`。
Kenney の取得アーカイブ:

- https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip
- https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip

モデルと必要なテクスチャをプロジェクト内に収録し、ゲーム実行時の外部モデル配信に依存しません。
モデル自体は再制作せず、配置・サイズ・アニメーションの切り替えでゲームに組み込んでいます。
動きの重さの調整にも、収録済みの KayKit `Walking_A` / `Jump_Idle` / `Jump_Land` を再利用しています。
再生速度・切り替えは Three.js の既存 AnimationAction API（https://threejs.org/docs/pages/AnimationAction.html）を使用し、新しいアニメーション素材やライブラリは追加していません。

## 調査と選択理由

- 既存 `skyruins.html`: ジャンプ、衝突、敵、コイン、スキル、進行、セーブ、合成音を再利用。Canvas の描画を Three.js に置き換えています。
- Quaternius Ultimate Modular Ruins Pack: https://quaternius.com/packs/ultimatemodularruins.html (CC0)。遺跡への適合性は高いものの、公式 Google Drive のダウンロード上限で取得できなかったため、今回の取り込みは見送りました。
- Quaternius Ultimate Animated Character Pack: https://quaternius.com/packs/ultimatedanimatedcharacter.html (CC0)。取得と組み込みが確認できる KayKit の glTF と既存クリップを優先しました。
- Kenney Platformer Kit の主人公候補: アニメーション付きですが、人間の冒険者という方向には KayKit Rogue のほうが合うため、主人公には採用せず敵として利用しています。
- GamepadJs: https://github.com/alaingilbert/GamepadJs (MIT) を調査。既存ゲームはフレームごとの押下状態と入力エッジを使うため、ブラウザ標準 Gamepad API を既存入力につなぐ最小限のアダプターを使用しています。

新規コードは描画と既存処理の接続、入力の接続に限定し、ゲームシステムやキャラクターモデルの新規制作は行っていません。
Google Fonts は元のHTMLから継続利用しています。利用不能の場合はシステムフォントにフォールバックします。
