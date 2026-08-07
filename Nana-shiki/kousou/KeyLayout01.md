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
| 6(5) | z    | c    | g    | m    | .    | RShift | L-Btn | 
| 7(6) | a    | d    | t    | j    | l    | Enter | M-Btn |
| 8(7) | q    | e    | ESC  | u    | o    | BS | R-Btn |

---

## KMK Key 定義について


```python
import board
from kmk.kmk_keyboard import KMKKeyboard
from kmk.keys import KC
from kmk.scanners import DiodeOrientation

keyboard = KMKKeyboard()

# 行（Rows）ピンの指定: Pin0 〜 Pin7
keyboard.row_pins = (
    board.GP0,
    board.GP1,
    board.GP2,
    board.GP3,
    board.GP4,
    board.GP5,
    board.GP6,
    board.GP7,
)

# 列（Columns）ピンの指定: Pin8 〜 Pin14
keyboard.col_pins = (
    board.GP8,
    board.GP9,
    board.GP10,
    board.GP11,
    board.GP12,
    board.GP13,
    board.GP14,
)

# ダイオードの向きを指定
# COL2ROW: カソード(アノード側がスイッチ)がROW側に向いている一般的な配置
# ROW2COL: アノード(ダイオード)がCOL側に向いている場合
keyboard.diode_orientation = DiodeOrientation.COL2ROW

# キーマップの定義 (7行 × 8列 の例)
keyboard.keymap = [
    [
        # --- Row 0 ---
        KC.TAB,  KC.W,    KC.R,    KC.DEL,  KC.I,    KC.P,    KC.LOY,
        # --- Row 1 ---
        KC.SIY,  KC.S,    KC.F,    KC.Y,    KC.K,    KC.SCLN, KC.SPC,
        # --- Row 2 ---
        KC.LSFT, KC.X,    KC.V,    KC.H,    KC.COMM, KC.SLSH, KC.ROY, 
        # --- Row 3 ---
        KC.LCTL, KC.LWIN, KC.LFA,  KC.N,    KC.RFB,  KC.RALT, KC.SPC,
        # --- Row 4 ---
        KC.LALT, KC.LFB,  KC.B,    KC.RFA,  KC.RFC,  KC.RCTL, KC.MB_NO,
        # --- Row 5 ---
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_LMB,
        # --- Row 6 ---
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        # --- Row 7 ---
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB
,
    ]
]

if __name__ == '__main__':
    keyboard.go()

```
