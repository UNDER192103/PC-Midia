
const { app } = require('electron');
const path = require('path');
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const EnumTv = require(path.join(app.getAppPath(), "Domain", "Models", "EnumTv.js"));
const axios = require('axios');
const fs = require('fs');


class TagUpdater {
    _timelinesDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Timelines');
    _dirTimeLine;
    _callback;
    _dataTv;
    isDownloading = false;
    _posDI = 0;
    _posDII = 0;
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
        this.CheckExisteValidFile(userAvatarDirFile, async (isValidFile)=>{
            if(isValidFile == true){
                this.DownloadFileByUrl(Item, dataBlock.nomeBloco, block.profile_pic_url_hd, userAvatarDirFile).then(async ()=>{
                    Callback(userAvatarDirFile);
                })
                .catch(error =>{
                    Callback(null);
                });
            }
            else{
                Callback(userAvatarDirFile);
            }
        });
    }

    async DownlaodUserInstagramPost(Item, block, dataBlock, dirBlock, Callback){
        let postDirFile = path.join(dirBlock, `user-post-${this._posDII}.${block.video_url != null && block.video_url != '' ? "mp4" : "png"}`);
        let urlFile = block.video_url != null && block.video_url != '' ? block.video_url : block.url;
        this.CheckExisteValidFile(postDirFile, async (isValidFile)=>{
            if(isValidFile === true){
                this.DownloadFileByUrl(Item, dataBlock.nomeBloco, urlFile, postDirFile).then(async ()=>{
                    Callback(postDirFile);
                })
                .catch(error =>{
                    Callback(null);
                });
            }
            else{
                Callback(postDirFile);
            }
        });
    }

    async DownloadBlockLogo(Item, dataBlock, dirBlock, Callback){
        let dirBlockLogo = path.join(dirBlock, "block-logo.png");
        if(dataBlock.diretorioLogo != null){
            this.CheckExisteValidFile(dirBlockLogo, async (isValidFile)=>{
                if(isValidFile === true){
                    this.DownloadFileByUrl(Item, dataBlock.nomeBloco, dataBlock.diretorioLogo, dirBlockLogo).then(async ()=>{
                        Callback(dirBlockLogo);
                    })
                    .catch(error =>{
                        Callback(null);
                    });
                }
                else{
                    Callback(dirBlockLogo);
                }
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

    async DownloadBlockByTag(Item, Block, Callback){
        try {
            let dataBlock = JSON.parse(Block.json);
            let dirBlock = path.join(this._dirTimeLine, `${Block.bloco} - ${dataBlock.nomeBloco}`);
            await this.CreateDir(dirBlock);
            let url, dirFile, dirFileHtml;
            await this.sendPercentageDownlaod(Item, dataBlock.nomeBloco);
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
                    this.CheckExisteValidFile(dirFile, async (isValidFile)=>{
                        if(isValidFile === true){
                            this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                                Callback({
                                    diretorio: dirFile,
                                    blocoId: Block.bloco,
                                    duration: Block.duration,
                                    type: dataBlock.tipoBlock,
                                });
                            })
                            .catch(error =>{
                                Callback(null);
                            });
                        }
                        else{
                            Callback({
                                diretorio: dirFile,
                                blocoId: Block.bloco,
                                duration: Block.duration,
                                type: dataBlock.tipoBlock,
                            });
                        }
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

    async DownloadBlockTag(Item, Callback, blocks = []){
        try {
            if(Item.tag && Item.tag.infobloco){
                if(this._posDII < Item.tag.infobloco.length){
                    let Block = Item.tag.infobloco[this._posDII];
                    await this.sendPercentageDownlaod(Item);
                    this.DownloadBlockByTag(Item, Block, (data) => {
                        if(data){
                            blocks.push(data);
                            this._posDII++;
                            this.DownloadBlockTag(Item, Callback, blocks);
                        }
                        else{
                            this._posDII++;
                            this.DownloadBlockTag(Item, Callback, blocks);
                        }
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
            }
            else{
                Callback(null);
            }
        } catch (error) {
            this._posDII++;
            if(this._posDII < Item.tag.infobloco.length){
                this.DownloadBlockTag(Item, Callback, blocks);
            }
            else{
                Callback(null);
            }
        }
    }

    async sendPercentageDownlaod(Block, nameBlock = ""){
        let data = {
            response: "porcentagem",
            text: "Atualização de Tag",
            now: 0,
            max: 1,
            blocoListaNow: parseFloat(`${this._posDII}.${this._filePercentageDownlaod}`),
            blocoListaMax: Block.infoBloco != null && Block.infoBloco[0] != null ? Block.infoBloco.length : Block.tag != null && Block.tag.infobloco != null&& Block.tag.infobloco[0] != null ? Block.tag.infobloco.length : 1,
            nameBLock: nameBlock,
            block: {
                percent: this._filePercentageDownlaod > 100 ? 100 : this._filePercentageDownlaod,
                isUpdate: false,
                text: "Update " + nameBlock,
            }
        };
        if(data.blocoListaNow > data.blocoListaMax){
            data.blocoListaNow = data.blocoListaMax;
        }
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
    async StartDownload(Tag, callback){
        this._callback = callback;
        this._dataTv = await DAO.DB.get('DataTv');
        this._tId = this._dataTv.timeline;
        if(Tag != null && Tag.id && Tag.tag && this._tId){
            this._dirTimeLine = path.join(this._timelinesDir, this._tId);
            await this.CheckAllFolderAdr(this._dirTimeLine);
            this.isDownloading = true;
            this.DownloadBlockTag(Tag, async (data)=>{
                this.isDownloading = false;
                await DAO.DB.set('DownloadPercentage', null);
                this._callback(data);
            });
        }
        else{
            this.isDownloading = false;
        }
    }
}

module.exports = TagUpdater;