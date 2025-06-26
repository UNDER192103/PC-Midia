const { app } = require('electron');
const path = require('path');
const fs = require("fs");
const os = require('os');

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

///Start With Windows
function readFile(dir, callback){
    fs.readFile(dir, (err, data) => {
      if (err){
        callback(null);
      }else{
        callback(data.toString());
      }
    });
}
readFile(`${process.env.USERPROFILE}\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\PC-Midia-2.0.bat`, async (data)=>{
    if(data != `"${process.argv0}"`){
        fs.writeFile(`${process.env.USERPROFILE}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\PC-Midia-2.0.bat`, `"${process.argv0}"`, 'utf-8', function (err) {
            if (err) throw err;
        });
    }
});
///Start With Windows

app.whenReady().then(() => {
    check_folders_data_UN(() => {
        check_folders_data_DB(list_dirs, () => {
            require(path.join(app.getAppPath(), "App", "app.js"));
        });
    });
});