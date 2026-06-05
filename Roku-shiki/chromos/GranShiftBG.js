/*  2026.06.03 20:00
  親指シフトキーボードIME ver 5.2 (JISキーボード用)
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、inbufを表示
            ユーザー意思の変換が実行された後は1行目はinbuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js", "Dictionary.js");

const engine   = "GranShift";

class KeyInformation{
    constructor(){
        this.shift = false;
        this.ctrl = false;
        this.alt = false;
    }

    setModifier(keyData){
        this.ctrl = keyData.ctrlKey;
        this.shift = keyData.shiftKey;
        this.alt = keyData.altKey; 
    }
}

class MojiMap {
    constructor(){
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
        this.jpmode = true;
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

    detectThumbShift(keyData){
        if (keyData.code === "Lang1") { this.shiftNo = 1; this.thumbHW = true; return 1; }
        if (keyData.code === "Lang2") { this.shiftNo = 2; this.thumbHW = true; return 2; }
        return null;
    }

    detectKanaIndex(keyData){
        const moji = keyData.key.toLowerCase();
        const index = this.kanaIndexMap.get(moji);
        if (index === undefined) return null;
        // index=0 は特殊（空白 or シフト）
        if (index === 0 && !this.thumbHW ) { this.shiftNo = 0; return 0; }
        this.index = index;
        return index;
    }

    detectIntlKey(keyData){
        if (keyData.code === "IntlYen") { this.index = this.iYen; return this.index; }
        if (keyData.code === "IntlRo") { this.index = this.iRo; return this.index; }
        return -1;
    }

    getIndex(keyData){
        // 1) 親指シフトキー（Lang1 / Lang2）
        const shift = this.detectThumbShift(keyData);
        if (shift !== null) return shift;
        // 2) 通常キー（英数・かな）
        const idx = this.detectKanaIndex(keyData);
        if (idx !== null) return idx;
        // 3) IntlYen / IntlRo
        return this.detectIntlKey(keyData);
    }

    isOyaInx( index ){
        if( this.thumbHW ) return ( index === 1 || index === 2 );
        return ( index < this.oyaubiline );
    }

    isEiInx( index ){
        return ( index <= this.eimojiline );
    }

//    changeJPandUS(){
//        if( this.jpmode ){
//            this.jpmode = false;
//            this.offset = 0;
//        }
//        else{
//            this.jpmode = true;
//            this.offset = 1;
//        }
//    }
//}

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
//            console.log(`kD2:${this.previous}/${index}/${Date.now()-this.start}/${this.repeatmask}`);
            live = ( this.previous !== index || this.isKeyRepeatActive() );
        }
        this.previous = index;
        return  live;
    }
}

class KeyFlows{
    constructor(info, map, fifo){
        this.shift = new KeyFlowCommon(1800);
        this.moji = new KeyFlowCommon(1200);
        this.info = info;   // KeyInformationハンドラ
        this.map = map;     // MojiMapハンドラハンドラ
        this.fi = fifo;     // fifoハンドラ
        this.seen = {
            PEND: "pending",
            SHIFT2MOJI: "shiftToMoji",
            MOJI2SHIFT: "mojiToShift",
            MOJIFIRST: "moji1st",
            SHIFTFOLLOW: "shiftafter",
            USLARGE: "USLLetter",
            USMODE: "USMode",
//            DICTOUTPUT: "DictoOutput",
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
            LONGPRESS: "LongPress",
            HOME: "Home",
            END: "End",
            PAGE: "Page",
        };
        this.timerID = null;
    }

    keyDown(keyData){
        this.info.setModifier(keyData); // 修飾キーの状態保存
        if( this.info.ctrl || this.info.alt ) return false; // ctrl, alt 付きはシステムに帰す
        //console.log(`kd-s1: ${this.map.index}/${this.map.shiftNo}/${this.map.offset}/`);
        const seen = this.detectKeyDownAction(keyData);
        if( seen ) return this.actIfNeeded( seen );
        return false;
    }

    detectKanaOrShift(keyindex){
        if (keyindex < 0) return null;
        // 親指シフトキー
        if (this.map.isOyaInx(keyindex)) return this.shiftkeyDown();
        // かなキー
        return this.mojikeyDown();
    }

    detectNoKeyBufCase(keyData){
        if (!this.fi.isEmpty()) return null;
        // Alt + Esc → 辞書テキスト出力
//        if (dic.step === dic.state.SPECIAL && keyData.key === "Esc" && this.info.alt) return this.seen.DICTOUTPUT;
        // inbuf が空 → IME 処理不要
        return this.seen.NOKEYBUF;
    }

    detectSpecialKey(keyData){
        switch(keyData.key){
            case "Tab": return this.seen.TABSPC;
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
        }
        switch(keyData.code){
            case "Home": return this.seen.HOME;
            case "End": return this.seen.END;
            case "PageUp": return this.seen.PAGE;
            case "PageDown": return this.seen.PAGE;
            default: return null;
        }
    }

    detectKeyDownAction(keyData){
        const keyindex = this.map.getIndex(keyData);  // キーインデックス検索
        //console.log(`dkDA: ${keyindex}/${this.map.index}/${this.fi.inbuf}/${this.fi.curbuf}/`);
        // 1) 親指シフト or かなキー
        const kanaOrShift = this.detectKanaOrShift(keyindex);
        if (kanaOrShift) return kanaOrShift;
        // 2) inbuf が空のときの特別処理 (辞書出力暫定コード)
        const noKeyBuf = this.detectNoKeyBufCase(keyData);
        if (noKeyBuf) return noKeyBuf;
        // 3) 特殊キー（Tab, Enter, BS, 矢印など）
        return this.detectSpecialKey(keyData);
    }

    shiftkeyDown(){     // 親指 shift 押下時の処理
        if( !this.shiftkeyDown2(this.map.shiftNo) ) return this.seen.PEND;  // リピート抑止期間中は何もしない
        if( this.moji.active ) return this.seen.SHIFT2MOJI; // 文字キーあり＋シフトキー → 文字確定
        if( this.map.thumbHW ) return this.seen.PEND;
        return this.seen.SHIFTFOLLOW;
    }
   
    shiftkeyDown2(index){
        const live = this.shift.keyDown2(index);
        if( live ) this.shift.generation = (this.shift.generation + 1) % 1024;   // 世代管理
        return live;
    }

    mojikeyDown(){      // 文字キー押下時の処理
//        console.log(`mojikyDown:${this.map.index}`)
        if( this.map.index === 0 && this.fi.isAvailable() ) return this.seen.TABSPC;
        if( !this.moji.keyDown2( this.map.index ) ) return this.seen.PEND;  // リピート抑止期間中は何もしない
        //if (!this.moji.shouldFire(this.map.index)) return this.seen.PEND;
        if( this.info.shift && this.map.isEiInx( this.map.index )) return this.seen.USLARGE;
        if( this.shift.active ) return this.seen.MOJI2SHIFT; // シフトキーあり＋文字キー → 文字確定
        if( !this.map.jpmode ) return this.seen.USMODE; // US入力モード → システム
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
            const seen = ( this.map.jpmode && this.isLongPress(now) ) ? this.seen.LONGPRESS : null;
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

    enterUSmode(){
        if( !this.fi.isEmpty() ) fixAll();  // 掃き出し
        ren.clearComposition();
        this.map.jpmode = false;
    }

    actIfNeeded(seen){
        console.log(`ai:${seen}`);
        switch(seen){
            case this.seen.PEND:            return true;
            case this.seen.SHIFT2MOJI:      return this.actShift2Moji();
            case this.seen.MOJI2SHIFT:      return this.actMoji2Shift();
            case this.seen.MOJIFIRST:       return this.actMojiFirst();
            case this.seen.SHIFTFOLLOW:     return this.actShiftFollow();
            case this.seen.USLARGE:         return this.actUSLarge();
//            case this.seen.DICTOUTPUT:      return this.actDictOutput();
            case this.seen.NOKEYBUF:        return this.actNoKeyBuf();
            case this.seen.USMODE:          return false;
            case this.seen.TABSPC:          return this.actTabSpace();
            case this.seen.ENTER:           return this.actEnter();
            case this.seen.UP:              return this.actUp();
            case this.seen.DOWN:            return this.actDown();
            case this.seen.RIGHT:           return this.actRight();
            case this.seen.LEFT:            return this.actLeft();
            case this.seen.BACKSPACE:       return this.actBackspace();
            case this.seen.BRIGHTNESSUP:    return this.actBrightnessUp();
            case this.seen.BRIGHTNESSDOWN:  return this.actBrightnessDown();
            case this.seen.ESC:             return this.actEsc();
            case this.seen.QUOTE:           return this.actQuote();
            case this.seen.LONGPRESS:       return this.actLongPress();
            case this.seen.HOME:            return this.actHome();
            case this.seen.END:             return this.actEnd();
            case this.seen.PAGE:            return this.actPage();
        }
        return true;
    }

    // シフト契機で文字確定
    actShift2Moji(){
        this.fi.deleteLastOne();  // 直前の文字確定を取り消す.
        if (!this.map.thumbHW) this.expandLongTimer(); // シフトキーの場合長押し判定時間を延長
        if( !cmt.pushAndCommitIfNeed( this.map.getMoji() ) ) IME_Rokushiki();
        return true;
    }

    // 文字キー契機で文字確定
    actMoji2Shift(){
        if( !this.clearDownTimer() && !this.map.thumbHW ){  // シフトの遅延処理クリア
            this.fi.deleteLastOne();  // 親指キーボード未確定なら直前の空白を消す処理.
        }
        if( this.isMultiTap() ){   // 同一世代かつ同一キーの判定
            if( this.map.thumbHW ) this.fi.deleteLastOne();  // 親指シフトキーボードなら直前の文字を消す処理.
            if( !cmt.pushAndCommitIfNeed( this.map.getMojiNext() ) ) IME_Rokushiki();
        }
        else {
            this.syncGeneration();  // Shiftキーの世代を文字キーにセット
            if( !cmt.pushAndCommitIfNeed( this.map.getMoji() ) ) IME_Rokushiki();
        }
        if( this.map.offset !== 0 ) this.map.jpmode = true; // Mode 復帰
        return true;
    }

    // 文字入力
    actMojiFirst(){
        //console.log(`M1:${this.fi.inbuf.length}/${this.fi.inbuf}/${this.map.index}/${this.map.offset}`);
        //console.log(`M1a:${this.fi.isEmpty()}/${this.fi.inbuf[this.fi.inbuf.length - 1]}/${this.fi.curbuf}/`);
        if( this.map.index === 0 && this.fi.isEmpty() ){
            cmt.commitOne(" ");
            return true;
        }
        if( this.map.offset === 0 && (this.fi.isEmpty() || this.fi.inbuf.length > 5)) this.enterUSmode();   // US modeへ 
        if( this.map.jpmode ){
            if( !cmt.pushAndCommitIfNeed( this.map.getMojiFirst() ) ) IME_Rokushiki();
        }
        else return false;  // システムへ処理を渡す
        return true;
    }

    // シフト後処理 親指キーボード未確定
    actShiftFollow(){
        if( this.fi.isEmpty() ){
            if( this.shift.isKeyRepeatActive() ) cmt.commitOne(" ") // SPCをアプリに渡す(キーリピート).
            else this.setLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
        }
        else if( this.map.offset !== 0 ){
            this.setLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
        }
        else if( !cmt.pushAndCommitIfNeed(" ") ) IME_Rokushiki();
        return true;
    }

    // 英大文字
    actUSLarge(){
        if( this.map.jpmode && !cmt.pushAndCommitIfNeed(this.map.getMoji2( 0 ).toUpperCase())) IME_Rokushiki();
        else return false;  // システムへ処理を渡す
        return true;
    }

//    actDictOutput(){
//        MakeTextNiwadictionary();   // 辞書のテキスト出力.
//        return this.actNoKeyBuf();
//    }

    actNoKeyBuf(){
        ren.clearComposition();
        return false;
    }

    actTabSpace(){
        if( this.map.offset !== 0 ){
            if( this.info.shift ) cmt.commitTopCandidate(); // Shift付きは先頭確定.
            else setOtherCandidate( 1 );    // 先頭変換.
            return true;
        }
        fixAll();
        return false;  // システムへ処理を渡す
    }

    actEnter(){
        if( this.info.shift || this.fi.bufptr < 0 ) cmt.commitTopCandidate();    // 先頭確定.
        else fixAll();
        return true;
    }

    actUp(){
        setOtherCandidate( -1 );    // 先頭変換
        return true;
    }

    actDown(){
        setOtherCandidate( 1 );     // 先頭変換
        return true;
    }

    actRight(){
        this.fi.bufptr++;                // カーソル右へ.
        if( this.fi.bufptr > 0 ) this.fi.bufptr = 0;
        ren.showComposition();
        return true;
    }

    actLeft(){
        this.fi.bufptr--;                // カーソル左へ.
        if( this.fi.inbuf.length + this.fi.bufptr < 0 ) this.fi.bufptr = -this.fi.inbuf.length;
        ren.showComposition();
        return true;
    }

    actBackspace(){
        this.fi.deleteLastOne();
        ren.convCandidate = false;
        if( this.fi.isEmpty() ) ren.clearComposition();
        else IME_Rokushiki();
        return true;
    }

    // Brightness upの入力 (カタカナ変換) 
    actBrightnessUp(){
        ren.translateKana2( true )
        return true;
    }

    // Brightness Downの入力 (ひらがな変換)
    actBrightnessDown(){
        ren.translateKana2( false );
        return true;
    }

    actEsc(){
        if( !this.fi.isEmpty() && this.map.offset === 0 ) fixAll();   // US文字は掃き出してから
        ren.undoConvert();
        return true;
    }

    // 一文字確定. Double Quate
    actQuote(){
        cmt.commitFO();     // 一文字確定＆コミット処理.
        IME_Rokushiki();
        return true;
    }

    // Key 長押し, 確定文字を一つ削除してからオフセット3の文字を確定する
    actLongPress(){
        this.fi.deleteLastOne();
        if( !cmt.pushAndCommitIfNeed( this.map.getMoji2( 3 ) ) ) IME_Rokushiki();
        return true;
    }

    actHome(){
        this.fi.bufptr = -this.fi.inbuf.length;     // カーソル左端へ.
        ren.showComposition();
        return true;
    }

    actEnd(){
        this.fi.bufptr = 0;     // カーソル右端へ.
        ren.showComposition();
        return true;
    }

    actPage(){
        NextIME();
        return true;
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
//----------------------------------------------------
const cinf = new KeyInformation();  // 入力キー情報管理
const cmap = new MojiMap();         // キーマップ管理
const fifo = new FIFO();
const con = new Converter(fifo);
const ren = new Renderer(con);
const cmt = new Commit(ren,fifo);
const mnu = new UIMenu();
const dic = new Dictionary(con);
const cflow = new KeyFlows(cinf, cmap, fifo); // キーフロー制御

// シフトの遅延処理
function SPCLateKeyDown(){
    if( fifo.isEmpty() ){   // inbufが空のときは、SPCをアプリに渡す.
        cmt.commitOne(" ");   // SPCをアプリに渡す.
    }
    else {
        if( cinf.shift ) cmt.commitTopCandidate();  // Shift付きは先頭確定.
        else setOtherCandidate( 1 );   // 先頭変換.
    }
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

