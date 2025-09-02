const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const extractZip = require('extract-zip');
const Api = require(path.join(app.getAppPath(), "Repository", "api.js"));
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const post_model = require(path.join(app.getAppPath(), "Domain", "Models", "PostModel.js"));
const TagUpdaterService = require(path.join(app.getAppPath(), "Domain", "Service", "tagUpdater.js"));
const BlockUpdaterService = require(path.join(app.getAppPath(), "Domain", "Service", "blockUpdater.js"));
const EnumTv = require(path.join(app.getAppPath(), "Domain", "Models", "EnumTv.js"));
const TagUpdater = new TagUpdaterService();
const BlockUpdater = new BlockUpdaterService();


async function CheckChromiumDependency(callback) {
    let dirDependencys = path.join(DAO.DIR_APP_APPDATA, "Dependencys");
    if(!fs.existsSync(dirDependencys)){
        await fs.mkdirSync(dirDependencys);
    }
    if(fs.existsSync(path.join(dirDependencys, ".local-chromium"))){
        await DAO.DB.set('StatusChromiumDependency', 'Download Completo');
        callback(true);
    }
    else{
        await DAO.DB.set('StatusChromiumDependency', 'O download da Dependência começará em breve!');
        callback(true);
        try {
            let urlDownload = DAO.Config.URL_CHROMIUM_DOWNLOAD;
            let fileName = `pc-midia-chromium-dependency.zip`;
            await CheckAllFolderAdr(path.join(DAO.DIR_APP_APPDATA, "Downloads", "Temp"));
            let pathFileDownload = path.join(DAO.DIR_APP_APPDATA, "Downloads", "Temp", fileName);
            if(!fs.existsSync(pathFileDownload)){
                let downloaded = 0;
                let percents = 0;
                let size = 0;
                const request = https.get(urlDownload, function(response) {
                    size = parseInt(response.headers['content-length']);
                    const filePath = fs.createWriteStream(pathFileDownload);
                    response.pipe(filePath);
                    DAO.DB.set('StatusChromiumDependency', 'Download em andamento...');
                    callback(true);

                    response.on('data', (chunk) => {
                      downloaded += chunk.length;
                      percents = parseInt((downloaded / size) * 100);
                      callback({percentage: `Download em andamento, total baixado: ${percents}%.`});
                    });
                    
                    filePath.on('finish',async () => {
                        filePath.close();
                        ExtractChromiumDependency(pathFileDownload, dirDependencys, callback);
                    });
                });
            }
            else{
                ExtractChromiumDependency(pathFileDownload, dirDependencys, callback);
            }
        } catch (error) {
            console.log(error);
            await DAO.DB.set('StatusChromiumDependency', 'Não foi possível baixar a dependência, por favor verifique sua conexão e tente novamente.');
            callback(false); 
        }
    }
}

async function ExtractChromiumDependency(pathFileDownload, pathDependency, callback) {
    try {
        if(fs.existsSync(pathFileDownload)){
            await DAO.DB.set('StatusChromiumDependency', 'Extraindo Dependência...');
            callback(true);
            await extractZip(pathFileDownload, { dir: `${pathDependency}` }, function (err) {
                console.log(err);
            });
            try {
                fs.rmSync(`${pathFileDownload}`, { recursive: true, force: true });
            }
            catch (error) { };
            await DAO.DB.set('StatusChromiumDependency', 'Download Completo');
            callback(true);
        }
        else{
            await DAO.DB.set('StatusChromiumDependency', 'Não foi encontrar a dependência, por favor tente reiniciar o aplicativo.');
            callback(false); 
        }
    } catch (error) {
        try {
            fs.rmSync(`${pathFileDownload}`, { recursive: true, force: true });
        }catch (error) { };
        console.log(error);
        await DAO.DB.set('StatusChromiumDependency', 'Não foi possível extrair a dependência, por favor tente reiniciar o aplicativo.');
        callback(false); 
    }
}

function updateConfigJson(dirConfigJson, newDataConfigJson, callback){
    fs.readFile(dirConfigJson, 'utf-8', function(err, data){
        if (err){
            callback(false);
            return;
        }
        if(newDataConfigJson != null && newDataConfigJson.length > data.length){
            fs.writeFile(dirConfigJson, newDataConfigJson, 'utf-8', function (err) {
                if (err){
                    callback(false);
                    return;
                }
                DAO.LOGGER.Add('all', `${new Date().toLocaleString()} - Config.json atualizado com sucesso!`);
                callback(true);
            });
        }
        else{
            callback(false);
        }
    });
}

function ReiniciarWindows(){
    //console.log('Reiniciando...');
    exec('shutdown /r', (err, stdout, stderr) => {
    
    });
}

async function CheckAllFolderAdr(dir){
    if(!fs.existsSync(dir)){
        let split = dir.replaceAll('/', '\\').split('\\');
        let spp = "";
        for (let index = 0; index < split.length; index++) {
            if(spp == "") spp = split[index]; else spp += `\\${split[index]}`
            if(!fs.existsSync(spp))
                await fs.mkdirSync(spp);
        }
        return true;
    }
    else
        return true;
}

async function CreateDir(dir){
    if(!fs.existsSync(dir))
        await fs.mkdirSync(dir);
    return true;
}

function ReadFile(dir, callback){
    fs.readFile(dir, (err, data) => {
      if (err) callback(null);
      else{
        callback(data.toString());
      }
    });
}

async function DeleteDir(dir){
    try {
        return await fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {
        return false;
        console.log(error);
    }
}

async function ReadDir(dir, callback){
    fs.readdir(dir, (err, files) => {
        if(err)
            callback([], err)
        else
            callback(files);
    });
}

function FormatDataInstaloader(list, callback){
    try {
        var list_posts = new Array();
        list.user_posts.forEach(item => {
            var post = new post_model();

            if(item.node.is_video == true){
                post.url_video = item.node.video_url;
                post.url_thumbnail = item.node.thumbnail_src;
            }
            else{
                post.url_img = item.node.display_url;
                post.url_thumbnail = item.node.thumbnail_src;
            }
            if(item.node.edge_media_to_caption != null && item.node.edge_media_to_caption.edges[0] != null ){
                post.legenda = item.node.edge_media_to_caption.edges[0].node.text;
            }
            post.date = item.data_post;
            post.description = "";
            post.username_instagram = list.user_info.node.username;
            post.full_name = list.user_info.node.full_name;
            post.profile_pic_url = list.user_info.node.profile_pic_url_hd;

            list_posts.push(post);
        });

        callback(list_posts);
    } catch (error) {
        console.log(error);
        callback(null);
    }
}

async function CheckBlocksUpdates(Data, Socket) {
    try {
        if(Data != null){
            if(Data.json_tag_update && Data.id_tag_update){
                try {
                    if(TagUpdater.isDownloading == false){
                        let DtoTagUpdate = JSON.parse(Data.json_tag_update);
                        //Socket.send(JSON.stringify({code: DAO.TvCode, tv_name: await TagUpdater.getNameTv(), data: {response: 'finish_update', tag_date: null, id: Data.id_tag_update}, cmd: EnumTv.REMOVE_TAG_UPDATE}));
                        Api.Send(EnumTv.REMOVE_TAG_UPDATE, {
                            code: await DAO.TvCode,
                            json: JSON.stringify({response: 'finish_update', tag_date: null, id: Data.id_tag_update})
                        }).then(async (response)=>{
                            try {
                                //console.log(response.data);
                            } catch (error) {
                                console.log(error);
                            }
                        }).catch((error)=>{console.log(error.response)});
                        if(DtoTagUpdate && DtoTagUpdate.tag && DtoTagUpdate.tag.infobloco.length > 0){
                            TagUpdater.StartDownload(DtoTagUpdate, async (DataTagToUpdate)=>{
                                if(DataTagToUpdate != null){
                                    let DataPlayerNow = await DAO.TIMELINE.get('DataPlayer');
                                    if(DataPlayerNow){
                                        let listItens = await DataPlayerNow.map( item => {
                                            if(item.id_item_complet == DataTagToUpdate.id_item_complet){
                                                item = DataTagToUpdate;
                                            }
                                            return item;
                                        });
                                        await DAO.TIMELINE.set('NewDataPlayer', listItens);
                                    }
                                    else{
                                        await DAO.TIMELINE.set('NewDataPlayer', [DataTagToUpdate]);
                                        await DAO.TIMELINE.set('DataPlayer', [DataTagToUpdate]);
                                    }
                                    //await DAO.DB.set('UpdateDataPlayerNoReload', true);
                                    await DAO.DB.set('ReloadScreen', true);
                                }
                            });
                        }
                    }              
                } catch (error) {
                   console.log(error); 
                }
            }

            if(Data.dataUpdateBlock != null && Data.dataUpdateBlock.length > 0){
                if(BlockUpdater.isDownloading == false && Data.dataUpdateBlock.length > 0){
                    Data.dataUpdateBlock.forEach(async elemt => {
                        //Socket.send(JSON.stringify({code: DAO.TvCode, tv_name: await BlockUpdater.getNameTv(), data: {response: 'remove_block_update', id: elemt.id, date: elemt.date}, cmd: EnumTv.REMOVE_ITEM_BLOCK_UPDATE}));
                        Api.Send(EnumTv.REMOVE_ITEM_BLOCK_UPDATE, {
                            code: await DAO.TvCode,
                            json: JSON.stringify({response: 'remove_block_update', id: elemt.id, date: elemt.date})
                        }).then(async (response)=>{
                            try {
                               // console.log(response.data);
                            } catch (error) {
                                console.log(error);
                            }
                        }).catch((error)=>{console.log(error.response)});
                    });
                    BlockUpdater.StartDownload(Data.dataUpdateBlock, async (listToUpdate) => {
                        await DAO.DB.set('DownloadPercentage', null);
                        let DataPlayerNow = await DAO.TIMELINE.get('DataPlayer');
                        if(!DataPlayerNow || !Array.isArray(DataPlayerNow)) DataPlayerNow = [];
                        let TimeLineUpdated = DataPlayerNow.map( ( item ) => {
                            let itemToUpdate = listToUpdate.find( itemToUpdate => itemToUpdate.id_item_complet == item.id_item_complet);
                            if(itemToUpdate){
                                if(itemToUpdate.name_Tag != null){
                                    if(item.data[0]){
                                        item.data = item.data.map(block => {
                                            let blockToUpdate = itemToUpdate.data.find(b => b.diretorio == block.diretorio);
                                            if(blockToUpdate){
                                                block = blockToUpdate;
                                            }
                                            return block;
                                        });
                                    }
                                    else{
                                        item.data = itemToUpdate.data;
                                    }
                                }
                                else{
                                    item.data = itemToUpdate.data;
                                }
                            }
                            return item;
                        });
                        await DAO.TIMELINE.set('NewDataPlayer', TimeLineUpdated);
                        await DAO.DB.set('DownloadPercentage', null);
                        await DAO.DB.set('ReloadScreen', true);
                    })
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
}

async function checkTimeLineFilesToDelete(){
    return new Promise(async (resolve)=>{
        let listToVerify = await DAO.TIMELINE.get('DataPlayer');
        let dataTv = await DAO.DB.get('DataTv');
        if(listToVerify && dataTv && dataTv.timeline && listToVerify.length > 0){
            let timelinesDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Timelines', dataTv.timeline);
            let listFoldersTimeLine = await ListFolders(timelinesDir);
            let filesTimeLine = [];
            for (let index = 0; index < listToVerify.length; index++) {
                const item = listToVerify[index];
                if(item.data && item.data.diretorio != null){
                    filesTimeLine.push(item.data.diretorio.split('\\').join('/'));
                }
                else if(item.data && item.data[0]){
                    item.data.forEach( i => {
                        if(i.diretorio) filesTimeLine.push(i.diretorio.split('\\').join('/'));
                    });
                }
            }
            listFoldersTimeLine.forEach(async folder => {
                folder = folder.split('\\').join('/')+'/';
                if(!filesTimeLine.find(f => f.includes(folder)) && fs.existsSync(folder)){
                    await DeleteDir(folder);
                }
            });
        }
        else
            resolve();
    });
}

async function DeleteOldTimeLine(){
    let dataPlayer = await DAO.TIMELINE.get('DataPlayer');
    if(dataPlayer && dataPlayer.length > 0){
        let dataTv = await DAO.DB.get('DataTv');
        if(dataTv && dataTv.timeline){
            let timelinesDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Timelines');
            let listFoldersTimeLine = await ListFolders(timelinesDir);
            listFoldersTimeLine.forEach(dirTimeLine => {
                if(dirTimeLine != path.join(timelinesDir, dataTv.timeline)){
                    DeleteDir(dirTimeLine);
                }
            })
        }
    }
}

async function DeleteAllFilesInstagram(){
    let dataTv = await DAO.DB.get('DataTv');
    if(dataTv && dataTv.timeline){
        let timelinesDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Posts-Instagram');
        let listFiles = await ListAllFoldersOrFiles(timelinesDir);
        listFiles.forEach(DirFIle => {
            DeleteDir(DirFIle);
        })
    }
}

function ListAllFoldersOrFiles(directoryPath) {
  try {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const folders = entries.map(entry => path.join(directoryPath, entry.name));
    return folders;
  } catch (err) {
    console.error('Error reading directory:', err);
    return [];
  }
}

function ListFolders(directoryPath) {
  try {
    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    const folders = entries.filter(entry => entry.isDirectory()).map(entry => path.join(directoryPath, entry.name));
    return folders;
  } catch (err) {
    console.error('Error reading directory:', err);
    return [];
  }
}

async function copiarTexto(texto) {
    try {
        const ncp = require('copy-paste');
        ncp.copy(texto, function() {
           // console.log('Texto copiado com sucesso!');
        });
    } catch (error) {
      console.error('Erro ao copiar texto:', error);
    }
}

function isDateMoreThanOneDayFromNow(timestamp) {
    const now = new Date().getTime();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    
    return timestamp > (now + oneDayInMs);
}

module.exports = {
    ListFolders,
    copiarTexto,
    checkTimeLineFilesToDelete,
    DeleteOldTimeLine,
    DeleteAllFilesInstagram,
    CheckChromiumDependency,
    updateConfigJson,
    ReiniciarWindows,
    CheckAllFolderAdr,
    CreateDir,
    ReadFile,
    DeleteDir,
    ReadDir,
    FormatDataInstaloader,
    CheckBlocksUpdates,
    isDateMoreThanOneDayFromNow,
}