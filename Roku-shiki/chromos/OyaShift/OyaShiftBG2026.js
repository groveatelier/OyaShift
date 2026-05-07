/*  2026.05.07 14:00
  Oya Key shift keyboard ver 5.0 (自作キーボード用)
    日英切り替え: IntlYen+IntlRo, Shift + かな, Shift + Esc
        US 左親Key単独, 日 右親Key単独
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js");

const kanashifttable = [
   /*Key  単    左+   右+ */
    ["g", "せ", "も", "ぜ"],
    ["h", "は", "ば", "み"],
    ["Lang2", "", "", ""],
    ["Lang1", "", "", ""],
    ["b", "へ", "ぃ", "べ"],
    ["n", "め", "ぷ", "ぬ"],
    ["t", "さ", "れ", "ざ"],
    ["y", "ら", "ぱ", "よ"],
    ["f", "け", "ゅ", "げ"],
    ["j", "と", "ど", "お"],
    ["v", "ふ", "や", "ぶ"],
    ["m", "そ", "ぞ", "ゆ"],
    ["r", "こ", "ゃ", "ご"],
    ["u", "ち", "ぢ", "に"],
    ["d", "て", "な", "で"],
    ["k", "き", "ぎ", "の"],
    ["c", "す", "ろ", "ず"],
    [",", "ね", "ぺ", "む"],
    ["e", "た", "り", "だ"],
    ["i", "く", "ぐ", "る"],
    ["s", "し", "あ", "じ"],
    ["l", "い", "ぽ", "ょ"],
    ["x", "ひ", "ー", "び"],
    [".", "ほ", "ぼ", "わ"],
    ["w", "か", "え", "が"],
    ["o", "つ", "づ", "ま"],
    ["a", "う", "を", "ゔ"],
    [";", "ん", "：", "っ"],
    ["z", "．", "ぅ", "."],
    ["/", "・", "／", "ぉ"],
    ["q", "。", "ぁ", "ぁ゙"],
    ["p", "，", "ぴ", "ぇ"],

    ["`", "‘",  "かっこ", "’"],      /* US配列に合わせる*/
    ["1", "1",  "ф", "一"],
    ["6", "6",  "六", "［］"],
    ["2", "2",  "〇", "二"],
    ["7", "7",  "七", "《》"],
    ["3", "3",  "§", "三"],
    ["8", "8",  "八", "【】"],
    ["4", "4",  "「", "四"],
    ["9", "9",  "九", "※"],
    ["5", "5",  "」", "五"],
    ["0", "0",  "０", "、"],

    ["-", "-", "√", "±"],
    ["=", "=", "×", "÷"],
    ["[", "』", "《《》》", "『"],
    ["\\", "￥","くりかえし","＼"],
    ["]", "]", "}","{"],
    ["Ro","", " ",  " "]
];

//  下のテーブルは小文字変換できない文字用. シフト判断は不要?
const keyShiftKeyTable = [
    "!@#$%^&*()_+{:<>?",
    "1234567890-=[;,./\'"
];

// chromebook キー入力 覚書.
/*        -^@[;:],./
!@#$%^&*()_+{}:"|<>?
1234567890-=[];'\,./ 
--
 IntlRo "\", "_"
 IntlYen "¥", "|"

*/

const engine   = "OyaShift";

//  SPC押下時の convKana 設定. 
function setConvKanaDownSpc( keyofs ){
    if( convKana[0] ){              // 2nd 以降を判断.
        if( convKana[1] >= 0 ){     // 2nd以降の SPC入力.
            convKana[2] = kanashifttable[convKana[1]][keyofs];  // 上キー or 濁音.
            convKana[0] = false;    // Validさせる.
        }
    } 
    else {    // ここは初回 Key.
        convKana = [true, keyofs, ""]; // 親キーinx
    }
}
  
//  Key押下時の convKana 設定. 
function setConvKanaDownKey( keyinx, keyshift ){
//    console.log(`KY:(${kinx})${convKana}/${keyshift}`);
    if( convKana[0] ){
        if( convKana[1] == 2 || convKana[1] == 3 ){  //  1st が SPC入力の場合.
            convKana[0] = false;
            convKana[2] = kanashifttable[keyinx][convKana[1]];
        } 
        else{                   // 多重キーの場合.
            keyValidiate();     // 1st Key確定.
            convKana = [true, keyinx, kanashifttable[keyinx][1]];  // 2nd Key保留.
        }
    }
    else{
        convKana = [true, keyinx, kanashifttable[keyinx][1]];  // ここは初回入力の時.
        if( keyshift ){         // shift key押下.
            convKana[2] = convKana[2].toUpperCase();    // 大文字
            convKana[0] = false;    // 確定.
        }
    }
}

//  Key Down時に呼び出される.
function thumbShift(keyData){
    var action   = false;
    var lkey     = "";
    var keyinx   = -1;

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( keyData.code == "Lang1" || keyData.code == "IntlRo" ){
            keyinx = 3;
        } else if( keyData.code == "Lang2" || keyData.code == "IntlYen" ){
            keyinx = 2;
        } else {
            lkey = keyData.key.toLowerCase();   // 小文字検索の為
            keyinx = GetKanaIndex( lkey );
        }
        //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);

        if( keyinx >= 0 ){
            action = true;
            if( keyinx == 2 || keyinx == 3 ){   // 親キー押下
                setConvKanaDownSpc( keyinx );   // convKana 設定：SPC.
            } else {                            // 通常キー入力
                setConvKanaDownKey( keyinx, (keyData.shiftKey) );   // convKana 設定：key.
            }
        } 
    }
    return action;
}

// US keyDown event
function USKeyDown( keyData ){
    //console.log(`UKD:${keyData.code}/${keyData.shiftKey}`);
    enact = false;
    // No shift + 親キー確認
    if( !keyData.shiftKey ){
        if( keyData.code == "Lang1" || keyData.code == "IntlRo" ){
            enact = true;
            convKana = [false,3,''];   // SSKeyUp で日本語モード
        }
        else if( keyData.code == "Lang2" || keyData.code == "IntlYen" ){
            enact = true;
            convKana = [false,2,''];   // Just a mark
        }
        else convKana[1] = -1;
    }
    return enact;
}

// SS keyUp event
function SSKeyUp(engineID, keyData){
    //console.log(`+kU:${convKana}/${keyData.key}:${insidebuf.length}`);
    if( keycondition < 1024 ){
        if( convKana[2] == " " ) UndoConvert( true );  // 変換候補確定とか
        else if( convKana[1] == 2 && convKana[2] == "" ) changeAndClear();  // US Mode
        else if( convKana[0] ) keyValidiate();         // 他のキーがあれば確定.
    } else if( convKana[1] == 3 && convKana[2] == "" ) changeAndClear();    // 日モード
    InitialKana();      // convKanaの初期化.
}
