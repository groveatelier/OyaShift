# ===================================================================
# 七式二型キーボード(KMK_Firmware) 2026/8/27 quietgrobeatelier
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
import gc

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
    def __init__(self, ja_layer=5):
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
        self.scan_cnt = (self.scan_cnt + 1) & 0xFFFF
        if self.scan_cnt & 0x3F != 0:
            return

        # --- GP25 青色LEDの制御 ---
        self.blue_led.value = not self.ime_mgr.enable_ime
        
        # 各種状態を取得
        cur_rgb = [0,0,0]
        cur_layer = keyboard.active_layers[0] if keyboard.active_layers else 0
        if self.ime_mgr.os:
            cur_rgb[1] = 8
        else:
            cur_rgb[0] = 64 if self.lock.get_caps_lock() else 8
            cur_rgb[2] = 64 if self.lock.get_scroll_lock() else 0
        if cur_layer & 1:
            cur_rgb[2] += 16
        if cur_layer & 2:
            cur_rgb[1] += 16       
        if cur_layer & 4:
            cur_rgb[0] += 16

        if self.ime_mgr.ime_on:
            cur_rgb[2] += 32

        target_color = tuple(cur_rgb)

        # 色に変更があった場合のみ LED を更新（無駄な通信を防止）
        if self.last_color != target_color:
            self.last_color = target_color
            self.rgb.set_rgb_fill(target_color)
            self.rgb.show()
            gc.collect()    # ガベージコレクション

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
KC_LOY = KC.LT(1, KC.F16)
KC_ROY = KC.LT(2, KC.F15)
KC_LFA = KC.MO(3)
KC_RFB = KC.MO(3)
KC_LFB = KC.MO(3)
KC_RFA = KC.MO(3)
KC_RFC = KC.MO(4)
KC_0SFT = KC.LM(0, KC.LSFT)
KC_0ALT = KC.LM(0, KC.LALT)
KC_0CTL = KC.LM(0, KC.LCTL)
KC_0WIN = KC.LM(0, KC.LWIN)
KC_0FA = KC.LM(3, KC_RFA)
KC_0FC = KC.LM(4, KC_RFC)
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
    global last_encoder_pos, is_dragging, gc_count

    fast = 3 in keyboard.active_layers  # fnAなら

    # --- A. ホイール（エンコーダー）の計算 ---
    current_encoder_pos = encoder.position
    raw_diff = current_encoder_pos - last_encoder_pos
    
    if raw_diff != 0:
        last_encoder_pos = current_encoder_pos
        if fast:
            raw_diff *= 2   # 倍速

        # fnC 押下なら 音量制御
        if 4 in keyboard.active_layers:
            if raw_diff > 0:
                cc.send(ConsumerControlCode.VOLUME_INCREMENT) # 音量UP
            else:
                cc.send(ConsumerControlCode.VOLUME_DECREMENT) # 音量DOWN

        # 右親 押下なら UP/DOWN
        elif 2 in keyboard.active_layers:
            key_to_tap = KC.UP if raw_diff > 0 else KC.DOWN
            # 回したノッチ（回転量）の分だけキーを送信
#           for _ in range(abs(raw_diff)):
#               keyboard.tap_key(key_to_tap)
            keyboard.tap_key(key_to_tap)
        # 左親 押下なら RIGHT/LEFT
        elif 1 in keyboard.active_layers:
            key_to_tap = KC.LEFT if raw_diff > 0 else KC.RIGHT
            # 回したノッチ（回転量）の分だけキーを送信
#           for _ in range(abs(raw_diff)):
#               keyboard.tap_key(key_to_tap)
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
KC_KA = KC.MACRO(Tap(KC.K), Tap(KC.A))
KC_KI = KC.MACRO(Tap(KC.K), Tap(KC.I))
KC_KU = KC.MACRO(Tap(KC.K), Tap(KC.U))
KC_KE = KC.MACRO(Tap(KC.K), Tap(KC.E))
KC_KO = KC.MACRO(Tap(KC.K), Tap(KC.O))
KC_SA = KC.MACRO(Tap(KC.S), Tap(KC.A))
KC_SI = KC.MACRO(Tap(KC.S), Tap(KC.I))
KC_SU = KC.MACRO(Tap(KC.S), Tap(KC.U))
KC_SE = KC.MACRO(Tap(KC.S), Tap(KC.E))
KC_SO = KC.MACRO(Tap(KC.S), Tap(KC.O))
KC_TA = KC.MACRO(Tap(KC.T), Tap(KC.A))
KC_TI = KC.MACRO(Tap(KC.T), Tap(KC.I))
KC_TU = KC.MACRO(Tap(KC.T), Tap(KC.U))
KC_TE = KC.MACRO(Tap(KC.T), Tap(KC.E))
KC_TO = KC.MACRO(Tap(KC.T), Tap(KC.O))
KC_NA = KC.MACRO(Tap(KC.N), Tap(KC.A))
KC_NI = KC.MACRO(Tap(KC.N), Tap(KC.I))
KC_NU = KC.MACRO(Tap(KC.N), Tap(KC.U))
KC_NE = KC.MACRO(Tap(KC.N), Tap(KC.E))
KC_NO = KC.MACRO(Tap(KC.N), Tap(KC.O))
KC_HA = KC.MACRO(Tap(KC.H), Tap(KC.A))
KC_HI = KC.MACRO(Tap(KC.H), Tap(KC.I))
KC_HU = KC.MACRO(Tap(KC.H), Tap(KC.U))
KC_HE = KC.MACRO(Tap(KC.H), Tap(KC.E))
KC_HO = KC.MACRO(Tap(KC.H), Tap(KC.O))
KC_MA = KC.MACRO(Tap(KC.M), Tap(KC.A))
KC_MI = KC.MACRO(Tap(KC.M), Tap(KC.I))
KC_MU = KC.MACRO(Tap(KC.M), Tap(KC.U))
KC_ME = KC.MACRO(Tap(KC.M), Tap(KC.E))
KC_MO = KC.MACRO(Tap(KC.M), Tap(KC.O))
KC_YA = KC.MACRO(Tap(KC.Y), Tap(KC.A))
KC_YU = KC.MACRO(Tap(KC.Y), Tap(KC.U))
KC_YO = KC.MACRO(Tap(KC.Y), Tap(KC.O))
KC_RA = KC.MACRO(Tap(KC.R), Tap(KC.A))
KC_RI = KC.MACRO(Tap(KC.R), Tap(KC.I))
KC_RU = KC.MACRO(Tap(KC.R), Tap(KC.U))
KC_RE = KC.MACRO(Tap(KC.R), Tap(KC.E))
KC_RO = KC.MACRO(Tap(KC.R), Tap(KC.O))
KC_WA = KC.MACRO(Tap(KC.W), Tap(KC.A))
KC_WO = KC.MACRO(Tap(KC.W), Tap(KC.O))
KC_NN = KC.MACRO(Tap(KC.N), Tap(KC.N))

KC_GA = KC.MACRO(Tap(KC.G), Tap(KC.A))
KC_GI = KC.MACRO(Tap(KC.G), Tap(KC.I))
KC_GU = KC.MACRO(Tap(KC.G), Tap(KC.U))
KC_GE = KC.MACRO(Tap(KC.G), Tap(KC.E))
KC_GO = KC.MACRO(Tap(KC.G), Tap(KC.O))
KC_ZA = KC.MACRO(Tap(KC.Z), Tap(KC.A))
KC_ZI = KC.MACRO(Tap(KC.Z), Tap(KC.I))
KC_ZU = KC.MACRO(Tap(KC.Z), Tap(KC.U))
KC_ZE = KC.MACRO(Tap(KC.Z), Tap(KC.E))
KC_ZO = KC.MACRO(Tap(KC.Z), Tap(KC.O))
KC_DA = KC.MACRO(Tap(KC.D), Tap(KC.A))
KC_DI = KC.MACRO(Tap(KC.D), Tap(KC.I))
KC_DU = KC.MACRO(Tap(KC.D), Tap(KC.U))
KC_DE = KC.MACRO(Tap(KC.D), Tap(KC.E))
KC_DO = KC.MACRO(Tap(KC.D), Tap(KC.O))
KC_BA = KC.MACRO(Tap(KC.B), Tap(KC.A))
KC_BI = KC.MACRO(Tap(KC.B), Tap(KC.I))
KC_BU = KC.MACRO(Tap(KC.B), Tap(KC.U))
KC_BE = KC.MACRO(Tap(KC.B), Tap(KC.E))
KC_BO = KC.MACRO(Tap(KC.B), Tap(KC.O))
KC_VU = KC.MACRO(Tap(KC.V), Tap(KC.U))

KC_PA = KC.MACRO(Tap(KC.P), Tap(KC.A))
KC_PI = KC.MACRO(Tap(KC.P), Tap(KC.I))
KC_PU = KC.MACRO(Tap(KC.P), Tap(KC.U))
KC_PE = KC.MACRO(Tap(KC.P), Tap(KC.E))
KC_PO = KC.MACRO(Tap(KC.P), Tap(KC.O))

KC_XA = KC.MACRO(Tap(KC.X), Tap(KC.A))
KC_XI = KC.MACRO(Tap(KC.X), Tap(KC.I))
KC_XU = KC.MACRO(Tap(KC.X), Tap(KC.U))
KC_XE = KC.MACRO(Tap(KC.X), Tap(KC.E))
KC_XO = KC.MACRO(Tap(KC.X), Tap(KC.O))
KC_XTU = KC.MACRO(Tap(KC.X), Tap(KC.T), Tap(KC.U))
KC_XYA = KC.MACRO(Tap(KC.X), Tap(KC.Y), Tap(KC.A))
KC_XYU = KC.MACRO(Tap(KC.X), Tap(KC.Y), Tap(KC.U))
KC_XYO = KC.MACRO(Tap(KC.X), Tap(KC.Y), Tap(KC.O))

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
        KC_STAB, KC.S,    KC.F,    KC.Y,    KC.K,    KC.SCLN, KC_LFA,
        KC.LSFT, KC.X,    KC.V,    KC.H,    KC.COMM, KC.SLSH, KC_ROY,
        KC.LCTL, KC.LWIN, KC.SPC,  KC.N,    KC_RFB,  KC.RALT, KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC_RFC,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_LMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_RMB
    ],

    # Layer 1: LOY Layer
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.TRNS, KC.ASTR, KC.RPRN, KC.TRNS,
        KC.GRV,  KC.F6,   KC.F8,   KC.CIRC, KC.TRNS, KC.COLN, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.EQL,  KC.LBRC, KC.TRNS, KC.RO,   IME_ON,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.RBRC, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.F9,   KC.RCBR, KC.PIPE, KC.TRNS, KC.TRNS,
        KC.F5,   KC.F7,   KC.PERC, KC.LCBR, KC.JYEN, KC.TRNS, KC.TRNS,
        KC.EXLM, KC.HASH, KC.TRNS, KC.AMPR, KC.LPRN, KC.TRNS, KC.TRNS
    ],

    # Layer 2: ROY Layer
    [
        KC.TRNS, KC.TRNS, KC.DQUO, KC.TRNS, KC.N8,  KC.ASTR, IME_OFF,
        KC.TRNS, KC.TRNS, KC.LPRN, KC.CIRC, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.EQL,  KC.MINS, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,   KC.DOT, KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.COMM, KC.N0,  KC.TG(6),KC.NO,
        KC.TRNS, KC.TRNS, KC.RPRN, KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.QUOT, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.TRNS, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ],

    # Layer 3: RfA Layer
    [
        KC.LANG5,KC.SLCK, KC_DELF, KC.DEL,  KC.INS,  KC.TRNS, IME_OFF,
        KC_CAPS, KC.LANG3,KC.TRNS, KC_SEL1, KC.UP,   KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC_DUP,  KC.DOWN, KC.TRNS, IME_ON,
        KC.TRNS, KC.TRNS, KC.MHEN, KC.TRNS, KC.TRNS, KC.TRNS, KC.HENK,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.PSCR, KC.LEFT, KC.RGHT, KC.TRNS, KC.TRNS,
        KC.LANG4,KC.KANA, KC_DELB, KC.END,  KC.PGDN, KC.TRNS, KC.TRNS,
        KC.PAUS, KC_DEL1, KC.TRNS, KC.HOME, KC.PGUP, KC.TRNS, KC.TRNS
    ],

    # Layer 4: RfC Layer
    [
        KC_RIPL, KC.F2,   KC.F4,   KC_SLEP, KC_APP1, KC.BRIU, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.F11,  KC_APP2, KC.BRID, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.MUTE, KC.VOLU, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.VOLD, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.F10,  KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.F1,   KC.F3,   IME_SW,  KC.F12,  KC.TRNS, KC.TRNS, KC.TRNS
    ],

    # Layer 5: 日本語 Base Layer
    [
        KC.TAB,  KC_KA,   KC_KO,   KC.DEL,  KC_KU,   KC.COMM, KC_LOY,
        KC_STAB, KC_SI,   KC_KE,   KC_RA,   KC_KI,   KC_NN,   KC_0FA,
        KC_0SFT, KC_HI,   KC_HU,   KC_HA,   KC_NE,   KC.SLSH, KC_ROY,
        KC_0CTL, KC_0WIN, KC.SPC,  KC_ME,   KC_RFB,  KC_0ALT, KC_SSPC,
        KC_0ALT, KC_LFB,  KC_HE,   KC_0FA,  KC_0FC,  KC_0CTL, KC.NO,
        KC_ZDOT, KC_SU,   KC_SE,   KC_SO,   KC_HO,   KC_0SFT, KC.MB_LMB,
        KC.U,    KC_TE,   KC_SA,   KC_TO,   KC.I,    KC.ENT,  KC.MB_MMB,
        KC_QDOT, KC_TA,   KC.ESC,  KC_TI,   KC_TU,   KC.BKSP, KC.MB_RMB
    ],

    # Layer N: Num Lock
    [
        KC.TRNS, KC.TRNS, KC.DQUO, KC.TRNS, KC.N8,  KC.ASTR, IME_OFF,
        KC.TRNS, KC.TRNS, KC.LPRN, KC.CIRC, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.EQL,  KC.MINS, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,   KC.DOT, KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.COMM, KC.N0,  KC.TG(6),KC.NO,
        KC.TRNS, KC.TRNS, KC.RPRN, KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.QUOT, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.TRNS, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ]
]

if __name__ == '__main__':
    keyboard.go()