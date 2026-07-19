#Requires AutoHotKey v2.0
; 1Fx key Space shift for win w/ AHK (1F1 & 1F2) 2026.7.19
;  IntlYen sc7D, IntlRo sc73, JIS sc2b, 無変換 sc7b, 変換 sc079, かな sc070 
;  入力モード
;      1F1(07D) L-Oya : 1F2(073) R-Oya
;      1F1+1F2 - 英日トグル, shift+1F1 - 英数, shift+1F2 ‐ 日本語
;
InstallKeybdHook
;KeyHistory
;ProcessSetPriority "High"
;SetWinDelay 0
SetStoreCapsLockMode False
Script := "OneFx Key Shift ver. "
Version := "2026.7.19"

;  通常 左 右 NumPad 右英
kanatbl := [
    ["‘","kakko","’"],
    ["", "", "!``"], ; 1F1(左)
    ["", "!``", ""], ; 1F1(右)
    ["{Numpad1}", "ф", "1"],
    ["{Numpad2}", "〇", "2"], ;5
    ["{Numpad3}", "§", "3"],
    ["{Numpad4}", "「", "4"],
    ["{Numpad5}", "」", "5"],
    ["{Numpad6}", "6", "［］"],
    ["{Numpad7}", "7", "《》"], ;10
    ["{Numpad8}", "8", "【】"],
    ["{Numpad9}", "9", "※"],
    ["{Numpad0}", "0", "、", "{NumpadMult}","0","{Esc}"],
    ["-","√","±"],
    ["=", "×", "÷"], ;15

    ["。", "la", "ぁ゙"],
    ["ka", "e", "ga"],
    ["ta", "ri", "da"],
    ["ko", "xya", "go"],
    ["sa", "re", "za"], ;20
    ["ra", "pa", "yo"],
    ["ti", "di", "ni", "{Numpad4}","u","_"],
    ["ku", "gu", "ru", "{Numpad5}","i","{!}"],
    ["tu", "du", "ma", "{Numpad6}","o","~"],
    ["，", "pi", "le", "{NumpadSub}","p","-"], ;25
    ["』","《《》》","『"],
    ["{BS}", "{}}","{{}"],
    ["￥","kurikaesi","＼"],

    ["u", "wo", "vu"],
    ["si", "a", "ji"], ;30
    ["te", "na", "de"],
    ["ke", "xyu", "ge"],
    ["se", "mo", "ze"],
    ["ha", "ba", "mi"],
    ["to", "do", "o", "{Numpad1}","j","="], ;35
    ["ki", "gi", "no", "{Numpad2}","k","#c"],
    ["i", "po", "xyo", "{Numpad3}","l","{*}"],
    ["nn", "；", "xtu", "{NumpadAdd}",";","{+}"],
    ["′","kigou","“”"],

    ["．", "lu", "."], ;40
    ["hi", "-", "bi"],
    ["su", "ro", "zu"],
    ["fu", "ya", "bu"],
    ["he", "xi", "be"],
    ["me", "pu", "nu"], ;45
    ["so", "zo", "yu"],
    ["ne", "pe", "mu", "{Numpad0}",",","00"],
    ["ho", "bo", "wa"],
    ["・", "／", "lo", "{NumpadDiv}","/","000"],

    ["{Up}","↑","↑"], ;50
    ["{Left}","←","←"],
    ["{Down}","↓","↓"],
    ["{Right}","→","→"]
]

MsgBox Script . Version,,"T2"
preKey := -1
noCand := True ; 変換候補があるかの仮判定

; 特殊キー
SpecialKey( key ){
    global preKey
    sskey := ["_","{+}","|",":","″","~","{Del}"]
    Send sskey[key]
    preKey := -1
}

; 看板関数
ShowToast(text, colormode) {
    ; --- GUI 作成 ---
    agui := Gui("-Caption +AlwaysOnTop +ToolWindow +E0x08000000")
    if( colormode ){
        agui.BackColor := "183618"  ; 深い森の影色
    } 
    else {
       agui.BackColor := "641818"          ; 赤濃いめ
    }
    agui.SetFont("s24 cFFDFA8")         ; 琥珀色の文字（六式の雰囲気）
    agui.MarginX := 20
    agui.MarginY := 15
    agui.Add("Text", "Center w160", text)

    ; --- 画面中央下に固定表示 ---
    x := (A_ScreenWidth - 160) / 2
    y := A_ScreenHeight / 2 + 128
    agui.Show("NA AutoSize x" x " y" y)

    ; --- 透明化を有効にする（WS_EX_LAYERED を追加） ---
    ex := WinGetExStyle(agui.Hwnd)
    WinSetExStyle(ex | 0x00080000, agui.Hwnd)
    WinSetTransparent(170, agui.Hwnd)

    ; --- 角丸（DWM）---
    try DllCall("dwmapi\DwmSetWindowAttribute"
        , "ptr", agui.Hwnd
        , "int", 33                ; DWMWA_WINDOW_CORNER_PREFERENCE
        , "int*", 2                ; 2 = rounded
        , "int", 4)

    SetTimer(() => agui.Destroy(), -800)
}

; 英日切り替え
ToUSMode()
{
    global noCand
    if( IME_GET() ){
        ShowToast("A", False) ; 赤背景
        if( !noCand ){
            noCand := True
            Send "{Enter}"
        }
        IME_TOGGLE()
    }
    else{
        SetTimer IME_LED, -333
    }
}

ToJPMode()
{
    global noCand
    noCand := True
    if( !IME_GET() ){
        ShowToast("あ", True) ; 緑背景
        IME_TOGGLE()
    }
}

;-----------------------------------------------------------
; Key down : moji key
;-----------------------------------------------------------
IsPreOya(){
    global preKey
    return ( preKey == 2 or preKey == 3 )
}

OnOyaDown( key ){
    global preKey, kanatbl
    if( preKey < 0 ){ ; 先行キーなし
        preKey := key
    }
    else if( preKey == 2 ){
        ToJPMode()
    }
    else if( preKey == 3 ){
        ToUSMode()
    }
    else{   ; 先行キーあり
        Send kanatbl[preKey][key] ; キー確定
        preKey := -1
    }
}

OnKeyDown( key ){
    global preKey, kanatbl
    if( preKey < 0 ){ ; 先行キーなし状態
        preKey := key
    }
    else{   ; 先行キーあり状態
        if( IsPreOya() ){ ; 親キー
            Send  kanatbl[key][preKey] ; 文字確定
            preKey := -1
        }
        else{ ; 一般キー
            Send kanatbl[preKey][1] ; 1stキー確定
            preKey := key ; 2ndキー保存
        }
    }
}

OnNumDown( key ){
    global kanatbl, preKey
    if( GetKeyState("NumLock", "T") ){
        Send kanatbl[key][4] ; 10キーモード確定
        preKey := -1
    }
    else{
        if( IME_GET() ){
            OnKeyDown( key ) ; かな入力
        }
        else{
            if( IsPreOya() ){
                Send kanatbl[key][6] ; 親US
            }
            else{
                Send kanatbl[key][5] ; US入力
                preKey := -1
            }
        }
    }
}

;-----------------------------------------------------------
; Key up 
;-----------------------------------------------------------
OnKeyUp(){
    global preKey, kanatbl, noCand
    noCand := false
    if( preKey > 0 ){      ; 未確定文字あり状態
        Send kanatbl[preKey][1]
        if( preKey == 2 ){ ;左親
            noCand := True
;            ToUSMode()
        }
;        else if( preKey == 3 ){ ;右親
;            ToJPMode()
;        }
        preKey := -1
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

; 変換候補表示中か判断　←　これが上手く動いてくれないコメントアウト
;IsComposing() {
;    imehwnd := IME_GetImeHwnd()
;    if !imehwnd
;        return false
;    hIMC := DllCall("imm32\ImmGetContext", "ptr", imehwnd, "ptr")
;    if !hIMC
;        return false
;    size := DllCall("imm32\ImmGetCompositionStringW"
;        , "ptr", hIMC
;        , "uint", 0x0008  ; GCS_COMPSTR
;        , "ptr", 0
;        , "uint", 0)
;    DllCall("imm32\ImmReleaseContext", "ptr", imehwnd, "ptr", hIMC)
;    return size > 0 
;}

IME_LED(){
    if( IME_GET() ){
        SetScrollLockState True
    }
    else{
        SetScrollLockState False
    }
}

IME_TOGGLE(){
    Send "!``"
    SetTimer IME_LED, -555
}

IME_Hiragana(){
    Send "^{sc03A}" ; Ctrl+CapsLock
}

;-----------------------------------------------------------
; Hot key 
;-----------------------------------------------------------
sc07D::
sc1F1:: OnOyaDown( 2 ) ; 親左
sc073::
sc1F2:: OnOyaDown( 3 ) ; 親右

#HotIf IME_GET()
sc029:: OnKeyDown( 1 ) ; `
sc002:: OnKeyDown( 4 ) ; 1
sc003:: OnKeyDown( 5 ) ; 2
sc004:: OnKeyDown( 6 ) ; 3
sc005:: OnKeyDown( 7 ) ; 4
sc006:: OnKeyDown( 8 ) ; 5
sc007:: OnKeyDown( 9 ) ; 6
sc008:: OnKeyDown( 10 ) ; 7
sc009:: OnKeyDown( 11 ) ; 8
sc00A:: OnKeyDown( 12 ) ; 9
; 0-10key
sc00C:: OnKeyDown( 14 ) ; -
sc00D:: OnKeyDown( 15 ) ; =

sc010:: OnKeyDown( 16 ) ; q
sc011:: OnKeyDown( 17 ) ; w
sc012:: OnKeyDown( 18 ) ; e
sc013:: OnKeyDown( 19 ) ; r
sc014:: OnKeyDown( 20 ) ; t
sc015:: OnKeyDown( 21 ) ; y
; uiop-10key
sc01A:: OnKeyDown( 26 ) ; [
sc01B:: OnKeyDown( 27 ) ; ]
sc02B:: OnKeyDown( 28 ) ; \

sc01E:: OnKeyDown( 29 ) ; a
sc01F:: OnKeyDown( 30 ) ; s
sc020:: OnKeyDown( 31 ) ; d
sc021:: OnKeyDown( 32 ) ; f
sc022:: OnKeyDown( 33 ) ; g
sc023:: OnKeyDown( 34 ) ; h
; jkl;-10key
sc028:: OnKeyDown( 39 ) ; '

sc02C:: OnKeyDown( 40 ) ; z
sc02D:: OnKeyDown( 41 ) ; x
sc02E:: OnKeyDown( 42 ) ; c
sc02F:: OnKeyDown( 43 ) ; v
sc030:: OnKeyDown( 44 ) ; b
sc031:: OnKeyDown( 45 ) ; n
sc032:: OnKeyDown( 46 ) ; m
; ,-10key
sc034:: OnKeyDown( 48 ) ; .
; /-10key

sc148:: OnKeyDown( 50 ) ; Up
sc14B:: OnKeyDown( 51 ) ; Left
sc150:: OnKeyDown( 52 ) ; Down
sc14D:: OnKeyDown( 53 ) ; Right

sc029 up::
sc002 up::
sc003 up::
sc004 up::
sc005 up::
sc006 up::
sc007 up::
sc008 up::
sc009 up::
sc00A up::
sc00C up::
sc00D up::

sc010 up::
sc011 up::
sc012 up::
sc013 up::
sc014 up::
sc015 up::
sc01A up::
sc01B up::
sc02B up::

sc01E up::
sc01F up::
sc020 up::
sc021 up::
sc022 up::
sc023 up::
sc028 up::

sc02C up::
sc02D up::
sc02E up::
sc02F up::
sc030 up::
sc031 up::
sc032 up::
sc034 up::

sc148 up::
sc14B up::
sc150 up::
sc14D up:: OnKeyUp()

+sc1F1:: IME_Hiragana()

;----------------------
;   Special Key Event
;----------------------
+sc00C:: SpecialKey(1) ; -
+sc00D:: SpecialKey(2) ; =
+sc02B:: SpecialKey(3) ; \
+sc027:: SpecialKey(4) ; ;
+sc028:: SpecialKey(5) ; '
+sc029:: SpecialKey(6) ; `
+sc01B:: SpecialKey(7) ; ]
#HotIf

; 10キーモード用
sc00B:: OnNumDown(13) ; 0
sc016:: OnNumDown(22) ; u
sc017:: OnNumDown(23) ; i
sc018:: OnNumDown(24) ; o
sc019:: OnNumDown(25) ; p
sc024:: OnNumDown(35) ; j
sc025:: OnNumDown(36) ; k
sc026:: OnNumDown(37) ; l
sc027:: OnNumDown(38) ; ;
sc033:: OnNumDown(47) ; ,
sc035:: OnNumDown(49) ; /

sc00B up::
sc016 up::
sc017 up::
sc018 up::
sc019 up::
sc024 up::
sc025 up::
sc026 up::
sc027 up::
sc033 up::
sc035 up::

sc07D up::
sc073 up::
sc1F1 up::
sc1F2 up:: OnKeyUp()

~Delete::
~Enter::
~ESC::
~BS::
{
    global noCand
    noCand := True
}

;--------------
; 特殊 SC
;--------------
!^Esc::ExitApp              ; 終了（ALT+CTRL+Esc）
!^sc029:: MsgBox Script . Version ; Version (ALT+CTRL+\`)

; Test code 260312
;!sc148:: MouseMove 0, -16, , "R"
;!sc14B:: MouseMove -16, 0, , "R"
;!sc14D:: MouseMove 16, 0, , "R"
;!sc150:: MouseMove 0, 16, , "R"
;!sc147:: MouseClick "Left"

