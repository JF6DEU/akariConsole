let d = document;
let ws_val = new WebSocket("ws://localhost:3030");
let page, cursor_kaiso;
let channelname_for_dim = [
    "Dim1 R",
    "Dim2 R",
    "Dim3 R",
    "Dim4 R",
    "Dim5 T",
    "Dim6 T",
    "Dim7 R",
    "Dim8 R",
    "Dim9 T",
    "Dim10 T",
    "Dim11 T",
    "Dim12 T",
    "下1R",
    "下1G",
    "下1B",
    "下1W",
    "下2R",
    "下2G",
    "下2B",
    "下2W",
    "上1R",
    "上1G",
    "上1B",
    "上1W",
    "上2R",
    "上2G",
    "上2B",
    "上2W",
    "単1W",
    "単1A",
    "単2W",
    "単2A"
];
let subfadar_length = 12;
// ここへキーボードの移動を実装
function init(){
    // ここに初期化処理を書く
    // ライブ画面にチャンネルの箱を用意
    for (let i=1;i<=24;i++){
        c("channel_view").innerHTML += `
            <div class="channel_container"> \
                <div class="channel_head channel_${i}_head">${i}</div> \
                <div class="channel_${i}_value">0</div> \
            </div> \
        `;
    }
    // SUB画面にチャンネルの箱を用意
    for (let i=1;i<=subfadar_length;i++){
        c("subfadar_value").innerHTML += `
            <div class="sub_channel_container sub_channel_${i}_container"> \
                <div class="sub_channel_head sub_channel_${i}_head">${i}</div> \
                <div class="sub_channel_${i}_value">未</div> \
            </div> \
        `;
    }
    // パッチ画面にチャンネルの箱を用意
    for (let i=1;i<=channelname_for_dim.length;i++){
        c("patch_container_dimmer").innerHTML += `
            <div class="patch_channel_container patch_channel_container_${i}"> \
                <div class="patch_channel_head patch_channel_${i}_head">${channelname_for_dim[i -1]}</div> \
                <div class="patch_channel_${i}_value">-</div> \
            </div> \
        `;
    }
    for (let i=1;i<=9;i++){
        c("mathpanel_input").insertAdjacentHTML("beforeend", `
            <div class="mathpanel_input_key${i} mathpanel_input_key">
                <div class="mathpanel_input_key_value">${i}</div>
            </div>
        `);
    }
    c("mathpanel_input").insertAdjacentHTML("beforeend", `
        <div class="mathpanel_input_key0 mathpanel_input_key">
            <div class="mathpanel_input_key_value">0</div>
        </div>
    `);
    c("mathpanel_input").insertAdjacentHTML("beforeend", `
        <div class="mathpanel_input_key_backSpace mathpanel_input_key">
            <div class="mathpanel_input_key_value">BS</div>
        </div>
        <div class="mathpanel_input_key_enter mathpanel_input_key">
            <div class="mathpanel_input_key_value">&gt;</div>
        </div>
    `);
    for (let i=0;i<=9;i++){
        c(`mathpanel_input_key${i}`).addEventListener("click", function(){
            if (c("mathpanel_input_from_keyboard").value.split("").length < 4){
                c("mathpanel_input_from_keyboard").value += i;
            }
            c("mathpanel_input_from_keyboard").focus();
        });
    }
    c("mathpanel_input_key_backSpace").addEventListener("click", function(){
        c("mathpanel_input_from_keyboard").value = c("mathpanel_input_from_keyboard").value.slice(0, -1);
        c("mathpanel_input_from_keyboard").focus();
    });
    // 他の初期化処理を追加
    updateView();
    menu_list.forEach(function(menu, index){
        c(menu[0]).addEventListener("click", function(){
            menu_current_no = index;
            menu_kaiso = 0;
            updateView();
        });
    });
    menu_list[2][4].forEach(function (m ,i){
        c(m).addEventListener("click", function(){
            if (menu_kaiso == 2){
                menu_list[2][3] = i;
                sikomi(true);
            }
            updateView();
        });
    });
    menu_list[1][4].forEach(function (m, i){
        c(m).addEventListener("click", function(){
            if (menu_kaiso == 2){
                menu_list[1][3] = i;
                subfadar(true);
            }
            updateView();
        });
    });
    for (let i=1;i<=channelname_for_dim.length;i++){
        c(`patch_channel_container_${i}`).addEventListener("click", function(){
            menu_kaiso = 2;
            menu_list[2][2] = i;
            updateView();
        });
    }
    for (let i=1;i<=subfadar_length;i++){
        c(`sub_channel_${i}_container`).addEventListener("click", function(){
            menu_kaiso = 2;
            menu_list[1][2] = i;
            updateView();
        });
    }
    new log("初期化完了。");
}

class log{
    constructor(log = ""){
        this.elem = c("log_main");
        if (log != ""){
            this.elem.insertAdjacentHTML("afterbegin", `
                <span>${log}</span>
                `);
        }
    }
}
// パッチアップデート時の処理
class patch_update{
    constructor(no){
        this.patch_no = no;
        this.fadar_ch_head = c(`patch_channel_${no}_head`);
        this.fadar_ch_value = c(`patch_channel_${no}_value`);
    }
    update(val){
        // headの色も変えるつもり
        let col;
        if (isNaN(val)) {
            if (val.indexOf("ND") !== -1) {
                // ノンディム
                col = "#666";
            } else if (val === "-") {
                // 未パッチ
                col = "#000";
            } else if (val === "DIR") {
                // 直回路
                col = "#f00";
            }
        } else {
            // 通常パッチ（数値扱い）
            col = "#00f";
        }
        this.fadar_ch_head.style.backgroundColor = col;
        this.fadar_ch_value.innerHTML = val;
    }
    patch_on(type, val=1){
        let patch_wsock = new ws();
        switch(type){
            case "dim":
                // ディマー時の処理
                if (val > 0 && val < 256){
                    if (patch_wsock.send(JSON.stringify({
                        mode: "patch",
                        circuitno: this.patch_no,
                        value: val
                    }))){
                        new log(`チャンネル ${channelname_for_dim[this.patch_no -1]} をパッチしました。`);
                    }
                } else {
                    new log(`チャンネルNoが範囲外です。`);
                    return false;
                }
                break;
            case "st":
                // 直仕込みの処理
                if (patch_wsock.send(JSON.stringify({
                    mode: "patch",
                    circuitno: this.patch_no,
                    value: "DIR"
                }))){
                    new log(`チャンネル ${channelname_for_dim[this.patch_no -1]} をパッチしました。`);
                }
                break;
            case "no_dim":
                // N.D処理
                if (patch_wsock.send(JSON.stringify({
                    mode: "patch",
                    circuitno: this.patch_no,
                    value: `ND${val}`
                }))){
                    new log(`チャンネル ${channelname_for_dim[this.patch_no -1]} をパッチしました。`);
                }
                break;
            default:
                // デフォルト時の処理
                break;
        }
    }
    patch_off(){
        // フェーダー払時の処理
        let patch_wsock = new ws();
        if (patch_wsock.send(JSON.stringify({
            mode: "patch",
            circuitno: this.patch_no,
            value: `-`
        }))){
            new log(`チャンネル ${channelname_for_dim[this.patch_no -1]} をアンパッチしました。`);
        }
    }
}
class ws{
    constructor(){
    }
    send(data){
        if (ws_val.readyState != 1){
            new log(`内部接続が切断されました。`);
            return false;
        } else {
            ws_val.send(data);
            return true;
        }
    }
}

ws_val.addEventListener("message", function(e){
    // websocket到着時の処理
    try{
        let data = JSON.parse(e.data);
        if (typeof data.error != "undefined"){
            new log(`内部エラー：${data.errorMessage}`);
            return;
        }
        let patchlist = data.patchlist;
        let output_value = data.output_value;
        let subfadar_page = data.subfadar_page;
        let subfadar_value = data.subfadar_value;
        patchlist.forEach((val, index) => {
            if (channelname_for_dim.length < index +1) return; // 必要ない
            let patch_up = new patch_update(index +1);
            patch_up.update(val);
        });
        for (let i=1;i<=24;i++){
            c(`channel_${i}_value`).innerHTML = output_value[i];
        }
        for (let i=1;i<=subfadar_length;i++){
            if (subfadar_value[i-1] != -1){
                c(`sub_channel_${i}_value`).innerHTML = "済";
                c(`sub_channel_${i}_head`).style.backgroundColor = "#00f";
            } else {
                c(`sub_channel_${i}_value`).innerHTML = "未";
                c(`sub_channel_${i}_head`).style.backgroundColor = "#000";
            }
        }
        c(`subfadar_page_no`).innerHTML = subfadar_page;
    } catch(e){
        new log(`受信データにエラーがあります。`);
        console.error(e);
    }
});

let menu_list = [["live", "view_live"], ["sub", "subfadar_panel", 1, 0, ["subfadar_add", "subfadar_page_change", "subfadar_del"]], ["patch_s", "sikomi_patch", 1, 0, ["patch_dim", "patch_st", "patch_no_dim", "patch_off"]], ["config", "config_edit"]];
let menu_current_no = 0;
let menu_kaiso = 0;
let saveKey = false;

d.body.addEventListener("keydown", function(key){
    if (key.repeat) return;
    if (key.key == "Insert"){
        saveKey = true;
    }
});

d.body.addEventListener("keyup", function(key){
    if (key.repeat) return;
    if (key.key == "Insert"){
        saveKey = false;
    }
});

d.body.addEventListener("keydown",async function(key){
    if (key.repeat) return;
    if (MathPanelWait) return;
    if (key.key == "ArrowRight"){
        switch(menu_kaiso){
            case 0:
                if (menu_current_no > (menu_list.length -2)){
                    menu_current_no = 0;
                } else {
                    menu_current_no++;
                }
                break;
            case 1:
                if (menu_current_no == 1 && (menu_list[1][2] +1) <= subfadar_length){
                    menu_list[1][2]++;
                }
                if (menu_current_no == 2 && (menu_list[2][2] + 1) <= channelname_for_dim.length){
                    menu_list[2][2]++;
                }
                break;
            case 2:
                if (menu_current_no == 1){
                    if (menu_list[1][3] > (menu_list[1][4].length -2)){
                        menu_list[1][3] = 0;
                    } else {
                        menu_list[1][3]++;
                    }
                }
                if (menu_current_no == 2){
                    if (menu_list[2][3] > (menu_list[2][4].length -2)){
                        menu_list[2][3] = 0;
                    } else {
                        menu_list[2][3]++;
                    }
                }
                break;
            default:
                break;
        }
        updateView();
    } else if(key.key == "ArrowLeft") {
        switch(menu_kaiso){
            case 0:
                if (menu_current_no < 1){
                    menu_current_no = (menu_list.length -1);
                } else {
                    menu_current_no--;
                }
                break;
            case 1:
                if (menu_current_no == 1 && (menu_list[1][2] -1) >= 1){
                    menu_list[1][2]--;
                }
                if (menu_current_no == 2 && (menu_list[2][2] - 1) >= 1){
                    menu_list[2][2]--;
                }
                break;
            case 2:
                if (menu_current_no == 1){
                    if (menu_list[1][3] < 1){
                        menu_list[1][3] = (menu_list[1][4].length -1);
                    } else {
                        menu_list[1][3]--;
                    }
                }
                if (menu_current_no == 2){
                    if (menu_list[2][3] < 1){
                        menu_list[2][3] = (menu_list[2][4].length -1);
                    } else {
                        menu_list[2][3]--;
                    }
                }
            default:
                break;
        }
        updateView();
    } else if(key.key == "ArrowDown"){
        switch(menu_kaiso){
            case 1:
                if (menu_current_no == 2 && (menu_list[2][2] - 5) >= 1){
                    menu_list[2][2] -= 5;
                }
                break;
            default:
                break;
        }
        updateView();
    } else if(key.key == "ArrowUp"){
        switch(menu_kaiso){
            case 1:
                if (menu_current_no == 2 && (menu_list[2][2] + 5) <= channelname_for_dim.length){
                    menu_list[2][2] += 5;
                }
                break;
            default:
                break;
        }
        updateView();
    } else if(key.key == "Enter"){
        switch(menu_current_no){
            case 0:
                break;
            case 1:
                if (menu_kaiso < 2){
                    menu_kaiso++;
                } else if(menu_kaiso == 2){
                    subfadar();
                }
                break;
            case 2:
                if (menu_kaiso < 2){
                    menu_kaiso++;
                } else if(menu_kaiso == 2){
                    sikomi();
                }
            break;
            case 3:
                break;
        }
        updateView();
    } else if(key.key == "Backspace"){
        if (menu_kaiso > 0){
            menu_kaiso--;
        }
        updateView();
    } else if(key.key == "+"){
        if (menu_kaiso == 1 && menu_current_no == 1){
            menu_kaiso++;
            menu_list[1][3] = 0;
            subfadar();
        }
        if (menu_kaiso == 2 && menu_current_no == 1){
            menu_list[1][3] = 0;
            subfadar();
        }
    } else if(key.key == "-"){
        if (menu_kaiso == 1 && menu_current_no == 1){
            menu_kaiso++;
            menu_list[1][3] = 2;
            subfadar();
        }
        if (menu_kaiso == 2 && menu_current_no == 1){
            menu_list[1][3] = 2;
            subfadar();
        }
    } else if(key.key == "*"){
        if (saveKey){
            if ((new ws()).send(JSON.stringify({
                mode:"save"
            }))){
                new log(`現在の状況を保存しました。`);
            }
        }
    }
});
function wait_enterKey_up(){
    return new Promise((r) => {
        document.body.addEventListener("keyup", function(){
            r(true);
        });
    });
}
function updateView(){
    if (menu_kaiso == 0){
        menu_list.forEach(function(menu, index){
            if (menu_current_no == index){
                c(menu[0]).classList.add("selected");
                c(menu[1]).style.display = "block";
            } else {
                c(menu[0]).classList.remove("selected");
                c(menu[1]).style.display = "none";
            }
        });
    } else {
        menu_list.forEach(function(menu){
            c(menu[0]).classList.remove("selected");
        });
    }
    if (menu_kaiso == 2 && menu_current_no == 2){
        menu_list[2][4].forEach(function(m, i){
            if (menu_list[2][3] == i){
                c(m).classList.add("selected2");
            } else {
                c(m).classList.remove("selected2");
            }
        });
    } else {
        menu_list[2][4].forEach(function(m){
            c(m).classList.remove("selected2");
        });
    }
    if (menu_kaiso == 2 && menu_current_no == 1){
        menu_list[1][4].forEach(function(m, i){
            if (menu_list[1][3] == i){
                c(m).classList.add("selected2");
            } else {
                c(m).classList.remove("selected2");
            }
        });
    } else {
        menu_list[1][4].forEach(function(m){
            c(m).classList.remove("selected2");
        });
    }
    if (menu_kaiso >= 1 && menu_current_no == 2){
        for (i=1;i<=channelname_for_dim.length;i++){
            if (menu_list[2][2] == i){
                c(`patch_channel_container_${i}`).classList.add("selected");
            } else {
                c(`patch_channel_container_${i}`).classList.remove("selected");
            }
        }
    } else {
        for (i=1;i<=channelname_for_dim.length;i++){
            c(`patch_channel_container_${i}`).classList.remove("selected");
        }
    }
    if (menu_kaiso >= 1 && menu_current_no == 1){
        for (let i=1;i<=subfadar_length;i++){
            if (menu_list[1][2] == i){
                c(`sub_channel_${i}_container`).classList.add("selected");
            } else {
                c(`sub_channel_${i}_container`).classList.remove("selected");
            }
        }
    } else {
        for (let i=1;i<=subfadar_length;i++){
            c(`sub_channel_${i}_container`).classList.remove("selected");
        }
    }
}

async function sikomi(click = false){
    let res;
    switch(menu_list[2][3]){
        case 0:
            // 調光仕込み
            res = await mathinput_panel(click);
            if (res < 1 || res > 255 || isNaN(res)){
                new log("入力値が範囲外です。");
                return;
            }
            (new patch_update(menu_list[2][2])).patch_on("dim", res);
            break;
        case 1:
            // 直仕込み
            (new patch_update(menu_list[2][2])).patch_on("st");
            break;
        case 2:
            // N.D
            res = await mathinput_panel(click);
            if (res < 1 || res > 255 || isNaN(res)){
                new log("入力値が範囲外です。");
                return;
            }
            (new patch_update(menu_list[2][2])).patch_on("no_dim", res);
            break;
        case 3:
            // フェーダー払
            (new patch_update(menu_list[2][2])).patch_off();
            break;
    }
    menu_kaiso--;
    updateView();
}
async function subfadar(click = false){
    let res;
    switch(menu_list[1][3]){
        case 0:
            // 追加
            if ((new ws()).send(JSON.stringify({
                mode:"subfadar_add",
                subno: menu_list[1][2]
            }))){
                new log(`サブフェーダーの番号${menu_list[1][2]}を追加・追記しました。`);
            }
            break;
        case 1:
            // ページ切り替え
            res = await mathinput_panel(click);
            if (res < 1 || res > 100){
                new log("サブフェーダーのページが範囲外です。");
                break;
            }
            if ((new ws()).send(JSON.stringify({
                mode:"sub_change_p",
                page: res
            }))){
                new log(`サブフェーダーのページを${res}に変更しました。`);
            }
            break;
        case 2:
            // 削除
            if ((new ws()).send(JSON.stringify({
                mode:"subfadar_del",
                subno: menu_list[1][2]
            }))){
                new log(`サブフェーダーの番号${menu_list[1][2]}を削除しました。`);
            }
            break;
    }
    menu_kaiso--;
    updateView();
}
let MathPanelWait = false;
async function mathinput_panel(click){
    c("mathpanel_input_from_keyboard").value = "";
    MathPanelWait = true;
    if (!click){
        await wait_enterKey_up();
    }
    c("mathpanel").style.display = "block";
    c("mathpanel_input_from_keyboard").focus();
    return new Promise((resolve) => {
        const form = d.getElementById("mathin");
        const button = c("mathpanel_input_key_enter");
        const handler = (e) => {
            if (e && e.preventDefault) e.preventDefault();
            c("mathpanel").style.display = "none";
            MathPanelWait = false;
            form.removeEventListener("submit", handler);
            button.removeEventListener("click", handler);
            resolve(c("mathpanel_input_from_keyboard").value);
        };
        form.addEventListener("submit", handler);
        button.addEventListener("click", handler);
    });
}




init();
function c(c){
    return d.getElementsByClassName(c)[0];
}