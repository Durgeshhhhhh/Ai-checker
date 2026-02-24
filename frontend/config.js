(function () {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    const isLanIp =
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);

    const defaultProdApi = "http://13.53.197.35:8000";

    window.APP_CONFIG = {
        API_BASE: (isLocalHost || isLanIp)
            ? `http://${host}:8000`
            : defaultProdApi,
    };
})();
