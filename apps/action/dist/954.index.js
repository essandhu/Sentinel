export const id = 954;
export const ids = [954];
export const modules = {

/***/ 39954:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   watchCommand: () => (/* binding */ watchCommand)
/* harmony export */ });
/* unused harmony export createDebouncedCallback */
/* harmony import */ var chalk__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(45737);
/* harmony import */ var node_fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(73024);
/* harmony import */ var node_path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(76760);



const createDebouncedCallback = (callback, delayMs) => {
    let timer = null;
    const debounced = (() => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(async () => {
            timer = null;
            await callback();
        }, delayMs);
    });
    debounced.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    return debounced;
};
const watchCommand = async (options) => {
    const { loadConfig } = await Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 29863));
    const config = await loadConfig(options.config ?? 'sentinel.config.yml');
    const watchConfig = config.watch;
    if (!watchConfig) {
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].yellow('No watch.paths configured in sentinel.config.yml.'));
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim('Add a watch block:\n  watch:\n    paths: ["src/**"]'));
        return;
    }
    try {
        const response = await fetch(config.baseUrl, { signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
    }
    catch {
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].red(`Cannot reach ${config.baseUrl}. Start your dev server first.`));
        return;
    }
    console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].blue.bold('Sentinel Watch Mode'));
    console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim(`Watching: ${watchConfig.paths.join(', ')}`));
    console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim(`Debounce: ${watchConfig.debounceMs ?? 500}ms`));
    console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim(`Base URL: ${config.baseUrl}`));
    console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim('Press Ctrl+C to stop.\n'));
    let runCount = 0;
    const runCapture = async () => {
        runCount++;
        if (watchConfig.clearScreen !== false)
            process.stdout.write('\x1Bc');
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].blue(`[Run #${runCount}] Capturing...`));
        try {
            const { captureCommand } = await Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 90055));
            await captureCommand({ config: options.config ?? 'sentinel.config.yml', ci: false });
        }
        catch (err) {
            console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].red(`Capture failed: ${err instanceof Error ? err.message : err}`));
        }
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim('\nWaiting for changes...'));
    };
    const debounced = createDebouncedCallback(runCapture, watchConfig.debounceMs ?? 500);
    const watchers = [];
    const cwd = process.cwd();
    for (const pattern of watchConfig.paths) {
        const baseDir = (0,node_path__WEBPACK_IMPORTED_MODULE_1__.resolve)(cwd, pattern.replace(/[*?{[].*$/, '').replace(/\/$/, '') || '.');
        try {
            const watcher = (0,node_fs__WEBPACK_IMPORTED_MODULE_0__.watch)(baseDir, { recursive: true }, () => debounced());
            watchers.push(watcher);
        }
        catch (err) {
            console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].yellow(`Warning: cannot watch ${baseDir}: ${err instanceof Error ? err.message : err}`));
        }
    }
    if (watchers.length === 0) {
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].red('No valid watch paths found.'));
        return;
    }
    await runCapture();
    console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim('\nWaiting for changes...'));
    const cleanup = () => {
        debounced.cancel();
        for (const w of watchers)
            w.close();
        console.log(chalk__WEBPACK_IMPORTED_MODULE_2__["default"].dim('\nWatch stopped.'));
        process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    await new Promise(() => { });
};
//# sourceMappingURL=watch.js.map

/***/ })

};

//# sourceMappingURL=954.index.js.map