(function () {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    const isLanIp =
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

    const defaultProdApi = "https://ai-checker-1.onrender.com";
    const configuredProdApi = window.__API_BASE_OVERRIDE__ || defaultProdApi;
    const isPlaceholderApi = /YOUR_RENDER_BACKEND_URL/i.test(configuredProdApi);

    window.APP_CONFIG = {
        API_BASE: (isLocalHost || isLanIp) ? `http://${host}:8000` : configuredProdApi,
        IS_API_PLACEHOLDER: !(isLocalHost || isLanIp) && isPlaceholderApi,
    };
})();
