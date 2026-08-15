# ===================================================================
# 七式二型キーボード(KMK_Firmware) 2026/8/15 quietgrobeatelier
# ===================================================================
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
from kmk.extensions.media_keys import MediaKeys
from kmk.extensions.international import International
from kmk.modules import Module
from kmk.scanners import DiodeOrientation
from kmk.modules.mouse_keys import MouseKeys
from kmk.modules.layers import Layers
from kmk.modules.holdtap import HoldTap  
from kmk.modules.combos import Combos, Chord
from kmk.modules.macros import Macros, Press, Release, Tap, Delay

# キーボード本体のインスタンス化
keyboard = KMKKeyboard()
# keymap_jp を読む前に International 拡張を登録する
keyboard.extensions.append(International())
import kmk.extensions.keymap_extras.keymap_jp

# ===================================================================
# IME状態 ＆ 自動レイヤー切り替えモジュール
# ===================================================================
class IMEManager(Module):
    def __init__(self, ja_layer=5):
        self.ime_on = False
        self.enable_ime = True
        self.ja_layer = ja_layer  # IME ONの時に有効化したいレイヤー番号

    def during_bootup(self, keyboard): pass
    def before_matrix_scan(self, keyboard): pass
    def after_matrix_scan(self, keyboard): pass
    def before_hid_send(self, keyboard): pass
    def after_hid_send(self, keyboard): pass

    def process_key(self, keyboard, key, is_pressed, int_coord):
        if is_pressed:
            if key in (KC.HENK, KC.INT4):
                self.set_ime(keyboard, True)
            elif key in (KC.MHEN, KC.INT5):
                self.set_ime(keyboard, False)
            elif key == KC.F17:
                self.enable_ime = not self.enable_ime
                self.set_ime(keyboard, False)
        return key

    def set_ime(self, keyboard, target_state: bool):
        if self.ime_on != target_state:
            self.ime_on = target_state

            # IME状態に応じてレイヤーを自動切り替え
            if target_state:
                # 【IME ON時】 日本語用レイヤー
                if self.ja_layer not in keyboard.active_layers and self.enable_ime:
                    #keyboard.active_layers.append(self.ja_layer)
                    keyboard.active_layers = [self.ja_layer]
                    #print(f"[IME Manager] Switched to Japanese Layer ({self.ja_layer})")
            else:
                # 【IME OFF時】 基本レイヤー
                if self.ja_layer in keyboard.active_layers:
                    #keyboard.active_layers.remove(self.ja_layer)
                    keyboard.active_layers = [0]
                    #print(f"[IME Manager] Returned to Base Layer (0)")

# -------------------------------------------------------------------
# IME ONの時だけ動く「条件付き Combos」モジュール
# -------------------------------------------------------------------
class IMEConditionalCombos(Combos):
    def __init__(self, manager):
        super().__init__()
        self.manager = manager  # IMEManager への参照を保持

    def process_key(self, keyboard, key, is_pressed, int_coord):
        # 【重要】 IMEがOFFの時は、同時押し判定をスキップして即座にキーを出力
        if not self.manager.ime_on:
            return key

        # IMEがONの時だけ、本来の同時押し（50ms判定）を実行
        return super().process_key(keyboard, key, is_pressed, int_coord)

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
keyboard.extensions.append(MediaKeys())
holdtap = HoldTap()
holdtap.tap_time = 200  # 判定時間を200ms程度に短縮（お好みで調整）
keyboard.modules.append(holdtap)

# IME / カスタムCombo Managerを有効化
ime_manager = IMEManager()
keyboard.modules.append(ime_manager)
combos = IMEConditionalCombos(manager=ime_manager)
combos.timeout_ms = 50  # 同時押し判定時間（50ミリ秒）
keyboard.modules.append(combos)

# マクロモジュールを有効化
macros = Macros()
keyboard.modules.append(macros)

# 独自キー（エラー防止用の仮割り当て）
KC_LOY = KC.LT(6, KC.F16)
KC_SIY = KC.MO(5)  # 暫定
KC_ROY = KC.LT(7, KC.F15)
KC_LFA = KC.MO(1)
KC_RFB = KC.MO(2)
KC_LFB = KC.MO(2)
KC_RFA = KC.MO(1)
KC_RFC = KC.MO(3)
KC_0SFT = KC.LM(0, KC.LSFT)
KC_0ALT = KC.LM(0, KC.LALT)
KC_0CTL = KC.LM(0, KC.LCTL)
KC_0WIN = KC.LM(0, KC.LWIN)
KC_QDOT = KC.DOT
KC_ZDOT = KC.MACRO(".")
#KC_PCOM = KC.COMM

mouse_keys = MouseKeys()
keyboard.modules.append(mouse_keys)

mouse = Mouse(usb_hid.devices)
cc = ConsumerControl(usb_hid.devices)  # 音量制御用

# アナログスティック (GP26, GP27)
stick_x = analogio.AnalogIn(board.GP26)
stick_y = analogio.AnalogIn(board.GP27)

CENTER_VAL = 32768
DEADZONE = 2048
SENSITIVITY = 2048

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
# 3. ローマ字出力用マクロの定義
# -------------------------------------------------------------------
KC_KA = KC.MACRO("ka")
KC_KI = KC.MACRO("ki")
KC_KU = KC.MACRO("ku")
KC_KE = KC.MACRO("ke")
KC_KO = KC.MACRO("ko")
KC_SA = KC.MACRO("sa")
KC_SI = KC.MACRO("si")
KC_SU = KC.MACRO("su")
KC_SE = KC.MACRO("se")
KC_SO = KC.MACRO("so")
KC_TA = KC.MACRO("ta")
KC_TI = KC.MACRO("ti")
KC_TU = KC.MACRO("tu")
KC_TE = KC.MACRO("te")
KC_TO = KC.MACRO("to")
KC_NA = KC.MACRO("na")
KC_NI = KC.MACRO("ni")
KC_NU = KC.MACRO("nu")
KC_NE = KC.MACRO("ne")
KC_NO = KC.MACRO("no")
KC_HA = KC.MACRO("ha")
KC_HI = KC.MACRO("hi")
KC_HU = KC.MACRO("hu")
KC_HE = KC.MACRO("he")
KC_HO = KC.MACRO("ho")
KC_MA = KC.MACRO("ma")
KC_MI = KC.MACRO("mi")
KC_MU = KC.MACRO("mu")
KC_ME = KC.MACRO("me")
KC_MO = KC.MACRO("mo")
KC_YA = KC.MACRO("ya")
KC_YU = KC.MACRO("yu")
KC_YO = KC.MACRO("yo")
KC_RA = KC.MACRO("ra")
KC_RI = KC.MACRO("ri")
KC_RU = KC.MACRO("ru")
KC_RE = KC.MACRO("re")
KC_RO = KC.MACRO("ro")
KC_WA = KC.MACRO("wa")
KC_WO = KC.MACRO("wo")
KC_NN = KC.MACRO("nn")

KC_GA = KC.MACRO("ga")
KC_GI = KC.MACRO("gi")
KC_GU = KC.MACRO("gu")
KC_GE = KC.MACRO("ge")
KC_GO = KC.MACRO("go")
KC_ZA = KC.MACRO("za")
KC_ZI = KC.MACRO("zi")
KC_ZU = KC.MACRO("zu")
KC_ZE = KC.MACRO("ze")
KC_ZO = KC.MACRO("zo")
KC_DA = KC.MACRO("da")
KC_DI = KC.MACRO("di")
KC_DU = KC.MACRO("du")
KC_DE = KC.MACRO("de")
KC_DO = KC.MACRO("do")
KC_BA = KC.MACRO("ba")
KC_BI = KC.MACRO("bi")
KC_BU = KC.MACRO("bu")
KC_BE = KC.MACRO("be")
KC_BO = KC.MACRO("bo")
KC_VU = KC.MACRO("vu")

KC_PA = KC.MACRO("pa")
KC_PI = KC.MACRO("pi")
KC_PU = KC.MACRO("pu")
KC_PE = KC.MACRO("pe")
KC_PO = KC.MACRO("po")

KC_XA = KC.MACRO("xa")
KC_XI = KC.MACRO("xi")
KC_XU = KC.MACRO("xu")
KC_XE = KC.MACRO("xe")
KC_XO = KC.MACRO("xo")
KC_XTU = KC.MACRO("xtu")
KC_XYA = KC.MACRO("xya")
KC_XYU = KC.MACRO("xyu")
KC_XYO = KC.MACRO("xyo")

# -------------------------------------------------------------------
# 4. 特殊系マクロの定義
# -------------------------------------------------------------------
# 一行削除
KC_DEL1 = KC.MACRO(Tap(KC.HOME),Tap(KC.HOME),Press(KC.RSFT),Tap(KC.END),Release(KC.RSFT),Tap(KC.DEL))
# 前方削除
KC_DELF = KC.MACRO(Press(KC.RSFT),Tap(KC.HOME),Tap(KC.HOME),Release(KC.RSFT),Tap(KC.DEL))
# 後方削除
KC_DELB = KC.MACRO(Press(KC.RSFT),Tap(KC.END),Release(KC.RSFT),Tap(KC.DEL))
# 一行選択
KC_SEL1 = KC.MACRO(Tap(KC.HOME),Tap(KC.HOME),Press(KC.RSFT),Tap(KC.DOWN),Release(KC.RSFT))

# -------------------------------------------------------------------
# 5. コンボ（同時押し）の定義
# -------------------------------------------------------------------
combos.combos = [
    Chord((KC_LOY, KC_QDOT), KC_XA),
    Chord((KC_LOY, KC_KA), KC.E),
    Chord((KC_LOY, KC_TA), KC_RI),
    Chord((KC_LOY, KC_KO), KC_XYA),
    Chord((KC_LOY, KC_SA), KC_RE),
    Chord((KC_LOY, KC_RA), KC_PA),
    Chord((KC_LOY, KC_TI), KC_DI),
    Chord((KC_LOY, KC_KU), KC_GU),
    Chord((KC_LOY, KC_TU), KC_DU),
    Chord((KC_LOY, KC.COMM), KC_PI),
    Chord((KC_LOY, KC.U), KC_WO),
    Chord((KC_LOY, KC_SI), KC.A),
    Chord((KC_LOY, KC_TE), KC_NA),
    Chord((KC_LOY, KC_KE), KC_XYU),
    Chord((KC_LOY, KC_SE), KC_MO),
    Chord((KC_LOY, KC_HA), KC_BA),
    Chord((KC_LOY, KC_TO), KC_DO),
    Chord((KC_LOY, KC_KI), KC_GI),
    Chord((KC_LOY, KC.I), KC_PO),
    Chord((KC_LOY, KC_NN), KC_XU),
    Chord((KC_LOY, KC_ZDOT), KC_XU),
    Chord((KC_LOY, KC_HI), KC.MINS),
    Chord((KC_LOY, KC_SU), KC_RO),
    Chord((KC_LOY, KC_HU), KC_YA),
    Chord((KC_LOY, KC_HE), KC_XI),
    Chord((KC_LOY, KC_ME), KC_PU),
    Chord((KC_LOY, KC_SO), KC_ZO),
    Chord((KC_LOY, KC_NE), KC_PE),
    Chord((KC_LOY, KC_HO), KC_BO),

    Chord((KC_ROY, KC_QDOT), KC.QUES),
    Chord((KC_ROY, KC_KA), KC_GA),
    Chord((KC_ROY, KC_TA), KC_DA),
    Chord((KC_ROY, KC_KO), KC_GO),
    Chord((KC_ROY, KC_SA), KC_ZA),
    Chord((KC_ROY, KC_RA), KC_YO),
    Chord((KC_ROY, KC_TI), KC_NI),
    Chord((KC_ROY, KC_KU), KC_RU),
    Chord((KC_ROY, KC_TU), KC_MA),
    Chord((KC_ROY, KC.COMM), KC_XE),
    Chord((KC_ROY, KC.U), KC_VU),
    Chord((KC_ROY, KC_SI), KC_ZI),
    Chord((KC_ROY, KC_TE), KC_DE),
    Chord((KC_ROY, KC_KE), KC_GE),
    Chord((KC_ROY, KC_SE), KC_ZE),
    Chord((KC_ROY, KC_HA), KC_MI),
    Chord((KC_ROY, KC_TO), KC.O),
    Chord((KC_ROY, KC_KI), KC_NO),
    Chord((KC_ROY, KC.I), KC_XYO),
    Chord((KC_ROY, KC_NN), KC_XTU),
    Chord((KC_ROY, KC_HI), KC_BI),
    Chord((KC_ROY, KC_SU), KC_ZU),
    Chord((KC_ROY, KC_HU), KC_BU),
    Chord((KC_ROY, KC_HE), KC_BE),
    Chord((KC_ROY, KC_ME), KC_NU),
    Chord((KC_ROY, KC_SO), KC_YU),
    Chord((KC_ROY, KC_NE), KC_MU),
    Chord((KC_ROY, KC_HO), KC_WA),
    Chord((KC_ROY, KC.SLSH), KC_XO)
]

# -------------------------------------------------------------------
# 6. キーマップ
# -------------------------------------------------------------------
# キーマップの定義 (8行 × 7列 の例)
keyboard.keymap = [
    # Layer 0: Base Layer
    [
        # --- Row 0 ---
        KC.TAB,  KC.W,    KC.R,    KC.DEL,  KC.I,    KC.P,    KC_LOY,
        # --- Row 1 ---
        KC_SIY,  KC.S,    KC.F,    KC.Y,    KC.K,    KC.SCLN, KC.SPC,
        # --- Row 2 ---
        KC.LSFT, KC.X,    KC.V,    KC.H,    KC.COMM, KC.SLSH, KC_ROY, 
        # --- Row 3 ---
        KC.LCTL, KC.LWIN, KC_LFA,  KC.N,    KC_RFB,  KC.RALT, KC.SPC,
        # --- Row 4 ---
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC_RFC,  KC.RCTL, KC.NO,
        # --- Row 5 ---
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_LMB,
        # --- Row 6 ---
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        # --- Row 7 ---
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB,
    ],

    # Layer 1: LfA/RfA Layer
    [
        KC.TILD, KC.AT,   KC.DLR,  KC_DELB, KC.N7,   KC.N9,   KC_LOY,
        KC.GRV,  KC.LCBR, KC.CIRC, KC.LPRN, KC.N4,   KC.N6,   KC.SPC,
        KC.LSFT, KC.X,    KC.UNDS, KC.PSLS, KC.N1,   KC.N3,   KC.KANA, 
        KC.LCTL, KC.LWIN, KC_LFA,  KC.ASTR, KC.PCMM, KC.PDOT, KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC.N0 ,  KC.TG(4), KC.NO,
        KC.RO,   KC.C,    KC.AMPR, KC.PLUS, KC.N2,   KC.EQL,  KC.MB_LMB,
        KC.JYEN, KC.RCBR, KC.PERC, KC.MINS, KC.N5,   KC.ENT,  KC.MB_MMB,
        KC.EXLM, KC.HASH, KC.F17,  KC.RPRN, KC.N8,   KC_DELF, KC.MB_RMB,
    ],

    # Layer 2: LfB/RfB Layer
    [
        KC.TAB,  KC.F2,   KC.F4,   KC_DEL1, KC.HOME, KC.PGUP, KC.HENK,
        KC_SIY,  KC.F6,   KC.F8,   KC.PAUS, KC.END,  KC.PGDN, KC.SPC,
        KC.LSFT, KC.F10,  KC.F12,  KC.SLCK, KC.LEFT, KC.RGHT, KC_ROY, 
        KC.LCTL, KC.LWIN, KC.MHEN, KC.PSCR, KC_RFB,  KC.RALT, KC.SPC,
        KC.LALT, KC_LFB,  KC_SEL1, KC_RFA,  KC_RFC,  KC.RCTL, KC.NO,
        KC.F9,   KC.F11,  KC.G,    KC.UNDS, KC.DOWN, KC.QUOT, KC.MB_LMB,
        KC.F5,   KC.F7,   KC.T,    KC.BSLS, KC.UP,   KC.DQUO, KC.MB_MMB,
        KC.F1,   KC.F3,   KC.ESC,  KC.PIPE, KC.INS,  KC.BKSP, KC.MB_RMB,
    ],

    # Layer 3: RfC Layer
    [
        KC.TAB,  KC.W,    KC.R,    KC.DEL,  KC.APP,  KC.BRIU, KC_LOY,
        KC.F17,  KC.S,    KC.F,    KC.Y,    KC.NO,   KC.BRID, KC.SPC,
        KC.CAPS, KC.X,    KC.V,    KC.H,    KC.MUTE, KC.VOLU, KC_ROY, 
        KC.LCTL, KC.LWIN, KC_LFA,  KC.N,    KC_RFB,  KC.RALT, KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC_RFC,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.VOLD, KC.RBRC, KC.MB_LMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.LBRC, KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB,
    ],

    # Layer 4: Num Lock
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.DEL,  KC.N7,   KC.N9,   KC_LOY,
        KC.GRV,  KC.LCBR, KC.CIRC, KC.LPRN, KC.N4,   KC.N6,   KC.SPC,
        KC.LSFT, KC.X,    KC.UNDS, KC.SLSH, KC.N1,   KC.N3,   KC.KANA, 
        KC.LCTL, KC.LWIN, KC_LFA,  KC.ASTR, KC.COMM, KC.DOT,  KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC.N0 ,  KC.TG(4), KC.NO,
        KC.RO,   KC.C,    KC.AMPR, KC.PLUS, KC.N2,   KC.EQL,  KC.MB_LMB,
        KC.JYEN, KC.RCBR, KC.PERC, KC.MINS, KC.N5,   KC.ENT,  KC.MB_MMB,
        KC.EXLM, KC.HASH, KC.ESC,  KC.RPRN, KC.N8,   KC.BKSP, KC.MB_RMB,
    ],

    # Layer 5: 日本語 Base Layer5
    [
        KC.TAB,  KC_KA,   KC_KO,   KC.DEL,  KC_KU,   KC.COMM, KC_LOY,
        KC_SIY,  KC_SI,   KC_KE,   KC_RA,   KC_KI,   KC_NN,   KC.SPC,
        KC_0SFT, KC_HI,   KC_HU,   KC_HA,   KC_NE,   KC.SLSH,  KC_ROY, 
        KC_0CTL, KC_0WIN, KC_LFA,  KC_ME,   KC_RFB,  KC_0ALT, KC.SPC,
        KC_0ALT, KC_LFB,  KC_HE,   KC_RFA,  KC_RFC,  KC_0CTL, KC.NO,
        KC_ZDOT, KC_SU,   KC_SE,   KC_SO,   KC_HO,   KC_0SFT, KC.MB_LMB,
        KC.U,    KC_TE,   KC_SA,   KC_TO,   KC.I,    KC.ENT,  KC.MB_MMB,
        KC_QDOT, KC_TA,   KC.ESC,  KC_TI,   KC_TU,   KC.BKSP, KC.MB_RMB,
    ],

    # Layer 6: 左親指キー
    [
        KC.TAB,  KC.E,    KC_XYA,  KC.DEL,  KC_GU,   KC_PI,   KC.MO(6),
        KC_SIY,  KC.A,    KC_XYU,  KC_PA,   KC_GI,   KC.SCLN, KC.SPC,
        KC_0SFT, KC.MINS, KC_YA,   KC_BA,   KC_PE,   KC.SLSH, KC.HENK,  
        KC_0CTL, KC_0WIN, KC_LFA,  KC_PU,   KC_RFB,  KC_0ALT, KC.SPC,
        KC_0ALT, KC_LFB,  KC_XI,   KC_RFA,  KC_RFC,  KC_0CTL, KC.NO,
        KC.DOT,  KC_RO,   KC_MO,   KC_ZO,   KC_BO,   KC_0SFT, KC.MB_LMB,
        KC_WO,   KC_NA,   KC_RE,   KC_DO,   KC_PA,   KC.ENT,  KC.MB_MMB,
        KC_XA,   KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB,
    ],

    # Layer 7: 右親指キー
    [
        KC.TAB,  KC_GA,   KC_GO,   KC.DEL,  KC_RU,   KC_XE,   KC.MHEN,
        KC_SIY,  KC_GI,   KC_GE,   KC_YO,   KC_NO,   KC_XTU,  KC.SPC,
        KC_0SFT, KC_BI,   KC_BU,   KC_MI,   KC_MU,   KC_XO,   KC.MO(7), 
        KC_0CTL, KC_0WIN, KC_LFA,  KC_NU,   KC_RFB,  KC_0ALT, KC.SPC,
        KC_0ALT, KC_LFB,  KC_BE,   KC_RFA,  KC_RFC,  KC_0CTL, KC.NO,
        KC_XU,   KC_ZU,   KC_ZE,   KC_YU,   KC_WA,   KC_0SFT, KC.MB_LMB,
        KC_VU,   KC_DE,   KC_ZA,   KC.O,    KC_XYO,  KC.ENT,  KC.MB_MMB,
        KC.QUES, KC_DA,   KC.ESC,  KC_NI,   KC_MA,   KC.BKSP, KC.MB_RMB,
    ]
]

if __name__ == '__main__':
    keyboard.go()