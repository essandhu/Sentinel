export const id = 698;
export const ids = [698];
export const modules = {

/***/ 4698:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  pruneCommand: () => (/* binding */ pruneCommand)
});

// UNUSED EXPORTS: findOrphanedBaselines

// EXTERNAL MODULE: ../../node_modules/.pnpm/chalk@5.6.2/node_modules/chalk/source/index.js + 4 modules
var source = __webpack_require__(45737);
// EXTERNAL MODULE: ../../packages/cli/dist/local-runtime.js
var local_runtime = __webpack_require__(61224);
;// CONCATENATED MODULE: ../../packages/cli/dist/commands/prune-logic.js
const findOrphanedBaselines = (configRoutes, baselines) => {
    const routeSet = new Set(configRoutes);
    return baselines.filter(b => !routeSet.has(b.url));
};
//# sourceMappingURL=prune-logic.js.map
;// CONCATENATED MODULE: ../../packages/cli/dist/commands/prune.js




const pruneCommand = async (options) => {
    const { loadConfig } = await Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 29863));
    const config = await loadConfig(options.config ?? 'sentinel.config.yml');
    const runtime = await (0,local_runtime.initLocalRuntime)(process.cwd());
    try {
        const projectName = config.project ?? 'default';
        const project = await runtime.db.query.projects.findFirst({
            where: (projects, { eq }) => eq(projects.name, projectName),
        });
        if (!project) {
            console.log(source["default"].yellow('No project found.'));
            return;
        }
        const client = runtime.db.$client;
        const storedBaselines = client.prepare('SELECT id, url, s3_key AS s3Key, viewport, browser FROM baselines WHERE project_id = ?').all(project.id);
        const configRoutes = config.capture.routes.map((r) => r.path);
        const orphans = findOrphanedBaselines(configRoutes, storedBaselines);
        if (orphans.length === 0) {
            console.log(source["default"].green('No orphaned baselines found.'));
            return;
        }
        console.log(source["default"].bold(`Found ${orphans.length} orphaned baseline(s):\n`));
        for (const orphan of orphans) {
            console.log(source["default"].dim(`  ${orphan.url} @ ${orphan.viewport} [${orphan.browser}]`));
        }
        if (!options.confirm) {
            console.log(source["default"].yellow('\nDry run — no files deleted. Use --confirm to delete.'));
            return;
        }
        for (const orphan of orphans) {
            try {
                await runtime.storage.delete(orphan.s3Key);
            }
            catch { /* Storage file may already be gone */ }
            client.prepare('DELETE FROM baselines WHERE id = ?').run(orphan.id);
        }
        console.log(source["default"].green(`\nDeleted ${orphans.length} orphaned baseline(s).`));
    }
    finally {
        runtime.close();
    }
};
//# sourceMappingURL=prune.js.map

/***/ })

};

//# sourceMappingURL=698.index.js.map