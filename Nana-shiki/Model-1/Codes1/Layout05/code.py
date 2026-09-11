# ===================================================================
# 七式二型 (KMK_Firmware) 2026/9/11 [Layout05] quietgrobeatelier
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
        self.idle_time = time.monotonic()
        self.gc_executed = False
        # --- GPIO OS切り替えピンの設定 (内部プルアップ) ---
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
            self.layer = current_layer
            trans = True
        return trans

    def set_ime(self, kanamode):
        if kanamode:
            combos.combos = combos_roma # Comboはローマ字入力
            keyboard.tap_key(self.ime_on[self.os])
        else:
            combos.combos = () # Comboは空に
            keyboard.tap_key(self.ime_off[self.os])

    def layer_led(self):
        if not self.is_state_change():  # 無変化の場合はGC確認
            self.check_gc()
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
            cur_layer += 1  # 色調整
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

    def release_stack(self):
        print('- reset macro/combos -')
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

    def check_gc(self):
        # 現在物理的に押されているキーがあるか確認
        if keyboard.keys_pressed:
            self.idle_time = time.monotonic()
            self.gc_executed = False  # 入力があったのでGC実行済みフラグをリセット
            return
        # キーが押されていない場合、経過時間を判定
        current_time = time.monotonic()
        if not self.gc_executed and (current_time - self.idle_time >= 1):
            # 時間経過した時の処理
            mem_before = gc.mem_free()
            gc.collect()
            mem_after = gc.mem_free()
            print(f"[GC] {mem_before} -> {mem_after}")
            self.gc_executed = True  # 再び入力があるまで連投しないようにフラグを立てる

    def IME_switch(self):
        self.disable = not self.disable

    def IME_on(self):
        if self.disable is False and 6 not in keyboard.active_layers:
            keyboard.active_layers.insert(0, 6)
        self.set_ime(True)

    def IME_off(self):
        if 6 in keyboard.active_layers:
            keyboard.active_layers.remove(6)
        self.set_ime(False)

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
def send_string(key, keyboard, *args):
    for char in key.jp:
        key_code = getattr(KC, char, None)
        if key_code:
            keyboard.tap_key(key_code)
            time.sleep(0.01)

class JPkeys:
    def __init__(self):
        self.make_jp_keys()

    def make_jp_key(self, shin, boin):
        key = make_key(names='jpk', on_press=send_string)
        key.jp = shin + boin
        setattr(self, key.jp.upper(), key)

    def make_jp_keys(self):
        for shin in 'kstnhmrgzdbpx':
            for boin in 'aiueo':
                self.make_jp_key(shin, boin)
        for shin in ['y','xy']:
            for boin in 'auo':
                self.make_jp_key(shin, boin)
        for shin in ['xt','v']:
            self.make_jp_key(shin, 'u')
        for boin in 'ao':
            self.make_jp_key('w', boin)
        for shin in 'qz':
            self.make_jp_key(shin,'dot')
        self.QDOT.jp = '.'
        self.ZDOT.jp = '.'

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

def _layer_reset(*args, **kwargs):
    keyboard.active_layers = [0]

stick_md = True
def _toggle_stick_mode(*args, **kwargs):
    global stick_md
    stick_md = not stick_md

# 独自キー
L_OYA = make_key(names='loya')
R_OYA = make_key(names='roya')
KC_LOY = KC.LT(4, L_OYA, tap_time=120)
KC_ROY = KC.LT(5, R_OYA, tap_time=120)
KC_LFA = KC.MO(2)
KC_RFB = KC.MO(2)
KC_RFA = KC.MO(2)
KC_RFC = KC.MO(3)
KC_FSFT = KC.LM(0, KC.LSFT)
KC_FALT = KC.LM(0, KC.LALT)
KC_FCTL = KC.LM(0, KC.LCTL)
KC_FWIN = KC.LM(0, KC.LWIN)
KC_FFC = KC.LM(3, KC_RFC)
KC_STAB = KC.LSFT(KC.TAB)
KC_APP1 = KC.MACRO(send_app1_fn)
KC_APP2 = KC.MACRO(send_app2_fn)
KC_SLEP = KC.MACRO(send_sleep_fn)
KC_RIPL = KC.MACRO(mcu_reset_fn)
IME_SW = make_key(names='imesw', on_press=_ime_enadis_press)
IME_ON = make_key(names='imeon', on_press=_ime_on_press)
IME_OFF = make_key(names='imeof', on_press=_ime_off_press)
LAYRST = make_key(names='layrst', on_press=_layer_reset)
STICK = make_key(names='stk', on_press=_toggle_stick_mode)

# アナログスティック (GP26, GP27) 予備PIN GP28, GP29
stick_x = analogio.AnalogIn(board.GP26)
stick_y = analogio.AnalogIn(board.GP27)
is_dragging = False

deadzone = 200
ave_sense = 1225
an_center_x = 33232
an_center_y = 31575
x_max = 45000
y_max = 45000
x_min = 13000
y_min = 13000

# アナログステック調整ルーチン
def analog_adjust():
    x_sense_p = int((x_max - an_center_x - deadzone)/16)
    x_sense_m = int((an_center_x - x_min - deadzone)/16)
    y_sense_p = int((y_max - an_center_y - deadzone)/16)
    y_sense_m = int((an_center_y - y_min - deadzone)/16)
    ave_sense = int((x_sense_m + x_sense_p + y_sense_m + y_sense_p)/4)
    print(f'ave sense: {ave_sense}')

def analog_calibration():
    global an_center_x, an_center_y
    imeled.blue_led.value = True # LED 操作
    time.sleep(0.5)
    # 最小最大値のリセット
    x_max = 45000
    y_max = 45000
    x_min = 13000
    y_min = 13000
    # 中心値の計測
    an_center_x = stick_x.value
    an_center_y = stick_y.value
    cx_max = an_center_x
    cx_min = an_center_x
    cy_max = an_center_y
    cy_min = an_center_y
    for _ in range(64):
        ax = stick_x.value
        ay = stick_y.value
        cx_max = ax if ax > cx_max else cx_max
        cx_min = ax if ax < cx_min else cx_min
        cy_max = ay if ay > cy_max else cy_max
        cy_min = ay if ay < cy_min else cy_min
        time.sleep(0.08)
    print(f'cx min/max, cy min/max: {cx_min}/{cx_max}, {cy_min}/{cy_max}')
    x_bre = (cx_max - cx_min)
    y_bre = (cy_max - cy_min)
    an_center_x = int(x_bre/2 + cx_min)
    an_center_y = int(y_bre/2 + cy_min)
    deadzone = x_bre if x_bre > y_bre else y_bre
    print(f'center x/y, deadzone: {an_center_x}/{an_center_y}, {deadzone}')
    analog_adjust()
    imeled.blue_led.value = False # LED 操作

def analog_minmax(xval, yval):
    global x_max, x_min, y_max, y_min
    if xval > x_max:
        x_max = int((x_max + xval)/2)
        analog_adjust()
    elif xval < x_min:
        x_min = int((x_min + xval)/2)
        analog_adjust()
    if yval > y_max:
        y_max = int((y_max + yval)/2)
        analog_adjust()
    elif yval < y_min:
        y_min = int((y_min + yval)/2)
        analog_adjust()

def _analog_calib(*args, **kwargs):
    analog_calibration()

ANACAL = make_key(names='calib', on_press=_analog_calib)

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
    global last_encoder_pos, is_dragging, gc_count, boost_sw, stick_md

    fast = boost_sw.value is False  # Boost SW on なら

    # --- A. ホイール（エンコーダー）の計算 ---
    current_encoder_pos = encoder.position
    raw_diff = current_encoder_pos - last_encoder_pos
    
    if raw_diff != 0:
        last_encoder_pos = current_encoder_pos
        if fast:
            raw_diff *= 2   # 倍速

        # 右親 押下なら 音量制御
        if 5 in keyboard.active_layers:
            if raw_diff > 0:
                cc.send(ConsumerControlCode.VOLUME_INCREMENT) # 音量UP
            else:
                cc.send(ConsumerControlCode.VOLUME_DECREMENT) # 音量DOWN
        else:
        # 通常は縦スクロール
            mouse.move(wheel=raw_diff)

    else:
    # --- B. アナログスティックの計算 ---
        x_val = stick_x.value - an_center_x     #CENTER_VAL
        y_val = stick_y.value - an_center_y     #CENTER_VAL - stick_y.value
        move_x = 0
        move_y = 0

        if abs(x_val) > deadzone:
            move_x = int((x_val - (deadzone if x_val > 0 else -deadzone)) / ave_sense)
        if abs(y_val) > deadzone:
            move_y = int((y_val - (deadzone if y_val > 0 else -deadzone)) / ave_sense)
 
        if stick_md:
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
                if fast: # 逓倍
                    if abs(x_val) >= 2: move_x = int(move_x/2)
                    if abs(y_val) >= 2: move_y = int(move_y/2) 
                mouse.move(x=move_x, y=move_y)
        else:
            if abs(move_x) > 2:
                key_to_tap = KC.RIGHT if move_x > 0 else KC.LEFT
                keyboard.tap_key(key_to_tap)
                time.sleep(0.12)
            if abs(move_y) > 2:
                key_to_tap = KC.DOWN if move_y > 0 else KC.UP
                keyboard.tap_key(key_to_tap)
                time.sleep(0.12)
        
        analog_minmax(x_val, y_val)
    # IMEとLEDの制御
    imeled.layer_led()

keyboard.before_matrix_scan = process_controls

# -------------------------------------------------------------------
# 3. ローマ字出力用マクロの定義
# -------------------------------------------------------------------
jp = JPkeys()
KC_NN = KC.MACRO(Tap(KC.N), Tap(KC.N))

# -------------------------------------------------------------------
# 4. 特殊系マクロの定義
# -------------------------------------------------------------------
# 一行選択
ACT_SEL1 = (Tap(KC.HOME),Tap(KC.HOME),Press(KC.RSFT),Tap(KC.DOWN),Release(KC.RSFT))
KC_SEL1 = KC.MACRO(*ACT_SEL1)
# 一行削除
KC_DEL1 = KC.MACRO(*ACT_SEL1,Tap(KC.DEL))
# 前方削除
ACT_RSDEL = (Release(KC.RSFT),Tap(KC.DEL))
KC_DELF = KC.MACRO(Press(KC.RSFT),Tap(KC.HOME),Tap(KC.HOME),*ACT_RSDEL)
# 後方削除
KC_DELB = KC.MACRO(Press(KC.RSFT),Tap(KC.END),*ACT_RSDEL)
# 一行複写
KC_DUP = KC.MACRO(Tap(KC.HOME), Tap(KC.LCTL(KC.C)), Tap(KC.LCTL(KC.V)))
# caps lock Windows/chrome で処理を合わせる為
KC_CAPS = KC.MACRO(Press(KC.RSFT),Tap(KC.CAPS),Release(KC.RSFT))

# -------------------------------------------------------------------
# 5. コンボ（同時押し）の定義: 初期値は空
# -------------------------------------------------------------------
combos.combos = ()  
combos_roma = [
    Chord((KC_LOY, jp.SE), jp.MO),
    Chord((KC_ROY, jp.HA), jp.MI),
    Chord((KC_LOY, jp.SA), jp.RE),
    Chord((KC_ROY, jp.RA), jp.YO),
    Chord((KC_LOY, jp.HE), jp.XI),
    Chord((KC_ROY, jp.ME), jp.NU),
    Chord((KC_LOY, jp.KE), jp.XYU),
    Chord((KC_ROY, jp.TO), KC.O),
    Chord((KC_LOY, jp.KO), jp.XYA),
    Chord((KC_ROY, jp.TI), jp.NI),
    Chord((KC_LOY, jp.HU), jp.YA),
    Chord((KC_ROY, jp.SO), jp.YU),
    Chord((KC_LOY, jp.TE), jp.NA),
    Chord((KC_ROY, jp.KI), jp.NO),
    Chord((KC_LOY, jp.TA), jp.RI),
    Chord((KC_ROY, jp.KU), jp.RU),
    Chord((KC_LOY, jp.SU), jp.RO),
    Chord((KC_ROY, jp.NE), jp.MU),
    Chord((KC_LOY, jp.SI), KC.A),
    Chord((KC_ROY, KC.I), jp.XYO),
    Chord((KC_LOY, jp.KA), KC.E),
    Chord((KC_ROY, jp.TU), jp.MA),
    Chord((KC_LOY, jp.HI), KC.MINS),
    Chord((KC_ROY, jp.HO), jp.WA),
    Chord((KC_LOY, KC.U), jp.WO),
    Chord((KC_ROY, KC_NN), jp.XTU),
    Chord((KC_LOY, jp.ZDOT), jp.XU),
    Chord((KC_ROY, KC.SLSH), jp.XO),

    Chord((KC_ROY, jp.SE), jp.ZE),
    Chord((KC_LOY, jp.HA), jp.BA),
    Chord((KC_ROY, jp.SA), jp.ZA),
    Chord((KC_ROY, jp.HE), jp.BE),
    Chord((KC_ROY, jp.KE), jp.GE),
    Chord((KC_LOY, jp.TO), jp.DO),
    Chord((KC_ROY, jp.KO), jp.GO),
    Chord((KC_LOY, jp.TI), jp.DI),
    Chord((KC_ROY, jp.HU), jp.BU),
    Chord((KC_LOY, jp.SO), jp.ZO),
    Chord((KC_ROY, jp.TE), jp.DE),
    Chord((KC_LOY, jp.KI), jp.GI),
    Chord((KC_ROY, jp.TA), jp.DA),
    Chord((KC_LOY, jp.KU), jp.GU),
    Chord((KC_ROY, jp.SU), jp.ZU),
    Chord((KC_ROY, jp.SI), jp.ZI),
    Chord((KC_ROY, jp.KA), jp.GA),
    Chord((KC_LOY, jp.TU), jp.DU),
    Chord((KC_ROY, jp.HI), jp.BI),
    Chord((KC_LOY, jp.HO), jp.BO),
    Chord((KC_ROY, KC.U), jp.VU),
    Chord((KC_ROY, jp.QDOT), KC.QUES),
    Chord((KC_LOY, jp.QDOT), jp.XA),
    Chord((KC_ROY, KC.COMM), jp.XE),

    Chord((KC_LOY, jp.RA), jp.PA),
    Chord((KC_LOY, jp.ME), jp.PU),
    Chord((KC_LOY, jp.NE), jp.PE),
    Chord((KC_LOY, KC.I), jp.PO),
    Chord((KC_LOY, KC.COMM), jp.PI)
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
        KC.LALT, KC.SPC,  KC.B,    KC_RFA,  KC_RFB,  KC.RCTL, KC.NO,
        KC.Z,    KC.C,    KC.G,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_RMB,
        KC.A,    KC.D,    KC.T,    KC.J,    KC.L,    KC.ENT,  KC.MB_MMB,
        KC.Q,    KC.E,    KC.ESC,  KC.U,    KC.O,    KC.BKSP, KC.MB_LMB
    ],

    # Layer 1: Num Lock
    [
        KC.TRNS, KC.TRNS, KC.DQUO, KC.TRNS, KC.N8,  KC.ASTR, IME_OFF,
        KC.TRNS, KC.TRNS, KC.LPRN, KC.CIRC, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.COMM, KC.EQL,  KC.MINS, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,   KC.N0,  KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.TRNS, KC.DOT, KC.TRNS, KC.NO,
        KC.DOT,  KC.TRNS, KC.RPRN, KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.QUOT, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.TRNS, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ],

    # Layer 2: RfA Layer
    [
        KC.LANG5,KC.SLCK, KC_DELF, KC.DEL,  KC.INS,  KC.TRNS, IME_OFF,
        KC_CAPS, KC.LANG3,STICK,   KC_SEL1, KC.UP,   KC.TRNS, KC.MHEN,
        KC_FSFT, KC.TRNS, KC.TRNS, KC_DUP,  KC.DOWN, KC.TRNS, IME_ON,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.HENK,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.PSCR, KC.LEFT, KC.RGHT, KC_FSFT, KC.TRNS,
        KC.LANG4,KC.KANA, KC_DELB, KC.END,  KC.PGDN, KC.TRNS, KC.TRNS,
        KC.PAUS, KC_DEL1, KC.TRNS, KC.HOME, KC.PGUP, KC.TRNS, KC.TRNS
    ],

    # Layer 3: RfC Layer
    [
        KC_RIPL, KC.F2,   KC.F4,   KC_SLEP, KC_APP1, KC.BRIU, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.F11,  KC_APP2, KC.BRID, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.MUTE, KC.VOLU, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        LAYRST,  KC.TRNS, KC.TRNS, KC.TRNS, KC.VOLD, KC.TRNS, KC.TRNS,
        ANACAL,  KC.TRNS, KC.F10,  KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.F1,   KC.F3,   IME_SW,  KC.F12,  KC.TRNS, KC.RELOAD, KC.TRNS
    ],

    # Layer 4: LOY Layer
    [
        KC.TILD, KC.AT,   KC.DLR,  KC.TRNS, KC.ASTR, KC.RPRN, KC.TRNS,
        KC.GRV,  KC.F6,   KC.F8,   KC.CIRC, KC.TRNS, KC.COLN, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.UNDS, KC.LBRC, KC.TRNS, KC.RO,   IME_ON,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.LCBR, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.EQL,  KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TRNS, KC.TRNS, KC.F9,   KC.RCBR, KC.PIPE, KC.TRNS, KC.TRNS,
        KC.F5,   KC.F7,   KC.PERC, KC.RBRC, KC.JYEN, KC.TRNS, KC.TRNS,
        KC.EXLM, KC.HASH, KC.TRNS, KC.AMPR, KC.LPRN, KC.TRNS, KC.TRNS
    ],

    # Layer 5: ROY Layer
    [
        KC.TRNS, KC.TRNS, KC.DQUO, KC.TRNS, KC.N8,  KC.ASTR, IME_OFF,
        KC.TRNS, KC.TRNS, KC.LPRN, KC.CIRC, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.COMM, KC.UNDS, KC.MINS, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,   KC.N0,  KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.EQL,  KC.TRNS, KC.DOT, KC.TG(1),KC.NO,
        KC.DOT,  KC.TRNS, KC.RPRN, KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.QUOT, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.TRNS, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ],

    # Layer 6: 日本語 Base Layer
    [
        KC.TAB,  jp.KA,   jp.KO,   KC.DEL,  jp.KU,   KC.COMM, KC_LOY,
        KC_STAB, jp.SI,   jp.KE,   jp.RA,   jp.KI,   KC_NN,   KC.SPC,
        KC_FSFT, jp.HI,   jp.HU,   jp.HA,   jp.NE,   KC.SLSH, KC_ROY,
        KC_FCTL, KC_FWIN, KC.TRNS, jp.ME,   KC_FFC,  KC_FALT, KC.SPC,
        KC_FALT, KC.LSFT, jp.HE,   KC.TRNS, KC.RSFT, KC_FCTL, KC.NO,
        jp.ZDOT, jp.SU,   jp.SE,   jp.SO,   jp.HO,   KC_FSFT, KC.MB_RMB,
        KC.U,    jp.TE,   jp.SA,   jp.TO,   KC.I,    KC.ENT,  KC.MB_MMB,
        jp.QDOT, jp.TA,   KC.ESC,  jp.TI,   jp.TU,   KC.BKSP, KC.MB_LMB
    ]
]

if __name__ == '__main__':
    keyboard.go()