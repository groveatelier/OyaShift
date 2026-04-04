; Space shift for win w/ AHK (かな/変換 & SPC) 2025.3.14
;  space sc39, 変換 sc079, かな sc070, IntlYen sc7D, IntlRo sc73
;  入力モード
;      ESC - 英mode, 変換/かな+SPC or Shift+かな - 英日トグル
;      JIS　Ctl+Alt+Spc,  Alice Ctl+Alt+かな
;      Ctl+' → BS, Alt+' → Delete
InstallKeybdHook
;KeyHistory 
;ProcessSetPriority "High"
;SetWinDelay 0
SetStoreCapsLockMode False
Version := "2025.3.14"

;;  Key nor   spc   sft  opsft
kanashifttable := [
    ["g", "せ", "も", "ぜ"],  ; 1
    ["h", "は", "み", "ば", "ぱ"],
    ["b", "へ", "ぃ", "べ", "ぺ"],
    ["n", "め", "ぬ", "ぷ"],
    ["t", "さ", "れ", "ざ"],  ; 5
    ["y", "ら", "よ", "ぱ"],
    ["f", "け", "ゅ", "げ"],
    ["j", "と", "お", "ど"],
    ["v", "ふ", "や", "ぶ", "ぷ"],
    ["m", "そ", "ゆ", "ぞ"],  ; 10
    ["r", "こ", "ゃ", "ご"],
    ["u", "ち", "に", "ぢ"],
    ["d", "て", "な", "で"],
    ["k", "き", "の", "ぎ"],
    ["c", "す", "ろ", "ず"],  ; 15
    [",", "ね", "む", "ぺ"],
    ["e", "た", "り", "だ"],
    ["i", "く", "る", "ぐ"],
    ["s", "し", "あ", "じ"],
    ["l", "い", "ょ", "ぽ", "ゐ"],  ; 20
    ["x", "ひ", "ー", "び", "ぴ"],
    [".", "ほ", "わ", "ぼ", "ぽ"],
    ["w", "か", "え", "が", "ゑ"],
    ["o", "つ", "ま", "づ"],
    ["a", "う", "を", "ゔ"],  ; 25
    [";", "ん", "っ", "；"],
    ["z", "．", "ぅ", "."],
    ["/", "・", "ぉ", "／"],
    ["q", "。", "ぁ", "ぁ゙"],
    ["p", "，", "ぇ", "ぴ"],  ; 30

    ["1", "{Numpad1}",  "？", "1"],
    ["6", "{Numpad6}",  "［］", "6"],
    ["2", "{Numpad2}",  "／", "2"],
    ["7", "{Numpad7}",  "《》", "7"],
    ["3", "{Numpad3}",  "〜", "3"],  ; 35
    ["8", "{Numpad8}",  "【】", "8"],
    ["4", "{Numpad4}",  "「", "4"],
    ["9", "{Numpad9}",  "（）", "9"],
    ["5", "{Numpad5}",  "」", "5"],
    ["0", "{Numpad0}",  "、", "0"],   ; 40

    ["-", "―",  "−", "−"],
    ["[", "』", "『", "[]"],
    ["=", "｜", "＝", "￥"],
    ["]", "'", "`"", "``"]
]

kkeyTable := ["《》","：","；","”","’","＜＞",      ; Normal
              "《《》》","`"","'","<>"]             ; w/ Shift
kkIndex := 1

convKana    := [False, -1]                  ; 入力中, 先キーIndex
isSpcShift  := IME_GET() ? True : False     ; Space Shift mode
AliceKey    := True                         ; True-Alice, Falise-JIS

MsgBox "Space Shift ver. " . Version,,"T2"

;-----------------------------------------------------------
; Hot key 
;-----------------------------------------------------------
sc022:: OnKeyDownEvent( 1 ) ; g
sc023:: OnKeyDownEvent( 2 ) ; h
sc030:: OnKeyDownEvent( 3 ) ; b
sc031:: OnKeyDownEvent( 4 ) ; n
sc014:: OnKeyDownEvent( 5 ) ; t
sc015:: OnKeyDownEvent( 6 ) ; y
sc021:: OnKeyDownEvent( 7 ) ; f
sc024:: OnKeyDownEvent( 8 ) ; j
sc02F:: OnKeyDownEvent( 9 ) ; v
sc032:: OnKeyDownEvent( 10 ) ; m
sc013:: OnKeyDownEvent( 11 ) ; r
sc016:: OnKeyDownEvent( 12 ) ; u
sc020:: OnKeyDownEvent( 13 ) ; d
sc025:: OnKeyDownEvent( 14 ) ; k
sc02E:: OnKeyDownEvent( 15 ) ; c
sc033:: OnKeyDownEvent( 16 ) ; ,
sc012:: OnKeyDownEvent( 17 ) ; e
sc017:: OnKeyDownEvent( 18 ) ; i
sc01F:: OnKeyDownEvent( 19 ) ; s
sc026:: OnKeyDownEvent( 20 ) ; l
sc02D:: OnKeyDownEvent( 21 ) ; x
sc034:: OnKeyDownEvent( 22 ) ; .
sc011:: OnKeyDownEvent( 23 ) ; w
sc018:: OnKeyDownEvent( 24 ) ; o
sc01E:: OnKeyDownEvent( 25 ) ; a
sc027:: OnKeyDownEvent( 26 ) ; ;
sc02C:: OnKeyDownEvent( 27 ) ; z
sc035:: OnKeyDownEvent( 28 ) ; /
sc010:: OnKeyDownEvent( 29 ) ; q
sc019:: OnKeyDownEvent( 30 ) ; p

sc002:: OnKeyDownEvent( 31 ) ; 1
sc007:: OnKeyDownEvent( 32 ) ; 6
sc003:: OnKeyDownEvent( 33 ) ; 2
sc008:: OnKeyDownEvent( 34 ) ; 7
sc004:: OnKeyDownEvent( 35 ) ; 3
sc009:: OnKeyDownEvent( 36 ) ; 8
sc005:: OnKeyDownEvent( 37 ) ; 4
sc00A:: OnKeyDownEvent( 38 ) ; 9
sc006:: OnKeyDownEvent( 39 ) ; 5
sc00B:: OnKeyDownEvent( 40 ) ; 0

sc00C:: OnKeyDownEvent( 41 ) ; -
sc01A:: OnKeyDownEvent( 42 ) ; [
sc00D:: OnKeyDownEvent( 43 ) ; =
sc01B:: OnKeyDownEvent( 44 ) ; ]


sc022 up:: OnKeyUpEvent( 1 ) ; g
sc023 up:: OnKeyUpEvent( 2 ) ; h
sc030 up:: OnKeyUpEvent( 3 ) ; b
sc031 up:: OnKeyUpEvent( 4 ) ; n
sc014 up:: OnKeyUpEvent( 5 ) ; t
sc015 up:: OnKeyUpEvent( 6 ) ; y
sc021 up:: OnKeyUpEvent( 7 ) ; f
sc024 up:: OnKeyUpEvent( 8 ) ; j
sc02F up:: OnKeyUpEvent( 9 ) ; v
sc032 up:: OnKeyUpEvent( 10 ) ; m
sc013 up:: OnKeyUpEvent( 11 ) ; r
sc016 up:: OnKeyUpEvent( 12 ) ; u
sc020 up:: OnKeyUpEvent( 13 ) ; d
sc025 up:: OnKeyUpEvent( 14 ) ; k
sc02E up:: OnKeyUpEvent( 15 ) ; c
sc033 up:: OnKeyUpEvent( 16 ) ; ,
sc012 up:: OnKeyUpEvent( 17 ) ; e
sc017 up:: OnKeyUpEvent( 18 ) ; i
sc01F up:: OnKeyUpEvent( 19 ) ; s
sc026 up:: OnKeyUpEvent( 20 ) ; l
sc02D up:: OnKeyUpEvent( 21 ) ; x
sc034 up:: OnKeyUpEvent( 22 ) ; .
sc011 up:: OnKeyUpEvent( 23 ) ; w
sc018 up:: OnKeyUpEvent( 24 ) ; o
sc01E up:: OnKeyUpEvent( 25 ) ; a
sc027 up:: OnKeyUpEvent( 26 ) ; ;
sc02C up:: OnKeyUpEvent( 27 ) ; z
sc035 up:: OnKeyUpEvent( 28 ) ; /
sc010 up:: OnKeyUpEvent( 29 ) ; q
sc019 up:: OnKeyUpEvent( 30 ) ; p

sc002 up:: OnKeyUpEvent( 31 ) ; 1
sc007 up:: OnKeyUpEvent( 32 ) ; 6
sc003 up:: OnKeyUpEvent( 33 ) ; 2
sc008 up:: OnKeyUpEvent( 34 ) ; 7
sc004 up:: OnKeyUpEvent( 35 ) ; 3
sc009 up:: OnKeyUpEvent( 36 ) ; 8
sc005 up:: OnKeyUpEvent( 37 ) ; 4
sc00A up:: OnKeyUpEvent( 38 ) ; 9
sc006 up:: OnKeyUpEvent( 39 ) ; 5
sc00B up:: OnKeyUpEvent( 40 ) ; 0

sc00C up:: OnKeyUpEvent( 41 ) ; -
sc01A up:: OnKeyUpEvent( 42 ) ; [
sc00D up:: OnKeyUpEvent( 43 ) ; =
sc01B up:: OnKeyUpEvent( 44 ) ; ]

+sc023:: OnHankeyDown(2)
+sc030:: OnHankeyDown(3)
+sc02F:: OnHankeyDown(9)
+sc026:: OnHankeyDown(20)
+sc02D:: OnHankeyDown(21)
+sc034:: OnHankeyDown(22)
+sc011:: OnHankeyDown(23)

sc039:: OnSpcDownEvent( -4 ) ; Space
sc070::
sc079:: OnSpcDownEvent( -2 ) ; 変換
~+sc039 up::
sc039 up:: OnSpcUpEvent( -4 ) ; Space
sc070 up::
~+sc070 up::
~+sc079 up::
sc079 up:: OnSpcUpEvent( -2 ) ; 変換

~+sc022::
~+sc031::
~+sc014::
~+sc015::
~+sc021::
~+sc024::
~+sc032::
~+sc013::
~+sc016::
~+sc020::
~+sc025::
~+sc02E::
~+sc033::
~+sc012::
~+sc017::
~+sc01F::
~+sc01B::
~+sc01E::
~+sc027::
~+sc02C::
~+sc035::
~+sc010::
~+sc019:: ;;ToEiMode()
{
    global isSpcShift
    isSpcShift := False
}

;--------------
; Keyboard 切り替え
;--------------
!^sc039:: ChangeKB( False ) ; to JIS key
!^sc070:: ChangeKB( True )  ; to Alice key
!^Esc::ExitApp              ; 終了（ALT+CTRL+Esc）

ChangeKB(mode)
{
    global AliceKey
    InitialKana()
    AliceKey := mode
    if( AliceKey ){
        MsgBox "Alice mode","SS ver. " . Version,"T1"
    }
    else{
        MsgBox "JIS mode","SS ver. " . Version,"T1"
    }
}

;--------------
; 英日切り替え
;--------------
~sc001:: ToEiMode()    ; ESC

+sc070::    ; shift + KanaMode
+sc03A::    ; Shift + CapsLock
+sc001::    ; shift + ESC
+sc07B::    ; 無変換
{
    global isSpcShift
    if( isSpcShift ){ 
        ToEiMode()
    }else{
        ToKanaMode()
    }
}

ToKanaMode()
{
    global isSpcShift
    isSpcShift := True
    InitialKana()
    if( !IME_GET() ){
        IME_SET( 1 )
        Send "{Blind}{sc070}"
    }
}

ToEiMode()
{
    global isSpcShift
    isSpcShift := False
    InitialKana()
    if( IME_GET() ){
        IME_SET( 0 )
    }
}

;----------------------
;   JIS-Alice Key Event
;----------------------
KeySend(ptn)
{
    KeySendTbl := [["`\","`|"],["{Enter}","{Blind}{Enter}"],
                ["'","`""],["{BS}","{Delete}"]]
    ofs := isUSShift() ? 2 : 1
    Send KeySendTbl[ptn][ofs]
}

YenSpecial()
{
    global isSpcShift, kkeyTable, kkIndex
    if( isSpcShift ){
        if( convKana[1] ){  ; 先行キーありの場合
            kkIndex := kkIndex < 10 ? kkIndex+1 : 1
        }
        Send kkeyTable[kkIndex]
    }
    else{
        KeySend(1)  ; `\ or `|
    }
}

^sc028:: Send "{BS}"
!sc028:: Send "{Delete}"
sc028::
+sc028::
{
    global isSpcShift
    if( isSpcShift ){
        KeySend(4)  ; BS/Delete
    }
    else{
        KeySend(3)  ; '/`"
    }
}

sc02B::
+sc02B::
{
    global AliceKey
    if( AliceKey ){
        YenSpecial()
    }
    else{
        KeySend(2)  ; enter
    }
}

sc073:: Send "{TAB}"
+sc073:: Send "{Blind}{TAB}"
!sc073:: Send "{Delete}"
^sc073:: Send "{BS}"

sc07D::
+sc07D:: YenSpecial()

;-------------------------
~LButton::  ; Mouse click
{
    SetTimer IME_Check, -100
}

InitialKana(){
    global convKana
    convKana := [False, -1]
}

isUSShift(){
    Return GetKeyState("Shift", "P")
}

doUSShift( code ){
    Return (code == ".") ? ">" : StrUpper(code)
}

NoOyaCode( key ){
    global kanashifttable, isSpcShift
    code  := kanashifttable[key][1]
    if( isSpcShift ){
        code  := kanashifttable[key][2]
    }
    else if( isUSShift() ){
        code := doUSShift(code)
    }
    Return code
}

USCode( key ){
    global kanashifttable
    code := kanashifttable[key][1]
    Return isUSShift() ? doUSShift(code) : code
}

;-----------------------------------------------------------
; Key down : moji key
;-----------------------------------------------------------
OnKeyDownEvent( key ){
    global convKana, kanashifttable, isSpcShift
    if( isSpcShift ){           ; Space Shift mode
        if( !convKana[1] ){     ; 先行キーなし状態
            convKana := [True, key]
        }
        else{                   ; 先行キーあり状態
            ofs := 0
            if( -4 == convKana[2] ){        ; 右シフト
                ofs := (1 & key) ? 3 : 4
            }
            else if( -2 == convKana[2] ){   ; 左シフト
                ofs := (1 & key) ? 4 : 3
            }
            else{               ; キー連続
                Send NoOyaCode(convKana[2]) ; 1stキー確定
                convKana := [True, key]     ; 2ndキー保存
            }
            if( 0 != ofs ){
                Send kanashifttable[key][ofs]   ; 文字確定
                InitialKana()
            }
        }
    }
    else{
        Send USCode(key)         ; 文字確定 (No SpcKey mode)
        InitialKana()
    }
}

OnHanKeyDown( Key ){
    global convKana, kanashifttable, isSpcShift
    if( isSpcShift ){
        Send kanashifttable[key][5] ; 文字確定
    }
    else{
        Send doUSShift(kanashifttable[key][1]) 
    }
    InitialKana()
}

OnSpcDownEvent( key ){
    global convKana, kanashifttable, isSpcShift
;    MsgBox convKana[1] . " : " . convKana[2] . " ... " . key
    if( isSpcShift ){           ; Space Shift mode
        if( !convKana[1] ){     ; 先行キーなし状態
            convKana := [True, key]
        }
        else{                   ; 先行キーあり状態
            ofs := 0
            if(convKana[2] > 0 ){          ; 文字キー
                if( -4 == key ){
                    ofs := (1 & convKana[2]) ? 3 : 4
                }
                else{
                    ofs := (1 & convKana[2]) ? 4 : 3
                }
                if( ofs != 0 ){
                    Send kanashifttable[convKana[2]][ofs]   ; 文字確定
                    InitialKana()
                }
            }
            else ToEiMode()  ; 両親キー押下
        }
    }
    else if( -1 > convKana[2] && key != convKana[2] ){
        ToKanaMode()  ; 両親キー押下
    }else if( key == convKana[2] ){
        Send " "  ; 片親連続時
    }else{
        convKana[2] := key     ; US modeでも親シフト状態を保存
    }
}

;-----------------------------------------------------------
; Key up 
;-----------------------------------------------------------
OnKeyUpEvent( key ){
    global convKana, kanashifttable, isSpcShift
    if( convKana[1] > 0 ){      ; 未確定文字あり状態
        Send NoOyaCode( convKana[2] )
        InitialKana()
    }
}

OnSpcUpEvent( key ){
    global convKana, isSpcShift
    if( isSpcShift ){               ; Space Shift mode
        if( convKana[1] && ( convKana[2] <= 0 )){     ; 先行キーあり＆SPC
            Send "{sc039 down}"     ; Space
            Send "{sc039 up}"       ; Space
        }
    }
    else if( convKana[2] < -1 ){
        Send " " ; 空白押下保留解除
    }
    InitialKana()
}

;-----------------------------------------------------------
; IMEの状態の取得
;   戻り値          1:ON / 0:OFF
;-----------------------------------------------------------
IME_GET(){
    imehwnd := IME_GetImeHwnd()
    result := DllCall("SendMessage"
          , "UInt", imehwnd
          , "UInt", 0x0283  ;Message : WM_IME_CONTROL
          ,  "Int", 0x0005  ;wParam  : IMC_GETOPENSTATUS
          ,  "Int", 0       ;lParam  : 0
          , "CDecl Int" )
    Sleep 128
    Return result
}

IME_Check(){
    global  isSpcShift
    isSpcShift := IME_GET() ? True : False      ;; IME設定に合わせる
    SetCapsLockState False
}

IME_GetImeHwnd(){
    hwnd := 0
    Try{
        hwnd := ControlGetFocus("A")
    }
    if( hwnd == 0 ) hwnd := WinExist("A")
    if( winActive("A") ){
        ptrSize := !A_PtrSize ? 4 : A_PtrSize
        cbSize  := 4+4+( ptrSize * 6 )+16
        stGTI   := Buffer( cbSize, 0 )
        NumPut "UInt", cbSize, stGTI
        hwnd := DllCall("GetGUIThreadInfo", "UInt", 0, "UInt", stGTI.Ptr )
            ? NumGet( stGTI, 8+ptrSize, "UInt" ) : hwnd
    }
    Return DllCall("imm32\ImmGetDefaultIMEWnd", "UInt", hwnd )
}

;-----------------------------------------------------------
; IMEの状態をセット
;   SetSts          1:ON / 0:OFF
;   戻り値          0:成功 / 0以外:失敗
;-----------------------------------------------------------
IME_SET( SetSts ){
    imehwnd := IME_GetImeHwnd()
    result := DllCall("SendMessage"
          , "UInt", imehwnd
          , "UInt", 0x0283  ;Message : WM_IME_CONTROL
          ,  "Int", 0x006   ;wParam  : IMC_SETOPENSTATUS
          ,  "Int", SetSts) ;lParam  : 0 or 1
    Sleep 128
    Return result
}