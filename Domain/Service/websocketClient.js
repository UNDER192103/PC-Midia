const { app } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const Api = require(path.join(app.getAppPath(), "Repository", "api.js"));
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const EnumTv = require(path.join(app.getAppPath(), "Domain", "Models", "EnumTv.js"));
const Commun = require(path.join(app.getAppPath(), "Domain", "Commun", "commun.js"));
const TimeLineDownloaderService = require('./timeLineDownloader.js');
const instagramDownloaderService = require('./instagramDownloader.js');
const TimeLineDownload = new TimeLineDownloaderService();
const instagramDownloader = new instagramDownloaderService();
var Socket = null, IsFirstGetInfo = true, _callback = null, cmd_to_server = null, IsFirstStart = true, heartbeatInterval = null;

async function StartSocket() {
    if(IsFirstGetInfo){
        GetInfoTv();
        IsFirstGetInfo = false;
    }
    Socket = new WebSocket(`${DAO.Config.URL_WEBSOCKET}?${await DAO.GetTvCode()}`);
    DAO.DB.set('StatusWebSocket', Socket.readyState);
    TimeLineDownload.SetSocket(Socket);
    instagramDownloader.SetSocket(Socket);

    Socket.on('close', (data)=>{
        console.log('Close: ',data);
        clearInterval(heartbeatInterval);
        startWs10Segundos();
    });
    
    Socket.on('message', (buffer)=>{
        let string = buffer.toString();
        try {
            commands(JSON.parse(string));
        } catch (error) {
            console.log(error);
        }
    });

    Socket.on('error', (data)=>{
        console.log('Error: ',data);
        clearInterval(heartbeatInterval);
        startWs10Segundos();
    });

    Socket.on('open', async ()=>{
        DAO.DB.set('StatusWebSocket', Socket.readyState);
        sendPong();
        GetInfoTv();
        if(IsFirstStart){
            IsFirstStart = false;
            CheckTimeLineDownloaded();
        }
        clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (Socket && Socket.readyState === WebSocket.OPEN) {
                Socket.ping(() => {});
            }
        }, 30000);
    });
}

async function GetInfoTv(callback = null){
    try {
        let timeDownloadedTimeLine = await DAO.DB.get('timeDownloadedTimeLine');
        Api.Send(EnumTv.INFO_TV, {
            app_version: DAO.Package.version,
            app_status: DAO.Package.status,
            code: await DAO.GetTvCode(),
            version: timeDownloadedTimeLine ? timeDownloadedTimeLine : "",
        }).then(async (response)=>{
            try {
                var Data = response.data;
                if(Data.success === true){
                    if(Data.result != null && Data.result.id && Data.result.code){
                        let DTO = Data.result;
                        let isLinked = await DAO.DB.get('IsLinkedTv');
                        await DAO.DB.set('IsLinkedTv', true);
                        await DAO.DB.set('DataTv', DTO);
                        await DAO.DB.set('PlayerState', DTO.play_pause);
                        await DAO.DB.set('RandomReproduction', DTO.reproducaoRand);
                        await DAO.DB.set('IsConnected', true);
                        if(isLinked != true){
                            receiver({code: "update_screen"});
                        }
                        if(!TimeLineDownload.isDownloading && (Socket && Socket.readyState === Socket.OPEN)){
                            Commun.CheckBlocksUpdates(DTO, Socket);
                        }
                        receiver({code: "data_tv", data: DTO});
                        checkTvToMute();
                    }
                    else{
                        await DAO.DB.set('is_connection', 'no_conected');
                        await DAO.DB.remove('DataTv');
                        await DAO.DB.set('link_tv', "no_link");
                        await DAO.DB.set('IsLinkedTv', false);
                        await DAO.DB.set("reloadApp", true)
                        receiver({code: "update_screen"});
                        //console.log(response.data);
                    }
                }
            } catch (error) {
                console.log(error);
            }
        })
        .catch((error)=>{
            console.log(error.response);
        });
    } catch (error) {
        
    }
    if(callback) callback();
}

function startWs10Segundos(){
    DAO.DB.set('StatusWebSocket', Socket.readyState);
    if(Socket.readyState != Socket.OPEN){
        try {
            Socket.close();
        } catch (error) {
            
        }
        setTimeout(()=>{
            StartSocket();
        }, 10000);
    }
}


async function commands(dtObject){
    try {
        switch (dtObject.cmd) {
            
            case EnumTv.PING: sendPong(); break;
            case EnumTv.PONG: break;

            /*case EnumTv.CONNECTION_IS_NOT_SAVED:
                let isUpdateScreen = await DAO.DB.get('IsLinkedTv');
                await DAO.DB.set('IsConnected', false);
                await DAO.DB.set('IsLinkedTv', false);
                if(isUpdateScreen){
                    receiver({code: "update_screen"});
                }
            break;*/

            case EnumTv.GETINFO_TV:
                GetInfoTv();
            break;

            case EnumTv.CHECK_APP_UPDATES:
                receiver({code: "CHECK_APP_UPDATES"});
            break;

            case EnumTv.BAIXAR_TIMELINE:
                if(!TimeLineDownload.isDownloading){
                    if(dtObject.data){
                        TimeLineDownload.StartDownload(dtObject.data, (data) => { });
                    }
                }
                else{
                    Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "download_runing"}, cmd: EnumTv.CALLBACK }));
                }
            break;
        /*
            case EnumTv.GET_PREVIW_INSTAGRAM:
                if(dtObject.data != null && dtObject.data.username_instagram != null){
                    let token_conection_id = dtObject.data.token_conection_id;
                    let instagramUserName =  dtObject.data.username_instagram;
                    instagramDownloader.DownloadPostsByUsername(instagramUserName, token_conection_id, async (res, err) => {
                        if(res != null){
                            sendLogWs({response: 'TV_LOG', msg: `Finalizado o Download de Posts do instagram para o usuário: ${instagramUserName}.`, data: new Date().toLocaleString()});
                            Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "GET_PREVIW_INSTAGRAM", data: res, token_conection_id: token_conection_id}, cmd: EnumTv.CALLBACK }));
                        }
                        else{
                            sendLogWs({response: 'TV_LOG', msg: `Falha no download de Posts do instagram para o usuário: ${instagramUserName}.`, data: new Date().toLocaleString()});
                            Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "REMOVE_PREVIW_INSTAGRAM", token_conection_id: token_conection_id}, cmd: EnumTv.CALLBACK }));
                        }
                    });
                }
            break;

            case EnumTv.BAIXAR_POST_INSTAGRAM:
                if(dtObject.data.json != ""){
                    if(instagramDownloader.isDownloading){
                        Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: 'downloadRunning', json: dtObject.data.json}, cmd: EnumTv.RETURNDOWNLOADINSTAGRAM }));
                    }
                    else{
                        instagramDownloader.DownloadPostsByBlock(dtObject, async (data, userNameInsta, blocoId) => {
                            if(blocoId != null && data != null){
                                if(data != null){
                                    sendLogWs({response: 'TV_LOG', msg: `Download Posts Instagram finalizado, ID Bloco: ${blocoId}, Nome de usuário do Instagram: ${userNameInsta} Bloco: ${blocoId}`, data: new Date().toLocaleString() });
                                    Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, data: {json: data, bloco_id: blocoId, updateBloco: dtObject.data.updateBloco},  cmd: EnumTv.SAVE_DATA_INSTAGRAM }));
                                    Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: EnumTv.BAIXAR_POST_INSTAGRAM}, cmd: EnumTv.CALLBACK }));
                                }
                                else{
                                    sendLogWs({response: 'TV_LOG', msg: `Falha no Download dos posts do instagram ou posts não encontrados, post: ${userNameInsta} Bloco: ${blocoId}!`, data: new Date().toLocaleString() });
                                    Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, data: {response: 'Falha no Download dos posts do instagram ou posts não encontrados!'},  cmd: EnumTv.REMOVE_LIST_UPDATE }));
                                }
                            }else{
                                sendLogWs({response: 'TV_LOG', msg: `ERRO: \nJson do bloco de Instagram está vazio!`, data: new Date().toLocaleString() });
                                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, data: {response: 'Não foi encontrado nenhuma informação no Bloco!'},  cmd: EnumTv.REMOVE_LIST_UPDATE }));
                            }
                        });
                    }
                }
            break;
        */

            case EnumTv.UPDATE_TV:
                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "UPDATE_TV"}, cmd: EnumTv.CALLBACK }));
                if(dtObject.data == "UNLINK_TV"){
                    await DAO.DB.set('is_connection', 'no_conected');
                    await DAO.DB.remove('DataTv');
                    await DAO.DB.set('link_tv', "no_link");
                    await DAO.DB.set('IsLinkedTv', false);
                    await DAO.DB.set("reloadApp", true)
                    receiver({code: "update_screen"});
                }else if(dtObject.data == "UPDATE_INFOTV"){
                    let timeDownloadedTimeLine = await DAO.DB.get('timeDownloadedTimeLine');
                    let isUpdateApp = DAO.DB.get('AppUpdate');
                    if(isUpdateApp == null || isUpdateApp == "null") isUpdateApp = false;
                    if(timeDownloadedTimeLine == null || timeDownloadedTimeLine == "null") timeDownloadedTimeLine = "";
                    await DAO.DB.remove('AppUpdate');
                    GetInfoTv();
                }
            break;

            case EnumTv.ATUALIZAR:
                sendLogWs({response: 'TV_LOG', msg: `Atualizar a tela da Tv data: ${new Date().toLocaleString()}`, data: new Date().toLocaleString()});
                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "reloadScreen", reloadScreen: true}, cmd: EnumTv.CALLBACK }));
                receiver({code: "reload_screen"});
            break;

            case EnumTv.REINICIAR_PROGRAMA:
                sendLogWs({response: 'TV_LOG', msg: `Reiniciar Programa Data: ${new Date().toLocaleString()}`, data: new Date().toLocaleString() });
                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "reloadApp", reloadApp: true}, cmd: EnumTv.CALLBACK }));
                receiver({code: "reload_app"});
            break;

            case EnumTv.REINICIAR_TV:
                sendLogWs({response: 'TV_LOG', msg: `Reiniciar TV Data: ${new Date().toLocaleString()}`, data: new Date().toLocaleString() });
                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "reloadTv", reloadTv: true}, "cmd": EnumTv.CALLBACK }));
                Commun.ReiniciarWindows();
            break;

            case EnumTv.STOP_PLAY:
                await sendLogWs({response: 'TV_LOG', msg: `Pausar Tv`, data: new Date().toLocaleString() });
                await DAO.DB.set('PlayerState', 'PAUSE');
                let infoTv = await DAO.DB.get('DataTv');
                let idTl = null;
                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: { response: "player", player: STOP, timeline: idTl, }, cmd: EnumTv.CALLBACK }));
            break;

            case EnumTv.CALLBACK: break;

            case EnumTv.REMOVE_TAG_UPDATE: break;

            case EnumTv.REMOVE_ITEM_BLOCK_UPDATE: break;

            case EnumTv.PUBLISHED: break;

            case EnumTv.TV_LOG: break;
        
            default:
                if(dtObject.cmd) console.log(dtObject.cmd);
                //console.log(dtObject);
            break;
        }
    } catch (error) {
        console.log(error);
    }
}

async function checkTvToMute() {
    /*var datatv = await DAO.DB.get('DataTv');
    if(datatv && datatv.mute){
        if(datatv.mute === "TRUE" || datatv.mute === true){
            receiver({code: "MUTE_APP"});
        }
        else{
            receiver({code: "UNMUTE_APP"});
        }
    }*/
}

async function getNameTv(){
    let infoTv = await DAO.DB.get('DataTv');
    let nameTv = null
    if(infoTv && infoTv.nome) nameTv = infoTv.nome
    return nameTv;
}

async function sendLogWs(data){
    let infoTv = await DAO.DB.get('DataTv');
    let nameTv = null
    if(infoTv && infoTv.nome) nameTv = infoTv.nome

    try {
        Api.Send(EnumTv.TV_LOG, {
            code: await DAO.GetTvCode(),
            json: JSON.stringify({ code: DAO.TvCode, tv_name: nameTv, data: data, cmd: EnumTv.TV_LOG }),
        }).then(async (response)=>{

        })
        .catch((error)=>{
            console.log(error.response);
        });
    } catch (error) {
        console.log(error);
    }
    Socket.send(JSON.stringify({ code: DAO.TvCode, tv_name: nameTv, data: data, cmd: EnumTv.TV_LOG }));
}

function sendPong() {
    Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, data: "PONG",  cmd: EnumTv.PONG }));
}

function receiver(data){
    if(_callback != null)
        _callback(data);
}

async function CheckTimeLineDownloaded() {
    try {
        let dataToVerify = await DAO.TMP.get('DefaultDataTimeLine');
        let dataPlayer = await DAO.TIMELINE.get('DataPlayer');
        let dataTV = await DAO.DB.get('DataTv');
        if(dataTV && ( !dataTV.checkTLOnStart || dataTV.checkTLOnStart === true)){
            if(!TimeLineDownload.isDownloading){
                if(!dataPlayer || dataPlayer.length === 0){
                    if(dataToVerify && dataToVerify.data && dataToVerify.data.length > 0){
                        if(!Commun.isDateMoreThanOneDayFromNow(dataToVerify.date)){
                            TimeLineDownload.StartDownload(dataToVerify.data, (data) => { });
                        }
                    }
                }
            }
            else{
                Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await getNameTv(), data: {response: "download_runing"}, cmd: EnumTv.CALLBACK }));
            }
        }
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    StartSocket,
    Receiver: (callback) => { _callback = callback; }
};