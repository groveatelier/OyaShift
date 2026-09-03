# ===================================================================
# 七式二型キーボード(KMK_Firmware) 2026/8/21 quietgrobeatelier
# ===================================================================
import supervisor
supervisor.runtime.autoreload = False
import board
import analogio
import digitalio
import microcontroller
import rotaryio
import usb_hid
import time

from adafruit_hid.mouse import Mouse
from adafruit_hid.consumer_control import ConsumerControl
from adafruit_hid.consumer_control_code import ConsumerControlCode

from kmk.extensions.RGB import RGB, AnimationModes
from kmk.extensions.lock_status import LockStatus
from kmk.kmk_keyboard import KMKKeyboard
from kmk.keys import KC, make_key
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
    def __init__(self, ja_layer=4):
        self.ime_on = False
        self.enable_ime = True
        self.os = 0
        self.ja_layer = ja_layer  # IME ONの時に有効化したいレイヤー番号
        self.ime_onkeys = (KC.LANG1, KC.HENK)
        self.ime_offkeys = (KC.LANG2, KC.MHEN)
        # --- GPIO ピンの設定 (内部プルアップ) ---
        self.os_switch = digitalio.DigitalInOut(board.GP15)
        self.os_switch.direction = digitalio.Direction.INPUT
        self.os_switch.pull = digitalio.Pull.UP

    def during_bootup(self, keyboard): pass
    def before_matrix_scan(self, keyboard): pass
    def before_hid_send(self, keyboard): pass
    def after_hid_send(self, keyboard): pass

    def process_key(self, keyboard, key, is_pressed, int_coord):
        if is_pressed:
            if key == IME_ON:
                self.set_ime(keyboard, True)
                key = self.ime_onkeys[self.os]
            elif key == IME_OFF:
                self.set_ime(keyboard, False)
                key = self.ime_offkeys[self.os]
            elif key == IME_SW:
                self.enable_ime = not self.enable_ime
                self.set_ime(keyboard, self.enable_ime)
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
            else:
                # 【IME OFF時】 基本レイヤー
                if self.ja_layer in keyboard.active_layers:
                    #keyboard.active_layers.remove(self.ja_layer)
                    keyboard.active_layers = [0]

    def after_matrix_scan(self, keyboard):
        # LOW (False) ＝ Windows(0) / HIGH (True) ＝ ChromeOS(1)
        self.os = self.os_switch.value

# -------------------------------------------------------------------
# IME ONの時だけ動く「条件付き Combos」モジュール
# -------------------------------------------------------------------
class IMEConditionalCombos(Combos):
    def __init__(self, manager):
        super().__init__()
        self.manager = manager  # IMEManager への参照を保持

    def process_key(self, keyboard, key, is_pressed, int_coord):
        # IMEがOFFの時は、同時押し判定をスキップして即座にキーを出力
        if not self.manager.ime_on:
            return key

        # IMEがONの時だけ、本来の同時押しを実行
        return super().process_key(keyboard, key, is_pressed, int_coord)

# -----------------------------------------------------------------
# 状態監視 ＆ LED制御用カスタムモジュール
# -----------------------------------------------------------------
class StatusLEDManager(Module):
    def __init__(self, rgb_ext, lock_ext, ime_mgr=None):
        self.rgb = rgb_ext
        self.lock = lock_ext
        self.ime_mgr = ime_mgr
        self.last_color = None
        self.scan_cnt = 0
        # --- GP25 青色LEDの設定 (デジタル出力) ---
        self.blue_led = digitalio.DigitalInOut(microcontroller.pin.GPIO25)
        self.blue_led.direction = digitalio.Direction.OUTPUT
        self.blue_led.value = False  # 初期状態は消灯

    def during_bootup(self, keyboard): pass
    def before_matrix_scan(self, keyboard): pass
    def before_hid_send(self, keyboard): pass
    def after_hid_send(self, keyboard): pass

    def after_matrix_scan(self, keyboard):
        # 処理頻度を落とす
        self.scan_cnt = (self.scan_cnt + 1) & 0xFFF
        if self.scan_cnt & 0x7F != 0:
            return

        # 各種状態を取得
        cur_rgb = [0,0,0]
        cur_layer = keyboard.active_layers[0] if keyboard.active_layers else 0
        if self.ime_mgr.os:
            cur_rgb[1] = 8
        else:
            cur_rgb[0] = 64 if self.lock.get_caps_lock() else 8
            cur_rgb[1] = 64 if self.lock.get_scroll_lock() else 0
        if self.ime_mgr.ime_on:
            cur_rgb[2] = 16
        if cur_layer != 0:
            cur_rgb[cur_layer%3] += 16
        if cur_layer == 7:
            cur_rgb[0] += 16
            cur_rgb[1] += 16
            cur_rgb[2] = 64
        elif cur_layer == 4:
            cur_rgb[0] += 16

        target_color = tuple(cur_rgb)

        # 色に変更があった場合のみ LED を更新（無駄な通信を防止）
        if self.last_color != target_color:
            self.last_color = target_color
            self.rgb.set_rgb_fill(target_color)
            self.rgb.show()

        # --- GP25 青色LEDの制御 ---
        self.blue_led.value = not self.ime_mgr.enable_ime

    def process_key(self, keyboard, key, is_pressed, int_coord):
        return key

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
# COL2ROW: カソード(アノード側がスイッチ)がROW側に向いている
keyboard.diode_orientation = DiodeOrientation.COL2ROW

# レイヤーモジュールの有効化
layers_ext = Layers()
keyboard.modules.append(layers_ext)

# キーボード定義拡張 
keyboard.extensions.append(MediaKeys())
holdtap = HoldTap()
holdtap.tap_time = 120  # 判定時間を100ms程度に短縮
keyboard.modules.append(holdtap)

# OSからの要求 (Caps Lock / Num Lock等) を取得する拡張機能
lock_status = LockStatus()
keyboard.extensions.append(lock_status)

# YD-RP2040 オンボードRGB LEDの設定 (GP23)
rgb = RGB(
    pixel_pin=board.GP23,
    num_pixels=1,
    val_limit=100,  # 明るさの上限 (0〜255) ※直視で眩しすぎないよう100程度に抑制
    animation_mode=AnimationModes.STATIC,
)
#rgb = RGB(pixel_pin=board.GP23, num_pixels=1)
keyboard.extensions.append(rgb)

# IME / カスタムCombo Managerを有効化
ime_manager = IMEManager()
keyboard.modules.append(ime_manager)
combos = IMEConditionalCombos(manager=ime_manager)
combos.timeout_ms = 60  # 同時押し判定時間（60ミリ秒）
keyboard.modules.append(combos)

# マクロモジュールを有効化
macros = Macros()
keyboard.modules.append(macros)
mouse_keys = MouseKeys()
keyboard.modules.append(mouse_keys)
mouse = Mouse(usb_hid.devices)
cc = ConsumerControl(usb_hid.devices)  # 音量制御用

# LED 制御用モジュール
status_led = StatusLEDManager(rgb, lock_status, ime_mgr=ime_manager)
keyboard.modules.append(status_led)

# --- カスタムキー定義 ---
def send_app1_fn(keyboard):
    cc.send(0x0194)  # 0x0194: AL Local Machine Browser (マイコンピュータ / APP1)
def send_app2_fn(keyboard):
    cc.send(0x0192)  # 0x0192: AL Calculator (電卓 / APP2)
def send_sleep_fn(keyboard):
    if ime_manager.os == 1:
        keyboard.tap_key(KC.LWIN(KC.L)) # chrome OSの場合
    else:
        cc.send(0x0224)  # 0x0224: AC Sleep
def mcu_reset_fn(keyboard):
    microcontroller.reset() # マイコンリセット関数

# 独自キー
KC_LOY = KC.LT(5, KC.F16)
KC_ROY = KC.LT(6, KC.F15)
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
KC_STAB = KC.LSFT(KC.TAB)
KC_SSPC = KC.LSFT(KC.SPC)
KC_APP1 = KC.MACRO(send_app1_fn)
KC_APP2 = KC.MACRO(send_app2_fn)
KC_SLEP = KC.MACRO(send_sleep_fn)
KC_RIPL = KC.MACRO(mcu_reset_fn)
IME_SW = KC.F17
IME_ON = KC.F18
IME_OFF = KC.F19

# アナログスティック (GP26, GP27)
stick_x = analogio.AnalogIn(board.GP26)
stick_y = analogio.AnalogIn(board.GP27)
is_dragging = False
CENTER_VAL = 32768
DEADZONE = 1500
SENSITIVITY = 2048

# ホイール (GP18, GP19)
# divisor=1 で最小単位を監視
encoder = rotaryio.IncrementalEncoder(board.GP19, board.GP18, divisor=2)
last_encoder_pos = encoder.position

# -------------------------------------------------------------------
# 2. 高速入力処理ループ
# -------------------------------------------------------------------
def process_controls():
    global last_encoder_pos, is_dragging

    fast = 2 in keyboard.active_layers  # fnBなら

    # --- A. ホイール（エンコーダー）の計算 ---
    current_encoder_pos = encoder.position
    raw_diff = current_encoder_pos - last_encoder_pos
    
    if raw_diff != 0:
        last_encoder_pos = current_encoder_pos
        if fast:
            raw_diff *= 2   # 倍速

        # xfA 押下なら 音量制御
        if 1 in keyboard.active_layers:
            if raw_diff > 0:
                cc.send(ConsumerControlCode.VOLUME_INCREMENT) # 音量UP
            else:
                cc.send(ConsumerControlCode.VOLUME_DECREMENT) # 音量DOWN

        # 右親 押下なら UP/DOWN
        elif 7 in keyboard.active_layers:
            key_to_tap = KC.UP if raw_diff > 0 else KC.DOWN
            # 回したノッチ（回転量）の分だけキーを送信
            for _ in range(abs(raw_diff)):
                keyboard.tap_key(key_to_tap)
        # 左親 押下なら RIGHT/LEFT
        elif 6 in keyboard.active_layers:
            key_to_tap = KC.LEFT if raw_diff > 0 else KC.RIGHT
            # 回したノッチ（回転量）の分だけキーを送信
            for _ in range(abs(raw_diff)):
                keyboard.tap_key(key_to_tap)
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

        #print(f"xxx {keyboard.keys_pressed}")
        if KC.MB_LMB in keyboard.keys_pressed:
            if not is_dragging:
                mouse.press(1)  # 1: mouse LBTN
                is_dragging = True
        else:
            if is_dragging:
                mouse.release(1) 
                is_dragging = False

        # --- C. マウス操作の送信 ---
        # アナログ移動がある時のみ送信
        if move_x != 0 or move_y != 0:
            if fast: # 倍速
                move_x *= 2
                move_y *= 2
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
# 一行複写
KC_DUP = KC.MACRO(Tap(KC.END),Press(KC.RSFT),Tap(KC.HOME),Tap(KC.HOME),Release(KC.RSFT),Press(KC.LCTL),Tap(KC.C),Tap(KC.V),Release(KC.LCTL),Tap(KC.ENT),Press(KC.LCTL),Tap(KC.V),Release(KC.LCTL))
# caps lock Windows/chrome で処理を合わせる為
KC_CAPS = KC.MACRO(Press(KC.RSFT),Tap(KC.CAPS),Release(KC.RSFT))
# かっこかっこ
KC_KAOC = KC.MACRO(Tap(KC.LPRN),Tap(KC.RPRN),Tap(KC.LEFT))

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
        KC.TAB,  KC.W,    KC.R,    KC.DEL,  KC.I,    KC.P,    KC_LOY,
        KC_STAB, KC.S,    KC.F,    KC.Y,    KC.K,    KC.SCLN, KC.SPC,
        KC.LSFT, KC.X,    KC.V,    KC.H,    KC.COMM, KC.SLSH, KC_ROY,
        KC.LCTL, KC.LWIN, KC_LFA,  KC.N,    KC_RFB,  KC.RALT, KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC_RFC,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_LMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB
    ],

    # Layer 1: LfA/RfA Layer
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.TRNS, KC.N8,   KC.ASTR, IME_OFF,
        KC.GRV,  KC.LCBR, KC.CIRC, KC_KAOC, KC.N5,   KC.PLUS, KC.TRNS,
        KC.TRNS, KC.LBRC, KC.EQL,  KC.COMM, KC.N2,   KC.SLSH, IME_ON,
        KC_0CTL, KC.LWIN, KC.TRNS, KC.MINS, KC.DOT,  KC.EQL,  KC.TRNS,
        KC_0ALT, KC_LFB,  KC.UNDS, KC.TRNS, KC.N0,   KC.TG(7),KC.NO,
        KC.RO,   KC.RBRC, KC.AMPR, KC.N1,   KC.N3,   KC.TRNS, KC.TRNS,
        KC.JYEN, KC.RCBR, KC.PERC, KC.N4,   KC.N6,   KC.TRNS, KC.TRNS,
        KC.EXLM, KC.HASH, KC.TRNS, KC.N7,   KC.N9,   KC.TRNS, KC.TRNS
    ],

    # Layer 2: LfB/RfB Layer
    [
        KC.TRNS, KC.PSCR, KC_DELF, KC_DEL1, KC.INS,  KC.PSCR, KC.MHEN,
        KC.TRNS, KC.TRNS, KC.TRNS, KC_SEL1, KC.UP,   KC.COLN, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.LANG3,KC.DQUO, KC.DOWN, KC.TRNS, KC.HENK,
        KC.TRNS, KC.TRNS, KC.LANG5,KC.QUOT, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.LANG4,KC.KANA, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.LEFT, KC.RGHT, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC_DELB, KC.END,  KC.PGDN, KC.TRNS, KC.TRNS,
        KC.PAUS, KC.TRNS, KC.ESC,  KC.HOME, KC.PGUP, KC.TRNS, KC.TRNS
    ],

    # Layer 3: RfC Layer
    [
        KC_RIPL, KC.F2,   KC.F4,   KC_SLEP, KC_APP1, KC.BRIU, KC.TRNS,
        KC.TRNS, KC.F6,   KC.F8,   KC.TRNS, KC_APP2, KC.BRID, KC.TRNS,
        KC.TRNS, KC.F10,  KC.F12,  KC.TRNS, KC.MUTE, KC.VOLU, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.F9,   KC.F11,  KC.TRNS, KC.TRNS, KC.VOLD, KC.TRNS, KC.TRNS,
        KC.F5,   KC.F7,   KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.F1,   KC.F3,   IME_SW,  KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS
    ],

    # Layer 4: 日本語 Base Layer
    [
        KC.TAB,  KC_KA,   KC_KO,   KC.DEL,  KC_KU,   KC.COMM, KC_LOY,
        KC_STAB, KC_SI,   KC_KE,   KC_RA,   KC_KI,   KC_NN,   KC_SSPC,
        KC_0SFT, KC_HI,   KC_HU,   KC_HA,   KC_NE,   KC.SLSH, KC_ROY,
        KC_0CTL, KC_0WIN, KC_LFA,  KC_ME,   KC_RFB,  KC_0ALT, KC.SPC,
        KC_0ALT, KC_LFB,  KC_HE,   KC_RFA,  KC_RFC,  KC_0CTL, KC.NO,
        KC_ZDOT, KC_SU,   KC_SE,   KC_SO,   KC_HO,   KC_0SFT, KC.MB_LMB,
        KC.U,    KC_TE,   KC_SA,   KC_TO,   KC.I,    KC.ENT,  KC.MB_MMB,
        KC_QDOT, KC_TA,   KC.ESC,  KC_TI,   KC_TU,   KC.BKSP, KC.MB_RMB,
    ],

    # Layer 5: 左親指キー
    [
        KC.TAB,  KC.E,    KC_XYA,  KC.TRNS, KC_GU,   KC_PI,   KC.TRNS,
        KC_CAPS, KC.A,    KC_XYU,  KC_PA,   KC_GI,   KC.SCLN, KC.TRNS,
        KC.TRNS, KC.MINS, KC_YA,   KC_BA,   KC_PE,   KC.COLN, IME_ON,
        KC.TRNS, KC.TRNS, KC.TRNS, KC_PU,   KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC_XI,   KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC_XU,   KC_RO,   KC_MO,   KC_ZO,   KC_BO,   KC.TRNS, KC.TRNS,
        KC_WO,   KC_NA,   KC_RE,   KC_DO,   KC_PO,   KC.TRNS, KC.TRNS,
        KC_XA,   KC_RI,   KC.TRNS, KC_DI,   KC_DU,   KC.TRNS, KC.TRNS
    ],

    # Layer 6: 右親指キー
    [
        KC.TRNS, KC_GA,   KC_GO,   KC_DUP,  KC_RU,   KC_XE,   IME_OFF,
        KC.TRNS, KC_GI,   KC_GE,   KC_YO,   KC_NO,   KC_XTU,  KC.TRNS,
        KC.TRNS, KC_BI,   KC_BU,   KC_MI,   KC_MU,   KC_XO,   KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC_NU,   KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC_BE,   KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC_ZU,   KC_ZE,   KC_YU,   KC_WA,   KC.TRNS, KC.TRNS,
        KC_VU,   KC_DE,   KC_ZA,   KC.O,    KC_XYO,  KC.TRNS, KC.TRNS,
        KC.QUES, KC_DA,   KC.TRNS, KC_NI,   KC_MA,   KC.TRNS, KC.TRNS
    ],

    # Layer N: Num Lock
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.TRNS, KC.N8,   KC.ASTR, IME_OFF,
        KC.GRV,  KC.LCBR, KC.CIRC, KC_KAOC, KC.N5,   KC.PLUS, KC.TRNS,
        KC.TRNS, KC.LBRC, KC.EQL,  KC.COMM, KC.N2,   KC.SLSH, IME_ON,
        KC_0CTL, KC.LWIN, KC.TRNS, KC.MINS, KC.DOT,  KC.EQL,  KC.TRNS,
        KC_0ALT, KC_LFB,  KC.UNDS, KC.TRNS, KC.N0,   KC.TG(7),KC.NO,
        KC.RO,   KC.RBRC, KC.AMPR, KC.N1,   KC.N3,   KC.TRNS, KC.TRNS,
        KC.JYEN, KC.RCBR, KC.PERC, KC.N4,   KC.N6,   KC.TRNS, KC.TRNS,
        KC.EXLM, KC.HASH, KC.TRNS, KC.N7,   KC.N9,   KC.TRNS, KC.TRNS
    ]
]

if __name__ == '__main__':
    keyboard.go()