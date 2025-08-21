const path = require('path');
const packageJson = require('../package.json');
const Jsoning = require("jsoning");
var macaddress = require('macaddress');

class DBCLASS {
    Package = require('../package.json');
    Config = require('../config.json');
    TvCode;
    DB_DIR = path.join(process.env.APPDATA, packageJson.productName, 'Data');
    DB_FILE = path.join(process.env.APPDATA, packageJson.productName, 'Data', 'DB', 'DB.json');
    TIMELINE_FILE = path.join(process.env.APPDATA, packageJson.productName, 'Data', 'DB', 'TIMELINE.json');
    TMP_FILE = path.join(process.env.APPDATA, packageJson.productName, 'Data', 'DB', 'TMP.json');
    DB = new Jsoning(this.DB_FILE);
    TIMELINE = new Jsoning(this.TIMELINE_FILE);
    TMP = new Jsoning(this.TMP_FILE);
    DIR_APP_APPDATA = path.join(process.env.APPDATA, packageJson.productName);
    LOGGER = new LOGGER();

    constructor() {
        if(this.DB.get('TvCode') != null)
            this.TvCode = this.DB.get('TvCode');
        macaddress.one().then(async (mac) => {
            let macSplit = mac.split(':');
            this.TvCode = `TV-${macSplit[macSplit.length-1]}${macSplit[macSplit.length-2]}${macSplit[macSplit.length-3]}`.toLocaleUpperCase();
            if(await this.DB.get('TvCode') != this.TvCode)
            this.DB.set('TvCode', this.TvCode);
        });
        this.GetData();
    }

    async GetTvCode(){
        return new Promise(resolve => {
            let interval = setInterval(async () => {
                if(this.TvCode) {
                    clearInterval(interval);
                    resolve(this.TvCode);
                }
            }, 500);
        })
    }

    async GetDataNow() {
        this.DB = new Jsoning(this.DB_FILE);
        return this;
    }

    async GetData() {
        return this;
    }

    async ClearCertainData(){
        await this.DB.set('DownloadUpdateApp', null);
        await this.DB.set('DownloadPercentage', null);

        let dataPlayer = await this.DB.get('DataPlayer');
        if(!await this.TIMELINE.get('DataPlayer') && dataPlayer != null) {
            await this.TIMELINE.set('DataPlayer', dataPlayer);
            await this.DB.set('DataPlayer', null);
        }
    }
}

class LOGGER {
    LOGS_FILE = path.join(process.env.APPDATA, packageJson.productName, 'Data', 'DB', `LOGS.json`);
    DB = new Jsoning(this.LOGS_FILE);

    constructor() {
        this.DB = new Jsoning(this.LOGS_FILE);
    }

    async List(type = 'all'){
        if(!type) type = 'all';
        return await this.DB.get(type);
    }

    async Add(type = 'all', data){
        if(!type) type = 'all';
        let list = await this.DB.get(type);
        if(!list) list = [];
        list.push(data);
        //console.log(data);
        return await this.DB.set(type, list);
    }

    async Clear(type = 'all'){
        if(!type) type = 'all';
        return await this.DB.remove(type);
    }
}

module.exports = new DBCLASS();