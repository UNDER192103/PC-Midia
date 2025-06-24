const { app, Menu, BrowserWindow, ipcMain, shell, Tray } = require('electron');
const path = require('path');
const QRCode = require('qrcode');
const { exec } = require('child_process');
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const Commun = require(path.join(app.getAppPath(), "Domain", "Commun", "commun.js"));
const WebSocketService = require(path.join(app.getAppPath(), "Domain", "Service", "websocketClient.js"));
const { autoUpdater, AppUpdater } = require("electron-updater");
var window = null, QrCodeLinkTv = null, appIcon = null;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendDataToFront(type, message) {
    window.webContents.send(type, message);
}

function handleMessages(type, callback) {
    ipcMain.handle(type, callback);
}

function GetQrCodeLinkTv(){
  return new Promise((resolve)=>{
    if(!QrCodeLinkTv){
      QRCode.toDataURL(`${DAO.Config.URL_SITE}/?ng=dashboard/mobile/${DAO.TvCode}`, function (err, url) {
        QrCodeLinkTv = url;
        resolve(QrCodeLinkTv);
      });
    }
    else
      resolve(QrCodeLinkTv);
  })
}

async function createWindow () {
  setTimeout(()=>{
    DAO.ClearCertainData();
  }, 1000);
  window = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(app.getAppPath(), "Domain", "Src", "img", "icon.ico"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true,
    },
    fullscreenable: true,
    autoHideMenuBar: true,
  });
  window.fullScreen = true;
  window.maximize();
  loadScreenApp();
  WebSocketService.StartSocket();

  appIcon = new Tray(path.join(app.getAppPath(), "Domain", "Src", "img", "icon.ico"));
  appIcon.setToolTip(app.getName());
  appIcon.setContextMenu(
    Menu.buildFromTemplate([
        {
          icon: path.join(app.getAppPath(), "Domain", "Src", "img", "icon", "icon x16.png"), label: app.getName(), type: 'normal', click: () => { }
        },
        {
          label: `Versão Atual: ${app.getVersion()}`, type: 'normal', click: () => { }
        },
        { type: 'separator' },
        {
          label: "Abrir Local Da Time Line", type: 'normal', click: () => {
           shell.openPath(path.join(DAO.DB_DIR, 'Storage', 'Timelines'));
          }
        },
        { type: 'separator' },
        {
          label: "Reiniciar Aplicativo", type: 'normal', click: () => {
            app.relaunch();
            app.exit();
            process.exit();
          }
        },
        {
          label: "Atualizar Tela", type: 'normal', click: () => {
            window.show();
            window.maximize();
            window.reload();
          }
        },
        {
          label: "Sair", type: 'normal', click: async () => {
            app.exit();
            process.exit();
          }
        }
      ])
    );
}

Commun.CheckChromiumDependency(async (data)=>{
  sendDataToFront("DataLinkTv", {
    qrCodeUrl: await GetQrCodeLinkTv(),
    tvCode: DAO.TvCode,
    version: DAO.Package.version,
    StatusChromiumDependency: data && data.percentage ? data.percentage : DAO.DB.get('StatusChromiumDependency')
  });
});

handleMessages('GetDataLinkTv', async (event, data)=>{
  sendDataToFront("DataLinkTv", {
    qrCodeUrl: await GetQrCodeLinkTv(),
    tvCode: DAO.TvCode,
    version: DAO.Package.version,
    StatusChromiumDependency: DAO.DB.get('StatusChromiumDependency')
  });
});

handleMessages('SaveNowBlockReproduct', async (event, data)=>{

});

handleMessages('CreateLogRepoducaoTv', async (event, data)=>{

});

handleMessages('GetDataPlayer', async (event, data)=>{
  return new Promise( async resolve => {
    let dt = null;
    let dtNew = await DAO.DB.get('NewDataPlayer');
    if(dtNew == null || dtNew == "null" || dtNew == ""){
        dt = await DAO.DB.get('DataPlayer');
    }else{
        dt = dtNew;
        await DAO.DB.set('DataPlayer', dtNew);
        await DAO.DB.set('NewDataPlayer', null);
    }
    if(dt == "" || dt == null || dt == "null")
        dt = "no_data";
    resolve(dt);
  });
});

handleMessages('GetUpdate', async (event, data)=>{
    return new Promise( async (resolve) => {
      let stateScreen = DAO.DB.get('ReloadScreen');
      let playerState = DAO.DB.get('PlayerState');
      let update = DAO.DB.get('UpdateDataPlayer');
      let conectionServer = DAO.DB.get('IsConnected');
      let ststusDependencia = DAO.DB.get('StatusChromiumDependency');
      let dataUpdateTag = DAO.DB.get('DataPlayerUpdateTag');

      if(conectionServer != true){
          DAO.DB.set('PlayerState', 'true');
          playerState = "PLAY";
      }

      let data = {
          playerState: playerState,
          stateScreen: stateScreen,
          tvCode: DAO.TvCode,
          date: DAO.DB.get('DataDownload_timeline'),
          porcentagemDOwnlaod: DAO.DB.get('DownloadPercentage'),
          update: update,
          randomReproduction: DAO.DB.get('RandomReproduction'),
          infoTv: DAO.DB.get('infoTv'),
          ststusDependencia: ststusDependencia,
          version: DAO.Package.version,
          dataUpdateTag: dataUpdateTag,
      }
      if(stateScreen === true)
          await DAO.DB.set('ReloadScreen', false);
      if(update === true){
          DAO.DB.set('UpdateDataPlayer', false);
          DAO.DB.set('DataPlayerUpdateTag', false);
      }
      resolve(data);
    });
});

WebSocketService.Receiver(async (data)=>{
  switch(data.code){

    case "update_screen":
      loadScreenApp(true);
    break;

    case "reload_screen":
      window.reload();
    break;

    case "reload_app":
      app.relaunch();
      app.exit();
    break;

    case "data_tv":
      loadScreenApp(true);
    break;

    default:
      console.log(data);
    break;
  }
});

async function loadScreenApp(noLoadIsLoaded = false){
  let screenNow = DAO.DB.get('ScreenNow');
  let dataTv = DAO.DB.get('DataTv');
  if(DAO.DB.get('IsLinkedTv') === true && dataTv){
    if(dataTv.situacao === "INATIVO")
      setScreen = path.join(app.getAppPath(), "Domain", "Views", "inativeTv.html");
    else
      setScreen = path.join(app.getAppPath(), "Domain", "Views", "player.html");
  }
  else{
    setScreen = path.join(app.getAppPath(), "Domain", "Views", "linkTv.html");
  }
  if(screenNow != setScreen || noLoadIsLoaded == false){
    await DAO.DB.set('ScreenNow', setScreen);
    window.loadFile(setScreen);
  }
}

autoUpdater.on("update-available", (info) => {
  autoUpdater.downloadUpdate();
});

autoUpdater.on('download-progress', (info) => {
  console.log(info);
});

autoUpdater.on("update-downloaded", (event, releaseNotes, releaseName) => {
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
    window.close();
    app.quit();
    process.exit();
  }, 5000);
});

autoUpdater.on("update-not-available", (info) => {
  console.log(info);
});

autoUpdater.on("error", async info => {
  console.log(info);
});


app.whenReady().then(async () => {
  autoUpdater.checkForUpdates();
  Commun.checkTimeLineFilesToDelete();
  Commun.DeleteOldTimeLine();
  Commun.DeleteAllFilesInstagram();


  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/*
if(DAO.DB.get('setWarningProcessOff') != true ){
    let command = `C:\\Windows\\System32\\cmd.exe /k %windir%\\System32\\reg.exe ADD HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System /v EnableLUA /t REG_DWORD /d 0 /f`;
    var removeWarninProcess = exec(command, (err, stdout, stderr) => { });
    setTimeout(()=>{
        DAO.DB.set('setWarningProcessOff', true);
        process.kill(removeWarninProcess.pid);
    }, 5000);
};*/
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});