# 素材・ライブラリの出典

## 採用

| 用途 | 配布元 | ライセンス | 出典 |
| --- | --- | --- | --- |
| 3D描画・glTF読み込み・アニメーション・静的メッシュ結合 | Three.js 0.180.0 | MIT | https://github.com/mrdoob/three.js |
| 地面、足場、植物、コイン、ハート、敵キャラクター | Kenney Platformer Kit 4.1 | CC0 1.0 | https://kenney.nl/assets/platformer-kit |
| 石のアーチ、城壁、塔、遠景、橋 | Kenney Castle Kit | CC0 1.0 | https://kenney.nl/assets/castle-kit |
| 主人公と待機・走行・ジャンプ・射撃のアニメーション | KayKit Adventurers Character Pack 1.0 / Rogue | CC0 1.0 | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 |
| 葉のある樹木、シダ、草、花、茂み、岩 | Quaternius Stylized Nature MegaKit Standard | CC0 1.0 | https://quaternius.com/packs/stylizednaturemegakit.html |
| 苔石の色・法線・粗さ | Poly Haven / Mossy Stone Wall / Amal Kumar | CC0 1.0 | https://polyhaven.com/a/mossy_stone_wall |
| 岩の色・法線・粗さ | Poly Haven / Rock Pitted Mossy / Dimitrios Savva, Rico Cilliers | CC0 1.0 | https://polyhaven.com/a/rock_pitted_mossy |
| 屋外の環境光 | Poly Haven / Kloofendal 48d Partly Cloudy Pure Sky / Greg Zaal, Jarod Guest | CC0 1.0 | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| HUDのハート形状 | Bootstrap Icons 1.11.3 / The Bootstrap Authors | MIT | https://icons.getbootstrap.com/icons/heart-fill/ |
| 空の遺跡の遠景パノラマ | このプロジェクト向けのimage_gen生成素材 | AI生成のプロジェクト素材 | `public/assets/scenery/SOURCE.md` |
| 主人公の髪・青い服・赤いスカーフ・旅の鞄 | KayKit RogueをBlenderで改修。骨格・顔・7種のアニメーションを再利用 | 改修元CC0、新規形状はプロジェクト制作 | `public/assets/adventurer/SOURCE.md` |
| 光る遺跡の出口 | Kenney Castle Kitの城門をBlenderで改修。Poly Haven石材を再利用 | 改修元CC0、新規形状はプロジェクト制作 | `public/assets/landmarks/SOURCE.md` |
| 連続したアーチ橋、欠けた舗装、深い岩盤 | Blender 5.2でプロジェクト向けに制作。舗装はKenneyのCC0石材形状を改修 | 改修元はCC0、新規形状はプロジェクト制作 | `public/assets/ruins/SOURCE.md` / `art/blender/ruins-source.blend` |

Kenney / KayKit の CC0 素材にクレジット表示義務はありませんが、作者と出典を記録しています。
Three.js の著作権・MITライセンス全文は `public/licenses/three-LICENSE.txt` に保持しています。
素材の配布時ライセンスは、それぞれの `public/assets/<pack>/LICENSE.txt` に保持しています。
Bootstrap Icons の MIT ライセンス全文は `public/licenses/bootstrap-icons-LICENSE.txt` に保持しています。
Quaternius Standard は配布元のCC0表示と同梱License_Standard.txtを確認し、glTFの必要な素材だけを取り込んでいます。
取得用ミラー: https://github.com/agentkaerf/FreeModels 、固定コミット `db3df04d1e4714298a09510b26fb6de6645138a2`。
Poly Haven は https://polyhaven.com/license でCC0を確認しています。1Kの配信データをそのまま収録しました。

KayKit の取得元コミット: `672074b73ba276876a19e8816ecdc5241817ab47`。
Kenney の取得アーカイブ:

- https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip
- https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip

モデルと必要なテクスチャをプロジェクト内に収録し、ゲーム実行時の外部モデル配信に依存しません。
主人公・敵・植生は、配置・サイズ・アニメーションの切り替えでゲームに組み込んでいます。橋と岩盤はBlenderで改修・制作した形状に更新しています。
動きの重さの調整にも、収録済みの KayKit `Walking_A` / `Jump_Idle` / `Jump_Land` を再利用しています。
再生速度・切り替えは Three.js の既存 AnimationAction API（https://threejs.org/docs/pages/AnimationAction.html）を使用し、新しいアニメーション素材やライブラリは追加していません。
描画の位置補間には、同じMITライセンスの Three.js `MathUtils.lerp` を再利用しています。固定物理更新と描画の間を補間する方法は Glenn Fiedler の解説 https://gafferongames.com/post/fix_your_timestep/ を参照し、記事のコードは転載していません。既存の衝突処理を保つため、物理エンジンの追加は行っていません。

## 調査と選択理由

- 既存 `skyruins.html`: ジャンプ、衝突、敵、コイン、スキル、進行、セーブ、合成音を再利用。Canvas の描画を Three.js に置き換えています。
- Quaternius Ultimate Modular Ruins Pack: https://quaternius.com/packs/ultimatemodularruins.html (CC0)。遺跡への適合性は高いものの、公式 Google Drive のダウンロード上限で取得できなかったため、今回の取り込みは見送りました。
- Quaternius Ultimate Animated Character Pack: https://quaternius.com/packs/ultimatedanimatedcharacter.html (CC0)。取得と組み込みが確認できる KayKit の glTF と既存クリップを優先しました。
- Kenney Platformer Kit の主人公候補: アニメーション付きですが、人間の冒険者という方向には KayKit Rogue のほうが合うため、主人公には採用せず敵として利用しています。
- GamepadJs: https://github.com/alaingilbert/GamepadJs (MIT) を調査。既存ゲームはフレームごとの押下状態と入力エッジを使うため、ブラウザ標準 Gamepad API を既存入力につなぐ最小限のアダプターを使用しています。

ゲームシステムとキャラクターモデルは既存品を再利用しています。地形の調査・改修内容とBlenderの生成手順は `public/assets/ruins/SOURCE.md` に記録しています。
遠景の生成前には上記のCC0素材を実画面で比較しました。汎用の塔や壁を繰り返し配置すると、参照画像のような谷・橋・城の構図を作れなかったため、背景画を制作しました。新しい主人公モデルは制作せず、KayKitの既存モデルを再利用し、赤いマントと不要な武器の非表示で調整しています。
植生のバッチ描画では元の頂点カラーとアルファテストを保持しています。光のにじみはThree.jsのMITライセンス付き `UnrealBloomPass` / `OutputPass` を使用しています。
Google Fonts は元のHTMLから継続利用しています。利用不能の場合はシステムフォントにフォールバックします。
