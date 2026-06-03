const { resolve } = require("node:path");

module.exports = {
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                productList: resolve(__dirname, "html/product-list.html"),
                login: resolve(__dirname, "html/prihlasenie.html"),
                registration: resolve(__dirname, "html/registracia.html"),
                savedProducts: resolve(__dirname, "html/moje_ulozene_produkty.html"),
            },
        },
    },
};