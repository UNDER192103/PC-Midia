const axios = require('axios');
const config = require('../config.json');


const API_CLIENT = axios.create({
    baseURL: config.URL_API,
    timeout: 100000,
    headers: { }
});

module.exports = {
    Send: async (method, params = {}) => {
        var formData = new FormData();
        formData.append('method', method);
        formData.append('key', config.API_KEY);
        Object.keys(params).forEach(key => { formData.append(key, params[key]) });
        return await API_CLIENT.post("", formData);
    }
}