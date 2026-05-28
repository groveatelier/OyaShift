/*  2026.05.28 20:00
  Oya Key shift keyboard (自作キーボード用)
    
    >> Spcial keys << inbuf.length > 0 
    "\"(Backslash) : enter                 
    "'"(Quote)     : BackSpace            
    "]"(BracketRight) : 記号入力特殊キー

    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、inbufを表示
            ユーザー意思の変換が実行された後は1行目はinbuf, ２行目以降を data１段目の
            変換候補を表示する.    
*/

class FIFO {
    constructor(){
        this.inbuf = "";    // 入力バッファ
        this.curbuf = "";   // カーソル行バッファ
        this.bufptr = 0;    // バッファ内ポインター
    }

    isEmpty() { return (this.inbuf.length === 0); }
    isAvailable() { return (this.inbuf.trim().length > 0); }
    substr( num ){ this.inbuf = this.inbuf.substring( num ); }

    clear(){
        this.inbuf = "";
        this.curbuf = "";
        this.bufptr = 0;
    }

    pullOne() {
        if( this.isEmpty() ) return null;
        const first = this.inbuf[0];
        this.inbuf = this.inbuf.slice(1);
        return first;
    }

    pushOne( moji ){
        // need commit then return false
        if( this.bufptr < 0 ){
            const temptext = this.inbuf.slice(0, this.bufptr) + moji 
                    + this.inbuf.slice(this.inbuf.length + this.bufptr);
            this.inbuf = temptext;
        } else if( this.inbuf.length === 0 && "。、―".indexOf( moji ) >= 0 ) return false;
        else {
            this.inbuf += moji;     // 確定済キー.
        }
        return true;
    }

    deleteLastOne(){
        if( this.bufptr < 0 && this.inbuf.length + this.bufptr > 0){
            const tempbuf = this.inbuf.slice(0, this.bufptr-1) 
                        + inbuf.slice(inbuf.length + this.bufptr);
            this.inbuf = tempbuf;
            if( this.inbuf.length + this.bufptr < 0 ) this.bufptr = -this.inbuf.length;
        } else this.inbuf = this.inbuf.slice(0,-1);   // javaの仕様上inbufが空でもOK
    }

    remakeFIFO( stepbuf ){
        this.inbuf = "";
        for( let depth = 0; depth < stepbuf.length; depth++ ){
            this.inbuf += stepbuf[depth][0];     // inbuf作り直し.
        }
    }

    pullTop(){
        if( this.bufptr < 0 ){            // 今は無変換確定になりますね.
            const pulledtext = this.inbuf.slice(0, this.bufptr);
            const restin = this.inbuf.slice(this.inbuf.length+this.bufptr);
            this.inbuf = restin;
            return pulledtest;
        }
        return null;
    }

}

class Converter{
    constructor(fifo){
        this.fo = fifo;
        this.candidate = [];    // 変換候補 ver2.2以降.
        this.index = -1;        // 変換候補用 index
        this.data = [];         // 変換候補データ IME結果
        this.initialize();
    }

    initialize( word = "" ){
        this.candidate = [{annotation:"<入力>", candidate:word, id:0}]; // 変換候補 ver2.2以降.
        this.index = 0;
    }

    clearData(){
        this.data = [];
        this.fo.clear();
    }

    // candidate へのデータ設定.
    copy( arrayone, mode ){
        for( let pos = 0; pos < arrayone.length; pos++ ){
            let idno = this.candidate.length;
            if( arrayone[pos] !== this.candidate[0].candidate ){
                if( mode === 3 ){
                    this.candidate.push({annotation:arrayone[pos+1], candidate:arrayone[pos], id:idno});
                    pos++;
                }
                else this.candidate.push({annotation:"", candidate:arrayone[pos], id:idno});
            }
        }
    }

    // カーソル行に表示する文字列を作成 : 適度に変換筆頭文字を加える.
    makeCursolbuf(){
        if( this.data.length > 0 ){
            let imeline  = this.index > 0 ? this.candidate[ this.index ].candidate : this.data[0][1][0];
            let limitcnt = 1;
            if( this.fo.inbuf.length >= 8 ){            // 筆頭変換制限.
                limitcnt = this.fo.inbuf.length >> 2;   // 4文字単位だと多い？ どうする?
            }
            //  筆頭候補を一本につなげる. 
            for( let depth = 1; depth < this.data.length; depth++ ){
                let mayoke = this.data[depth][0].length * 2;  // 2倍変換文字列は対象外.
                if( --limitcnt > 0 && this.data[depth][1][0].length < mayoke )
                    imeline += this.data[depth][1][0];       // 筆頭候補をつなげる.
                else imeline += this.data[depth][0];          // 変換無し.
            }
            this.fo.curbuf = imeline;
        }
        else this.fo.curbuf = fhis.fo.inbuf;
    }

    remakeFIFO(){
        this.fo.remakeFIFO( this.data );
        this.candidate[0].candidate = this.fo.inbuf;
        this.index = 0;             // 候補筆頭も取り止め.
    }

    indexUpDown( updown ){
        this.index += updown;
        if( this.index < 0 ) this.index = this.candidate.length - 1;
        else if( this.index >= this.candidate.length ){
             this.index = 0;
             return true;  //  下の下へ    
        }
        return false;
    }

    // ひらがな−カタカナ コード変換を行う.
    // input: Hira2Kata true - カナ2かな, false - かな2カナ.
    convertKana2( Hira2Kata ){
        const mojihani = Hira2Kata ? [12353,12439,12445,12446] : [12449,12535,12541,12542];
        const shiftval = Hira2Kata ? 96 : -96;
        let kanabuf  = [];
        for(let ofs = 0; ofs < this.fo.inbuf.length; ofs++ ){
            let hirachar  = this.fo.inbuf.codePointAt( ofs );
            let hirachar2 = hirachar;
            if((mojihani[0] <= hirachar && hirachar <= mojihani[1])
                ||(mojihani[2] <= hirachar && hirachar <= mojihani[3])){ // 変換文字範囲の場合.
                hirachar2 += shiftval;
            }
            kanabuf += String.fromCharCode(hirachar2);
        }
//        console.log(`kana2:/${this.fo.inbuf}/${kanabuf}/`)
        this.initialize( kanabuf );
        this.candidate[0].annotation = this.fo.inbuf;
        this.data = [[ this.fo.inbuf, [kanabuf, this.fo.inbuf]]];
    }

    //  変換データからCandidateを作成. Indexも作り直し...
    //  カーソルライン用の文字列作成.
    makeCandidate( mode ){
        this.initialize( this.fo.inbuf );   // candidate初期化.
        if( this.data.length >= 1 )         // dataが存在すれば実行.
            this.copy( this.data[0][1], mode ); // 一段目の候補を設定: candidateに複製.
        return;   
    }


}

class Renderer{
    constructor(converter){
        this.con = converter;
        this.context = -1;
        this.convCandidate = false;
    }

    //  カーソル行表示と候補窓表示を消去.
    clearComposition(){
        if( this.context >= 0 ) 
            chrome.input.ime.clearComposition({contextID: this.context});
        this.invibleCandidate();
        this.con.clearData();
    }

    //  候補窓表示を消去.
    invibleCandidate(){
        chrome.input.ime.setCandidateWindowProperties({
            engineID: engine,
            properties:{
                visible:false
            }
        });
        this.con.initialize();
        this.convCandidate = false;
    }

    // 無変換処理.
    undo(){
        if( !this.convCandidate ){
            this.clearComposition(); // 変換無状態なら 入力自体をクリア.
            return false;
        }
        else {
            this.con.remakeFIFO();  // inbuf作り直し.
            this.convCandidate = false;   // 変換も無効.
        }
        return true;
    }

    // テキスト(カーソル行)の表示.
    showLine( text ){
    //    console.log(`cur>${text}`); 
        const obj = {
            contextID: this.context,
            text: text,
            cursor: text.length,
            selectionStart: 0,
            selectionEnd: text.length+this.con.fo.bufptr
        };
        chrome.input.ime.setComposition(obj); // カーソル位置に未変換文字列をアンダーライン表示
    }

    //  dataから cursol lineを作り直して表示.
    showComposition(){
        if( this.con.fo.bufptr < 0 ){
            this.showLine( this.con.fo.inbuf );
        } else {
            this.con.makeCursolbuf();
            this.showLine( this.con.fo.curbuf );
        }
    }

    showCandidates( mode ){
        let auxtext = "六式 IME";
        let displines = this.convCandidate ? this.con.candidate.length : 2;  // 変換無
        const curpos = displines <= this.con.index ? displines-1 : this.con.index;
        if( mode === 0 ) auxtext = "google IME cgi";
        else if( mode === 3 ) auxtext += " cahce";
        if( this.con.candidate.length > 0 ){
            displines = this.con.candidate.length;
//          console.log(`sC:${this.con.index}/${curpos}`);
            if( displines > 10 ) displines = 10;
            chrome.input.ime.setCandidateWindowProperties({
                engineID: engine,
                properties:{
                    visible: true,
                    cursorVisible: true,
                    vertical:true,
                    pageSize: displines,
                    totalCandidates: this.con.candidate.length,
                    currentCandidateIndex: this.con.index,
                    auxiliaryText: auxtext,
                    auxiliaryTextVisible: true
                }
            });
            chrome.input.ime.setCandidates({
                contextID:this.context,
                candidates:this.con.candidate
            });
            if( this.con.index >= 0 ){
                chrome.input.ime.setCursorPosition({
                    contextID:this.context,
                    candidateID:curpos 
                })
            }
        }
    }

    showCompositionAnd( mode ){        // バインド関数
        this.showComposition();
        if (this.con.fo.isAvailable()) this.showCandidates( mode );     // fifo 空白文字以外もあるときは候補表示する
    }

    undoConvert( mode ){
        if( this.undo() ) this.showCompositionAnd( mode );  // 表示と変換候補窓を更新.
    }

    //  別の候補文字を設定する.
    // 呼び出し元はcandidate.length > 0 を要確認.
    otherCandidate( updown, mode ){
        this.convCandidate = true;
        if( this.con.indexUpDown( updown ) ) return true;   // IME変更要求
        this.showCompositionAnd( mode );
        return false;
    }

    translateKana2( Hira2Kana ){
        this.con.convertKana2( Hira2Kana );
        this.convCandidate = true;
        this.showComposition();
    }
}

class Commit{
    constructor(render, fifo)
    {
        this.rn = render;
        this.fo = fifo;
    }

    commitText( text ){ // 文字確定.
        chrome.input.ime.commitText({
            "contextID": this.rn.context, 
            "text": text
        });
    }

    commitOne( moji ){  // 一文字確定
        this.commitText( moji );
        if( this.fo.isEmpty() ){    // FIFO が空の場合
            this.rn.clearComposition();
        }
        else{
            this.rn.convCandidate = false;  // 空でなくてもこれだけは
        }
    }

    commitFO(){                         // FIFOから一個出力
        const moji = this.fo.pullone();
        if( moji ) this.commitOne( moji );
    }

    pushAndCommitIfNeed( moji ){
        console.log(`pc(${this.fo.bufptr}):${moji}`);
        if( this.fo.pushOne( moji )) return false;
        this.commitOne( moji );
        return true;
    }

    //  先頭の検索キーを確定させる
    preCommit(){
        //  異状停止: 入力無し状態で呼ばれたくない。デバッグ用に停止コードを仕込む.
        //if( this.rn.con.data.length <= 0 || this.fo.isEmpty() ){ //---------------------------
        //    console.log(`@@ Halt-preCommit: data=${this.rn.con.data}, inbuf=${this.fo.inbuf}`);
        //    while(true);        // debug stop
        //}   //---------------------------------------------------------------------------

        //  候補選択がない場合は 未変換のまま.
        const validiate = this.rn.con.candidate[this.rn.con.index].candidate;
        let optionext = "";
        console.log( `preCmt>${validiate}-${this.rn.con.candidate[this.rn.con.index].candidate}(${this.rn.con.index})` );
        this.fo.substr( this.rn.con.data[0][0].length );

        // 確定オプション: data 二段目が 「てにをは」なら二段目も確定させる.
        if( this.rn.con.data.length > 1 ){
            const optionmoji = "てにをはのもでがと、。";
            if( optionmoji.indexOf( this.rn.con.data[1][0] ) >= 0 ){
                optionext = this.rn.con.data[1][0];      // 二段目を追加確定.
                this.fo.substr( this.rn.con.data[1][0].length );
                this.rn.con.data.splice(1,1);            // 二段目も消しておく.
            }
        }

        this.commitText( validiate+optionext );
        return validiate;
    }

    //  先頭候補確定.
    commitTopCandidate( mode ){
        let allclear = false;
        console.log(`cmtTop>${this.rn.con.data}/${this.fo.inbuf}/${this.rn.con.index}`);
        // 最前一個を確定させる.
        const text = this.fo.pullTop();
        if( text ) this.commitText( text );
        else if( this.rn.con.data.length > 0 ) PrefixOne();
        if( !this.fo.isEmpty() ){
            this.rn.showCompositionAnd( mode );         // 残りの文字を表示.
        } else {
            this.rn.clearComposition();
            allclear = true;
        }
        console.log(`cmdTop<${this.rn.con.data}/${this.fo.inbuf}`);
        return allclear;
    }


}

class Dictionary{
    constructor(){
        this.mode = 4;          // 0-google, 1-google url応答待ち, 2-不揮発辞書, 3-揮発辞書, 4-起動前, 7-特殊.
        this.ramp = 0;          // 辞書まとめ書き用変数.
        this.rokushiki = [];    // 辞書 Version 3 以降.
        this.opened = false;    // 辞書がOpen済の判断.
        this.volatile = [];     // 揮発辞書.
//        this.specialkey = 0;    // 特殊キー対応Index.
        this.interval = -1;     // 辞書出力用1
        this.dictline = 1;      // 辞書出力用2
        this.open();
    }

    open(){
        // storage.local.get()が非同期で呼ばれるのでasync-awaitを使う
        console.log(`Preparing rokushiki dictionary...`);
        (async () => {
            await chrome.storage.local.get(['Rokushiki'], (result) => {
                this.rokushiki = result.Rokushiki;
                if(this.rokushiki == undefined) this.rokushiki = [[4,0]];
    //            if(this.rokushiki[0].length <2) this.rokushiki.splice(0,1,[4,0]);   // Dict ver up
    //            KeyStyle = dic.rokushiki[0][1];
                console.log(`...Open Rokushiki dictionary`);
                this.opened = true;
            });
        })();
    }

    search( key ){
        var entryindex = 0;
        for( var depth = 1; depth < this.rokushiki.length; depth++ ){
            if( this.rokushiki[depth][0] == key ){
                entryindex = depth;
                break;            
            }
        }
        return entryindex;
    }

    getEntry( entryindex, code ){
        let tagEntry = structuredClone(this.rokushiki[entryindex]); // entryを複製.対象エントリ用ワーク.
        //console.log(`**de>${code}::${tagEntry}`);
        // 変換データ側の修正.
        if( code == tagEntry[3][0] ){               // 変換候補筆頭と同じ場合.
            if( tagEntry[2] < 32 ) tagEntry[2]++;   // 強制変換値を変更. エントリはそのままで良い.
        } else {
            let pos = tagEntry[3].indexOf( code );  // 変換コードが存在する位置を特定.
            if( pos >= 0 ) tagEntry[3].splice( pos, 1 );    // 変換コードを一旦削除.
            if( tagEntry[2] < 4 ){                  // 強制カウント4未満なら筆頭を書き換え.
                tagEntry[3].unshift( henkancode );  // 変換確定文字を先頭に追加.
                tagEntry[2] = 0;                    // 強制変換値は初期化.
            } else {
                tagEntry[3].splice( 1, 0, henkancode ); // 変換確定文字を2個目に追加.
                tagEntry[2]--;                      // 強制変換値を減算.
            }
        }
        for( let pos = 0; pos < 5; pos++ ){                 // loop数の5回は failsafe設計.
            let mojiInx = tagEntry[3].indexOf( code, 2 );   // 2以降の変換確定文字を削除.
            if( mojiInx >= 0 ) tagEntry[3].splice( mojiInx, 1 );  // 同じ要素を削除.
        }

        tagEntry[1] += 1;                   // エントリ更新カウントをアップ.
        this.rokushiki.splice( entryindex, 1 );   // 変換対象エントリを一旦削除.
        return tagEntry;
    }

    engage( tagEntry, entryindex ){    // 登録点を探して登録.
        // 検索キーの長さ別に範囲の絞りこむ.
        let kenkey = [tagEntry[0].length, 0, 1 ];
        for( let span = 1; span < entryindex; span++ ){
            let tagentlen = this.rokushiki[span][0].length;
            if( kenkey[1] == 0 ){
                if( tagentlen <= kenkey[0] ) kenkey[1] = span;
            } else {
                if( this.rokushiki[span][0].length < kenkey[0]) break;
                kenkey[2] = span;
            }
        }
        if( kenkey[1] == 0 ) kenkey[1] = entryindex;    // entryindex制限で範囲検索が終了した場合.
        if( kenkey[2] > kenkey[1] ){ 
            let tagCount = tagEntry[1]; 
            for( let limit = 0; limit < 256; limit++ ){
                let cpo = (kenkey[1] + kenkey[2]);  //  検索範囲内の中央.
                cpo >>= 1;                          //  int型保持のため.
                if( kenkey[1] >= kenkey[2] ) break; // 検索終了.
                if( this.rokushiki[cpo][1] <= tagCount ){ // 中央が低いか同じなら上を検索.
                    kenkey[2] = cpo;
                } else kenkey[1] = cpo+1;
            }
        } else kenkey[2] = kenkey[1];
        this.rokushiki.splice( kenkey[2], 0, tagEntry );  // 登録点に…  エントリ追加登録.
        console.log(`*new>(${kenkey[2]})${tagEntry}`);
    }

    // ひらがな文字判斷　: 文字列がひらがなだけの場合は true
    kanaOnly( tagmoji ){
        return (tagmoji.match(/^[ぁ-ゞ]+$/g) != null);  // ひらがな範囲のみの構成かを判断.
    }

    // カタカナ文字判斷　: 文字列がカタカナだけの場合は true
    kataOnly( tagmoji ){
        return (tagmoji.match(/^[ァ-ヾ]+$/g) != null);  // ひらがな範囲のみの構成かを判断.
    }

    // 漢字文字判斷　: 文字列が漢字だけの場合は true
    kanjiOnly( tagmoji ){
        return (tagmoji.match(/^[一-鿯]+$/g) != null);  // 漢字範囲のみの構成かを判断.
    }

    // 前後一致を回避 : 二文字は出来るだけ残す.
    removeKana( henkan, kakutei ){
        let removed = 0;
    //    console.log(`reKa>${henkan}/${kakutei}`)
        for( let limit = 0; limit < henkan.length; limit++ ){
            if( henkan.charCodeAt(0) == kakutei.charCodeAt(0) ){    // 元と同じ?
                henkan  = henkan.substr( 1 );
                kakutei = kakutei.substr( 1 );
                removed++;
            } else break;
        }
        for( let limit = henkan.length; limit > 0; limit-- ){
            if( henkan.length <= 2 ) break;             // 二文字は残したい.
            if( henkan.charCodeAt(henkan.length-1) == kakutei.charCodeAt(kakutei.length-1) ){    // 元と同じ?
                henkan  = henkan.substr( 0, henkan.length-1 );
                kakutei = kakutei.substr( 0, kakutei.length-1 );
                removed++;
            } else break;
        }
    //    console.log(`reKa<${henkan}/${kakutei}`)
        const ret = [henkan, kakutei, removed];
        return ret;
    }

    // キャッシュ辞書の登録.
    saveCache( key, code ){
        let volone = [ key, code, this.kanjiOnly( code ) ];       // 揮発辞書エントリ.
        if( this.volatile.length === 0 ) this.volatile.push( volone );
        else {
            let index = -1;
            for( let pos = 0; pos < this.volatile.length; pos++ ){
                if( this.volatile[pos][0] === volone[0] && this.volatile[pos][1] === volone[1] ){
                    index = pos;
                    break;
                }
            }
    //        console.log(`SV:(${index})${volone}`);
            if( index >= 0 ) this.volatile.splice( index, 1 );      // 同じエントリは削除.
            this.volatile.push( volone );                           // 末尾に登録.
            while( this.volatile.length > 512 ) this.volatile.splice(0,1);  // 登録数制限 256
        }
    }

    saveRokushiki(){
        console.log(`**Save Local`);
        return new Promise(resolve => {
            chrome.storage.local.set({ 
                Rokushiki: this.rokushiki,
                Voldict: this.volatile
            }, resolve);
        });
    }

    /************/
    /* 辞書登録 */
    /* 入力: 検索文字 = data[0][0] -> ひらがな           */
    /*       変換文字 = code -> 変換済文字 */
    /******************************************************/
    saveEntry2Rokushiki( cnv, code ){
        // 異常値のガードをいれておきます. Index == 0 は非変換となります.
        if( cnv.candidate.length <= 1 || code.length <= 0 || !this.open ) return -1;   // 異常値のガード.
        if( this.kanaOnly( code ) ) return -1;   // かなだけの登録は NG

        let key = cnv.data[0][0];           // 検索キー.　dataの検索文字で検索要.
        console.log(`*Save(${this.rokushiki.length})=${code}:${key}/${cnv.index}/${this.mode}`);

        // Debug codes
        if( code.length > key.length * 5 ){
            console.log(`@@ Error : ignore too large code`);
            console.log(`key:${key} code:${code}`);
            return -1;
        }

        if( this.mode === 3 ){              // 揮発辞書
            key = cnv.candidate[cnv.index].annotation;
            console.log(`vd:${con.index}/${kensakuKey}:${con.candidate[con.index].candidate}/`);
        }
        this.saveCache( key, code );        // 揮発辞書への登録.
        // 前処理 = ひらがな除外.
        const keycode = this.removeKana( key, code );   // 前処理 = ひらがな除外.
        key  = keycode[0];
        code = keycode[1];

        //　検索文字列のエントリを探す.
        let entryindex = this.search( key );  // 検索キー登録場所を探す.
        let tagEntry = [];
        if( entryindex <= 0 ){                      // 検索文字が辞書に存在しない場合.
            // -----------------------------------------------------------
            // (注意)検索キー 未登録 且つ 変換文字が同一であれば 何もせずに終了.
            if( key === code )  return 0;
            // -----------------------------------------------------------
            tagEntry = [ key, 0, 0, [code]];   // 登録エントリ
            if( this.rokushiki.length > 65000 ) this.rokushiki.pop();  // 辞書の肥大化防止.
            entryindex = this.rokushiki.length;
        } else {
            tagEntry = this.getEntry( entryindex, code );
            // 辞書のスリム化(変換候補数の制限)
            while( tagEntry[3].length > 256 ) tagEntry[3].pop();    //  一番後ろの候補から削除.
        }

        // 変換データ以外の候補も必要に応じて登録.
        if( keycode[2] === 0 ){         // 文字を減らした場合は登録回避.
            for( let koinx = 1; koinx < cnv.candidate.length; koinx++ ){
                let tagcand = cnv.candidate[koinx].candidate;
                if( !this.kanaOnly( tagcand ) && !this.kataOnly( tagcand )){    // かなだけの登録は NG
                    let mojiInx = tagEntry[3].indexOf( tagcand );               // エントリ内を検索.
                    if( mojiInx < 0 ){
                        tagEntry[3].push( tagcand );    // 登録がなければ後ろに追加.
                        break;                          // 一回に一個だけの登録に留める.   
                    }
                }
            }
        }

        this.engage( tagEntry, entryindex );                     // 登録点を探してて登録.

        if( tagEntry[1] > 64000 ){                              // 更新値上がり過ぎり対策.
            for( let depth=1; depth < this.rokushiki.length; depth++ )
                this.rokushiki[depth][1] >= 1;                        // 値を半分に
        }
        if( this.ramp++ >= 16 ){    // 辞書へのライト処理をまとめる. 
            this.saveRokushiki();   // 保存処理.
            this.ramp = 0;
        }
        return;
    }

    // @todo kokomade
    // テキスト群を 辞書に展開する. 「＠＠＠」キー入力時.
    // addmode: true - 追加登録, false - 置き換え登録
    saveWords( addmode, words ) {
        if( this.Rokushiki == undefined ) return;     // 辞書が開いてない場合は 何もしない.
        let wdary = words.split("]");
        for( let depth = 0; depth < wdary.length; depth++ ){
            if( wdary[depth].indexOf("[") < 0 ) break;
            let abar = wdary[depth].split("[");
            if( abar.length > 0 && abar[1].length > 2 ){
                let bbar = abar[1].split(",");
                if( bbar.length > 3 ){
                    let kouho = [];
                    for( let pos = 3; pos < bbar.length; pos++ ){
                        if( bbar[pos] != "" )
                            kouho.push( bbar[pos] );            // 候補群作成.
                    }
                    let entryindex = this.search( bbar[0] );     // 検索キー登録場所を探す.
                    if( entryindex <= 0 ){                      // 検索文字が辞書に存在しない場合.
                        let tagEntry = [ bbar[0], 0, 0, kouho]; // 登録エントリ
                        //if( this.rokushiki.length > 65000 )  this.rokushiki.pop();    // 辞書の肥大化防止.
                        entryindex = (this.rokushiki.length >> 1) + 1;      // 適当な位置へ.
                        this.rokushiki.splice( entryindex, 0, tagEntry );   // 登録.
                    } else {
                        if( !addmode ){                                     // 置き換えの場合.
                            this.rokushiki[entryindex].splice(3,1,kouho);   //  置き換え.
                        } else {                                    // 追加モード.
                            for( let pos = kouho.length-1; pos >= 0; pos-- ){
                                if( this.rokushiki[entryindex][3].indexOf( kouho[pos] ) < 0 ){
                                    this.rokushiki[entryindex][3].unshift( kouho[pos] );  // 未登録文字は登録.
                                }
                            }
                        }
                    }
                }
            }
        }
    }


}

const fifo = new FIFO();
const con = new Converter(fifo);
const ren = new Renderer(con);
const cmt = new Commit(ren,fifo);
const dic = new Dictionary();

//let context_id = -1;

//let imemode  = 4;           // 0-google, 1-google url応答待ち, 2-不揮発辞書, 3-揮発辞書, 4-起動前, 7-特殊. // classed to mode
//let rampwait = 0;           // 辞書まとめ書き用変数.      // classed to ramp
//let Niwadict  = [];         // 辞書 Version 3 以降.     // classed to rokushiki 
//let dictOpen  = false;      // 辞書がOpen済の判断.       // classed to open
//let Voldict   = [];         // 揮発辞書.                // classed to volatile
//let spkeyinx = 0;           // 特殊キー対応Index.       // classed to slecialkey
//let interval  = -1;         // 辞書出力用1              // classed
//let dictline = 1;           // 辞書出力用2              // classed

const menuInp  = "minput";
let menuArg    = [{"id": menuInp, "label": "かな"}]

//OpenNiwaDict();     // local辞書を開けておく.
//con.initialize();   // candidateの初期化.
LoadCacheDict();    // Cache Dataのロード.

chrome.input.ime.onFocus.addListener(function(context) {
    ren.context = context.contextID;
});

chrome.input.ime.onBlur.addListener(function(context) {
    ren.context = -1;
    ren.clearComposition();
    console.log(`onBlur`);
});

chrome.input.ime.onActivate.addListener(function(eng,scrtype){
    console.log(`onActivate:${eng}/${scrtype}`);
    menuItemRevise();   // menu item 更新.
    chrome.input.ime.setMenuItems({
        "engineID": engine,
        "items": menuArg
    });
});

chrome.input.ime.onMenuItemActivated.addListener(function(eng,name){
    if( eng == engine ){
        if( name == menuInp ){    // 入力モードがクリックされた.
            cmap.changeJPandUS();
            ren.clearComposition();
        }
        menuItemUpdate();           // menu Item update
    }
});

function menuItemRevise(){
    menuArg[0].label = cmap.jpmode ? "かな" : "英字"; // かな入力モード.
}

function menuItemUpdate(){
    menuItemRevise();
    chrome.input.ime.updateMenuItems({
        "engineID": engine,
        "items": menuArg
    });
}

function copyEntry( entryindex ){      // Entryを複製.
    return structuredClone(dic.rokushiki[entryindex]);
}

//  先頭候補確定.
//function fixOne(){
//    let allclear = false;
//    console.log(`fixOne>${con.data}/${fifo.inbuf}/${con.index}`);
//    // 最前一個を確定させる.
//    const text = fifo.pullTop();
//    if( text ) cmt.commitText( text );
//    else if( con.data.length > 0 ) PrefixOne();
//    if( !fifo.isEmpty() ){
//        ren.showCompositionAnd( imemode );         // 残りの文字を表示.
//    } else {
//        ren.clearComposition();
//        allclear = true;
//    }
//    console.log(`fixOne<${con.data}/${fifo.inbuf}`);
//    return allclear;
//}

//  PrefixOne: 先頭の検索キーを確定させ, 辞書に登録する.
//  入力: candidate, data, inbuf
//  出力: data, inbuf
//  操作: 辞書登録, commitText, 候補窓変更
function PrefixOne(){   // 先頭確定.
    const validiate = cmt.preCommit();

    SaveNiwaDictEntry( validiate ); // 先に変換データを保存.
    con.data.splice(0,1);           // dataの一段目を削除.
    ren.invibleCandidate();         // candidate windowの消去.

//    if( con.data.length > 0 ) makeCandidate();   // candidateの作り直し
    con.makeCandidate( dic.mode );   // candidateの作り直し
    console.log( `PrefixOne<${validiate}:${fifo.inbuf}` );
}

//  fixAll： 全確定はカーソル行表示をそのまま確定させる.
function fixAll(){  //  変換候補を全FIX.
    cmt.commitText( fifo.curbuf );
    if( con.data.length > 1 ){
        for( let depth = 1; depth < con.data.length; depth++ )
            con.data[0][0] += con.data[depth][0];
        console.log(`fixAll>${con.data[0][0]}:${fifo.curbuf}`);

        // 長文登録は避ける 文字数制限を実施.
        if( con.data[0][0].length < 16 )
            SaveNiwaDictEntry( fifo.curbuf );             // 先に変換データを保存.
    }
    con.clearData();    // dataを削除.
    ren.invibleCandidate(); // candidate windowの消去.
//    henkanAri = false;
}

//  別の候補文字を設定する.
// 呼び出し元はcandidate.length > 0 を要確認.
function setOtherCandidate( updown ){
    if( ren.otherCandidate( updown, dic.mode ) ) SelectIME();    // IME切り替え.
}

//function CommitOne( text ){   // 一文字確定.
//    // 指定された一個を確定させる.
//    ren.commitText( text );
//    ren.invibleCandidate(); // candidate windowの消去.
//    con.clearData();    // data 初期化.
//}

chrome.input.ime.onCandidateClicked.addListener(
    function(engineID, candidate, button, mouse) {
    	if(cmap.jpmode && button == "left"){
            con.index = candidate;                   // set index
            ren.showComposition();
        }
    }
);

/***************************************/
/* 以下は変換候補サーチ(IME)関連のコード  */
/***************************************/
//  IME を呼ばれた際は cursole lineも作り直しとする。
//  入力： inbuf
//  出力： data
function IME_Rokushiki(){
    if( ren.convCandidate ) PrefixOne();    // 先頭が選択済ならFIXさせる.
    if( fifo.isAvailable() ){
        dic.mode = 4;                    // ime再起動状態に設定.
        SelectIME();
    }
}

function rokushikiIME(){
    if( ren.convCandidate ) PrefixOne();    // 先頭が選択済ならFIXさせる.
    dic.mode = 4;                    // ime再起動状態に設定.
    SelectIME();
}

function SelectIME(){
//    console.log(`SI:${dic.mode}`)
    if( dic.mode != 1 ){
        con.initialize();
        if( !fifo.isEmpty() ){
            if( dic.mode == 2 ) googleIMEcgi();  // web search
            else if( dic.mode == 3 ) GetNiwaDictEntry();
            else {
                if( !GetCacheDict() )           // キャッシュ辞書検索.
                    GetNiwaDictEntry();         // キャッシュヒットなし → local search
            }
            if( dic.mode != 1 ){                 // web 
                con.makeCandidate( dic.mode );   // candidateの作り直し
                ren.showCompositionAnd( dic.mode );
            }
            else if( dic.interval < 0 )
                dic.interval = setInterval( WebResponceTimer, 32 );
        }
    }
}

// web IME の変換待ち.
function WebResponceTimer(){
    if( dic.mode == 0 ){
        clearInterval( dic.interval );
        dic.interval = -1;
        con.makeCandidate( dic.mode );   // candidateの作り直し
        ren.showCompositionAnd( dic.mode );
    }
}

/************************/
/* 以下は辞書関連のコード */
/************************/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const spkey = "@@@";
    if( dic.opened ){        // local 辞書が読まれる前は待つ.
        var saverequest = false;
        if(message.type === 'removeOne'){
            const name = message.jtext;
            console.log(`Remove:${name}`);
            var sakujyo = name.split("\t");
            if( sakujyo[1] == spkey ){              // 登録キー.
                dic.saveWords( false, sakujyo[0] ); // 置き換え登録.
            } else if( sakujyo.length == 2 && sakujyo[0].length > 0 && sakujyo[1].length > 0 ){
                var entryindex = dictSearch( sakujyo[0] );
                if( entryindex > 0 ){
                    for( var limit = 0; limit < 10; limit++ ){
                        var sakupos = dic.rokushiki[entryindex][3].indexOf( sakujyo[1] );
                        if( sakupos < 0 ) sakupos = dic.rokushiki[entryindex][3].indexOf( dic.rokushiki[entryindex][0] );
                        if( sakupos >= 0 ){
                            dic.rokushiki[entryindex][3].splice( sakupos, 1 );   // 候補削除.
                        }
                    }
                    saverequest = true;                             // 辞書保存要求
                }
                if( dic.rokushiki[entryindex].length >=3 && dic.rokushiki[entryindex][3].length <= 0 )   // 候補が全てなくなった.
                    dic.rokushiki.splice( entryindex,1 );
            }
        } else if(message.type === 'engageOne') {
            const name = message.jtext;
            console.log(`Engage:${name}`);
            var touroku = name.split("\t");
            if( touroku[1] == spkey ){              // 登録キー.
                dic.saveWords( true, touroku[0] );  // 追加登録.
            } else if( touroku.length == 2 && touroku[0].length > 0 && touroku[1].length > 0 ){
                var tagEntry   = [];
                var entryindex = dictSearch( touroku[0] );
                if( entryindex <= 0 ){
                    tagEntry = [ touroku[0], 0, 0, [touroku[1]]];   // 登録エントリ
                    entryindex = dic.rokushiki.length;
                } else {
                    tagEntry = dictGetEntry( entryindex, touroku[1] );
                }
                dictEngage( tagEntry, entryindex );                 // 登録点を探してて登録.
                saverequest = true;                                 // 辞書保存要求.
            }
        } else if(message.type === 'Clean') {
            console.log(`Debug ope.`);          // 暫定コード : 辞書の整理.
            ConvertOldtoNewDict();                  // 辞書内の整理.
        } else if(message.type === 'Save') {
            saverequest = true;                     // 辞書保存要求.
        } else if(message.type === 'DictText') {
            console.log(`Special mode`)
            dic.mode  = 7;                            // 辞書出力特殊モード. 
            dic.dictline = 0;
        }    
        if( saverequest ){
            dic.saveRokushiki();
            console.log(dic.rokushiki);
        }
    }
});

function OpenNiwaDict(){    // already classed to open
    // storage.local.get()が非同期で呼ばれるのでasync-awaitを使う
    console.log(`Preparing Niwa dictionary...`);
    (async () => {
    	await chrome.storage.local.get(['Rokushiki'], (result) => {
    	    dic.rokushiki = result.Rokushiki;
    	    if(dic.rokushiki == undefined) dic.rokushiki = [[4,0]];
            if(dic.rokushiki[0].length <2) dic.rokushiki.splice(0,1,[4,0]);   // Dict ver up
//            KeyStyle = dic.rokushiki[0][1];
            console.log(`...Open Niwa dictionary`);
            dic.opened = true;
        });
    })();
}

function dictSearch( kensakuKey ){  // already classed to search
    var entryindex = 0;
    for( var depth = 1; depth < dic.rokushiki.length; depth++ ){
        if( dic.rokushiki[depth][0] == kensakuKey ){
            entryindex = depth;
            break;            
        }
    }
    return entryindex;
}

function dictGetEntry( entryindex, henkancode ){    // already classed to getEntry
    var tagEntry = copyEntry( entryindex );         // Rokushiki entryを複製.        // 対象エントリ用ワーク.
    //console.log(`**de>${henkancode}::${tagEntry}`);
    // 変換データ側の修正.
    if( henkancode == tagEntry[3][0] ){             // 変換候補筆頭と同じ場合.
        if( tagEntry[2] < 32 ) tagEntry[2]++;       // 強制変換値を変更. エントリはそのままで良い.
    } else {
        var pos = tagEntry[3].indexOf( henkancode );    // 変換コードが存在する位置を特定.
        if( pos >= 0 ) tagEntry[3].splice( pos, 1 );    // 変換コードを一旦削除.
        if( tagEntry[2] < 4 ){                          // 強制カウント4未満なら筆頭を書き換え.
            tagEntry[3].unshift( henkancode );          // 変換確定文字を先頭に追加.
            tagEntry[2] = 0;                            // 強制変換値は初期化.
        } else {
            tagEntry[3].splice( 1, 0, henkancode );     // 変換確定文字を2個目に追加.
            tagEntry[2]--;                              // 強制変換値を減算.
        }
    }
    for( var pos = 0; pos < 5; pos++ ){                         // loop数の5回は failsafe設計.
        var mojiInx = tagEntry[3].indexOf( henkancode, 2 );     // 2以降の変換確定文字を削除.
        if( mojiInx >= 0 ) tagEntry[3].splice( mojiInx, 1 );    // 同じ要素を削除.
    }

    tagEntry[1] += 1;                   // エントリ更新カウントをアップ.
    dic.rokushiki.splice( entryindex, 1 );   // 変換対象エントリを一旦削除.
    return tagEntry;
}

function dictEngage( tagEntry, entryindex ){    // 登録点を探して登録.  // already classed to engage
    // 検索キーの長さ別に範囲の絞りこむ.
    var kenkey = [tagEntry[0].length, 0, 1 ];
    for( var span = 1; span < entryindex; span++ ){
        var tagentlen = dic.rokushiki[span][0].length;
        if( kenkey[1] == 0 ){
            if( tagentlen <= kenkey[0] ) kenkey[1] = span;
        } else {
            if( dic.rokushiki[span][0].length < kenkey[0]) break;
            kenkey[2] = span;
        }
    }
    if( kenkey[1] == 0 ) kenkey[1] = entryindex;    // entryindex制限で範囲検索が終了した場合.
    if( kenkey[2] > kenkey[1] ){ 
        var tagCount = tagEntry[1]; 
        for( var limit = 0; limit < 256; limit++ ){
            var cpo = (kenkey[1] + kenkey[2]);  //  検索範囲内の中央.
            cpo >>= 1;                          //  int型保持のため.
            if( kenkey[1] >= kenkey[2] ) break; // 検索終了.
            if( dic.rokushiki[cpo][1] <= tagCount ){ // 中央が低いか同じなら上を検索.
                kenkey[2] = cpo;
            } else kenkey[1] = cpo+1;
        }
    } else kenkey[2] = kenkey[1];
    dic.rokushiki.splice( kenkey[2], 0, tagEntry );  // 登録点に…  エントリ追加登録.
    console.log(`*new>(${kenkey[2]})${tagEntry}`);
}


/************/
/* 辞書登録 */
/* 入力: 検索文字 = data[0][0] -> ひらがな           */
/*       変換文字 = henkancode -> 変換済文字 */
/******************************************************/
function SaveNiwaDictEntry( henkancode ){           // already classed to saveEntry2Rokushiki
    // 異常値のガードをいれておきます. Index == 0 は非変換となります.
    if( con.candidate.length <= 1 || henkancode.length <= 0 || !dic.opened ) return -1;   // 異常値のガード.

    var kensakuKey = con.data[0][0];            // 検索キー.　dataの検索文字で検索要.

    if( kanaOnly( henkancode ) ) return -1;     // かなだけの登録は NG

    console.log(`*Save(${dic.rokushiki.length})=${henkancode}:${kensakuKey}/${con.index}/${dic.mode}`);

    // Debug codes
    if( henkancode.length > kensakuKey.length * 5 ){
        console.log(`@@ Error : ignore too large code`);
        console.log(`key:${kensakuKey} code:${henkancode}`);
        return -1;
    }

    if( dic.mode == 3 ){
        kensakuKey = con.candidate[con.index].annotation;
        console.log(`vd:${con.index}/${kensakuKey}:${con.candidate[con.index].candidate}/`);
    }
    SaveCache( kensakuKey, henkancode );          // 揮発辞書への登録.

    // 前処理 = ひらがな除外.
    var keycode = removeKana( kensakuKey, henkancode );  // 前処理 = ひらがな除外.
    kensakuKey  = keycode[0];
    henkancode  = keycode[1];

    //　検索文字列のエントリを探す.
    var entryindex = dictSearch( kensakuKey );  // 検索キー登録場所を探す.
    var tagEntry = [];
    if( entryindex <= 0 ){                      // 検索文字が辞書に存在しない場合.
        // -----------------------------------------------------------
        // (注意)検索キー 未登録 且つ 変換文字が同一であれば 何もせずに終了.
        if( kensakuKey == henkancode )  return 0;
        // -----------------------------------------------------------
        tagEntry = [ kensakuKey, 0, 0, [henkancode]];   // 登録エントリ
        if( dic.rokushiki.length > 65000 )  dic.rokushiki.pop();  // 辞書の肥大化防止.
        entryindex = dic.rokushiki.length;
    } else {
        tagEntry = dictGetEntry( entryindex, henkancode );
        // 辞書のスリム化(変換候補数の制限)
        while( tagEntry[3].length > 256 ) tagEntry[3].pop();    //  一番後ろの候補から削除.
    }

    // 変換データ以外の候補も必要に応じて登録.
    if( keycode[2] == 0 ){              // 文字を減らした場合は登録回避.
        for( let koinx = 1; koinx < con.candidate.length; koinx++ ){
            let tagcand = con.candidate[koinx].candidate;
            if( !kanaOnly( tagcand ) && !kataOnly( tagcand )){              // かなだけの登録は NG
                let mojiInx = tagEntry[3].indexOf( tagcand );               // エントリ内を検索.
                if( mojiInx < 0 ){
                    tagEntry[3].push( tagcand );            // 登録がなければ後ろに追加.
                    break;                                  // 一回に一個だけの登録に留める.   
                }
            }
        }
    }

    dictEngage( tagEntry, entryindex );                     // 登録点を探してて登録.

    if( tagEntry[1] > 64000 ){                              // 更新値上がり過ぎり対策.
        for( let depth=1; depth < dic.rokushiki.length; depth++ )
            dic.rokushiki[depth][1] >= 1;                        // 値を半分に
    }
    if( dic.ramp++ >= 16 ){                                 // 辞書へのライト処理をまとめる. 
        chrome.storage.local.set({Rokushiki: dic.rokushiki});     // 保存処理.
        console.log(`**Write Local`);
        dic.ramp = 0;
        SaveCacheDict();                                    // Cache辞書も保存.
    }
    return;
}

// 辞書から変換文字列を検索し、dataを作成する.
// 入力: inbuf - 変換入力文字
// 出力: data, Index
function GetNiwaDictEntry(){
    con.data = [];
    if( !dic.opened ){        // local 辞書が読まれる前は待つ.
        dic.open();
        ren.showLine( fifo.inbuf );      // 辞書が開くまでの暫定表示.
        fifo.curbuf = fifo.inbuf;
    } else {
        var tagtext  = fifo.inbuf;   // 変換対象文字列.
        var stoplimit = 64;         // 長文変換の制限.
        dic.mode = 2;                // Rokushiki IME 動作―早めに設定要.

        // textの中に変換候補文字列があるか検索.
        while( tagtext.length > 0 ){
            if( stoplimit-- <= 0 ){
                console.log(`*Stop limit* (${stoplimit}):${tagtext}`); 
            }
            var entryone  = [];     // dataに展開する1エントリ.
            for( var depth = 1; depth < dic.rokushiki.length; depth++ ){     // 辞書検索ループ.
                var etag   = copyEntry( depth );            // etag <- dic.rokushikiの参照
                var hitpos = tagtext.indexOf( etag[0] );    // 変換文字にヒットするか?
                if( hitpos >= 0 ){                          // hit
                    if( hitpos == 0 ){                      // 先頭で一致.
                        entryone = [];                  // entryone初期化.
                        entryone.push( etag[0] );       // dataにも変換前文字列を入れる.
                        entryone.push( etag[3] );       // dataに変換候補郡を入れる.
                        entryone[1].unshift( etag[0] ); // 変換候補郡先頭は検索文字.
                        con.data.push( entryone );      // dataに1エントリ追加.
 
                        if( tagtext != etag[0] ){           // 前方一致?
                            var newtag = tagtext.slice(( etag[0].length - tagtext.length ));
                            tagtext = newtag;               // 残り検索文字設定.
                            //console.log( `>> Rest:${tagtext}(${stoplimit})` );
                        } else {
                            tagtext = "";                   // 完全一致は残り検索文字無し.
                            break;
                        }
                    } else {
                        //console.log( `>> Post hit:(${hitpos})${etag}` );
                        var pretag = tagtext.split( etag[0] )[0];  // hit前の文字列切り出し.
                        entryone = [ pretag, [pretag] ];        // data 1エントリ準備
                        con.data.push( entryone );              // data 1エントリ追加.
                        var newtag = tagtext.slice( pretag.length ); // 残検索文字の切り出し.
                        tagtext = newtag;
                    }
                }
            }
            if( entryone.length <= 0 ){             // 一致なし：検索文字そのまま.
                entryone = [ tagtext, [tagtext] ];    // data 1エントリ準備
                con.data.push( entryone );           // data 1エントリ追加.
                //console.log( `>> No hit:${tagtext}` );
                break;
            }
        }
    }
}

// Google変換のデータの書式を修正. 
function googleData2MyIME( data ) {
    con.data   = data;
    //  とりあえず、最初の1エントリのみ書式修正.
    if( con.data[0][0] != con.data[0][1][0] ){                // 先頭が検索文字で無い場合.
        var pos = con.data[0][1].indexOf( con.data[0][0] );   // 検索文字の位置.
        if( pos > 0 ){
            con.data[0][1].splice( pos, 1 );         // 先頭以外の検索文字は削除.
            con.data[0][1].unshift( con.data[0][0] ); // 先頭に検索文字を追加.
        } else if( pos < 0 ){                       // 検索文字がなかった場合.
            con.data[0][1].unshift( con.data[0][0] ); // 先頭に検索文字を追加.
        }
    }
}

// Google IME での検索.
// 入力: inbuf - 変換入力文字
// 出力: data, Index
function googleIMEcgi(){
    if( fifo.isEmpty() ) return;
    var url = "http://google.com/transliterate?langpair=ja-Hira|ja&text=" + fifo.inbuf;
    dic.mode = 1;
//    console.log(`GI:${fifo.inbuf}`);
    fetch(url).then(function(response){
        return response.json();
    }).catch(function(){
        console.log("error caught at fetch()!");
    }).then(function(data){
        // 変換候補が無い場合、RokushikiIMEが起動済の場合は何もしない.
        if( data !== undefined && dic.mode === 1 ){
            dic.mode = 0;
            googleData2MyIME( data );
        }
    });
}

// ひらがな文字判斷　: 文字列がひらがなだけの場合は true
function kanaOnly( tagmoji ){                   // already classed
    return (tagmoji.match(/^[ぁ-ゞ]+$/g) != null);      // ひらがな範囲のみの構成かを判断.
}

// カタカナ文字判斷　: 文字列がカタカナだけの場合は true
function kataOnly( tagmoji ){                   // already classed
    return (tagmoji.match(/^[ァ-ヾ]+$/g) != null);      // ひらがな範囲のみの構成かを判断.
}

// 漢字文字判斷　: 文字列が漢字だけの場合は true
function kanjiOnly( tagmoji ){                  // already classed
    return (tagmoji.match(/^[一-鿯]+$/g) != null);      // 漢字範囲のみの構成かを判断.
}


// 前後一致を回避 : 二文字は出来るだけ残す.
function removeKana( henkan, kakutei ){     // already classed to removeKana
    var removed = 0;
//    console.log(`reKa>${henkan}/${kakutei}`)
    for( var limit = 0; limit < henkan.length; limit++ ){
        if( henkan.charCodeAt(0) == kakutei.charCodeAt(0) ){    // 元と同じ?
            henkan  = henkan.substr( 1 );
            kakutei = kakutei.substr( 1 );
            removed++;
        } else break;
    }
    for( var limit = henkan.length; limit > 0; limit-- ){
        if( henkan.length <= 2 ) break;             // 二文字は残したい.
        if( henkan.charCodeAt(henkan.length-1) == kakutei.charCodeAt(kakutei.length-1) ){    // 元と同じ?
            henkan  = henkan.substr( 0, henkan.length-1 );
            kakutei = kakutei.substr( 0, kakutei.length-1 );
            removed++;
        } else break;
    }
//    console.log(`reKa<${henkan}/${kakutei}`)
    var ret = [henkan, kakutei, removed];
    return ret;
}

// キャッシュ辞書の登録.
function SaveCache( key, code ){    // already classed to saveCache
    var volone = [ key, code, kanjiOnly( code ) ];       // 揮発辞書エントリ.
    if( dic.volatile.length == 0 ) dic.volatile.push( volone );
    else {
        var index = -1;
        for( var pos = 0; pos < dic.volatile.length; pos++ ){
            if( dic.volatile[pos][0] == volone[0] && dic.volatile[pos][1] == volone[1] ){
                index = pos;
                break;
            }
        }
//        console.log(`SV:(${index})${volone}`);
        if( index >= 0 ) dic.volatile.splice( index, 1 );        // 同じエントリは削除.
        dic.volatile.push( volone );                             // 末尾に登録.
        while( dic.volatile.length > 256 ) dic.volatile.splice(0,1);  // 登録数制限 256
    }
}

// キャッシュ辞書の検索.
// 前方一致で検索する.
// 出力：[[変換候補,よみ],....]
function SearchCache( tagword ){
    var hitque = [];
    var insinx = 0;
    var taglen = tagword.length;
    var vlimit = dic.volatile.length > 6 ? 6 : dic.volatile.length;
    dic.mode = 3; 
    for( var inx = 0; inx < vlimit; inx++ ){
        if( taglen <= dic.volatile[inx][0].length ){
            if( tagword == dic.volatile[inx][0] ){               // 完全一致の場合.
                hitque.unshift([dic.volatile[inx][0],dic.volatile[inx][1]]);
                insinx++;
                if( dic.volatile[inx][2] && inx < dic.volatile.length-1 ){    // 漢字のみの場合は結合候補を筆頭.
                    hitque.splice(1,0,[dic.volatile[inx][0]+dic.volatile[inx+1][0],dic.volatile[inx][1]+dic.volatile[inx+1][1]]);
                    insinx++;
                }
            }
            else {
                var cutword = dic.volatile[inx][0].slice(0,taglen);
                if( cutword == tagword ){
                    hitque.splice(insinx, 0, [dic.volatile[inx][0],dic.volatile[inx][1]]);    // 前方一致.
                    if( dic.volatile[inx][2] && inx < dic.volatile.length-1 ){    // 漢字のみの場合は結合候補を追加.
                        hitque.splice(1,0,[dic.volatile[inx][0]+dic.volatile[inx+1][0],dic.volatile[inx][1]+dic.volatile[inx+1][1]]);
                    }
                }
            }
        }
    }
    return hitque;
}

// キャッシュ辞書から data を作成.
function GetCacheDict(){
    con.data = [[fifo.inbuf,[fifo.inbuf]]];
    var hitque = SearchCache( fifo.inbuf );
    if( hitque.length > 0 ){
        for( var depth = 0; depth < hitque.length; depth++ ){
            con.data[0][1].push( hitque[depth][1] );
            con.data[0][1].push( hitque[depth][0] );
        }
    }
    return (hitque.length > 0);
}

// キャッシュ辞書のロード.
function LoadCacheDict(){
    console.log(`Preparing Cache table...`);
    (async () => {
    	await chrome.storage.local.get(['Voldict'], (result) => {
    	    dic.volatile = result.Voldict;
            if(dic.volatile === undefined) dic.volatile = [];
            console.log(`...Loaded Cache table`);
        });
    })();
}

// キャッシュ辞書の保存.
function SaveCacheDict(){
    chrome.storage.local.set({Voldict: dic.volatile});     // 保存処理.
    console.log(`**Write Cache`);
}

// 辞書のテキスト書き出し
// chromeの拡張機能では Secureの為、ファイルへの書き出しは制限されている.
// ファイルの書き出しは実行できないが、Text化して sendTextしてみる.
function MakeTextNiwadictionary(){
    if( dic.rokushiki == undefined ) return;     // 辞書が開いてない場合は 何もしない.
    var startline = dic.dictline;
    dic.dictline = startline+2;
    if( dic.dictline >= dic.rokushiki.length ){
        dic.dictline = dic.rokushiki.length;      // 最後まで出力.
        dic.mode = 4;                    // 通常モードに戻しておく.
    }
    for( var depth = startline; depth < dic.dictline; depth++ ){
        var wbuf  = "[";
        if( depth == 0 ){
            wbuf += dic.rokushiki[depth][0].toString() + "," + dic.rokushiki[depth][1];
        }
        else if( dic.rokushiki[depth][0].indexOf(",") < 0 ){                  // ',' があるばあいはファイル出力しない.
            wbuf += dic.rokushiki[depth][0].toString() + "," + dic.rokushiki[depth][1] + "," + dic.rokushiki[depth][2];
            for( var pos = 0; pos < dic.rokushiki[depth][3].length; pos++ ){
                if( dic.rokushiki[depth][3][pos].indexOf(",") < 0 ){     // ',' があるばあいはファイル出力しない.
                    wbuf += ",";
                    wbuf += dic.rokushiki[depth][3][pos].toString();
                }
            }
        }
        wbuf += "],\n";               // 改行コード.
        cmt.commitText( wbuf );
    }
    if( dic.mode == 7 && dic.interval < 0 ){
        dic.interval = setInterval( MakeTextNiwadictionary, 240 );
    } else if( dic.mode == 4 && dic.interval >= 0 ){
        clearInterval( dic.interval );
        dic.interval = -1;
    }
}

// テキスト群を 辞書に展開する. 「＠＠＠」キー入力時.
// addmode: true - 追加登録, false - 置き換え登録
function saveWordsToDict( addmode, words ) {        // already classed to saveWords
    if( dic.rokushiki == undefined ) return;     // 辞書が開いてない場合は 何もしない.
    var wdary = words.split("]");
    for( var depth = 0; depth < wdary.length; depth++ ){
        if( wdary[depth].indexOf("[") < 0 ) break;
        var abar = wdary[depth].split("[");
        if( abar.length > 0 && abar[1].length > 2 ){
            var bbar = abar[1].split(",");
            if( bbar.length > 3 ){
                var kouho = [];
                for( var pos = 3; pos < bbar.length; pos++ ){
                    if( bbar[pos] != "" )
                        kouho.push( bbar[pos] );            // 候補群作成.
                }
                var entryindex = dictSearch( bbar[0] );     // 検索キー登録場所を探す.
                if( entryindex <= 0 ){                      // 検索文字が辞書に存在しない場合.
                    var tagEntry = [ bbar[0], 0, 0, kouho]; // 登録エントリ
                    //if( dic.rokushiki.length > 65000 )  dic.rokushiki.pop();  // 辞書の肥大化防止.
                    entryindex = (dic.rokushiki.length >> 1) + 1;        // 適当な位置へ.
                    dic.rokushiki.splice( entryindex, 0, tagEntry );     // 登録.
                } else {
                    if( !addmode ){                             // 置き換えの場合.
                        dic.rokushiki[entryindex].splice(3,1,kouho); //  置き換え.
                    } else {                                    // 追加モード.
                        for( var pos = kouho.length-1; pos >= 0; pos-- ){
                            if( dic.rokushiki[entryindex][3].indexOf( kouho[pos] ) < 0 ){
                                dic.rokushiki[entryindex][3].unshift( kouho[pos] );  // 未登録文字は登録.
                            }
                        }
                    }
                }
            }
        }
    }
}

// 辞書版数のコンバート.
function ConvertOldtoNewDict(){
    if( dic.rokushiki.length <= 0 ){
        dic.rokushiki = [[4,0]];       // ver.4　辞書初期化.
        return;
    }
}

//---- 居眠り防止 ------------------------------------
async function setUpOffscreen() {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'To keep service worker',
    });
}

// 拡張機能インストール時にoffscreen作成
chrome.runtime.onInstalled.addListener(() => {
    setUpOffscreen();
});
  
// ブラウザ起動時にoffscreen作成
chrome.runtime.onStartup.addListener(() => {
    setUpOffscreen();
});