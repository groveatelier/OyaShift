# 七式（Nana-Shiki） 構想メモ01
## Key 結線 について

七式のKey 結線マトリックスを考える。  
ラッピング工具で結線していくので、作業の容易性を優先させる。  
ダイオードは総のマトリックスキーに挿入する。

| Rows\\Columns  | 1(8) | 2(9) | 3(10) | 4(11) | 5(12) | 6(13) | 7(14) |
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| 1(0) | Tab  | w    | r    | DEL  | i    | p    | LOya |  
| 2(1) | 1A   | s    | f    | y    | k    | ;    | LSpc |  
| 3(2) | LShift | x  | v    | h    | ,    | /    | ROya |  
| 4(3) | LCtrl| meta | LFnA | n    | RFnB | RAlt | RSpc | 
| 5(4) | LAlt | LFnB | b    | RFnA | RFnC | RCtrl |  | 
| 6(5) | z    | c    | g    | m    | .    | RShift | R-Btn | 
| 7(6) | a    | d    | t    | j    | l    | Enter | M-Btn |
| 8(7) | q    | e    | ESC  | u    | o    | BS | L-Btn |

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
| x軸 | GP26 | analogio |
| y軸 | GP27 | analogio |
| High | 3.3V | |
| Low | GND ||

---

## ホイール

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| a相 | GP19 | 1 pin |
| b相 | GP18 | 3 pin |
| 共通 | GND | 2 pin|

---

## OS切り替えSW

bootでストレージの有り無しを切り替えるので専用入力を設ける

| pin# | 接続先 | 備考 |
|:---:|:---:|:---:|
| Input | GP15 | 内部プルアップ |
| 共通 | GND | |
