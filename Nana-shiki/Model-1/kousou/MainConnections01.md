# 七式（Nana-Shiki） 一型回路
## Key 結線 について

七式のKey 結線マトリックスを考える。  
ラッピング工具で結線していくので、作業の容易性を優先させる。  
ダイオードは総のマトリックスキーに挿入する。

| Rows\\Columns  | 1(8) | 2(9) | 3(10) | 4(11) | 5(12) | 6(13) | 7(14) |
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| 1(0) | Tab  | w    | r    | DEL  | i    | p    | LOya |  
| 2(1) | 1A   | s    | f    | y    | k    | ;    | LSpc |  
| 3(2) | LShift | x  | v    | h    | ,    | /    | ROya |  
| 4(3) | LCtrl| meta | LFnA | n    | RFnC | RAlt | RSpc | 
| 5(4) | LAlt | (LFn) | b    | RFnA | (RFn) | RCtrl |  | 
| 6(5) | z    | c    | g    | m    | .    | RShift | L-Btn | 
| 7(6) | a    | d    | t    | j    | l    | Enter | M-Btn |
| 8(7) | q    | e    | ESC  | u    | o    | BS | R-Btn |

---

## LED 結線 (YD-RP2040 搭載LED)

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| GPIO25 | 青色LED | microcontroller* include要 |
| GP23 | RGB LED | kmk.extensions.RGB* |

---

## アナログステック

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| GP26 | x軸 | analogio |
| GP27 | y軸 | analogio |
| 3.3V | High | |
| GND | Low | ||

---

## ホイール

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| GP19 | a相 | 1 pin |
| GP18 | b相 | 3 pin |
| GND | 共通 | 2 pin|

---

## 加速SW

SW ONでホイール及びポインターの速度アップ

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| TBD | Input | 内部プルアップ |
| GND | 共通 | | |

---

## OS切り替えSW

bootでストレージの有り無しを切り替えるので専用入力を設ける

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| GP15 | Input | 内部プルアップ |
| GND | 共通 | | |
