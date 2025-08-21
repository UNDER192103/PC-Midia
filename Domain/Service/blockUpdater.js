
const { app } = require('electron');
const path = require('path');
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const EnumTv = require(path.join(app.getAppPath(), "Domain", "Models", "EnumTv.js"));
const axios = require('axios');
const fs = require('fs');
const { Console } = require('console');


class BlockUpdater {
    _timelinesDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Timelines');
    _dirTimeLine;
    _callback;
    _dataTv;
    isDownloading = false;
    _maxPosD = 0;
    _maxPosDII = 0;
    _posD = 0;
    _posDI = 0;
    _posDII = 0;
    _possubDII = 0;
    _tId;
    _filePercentageDownlaod;
    _itensToDownload = [];
    _itensDownloaded = [];

    constructor(){

    }

    async getNameTv(){
        let nameTv = null
        if(this._dataTv && this._dataTv.nome) nameTv = this._dataTv.nome
        return nameTv;
    }

    async GetPageByUrl(url){
        return new Promise((resolve) => {
            try {
                axios.get(url).then(function(response){
                  resolve(response.data);
                }).catch(function (error) {
                    resolve(null);
                });
            } catch (error) {
                resolve(null);
            }
        }); 
    }

    async DownloadFileByUrl(Block, nameBlock, url, dir){
            return new Promise(async (resolve, reject) => {
                try {
                    const response = await axios.get(url, {
                      responseType: 'arraybuffer',
                      onDownloadProgress: (progressEvent) => {
                        const total = progressEvent.total;
                        const current = progressEvent.loaded;
                        this._filePercentageDownlaod = Math.round((current / total) * 100);
                        this.sendPercentageDownlaod(Block, nameBlock);
                      },
                    });
                    if(response.data){
                        await fs.promises.writeFile(dir, response.data);
                        this.CheckExisteValidFile(dir, async (isValidFile)=>{
                            if(isValidFile === false){
                                resolve(true);
                            }
                            else{
                                if(fs.existsSync(dir)){
                                    fs.unlinkSync(dir);
                                }
                                reject(null);
                            }
                        });
                    }
                    else{
                        if(fs.existsSync(dir)){
                            fs.unlinkSync(dir);
                        }
                        reject(null);
                    }
                } catch (error) {
                    if(fs.existsSync(dir)){
                        fs.unlinkSync(dir);
                    }
                    reject(null);
                }
            });
        }

    async CheckExisteValidFile(dirFile, Callback){
        if(fs.existsSync(dirFile)){
            let file = fs.statSync(dirFile);
            if(file && file.size > 1){
                Callback(false);
            }
            else{
                Callback(true);
            }
        }
        else
            Callback(true);
    }

    async DownlaodUserInstagramAvatar(Item, block, dataBlock, dirBlock, Callback){
        let userAvatarDirFile = path.join(dirBlock, "user-avatar.png");
        this.DownloadFileByUrl(Item, dataBlock.nomeBloco, block.profile_pic_url_hd, userAvatarDirFile).then(async ()=>{
            Callback(userAvatarDirFile);
        })
        .catch(error =>{
            Callback(null);
        });
    }

    async DownlaodUserInstagramPost(Item, block, dataBlock, dirBlock, Callback){
        let postDirFile = path.join(dirBlock, `user-post-${this._posDII}.${block.video_url != null && block.video_url != '' ? "mp4" : "png"}`);
        let urlFile = block.video_url != null && block.video_url != '' ? block.video_url : block.url;
        this.DownloadFileByUrl(Item, dataBlock.nomeBloco, urlFile, postDirFile).then(async ()=>{
            Callback(postDirFile);
        })
        .catch(error =>{
            Callback(null);
        });
    }

    async DownloadBlockLogo(Item, dataBlock, dirBlock, Callback){
        let dirBlockLogo = path.join(dirBlock, "block-logo.png");
        if(dataBlock.diretorioLogo != null){
            this.DownloadFileByUrl(Item, dataBlock.nomeBloco, dataBlock.diretorioLogo, dirBlockLogo).then(async ()=>{
                Callback(dirBlockLogo);
            })
            .catch(error =>{
                Callback(null);
            });
        }
        else{
            Callback(true);
        }
    }

    async CreateFileByData(dirfile, data){
        return new Promise((resolve)=>{
            fs.writeFile(dirfile, data, function (err) {
                if (err)
                    resolve(null);
                else
                    resolve(true);
            });
        });
    }

    async DownloadFilesInstagram(Item, block, dataBlock, dirBlock, Callback){
        this.DownlaodUserInstagramAvatar(Item, block, dataBlock, dirBlock, (userAvatarDirFile)=>{
            this.DownlaodUserInstagramPost(Item, block, dataBlock, dirBlock, (userPostDirFile)=>{
                if(userPostDirFile){
                    this.DownloadBlockLogo(Item, dataBlock, dirBlock, (dirBlockLogo)=>{
                        let UrlHtml = `${DAO.Config.URL_SITE}/?ng=block/image-generator/${dataBlock.tipoBlock.toLowerCase()}/${block.bloco}/2/${this._posDII}`;	
                        this.GetPageByUrl(UrlHtml).then(async (Html) => {
                            if(Html != null){
                                Html = Html.replaceAll("url_file_video", userPostDirFile);
                                Html = Html.replaceAll("url_file_main", userPostDirFile);
                                if(userAvatarDirFile){
                                    Html = Html.replace("url_file_avatar", userAvatarDirFile);
                                }
                                else{
                                    Html = Html.replace("url_file_avatar", '');
                                }
                                if(dirBlockLogo){
                                    Html = Html.replace("url_file_logo", dirBlockLogo);
                                }
                                else{
                                    Html = Html.replace("url_file_logo", '');
                                }
                                let dirFileHtml = path.join(dirBlock, `user-post-${this._posDII}.html`);
                                this.CreateFileByData(dirFileHtml, Html).then(async (isCreated)=>{
                                    if(isCreated){
                                        this.CheckExisteValidFile(dirFileHtml, (isInvalidFile) => {
                                            if(isInvalidFile === false){
                                                Callback(
                                                    {
                                                        dir: dirFileHtml,
                                                        id: block.bloco,
                                                        duration: block.duration,
                                                        type: dataBlock.tipoBlock
                                                    }
                                                );
                                            }
                                            else{
                                                Callback(null);
                                            }
                                        });
                                    }
                                    else{
                                        Callback(null);
                                    }
                                });
                            }
                            else{
                                Callback(null);
                            }
                        });
                    });
                }
                else{
                    Callback(null);
                }
            });
        });
    }

    async DownloadFilesRss(Item, block, dataBlock, dirBlock, Callback){
        try {
            let url = dataBlock.diretorio.replaceAll("/usr/share/nginx/", "https://");
            let dirFile = path.join(dirBlock, url.split("/").pop());
            this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                this.DownloadBlockLogo(Item, dataBlock, dirBlock, (dirBlockLogo)=>{
                    if(dirBlockLogo){
                        let UrlHtml = `${DAO.Config.URL_SITE}/?ng=block/image-generator/${dataBlock.tipoBlock.toLowerCase()}/${block.bloco}/2/${this._posDII}`;	
                        this.GetPageByUrl(UrlHtml).then(async (Html) => {
                            if(Html != null){
                                Html = Html.replaceAll(url, dirFile);
                                if(dirBlockLogo != true){
                                    let urlLogo = dataBlock.diretorioLogo.replaceAll("/usr/share/nginx/", "https://");
                                    Html = Html.replace(urlLogo, dirBlockLogo);
                                }
                                let dirFileHtml = path.join(dirBlock, `rss-${this._posDII}.html`);
                                this.CreateFileByData(dirFileHtml, Html).then(async (isCreated)=>{
                                    if(isCreated){
                                        this.CheckExisteValidFile(dirFileHtml, (isInvalidFile) => {
                                            if(isInvalidFile === false){
                                                Callback(
                                                    {
                                                        dir: dirFileHtml,
                                                        id: block.bloco,
                                                        duration: block.duration,
                                                        type: dataBlock.tipoBlock
                                                    }
                                                );
                                            }
                                            else{
                                                Callback(null);
                                            }
                                        });
                                    }
                                    else{
                                        Callback(null);
                                    }
                                });
                            }
                            else{
                                Callback(null);
                            }
                        });
                    }
                    else{
                        Callback(null);
                    }
                });
            })
            .catch(error =>{
                Callback(null);
            });
        } catch (error) {
            Callback(null);
        }
    }

    async CreateDir(dir){
        if(!fs.existsSync(dir))
            await fs.mkdirSync(dir);
        return true;
    }

    async DownloadBlock(Item, Block, Callback){
        try {
            let dataBlock = JSON.parse(Block.json);
            let dirBlock = path.join(this._dirTimeLine, `${Block.bloco} - ${dataBlock.nomeBloco}`);
            await this.CreateDir(dirBlock);
            let url, dirFile, dirFileHtml;
            switch (dataBlock.tipoBlock) {

                case "RSS":
                    this.DownloadFilesRss(Item, Block, dataBlock, dirBlock, (data)=>{
                        if(data){
                            Callback({
                                diretorio: data.dir,
                                blocoId: data.id,
                                duration: data.duration,
                                type: data.type,
                            });
                        }
                        else{
                            Callback(null);
                        }
                    });
                break;

                case "VIDEO":
                    url = dataBlock.diretorio.replaceAll("/usr/share/nginx/", "https://");
                    dirFile = path.join(dirBlock, url.split("/").pop());
                    this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                        Callback({
                            diretorio: dirFile,
                            blocoId: Block.bloco,
                            duration: Block.duration,
                            type: dataBlock.tipoBlock,
                        }, true);
                    })
                    .catch(error =>{
                        Callback(null);
                    });
                break;

                case "IMG":
                    url = dataBlock.diretorio.replaceAll("/usr/share/nginx/", "https://");
                    dirFile = path.join(dirBlock, url.split("/").pop());
                    dirFileHtml = path.join(dirBlock, `image-html.html`);
                    this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                        this.DownloadBlockLogo(Item, dataBlock, dirBlock, (dirBlockLogo)=>{
                            if(dirBlockLogo){
                                let UrlHtml = `${DAO.Config.URL_SITE}/?ng=block/image-generator/${dataBlock.tipoBlock.toLowerCase()}/${Block.bloco}/2/${this._posDII}`;	
                                this.GetPageByUrl(UrlHtml).then(async (Html) => {
                                    if(Html != null){
                                        Html = Html.replaceAll(url, dirFile);
                                        if(dirBlockLogo != true && dataBlock.diretorioLogo) Html = Html.replace(dataBlock.diretorioLogo, dirBlockLogo);
                                        this.CreateFileByData(dirFileHtml, Html).then(async (isCreated)=>{
                                            if(isCreated){
                                                this.CheckExisteValidFile(dirFileHtml, (isInvalidFile) => {
                                                    if(isInvalidFile === false){
                                                        Callback({
                                                            diretorio: dirFileHtml,
                                                            blocoId: Block.bloco,
                                                            duration: Block.duration,
                                                            type: dataBlock.tipoBlock,
                                                        });
                                                    }
                                                    else{
                                                        Callback(null);
                                                    }
                                                });
                                            }
                                            else{
                                                Callback(null);
                                            }
                                        });
                                    }
                                    else{
                                        Callback(null);
                                    }
                                });
                            }
                            else{
                                Callback(null);
                            }
                        });
                    })
                    .catch(error =>{
                        Callback(null);
                    });
                break;

                case "INSTAGRAM":
                    this.DownloadFilesInstagram(Item, Block, dataBlock, dirBlock, (data)=>{
                        if(data){
                            Callback({
                                diretorio: data.dir,
                                blocoId: data.id,
                                duration: data.duration,
                                type: data.type,
                            }); 
                        }
                        else{
                           Callback(null);
                        }
                    });
                break;
            
                default:
                    console.log(dataBlock.tipoBlock);
                    Callback(null);
                break;
            }
        } catch (error) {
            Callback(null);
        }
    }

    async ForDownloadBlocks(Item, ListBlocks, Callback, blocks = new Array()){
        try {
            if(Item && ListBlocks){
                if(this._posDII < ListBlocks.length){
                    this._maxPosDII = ListBlocks.length;
                    this.sendPercentageDownlaod(Item);
                    let Block = ListBlocks[this._posDII];
                    this.DownloadBlock(Item, Block, (data, isOnItem) => {
                        this._posDII++;
                        this.sendPercentageDownlaod(Item);
                        if(data){
                            if(isOnItem === true){
                                if(Item.tags != null && Item.name_Tag != null){
                                    if(!blocks[0]){
                                        blocks = [data];
                                    }
                                    else{
                                        blocks.push(data);
                                    }
                                }
                                else{
                                    blocks = data;
                                }
                            }
                            else
                                blocks.push(data);
                        }
                        this.ForDownloadBlocks(Item, ListBlocks, Callback, blocks);
                    });
                }
                else{
                    Callback(blocks);
                }
            }
            else{
                Callback(null);
            }
        } catch (error) {
            console.log(error);
            this._posDII++;
            if(this._posDII < ListBlocks.length){
                this.ForDownloadBlocks(Item, ListBlocks, Callback, blocks);
            }
            else{
                Callback(null);
            }
        }
    }

    async ForBlockTimeLinesBlocs(Item, Callback, blocks = new Array()){
        try {
            if(this._posDI < Item.infoBloco.length){
                let Data = Item.infoBloco[this._posDI];
                let listBlocks = Data.DataBlock;
                await this.sendPercentageDownlaod(Item);
                this.ForDownloadBlocks(Item, listBlocks, async (data)=>{
                    this._posDI++;
                    await this.sendPercentageDownlaod(Item);
                    if(data){
                        if(blocks.length === 0)
                            blocks = data;
                        else
                            blocks.concat(data);
                    }
                    this.ForBlockTimeLinesBlocs(Item, Callback, blocks);
                });
            }
            else{
                Callback({
                    id_item_complet: Item.id_item_complet,
                    pos: 0,
                    blocoId: Item.blocos,
                    noArray: false,
                    name_Tag: Item.name_Tag,
                    random_itens: Item.random_itens,
                    tempo: Item.tempo,
                    tempo_instagram: Item.tempo_instagram,
                    tempo_rss: Item.tempo_rss,
                    tempo_img: Item.tempo_img,
                    tempo_video: Item.tempo_video,
                    ismultitempo: Item.ismultitempo,
                    type: Item.type,
                    random: false,
                    data: blocks
                });
            }
        } catch (error) {
            if(this._posDI < Item.infoBloco.length){
                this._posDI++;
                this.ForBlockTimeLinesBlocs(Item, Callback, blocks);
            }
            else{
                Callback(null);
            }
        }
    }

    async ForListBlockUpdate(BlockToUpdate, Callback, Blocks = new Array()){
        try {
            this._maxPosD = BlockToUpdate.length;
            if(this._posD < this._maxPosD){
                let Block = BlockToUpdate[this._posD];
                let Item = JSON.parse(Block.json);
                await this.sendPercentageDownlaod(Item);
                this.ForBlockTimeLinesBlocs(Item, (data) => {
                    this._posD++;
                    if(data){
                        Blocks.push(data);
                    }
                    this.ForListBlockUpdate(BlockToUpdate, Callback, Blocks);
                });
            }
            else{
                Callback(Blocks);
            }
        } catch (error) {
            if(this._posD < this._maxPosD){
                this._posD++;
                ForListBlockUpdate(BlockToUpdate, Callback, Blocks);
            }
            else{
                Callback(null);
            }
        }
    }

    async sendPercentageDownlaod(Block, nameBlock = ""){
        let data = {
            response: "porcentagem",
            text: "Atualização de blocos",
            now: this._posDI,
            max: Block.infoBloco.length,
            blocoListaNow: parseFloat(`${this._posDII}.${this._filePercentageDownlaod}`),
            blocoListaMax: this._maxPosDII,
            nameBLock: nameBlock,
            block: {
                percent: this._filePercentageDownlaod > 100 ? 100 : this._filePercentageDownlaod,
                isUpdate: true,
                text: "Update " + nameBlock,
            }
        };
        if(data.now > data.max){
            data.now = data.max;
        }
        if(data.blocoListaNow > data.blocoListaMax){
            data.blocoListaNow = data.blocoListaMax;
        }
        if(this.isDownloading)
            await DAO.DB.set('DownloadPercentage', data);
    }

    async CheckAllFolderAdr(dir){
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
    async StartDownload(Blocks, callback){
        this._callback = callback;
        this._dataTv = await DAO.DB.get('DataTv');
        this._tId = this._dataTv.timeline;
        if(this.isDownloading === false){
            if(Blocks != null && Blocks.length > 0 && this._tId){
                this._dirTimeLine = path.join(this._timelinesDir, this._tId);
                await this.CheckAllFolderAdr(this._dirTimeLine);
                this.isDownloading = true;
                this._maxPosD = Blocks.length;
                this.ForListBlockUpdate(Blocks, async (data)=>{
                    this._callback(data);
                    await this.ClearData();
                });
            }
            else{
                this.ClearData();
            }
        }
    }

    async ClearData(){
        await DAO.DB.set('DownloadPercentage', null);
        this._maxPosD = 0;
        this._maxPosDII = 0;
        this._posD = 0;
        this._posDI = 0;
        this._posDII = 0;
        this._filePercentageDownlaod;
        this._itensToDownload = [];
        this._itensDownloaded = [];
        setTimeout(()=>{
            this.isDownloading = false;
        }, 2000);
    }
}

module.exports = BlockUpdater;