const { ipcRenderer } = require("electron");
const BACKEND = {
  Send: async (type, data) => {
    return ipcRenderer.invoke(type, data);
  }
}