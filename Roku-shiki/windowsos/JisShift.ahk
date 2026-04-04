; JIS key Space shift for win w/ AHK (sc073 & sc07D) 2026.2.20
;  IntlYen sc7D, IntlRo sc73, JIS sc2b, 無変換 sc7b, 変換 sc079, かな sc070 
;  入力モード
;      07D L-Oya : 073 R-Oya
;      sc073+sc07d, Shift+Caps - 英日トグル
;      Numlock - 一行英文字入力
;
InstallKeybdHook
;KeyHistory
;ProcessSetPriority "High"
;SetWinDelay 0
SetStoreCapsLockMode False
Version := "2026.2.20"

;;  Key nor   spc   sft  opsft
kanashifttable := [
    ["g", "せ", "も", "ぜ"],  ; 1
    ["h", "は", "み", "ば"],
    ["b", "へ", "ぃ", "べ"],
    ["n", "め", "ぬ", "ぷ"],
    ["t", "さ", "れ", "ざ"],  ; 5
    ["y", "ら", "よ", "ぱ"],
    ["f", "け", "ゅ", "げ"],
    ["j", "と", "お", "ど"],
    ["v", "ふ", "や", "ぶ"],
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
    ["l", "い", "ょ", "ぽ"],  ; 20
    ["x", "ひ", "ー", "び"],
    [".", "ほ", "わ", "ぼ"],
    ["w", "か", "え", "が"],
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
isUseUskey  := False    ; 一時USキー入力モード

MsgBox "JIS Key Shift ver. " . Version,,"T2"

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

sc073:: OnSpcDownEvent( -2 ) ; Ro
sc07D:: OnSpcDownEvent( -4 ) ; JIS
sc073 up::
sc07D up:: InitialKana() ; JIS

; 半濁音
!h:: SendHandakuon("ぱ")
!x:: SendHandakuon("ぴ")
!v:: SendHandakuon("ぷ")
!b:: SendHandakuon("ぺ")
!.:: SendHandakuon("ぽ")
!l:: SendHandakuon("ゐ")
!w:: SendHandakuon("ゑ")

;--------------
; 特殊 SC
;--------------
!^Esc::ExitApp              ; 終了（ALT+CTRL+Esc）
!^sc029:: MsgBox "JIS Key Shift ver. " . Version ; Version (ALT+CTRL+\`)

;--------------
; 英日切り替え
;--------------
+sc145::    ; Shift + Numlock
+sc03A::    ; Shift + CapsLock
+sc07D::    ; shift + JIS
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
    global isSpcShift, isUseUskey
    isSpcShift := True
    isUseUskey := False
    InitialKana()
    if( !IME_GET() ){
        IME_SET( 1 )
    }
    SetNumLockState True
}

ToEiMode()
{
    global isSpcShift
    isSpcShift := False
    InitialKana()
    if( IME_GET() ){
        IME_SET( 0 )
    }
    SetNumLockState False
}

sc145:: ; Numlock(一行英入力)
{
    global isUseUskey
    ToEiMode()
    isUseUskey := True
}

sc01C:: ; Enter 一行英解除
{
    global isUseUskey
    if( isUseUskey ){
        ToKanaMode()
    }
    else{
        Send "{Enter}"
    }
}

;----------------------
;   JIS-Alice Key Event
;----------------------
sc02B::
+sc02B::
{
    global isSpcShift, kkeyTable, kkIndex, convKana
    if( isSpcShift ){
        if( convKana[1] ){  ; 先行キーありの場合
            kkIndex := kkIndex < 10 ? kkIndex+1 : 1
        }
        Send kkeyTable[kkIndex]
    }
    else{
        Send "{Blind}`\"
    }
}

sc01B::
+sc01B::
{
    global isSpcShift
    if( isSpcShift ){
        Send "{BS}"
    }
    else{
        Send "{Blind}`]"
    }
}

;-------------------------
~LButton::  ; Mouse click
{
    SetTimer IME_Check, -100
}

InitialKana(){
    global convKana
    convKana := [False, -1]
}

SendNoOyaCode( key ){
    global kanashifttable, isSpcShift
    if( isSpcShift ){
        Send kanashifttable[key][2]
    }
    else{
        Send "{Blind}"
        Send kanashifttable[key][1]
    }
}

SendHandakuon( key ){
    global isSpcShift
    if( isSpcShift ){
        Send key
    }
    else{
        Send "{Blind}{Blind}"
    }
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
                SendNoOyaCode(convKana[2])  ; 1stキー確定
                convKana := [True, key]     ; 2ndキー保存
            }
            if( 0 != ofs ){
                Send kanashifttable[key][ofs]   ; 文字確定
                InitialKana()
            }
        }
    }
    else{
        Send "{Blind}"  ; 文字確定 (No SpcKey mode)
        Send kanashifttable[key][1]
        InitialKana()
    }
}

OnSpcDownEvent( key ){
    global convKana, kanashifttable, isSpcShift
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
    }
    else convKana[2] := key     ; US modeでも親シフト状態を保存
}

;-----------------------------------------------------------
; Key up 
;-----------------------------------------------------------
OnKeyUpEvent( key ){
    global convKana
    if( convKana[1] > 0 ){      ; 未確定文字あり状態
        SendNoOyaCode( convKana[2] )
        InitialKana()
    }
}

;-----------------------------------------------------------
; IMEの状態の取得
;   戻り値          1:ON / 0:OFF
;-----------------------------------------------------------
IME_GET(){
    imehwnd := IME_GetImeHwnd()
    if( !imehwnd )
        return 0

    return DllCall("user32\SendMessageW"
          , "Ptr", imehwnd
          , "UInt", 0x0283 ;Message : WM_IME_CONTROL
          , "UPtr", 0x0005 ;wParam  : IMC_GETOPENSTATUS
          , "Ptr", 0       ;lParam  : 0
          , "Int" )
}

IME_Check(){
    global  isSpcShift
    isSpcShift := IME_GET() ? True : False      ;; IME設定に合わせる
    SetCapsLockState False
}

IME_GetImeHwnd(){
    hwnd := 0

    ; まずフォーカス中コントロールのHWNDを受け取る
    try{
        focusedCtrl := ControlGetFocus("A") ; これはClassNN文字列
        if( focusedCtrl != "" )
            hwnd := ControlGetHwnd(focusedCtrl, "A")
    }

    ; 取れなければアクティブウィンドウ
    if( !hwnd )
        hwnd := winActive("A")
    if( !hwnd )
        return 0
    
    ; GUIThreadInfoでfocis hwndを補正
    if( WinActive("A") ){
        ptrSize := A_PtrSize
        cbSize  := 4 + 4 + (ptrSize * 6) + 16
        stGTI   := Buffer( cbSize, 0 )
        NumPut("UInt", cbSize, stGTI, 0)

        if DllCall("user32\GetGUIThreadInfo", "UInt", 0, "Ptr", stGTI.Ptr, "Int"){
            hwndFocus := NumGet(stGTI, 8 + ptrSize, "Ptr")
            if( hwndFocus )
                hwnd := hwndFocus
        }
    }
    return DllCall("imm32\ImmGetDefaultIMEWnd", "Ptr", hwnd, "Ptr")
}

;-----------------------------------------------------------
; IMEの状態をセット
;   SetSts          1:ON / 0:OFF
;   戻り値          0:成功 / 0以外:失敗
;-----------------------------------------------------------
IME_SET( SetSts ){
    target := SetSts ? 1 : 0
    imehwnd := IME_GetImeHwnd()
    if( !imehwnd )
        return -1

    DllCall("user32\SendMessageW"
        , "Ptr", imehwnd
        , "UInt", 0x0283    ; WM_IMD_CONTROL
        , "UPtr", 0x0006    ; IMC_SETOPENSTATUS
        , "Ptr", target
        , "Ptr" )
    Sleep 20

    ; 1回目で反映されなければ1回再送
    if( IME_GET() != target ){
        DllCall("user32\SendMessageW"
            , "Ptr", imehwnd
            , "UInt", 0x0283    ; WM_IMD_CONTROL
            , "UPtr", 0x0006    ; IMC_SETOPENSTATUS
            , "Ptr", target
            , "Ptr" )
        Sleep 20
    }
    Return IME_GET() == target ? 0 : 1
}