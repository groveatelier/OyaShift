# 七式（Nana-Shiki） 三型回路
## Key 結線 について

七式のKey 結線マトリックスを考える。  
ラッピング工具で結線していくので、作業の容易性を優先させる。  
ダイオードは総のマトリックスキーに挿入する。

| Rows\\Columns  | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
| 0 | Tab  | w    | r    | y    | i    | p    | LOya |  
| 1 | 1A   | s    | f    | h    | k    | ;    | R-Btn |  
| 2 | LShift | x  | v    | n    | ,    | /    | CSpc |  
| 3 | LCtrl| meta | LSpc | RFnA | RFnC | RAlt | L-Btn | 
| 4 | LAlt | ESC  | LCSF | RCSF | (RFn) | RCtrl | ROya | 
| 5 | z    | c    | b    | m    | .    | RShift | M-Btn | 
| 6 | a    | d    | g    | j    | l    | Enter | D-Btn |
| 7 | q    | e    | t    | u    | o    | BS | DEL |

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
| GP16 | Input | 内部プルアップ |
| GND | 共通 | | |

---

