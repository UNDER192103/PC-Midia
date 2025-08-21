
const { app } = require('electron');
const path = require('path');
const Api = require(path.join(app.getAppPath(), "Repository", "api.js"));
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const EnumTv = require(path.join(app.getAppPath(), "Domain", "Models", "EnumTv.js"));
const Commun = require(path.join(app.getAppPath(), "Domain", "Commun", "commun.js"));
const axios = require('axios');
const fs = require('fs');


class TimeLineDownloader {
    _timelinesDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Timelines');
    _dirTimeLine;
    _callback;
    _Socket;
    _dataTv;
    isDownloading = false;
    _filePercentageDownlaod = 0;
    _posDI = 0;
    _posDII = 0;
    _tId;
    _itensToDownload = [];
    _itensDownloaded = [];

    constructor(){

    }

    SetSocket(Socket){ this._Socket = Socket; }

    async SendSocketLogs(data){
        try {
            Api.Send(EnumTv.TV_LOG, {
                code: await DAO.GetTvCode(),
                json: JSON.stringify({ code: DAO.TvCode, tv_name: await this.getNameTv(), data: data, cmd: EnumTv.TV_LOG }),
            }).then(async (response)=>{

            })
            .catch((error)=>{
                console.log(error.response);
            });
        } catch (error) {
            console.log(error);
        }
        this._Socket.send(JSON.stringify({ code: DAO.TvCode, tv_name: await this.getNameTv(), data: data, cmd: EnumTv.TV_LOG }));
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
                axios.get(url, {
                  responseType: 'arraybuffer',
                  onDownloadProgress: (progressEvent) => {
                    const total = progressEvent.total;
                    const current = progressEvent.loaded;
                    this._filePercentageDownlaod = Math.round((current / total) * 100);
                    this.sendPercentageDownlaod(Block, nameBlock);
                  },
                }).then(async response => {
                    //console.log(response.status);
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
                    
                })
                .catch(async error => {
                    /*if(error && error.status){
                        console.log(error.status);
                    }*/
                    reject(null);
                });
            } catch (error) {
                if(fs.existsSync(dir)){
                    fs.unlinkSync(dir);
                }
                reject(null);
            }
        });
    }

   async RemoveFileAndPath(dirFile){
        if(fs.existsSync(dirFile)){
            fs.unlinkSync(dirFile);
            fs.rmdirSync(dirFile.replace(dirFile.split("/").pop(), ""));
        }
        else{
            if(fs.existsSync(dirFile.replace(dirFile.split("/").pop(), "")))
                fs.rmdirSync(dirFile.replace(dirFile.split("/").pop(), ""));
        }
        return true;
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

    async DownloadBlockVideo(Item, Callback){
        try {
            if(Item.infoBloco && Item.infoBloco[0]){
                let block = Item.infoBloco[0];
                let dataBlock = JSON.parse(block.json);
                let url = dataBlock.diretorio.replaceAll("/usr/share/nginx/", "https://");
                let dirBlock = path.join(this._dirTimeLine, `${block.bloco} - ${dataBlock.nomeBloco}`);
                let dirFile = path.join(dirBlock, url.split("/").pop());
                await this.sendPercentageDownlaod(Item, dataBlock.nomeBloco);
                await Commun.CreateDir(dirBlock);
                let dto = {
                    id_item_complet: Item.id_item_complet,
                    pos: 0,
                    blocoId: Item.blocos,
                    noArray: true,
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
                    data: {
                        diretorio: dirFile,
                        blocoId: block.bloco,
                        duration: block.duration,
                        type: dataBlock.tipoBlock,
                    }
                };
                this.CheckExisteValidFile(dirFile, async (isValidFile)=>{
                    if(isValidFile === true){
                        this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                            this._itensDownloaded.push(dto);
                            Callback();
                        })
                        .catch(error =>{
                            //console.log(error);
                            this.RemoveFileAndPath(dirFile);
                            Callback();
                        });
                    }
                    else{
                        this._posDII = Item.infoBloco.length;
                        this._itensDownloaded.push(dto);
                        Callback();
                    }
                });
            }
            else{
                Callback();
            }
        } catch (error) {
            //console.log(error);
            Callback();
        }
    }

    async DownloadBlockImg(Item, Callback){
        try {
            if(Item.infoBloco && Item.infoBloco[0]){
                let block = Item.infoBloco[0];
                let dataBlock = JSON.parse(block.json);
                let url = dataBlock.diretorio.replaceAll("/usr/share/nginx/", "https://");
                let dirBlock = path.join(this._dirTimeLine, `${block.bloco} - ${dataBlock.nomeBloco}`);
                let dirFile = path.join(dirBlock, url.split("/").pop());
                let dirFileHtml = path.join(dirBlock, `image-html.html`);
                await this.sendPercentageDownlaod(Item, dataBlock.nomeBloco);
                await Commun.CreateDir(dirBlock);
                let dto = {
                    id_item_complet: Item.id_item_complet,
                    pos: 0,
                    blocoId: Item.blocos,
                    noArray: true,
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
                    data: {
                        diretorio: dirFileHtml,
                        blocoId: block.bloco,
                        duration: block.duration,
                        type: block.type,
                    }
                };
                this.CheckExisteValidFile(dirFile, async (isValidFile)=>{
                    if(isValidFile === true){
                        this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                            this.DownloadBlockLogo(Item, dataBlock, dirBlock, (dirBlockLogo)=>{
                                if(dirBlockLogo){
                                    let UrlHtml = `${DAO.Config.URL_SITE}/?ng=block/image-generator/${dataBlock.tipoBlock.toLowerCase()}/${block.bloco}/2/${this._posDII}`;	
                                    this.GetPageByUrl(UrlHtml).then(async (Html) => {
                                        if(Html != null){
                                            Html = Html.replaceAll(url, dirFile);
                                            if(dirBlockLogo != true && dataBlock.diretorioLogo) Html = Html.replace(dataBlock.diretorioLogo, dirBlockLogo);
                                            this.CreateFileByData(dirFileHtml, Html).then(async (isCreated)=>{
                                                if(isCreated){
                                                    this.CheckExisteValidFile(dirFileHtml, (isInvalidFile) => {
                                                        if(isInvalidFile === false){
                                                            this._itensDownloaded.push(dto);
                                                            Callback();
                                                        }
                                                        else{
                                                            Callback();
                                                        }
                                                    });
                                                }
                                                else{
                                                    Callback();
                                                }
                                            });
                                        }
                                        else{
                                            Callback();
                                        }
                                    });
                                }
                                else{
                                    Callback();
                                }
                            });
                        })
                        .catch(error =>{
                            //console.log(error);
                            this.RemoveFileAndPath(dirFile);
                            Callback();
                        });
                    }
                    else{
                        this._posDII = Item.infoBloco.length;
                        this._itensDownloaded.push(dto);
                        Callback();
                    }
                
                });
            }
            else{
                Callback();
            }
        } catch (error) {
            Callback();
        }
    }

    async DownlaodUserInstagramAvatar(Item, block, dataBlock, dirBlock, Callback){
        let userAvatarDirFile = path.join(dirBlock, "user-avatar.png");
        this.CheckExisteValidFile(userAvatarDirFile, async (isValidFile)=>{
            if(isValidFile === true){
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
                    //console.log(error);
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
                        //console.log(error);
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
                //console.log(error);
                Callback(null);
            });
        } catch (error) {
            //console.log(error);
            Callback(null);
        }
    }

    async DownloadBlockInstagram(Item, Callback, blocks = []){
        try {
            if(this._posDII < Item.infoBloco.length){
                let block = Item.infoBloco[this._posDII];
                let dataBlock = JSON.parse(block.json);
                let dirBlock = path.join(this._dirTimeLine, `${block.bloco} - ${dataBlock.nomeBloco}`);
                await this.sendPercentageDownlaod(Item, dataBlock.nomeBloco);
                await Commun.CreateDir(dirBlock);
                this.DownloadFilesInstagram(Item, block, dataBlock, dirBlock, (data)=>{
                    if(data){
                        this._posDII++;
                        blocks.push({
                            diretorio: data.dir,
                            blocoId: data.id,
                            duration: data.duration,
                            type: data.type,
                        });
                        this.DownloadBlockInstagram(Item, Callback, blocks); 
                    }
                    else{
                        this._posDII++;
                        this.DownloadBlockInstagram(Item, Callback, blocks); 
                    }
                });
            }
            else{
                this._itensDownloaded.push(
                    {
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
                    }
                );
                Callback();
            }
        } catch (error) {
            //console.log(error);
            this._posDII++;
            if(this._posDII < Item.infoBloco.length)
                this.DownloadBlockInstagram(Item, Callback, blocks);
            else
                Callback();
        }
    }

    async DownloadBlockRss(Item, Callback, blocks = []){
        try {
            if(this._posDII < Item.infoBloco.length){
                let Block = Item.infoBloco[this._posDII];
                let dataBlock = JSON.parse(Block.json);
                let dirBlock = path.join(this._dirTimeLine, `${Block.bloco} - ${dataBlock.nomeBloco}`);
                await this.sendPercentageDownlaod(Item, dataBlock.nomeBloco);
                await Commun.CreateDir(dirBlock);
                this.DownloadFilesRss(Item, Block, dataBlock, dirBlock, (data)=>{
                    if(data){
                        this._posDII++;
                        blocks.push({
                            diretorio: data.dir,
                            blocoId: data.id,
                            duration: data.duration,
                            type: data.type,
                        });
                        this.DownloadBlockRss(Item, Callback, blocks); 
                    }
                    else{
                        this._posDII++;
                        //this.RemoveFileAndPath(dirFile);
                        this.DownloadBlockRss(Item, Callback, blocks); 
                    }
                });
            }
            else{
                this._itensDownloaded.push(
                    {
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
                    }
                );
                Callback();
            }
        } catch (error) {
            //console.log(error);
            this._posDII++;
            if(this._posDII < Item.infoBloco.length){
                this.DownloadBlockInstagram(Item, Callback, blocks);
            }
            else{
                Callback();
            }
        }
    }

    async DownloadBlockByTag(Item, Block, Callback){
        try {
            let dataBlock = JSON.parse(Block.json);
            let dirBlock = path.join(this._dirTimeLine, `${Block.bloco} - ${dataBlock.nomeBloco}`);
            await this.sendPercentageDownlaod(Item, dataBlock.nomeBloco);
            await Commun.CreateDir(dirBlock);
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
                    this.CheckExisteValidFile(dirFile, async (isValidFile)=>{
                        if(isValidFile === true){                           
                            this.DownloadFileByUrl(Item, dataBlock.nomeBloco, url, dirFile).then(async ()=>{
                                this.DownloadBlockLogo(Item, dataBlock, dirBlock, (dirBlockLogo)=>{
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
                                });
                            })
                            .catch(error =>{
                                Callback(null);
                            });
                        }
                        else{
                            Callback({
                                diretorio: dirFileHtml,
                                blocoId: Block.bloco,
                                duration: Block.duration,
                                type: dataBlock.tipoBlock,
                            });
                        }
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
            console.log(error);
            Callback(null);
        }
    }

    async DownloadBlockTag(Item, Callback, blocks = []){
        try {
            if(Item.tag && Item.tag.infobloco){
                if(this._posDII < Item.tag.infobloco.length){
                    let Block = Item.tag.infobloco[this._posDII];
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
                    this._itensDownloaded.push(
                        {
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
                        }
                    );
                    Callback();
                }
            }
            else{
                this._posDII++;
                if(this._posDII < Item.tag.infobloco.length){
                    this.DownloadBlockTag(Item, Callback, blocks);
                }
                else{
                    Callback();
                }
            }
        } catch (error) {
            //console.log(error);
            this._posDII++;
            if(this._posDII < Item.tag.infobloco.length){
                this.DownloadBlockTag(Item, Callback, blocks);
            }
            else{
                Callback();
            }
        }
    }

    async sendPercentageDownlaod(Block, nameBlock = ""){
        let data = {
            response: "porcentagem",
            text: "Time Line Download",
            now: this._posDI,
            max: this._itensToDownload.length,
            blocoListaNow: parseFloat(`${this._posDII}.${this._filePercentageDownlaod}`),
            blocoListaMax: Block.infoBloco != null && Block.infoBloco[0] != null ? Block.infoBloco.length : Block.tag != null && Block.tag.infobloco != null&& Block.tag.infobloco[0] != null ? Block.tag.infobloco.length : 1,
            nameBLock: nameBlock,
            block: {
                percent: this._filePercentageDownlaod > 100 ? 100 : this._filePercentageDownlaod,
                isUpdate: false,
                text: "Download " + nameBlock,
            }
        };
        if(data.now > data.max){
            data.now = data.max;
        }
        if(data.blocoListaNow > data.blocoListaMax){
            data.blocoListaNow = data.blocoListaMax;
        }
        let json = JSON.stringify({
            code: DAO.TvCode,
            tv_name: await this.getNameTv(),
            data: data, 
            cmd: EnumTv.CALLBACK
        });
        await DAO.DB.set('DownloadPercentage', data);
        this._Socket.send(json);
    }

    async CheckTypeBlockDownload(Block){
        return new Promise( async Resolve =>{
            try {
                this._posDII = 0;
                this._filePercentageDownlaod = 0;
                await this.sendPercentageDownlaod(Block);
                if(Block.type === '1' && Block.tag != null && Block.tags != null && Block.name_Tag != null){
                    this.DownloadBlockTag(Block, ()=>{
                        Resolve(true);
                    });
                }
                else{
                    switch (Block.typeBloco) {

                        case "RSS":
                            this.DownloadBlockRss(Block,()=>{
                                Resolve(true);
                            });
                        break;

                        case "VIDEO":
                            this.DownloadBlockVideo(Block, ()=>{
                                Resolve(true);
                            });
                        break;

                        case "IMG":
                            this.DownloadBlockImg(Block,()=>{
                                Resolve(true);
                            });
                        break;

                        case "INSTAGRAM":
                            this.DownloadBlockInstagram(Block,()=>{
                                Resolve(true);
                            });
                        break;

                        default:
                            Resolve(true);
                        break

                    }
                }
            } catch (error) {
                //console.log(error);
                Resolve(true);
            }
        });
    }

    async ForDownloadItens(){
        try {
            if(this._posDI < this._itensToDownload.length){
                let Item = this._itensToDownload[this._posDI];
                this.CheckTypeBlockDownload(Item).then(()=>{
                    this._posDI++;
                    this._posDII = 0;
                    this.ForDownloadItens();
                });
            }
            else{
                await DAO.TIMELINE.set('NewDataPlayer', this._itensDownloaded);
                //await DAO.TIMELINE.set('DataPlayer', this._itensDownloaded);
                await DAO.DB.set('ReloadScreen', true);
                this._Socket.send(JSON.stringify({ code: DAO.TvCode, tv_name: await this.getNameTv(), data: {response: "download_complete", idTimeline: this._tId, date: new Date().getTime()}, cmd: EnumTv.CALLBACK }))
                this._Socket.send(JSON.stringify({code: DAO.TvCode, tv_name: await this.getNameTv(), data: { idTimeline: this._tId, type: true, version: new Date().getTime()}, cmd: EnumTv.PUBLISHED}));
                Api.Send(EnumTv.PUBLISHED, {code: DAO.TvCode, version: new Date().getTime()}).then((res)=>{
                    //console.log(res.data);
                }).catch(console.log);
                this._callback({timeline: this._tId, finished: true});
                this._dirTimeLine = undefined;
                this._dataTv = undefined;
                this.isDownloading = false;
                this._posDI = 0;
                this._posDII = 0;
                this._itensToDownload = [];
                this._itensDownloaded = [];
                this._tId = undefined;
                this._callback = undefined;
                await DAO.DB.set('DownloadPercentage', null);
            }
        } catch (error) {
            if(this._posDI >= (this._itensToDownload.length*2)){
                if(this._itensDownloaded.length > 0){
                    await DAO.TIMELINE.set('NewDataPlayer', this._itensDownloaded);
                    await DAO.TIMELINE.set('DataPlayer', this._itensDownloaded);
                }
                await DAO.DB.set('ReloadScreen', true);
                this._Socket.send(JSON.stringify({ code: DAO.TvCode, tv_name: await this.getNameTv(), data: {response: "download_complete", idTimeline: this._tId, date: new Date().getTime()}, cmd: EnumTv.CALLBACK }))
                this._callback({timeline: this._tId, finished: true});
                this._dirTimeLine = undefined;
                this._dataTv = undefined;
                this.isDownloading = false;
                this._posDI = 0;
                this._posDII = 0;
                this._itensToDownload = [];
                this._itensDownloaded = [];
                this._tId = undefined;
                this._callback = undefined;
                await DAO.DB.set('DownloadPercentage', null);
            }
            else{
                this._posDI++;
                this._posDII = 0;
                this.ForDownloadItens();
            }
        }
    }

    async StartDownload(List, callback){
        this._callback = callback;
        if(List && List[0]){
            this._dataTv = await DAO.DB.get('DataTv');
            await DAO.TMP.set('DefaultDataTimeLine', {
                id: this._dataTv.timeline,
                data: List,
                date: new Date().getTime()
            });
            this.isDownloading = true;
            this._tId = this._dataTv.timeline;
            this._itensToDownload = List;
            this._dirTimeLine = path.join(this._timelinesDir, this._tId);
            await Commun.CheckAllFolderAdr(this._dirTimeLine);
            this.SendSocketLogs({response: 'TV_LOG', msg: `Download Time Line: ${List[0].name}, para TV: ${DAO.TvCode}`, data: new Date().toLocaleString() });
            this._Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: null, tv_name: await this.getNameTv(), data: {response: "download_runing"}, cmd: EnumTv.CALLBACK }));
            this.ForDownloadItens();
        }
        else{
            this.isDownloading = false;
        }
    }
}

module.exports = TimeLineDownloader;