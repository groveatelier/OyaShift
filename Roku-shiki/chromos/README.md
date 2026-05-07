# 六式（Roku-Shiki）ChromeOS 版  
親指シフト入力を ChromeOS 上で静かに実現する拡張機能

六式（Roku-Shiki）ChromeOS 版は、  
自作キーボードに搭載した親指シフトキー（スキャンコード 0x1F1 / 0x1F2）と連携し、  
ChromeOS 上で **独立した親指シフト入力エンジン**として動作します。  
また親指シフトキーボートが手元に無い場合の為に Multi-tap版 も用意しています。  
Multi-tap版はキー配列は親指シフトキーのままで、キーを複数回タップすることで  
文字を切り替える独特の入力フィーリングになっています。  

IME に依存せず、  
「森の奥の静かな工房」で育てるように、  
小さく、静かで、長く使える入力環境を目指しています。

---

## 🌱 機能

- キーイベントのフックと変換処理
- 左右親指キーとの同時押し判定 (親指シフトキーボード版)
- 複数回タップと長押し判定 (JISキーボード版)
- Chrome 拡張としての軽量な常駐動作

---

## 🧩 六式 ChromeOS 版の入力方式について

六式 ChromeOS 版は、ChromeOS の標準 IME を利用せず、  
**キーボード入力を直接フックして独自の IME を内部に実装**しています。

- `keydown` / `keyup` を監視  
- 親指キー（0x1F1 / 0x1F2）の同時押しを判定  
- JavaScript 内で変換ロジックを実行  
- `chrome.input.ime.commitText()` により文字列を注入  

この方式により、  
ChromeOS 上で六式独自の軽量で静かな入力体験を実現しています。

---

## 🌳 ファイル構成

```
chromeos/
├── common/             # 共通処理 (実体)
|     ├── dictdlg.js        # 辞書入力ダイアログ操作
|     ├── dictdlg.html      # 辞書入力ダイアログ
|     ├── offscreen.js      # パワーセーブ対策処理
|     ├── offscreen.html    # パワーセーブ対策仮ダイアログ
|     └── RokushikiIME.js   # 入力変換ロジックの中心
├── OyaShift/           # 親指シフトキーボード用ロジック
|     ├── manifest.json     # Chrome 拡張の定義
|     ├── OyaShiftBG2026.js # 親指シフト入力ロジック
|     ├── rokuicon-*.png    # アイコン画像
|     ├── RokushikiIME.js   # 入力変換ロジック (リンク)
|     ├── dictdlg.*         # 辞書入力ダイアログ (リンク)
|     └── offscreen.*       # パワーセーブ対策 (リンク)
├── Multi-tap/          # JISキーボード用ロジック
|     ├── manifest.json     # Chrome 拡張の定義
|     ├── multi-tap.BG.js   # マルチタップ入力ロジック
|     ├── rokuicon-*.png    # アイコン画像
|     ├── RokushikiIME.js   # 入力変換ロジック (リンク)
|     ├── dictdlg.*         # 辞書入力ダイアログ (リンク)
|     └── offscreen.*       # パワーセーブ対策 (リンク)
└── README.md            # このファイル
```

---

## 🌲 インストール方法（開発者モード）

1. Chrome の設定 → 「拡張機能」  
2. 右上の「デベロッパーモード」を ON  
3. 「パッケージ化されていない拡張機能を読み込む」  
4. `chromeos/OyaShift/`または`chromeos/Multi-tap/`フォルダを選択

読み込むと、六式の入力エンジンが ChromeOS 上で動作を開始します。

---

## 🌾 カスタマイズ

### キーイベント処理  
`RokushikiIME.js`,`OyaShiftBG2026.js`,`multi-tapBG.js`  
内のロジックを編集することで、変換ルールや同時押し判定の調整が可能です。  

### 辞書ダイアログ  
`dictdlg.js` と `dictdlg.html` を編集することで、  
辞書登録 UI の動作を変更できます。

---

## 🌌 今後の予定

- 内蔵IMEのユーザビリティ向上
- ChromeOS のバージョン更新に伴う安定性改善  

---

## 🪵 ライセンス

MIT License  
自由に使って、自由に育ててください。

---

## 作者

quietgrove  
森の奥の静かな工房より
