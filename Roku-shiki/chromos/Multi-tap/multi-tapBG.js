/*  2026.05.04 19:00
  Multi-tap keyboard ver 5.0 (JISキーボード用)
  日英切り替え: Alt-Left -> US, Alt-Right -> 日
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js");

const kanashifttable = [
   /*Key  単    左+   右+ */
    [" ", " ", "", ""],
    ["g", "せ", "も", "ぜ"],
    ["h", "は", "ば", "み"],
    ["b", "へ", "ぃ", "べ"],
    ["n", "め", "ぬ", "ぷ"],
    ["t", "さ", "れ", "ざ"],
    ["y", "ら", "よ", "ぱ"],
    ["f", "け", "ゅ", "げ"],
    ["j", "と", "お", "ど"],
    ["v", "ふ", "や", "ぶ"],
    ["m", "そ", "ゆ", "ぞ"],
    ["r", "こ", "ゃ", "ご"],
    ["u", "ち", "に", "ぢ"],
    ["d", "て", "な", "で"],
    ["k", "き", "の", "ぎ"],
    ["c", "す", "ろ", "ず"],
    [",", "ね", "む", "ぺ"],
    ["e", "た", "り", "だ"],
    ["i", "く", "る", "ぐ"],
    ["s", "し", "あ", "じ"],
    ["l", "い", "ょ", "ぽ"],
    ["x", "ひ", "ー", "び"],
    [".", "ほ", "わ", "ぼ"],
    ["w", "か", "え", "が"],
    ["o", "つ", "ま", "づ"],
    ["a", "う", "を", "ゔ"],
    [";", "ん", "っ", "："],
    ["z", "．", "ぅ", "."],
    ["/", "・", "ぉ", "／"],
    ["q", "。", "ぁ", "ぁ゙"],
    ["p", "，", "ぇ", "ぴ"],

    ["`", "‘", "’", "かっこ"],      /* US配列に合わせる*/
    ["1", "1", "一", "ф"],
    ["6", "6", "六", "［］"],
    ["2", "2", "二", "〇"],
    ["7", "7", "七", "《》"],
    ["3", "3", "三", "§"],
    ["8", "8", "八", "【】"],
    ["4", "4", "四", "「"],
    ["9", "9", "九", "※"],
    ["5", "5", "五", "」"],
    ["0", "0", "０", "、"],

    ["-", "-", "±", "√"],
    ["=", "=", "×", "÷"],
    ["[", "』", "《《》》", "『"],
    ["\\", "￥","くりかえし","＼"],
    ["]", "]", "}","{"],
    ["Ro","", "",  ""]
];

const engine   = "MultiTap";
let keylimit = 0;           // Time shift limit.
let kanaoffset = 1;         // かな変換offset量

OpenNiwaDict();             // local辞書を開けておく.
InitialCandidate();         // cCandidateの初期化.
LoadCacheDict();            // Cache Dataのロード.

const KeyState = Object.freeze({ Expire:1600, Single:800, Tap0:0, Tap1:1, Tap2:2 });  // 多重キーの状態定数.

function SetTimeKeyLimit(){
    keylimit = Date.now() + KeyState.Expire;
}

function IsTimeShift(){
    let nowtime = Date.now();
    if( nowtime > keylimit ) return KeyState.Tap0;    // 時間切れ
    else if( nowtime > keylimit - KeyState.Single ) return KeyState.Tap2;
    return KeyState.Tap1;
}

// SS keyUp event
function SSKeyUp(engineID, keyData){
    console.log(`+kU:${convKana}/${keyData.key}:${insidebuf.length}`);
    if( keycondition < 1024 ){
        if( convKana[2] === " " ) UndoConvert( true );  // 変換候補確定とか
        else if( convKana[1] === 2 && convKana[2] === "" ) changeAndClear();  // US Mode
////        else if( convKana[0] ){
//        else if( convKana[0] && kanashifttable[convKana[1]][0] === keyData.key ) {
//            keyValidiate();         // 他のキーがあれば確定.
//        }
    } else if( convKana[1] === 102 && convKana[2] === "" ) changeAndClear();    // 日モード
    //InitialKana();      // convKanaの初期化.
}

// US keyDown event
function USKeyDown( keyData ){
    //console.log(`UKD:${keyData.code}/${keyData.shiftKey}`);
    let enact = false;
    if( !keyData.shiftKey && !keyData.ctrlKey ){
        if( keyData.code === "AltRight" ){
            convKana = [false,102,''];   // SSKeyUp で日本語モード
        }
        else convKana[1] = -1;
    }
    return enact;
}

//  Key Down時に呼び出される.
function thumbShift(keyData){
    let action   = false;
    let lkey     = "";
    let keyinx   = -1;

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        lkey = keyData.key.toLowerCase();   // 小文字検索の為
        keyinx = GetKanaIndex( lkey );
        //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);
        if( keyinx === 0 ){ 
            action = setConvKanaDownSpc();    // SPCのときは、タップ時間初期化処理.
        }
        else if( keyinx > 0 ){
            action = true;
            setConvKanaDownKey( keyinx, (keyData.shiftKey) );   // convKana 設定：key.
        } 
    }
    return action;
}

//  Key押下時の convKana 設定. 
function setConvKanaDownKey( keyinx, keyshift ){
    let keystate = IsTimeShift();
    console.log(`KY:(${keyinx})${convKana}/${keyshift}/${keystate}`);

    // Shift keyが押下されていないことを確認
    if( !keyshift ){
        // Multi-tap の制限時間以内の場合
        if( keystate !== KeyState.Tap0 ){
            if( convKana[1] === keyinx ){
                // 同一キーの多重押しの時は、入力キーを変える.
                kanaoffset = ( kanaoffset + 1 ) % 4;    //文字オフセット変更
                BackOne();  // 直前の文字を消す処理.
            }
            else {
                // 別のキーが押されたとき
                kanaoffset = 1;  // 新押鍵.
            }
        }
        else {
            // Multi-tap の制限時間を過ぎている場合は、通常のキー入力とする.
            kanaoffset = 1;  // 新押鍵.
        }
        // convKana の文字確定設定.
        convKana = [false, keyinx, kanashifttable[keyinx][kanaoffset]];
    }
    else {
        // Shift keyが押下されている場合は、英大文字とする.
        convKana = [false, keyinx, kanashifttable[keyinx][0].toUpperCase()];    // 大文字
        kanaoffset = 0;     // US大文字.
    }
    SetTimeKeyLimit();  // タイムシフトの時間制限をセット.
}

//  SPC押下時の convKana 設定. 
function setConvKanaDownSpc(){
    let action = true;
    if( convKana[0] ){              // 2nd 以降を判断.
        keylimit = Date.now();
    } 
    else {    // ここは初回 Key.
        convKana = [true, 0, " "];  // 単なるSPC
        action = false;
    }
    return action;
}
  
