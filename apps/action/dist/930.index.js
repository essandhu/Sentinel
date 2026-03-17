export const id = 930;
export const ids = [930];
export const modules = {

/***/ 75930:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   resolveUserIdentity: () => (/* binding */ resolveUserIdentity)
/* harmony export */ });
/* harmony import */ var node_child_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(31421);
/* harmony import */ var node_util__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(57975);


const execFileAsync = (0,node_util__WEBPACK_IMPORTED_MODULE_1__.promisify)(node_child_process__WEBPACK_IMPORTED_MODULE_0__.execFile);
const gitConfig = async (key, cwd) => {
    try {
        const { stdout } = await execFileAsync('git', ['config', '--get', key], {
            cwd: cwd ?? process.cwd(),
            timeout: 3000,
        });
        return stdout.trim() || null;
    }
    catch {
        return null;
    }
};
const resolveUserIdentity = async (cwd) => {
    const name = process.env.SENTINEL_USER ?? await gitConfig('user.name', cwd) ?? 'local';
    const email = process.env.SENTINEL_EMAIL ?? await gitConfig('user.email', cwd) ?? 'local';
    return { name, email };
};
//# sourceMappingURL=user-identity.js.map

/***/ })

};

//# sourceMappingURL=930.index.js.map