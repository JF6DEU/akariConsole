// WebSocketサーバーを立てる
const ws = require("ws").Server;
const socket = new ws({port: 3030});

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// DMX1の入力元を設定
const port1 = new SerialPort({ path: 'COM6', baudRate: 115200 });
const parser1 = port1.pipe(new ReadlineParser({ delimiter: '\n' }));

// DMX2の入力元を設定
const port2 = new SerialPort({ path: 'COM10', baudRate: 115200 });
const parser2 = port2.pipe(new ReadlineParser({ delimiter: '\n' }));

parser1.on('data', (line) => {
    const parts = line.trim().split(',');
    if (parts[0] !== 'p') {
        console.warn('[DMX1] Unknown header:', parts[0]);
        return;
    }
    let values = parts;
    // 以降に0が続く場合は省略されているので補充
    for (let i = 0; i < values.length; i++) {
        in1[i] = values[i] || 0;
    }
});


parser2.on('data', (line) => {
    const parts = line.trim().split(',');
    if (parts[0] !== 'p') {
        console.warn('[DMX2] Unknown header:', parts[0]);
        return;
    }
    let values = parts;
    // 以降に0が続く場合は省略されているので補充
    for (let i = 0; i < values.length; i++) {
        in2[i] = values[i] || 0;
    }
});

port1.on("error", (e) => {
    console.error(e.message);
});

port2.on("error", (e) => {
    console.error(e.message);
});

// 終了処理
process.on('exit', () => {
    console.log('\nClosing ports...');
    // ポートの切断
    port1.close();
    port2.close();
    // 終了
    process.exit();
});


// 子プロセスとしてPythonスクリプトを立ち上げ
const { spawn } = require('child_process');
const python = spawn('python', ['serialport.py']);

// 出力するDMXを送る
python.stdout.on('data', (data) => {
    console.log(`[Python]: ${data}`);
});

// エラー時は表示
python.stderr.on('data', (data) => {
    console.error(`[Python Error]: ${data}`);
});

// DMX値（最大512個）を配列として送信
function sendDMXArray(dmxArray) {
    const payload = JSON.stringify(dmxArray) + "\n";
    python.stdin.write(payload);
}

let sub_page_number = 1;
let patchlist = [], sub = [], output = [],temp1 = [], in1 = [], in2 = [];
for (let i=1;i<=512;i++){
    patchlist.push("-");
    output.push(0);
    in1.push(0);
    in2.push(0);
    temp1.push(0);
}
const fs = require("fs");
try{
    let parsedData = JSON.parse(fs.readFileSync('./settings.json', "utf-8"));
    if (typeof parsedData.patchlist != "undefined"){
        patchlist = parsedData.patchlist;
    }
    if (typeof parsedData.sub != "undefined"){
        sub = parsedData.sub;
    }
    if (typeof parsedData.sub_page_number != "undefined"){
        sub_page_number = parsedData.sub_page_number;
    }
} catch(e) {
    console.log(e);
}
function map(in_min, in_max, out_min, out_max, value) {
    return Math.round((value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min);
}

function sub_dmx() {
    temp1 = in1.slice();
        // サブフェーダー処理
    // [[ページNo, フェーダーNo, [チャンネルメモリー]]]
    sub.forEach(function(s) {
        if (s[0] === sub_page_number) {
            s[2].forEach(function(t, num) {
                if (isNaN(t)){return};
                let chval = map(0, 255, 0, t, in2[s[1]]);
                let currentval = temp1[num];
                if (chval > currentval) {
                    temp1[num] = chval;
                }
            });
        }
    });
    patchlist.forEach(function(v, num) {
        if (isNaN(v)) {
            if (v.indexOf("ND") != -1) {
                // ノンディム
                output[num +1] = parseInt(v.replace("ND", ""));
            } else if (v == "-") {
                // 未パッチ
                output[num +1] = 0;
            } else if (v == "DIR") {
                // 直回路
                output[num +1] = 255;
            }
        } else {
            // 通常パッチ（数値扱い）
            output[num +1] = parseInt(temp1[v]);
        }
    });
    // 他の処理はこの後に追記
}

setInterval(sub_dmx, 50);
setInterval(function(){let temp2 = output;temp2[0] = 0;sendDMXArray(temp2)}, 50);
// 定期ポーリング
setInterval(() => {
    port1.write('G\n');
    port2.write('G\n');
}, 30);

// 現在の状況を送信
setInterval(function(){
    let sub_send_value = [];
    for (let i=1;i<=12;i++){
        sub_send_value.push(sub.findIndex(
            (s) => s[0] === sub_page_number && s[1] === i
          ));
    }
    socket.clients.forEach((c) => c.send(JSON.stringify({
        output_value: temp1,
        patchlist: patchlist,
        subfadar_page: sub_page_number,
        subfadar_value: sub_send_value
    })));
}, 40);

socket.on("connection", (wsock) => {
    wsock.on("message", (message) => {
        try{
            let parsed = JSON.parse(message);
            switch(parsed.mode){
                case "patch":
                    let circuitno = parsed.circuitno;
                    let val = parsed.value;
                    if (circuitno > 0 && circuitno < 256){
                        // 範囲内なのでパッチできる
                        if (isNaN(val)) {
                            if (val.indexOf("ND") !== -1) {
                                // ノンディム
                                let ndval = parseInt(val.replace("ND", ""));
                                if (ndval > 0 && ndval < 256){
                                    patchlist[circuitno -1] = val;
                                } else {
                                    throw new Error("ND value larger than 256 or less than 0.");
                                }
                            } else if (val === "-") {
                                // 未パッチ
                                patchlist[circuitno -1] = "-";
                            } else if (val === "DIR") {
                                // 直回路
                                patchlist[circuitno -1] = "DIR";
                            }
                        } else {
                            // 通常パッチ（数値扱い）
                            if (val > 0 && val < 256){
                                patchlist[circuitno -1] = val;
                            } else {
                                throw new Error("patchvalue is out of value.");
                            }
                        }
                    }
                    break;
                case "subfadar_add":
                    let subfadar_no = parsed.subno;
                    addSub(sub_page_number, subfadar_no, temp1.slice());
                    break;
                case "subfadar_del":
                    let subfadar_del_no = parsed.subno;
                    removeSub(sub_page_number, subfadar_del_no);
                    break;
                case "sub_change_p":
                    let page = parsed.page;
                    sub_page_number = page;
                    break;
                case "save":
                    fs.writeFileSync('./settings.json', JSON.stringify({
                        patchlist: patchlist,
                        sub: sub,
                        sub_page_number: sub_page_number
                    }), "utf-8", (err) => {
                        if(err) {
                          console.log(err);
                        }
                      });
                    break;
            }
        } catch(e){
            socket.clients.forEach((c) => c.send(JSON.stringify({
                error: true,
                errorMessage: "parse error: "+e.message
            })));
        }
    });
});

// sub[]：グローバルで定義されている前提

// サブフェーダーにデータを追加（上書きも可能）
function addSub(pageNo, faderNo, channelValues) {
    if (!Array.isArray(channelValues) || channelValues.length > 513) {
      console.error("不正なチャンネルデータ");
      return false;
    }
  
    // すでに同じページ＆フェーダーが存在する場合は上書き
    const existingIndex = sub.findIndex(
      (s) => s[0] === pageNo && s[1] === faderNo
    );
  
    if (existingIndex !== -1) {
      sub[existingIndex][2] = channelValues;
      return true; // 上書き
    }
  
    // 新規追加
    sub.push([pageNo, faderNo, channelValues]);
    return true;
  }
  
  // サブフェーダーからデータを削除
  function removeSub(pageNo, faderNo) {
    const index = sub.findIndex(
      (s) => s[0] === pageNo && s[1] === faderNo
    );
  
    if (index !== -1) {
      sub.splice(index, 1);
      return true;
    }
  
    return false; // 該当なし
}