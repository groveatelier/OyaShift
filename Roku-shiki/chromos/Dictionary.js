/*  2026.06.16 23:00
    六式IME‐辞書
*/

class Dictionary{
    constructor(converter){
        this.state = {
            SLEEP: 0,       // 起動前
            READY: 1,       // 起動完了
            CACHE: 2,       // cache辞書
            LOCAL: 3        // ローカル & Google辞書
        };
        this.cn = converter;
        this.step = this.state.SLEEP;
        this.ramp = 0;          // 辞書まとめ書き用変数.
        this.rokushiki = [];    // 辞書 Version 3 以降.
        this.volatile = [];     // 揮発辞書.
        this.controller = null; // Background処理制御
        this.hitdepth = 0;      // 辞書検索開始位置-1
        this.spkey = "@@@";
        this.open();
        this.openCache();
    }

    isSleepState(){ return (this.step === this.state.SLEEP ); }
    isReadyOrCacheState(){ return (this.step === this.state.READY || this.step === this.state.CACHE); }
    isCacheState(){ return (this.step === this.state.CACHE ); }
    isLocalState(){ return (this.step === this.state.LOCAL ); }
    setReadyState(){ this.step = this.state.READY; this.hitdepth = 0; }
    setLocalState(){ this.step = this.state.LOCAL; this.hitdepth = 0; }
    isSearchend(){ return (this.hitdepth === this.rokushiki.length); }

    async open(){
        // debug mode fource initilaize
        //this.rokushiki = [[4,0]]; this.step = this.state.READY; return;
        console.log(`Preparing rokushiki dictionary...`);
        const result = await chrome.storage.local.get(['Rokushiki']);
        // Null合体演算子（??）で undefined 時の初期化も1行に
        this.rokushiki = result.Rokushiki ?? [[4, 0]]; 
        console.log(`...Open Rokushiki dictionary:${this.rokushiki.length}`);
        this.step = this.state.READY;
    }

    // キャッシュ辞書のロード.
    async openCache(){
        console.log(`Preparing Cache table...`);
        const result = await chrome.storage.local.get(['Voldict']);
        this.volatile = result.Voldict ?? [];
        console.log(`...Loaded Cache table:${this.volatile.length}`);
    }

    search( key ){
        let entryindex = 0;
        for( let depth = 1; depth < this.rokushiki.length; depth++ ){
            if( this.rokushiki[depth][0] === key ){
                entryindex = depth;
                break;            
            }
        }
        return entryindex;
    }

    getEntry( entryindex, code ){
        let tagEntry = structuredClone(this.rokushiki[entryindex]); // entryを複製.対象エントリ用ワーク.
        // 変換データ側の修正.
        if( code == tagEntry[3][0] ){               // 変換候補筆頭と同じ場合.
            if( tagEntry[2] < 32 ) tagEntry[2]++;   // 強制変換値を変更. エントリはそのままで良い.
        } else {
            let pos = tagEntry[3].indexOf( code );  // 変換コードが存在する位置を特定.
            if( pos >= 0 ) tagEntry[3].splice( pos, 1 );    // 変換コードを一旦削除.
            if( tagEntry[2] < 4 ){              // 強制カウント4未満なら筆頭を書き換え.
                tagEntry[3].unshift( code );    // 変換確定文字を先頭に追加.
                tagEntry[2] = 0;                // 強制変換値は初期化.
            } else {
                tagEntry[3].splice( 1, 0, code ); // 変換確定文字を2個目に追加.
                tagEntry[2]--;                  // 強制変換値を減算.
            }
        }
        // 3番目（インデックス2）以降の候補から、重複する code を綺麗に排除する
        const head = tagEntry[3].slice(0, 2);
        const tail = tagEntry[3].slice(2).filter(c => c !== code);
        tagEntry[3] = [...head, ...tail];

        tagEntry[1] += 1;                   // エントリ更新カウントをアップ.
        this.rokushiki.splice( entryindex, 1 );   // 変換対象エントリを一旦削除.
        return tagEntry;
    }

    engage( tagEntry, entryindex ){    // 登録点を探して登録.
        console.log(`engage:${tagEntry}/${entryindex}`);
        if( tagEntry[0] === '' ) return;     // Null文字の登録は不可
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
        console.log(`*new>(${kenkey[2]})${tagEntry[3][0]}/${tagEntry[0]}/`);
    }

    // ひらがな文字判斷　: 文字列がひらがなだけの場合は true
    kanaOnly( tagmoji ){
        //return /^[ぁ-ゞ]+$/g.test(tagmoji);  // ひらがな範囲のみの構成かを判断.
        return /^[ぁ-ん]+$/g.test(tagmoji);
    }

    // カタカナ文字判斷　: 文字列がカタカナだけの場合は true
    kataOnly( tagmoji ){
        //return /^[ァ-ヾ]+$/g.test(tagmoji);  // カタカナ範囲のみの構成かを判断.
        return /^[ァ-ヶ]+$/g.test(tagmoji);
    }

    // 漢字文字判斷　: 文字列が漢字だけの場合は true
    kanjiOnly( tagmoji ){
        //return /^[一-鿯]+$/g.test(tagmoji);  // 漢字範囲のみの構成かを判断.
        return /^[一-龠々]+$/g.test(tagmoji);
    }

    // 前後一致を回避 : 二文字は出来るだけ残す.
    removeKana( henkan, kakutei ){
        let removed = 0;
    //    console.log(`reKa>${henkan}/${kakutei}`)
        for( let limit = 0; limit < henkan.length; limit++ ){
            if( henkan.charCodeAt(0) == kakutei.charCodeAt(0) ){    // 元と同じ?
                henkan  = henkan.slice( 1 );
                kakutei = kakutei.slice( 1 );
                removed++;
            } else break;
        }
        for( let limit = henkan.length; limit > 0; limit-- ){
            if( henkan.length <= 2 ) break;             // 二文字は残したい.
            if( henkan.charCodeAt(henkan.length-1) == kakutei.charCodeAt(kakutei.length-1) ){    // 元と同じ?
                henkan  = henkan.slice( 0, -1 );    // 後ろから一文字削除.
                kakutei = kakutei.slice( 0, -1 );
                removed++;
            } else break;
        }
    //    console.log(`reKa<${henkan}/${kakutei}`)
        const ret = [henkan, kakutei, removed];
        return ret;
    }

    // キャッシュ辞書の検索.
    // 前方一致で検索する.
    // 出力：[[変換候補,よみ],....]
    searchCache( tagword ){
        let hitque = [];
        let insinx = 0;
        const taglen = tagword.length;
        const vlimit = this.volatile.length - 1;
        for( let inx = 0; inx <= vlimit; inx++ ){
            if( taglen <= this.volatile[inx][0].length ){
                if( tagword === this.volatile[inx][0] ){               // 完全一致の場合.
                    hitque.unshift([this.volatile[inx][0],this.volatile[inx][1]]);
                    insinx++;
                    if( this.volatile[inx][2] && inx < vlimit ){    // 漢字のみの場合は結合候補を筆頭.
                        hitque.splice(1,0,[this.volatile[inx][0]+this.volatile[inx+1][0],this.volatile[inx][1]+this.volatile[inx+1][1]]);
                        insinx++;
                    }
                }
                else {
                    let cutword = this.volatile[inx][0].slice(0,taglen);
                    if( cutword === tagword ){
                        hitque.splice(insinx, 0, [this.volatile[inx][0],this.volatile[inx][1]]);    // 前方一致.
                        if( this.volatile[inx][2] && inx < vlimit ){    // 漢字のみの場合は結合候補を追加.
                            hitque.splice(1,0,[this.volatile[inx][0]+this.volatile[inx+1][0],this.volatile[inx][1]+this.volatile[inx+1][1]]);
                        }
                    }
                }
            }
        }
        return hitque;
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
            if( index >= 0 ) this.volatile.splice( index, 1 );      // 同じエントリは削除.
            this.volatile.push( volone );                           // 末尾に登録.
            if (this.volatile.length > 512) {
                this.volatile = this.volatile.slice(-512); // 末尾から512個だけ残す 登録数制限 512
            }
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
    saveEntry2Rokushiki( code ){
        // 異常値のガードをいれておきます. Index == 0 は非変換となります.
        if( this.cn.candidate.length <= 1 || code.length <= 0 ) return -1;   // 異常値のガード.
        if( this.kanaOnly( code ) ) return -1;   // かなだけの登録は NG

        let key = this.cn.data[0][0];           // 検索キー.　dataの検索文字で検索要.
        //1console.log(`*Save(${this.rokushiki.length})=${code}:${key}/${this.cn.index}/${this.step}`);

        // Debug codes
        if( code.length > key.length * 5 ){
            console.log(`@@ Error : ignore too large code, key:${key} code:${code}`);
            return -1;
        }

        if( this.isCacheState() ){              // 揮発辞書
            key = this.cn.candidate[this.cn.index].annotation;
            //console.log(`vd:${this.cn.index}/${key}:${this.cn.candidate[this.cn.index].candidate}/`);
        }
        this.saveCache( key, code );        // 揮発辞書への登録.
        // 前処理 = ひらがな除外.
        const keycode = this.removeKana( key, code );   // 前処理 = ひらがな除外.
        key  = keycode[0];
        code = keycode[1];

        //　検索文字列のエントリを探す.
        const entryData = this.prepareEntryEngage( key, code );
        if( entryData == null ) return;    // 登録不要の場合は終了.
        let entryindex = entryData[1];
        let tagEntry = entryData[0];
        // 変換データ以外の候補も必要に応じて登録.
        if( this.isLocalState() && keycode[2] === 0 ){  // ローカルモードで他に候補があれば…
            for( let koinx = 1; koinx < this.cn.candidate.length; koinx++ ){
                let tagcand = this.cn.candidate[koinx].candidate;
                if( !this.kanaOnly( tagcand ) && !this.kataOnly( tagcand )){    // かなだけの登録は NG
                    let mojiInx = tagEntry[3].indexOf( tagcand );               // エントリ内を検索.
                    if( mojiInx < 0 ){
                        tagEntry[3].push( tagcand );    // 登録がなければ後ろに追加.
                        break;                          // 一回に一個だけの登録に留める.   
                    }
                }
            }
        }
        //console.log(`*Before Engage>(${entryindex})${tagEntry}`);
        this.engage( tagEntry, entryindex );                     // 登録点を探してて登録.

        if( tagEntry[1] > 64000 ){                              // 更新値上がり過ぎり対策.
            for( let depth=1; depth < this.rokushiki.length; depth++ )
                this.rokushiki[depth][1] >= 1;                        // 値を半分に
        }
        if( this.ramp++ >= 32 ){    // 辞書へのライト処理をまとめる. 
            this.saveRokushiki();   // 保存処理.
            this.ramp = 0;
        }
        return;
    }

    prepareEntryEngage( key, code ){
        //　検索文字列のエントリを探す.
        let entryindex = this.search( key );  // 検索キー登録場所を探す.
        let tagEntry = [];
        if( entryindex <= 0 ){      // 検索文字が辞書に存在しない場合.
            // -----------------------------------------------------------
            // (注意)検索キー 未登録 且つ 変換文字が同一であれば 何もせずに終了.
            if( key === code )  return null;
            // -----------------------------------------------------------
            tagEntry = [ key, 0, 0, [code]];    // 登録エントリ作成
            if( this.rokushiki.length > 65000 ) this.rokushiki.pop();   // 辞書の肥大化防止.
        } else {
            tagEntry = this.getEntry( entryindex, code );   // 既存エントリの取得＆code追加.
            // 辞書のスリム化(変換候補数の制限)
            while( tagEntry[3].length > 256 ) tagEntry[3].pop();    //  一番後ろの候補から削除.
        }
        //console.log(`*prepare>(${entryindex})${tagEntry}`);
        entryindex = this.rokushiki.length;
        if( entryindex > 128 ) entryindex >>= 1; // 適当な位置に登録 
        return [tagEntry, entryindex];
    }

    // 辞書から変換文字列を検索し、dataを作成する.
    // 入力: inbuf - 変換入力文字
    // 出力: data, Index
    getData(){
        this.cn.data = [];
        if( this.isSleepState() ){      // local 辞書が読まれる前は待つ.
            this.cn.fo.curbuf = this.cn.fo.inbuf;
        } else {
            let tagtext  = this.cn.fo.inbuf;    // 変換対象文字列.
            let stoplimit = 64;         // 長文変換の制限.

            // 句読点は排除して検索する → これをすると文字が消えるinbuf作り直し時に
            //if( tagtext.indexOf("。") > 0 ) tagtext = tagtext.split("。")[0];
            //if( tagtext.indexOf("、") > 0 ) tagtext = tagtext.split("、")[0];

            // textの中に変換候補文字列があるか検索.
            while( tagtext.length > 0 ){
                if( stoplimit-- <= 0 ){
                    console.log(`*Stop limit* (${stoplimit}):${tagtext}`);
                    break;
                }

                let entryone  = [];     // dataに展開する1エントリ.
                //console.log(`検索文字:${tagtext}/${this.hitdepth}`);
                for( this.hitdepth++; this.hitdepth < this.rokushiki.length; this.hitdepth++ ){   // 辞書検索ループ.
                    let hitpos = tagtext.indexOf( this.rokushiki[this.hitdepth][0] );   // 変換文字にヒットするか?
                    //console.log(`gD1:${etag}/${hitpos}/${this.rokushiki[depth]}/${depth}`);
                    if( hitpos >= 0 ){              // hit
                        let etag = structuredClone( this.rokushiki[this.hitdepth] );    // etag <- dic.rokushikiを複製
                        //console.log(`>> hit0:${tagtext}/${etag}/(${hitpos})${this.rokushiki[this.hitdepth][3]}/${this.hitdepth}`)
                        if( hitpos === 0 ){                 // 先頭で一致.
                            entryone = [];                  // entryone初期化.
                            entryone.push( etag[0] );       // dataにも変換前文字列を入れる.
                            entryone.push( etag[3] );       // dataに変換候補郡を入れる.
                            entryone[1].unshift( etag[0] ); // 変換候補郡先頭は検索文字.
                            this.cn.data.push( structuredClone(entryone) );  // dataに1エントリ追加.
                            //console.log(`>> hit:${tagtext}/${etag}/(${hitpos})${this.rokushiki[this.hitdepth]}/${this.hitdepth}`)
                            if( tagtext !== etag[0] ){  // 前方一致?
                                let newtag = tagtext.slice(( etag[0].length - tagtext.length ));
                                tagtext = newtag;       // 残り検索文字設定.
                                //console.log( `>> Rest:${tagtext}(${stoplimit})` );
                            } else {
                                tagtext = "";           // 完全一致は残り検索文字無し.
                                break;
                            }
                        } else {
                            //console.log( `>> Post hit:(${hitpos})${etag}` );
                            let pretag = tagtext.split( etag[0] )[0];  // hit前の文字列切り出し.
                            entryone = [ pretag, [pretag] ];    // data 1エントリ準備
                            this.cn.data.push( entryone );      // data 1エントリ追加.
                            let newtag = tagtext.slice( pretag.length ); // 残検索文字の切り出し.
                            tagtext = newtag;
                        }
                    }
                }
                //console.log(`>> ${entryone.length}/${entryone}/`);
                if( entryone.length <= 0 ){             // 一致なし：検索文字そのまま.
                    if( !this.cn.isGoogles() ){
                        entryone = [ tagtext, [tagtext] ];          // data 1エントリ準備
                        this.cn.data.push( structuredClone(entryone) );  // data 1エントリ追加.
                    }
                    else {
                        this.cn.circleCopy();    // gooles を丸コピ
                    }
                    //console.log( `>> No hit:${tagtext}/` );
                    break;
                }
            }
        }
    }

    // テキスト群を 辞書に展開する. 「＠＠＠」キー入力時.
    // addmode: true - 追加登録, false - 置き換え登録
    saveWords( addmode, words ) {
        if( this.rokushiki == undefined ) return;     // 辞書が開いてない場合は 何もしない.
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

    // Google の試験用URLを使う
    async getGoogleData() {
        this.cn.googles = null;

        if (this.controller) this.controller.abort();     // 前回の通信が残っていればキャンセル

        this.controller = new AbortController();
        const signal = this.controller.signal;
        const url = "http://google.com/transliterate?langpair=ja-Hira|ja&text=" + this.cn.fo.inbuf;

        try {
            if( this.cn.fo.isAvailable() && navigator.onLine ){
                const response = await fetch(url, { signal });
                this.cn.googles = await response.json();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.log("g:Error:", error);
            }
        } finally {
            this.controller = null;
        }
    }

    // キャッシュ辞書から data を作成.
    getCache(){
        this.cn.data = [[this.cn.fo.inbuf,[this.cn.fo.inbuf]]];
        let hitque = this.searchCache( this.cn.fo.inbuf );
        if( hitque.length > 0 ){
            for( let depth = 0; depth < hitque.length; depth++ ){
                this.cn.data[0][1].push( hitque[depth][1] );
                this.cn.data[0][1].push( hitque[depth][0] );
            }
            this.step = this.state.CACHE;
            return;
        }
        this.step = this.state.LOCAL;
        return;
    }

    // Googleの先行呼び出しとキャッシュ辞書かローカル辞書を選択して候補群作成
    makeConvert(){
        if( !this.isLocalState() ) this.getGoogleData();  // Google先行呼び出し
        if( this.isReadyOrCacheState() ) this.getCache(); // キャッシュ辞書検索
        if( this.isLocalState() ) this.getData();         // ローカル辞書検索
        this.cn.makeCandidate( this.isCacheState() );     // candidateの作り直し
    }

    // 辞書のテキスト書き出し
    async exportStorageToTextFile() {
        try {
            // 1. データを取得
            const allData = dic.rokushiki;
            if (Object.keys(allData).length === 0) {
                console.log("辞書データがありません。");
                return;
            }
            // 2. データを「.txt」用にテキスト文字列へ整形する
            let textContent = "--- 六式 親指シフト 拡張機能 ストレージエクスポート ---\n";
            textContent += `#出力日時: ${new Date().toLocaleString()}\n\n`;
            for (const [key, value] of Object.entries(allData)) {
                // 文字列化する
                if (typeof value === 'object' && value !== null) {
                    textContent += `${value}\n`;
                }
//                console.log(`out:${textContent}`);
            }
            // 3. テキスト用の「Blob（データの塊）」を作成 (MIMEタイプを text/plain に指定)
            const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
            // 4. Blob から一時的な URL を生成
            const reader = new FileReader();
            reader.onloadend = function () {
                const dataUrl = reader.result;
            // 5. chrome.downloads API を使って .txt ファイルとして保存
                chrome.downloads.download({
                    url: dataUrl,
                    filename: "Rokushiki-Jisho.txt", // 拡張子を .txt に指定
                    saveAs: true // 保存先ダイアログを表示
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                    console.error("書き出し失敗:", chrome.runtime.lastError);
                    }
                });
            };
            // 変換スタート
            reader.readAsDataURL(blob);
        } 
        catch (error) {
            console.error("テキストエクスポート中にエラーが発生しました:", error);
        }
    }

    // コアロジック：パース ＆ マージ関数
    executeMerge(text) {
        // テキストを1行ずつに分解してパース
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 空行やコメント行はスキップ
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('-')) {
                continue;
            }

            let keyvalue = trimmedLine.split('/');
            if( keyvalue.length > 2 ) {             // SKK 辞書かも？
                keyvalue[0] = keyvalue[0].trim();
                keyvalue = keyvalue.slice(0, -1);   // key と value のみを残す
                // keyvalue[0] の最後の文字が英小文字の場合は最後の文字を削除
                let lastChar = keyvalue[0].charAt(keyvalue[0].length - 1);
                if( keyvalue[0].length > 0 && lastChar >= 'a' && lastChar <= 'z' ) {
                    keyvalue[0] = keyvalue[0].slice(0, -1);
                }
                // keyvalue[0]とkeyvalue[1]の間に 0,0 を挿入する
                keyvalue.splice(1, 0, "0", "0");
                //console.log(`keyvalue: ${keyvalue}/${keyvalue.length}`);
            }
            else{
                keyvalue = trimmedLine.split(',');
            }   

            if( keyvalue.length < 3 ) continue;     // versionはスキップ
            for( let pos = keyvalue.length-1; pos >= 3; pos-- ){    // 逆順にしないと後で登録された物が前になるよ
                let entryData = this.prepareEntryEngage( keyvalue[0], keyvalue[pos] ); 
                if( entryData != null ) this.engage( entryData[0], entryData[1] );  // 登録点を探して登録.
            }
        }
        console.log("マージ完了");
    }

    // IME起動
    IME_Open(cm){
        //console.log(`IME Opened.`);
        if( cm.rn.convCandidate ) cm.prefixOne();    // 先頭が選択済ならFIXさせる.
        if( this.isSleepState() ) return;
        this.setReadyState();        // IME Ready状態に設定.
        cm.rn.showCompositionAnd( this.imeEngage() );  // conpositionとcandidate表示
    }

    // IMEを選んでEngage
    IME_Select(rn){
        //console.log(`IME Selected.`);
        if( this.isSleepState() ) return;
        // キャッシュ辞書ならLocalに
        // ローカルで無いかローカル脱出条件が揃っている場合はReadyに    
        if( this.isCacheState() ) this.setLocalState();
        else if( !this.isLocalState() ||( this.isSearchend() && !this.cn.isGoogles() )) this.setReadyState();
        rn.showCompositionAnd( this.imeEngage() );
    }

    // 次のIMEを選択してEngage
    IME_Next(rn){
        //console.log(`IME Next.`);
        if( this.isSleepState() ) return;
        // キャッシュ辞書ならLocalに、LocalならReadyに
        if( this.isLocalState() ) this.setReadyState();
        if( this.isCacheState() ) this.setLocalState();
        rn.showCompositionAnd( this.imeEngage() );
    }

    imeEngage(){
        //console.log(`IME Engage.`);
        this.cn.initialize();
        if( !this.cn.fo.isAvailable() ) return null;
        this.makeConvert();         // Candidate の作り直し
        return this.isCacheState(); // IME状態を応答
    }

    removeOneEntry( keyname ){
        let saverequest = false;
        console.log(`Remove:${keyname}`);
        let sakujyo = keyname.split("\t");
        if( sakujyo[1] == this.spkey ){              // 登録キー.
            this.saveWords( false, sakujyo[0] ); // 置き換え登録.
        } else if( sakujyo.length == 2 && sakujyo[0].length > 0 && sakujyo[1].length > 0 ){
            let entryindex = this.search( sakujyo[0] );
            if( entryindex > 0 ){
                for( let limit = 0; limit < 10; limit++ ){
                    let sakupos = this.rokushiki[entryindex][3].indexOf( sakujyo[1] );
                    if( sakupos < 0 ) sakupos = this.rokushiki[entryindex][3].indexOf( this.rokushiki[entryindex][0] );
                    if( sakupos >= 0 ){
                        this.rokushiki[entryindex][3].splice( sakupos, 1 );   // 候補削除.
                    }
                }
                saverequest = true;                             // 辞書保存要求
            }
            if( this.rokushiki[entryindex].length >=3 && this.rokushiki[entryindex][3].length <= 0 )   // 候補が全てなくなった.
                this.rokushiki.splice( entryindex,1 );
        }
        return saverequest;
    }

    addOneEntry( keyname ){
        let saverequest = false;
        console.log(`Engage:${keyname}`);
        let touroku = keyname.split("\t");
        if( touroku[1] == this.spkey ){              // 登録キー.
            this.saveWords( true, touroku[0] );  // 追加登録.
        } else if( touroku.length == 2 && touroku[0].length > 0 && touroku[1].length > 0 ){
            let tagEntry   = [];
            let entryindex = this.search( touroku[0] );
            if( entryindex <= 0 ){
                tagEntry = [ touroku[0], 0, 0, [touroku[1]]];   // 登録エントリ
                entryindex = this.rokushiki.length;
            } else {
                tagEntry = this.getEntry( entryindex, touroku[1] );
            }
            this.engage( tagEntry, entryindex );                 // 登録点を探してて登録.
            saverequest = true;                                 // 辞書保存要求.
        }
        return saverequest;
    }

}

/************************/
/* 辞書ダイアログ関連のコード */
/************************/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if( dic.isSleepState() ) return;   // local 辞書が読まれる前は待つ.
        //console.log(`onMsg:${message}/${message.type}/${message.action}/`);
    switch(message.type) {
        case 'removeOne':
            if( dic.removeOneEntry( message.jtext )) dic.saveRokushiki();
            return;
        case 'engageOne':
            if( dic.addOneEntry( message.jtext )) dic.saveRokushiki();
            return;
        default:
            break;
    }
    switch(message.action) {
        case 'Clean':
            console.log(`Debug ope.`);      // 暫定コード : 辞書の整理.
            ConvertOldtoNewDict( message.text );    // 辞書内の整理.
            break;
        case 'Save':
            sendResponse({ success: true });
            dic.saveRokushiki();            // 辞書保存.
            break;
        case 'Write':
            console.log(`辞書の書き出し`);
            dic.exportStorageToTextFile();
            break;
        case 'parseAndMergeText':
            console.log(`辞書入力＆マージ`);
            dic.executeMerge(message.text);
            sendResponse({ success: true });
            return true;    // 非同期で sendResponse を呼び出すために必要
            break;
        case 'openSettings':
            // 1. すでに窓を開いた記録がある場合
            if (settingsWindowId !== null) {
                // そのID のウィンドウが存在するかチェック（コールバック方式でエラーを安全に検知）
                chrome.windows.get(settingsWindowId, (window) => {
                    if (chrome.runtime.lastError || !window) {
                        // ウィンドウが存在しない場合はエラーになるので、ここに飛びます。
                        settingsWindowId = null; // 記録をリセット
                        createSettingsWindow(); // 新しく窓を作成
                    } else {
                        // 窓が存在していたら、フォーカスを当てて処理を終了（ガード成功）
                        chrome.windows.update(settingsWindowId, { focused: true });
                    }
                });
            }
            else {
                // 2. 最初から記録がない場合は新規作成
                createSettingsWindow(); // 新しく窓を作成
            }
            break;
//        case 'hertbeet':
//            console.log(`heartbeet`);
//            break;
        default:
            break;
    }
    return false;
});

// 設定オプション窓を開く
function createSettingsWindow() {
    chrome.windows.create({
            url: "options.html",
            type: "popup",      // アドレスバー等のない純粋な「枠」だけ
            width: 480,
            height: 160,
            focused: true
        }, (window) => {
        settingsWindowId = window.id;   // 作成されたウィンドウの ID を変数に保存しておく
    });
}

// 辞書版数のコンバート.
function ConvertOldtoNewDict( command ){
    console.log(`DebOpe:${command}`);
    if( command === 'CLEAN' ){
        dic.rokushiki = [[4,0]];       // ver.4　辞書初期化.
        console.log(`** Debug operation: initialized **`);
        return;
    }
}

