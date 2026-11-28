# ===================================================================
# 七式二型 (KMK_Firmware) 2026/11/28  [Layout09B] quietgrobeatelier
# ===================================================================
import supervisor
supervisor.runtime.autoreload = False
import board
import analogio
import digitalio
import microcontroller
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

# Wheel クラス
class Wheel():
    def __init__(self) -> None:
        # --- wheel GPIO ピンの設定 (内部プルアップ) ---
        self.arm = digitalio.DigitalInOut(board.GP18)
        self.arm.direction = digitalio.Direction.INPUT
        self.arm.pull = digitalio.Pull.UP
        self.phase = digitalio.DigitalInOut(board.GP19)
        self.phase.direction = digitalio.Direction.INPUT
        self.phase.pull = digitalio.Pull.UP
        self.pos = True
        self.dir = 0
        self.chg = False
        self.life = 0

    def is_rotate(self) -> int:
        def _get_dir(cur):
            if self.dir != cur:
                if self.chg:
                    self.dir = cur
                else:
                    self.chg = True
            else:
                self.chg = False
            return
        phs = self.phase.value
        arm = self.arm.value
        if self.pos is True and arm is False:
            self.pos = arm
            _get_dir(1 if phs else -1)
            return self.dir
        self.pos = arm
        self.life += 1
        if self.life > 512:
            self.life = 0
            self.dir = 0
        return 0

# Hookの為だけの継承クラス
class NanaKeyboard(KMKKeyboard):
    def __init__(self) -> None:
        super().__init__()
        self.key_time = -1
        self.prev_layer = 0
        self.gc_exec = False
        self.stick_md = True
        self.lock_status = None
        self.prev_color = None
        self.os = 0 # 0 - win, 1 - Chrome
        self.cycle_count = 0
        self.ime_mode = 0
        self.copied = False
        self.keyQueue = []
        self.winled = 0
        self.kanaon = True
        self.kana_on = None
        self.kana_off = None
        # --- GP25 青色LEDの設定 (デジタル出力) ---
        self.blue_led = digitalio.DigitalInOut(microcontroller.pin.GPIO25)
        self.blue_led.direction = digitalio.Direction.OUTPUT
        self.blue_led.value = False  # 初期状態は消灯
        # YD-RP2040 オンボードRGB LEDの設定 (GP23)
        self.rgb = RGB(
            pixel_pin=board.GP23,
            num_pixels=1,
            val_limit=100,  # 明るさの上限 (0〜255) ※直視で眩しすぎないよう100程度に抑制
            animation_mode=AnimationModes.STATIC,
        )

    def process_key(
        self, key: Key, is_pressed: bool, int_coord: Optional[int] = None
    ) -> None:
        if is_pressed:
            if int_coord == 6:  # LOY
                self.ime_mode = 128 if self.ime_mode != 0 else 1
            elif int_coord == 34:   # ROY
                self.ime_mode = 256 if self.ime_mode != 0 else 2
            elif int_coord == None:
                pass
            else:
                self.ime_mode = 0
        else:
            self.gc_exec = False
        self.key_time = -1
        return super().process_key(
            key,
            is_pressed,
            int_coord
        )

    def _main_loop(self) -> None:
        super()._main_loop()
        self.key_idle_check()

    def key_idle_check(self):
        self.cycle_count += 1
        self.cycle_count &= 0xffff
        # Layer が異なるなら、RGB LED処理へ
        if self.active_layers[0] != self.prev_layer:
            self.prev_layer = self.active_layers[0]
            self.key_time = -1
            self.color_led()
            return
        # key_time が初期化なら終了
        if self.key_time < 0:
            self.key_time = time.monotonic()
            return

        # 経過時間を算出
        spend_time = time.monotonic() - self.key_time

        # IME mode 設定
        def set_ime_mode(onoff):
            self.kana_mode_sw(onoff)
            self.ime_mode = 0
        if self.ime_mode != 0 and self.kanaon:
            if self.ime_mode == 256:
                set_ime_mode(True)
            elif self.ime_mode == 128:
                set_ime_mode(False)
            elif spend_time > 0.5:
                self.ime_mode = 0
        
        # key Queue 吐き出し
        if self.cycle_count & 0x3 == 0 and len(self.keyQueue) != 0:
            self.tap_key(self.keyQueue[0])
            self.keyQueue.pop(0)
            if spend_time > 10:
                self.copied = False

        # Windows LED 制御
        if self.winled:
            subcyl = self.cycle_count & 0x3ff
            if self.winled & 1:
                if subcyl == 1:
                    self.blue_led.value = True
                elif subcyl == 80:
                    self.blue_led.value = False
            if self.winled & 2:
                if subcyl in (160, 320):
                    self.blue_led.value = True
                elif subcyl in (240, 400):
                    self.blue_led.value = False

        # 処理間引き1
        #if self.cycle_count & 0xFF != 0:
        #    return
        # Power Save 判断
        if spend_time > 608:
            self.rgb.set_rgb_fill((0,0,0))
            self.rgb.show()
            time.sleep(0.6)
            self.rgb.set_rgb_fill(self.prev_color)
            self.rgb.show()

        # 処理間引き
        if self.cycle_count & 0x1FF != 0:
            return

        # GC 実施要か判断
        if self.gc_exec is False and spend_time > 1:
            self.blue_led.value = True
            # 時間経過した時の処理
            mem_before = gc.mem_free()
            gc.collect()
            mem_after = gc.mem_free()
            print(f"[GC] {mem_before} -> {mem_after}")
            self.gc_exec = True  # GC実施フラグ
            self.blue_led.value = False
            return

        # Layer 固着判断
        if spend_time > 5 and self.prev_layer > 1 and self.prev_layer != 6:
            self.blue_led.value = True
            self.release_stack()
            self.blue_led.value = False

    def release_stack(self):
        print('- reset TapHold/combos -')
        self.keys_pressed.clear()   # PCへ送信中のHIDキーコードリストをクリア
        self._coordkeys_pressed.clear() # マクロキー等スタック状態をクリア
        # 各モジュールの内部状態をリセット
        for module in self.modules:
            # Combos モジュールの記憶リセット（安全な属性直接クリア）
            if hasattr(module, 'active_combos') and isinstance(module.active_combos, (dict, list, set)):
                module.active_combos.clear()
            if hasattr(module, 'key_states') and isinstance(module.key_states, (dict, list, set)):
                module.key_states.clear()
            # HoldTap / Layers モジュールの状態クリア
            if hasattr(module, 'key_states') and isinstance(module.key_states, (dict, list, set)):
                module.key_states.clear()
        # レイヤーを基本（0番）に強制リセット
        self.active_layers = [0]

    def color_led(self):
        # Layer及びOS情報をもとにLEDを設定
        cur_rgb = [0,0,0]
        cur_layer = self.active_layers[0] if self.active_layers else 0
        if cur_layer == 0:
            if self.os:
                cur_rgb[1] = 8
            else:
                cur_rgb[0] = 16
                self.winled = 0
                if self.lock_status.get_caps_lock():
                    self.winled = 1
                if self.lock_status.get_scroll_lock():
                    self.winled += 2
        elif cur_layer in (4,5,7):
            if self.kanaon:
                cur_rgb = [32,24,0]
            else:
                cur_rgb = [0,0,0]
        elif cur_layer == 6:
            cur_rgb = [32,24,32]
        elif cur_layer == 2:
            cur_rgb = [0,24,32]
        elif cur_layer == 3:
            cur_rgb = [32,0,32]
        else:
            cur_rgb = [0,0,32]
        if not self.stick_md:
            cur_rgb[2] += 48
        target_color = tuple(cur_rgb)
        if self.prev_color != target_color:
            self.prev_color = target_color
            self.rgb.set_rgb_fill(target_color)
            self.rgb.show()

    def OS_tggle(self):
        self.os = 0 if self.os else 1
        self.release_stack()
        self.color_led()

    def kana_mode_sw(self, kanamode):
        global combos, combos_roma
        if 6 in self.active_layers:
            self.active_layers.remove(6)
        if kanamode:
            self.active_layers.insert(0, 6)
            combos.combos = combos_roma # Comboはローマ字入力
        else:
            combos.combos = () # Comboは空に
        if kanamode:
            self.keyQueue.append(self.kana_on[self.os])
        else:
            self.keyQueue.append(self.kana_off[self.os])

    def toggle_kana_enable(self):
        self.kanaon = not self.kanaon
        if self.kanaon is False:
            self.kana_mode_sw(False)

# キーボード本体のインスタンス化
Nana = NanaKeyboard()

# keymap_jp を読む前に International 拡張を登録する
Nana.extensions.append(International())
import kmk.extensions.keymap_extras.keymap_jp

# -------------------------------------------------------------------
# 1. 基本設定
# -------------------------------------------------------------------
# 行（Rows）ピンの指定: Pin0 〜 Pin7
Nana.row_pins = (
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
Nana.col_pins = (
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
Nana.diode_orientation = DiodeOrientation.COL2ROW

# レイヤーモジュールの有効化
layers_ext = Layers()
Nana.modules.append(layers_ext)

# キーボード定義拡張 
Nana.extensions.append(MediaKeys())

# HoldTap & Combos を先頭に追加(時間監視処理優先の為)
holdtap = HoldTap()
combos = Combos()
combos.timeout_ms = 45  # 同時押し判定時間（45ミリ秒）
Nana.modules = [holdtap, combos] + Nana.modules  # 先頭へ追加

# OSからの要求 (Caps Lock / Num Lock等) を取得する拡張機能
Nana.lock_status = LockStatus()
Nana.extensions.append(Nana.lock_status)
# RGB extentionの設定
Nana.extensions.append(Nana.rgb)

# マウスモジュールを有効化
mouse_keys = MouseKeys()
Nana.modules.append(mouse_keys)
mouse = Mouse(usb_hid.devices)
cc = ConsumerControl(usb_hid.devices)  # 音量制御用

# -------------------------------------------------------------------
# 2. カスタムキー
# -------------------------------------------------------------------
def send_string(key, keyboard, *args):
    for char in key.jp:
        key_code = getattr(KC, char, None)
        if key_code:
            Nana.keyQueue.append(key_code)

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
        self.make_jp_key('n', 'n')
        self.QDOT.jp = '.'
        self.ZDOT.jp = '.'

# 独自キー Main keys
L_OYA = make_key(names='loya')
R_OYA = make_key(names='roya')
KC_LOY = KC.LT(4, L_OYA, tap_time=180)
KC_ROY = KC.LT(5, R_OYA, tap_time=180)
KC_LFA = KC.MO(2)
KC_RFB = KC.MO(2)
KC_RFA = KC.MO(2)
KC_RFC = KC.MO(3)
KC_FSFT = KC.LM(0, KC.LSFT)
KC_HNDK = KC.MO(7)
KC_FALT = KC.LM(0, KC.LALT)
KC_FCTL = KC.LM(0, KC.LCTL)
KC_FWIN = KC.LM(0, KC.LWIN)
KC_FFC = KC.LM(3, KC_RFC)
KC_USPC = KC.HT(KC.SPC, KC.LSFT, tap_time=220)
KC_JSPC = KC.HT(KC.SPC, KC_HNDK, tap_time=220)
KC_SSPC = KC.LSFT(KC.SPC) # Shift付き
KC_SENT = KC.LSFT(KC.ENT)
KC_STAB = KC.LSFT(KC.TAB)
KC_DEL1 = KC.LCTL(KC.X) # 一行削除
KC_CAPS = KC.RSFT(KC.CAPS) # caps lock Windows/chrome で処理を合わせる為
KC_CADL = KC.LCTL(KC.LALT(KC.DEL)) # Ctrl+Alt+Del
KC_CBRK = KC.LCTL(KC.PAUS) # Ctrl+Break

def queue_keys(key_list):
    for key in key_list:
        Nana.keyQueue.append(key)

def _app1_on(*args, **kwargs):
    cc.send(0x0194)  # 0x0194: AL Local Machine Browser (マイコンピュータ / APP1)
def _app2_on(*args, **kwargs):
    cc.send(0x0192)  # 0x0192: AL Calculator (電卓 / APP2)
def _sleep_on(*args, **kwargs):
    if Nana.os:
        Nana.keyQueue = [KC.LWIN(KC.L)] # chrome OSの場合
    else:
        cc.send(0x0224)  # 0x0224: AC Sleep
def _mcu_rst_on(*args, **kwargs):
    microcontroller.reset() # マイコンリセット関数
def _os_tgl_on(*args, **kwargs):
    Nana.OS_tggle()
def _ime_enadis_on(*args, **kwargs):
    Nana.toggle_kana_enable()
def _layer_reset_on(*args, **kwargs):
    Nana.active_layers = [0]
def _toggle_stick_on(*args, **kwargs):
    Nana.stick_md = not Nana.stick_md
    Nana.color_led()
def _henkan_on(*args, **kwargs):
    if Nana.os == 0:
        Nana.keyQueue.append(KC.HENK)
def _muhenkan_on(*args, **kwargs):
    if Nana.os == 0:
        Nana.keyQueue.append(KC.MHEN)
def _full_copy_on(*args, **kwargs):
    queue_keys([KC.LCTL(KC.A), KC.LCTL(KC.C)]) # 全コピー
def _full_past_on(*args, **kwargs):
    queue_keys([KC.LCTL(KC.A), KC.LCTL(KC.V)]) # 全ペースト
def _sel_one_on(*args, **kwargs):
    queue_keys([KC.HONE, KC.HOME, KC.RSFT(KC.DOWN)]) # 一行選択
def _del_fw_on(*args, **kwargs):
    queue_keys([KC.RSFT(KC.HOME), KC.RSFT(KC.HOME), KC.DEL]) # 前方削除
def _del_bk_on(*args, **kwargs):
    queue_keys([KC.RSFT(KC.END), KC.DEL]) # 後方削除
def _dup_on(*args, **kwargs):
    queue_keys([KC.LCTL(KC.C), KC.LCTL(KC.V)])
def _indent_on(*args, **kwargs):
    queue_keys([KC.HOME, KC.TAB])

# Function handlers
Func_handlers = {
    'app1': _app1_on,
    'app2': _app2_on,
    'slep': _sleep_on,
    'ripl': _mcu_rst_on,
    'ost': _os_tgl_on,
    'imsw': _ime_enadis_on,
    'lyrs': _layer_reset_on,
    'stck': _toggle_stick_on,
    'henk': _henkan_on,
    'mhen': _muhenkan_on,
    'ctac': _full_copy_on,
    'ctav': _full_past_on,
    'sel1': _sel_one_on,
    'delf': _del_fw_on,
    'delb': _del_bk_on,
    'dup': _dup_on,
    'indt': _indent_on,
}

# Fucntion Keys
class FnKeys:
    def __init__(self):
        self.id = 'fnkeys'
        self.make_fnkeys()

    def make_fnkeys(self):
        global FuncKeys, Func_handlers
        for fname, hndl in Func_handlers.items():
            key = make_key(names=self.id, on_press=hndl)
            setattr(self, fname, key)

jp = JPkeys()
fn = FnKeys()
Nana.kana_on = [KC.LANG1, KC.HENK]
Nana.kana_off = [KC.LANG2, KC.MHEN]

# -------------------------------------------------------------------
# 3. アナログスティック
# -------------------------------------------------------------------
class AnalogStick:
    def __init__(self):
        # アナログスティック (GP26, GP27) 予備PIN GP28, GP29
        self.stick_x = analogio.AnalogIn(board.GP26)
        self.stick_y = analogio.AnalogIn(board.GP27)
        self.deadzone = [1800,1800]
        self.asense = [1200,1200]
        self.amid = [33684,33400]
        self.amax = [35000,35000]
        self.amin = [24000,24000]
        self.move_cycle = 32

    def get_value(self):
        x_val = self.amid[0] - self.stick_x.value
        y_val = self.amid[1] - self.stick_y.value
        return x_val, y_val

    # アナログステック調整ルーチン
    def analog_adjust(self):
        def cal_maxmin(xy):
            return int((self.amax[xy] - self.amid[xy] - self.deadzone[xy])/18), int((self.amid[xy] - self.amin[xy] - self.deadzone[xy])/18)
        x_sense = cal_maxmin(0)
        y_sense = cal_maxmin(1)
        self.asense = [int((x_sense[0]+x_sense[1])/2), int((y_sense[0]+y_sense[1])/2)]
        print(f'ave sense: {self.asense}')

    # Calibration
    def analog_calibration(self):
        Nana.blue_led.value = True # LED 操作
        time.sleep(0.5)
        # 最小最大値のリセット
        self.amax = [36000,36000]
        self.amin = [22000,22000]
        # 中心値の計測
        ax = self.stick_x.value
        ay = self.stick_y.value
        cmax = [ ax, ay ]
        cmin = [ ax, ay ]
        for _ in range(64):
            ax = self.stick_x.value
            ay = self.stick_y.value
            cmax[0] = ax if ax > cmax[0] else cmax[0]
            cmax[1] = ay if ay > cmax[1] else cmax[1]
            cmin[0] = ax if ax < cmin[0] else cmin[0]
            cmin[1] = ay if ay < cmin[1] else cmin[1]
            time.sleep(0.08)
        x_bre = cmax[0] - cmin[0]
        y_bre = cmax[1] - cmin[1]
        self.amid = [int(x_bre/2 + cmin[0]), int(y_bre/2 + cmin[1])]
        self.deadzone = [x_bre+1600, y_bre+1600]
        print(f'cx max-min, cy max-min: {x_bre}, {y_bre}')
        print(f'center, deadzone: {self.amid}, {self.deadzone}')
        self.analog_adjust()
        Nana.blue_led.value = False # LED 操作

    # 最大最小値の更新
    def analog_minmax(self, xval, yval):
        if xval > self.amax[0]:
            self.amax[0] = int((self.amax[0] + xval)/2)
            self.analog_adjust()
        elif xval < self.amin[0]:
            self.amin[0] = int((self.amin[0] + xval)/2)
            self.analog_adjust()
        if yval > self.amax[1]:
            self.amax[1] = int((self.amax[1] + yval)/2)
            self.analog_adjust()
        elif yval < self.amin[1]:
            self.amin[1] = int((self.amin[1] + yval)/2)
            self.analog_adjust()

    def get_move_value(self):
        def cal_value(cv, xy):
            ccv = int((cv - (self.deadzone[xy] if cv > 0 else - self.deadzone[xy])) / self.asense[xy])
            ccv = ccv - 1 if ccv >= 2 else (ccv + 1 if ccv <= -2 else ccv)
            return ccv           

        xval, yval = self.get_value()
        xx = 0
        yy = 0
        absx = abs( xval )
        absy = abs( yval )
        moved = False

        if absx > self.deadzone[0]:
            #print(f'absx:{absx} > {self.deadzone[0]}')
            xx = cal_value( xval, 0 )
        if absy > self.deadzone[1]:
            #print(f'absx:{absy} > {self.deadzone[1]}')
            yy = cal_value( yval, 1 )
        if xx != 0 or yy != 0:
            if Nana.cycle_count % (self.move_cycle >> 1) == 0:
                if self.move_cycle >= 4:
                    self.move_cycle -= 1
                moved  = True
                self.analog_minmax( xval, yval )
        else:
            self.move_cycle = 32
        return moved, xx, yy

ast = AnalogStick()
is_dragging = False

def _analog_calib(*args, **kwargs):
    ast.analog_calibration()

ANACAL = make_key(names='calib', on_press=_analog_calib)

# ホイール (GP18, GP19)
encoder = Wheel()

# --- Boost switch GPIO ピンの設定 (内部プルアップ) ---
boost_sw = digitalio.DigitalInOut(board.GP16)
boost_sw.direction = digitalio.Direction.INPUT
boost_sw.pull = digitalio.Pull.UP

# -------------------------------------------------------------------
# 4. 高速入力処理ループ
# -------------------------------------------------------------------
def process_controls():
    global last_encoder_pos, is_dragging, boost_sw

    fast = boost_sw.value is False  # Boost SW on なら

    # --- A. ホイール（エンコーダー）の計算 ---
    diff = encoder.is_rotate()
    if diff != 0:
        if fast:
            diff *= 2   # 倍速
        # 右親 押下なら 音量制御
        if 5 in Nana.active_layers:
            if diff > 0:
                cc.send(ConsumerControlCode.VOLUME_INCREMENT) # 音量UP
            else:
                cc.send(ConsumerControlCode.VOLUME_DECREMENT) # 音量DOWN
        else:
        # 通常は縦スクロール
            mouse.move(wheel=diff)
        Nana.key_time = -1
    else:
    # --- B. アナログスティックの計算 ---
        moved, move_x, move_y = ast.get_move_value()

        if moved is True:
            if Nana.stick_md:
                if KC.MB_LMB in Nana.keys_pressed:
                    if not is_dragging:
                        mouse.press(1)  # 1: mouse LBTN
                        is_dragging = True
                elif is_dragging:
                    mouse.release(1) 
                    is_dragging = False

                # --- C. マウス操作の送信 ---
                if fast: # 逓倍
                    if abs(move_x) >= 2: move_x = int(move_x/2)
                    if abs(move_y) >= 2: move_y = int(move_y/2) 
                mouse.move(x=move_x, y=move_y)
            else:
                if abs(move_x) > 2:
                    key_to_tap = KC.RIGHT if move_x > 0 else KC.LEFT
                    Nana.tap_key(key_to_tap)
                    time.sleep(0.12)
                if abs(move_y) > 2:
                    key_to_tap = KC.DOWN if move_y > 0 else KC.UP
                    Nana.tap_key(key_to_tap)
                    time.sleep(0.12)
                Nana.key_time = -1

Nana.before_matrix_scan = process_controls

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
    Chord((KC_ROY, jp.NN), jp.XTU),
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
Nana.keymap = [
    # Layer 0: Base Layer
    [
        KC.TAB,  KC.W,    KC.R,    KC.Y,    KC.I,    KC.P,    KC_LOY,
        KC.DEL,  KC.S,    KC.F,    KC.H,    KC.K,    KC.SCLN, KC.MB_LMB,
        KC.LSFT, KC.X,    KC.V,    KC.N,    KC.COMM, KC.SLSH, KC_USPC,
        KC.LCTL, KC.LWIN, KC.SPC,  KC.MB_RMB,KC_RFC, KC.RCTL, KC.RCTL,
        KC.LALT, KC.ESC,  KC.MB_LMB,KC_RFA, KC_RFB,  KC.RALT, KC_ROY,
        KC.Z,    KC.C,    KC.B,    KC.M,    KC.DOT,  KC.RSFT, KC.MB_MMB,
        KC.A,    KC.D,    KC.G,    KC.J,    KC.L,    KC.ENT,  fn.stck,
        KC.Q,    KC.E,    KC.T,    KC.U,    KC.O,    KC.BKSP, KC.DEL
    ],

    # Layer 1: Num Lock
    [
        KC.TRNS, fn.lyrs, KC.DQUO, KC.CIRC, KC.N8,  KC.N0,   KC.TRNS,
        KC.TRNS, fn.lyrs, KC.LPRN, KC.MINS, KC.N5,  KC.PLUS, KC.TRNS,
        KC.TRNS, KC.COMM, KC.UNDS, KC.ASTR, KC.N2,  KC.SLSH, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.N0,  KC.EQL,  KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.DOT, KC.TRNS, KC.TRNS,
        KC.DOT,  KC.TRNS, KC.EQL,  KC.N1,   KC.N3,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.RPRN, KC.N4,   KC.N6,  KC.TRNS, KC.TRNS,
        KC.QUES, KC.TRNS, KC.QUOT, KC.N7,   KC.N9,  KC.TRNS, KC.TRNS
    ],

    # Layer 2: RfA Layer
    [
        KC.LANG5,KC.SLCK, fn.delf, fn.sel1, KC.INS,  KC.TRNS, fn.mhen,
        fn.indt, KC.LANG3,KC.TRNS, fn.dup,  KC.UP,   KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, fn.ctav, KC.TRNS, KC.DOWN, KC.TRNS, KC.SPC,
        KC.TRNS, KC.TRNS, fn.henk, KC.TRNS, KC.DOWN, KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, fn.ctac, KC.TRNS, KC.LEFT, KC.RGHT, KC.ENT,  KC.TRNS,
        KC.LANG4,KC.KANA, KC.PSCR, KC.END,  KC.PGDN, KC_SENT, KC.TRNS,
        KC.PAUS, KC_DEL1, fn.delb, KC.HOME, KC.PGUP, KC.BKSP, KC.BKSP
    ],

    # Layer 3: RfC Layer
    [
        fn.ripl, KC.F2,   KC.F4,   KC.F11,  fn.app1, KC.BRIU, KC.NO,
        KC.NO,   fn.slep, KC.NO,   KC.NO,   fn.app2, KC.BRID, KC.NO,
        KC.NO,   KC.NO,   KC.NO,   KC.NO,   KC.MUTE, KC.VOLU, KC.NO,
        KC.NO,   fn.imsw, KC.NO,   KC.NO,   KC.TRNS, KC.NO,   KC.NO,
        KC.NO,   fn.imsw, KC.NO,   KC.NO,   KC.NO,   KC.NO,   KC.NO,
        KC_CADL, KC.NO,   KC.NO,   KC.NO,   KC.VOLD, KC.NO,   KC.NO,
        ANACAL,  KC.NO,   KC_CBRK, KC.NO,   KC.NO,   KC.NO,   KC.NO,
        KC.F1,   KC.F3,   KC.F10,  KC.F12,  KC.NO,   KC.RELOAD,fn.ost 
    ],

    # Layer 4: LOY Layer
    [
        KC_STAB, KC.AT,   KC.DLR,  KC.CIRC, KC.ASTR, KC.RPRN, KC.NO,
        KC.ESC,  KC.F6,   KC.F8,   KC.LBRC, KC.TRNS, KC.COLN, KC.TRNS,
        KC.ENT,  KC.GRV,  KC.UNDS, KC.LCBR, KC.TRNS, KC.RO,   KC_SSPC,
        KC_CAPS, fn.ost,  KC_SSPC, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS,
        KC.TRNS, fn.ost,  KC.DEL,  KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,
        KC.TILD, KC.NO,  KC.EQL,  KC.RCBR, KC.PIPE, KC_SENT, KC.TRNS,
        KC.F5,   KC.F7,   KC.F9,   KC.RBRC, KC.JYEN, KC_SENT, KC.TRNS,
        KC.EXLM, KC.HASH, KC.PERC, KC.AMPR, KC.LPRN, KC.BKSP, KC.BKSP
    ],

    # Layer 5: ROY Layer
    [
        KC_STAB, KC.TRNS, KC.DQUO, KC.CIRC, KC.N8,  KC.N0,   KC.NO,
        KC.ESC,  KC.RABK, KC.LPRN, KC.MINS, KC.N5,  KC.PLUS, KC.TRNS,
        KC_SENT, KC.COMM, KC.UNDS, KC.ASTR, KC.N2,  KC.SLSH, KC_SSPC,
        KC.TRNS, fn.ost,  KC_SSPC, KC.TRNS, KC.N0,  KC.EQL,  KC.TRNS,
        KC.TRNS, fn.ost,  KC.DEL,  KC.TRNS, KC.DOT, KC.TG(1),KC.NO,
        KC.DOT,  KC.NO,   KC.EQL,  KC.N1,   KC.N3,  KC.ENT,  KC.TRNS,
        KC.LABK, KC.PLUS, KC.RPRN, KC.N4,   KC.N6,  KC_SENT, KC.TRNS,
        KC.QUES, KC.TRNS, KC.QUOT, KC.N7,   KC.N9,  KC.BKSP, KC.BKSP
    ],

    # Layer 6: 日本語 Base Layer
    [
        KC.TRNS, jp.KA,   jp.KO,   jp.RA,   jp.KU,   KC.COMM, KC.TRNS,
        KC.TRNS, jp.SI,   jp.KE,   jp.HA,   jp.KI,   jp.NN,   KC.TRNS,
        KC_FSFT, jp.HI,   jp.HU,   jp.ME,   jp.NE,   KC.TRNS, KC_JSPC,
        KC_FCTL, KC_FWIN, KC.TRNS, KC.TRNS, KC_FFC,  KC_FCTL, KC_FCTL,
        KC_FALT, KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC_FALT, KC.TRNS,
        jp.ZDOT, jp.SU,   jp.HE,   jp.SO,   jp.HO,   KC_FSFT, KC.TRNS,
        KC.U,    jp.TE,   jp.SE,   jp.TO,   KC.I,    KC.TRNS, KC.TRNS,
        jp.QDOT, jp.TA,   jp.SA,   jp.TI,   jp.TU,   KC.TRNS, KC.TRNS
    ],

    # Layer 7: 半濁音 Layer
    [
        KC.TRNS, jp.GA,   jp.GO,   jp.PA,   jp.GU,  jp.PI,   KC.TRNS,
        KC.TRNS, jp.ZI,   jp.GE,   jp.PA,   jp.GI,  KC.TRNS, KC.TRNS,
        KC.TRNS, jp.PI,   jp.PU,   jp.PU,   jp.PE,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC_SSPC, KC.TRNS, KC.NO,  KC.TRNS, KC.TRNS,
        KC.TRNS, KC.TRNS, KC.TRNS, KC.TRNS, KC.NO,  KC.TRNS, KC.TRNS,
        KC.TRNS, jp.ZI,   jp.PE,   jp.ZO,   jp.PO,  KC.TRNS, KC.TRNS,
        jp.VU,   jp.DE,   jp.ZE,   jp.DO,   jp.PO,  KC_SENT, KC.TRNS,
        KC.QUES, jp.DA,   jp.ZA,   jp.DI,   jp.DU,  KC.BKSP, KC.BKSP
    ]
]

if __name__ == '__main__':
    Nana.go()