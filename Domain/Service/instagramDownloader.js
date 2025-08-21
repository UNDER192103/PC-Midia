
const { app } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Api = require(path.join(app.getAppPath(), "Repository", "api.js"));
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const EnumTv = require(path.join(app.getAppPath(), "Domain", "Models", "EnumTv.js"));
const Commun = require(path.join(app.getAppPath(), "Domain", "Commun", "commun.js"));
const InstagramBlockModel = require(path.join(app.getAppPath(), "Domain", "Models", "InstagramBlock.js"));
const fs = require('fs');
const { Callback } = require('puppeteer');


class InstagramDownloader {
    _postsDir = path.join(app.getPath('userData'), 'Data', 'Storage', 'Posts-Instagram');
    _callback;
    _Socket;
    _dataTv;
    isDownloading = false;
    _filePercentageDownlaod = 0;
    _posDI = 0;
    _posDII = 0;
    _dataBlock;
    _blockInfo;

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

    async InstaloaderExecute(Command, Callback){
        try {
            let dirExeInstaloader = path.join(app.getAppPath(), 'Domain', 'Src', 'scritps', 'instaloader');
            var idTimeOut = null, is_instaloader_runing = true;
            exec(`cd ${dirExeInstaloader} && ${Command}`, (err, stdout, stderr) => {
                is_instaloader_runing = false;
                if(idTimeOut != null){ clearTimeout(idTimeOut); };
                if(!err){
                    if(stderr.includes(`does not exist.`) == false && stdout.includes(`does not exist.`) == false && stdout.includes(`Invalid username`) == false && stderr.includes(`Invalid username`) == false){
                        Callback(true, null, stderr, stdout);
                    }
                    else{
                        Callback(null, null, stderr, stdout);
                    }
                }
                else{
                    Callback(null, err, stderr, stdout);
                }
            });
            idTimeOut = setTimeout(async ()=>{
                if(is_instaloader_runing == true){
                    exec(`taskkill /pid instaloader.exe /f`, (err, stdout, stderr) => {});
                }
            }, 15000);
        } catch (error) {
            Callback(null, error, null, null);
        }
    }

    async ProcessarPostsInstaloader(UserName, Callback){
        try {
            let path_posts = path.join(this._postsDir, UserName);
            if(fs.existsSync(path_posts)){
                this.SendSocketLogs({response: 'TV_LOG', msg: `Processando Posts encontrados do usuário: ${UserName}.`, data: new Date().toLocaleString()});
                var DataInstagram = {user_id: null, user_info: null, user_posts: new Array() };
                Commun.ReadFile(path.join(path_posts, 'id'), (IdUserInstagram) => {
                    if(IdUserInstagram){
                        DataInstagram.user_id = parseInt(IdUserInstagram.replaceAll(" "));
                        Commun.DeleteDir(path.join(path_posts, 'id'));
                        Commun.ReadFile(path.join(path_posts, `${UserName}_${DataInstagram.user_id}.json`), async (InfoUserInstagramJson)=>{
                            if(InfoUserInstagramJson != null){
                                Commun.DeleteDir(path.join(path_posts, `${UserName}_${DataInstagram.user_id}.json`));
                                DataInstagram.user_info = JSON.parse(InfoUserInstagramJson);
                                Commun.ReadDir(path_posts, async (ListFiles, error) => {
                                    if(ListFiles.length > 0){
                                        ListFiles.reverse();
                                        for (let index = 0; index < ListFiles.length; index++) {
                                            const file_name = ListFiles[index];
                                            let data = await fs.readFileSync(path.join(path_posts, file_name));
                                            try {
                                                let dt = JSON.parse(await data.toString());
                                                try {
                                                    dt['data_post'] = data = `${file_name.split("_UTC.json")[0].split('_')[0].replaceAll("-", '/')} ${file_name.split("_UTC.json")[0].split('_')[1].replaceAll("-", ':')}`;   
                                                } catch (error) {
                                                    dt['data_post'] = undefined;
                                                }
                                                DataInstagram.user_posts.push(dt);
                                                await Commun.DeleteDir(path.join(path_posts, file_name));
                                            } catch (error) { };
                                        }
                                        await Commun.DeleteDir(path_posts);
                                        Callback(DataInstagram);
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
        } catch (error) {
            console.log(error);
            Callback(null);
        }
    }

    async DownloadPostsByUsername(UserName, TokenConectionId, Callback){
        try {
            this._dataTv = await DAO.DB.get('DataTv');
            if(TokenConectionId) this._Socket.send(JSON.stringify({ code: DAO.TvCode, token_conection: TokenConectionId, tv_name: await this.getNameTv(), data: {response: "GET_PREVIW_INSTAGRAM_START", token_conection_id: TokenConectionId}, cmd: EnumTv.CALLBACK }));
            this.SendSocketLogs({response: 'TV_LOG', msg: `Download de Posts do instagram para o usuário: ${UserName} Iniciado.`, data: new Date().toLocaleString()});
            let instaloader_command = `instaloader --no-profile -pic--no-posts --no-pictures --no-videos --no-captions --no-compress-json --dirname-pattern="${this._postsDir}\\{profile}" ${UserName}`;
            let path_posts = path.join(this._postsDir, UserName);
            this.InstaloaderExecute(instaloader_command, (res, err, stderr, stdout)=>{
                if(res != true && stderr != null){
                    this.SendSocketLogs({response: 'TV_LOG', msg: `Log Erro instaloader: ${stderr}`, data: new Date().toLocaleString()});
                }
                if(res == true || fs.existsSync(path_posts)){
                    if(fs.existsSync(path_posts)){
                        this.ProcessarPostsInstaloader(UserName, (dataPosts)=>{
                            Commun.FormatDataInstaloader(dataPosts, (posts)=>{
                              Callback(posts);
                            });
                        });
                    }
                    else{
                        Callback(null, null, null, null);
                    }
                }
                else{
                    Callback(null, err, stderr, stdout);
                }
            });
        } catch (error) {
            Callback(null, error);
        }
    }

    async ClearData(){
        this.isDownloading = false;
    }

    async DownloadPostsByBlock(dto, callback){
        this._dataTv = await DAO.DB.get('DataTv');
        this._callback = callback;
        try {
            let dataBlock = JSON.parse(dto.data.json);
            let blockInfo = JSON.parse(dataBlock.json);
            if(dataBlock && dataBlock.bloco){
                this.isDownloading = true;
                this.SendSocketLogs({response: 'TV_LOG', msg: `Download Posts Instagram, ID Bloco: ${dataBlock.bloco}, User Instagram: ${blockInfo.userNameInsta}`, data: new Date().toLocaleString() });
                this.DownloadPostsByUsername(blockInfo.userNameInsta, null, (Posts) => {
                    try {
                        if(Posts != null && Posts.length > 0){
                            if(Posts.length < blockInfo.postsInsta){
                                blockInfo.postsInsta = Posts.length;
                                //console.log("Menos Posts Que precisa");
                            }
                            let list_posts = [];
                            for (let index = 0; index < blockInfo.postsInsta; index++) {
                                const Post = Posts[index];
                                let blockModel = new InstagramBlockModel();
                                blockInfo.legenda = Post.legenda;
                                blockModel.user_id = dataBlock.user_id;
                                blockModel.json = JSON.stringify(blockInfo);
                                blockModel.data_post = null;
                                blockModel.id_post = null;
                                blockModel.url = Post.url_thumbnail;
                                blockModel.video_url = Post.url_video;
                                blockModel.profile_pic_url_hd = Post.profile_pic_url;
                                blockModel.postsInsta = dataBlock.postsInsta;
                                blockModel.bloco = dataBlock.bloco;
                                blockModel.legenda = Post.legenda;
                                list_posts.push(blockModel);
                            }
                            this.ClearData();
                            this._callback(JSON.stringify(list_posts), blockInfo.userNameInsta, dataBlock.bloco);
                        }
                        else{
                            this.ClearData();
                            this._callback(null, null, null);
                        }
                    } catch (error) {
                        this.ClearData();
                        this._callback(null, null, null);
                    }
                });
                
            }
            else{
                this.ClearData();
                this._callback(null, null, null);
            }
        } catch (error) {
            this.ClearData();
            this._callback(null, null, null);
        }
    }
}

module.exports = InstagramDownloader;