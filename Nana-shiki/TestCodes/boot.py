import board
import digitalio
import storage
import time

# OS switch は GP15に接続
# LOW (GND接続) ＝ Windows OS / HIGH (オープン) ＝ Chrome OS
os_switch = digitalio.DigitalInOut(board.GP15)
os_switch.direction = digitalio.Direction.INPUT
os_switch.pull = digitalio.Pull.UP

time.sleep(0.05)

# Windowsの場合はストレージ (CIRCUITPY ドライブ) を非表示
if not os_switch.value:
    storage.disable_usb_drive()