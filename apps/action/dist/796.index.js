export const id = 796;
export const ids = [796];
export const modules = {

/***/ 84796:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ensureBrowserInstalled: () => (/* binding */ ensureBrowserInstalled)
/* harmony export */ });
/* harmony import */ var chalk__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(45737);
/* harmony import */ var node_child_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(31421);


async function ensureBrowserInstalled(browsers = ['chromium']) {
    const isCi = process.env.CI === 'true' || process.argv.includes('--ci');
    for (const browser of browsers) {
        if (isBrowserInstalled(browser))
            continue;
        if (!isCi) {
            // Dynamic import to keep non-capture commands fast
            const { confirm } = await __webpack_require__.e(/* import() */ 30).then(__webpack_require__.bind(__webpack_require__, 4030));
            const proceed = await confirm({
                message: `${browser} browser not found. Sentinel needs to download it (~130MB) to take screenshots.\nDownload now?`,
                default: true,
            });
            if (!proceed) {
                console.error(chalk__WEBPACK_IMPORTED_MODULE_1__["default"].red('Cannot run captures without a browser. Exiting.'));
                process.exit(1);
            }
        }
        else {
            console.log(chalk__WEBPACK_IMPORTED_MODULE_1__["default"].blue(`Installing ${browser} browser for CI...`));
        }
        console.log(chalk__WEBPACK_IMPORTED_MODULE_1__["default"].dim(`Downloading ${browser}...`));
        try {
            (0,node_child_process__WEBPACK_IMPORTED_MODULE_0__.execSync)(`npx playwright install ${browser}`, { stdio: 'inherit' });
            console.log(chalk__WEBPACK_IMPORTED_MODULE_1__["default"].green(`${browser} installed successfully.`));
        }
        catch (err) {
            console.error(chalk__WEBPACK_IMPORTED_MODULE_1__["default"].red(`Failed to install ${browser}. Please run: npx playwright install ${browser}`));
            process.exit(1);
        }
    }
}
function isBrowserInstalled(browser) {
    try {
        // Check if playwright can find the browser
        const output = (0,node_child_process__WEBPACK_IMPORTED_MODULE_0__.execSync)(`npx playwright install --dry-run 2>&1`, {
            stdio: 'pipe',
            timeout: 10000,
        }).toString();
        // If the browser is already installed, dry-run won't list it as needing installation
        return !output.includes(browser);
    }
    catch {
        // If playwright isn't installed at all, browsers definitely aren't
        return false;
    }
}
//# sourceMappingURL=browser-install.js.map

/***/ })

};

//# sourceMappingURL=796.index.js.map