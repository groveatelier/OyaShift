# OyaShiftKey  
親指シフト入力エンジン群（ChromeOS / Windows / 自作キーボード向け）

OyaShiftKey は、quietgrove が育てている  
「親指シフト入力エンジン」シリーズの総称です。

現在は **六式（Roku-shiki）** のみが実装されていますが、  
将来的には **七式（Nana-shiki）** を含む複数の実装が  
この工房の中に静かに並ぶ予定です。

---

📦 最新版のダウンロードは Releases からどうぞ  
https://github.com/groveatelier/OyaShift/releases/

---

## 🌿 プロジェクト構成

```
OyaShiftKey/
├── Roku-shiki/      # 六式の実装（ChromeOS / Windows）
│   ├── chromeos/
│   ├── windowsos/
│   └── hardware/    # 3Dプリンタ用モデル
└── Nana-shiki/      # 七式（将来追加予定）
```

---

## 🌳 六式（Roku-shiki）について

六式は、  
自作キーボードの親指シフトキー（SC1F1 / SC1F2）と連携し、  
ChromeOS と Windows の両方で動作する  
**静かで軽い親指シフト入力エンジン**です。

- ChromeOS 版：独自 IME（六式 IME）を内蔵  
- Windows 版：システム IME と連携し、かな生成のみ担当  
- 自作キーボード向けに最適化  
- quietgrove の世界観に基づく、長く使える設計


六式は、ChromeOS と Windows の両環境で動作する形で初版が完成しています。  
3D プリンター用のサンプルモデル（STL）は `Roku-shiki/hardware/` に含まれています。

詳細は各 README を参照してください。

- `Roku-shiki/chromeos/README.md`
- `Roku-shiki/windowsos/README.md`

---

## 🌱 七式（Nana-shiki）について（予定）

七式は、六式の後継として構想中の  
**次世代親指シフトエンジン**です。

- Column-staggered（コラムスタッガード）式の自作キーボード
- エンジンに RP2040 を採用
- Trackball 搭載
- キーボード内部で親指シフト変換を完結  
- 六式の “静けさ” を継承しつつ、より拡張性のある設計へ

実装が始まり次第、この README に追記されます。

---

## 🌾 quietgrove の世界観

OyaShiftKey シリーズは、  
「森の奥の静かな工房で、長く使える道具を育てる」  
という quietgrove の世界観をもとに設計されています。

- 派手さより静けさ  
- 速さより安定  
- 一時的な流行より、長く使える道具  
- 自分の手に馴染む入力環境を育てる

---

## 🪵 ライセンス

MIT License  
自由に使い、自由に育ててください。

---

## 作者

quietgrove  
森の奥の静かな工房より
