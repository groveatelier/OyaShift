/*  2026.05.19 18:00
  親指シフトキーボードIME ver 5.2 (JISキーボード用)
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/
const engine   = "GranShift";

importScripts("RokushikiIME.js");

class KeyInformation{
    constructor(){
        this.status = {
            pending: false, // キー処理保留フラグ
            index: -1,      // キーインデックス
            char: "",       // 変換文字
            shift: false,
            ctrl: false,
            alt: false
        };
    }

    setStatus( index = -1, char = '', flag = false ){ // KeyStatusの設定
        this.status.index = index;
        this.status.char = char;
        this.status.pending = flag;
    }

    setModifier(keyData){
        this.status.ctrl = keyData.ctrlKey;
        this.status.shift = keyData.shiftKey;
        this.status.alt = keyData.altKey; 
    }
}

class MojiMap {
    constructor(){
//        this.info = keyinfo;
        this.oyaubiline = 3;      // 親指シフトのキーライン
        this.eimojiline = 32;     // 英文字の境界界 xn2
        this.iYen = this.eimojiline + 42;   // IntlYen キーのインデックス境界処3
        this.iRo = this.eimojiline + 43;    // IntlRo キーのインデックス
        // 奇数行 - 左手キー，偶数行 - 右手キー，親指シフトキーは最初の３行
        this.kanatable = [
        /*Key  単    左+   右+ */
            [" ", " ", "　"],
            ["lang2", ""],
            ["lang1", ""],  /*親指ここまで*/

            /*左手キー                  右手キー*/
            ["g", "せ", "も", "ぜ"],  ["h", "は", "み", "ば"],  
            ["b", "へ", "ぃ", "べ"],  ["n", "め", "ぬ", "ぷ"],
            ["t", "さ", "れ", "ざ"],  ["y", "ら", "よ", "ぱ"],
            ["f", "け", "ゅ", "げ"],  ["j", "と", "お", "ど"],
            ["v", "ふ", "や", "ぶ"],  ["m", "そ", "ゆ", "ぞ"],
            ["r", "こ", "ゃ", "ご"],  ["u", "ち", "に", "ぢ"],
            ["d", "て", "な", "で"],  ["k", "き", "の", "ぎ"],
            ["c", "す", "ろ", "ず"],  ["", ""],
            ["e", "た", "り", "だ"],  ["i", "く", "る", "ぐ"],
            ["s", "し", "あ", "じ"],  ["l", "い", "ょ", "ぽ"],
            ["x", "ひ", "ー", "び"],  ["", ""],
            ["w", "か", "え", "が"],  ["o", "つ", "ま", "づ"],
            ["a", "う", "を", "ゔ"],  ["", ""],
            ["z", "．", "ぅ", "."],   ["", ""],
            ["q", "。", "ぁ", "ぁ゙"],  ["p", "，", "ぇ", "ぴ"],

            ["1", "1", "ф", "一"],  ["0", "0", "、", "０"],
            ["2", "2", "〇", "二"], ["9", "9", "※", "九"],
            ["3", "3", "§", "三"],  ["8", "8", "【】", "八"],
            ["4", "4", "「", "四"],  ["7", "7", "《》", "七"],
            ["5", "5", "」", "五"],  ["6", "6", "［］", "六"],

            ["`", "‘", "’", "かっこ"],  [",", "ね", "む", "ぺ"],
            ["~", "〜"],               [".", "ほ", "わ", "ぼ"],
            ["!", "！"],               [";", "ん", "っ", "："],
            ["@", "＠"],               ["/", "・", "ぉ", "／"],
            ["#", "＃"],               ["-", "ー", "√", "±"],
            ["$", "＄"],               ["=", "＝", "÷", "×"],
            ["%", "％"],               ["[", "』", "『", "《《》》"],
            ["<", "＜"],               ["\\", "￥","＼","くりかえし"],
            [">", "＞"],               ["]", "]", "}","{"],
            [":", "："],               ["?", "？", "!?","！？"],
            ["^", "^"],                ["&", "＆"],
            ["*", "＊"],               ["(", "（"],
            [")", "）"],               ["_", "＿"],
            ["+", "＋"],               ["{", "｛"],
            ["}", "｝"],              ["|", "｜"],
            ["\"", "\"", "”"],        ["Yen", ""],
            ["Ro",""]
        ];

        this.kanaIndexMap = new Map();   // Map を構築
        this.kanatable.forEach((row, index) => {
            this.kanaIndexMap.set(row[0], index);
        });
        this.offset = 1;
        this.index = -1;
        this.shiftNo = -1;
        this.thumbHW = false;
    }

    getMoji2( offset ){
        this.offset = offset;
        return this.kanatable[this.index][offset];
    }

    getMojiFirst(){
        this.offset = this.offset === 0 ? 0 : 1;
        return this.kanatable[this.index][this.offset];
    }

    getMojiNext(){
        this.offset = (this.offset + 1) % this.kanatable[this.index].length;
        return this.kanatable[this.index][this.offset];
    }

    getMoji(){
        this.offset = 2;
        if( this.thumbHW ){
            if( this.shiftNo === 1 )  this.offset = this.index & 1 ? 3 : 2;   // 右親シフトキー
            else    this.offset = this.index & 1 ? 2 : 3;   // 左親シフトキー
        }
        return this.kanatable[this.index][this.offset];
    }

    getIndex(keyData){
        const moji = keyData.key.toLowerCase();
        if( this.thumbHW ){
            if (keyData.code === "Lang1") {this.shiftNo = 1; return this.shiftNo;}
            if (keyData.code === "Lang2") {this.shiftNo = 2; return this.shiftNo;}
            this.index = this.kanaIndexMap.get(moji);
        }
        else{
            if (keyData.code === "Lang1") {this.shiftNo = 1; this.thumbHW = true; return this.shiftNo;}
            if (keyData.code === "Lang2") {this.shiftNo = 2; this.thumbHW = true; return this.shiftNo;}
            const index = this.kanaIndexMap.get(moji);
            if( index === 0 ) {this.shiftNo = index; return index;}
            else this.index = index;
        }
        if (this.index !== undefined) return this.index;
        if (keyData.code === "IntlYen") {this.index = this.iYen; return this.index}
        if (keyData.code === "IntlRo") {this.index = this.iRo; return this.index}
        return -1;
    }

    isOyaInx( index ){
        if( this.thumbHW ) return ( index === 1 || index === 2 );
        return ( index < this.oyaubiline );
    }

//    isOyaInxZero( index ){
//        return ( index < this.oyaubiline );
//    }

    isEiInx( index ){
        return ( index <= this.eimojiline );
    }
}

class KeyFlowCommon{
    constructor(repeatmask){
        this.start = 0;
        this.generation = 0;
        this.active = false;
        this.repeatmask = repeatmask;   // キーリピートマスク時間
        this.previous = -1;     // 前回のキー番号
    }

    isKeyRepeatActive(){
        return ( Date.now() - this.start > this.repeatmask );
    }

    keyDown2( index ){
        let live = false;
        if( !this.active ){
            this.active = true; // 押下中
            this.start = Date.now();  // 押下時間管理
            live = true;
        }
        else{
            live = ( this.previois !== index || this.isKeyRepeatActive() );
        }
        this.previous = index;
        return  live;
    }
}

class KeyFlows{
    constructor(info, map){
        this.shift = new KeyFlowCommon(2400);
        this.moji = new KeyFlowCommon(1800);
        this.info = info;   // KeyInformationハンドラ
        this.map = map;     // MojiMapハンドラ
        this.seen = {
            PEND: "pending",
            SHIFT2MOJI: "shiftToMoji",
            MOJI2SHIFT: "mojiToShift",
            MOJIFIRST: "moji1st",
            HWSHIFTFOLLOW: "HWshiftafter",
            SHIFTFOLLOW: "shiftafter",
            USLARGE: "USLLetter",
            DICTOUTPUT: "DictoOutput",
            NOKEYBUF: "NoKeybuf",
            TABSPC: "TabAndSpace",
            ENTER: "Enter",
            UP: "Up",
            DOWN: "Down",
            RIGHT: "Right",
            LEFT: "Left",
            BACKSPACE: "BS",
            BRIGHTNESSUP: "BriteUp",
            BRIGHTNESSDOWN: "BriteDown",
            QUOTE: "Quote",
            ESC: "Escape",
            LONGPRESS: "LongPress"
        };
        this.timerID = null;
    }

    keyDown(keyData){
        this.info.setModifier(keyData); // 修飾キーの状態保存
        console.log(`kd-s1: /${this.map.index}/${this.map.shiftNo}/`);
        const seen = this.detectKeyDownAction(keyData);
        console.log(`kd-s2: ${seen}/${this.map.index}/${this.map.shiftNo}/`);
        if( seen ){
            const enact = this.actIfNeeded( seen );
            this.info.setStatus();
            return enact;
        }
        return false;
    }

    detectKeyDownAction(keyData){
        const keyindex = this.map.getIndex(keyData);  // キーインデックス検索
        console.log(`dkDA: ${keyindex}/${this.map.index}/${this.map.shiftNo}/`);
        if( keyindex >= 0 ){
            return this.map.isOyaInx( keyindex ) ? this.shiftkeyDown() : this.mojikeyDown();
        }
        if( insidebuf.length === 0 )
            return ( imemode === 7 && keyData.key === "Esc" && this.info.alt ) ? 
                this.seen.DICTOUTPUT : this.seen.NOKEYBUF;  // 辞書のテキスト出力 or IME処理不要
        
        switch(keyData.key){
            case "Tab": return this.seen.TABSPC;
//            case " ": return this.seen.TABSPC;  // Tab or Space (スペースは親指シフトのスペースキーも含む)
            case "Enter": return this.seen.ENTER;
            case "Up": return this.seen.UP;
            case "Down": return this.seen.DOWN;
            case "Right": return this.seen.RIGHT;
            case "Left": return this.seen.LEFT;
            case "Backspace": return this.seen.BACKSPACE;
            case "BrightnessUp": return this.seen.BRIGHTNESSUP;
            case "BrightnessDown": return this.seen.BRIGHTNESSDOWN;
            case "\"": return this.seen.QUOTE;
            case "Esc": return this.seen.ESC;
            default: return null;
        }
        return null;
    }

    shiftkeyDown(){     // 親指 shift 押下時の処理
        if( !this.shiftkeyDown2(this.map.shiftNo) ) return this.seen.PEND;  // リピート抑止期間中は何もしない
        if( this.moji.active ) return this.seen.SHIFT2MOJI; // 文字キーあり＋シフトキー → 文字確定
        if( this.map.thumbHW ) return this.seen.HWSHIFTFOLLOW;
        return this.seen.SHIFTFOLLOW;
    }
   
    shiftkeyDown2(index){
        const live = this.shift.keyDown2(index);
        if( live ) this.shift.generation = (this.shift.generation + 1) % 1024;   // 世代管理
        return live;
    }

    mojikeyDown(){      // 文字キー押下時の処理
        if( this.map.index === 0 && insidebuf.length > 0 ) return this.seen.TABSPC;
        if( !this.moji.keyDown2( this.map.index ) ) return this.seen.PEND;  // リピート抑止期間中は何もしない
        if( this.info.shift && this.map.isEiInx( this.map.index )) return this.seen.USLARGE;
        if( this.shift.active ) return this.seen.MOJI2SHIFT; // シフトキーあり＋文字キー → 文字確定
        return this.seen.MOJIFIRST;
    }

    keyUp(keyData){
        this.info.setModifier(keyData); // 修飾キーの状態保存
        const seen = this.detectKeyUpAction(keyData);
        if (seen) this.actIfNeeded(seen);
    }

    detectKeyUpAction(keyData){
        const keyinx = this.map.getIndex(keyData);  // キーインデックス検索
        const now = Date.now();

        if( this.info.ctrl ) return null;  // Ctrl 押されているときは、IME処理なし
        if( this.map.isOyaInx(keyinx) ){
            this.shift.active = false;
        }
        else{
            const seen = ( keycondition < 1024 && this.isLongPress(now) ) ? this.seen.LONGPRESS : null;
            this.moji.active = false;
            return seen;
        }
        return null;
    }

    isLongPress(now){
        const threshold = this.map.thumbHW ? 4096 : 225;  // 長押し判定時間
        return this.moji.active && this.map.offset && (now - this.moji.start > threshold);  // 長押し判定
    }

    expandLongTimer(){
        this.moji.start = Date.now() + 800;  // 長押し判定時間を延長
    }

    clearDownTimer(){
        let cleared = false;
        if( this.timerID ) {
            clearTimeout(this.timerID);  // タイマーをクリア
            this.timerID = null;   // タイマーIDをリセット
            cleared = true;
        }
        return cleared;
    }

    isMultiTap(){
        return (this.shift.generation === this.moji.generation && this.moji.previous === this.map.index);  // 同一世代かつ同一キーの判定
    }

    syncGeneration(){
        this.moji.generation = this.shift.generation;   // 世代管理
    }

    setLateKeyDown( callback ){
        if( this.timerID ) clearTimeout(this.timerID);  // 既存のタイマーがあればクリア
        this.timerID = setTimeout( () => {
            callback();            // 遅延実行するコールバック関数を呼び出す
            this.timerID = null;   // タイマーIDをリセット
        }, 250);  // 250msの遅延
    }

    actIfNeeded(seen){
        let acted = true;
        switch(seen){
            case this.seen.PEND:
                this.info.status.pending = true;    // 保留 何もしない
                break;

            case this.seen.SHIFT2MOJI:  // シフト契機で文字確定
//                this.info.setStatus( this.map.index, this.map.getMoji() );
                BackOne();  // 直前の文字確定を取り消す.
                if (!this.map.thumbHW) this.expandLongTimer(); // シフトキーの場合長押し判定時間を延長
                keyValidiate( this.map.getMoji() );  // 確定処理
                break;

            case this.seen.MOJI2SHIFT:  // 文字キー契機で文字確定
                if( !this.clearDownTimer() && !this.map.thumbHW ){  // シフトの遅延処理クリア
                    BackOne();  // 親指キーボード未確定なら直前の空白を消す処理.
                }
                if( this.isMultiTap() ){   // 同一世代かつ同一キーの判定
                    if( this.map.thumbHW ) BackOne();  // 親指シフトキーボードなら直前の文字を消す処理.
//                    this.info.setStatus( this.map.index, this.map.getMojiNext());  // 次の文字
                    keyValidiate( this.map.getMojiNext() );  // 確定処理
                }
                else {
                    this.syncGeneration();  // Shiftキーの世代を文字キーにセット
//                    this.info.setStatus( this.map.index, this.map.getMoji());  // シフト+文字の変換
                    keyValidiate( this.map.getMoji() );  // 確定処理
                }
                break;

            case this.seen.MOJIFIRST:
                // offset==0の且つinsidebufが空では無い時は、insidebufの最後の文字が空白であれば確定させる
                if( this.map.offset === 0 && insidebuf.length > 0 && insidebuf[insidebuf.length - 1] === " " ){
                    fixAll();     // 確定
                }
//                this.info.setStatus( this.map.index, this.map.getMojiFirst());  // シフト+文字の変換
//                keyValidiate( this.info.status.char );  // 確定処理
                keyValidiate( this.map.getMojiFirst() );  // 確定処理
                break;

            case this.seen.HWSHIFTFOLLOW:  // シフト後処理 親指キーボード
                this.info.setStatus( this.map.shiftNo, "", true );
                break;

            case this.seen.SHIFTFOLLOW:    // シフト後処理 親指キーボード未確定
                if( insidebuf.length === 0 ){
                    if( this.shift.isKeyRepeatActive() ) CommitOne(" ") // SPCをアプリに渡す(キーリピート).
                    else this.setLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
                    this.info.status.pending = true;
                }
                else if( this.map.offset !== 0 ){
                    this.setLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
                    this.info.status.pending = true;
                }
                else this.info.setStatus( 0, " " );     // 空白を設定
                break;

            case this.seen.USLARGE:     // 英大文字
                this.info.setStatus( this.Map.index, this.map.getMoji2( 0 ).toUpperCase() );  // Key-statusの設定(英大文字)
                break;

            case this.seen.DICTOUTPUT:
                MakeTextNiwadictionary();       // 辞書のテキスト出力.
                // Path throuth
            case this.seen.NOKEYBUF:
                clearCompoAndCand();
                acted = false;                   // キーイベントはアプリに渡す
                break;

            case this.seen.TABSPC:
                if( this.info.shift ) fixOne(); // Shift付きは先頭確定.
                else setOtherCandidate( 1 );    // 先頭変換.
                break;

            case this.seen.ENTER:
                if( this.info.shift || compoinfo < 0 ) fixOne();    // 先頭確定.
                else fixAll();
                break;

            case this.seen.UP:
                setOtherCandidate( -1 );    // 先頭変換
                break;

            case this.seen.DOWN:
                setOtherCandidate( 1 );     // 先頭変換
                break;

            case this.seen.RIGHT:
                compoinfo++;                // カーソル右へ.
                if( compoinfo > 0 ) compoinfo = 0;
                showComposition();
                break;

            case this.seen.LEFT:
                compoinfo--;                // カーソル左へ.
                if( insidebuf.length + compoinfo < 0 ) compoinfo = -insidebuf.length;
                showComposition();
                break;

            case this.seen.BACKSPACE:
                BackOne();
                henkanAri = false;
                if( insidebuf.length > 0 ) rokushikiIME();
                else clearCompoAndCand();
                break;

            case this.seen.BRIGHTNESSUP:     // Brightness upの入力 (カタカナ変換) 
                translateKanaKana( true )
                showComposition();
                break;

            case this.seen.BRIGHTNESSDOWN:   // Brightness Downの入力 (ひらがな変換)
                translateKanaKana( false );
                showComposition();
                break;

            case this.seen.ESC:
                UndoConvert( false );   // ESCキーモードで実行.
                break;

            case this.seen.QUOTE:    // 一文字確定. Double Quate
                OneLeCommit();          // 一文字確定＆コミット処理.
                break;

            case this.seen.LONGPRESS:   // Key 長押し, 確定文字を一つ削除してからオフセット3の文字を確定する
                BackOne();
                this.info.status.char = this.map.getMoji2( 3 );  // オフセット3の文字を確定する
                keyValidiate( this.info.status.char );  // 確定処理
                break;

        }
        return acted;
    }
}

// chromebook キー入力 覚書.
/*        -^@[;:],./
!@#$%^&*()_+{}:"|<>?
1234567890-=[];'\,./ 
--
 IntlRo "\", "_"
 IntlYen "¥", "|"

*/

// 親指シフトキーの制御クラス
class OyaShiftCtrl { 
    constructor(){
        this.oyaStartTime = 0;   // 押下時間管理
        this.oyaGeneration = 0;  // 世代管理 (0~1023)
        this.oyaTimerid = null;  // タイマーID管理
        this.oyaKeyIndex = -1;   // キーインデックス管理
        this.oyaActive = false;
        this.keyActive = false;  // キーアクティブ管理
        this.keyStartTime = 0;   // キー押下時間管理
        this.keyIndex = -1;      // キーインデックス管理
        this.keyPrevIndex = -1;  // 前回キーインデックス管理
        this.peekKeyIndex = -1;  // 押されたキーのインデックス
        this.keyGeneration = -1; // キーの世代管理 (0~1023)
        this.oyayubiKeyboard = false;   // 親指シフトキーボードかどうかのフラグ
    }

    oyaKeyDown( keyinx ){
        let live = false;
        if( !this.oyaActive ){
            this.oyaActive = true;  // 押下中
            this.oyaGeneration = (this.oyaGeneration + 1) % 1024;   // 世代管理
            this.oyaStartTime = Date.now();  // 押下時間管理
            this.oyaKeyIndex = keyinx;  // キーインデックス管理
            live = true;
        }
        else{
            live = this.isKeyRepeatAvailable();
        }
        return live;
    }

    oyaKeyUp(){
        this.oyaActive = false;
    }

    isKeyRepeatAvailable(){
        return ( Date.now() - this.oyaStartTime > 2400 );   // キーリピート抑止時間
    }

    oyaSetLateKeyDown( callback ){
        if( this.oyaTimerid ) clearTimeout(this.oyaTimerid);  // 既存のタイマーがあればクリア
        this.oyaTimerid = setTimeout( () => {
            callback();               // 遅延実行するコールバック関数を呼び出す
            this.oyaTimerid = null;   // タイマーIDをリセット
        }, 250);  // 250msの遅延
    }

    oyaClearKeyDownTimer(){
        let cleared = false;
        if( this.oyaTimerid ) {
            clearTimeout(this.oyaTimerid);  // タイマーをクリア
            this.oyaTimerid = null;   // タイマーIDをリセット
            cleared = true;
        }
        return cleared;
    }

    keyKeyDown( index ){
        let live = false;
        this.keyPrevIndex = this.keyIndex;
        this.keyIndex = index;  // キーインデックス管理
        if( !this.keyActive ){
            this.keyActive = true;  // 押下中
            this.keyStartTime = Date.now();  // 押下時間管理
            live = true;
        }
        else if( this.keyPrevIndex !== index || (Date.now() - this.keyStartTime > 1800 ) ){   // リピート抑止
            live = true;
        }
        return live;
    }

    keyKeyUp(){
        this.keyActive = false;
    }

    keyIsLongPress(now, offset){
        const threshold = this.oyayubiKeyboard ? 4096 : 225;  // 長押し判定時間
        return this.keyActive && offset && (now - this.keyStartTime > threshold);  // 長押し判定
    }

    keyExpandLongTimer(){
        this.keyStartTime = Date.now() + 800;  // 長押し判定時間を延長
    }

    keyIsMultiTap(){
        return this.oyaGeneration === this.keyGeneration && this.keyPrevIndex === this.keyIndex;  // 同一世代かつ同一キーの判定
    }

   keySyncGeneration(){
        this.keyGeneration = this.oyaGeneration;   // 世代管理
    }
}

const cinf = new KeyInformation();  // 入力キー情報管理
const cmap = new MojiMap();         // キーマップ管理
const cflow = new KeyFlows(cinf, cmap); // キーフロー制御

//  Key Down時に呼び出される.
function thumbShift(keyData){
    let action   = false;
    let lkey     = "";
    let keyinx   = -1;

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( !cmap.offset && (keyData.code === "Enter" || keyData.code === "Tab") ){ // 英モード+Enter&Tabで全吐き出し
            ZenKakuteiKey( keyData );  // 全確定 or 先頭確定
        }
        else {
            //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);
            ckey.peekKeyIndex = cmap.getIndex(keyData);  // キーインデックス検索
            cinf.setModifier( keyData );
            if( ckey.peekKeyIndex >= 0 ){
                action = true;
                if( cmap.isOyaInx( ckey.peekKeyIndex )) setConvKanaDownOya()  ;  // 設定：親.
                else   setConvKanaDownKey();  // 設定：key.
            } 
            else if( keyData.code === "AltLeft" ) cinf.setStatus( 203 ); // SSKeyUp でUSモード
        }
    }
    //console.log(`thumbShift:${convKana}/${insidebuf}/`);
    return action;
}

//  SPC押下時の convKana 設定. 
function setConvKanaDownOya(){
    //console.log(`SPC:${ckey.keyShift}/${ckey.keyActive}/${insidebuf}/`);
    if (!ckey.oyaKeyDown(ckey.peekKeyIndex)) {
        cinf.status.pending = true;     // リピート抑止期間中は何もしない
        return;
    }

    // 1) 文字キーが押されている → 入力文字確定
    if (ckey.keyActive) {
        cinf.setStatus( ckey.oyaKeyIndex, cmap.getMoji());
        BackOne();      // 直前の文字確定を取り消す.
        if (ckey.oyaKeyIndex === 0) ckey.keyExpandLongTimer(); // SpC親キーの場合長押し判定時間を延長
        return;
    }

    // 2) 親指キーボード未確定
    if (!ckey.oyayubiKeyboard) {
        handleOyaBeforeConfirmed();
        return;
    }

    // 3) 親指キーボード確定後
    handleOyaAfterConfirmed();
}

// 親指キーボード未確定時の親キーダウン処理
function handleOyaBeforeConfirmed(){
    if( insidebuf.length === 0 ){   // insidebufが空のとき
        if( ckey.isKeyRepeatAvailable() ){   // キーリピート抑止時間確認
            CommitOne(" ");   // SPCをアプリに渡す(キーリピート).
        }
        else{
            ckey.oyaSetLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
        }
        cinf.status.pending = true;
    }
    else if( cmap.offset !== 0 ){   // US文字以外.
        ckey.oyaSetLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
        cinf.status.pending = true;
    }
    else {      // 空白
        cinf.setStatus( 0, " " );  // SPCを設定.
    }
}

// 親指キーボード確定後の親キーダウン処理
function handleOyaAfterConfirmed(){
    if( ckey.oyaKeyIndex === 0 ){    // 空白(親指キーボード確定＆スペース)
        if( cmap.offset !== 0 ){   // US文字以外.
            SPCLateKeyDown();           // ノータイムで変換
            cinf.status.pending = true;
        }
        else cinf.setStatus( 0, " " );  // SPCを設定.
    }
    else{   // 親指シフトキーの押下
        cinf.setStatus( ckey.oyaKeyIndex, "", true );
    }
}

//  Key押下時の convKana 設定. 
function setConvKanaDownKey(){
    //console.log(`KY:(${ckey.peekKeyIndex})${convKana}/${ckey.keyShift}`);
    if( ckey.keyKeyDown( ckey.peekKeyIndex ) ){   // 文字キー管理
        if( cinf.status.shift && cmap.isEiInx( ckey.keyIndex )){         // shift key押下 && 通常キー.
            cinf.setStatus( ckey.keyIndex, cmap.getMoji2( 0 ).toUpperCase() );  // Key-statusの設定(英大文字)
        }
        else if( ckey.oyaActive ){   // SPCキーが押されている場合は、シフト+文字の変換.
            if( !ckey.oyaClearKeyDownTimer() && !ckey.oyayubiKeyboard ){  // SPCの遅延処理クリア
                BackOne();  // 親指キーボード未確定なら直前の空白を消す処理.
            }
            if( ckey.keyIsMultiTap() ){   // 同一世代かつ同一キーの判定
                if( ckey.oyayubiKeyboard ) BackOne();  // 親指シフトキーボードなら直前の文字を消す処理.
                cinf.setStatus( ckey.keyIndex, cmap.getMojiNext());  // 次の文字
            }
            else {
                ckey.keySyncGeneration();  // Shiftキーの世代を文字キーにセット
                cinf.setStatus( ckey.keyIndex, cmap.getMoji());  // シフト+文字の変換
            }
        }
        else {
            // offset==0の且つinsidebufが空では無い時は、insidebufの最後の文字が空白であれば確定させる
            if( cmap.offset === 0 && insidebuf.length > 0 && insidebuf[insidebuf.length - 1] === " " ){
                fixAll();     // 確定
            }
            cinf.setStatus( ckey.keyIndex, cmap.getMojiFirst());  // シフト+文字の変換
        }
    }
    else cinf.status.pending = true;    // リピート抑止
    //console.log(`KYout:${convKana}/${insidebuf}/`);
}

// US keyDown event
function USKeyDown( keyData ){
    //console.log(`UKD:${keyData.code}/${keyData.shiftKey}`);
    let enact = false;
    if( !keyData.shiftKey && !keyData.ctrlKey ){
        if( keyData.code === "AltRight" ) cinf.setStatus( 202, "" );  // SSKeyUp で日本語モード
        else cinf.status.index = -1;
    }
    cinf.setModifier( keyData );
    return enact;
}

// SS keyUp event
function SSKeyUp(engineID, keyData){
    //console.log(`+kU:${convKana}/${keyData.key}:${insidebuf.length}`);
    const now = Date.now();
    const keyinx = cmap.getIndex( keyData );  // キーインデックス検索
    cinf.setModifier( keyData );

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( keyinx >= 0 ){
            if( cmap.isOyaInx( keyinx ) ){
                ckey.oyaKeyUp();   // 親キー管理
            }
            else{
                if( keycondition < 1024 && ckey.keyIsLongPress(now, cmap.offset) ){
                    // Key 長押しが判明，確定文字を一つ削除してからオフセット3の文字を確定する
                    BackOne();
                    cinf.status.char = cmap.getMoji2( 3 );  // オフセット3の文字を確定する
                    keyValidiate( cinf.status.char );  // 確定処理
                }
                ckey.keyKeyUp();   // 文字キー管理
            }
        }
        else {
            if( keycondition < 1024 ){
                if( cinf.status.index === 203 && cinf.status.char === "" ){
                    changeAndClear();       // 英モード
                    cmap.offset = 0;
                }
            }
            else if( cinf.status.index === 202 && cinf.status.char === "" ){ 
                changeAndClear();           // 日 Mode
                cmap.offset = 1;     // かな変換offset量セット (次回以降のキー入力でひらがなになるように)
            }
        }
    }
}

// SS keyDown event
function SSKeyDown(engineID, keyData){
    let enact = false;
//    console.log(`sKD:(${keyData.key}|${keyData.code})`);
    if( thumbShift( keyData ) ){            // 親指シフト判断処理.
        if( !cinf.status.pending ) keyValidiate( cinf.status.char );  // 有効キー&入力確定.
        enact = true;
    } 
    else if( insidebuf.length > 0 ) {    // insidebuf(or cCandidate) が存在する時の処理
//        console.log(`ssKD+:(${keyData.key}|${keyData.code})`);
        // Shift Space と タブ は先頭確定.
        if( keyData.key === " " || keyData.key === "Tab" ){
            if( keyData.shiftKey ) fixOne();        // Shift付きは先頭確定.
            else setOtherCandidate( 1 );            // 先頭変換.
            enact = true;
        } else {
            enact = true;
            switch( keyData.key ){
                case "Enter":                   // Enter は 全確定 か キー処理、shift があれば先頭確定. 
                    if( keyData.shiftKey || compoinfo < 0 ) fixOne();  // 先頭確定.
                    else fixAll();                                      // 全確定.
                    break;
                case "Up":                          // 上下矢印 は先頭変換.
                case "Down":
                    let addinx = ( keyData.key === "Up") ? -1 : 1;
                    setOtherCandidate( addinx );    // 先頭変換
                    break;
                case "Right":                       // 右矢印 は カーソル移動 キー処理. 
                    compoinfo++;                    // カーソル右へ.
                    if( compoinfo > 0 ) compoinfo = 0;
                    showComposition();
                    break;
                case "Left":                        // 左矢印 は カーソル移動 キー処理. 
                    compoinfo--;                    // カーソル左へ.
                    if( insidebuf.length + compoinfo < 0 ) compoinfo = -insidebuf.length;
                    showComposition();
                    break;
                case "Backspace":                   // Backspeceの入力 (変換候補有りの時のみ処理する) 
                    BackOne();
                    henkanAri = false;
                    if( insidebuf.length > 0 ) rokushikiIME();
                    else clearCompoAndCand();
                    break;
                case "BrightnessUp":                // Brightness upの入力 (カタカナ変換) 
                    translateKanaKana( true )
                    showComposition();
                    break;
                case "BrightnessDown":              // Brightness Downの入力 (ひらがな変換)
                    translateKanaKana( false );
                    showComposition();
                    break;
                case "Esc":                         // 未変換化
                    UndoConvert( false );           // ESCキーモードで実行.
                    break;
                case "\"":                      // 一文字確定. Double Quate
                    OneLeCommit();              // 一文字確定＆コミット処理.
                    break;
                default:
                    enact = false;
            }
        }
        if( enact ) cinf.setStatus();               // Key-Statusの初期化.
        if( keyData.code === "IntlRo" ) enact = true;    // IntlRo はハンドリング済に.
    } else {
        clearCompoAndCand();
        if( imemode == 7 && keyData.key === "Esc" && keyData.altKey )
            MakeTextNiwadictionary();             // 辞書のテキスト出力.
    }
    return enact;
}

// シフトの遅延処理
function SPCLateKeyDown(){
    //console.log(`SPCLate:${convKana}/${insidebuf.length}`);
    if( insidebuf.length === 0 ){   // insidebufが空のときは、SPCをアプリに渡す.
        CommitOne(" ");   // SPCをアプリに渡す.
        cinf.status.pending = true;
    }
    else {
        if( cinf.status.shift ) fixOne();        // Shift付きは先頭確定.
        else setOtherCandidate( 1 );   // 先頭変換.
    }
}

function ZenKakuteiKey( keyData ){
    if( keyData.shiftKey || compoinfo < 0 ) fixOne();  // 先頭確定.
    else fixAll();                                      // 全確定.
}

chrome.input.ime.onKeyEvent.addListener(
  function(engineID, keyData) {
    let enact = false;
    if( keyData.type === "keyup" ){
        cflow.keyUp( keyData );
    } 
    else if(keyData.type === "keydown"){
        console.log(`KD:(${keyData.key}|${keyData.code})`);
        enact = cflow.keyDown( keyData );
    }
    return enact;
  }
);

