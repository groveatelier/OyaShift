import board
import analogio
import rotaryio
import usb_hid
import time
from adafruit_hid.mouse import Mouse
from adafruit_hid.consumer_control import ConsumerControl
from adafruit_hid.consumer_control_code import ConsumerControlCode

from kmk.kmk_keyboard import KMKKeyboard
from kmk.keys import KC
from kmk.scanners import DiodeOrientation
from kmk.modules.mouse_keys import MouseKeys
from kmk.modules.layers import Layers
from kmk.extensions.international import International
from kmk.extensions.media_keys import MediaKeys

keyboard = KMKKeyboard()

# -------------------------------------------------------------------
# 1. 基本設定
# -------------------------------------------------------------------
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

# レイヤーモジュールの有効化（これがないと KC.MO() が使えません）
layers_ext = Layers()
keyboard.modules.append(layers_ext)

# キーボード定義拡張 
keyboard.extensions.append(International())
keyboard.extensions.append(MediaKeys())

# 独自キー（エラー防止用の仮割り当て）
KC.LOY = KC.LANG2
KC.SIY = KC.NO
KC.ROY = KC.LANG1
KC.LFA = KC.MO(1)
KC.RFB = KC.MO(2)
KC.LFB = KC.MO(2)
KC.RFA = KC.MO(1)
KC.RFC = KC.MO(3)

mouse_keys = MouseKeys()
keyboard.modules.append(mouse_keys)

mouse = Mouse(usb_hid.devices)
cc = ConsumerControl(usb_hid.devices)  # 音量制御用

# アナログスティック (GP26, GP27)
stick_x = analogio.AnalogIn(board.GP26)
stick_y = analogio.AnalogIn(board.GP27)

CENTER_VAL = 32768
DEADZONE = 4000       # 少し広めにしてノイズによるスクロール干渉を防止
SENSITIVITY = 1600

# ホイール (GP18, GP19)
# divisor=1 で最小単位を監視
encoder = rotaryio.IncrementalEncoder(board.GP19, board.GP18, divisor=2)
last_encoder_pos = encoder.position

# -------------------------------------------------------------------
# 2. 高速入力処理ループ
# -------------------------------------------------------------------
def process_controls():
    global last_encoder_pos

    # --- A. ホイール（エンコーダー）の計算 ---
    current_encoder_pos = encoder.position
    raw_diff = current_encoder_pos - last_encoder_pos
    
    if raw_diff != 0:
        last_encoder_pos = current_encoder_pos

        # xfA 押下なら 音量制御
        if 1 in keyboard.active_layers:
            if raw_diff > 0:
                cc.send(ConsumerControlCode.VOLUME_INCREMENT) # 音量UP
            else:
                cc.send(ConsumerControlCode.VOLUME_DECREMENT) # 音量DOWN
        else:
        # 通常は縦スクロール
            mouse.move(wheel=raw_diff)

    else:
    # --- B. アナログスティックの計算 ---
        x_val = stick_x.value - CENTER_VAL
        y_val = stick_y.value - CENTER_VAL

        move_x = 0
        move_y = 0

        if abs(x_val) > DEADZONE:
            move_x = int((x_val - (DEADZONE if x_val > 0 else -DEADZONE)) / SENSITIVITY)
        
        if abs(y_val) > DEADZONE:
            move_y = int(-(y_val - (DEADZONE if y_val > 0 else -DEADZONE)) / SENSITIVITY)

        # --- C. マウス操作の送信 ---
        # アナログ移動またはホイール回転がある時のみ送信
        if move_x != 0 or move_y != 0:
            mouse.move(x=move_x, y=move_y)

keyboard.before_matrix_scan = process_controls

# -------------------------------------------------------------------
# 3. キーマップ
# -------------------------------------------------------------------
# キーマップの定義 (7行 × 8列 の例)
keyboard.keymap = [
    # Layer 0: Base Layer3
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
        KC.LALT, KC.LFB,  KC.B,    KC.RFA,  KC.RFC,  KC.RCTL, KC.NO,
        # --- Row 5 ---
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_LMB,
        # --- Row 6 ---
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        # --- Row 7 ---
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB,
    ],

    # Layer 1: LfA/RfA Layer
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.DEL,  KC.N7,   KC.N9,   KC.LOY,
        KC.GRV,  KC.LCBR, KC.CIRC, KC.LPRN, KC.N4,   KC.N6,   KC.SPC,
        KC.LSFT, KC.X,    KC.UNDS, KC.SLSH, KC.N1,   KC.N3,   KC.KANA, 
        KC.LCTL, KC.LWIN, KC.LFA,  KC.ASTR, KC.COMM, KC.DOT,  KC.SPC,
        KC.LALT, KC.LFB,  KC.B,    KC.RFA,  KC.N0 ,  KC.TG(4), KC.NO,
        KC.RO,   KC.C,    KC.AMPR, KC.PLUS, KC.N2,   KC.EQL,  KC.MB_LMB,
        KC.JYEN, KC.RCBR, KC.PERC, KC.MINS, KC.N5,   KC.ENT,  KC.MB_MMB,
        KC.EXLM, KC.HASH, KC.ESC,  KC.RPRN, KC.N8,   KC.BKSP, KC.MB_RMB,
    ],

    # Layer 2: LfB/RfB Layer
    [
        KC.TAB,  KC.F2,   KC.F4,   KC.DEL,  KC.HOME, KC.PGUP, KC.HENK,
        KC.SIY,  KC.F6,   KC.F8,   KC.PAUS, KC.END,  KC.PGDN, KC.SPC,
        KC.LSFT, KC.F10,  KC.F12,  KC.SLCK, KC.LEFT, KC.RGHT, KC.ROY, 
        KC.LCTL, KC.LWIN, KC.MHEN, KC.PSCR, KC.RFB,  KC.RALT, KC.SPC,
        KC.LALT, KC.LFB,  KC.B,    KC.RFA,  KC.RFC,  KC.RCTL, KC.NO,
        KC.F9,   KC.F11,  KC.G,    KC.UNDS, KC.DOWN, KC.QUOT, KC.MB_LMB,
        KC.F5,   KC.F7,   KC.T,    KC.BSLS, KC.UP,   KC.DQUO, KC.MB_MMB,
        KC.F1,   KC.F3,   KC.ESC,  KC.PIPE, KC.INS,  KC.BKSP, KC.MB_RMB,
    ],

    # Layer 3: RfC Layer
    [
        KC.TAB,  KC.W,    KC.R,    KC.DEL,  KC.APP,  KC.BRIU, KC.LOY,
        KC.SIY,  KC.S,    KC.F,    KC.Y,    KC.CALC, KC.BRID, KC.SPC,
        KC.CAPS, KC.X,    KC.V,    KC.H,    KC.MUTE, KC.VOLU, KC.ROY, 
        KC.LCTL, KC.LWIN, KC.LFA,  KC.N,    KC.RFB,  KC.RALT, KC.SPC,
        KC.LALT, KC.LFB,  KC.B,    KC.RFA,  KC.RFC,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.VOLD, KC.RBRC, KC.MB_LMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.LBRC, KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB,
    ],

    # Num Lock
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.DEL,  KC.N7,   KC.N9,   KC.LOY,
        KC.GRV,  KC.LCBR, KC.CIRC, KC.LPRN, KC.N4,   KC.N6,   KC.SPC,
        KC.LSFT, KC.X,    KC.UNDS, KC.SLSH, KC.N1,   KC.N3,   KC.KANA, 
        KC.LCTL, KC.LWIN, KC.LFA,  KC.ASTR, KC.COMM, KC.DOT,  KC.SPC,
        KC.LALT, KC.LFB,  KC.B,    KC.RFA,  KC.N0 ,  KC.TG(4), KC.NO,
        KC.RO,   KC.C,    KC.AMPR, KC.PLUS, KC.N2,   KC.EQL,  KC.MB_LMB,
        KC.JYEN, KC.RCBR, KC.PERC, KC.MINS, KC.N5,   KC.ENT,  KC.MB_MMB,
        KC.EXLM, KC.HASH, KC.ESC,  KC.RPRN, KC.N8,   KC.BKSP, KC.MB_RMB,
    ],

]

if __name__ == '__main__':
    keyboard.go()