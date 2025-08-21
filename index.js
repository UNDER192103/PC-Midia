const { app } = require('electron');
const path = require('path');
const fs = require("fs");

let paths_appdata = [
    path.join(app.getPath('userData'), 'Data'),
    path.join(app.getPath('userData'), 'Data', 'DB'),
    path.join(app.getPath('userData'), 'Data', 'Storage'),
    path.join(app.getPath('userData'), 'Data', 'Storage', 'Timelines'),
    path.join(app.getPath('userData'), 'Data', 'Storage', 'Posts-Instagram'),
];

const check_folders_data_UN = async (callback) => {
    for (let index = 0; index < paths_appdata.length; index++) {
        if (!await fs.existsSync(paths_appdata[index])) {
            await fs.mkdirSync(paths_appdata[index]);
        }
    }
    callback();
}

const check_folders_data_DB = async (list, callback, count = 0) => {
    if (list[count] != null) {
        if (!await fs.existsSync(list[count])) {
            fs.writeFile(list[count], "{}", function (err) {
                if (err) {
                    //console.log(err);
                }

                return check_folders_data_DB(list, callback, count + 1);
            });
        }
        else {
            check_folders_data_DB(list, callback, count + 1)
        }
    }
    else {
        callback();
    }
}

var list_dirs = [
    path.join(app.getPath('userData'), 'Data', 'DB', 'DB.json'),
    path.join(app.getPath('userData'), 'Data', 'DB', 'TIMELINE.json'),
    path.join(app.getPath('userData'), 'Data', 'DB', 'TMP.json'),
    path.join(app.getPath('userData'), 'Data', 'DB', 'LOGS.json'),
];

try { fs.unlinkSync(path.join(process.env.USERPROFILE, "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "PC-Midia-2.0.bat")); } catch (error) { }

app.whenReady().then(() => {
    const isRunning = app.requestSingleInstanceLock()
    if (isRunning) {
        check_folders_data_UN(() => {
            check_folders_data_DB(list_dirs, () => {
                require(path.join(app.getAppPath(), "App", "app.js"));
            });
        });
    }
    else {
        app.quit();
        process.exit();
    }
});