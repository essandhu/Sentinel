export const id = 170;
export const ids = [170];
export const modules = {

/***/ 26170:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  runRemoteCapture: () => (/* binding */ runRemoteCapture)
});

// UNUSED EXPORTS: filterRoutesBySuite

// EXTERNAL MODULE: external "node:fs/promises"
var promises_ = __webpack_require__(51455);
// EXTERNAL MODULE: ../../node_modules/.pnpm/yaml@2.8.2/node_modules/yaml/dist/index.js
var dist = __webpack_require__(59611);
// EXTERNAL MODULE: ../../packages/cli/dist/commands/login.js
var login = __webpack_require__(56068);
;// CONCATENATED MODULE: ../../packages/cli/dist/api-client.js
class SentinelClient {
    baseUrl;
    apiKey;
    constructor(config) {
        if (!config.serverUrl)
            throw new Error('serverUrl is required');
        if (!config.apiKey)
            throw new Error('apiKey is required');
        this.baseUrl = config.serverUrl.replace(/\/+$/, '');
        if (!this.baseUrl.endsWith('/api/v1')) {
            this.baseUrl += '/api/v1';
        }
        this.apiKey = config.apiKey;
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url, {
            method,
            headers: {
                'X-API-Key': this.apiKey,
                ...(body != null ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body != null ? { body: JSON.stringify(body) } : {}),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            let message = `API error ${res.status}`;
            try {
                const json = JSON.parse(text);
                if (json.error)
                    message = json.error;
            }
            catch {
                if (text)
                    message = text;
            }
            throw new Error(message);
        }
        return res.json();
    }
    async listProjects() {
        return this.request('GET', '/projects');
    }
    async ensureProject(name) {
        return this.request('POST', '/projects', { name });
    }
    async triggerCapture(params) {
        return this.request('POST', '/captures/run', params);
    }
    async getRunStatus(runId) {
        return this.request('GET', `/captures/${runId}`);
    }
    async getDiffs(runId) {
        return this.request('GET', `/captures/${runId}/diffs`);
    }
}
//# sourceMappingURL=api-client.js.map
;// CONCATENATED MODULE: ../../packages/cli/dist/commands/capture-remote.js




/**
 * Filter config routes to only those in the named suite.
 * Throws if suite not found or produces empty route list.
 * Works on plain parsed YAML objects -- no heavy dependencies.
 */
function filterRoutesBySuite(config, suiteName) {
    const suite = config.suites?.[suiteName];
    if (!suite) {
        throw new Error(`Suite "${suiteName}" is not defined in config`);
    }
    const suiteRouteSet = new Set(suite.routes);
    const filteredRoutes = config.capture.routes.filter((r) => suiteRouteSet.has(r.path));
    if (filteredRoutes.length === 0) {
        throw new Error(`Suite "${suiteName}" has no matching routes in capture.routes`);
    }
    return {
        ...config,
        capture: { ...config.capture, routes: filteredRoutes },
    };
}
// ── Remote capture (API mode) ────────────────────────────────────────────────
async function runRemoteCapture(options) {
    const creds = await (0,login.loadCredentials)();
    if (!creds) {
        throw new Error('Not authenticated. Run "sentinel login" first to use remote mode.');
    }
    const client = new SentinelClient(creds);
    // Load and parse the local config file (YAML -> plain object)
    const configRaw = await (0,promises_.readFile)(options.config, 'utf-8');
    const configObj = (0,dist/* parse */.qg)(configRaw);
    if (!configObj?.project) {
        throw new Error(`Invalid config: "project" field is required in ${options.config}`);
    }
    // If --suite is set, validate it exists locally
    if (options.suite && configObj.suites) {
        filterRoutesBySuite(configObj, options.suite);
    }
    // Ensure project exists on server
    const project = await client.ensureProject(configObj.project);
    // Trigger capture with inline config
    const { runId } = await client.triggerCapture({
        projectId: project.id,
        config: configObj,
        branchName: options.branch,
        commitSha: options.commitSha,
    });
    process.stderr.write(`Capture started (run: ${runId}). Waiting for completion...\n`);
    // Poll for completion
    const POLL_INTERVAL = 3000;
    const MAX_WAIT = 600_000;
    const start = Date.now();
    let lastStatus = '';
    while (Date.now() - start < MAX_WAIT) {
        const status = await client.getRunStatus(runId);
        if (status.status !== lastStatus) {
            process.stderr.write(`  Status: ${status.status}\n`);
            lastStatus = status.status;
        }
        if (status.status === 'completed' || status.status === 'partial') {
            break;
        }
        if (status.status === 'failed') {
            throw new Error(`Capture run failed on the server (run: ${runId})`);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
    if (Date.now() - start >= MAX_WAIT) {
        throw new Error(`Capture timed out after ${MAX_WAIT / 1000}s (run: ${runId}). Check the dashboard for results.`);
    }
    // Fetch diffs
    const diffs = await client.getDiffs(runId);
    const diffEntries = diffs.map((d) => ({
        url: d.snapshotUrl,
        viewport: d.snapshotViewport,
        pixelDiffPercent: d.pixelDiffPercent != null ? d.pixelDiffPercent / 100 : 0,
        ssimScore: d.ssimScore != null ? d.ssimScore / 10000 : null,
        passed: d.passed === 'true',
        diffS3Key: '',
    }));
    const failedCount = diffEntries.filter((d) => !d.passed).length;
    return {
        allPassed: failedCount === 0,
        failedCount,
        runId,
        diffs: diffEntries,
    };
}
//# sourceMappingURL=capture-remote.js.map

/***/ })

};

//# sourceMappingURL=170.index.js.map