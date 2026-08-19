import board
import digitalio
import microcontroller
import storage

# YD-RP2040 USRボタン GPIO24
usr_btn = digitalio.DigitalInOut(microcontroller.pin.GPIO24)
usr_btn.direction = digitalio.Direction.INPUT
usr_btn.pull = digitalio.Pull.UP

# スイッチが High(非押) の場合はストレージ (CIRCUITPY ドライブ) を非表示
if usr_btn.value:
    storage.disable_usb_drive()