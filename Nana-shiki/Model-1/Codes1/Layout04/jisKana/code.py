# ===================================================================
# 七式二型 (KMK_Firmware) 2026/9/6 [Layout04] quietgrobeatelier
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
# IME状態管理クラス (LED制御付き)
# ===================================================================
class ime_manager():
    def __init__(self, rgb_ext, lock_ext):
        self.os = 0
        self.disable = False
        self.layer = 9
        self.rgb = rgb_ext
        self.lock = lock_ext
        self.ime_on = (KC.LANG1, KC.HENK)
        self.ime_off = (KC.LANG2, KC.MHEN)
        # --- GPIO ピンの設定 (内部プルアップ) ---
        self.os_switch = digitalio.DigitalInOut(board.GP15)
        self.os_switch.direction = digitalio.Direction.INPUT
        self.os_switch.pull = digitalio.Pull.UP
        # --- GP25 青色LEDの設定 (デジタル出力) ---
        self.blue_led = digitalio.DigitalInOut(microcontroller.pin.GPIO25)
        self.blue_led.direction = digitalio.Direction.OUTPUT
        self.blue_led.value = False  # 初期状態は消灯

    def is_state_change(self):
        trans = False
        current_layer = keyboard.active_layers[0]
        # OS スイッチの変更確認
        current_os = self.os_switch.value
        if current_os != self.os:
            self.os = current_os
            self.release_stack()
            trans = True
        # Layer遷移の確認
        if self.layer != current_layer:
            if current_layer == 7 and self.layer != 7:
                self.set_ime(True)
            elif current_layer != 7 and self.layer == 7:
                self.set_ime(False)
            self.layer = current_layer
            trans = True
        return trans

    def set_ime(self, kanamode):
        if kanamode:
            combos.combos = combos_kana # Comboはかな入力
            keyboard.tap_key(self.ime_on[self.os])
        else:
            combos.combos = () # Comboは空に
            keyboard.tap_key(self.ime_off[self.os])

    def layer_led(self):
        if not self.is_state_change():  # 無変化の場合は何もしない
            return
        # --- 青色LEDの制御 ---
        self.blue_led.value = self.disable
        # 各種状態を取得
        cur_rgb = [0,0,0]
        cur_layer = keyboard.active_layers[0] if keyboard.active_layers else 0
        if cur_layer == 0:
            if self.os:
                cur_rgb[1] = 4
            else:
                cur_rgb[0] = 64 if self.lock.get_caps_lock() else 4
                cur_rgb[2] = 64 if self.lock.get_scroll_lock() else 0
        else:
            if cur_layer & 1:
                cur_rgb[2] = 16
            if cur_layer & 2:
                cur_rgb[1] = 16       
            if cur_layer & 4:
                cur_rgb[0] = 16
        target_color = tuple(cur_rgb)
        self.last_color = target_color
        self.rgb.set_rgb_fill(target_color)
        self.rgb.show()
        gc.collect()    # ガベージコレクション

    def release_stack(self):
        # 1. PCへ送信中のHIDキーコードリストをクリア
        keyboard.keys_pressed.clear()
        # 2. マクロキー等がスタックしていたマトリックス状態をクリア
        keyboard._coordkeys_pressed.clear()
        # 3. 各モジュールの内部状態をリセット
        for module in keyboard.modules:
            # Combos モジュールの記憶リセット（安全な属性直接クリア）
            if hasattr(module, 'active_combos') and isinstance(module.active_combos, (dict, list, set)):
                module.active_combos.clear()
            if hasattr(module, 'key_states') and isinstance(module.key_states, (dict, list, set)):
                module.key_states.clear()
            # Macros のアクティブ状態解除（List型なので clear() または [] を代入）
            if hasattr(module, '_active'):
                if isinstance(module._active, list):
                    module._active.clear()
                else:
                    module._active = []
            # HoldTap / Layers モジュールの状態クリア
            if hasattr(module, 'key_states') and isinstance(module.key_states, (dict, list, set)):
                module.key_states.clear()
        # 4. レイヤーを基本（0番）に強制リセット
        keyboard.active_layers = [0]

    def IME_switch(self):
        self.disable = not self.disable
        if self.disable:
            self.IME_off()

    def IME_on(self):
        if self.disable is False:
            keyboard.active_layers.insert(0, 7)

    def IME_off(self):
        self.ime = False
        if 7 in keyboard.active_layers:
            keyboard.active_layers.remove(7)

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

# HoldTap & Combos を先頭に追加(時間監視処理優先の為)
holdtap = HoldTap()
combos = Combos()
combos.timeout_ms = 45  # 同時押し判定時間（45ミリ秒）
keyboard.modules = [combos, holdtap] + keyboard.modules  # 先頭へ追加

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
keyboard.extensions.append(rgb)

# マクロモジュールを有効化
macros = Macros()
keyboard.modules.append(macros)
mouse_keys = MouseKeys()
keyboard.modules.append(mouse_keys)
mouse = Mouse(usb_hid.devices)
cc = ConsumerControl(usb_hid.devices)  # 音量制御用

# IME/LED 制御用モジュール
imeled = ime_manager(rgb, lock_status)

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

def _ime_on_press(*args, **kwargs):
    imeled.IME_on()

def _ime_off_press(*args, **kwargs):
    imeled.IME_off()

def _ime_enadis_press(*args, **kwargs):
    imeled.IME_switch()

# 独自キー
L_OYA = make_key(names='loya')
R_OYA = make_key(names='roya')
KC_LOY = KC.LT(5, L_OYA, tap_time=120)
KC_ROY = KC.LT(6, R_OYA, tap_time=120)
KC_LFA = KC.MO(3)
KC_RFB = KC.MO(3)
KC_LFB = KC.MO(3)
KC_RFA = KC.MO(3)
KC_RFC = KC.MO(4)
KC_1LSF = KC.LM(1, KC.LSFT)
KC_1RSF = KC.LM(1, KC.RSFT)
KC_0SFT = KC.LM(0, KC.LSFT)
KC_0ALT = KC.LM(0, KC.LALT)
KC_0CTL = KC.LM(0, KC.LCTL)
KC_0WIN = KC.LM(0, KC.LWIN)
KC_4FC = KC.LM(4, KC_RFC)
KC_STAB = KC.LSFT(KC.TAB)
KC_SSPC = KC.LSFT(KC.SPC)
KC_APP1 = KC.MACRO(send_app1_fn)
KC_APP2 = KC.MACRO(send_app2_fn)
KC_SLEP = KC.MACRO(send_sleep_fn)
KC_RIPL = KC.MACRO(mcu_reset_fn)
IME_SW = make_key(names='imesw', on_press=_ime_enadis_press)
IME_ON = make_key(names='imeon', on_press=_ime_on_press)
IME_OFF = make_key(names='imeof', on_press=_ime_off_press)

# アナログスティック (GP26, GP27) 予備PIN GP28, GP29
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

# --- Boost switch GPIO ピンの設定 (内部プルアップ) ---
boost_sw = digitalio.DigitalInOut(board.GP16)
boost_sw.direction = digitalio.Direction.INPUT
boost_sw.pull = digitalio.Pull.UP

# -------------------------------------------------------------------
# 2. 高速入力処理ループ
# -------------------------------------------------------------------
def process_controls():
    global last_encoder_pos, is_dragging, gc_count, boost_sw

    fast = boost_sw.value is False  # Boost SW on なら

    # --- A. ホイール（エンコーダー）の計算 ---
    current_encoder_pos = encoder.position
    raw_diff = current_encoder_pos - last_encoder_pos
    
    if raw_diff != 0:
        last_encoder_pos = current_encoder_pos
        if fast:
            raw_diff *= 2   # 倍速

        # 右親 押下なら 音量制御
        if 2 in keyboard.active_layers:
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
        y_val = CENTER_VAL - stick_y.value

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

    # IMEとLEDの制御
    imeled.layer_led()

keyboard.before_matrix_scan = process_controls

# -------------------------------------------------------------------
# 3. ローマ字出力用マクロの定義
# -------------------------------------------------------------------
KC_QDOT = KC.LSFT(KC.DOT)
KC_ZDOT = KC.RSFT(KC.DOT)
KC_PCMM = KC.LSFT(KC.COMM)
KC_STEN = KC.LSFT(KC.SLSH)

KC_AA = KC.N3
KC_II = KC.E
KC_UU = KC.N4
KC_EE = KC.N5
KC_OO = KC.N6
KC_KA = KC.T
KC_KI = KC.G
KC_KU = KC.H
KC_KE = KC.COLN
KC_KO = KC.B
KC_SA = KC.X
KC_SI = KC.D
KC_SU = KC.R
KC_SE = KC.P
KC_SO = KC.C
KC_TA = KC.Q
KC_TI = KC.A
KC_TU = KC.Z
KC_TE = KC.W
KC_TO = KC.S
KC_NA = KC.U
KC_NI = KC.I
KC_NU = KC.N1
KC_NE = KC.COMM
KC_NO = KC.K
KC_HA = KC.F
KC_HI = KC.V
KC_HU = KC.N2
KC_HE = KC.CIRC
KC_HO = KC.MINS
KC_MA = KC.J
KC_MI = KC.N
KC_MU = KC.RBRC
KC_ME = KC.SLSH
KC_MO = KC.M
KC_YA = KC.N7
KC_YU = KC.N8
KC_YO = KC.N9
KC_RA = KC.O
KC_RI = KC.L
KC_RU = KC.DOT
KC_RE = KC.SCLN
KC_RO = KC.RO
KC_WA = KC.N0
KC_WO = KC.LSFT(KC.N0)
KC_NN = KC.Y

KC_GA = KC.MACRO(Tap(KC_KA), Tap(KC.AT))
KC_GI = KC.MACRO(Tap(KC_KI), Tap(KC.AT))
KC_GU = KC.MACRO(Tap(KC_KU), Tap(KC.AT))
KC_GE = KC.MACRO(Tap(KC_KE), Tap(KC.AT))
KC_GO = KC.MACRO(Tap(KC_KO), Tap(KC.AT))
KC_ZA = KC.MACRO(Tap(KC_SA), Tap(KC.AT))
KC_ZI = KC.MACRO(Tap(KC_SI), Tap(KC.AT))
KC_ZU = KC.MACRO(Tap(KC_SU), Tap(KC.AT))
KC_ZE = KC.MACRO(Tap(KC_SE), Tap(KC.AT))
KC_ZO = KC.MACRO(Tap(KC_SO), Tap(KC.AT))
KC_DA = KC.MACRO(Tap(KC_TA), Tap(KC.AT))
KC_DI = KC.MACRO(Tap(KC_TI), Tap(KC.AT))
KC_DU = KC.MACRO(Tap(KC_TU), Tap(KC.AT))
KC_DE = KC.MACRO(Tap(KC_TE), Tap(KC.AT))
KC_DO = KC.MACRO(Tap(KC_TO), Tap(KC.AT))
KC_BA = KC.MACRO(Tap(KC_HA), Tap(KC.AT))
KC_BI = KC.MACRO(Tap(KC_HI), Tap(KC.AT))
KC_BU = KC.MACRO(Tap(KC_HU), Tap(KC.AT))
KC_BE = KC.MACRO(Tap(KC_HE), Tap(KC.AT))
KC_BO = KC.MACRO(Tap(KC_HO), Tap(KC.AT))
KC_VU = KC.MACRO(Tap(KC_UU), Tap(KC.AT))

KC_PA = KC.MACRO(Tap(KC_HA), Tap(KC.LBRC))
KC_PI = KC.MACRO(Tap(KC_HI), Tap(KC.LBRC))
KC_PU = KC.MACRO(Tap(KC_HU), Tap(KC.LBRC))
KC_PE = KC.MACRO(Tap(KC_HE), Tap(KC.LBRC))
KC_PO = KC.MACRO(Tap(KC_HO), Tap(KC.LBRC))

KC_XA = KC.LSFT(KC.N3)
KC_XI = KC.LSFT(KC.E)
KC_XU = KC.LSFT(KC.N4)
KC_XE = KC.LSFT(KC.N5)
KC_XO = KC.LSFT(KC.N6)
KC_XTU = KC.LSFT(KC.Z)
KC_XYA = KC.LSFT(KC.N7)
KC_XYU = KC.LSFT(KC.N8)
KC_XYO = KC.LSFT(KC.N9)

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
# 5. コンボ（同時押し）の定義: 初期値は空
# -------------------------------------------------------------------
combos.combos = ()  
combos_kana = [
    Chord((KC_LOY, KC_QDOT), KC_XA),
    Chord((KC_LOY, KC_KA), KC_EE),
    Chord((KC_LOY, KC_TA), KC_RI),
    Chord((KC_LOY, KC_KO), KC_XYA),
    Chord((KC_LOY, KC_SA), KC_RE),
    Chord((KC_LOY, KC_RA), KC_PA),
    Chord((KC_LOY, KC_TI), KC_DI),
    Chord((KC_LOY, KC_KU), KC_GU),
    Chord((KC_LOY, KC_TU), KC_DU),
    Chord((KC_LOY, KC_PCMM), KC_PI),
    Chord((KC_LOY, KC_UU), KC_WO),
    Chord((KC_LOY, KC_SI), KC_AA),
    Chord((KC_LOY, KC_TE), KC_NA),
    Chord((KC_LOY, KC_KE), KC_XYU),
    Chord((KC_LOY, KC_SE), KC_MO),
    Chord((KC_LOY, KC_HA), KC_BA),
    Chord((KC_LOY, KC_TO), KC_DO),
    Chord((KC_LOY, KC_KI), KC_GI),
    Chord((KC_LOY, KC_II), KC_PO),
    Chord((KC_LOY, KC_NN), KC_XTU),
    Chord((KC_LOY, KC_ZDOT), KC_XU),
    Chord((KC_LOY, KC_HI), KC.JYEN),
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
    Chord((KC_ROY, KC_PCMM), KC_XE),
    Chord((KC_ROY, KC_UU), KC_VU),
    Chord((KC_ROY, KC_SI), KC_ZI),
    Chord((KC_ROY, KC_TE), KC_DE),
    Chord((KC_ROY, KC_KE), KC_GE),
    Chord((KC_ROY, KC_SE), KC_ZE),
    Chord((KC_ROY, KC_HA), KC_MI),
    Chord((KC_ROY, KC_TO), KC_OO),
    Chord((KC_ROY, KC_KI), KC_NO),
    Chord((KC_ROY, KC_II), KC_XYO),
    Chord((KC_ROY, KC_NN), KC_XTU),
    Chord((KC_ROY, KC_HI), KC_BI),
    Chord((KC_ROY, KC_SU), KC_ZU),
    Chord((KC_ROY, KC_HU), KC_BU),
    Chord((KC_ROY, KC_HE), KC_BE),
    Chord((KC_ROY, KC_ME), KC_NU),
    Chord((KC_ROY, KC_SO), KC_YU),
    Chord((KC_ROY, KC_NE), KC_MU),
    Chord((KC_ROY, KC_HO), KC_WA),
    Chord((KC_ROY, KC_STEN), KC_XO)
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
        KC.LCTL, KC.LWIN, KC_LFA,  KC.N,    KC_RFC,  KC.RALT, KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC_RFB,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_RMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_LMB
    ],

    # Layer 1: SHIFT Layer
    [
        KC.TAB,  KC.W,    KC.R,    KC.DEL,  KC.I,    KC.P,    KC_LOY,
        KC_STAB, KC.S,    KC.F,    KC.Y,    KC.K,    KC.SCLN, KC.SPC,
        KC.TRNS, KC.X,    KC.V,    KC.H,    KC.COMM, KC.SLSH, KC_ROY,
        KC.LCTL, KC.LWIN, KC_LFA,  KC.N,    KC_RFC,  KC.RALT, KC.SPC,
        KC.LALT, KC_LFB,  KC.B,    KC_RFA,  KC_RFB,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.TRNS, KC.MB_RMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_LMB
    ],

    # Layer 2: Num Lock
    [
        KC.TRNS, KC.TRNS, KC.DQUO, KC.TRNS, KC.N8,  KC.ASTR, IME_OFF,
        KC.TRNS, KC.TRNS, KC.LPRN, KC.CIRC, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.COMM, KC.EQL,  KC.MINS, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,   KC.N0,  KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.TRNS, KC.DOT, KC.TO(6),KC.NO,
        KC.DOT,  KC.TRNS, KC.RPRN, KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.QUOT, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.TRNS, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ],

    # Layer 3: RfA Layer
    [
        KC.LANG5,KC.SLCK, KC_DELF, KC.DEL,  KC.INS,  KC.TRNS, IME_OFF,
        KC_CAPS, KC.LANG3,KC.TRNS, KC_SEL1, KC.UP,   KC.TRNS, KC.MHEN,
        KC_0SFT, KC.TRNS, KC.TRNS, KC_DUP,  KC.DOWN, KC.TRNS, IME_ON,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.HENK,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.PSCR, KC.LEFT, KC.RGHT, KC_0SFT, KC.TRNS,
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

    # Layer 5: LOY Layer
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

    # Layer 6: ROY Layer
    [
        KC.TRNS, KC.TRNS, KC.DQUO, KC.TRNS, KC.N8,  KC.ASTR, IME_OFF,
        KC.TRNS, KC.TRNS, KC.LPRN, KC.CIRC, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.COMM, KC.EQL,  KC.MINS, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,   KC.N0,  KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.TRNS, KC.DOT, KC.TG(2),KC.NO,
        KC.DOT,  KC.TRNS, KC.RPRN, KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.QUOT, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.TRNS, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ],

    # Layer 7: 日本語 Base Layer
    [
        KC.TAB,  KC_KA,   KC_KO,   KC.DEL,  KC_KU,   KC_PCMM, KC_LOY,
        KC_STAB, KC_SI,   KC_KE,   KC_RA,   KC_KI,   KC_NN,   KC_SSPC,
        KC_1LSF, KC_HI,   KC_HU,   KC_HA,   KC_NE,   KC_STEN, KC_ROY,
        KC_0CTL, KC_0WIN, KC.TRNS, KC_ME,   KC_4FC,  KC_0ALT, KC.SPC,
        KC_0ALT, KC.LSFT, KC_HE,   KC.TRNS, KC.RSFT, KC_0CTL, KC.NO,
        KC_ZDOT, KC_SU,   KC_SE,   KC_SO,   KC_HO,   KC_1RSF, KC.MB_RMB,
        KC_UU,   KC_TE,   KC_SA,   KC_TO,   KC_II,   KC.ENT,  KC.MB_MMB,
        KC_QDOT, KC_TA,   KC.ESC,  KC_TI,   KC_TU,   KC.BKSP, KC.MB_LMB
    ]
]

if __name__ == '__main__':
    keyboard.go()