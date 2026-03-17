export const id = 402;
export const ids = [402];
export const modules = {

/***/ 37402:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   appendApproval: () => (/* binding */ appendApproval)
/* harmony export */ });
/* unused harmony export readApprovalFile */
/* harmony import */ var node_fs_promises__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(51455);
/* harmony import */ var node_path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(76760);


const FILENAME = 'approvals.json';
const readApprovalFile = async (sentinelDir) => {
    try {
        const raw = await (0,node_fs_promises__WEBPACK_IMPORTED_MODULE_0__.readFile)((0,node_path__WEBPACK_IMPORTED_MODULE_1__.join)(sentinelDir, FILENAME), 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const appendApproval = async (sentinelDir, entry) => {
    const existing = await readApprovalFile(sentinelDir);
    existing.push(entry);
    await (0,node_fs_promises__WEBPACK_IMPORTED_MODULE_0__.writeFile)((0,node_path__WEBPACK_IMPORTED_MODULE_1__.join)(sentinelDir, FILENAME), JSON.stringify(existing, null, 2) + '\n', 'utf-8');
};
//# sourceMappingURL=approval-file.js.map

/***/ })

};

//# sourceMappingURL=402.index.js.map