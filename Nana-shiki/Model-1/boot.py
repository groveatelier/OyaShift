import board
import digitalio
import storage
import time

# Boost SW は GP16に接続
# LOW (GND接続) ＝ Boost / HIGH (オープン) ＝ Normal
boost_sw = digitalio.DigitalInOut(board.GP16)
boost_sw.direction = digitalio.Direction.INPUT
boost_sw.pull = digitalio.Pull.UP

time.sleep(0.05)

# Boost SW オープンの場合はストレージ (CIRCUITPY ドライブ) を非表示
if boost_sw.value:
    storage.disable_usb_drive()