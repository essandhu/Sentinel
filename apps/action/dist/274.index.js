export const id = 274;
export const ids = [274];
export const modules = {

/***/ 6274:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  localRouter: () => (/* binding */ localRouter)
});

// EXTERNAL MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/getErrorShape-vC8mUXJD.mjs
var getErrorShape_vC8mUXJD = __webpack_require__(6700);
// EXTERNAL MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/codes-DagpWZLc.mjs
var codes_DagpWZLc = __webpack_require__(14256);
// EXTERNAL MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/tracked-Bjtgv3wJ.mjs
var tracked_Bjtgv3wJ = __webpack_require__(52485);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/initTRPC-RoZMIBeA.mjs




//#region src/unstable-core-do-not-import/middleware.ts
var import_objectSpread2$2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
/** @internal */
const middlewareMarker = "middlewareMarker";
/**
* @internal
*/
function createMiddlewareFactory() {
	function createMiddlewareInner(middlewares) {
		return {
			_middlewares: middlewares,
			unstable_pipe(middlewareBuilderOrFn) {
				const pipedMiddleware = "_middlewares" in middlewareBuilderOrFn ? middlewareBuilderOrFn._middlewares : [middlewareBuilderOrFn];
				return createMiddlewareInner([...middlewares, ...pipedMiddleware]);
			}
		};
	}
	function createMiddleware(fn) {
		return createMiddlewareInner([fn]);
	}
	return createMiddleware;
}
/**
* Create a standalone middleware
* @see https://trpc.io/docs/v11/server/middlewares#experimental-standalone-middlewares
* @deprecated use `.concat()` instead
*/
const experimental_standaloneMiddleware = () => ({ create: createMiddlewareFactory() });
/**
* @internal
* Please note, `trpc-openapi` uses this function.
*/
function createInputMiddleware(parse) {
	const inputMiddleware = async function inputValidatorMiddleware(opts) {
		let parsedInput;
		const rawInput = await opts.getRawInput();
		try {
			parsedInput = await parse(rawInput);
		} catch (cause) {
			throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
				code: "BAD_REQUEST",
				cause
			});
		}
		const combinedInput = (0,codes_DagpWZLc/* isObject */.Gv)(opts.input) && (0,codes_DagpWZLc/* isObject */.Gv)(parsedInput) ? (0, import_objectSpread2$2.default)((0, import_objectSpread2$2.default)({}, opts.input), parsedInput) : parsedInput;
		return opts.next({ input: combinedInput });
	};
	inputMiddleware._type = "input";
	return inputMiddleware;
}
/**
* @internal
*/
function createOutputMiddleware(parse) {
	const outputMiddleware = async function outputValidatorMiddleware({ next }) {
		const result = await next();
		if (!result.ok) return result;
		try {
			const data = await parse(result.data);
			return (0, import_objectSpread2$2.default)((0, import_objectSpread2$2.default)({}, result), {}, { data });
		} catch (cause) {
			throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
				message: "Output validation failed",
				code: "INTERNAL_SERVER_ERROR",
				cause
			});
		}
	};
	outputMiddleware._type = "output";
	return outputMiddleware;
}

//#endregion
//#region src/vendor/standard-schema-v1/error.ts
var import_defineProperty = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_defineProperty */.Vh)(), 1);
/** A schema error with useful information. */
var StandardSchemaV1Error = class extends Error {
	/**
	* Creates a schema error with useful information.
	*
	* @param issues The schema issues.
	*/
	constructor(issues) {
		var _issues$;
		super((_issues$ = issues[0]) === null || _issues$ === void 0 ? void 0 : _issues$.message);
		(0, import_defineProperty.default)(this, "issues", void 0);
		this.name = "SchemaError";
		this.issues = issues;
	}
};

//#endregion
//#region src/unstable-core-do-not-import/parser.ts
function getParseFn(procedureParser) {
	const parser = procedureParser;
	const isStandardSchema = "~standard" in parser;
	if (typeof parser === "function" && typeof parser.assert === "function") return parser.assert.bind(parser);
	if (typeof parser === "function" && !isStandardSchema) return parser;
	if (typeof parser.parseAsync === "function") return parser.parseAsync.bind(parser);
	if (typeof parser.parse === "function") return parser.parse.bind(parser);
	if (typeof parser.validateSync === "function") return parser.validateSync.bind(parser);
	if (typeof parser.create === "function") return parser.create.bind(parser);
	if (typeof parser.assert === "function") return (value) => {
		parser.assert(value);
		return value;
	};
	if (isStandardSchema) return async (value) => {
		const result = await parser["~standard"].validate(value);
		if (result.issues) throw new StandardSchemaV1Error(result.issues);
		return result.value;
	};
	throw new Error("Could not find a validator fn");
}

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectWithoutPropertiesLoose.js
var require_objectWithoutPropertiesLoose = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectWithoutPropertiesLoose.js"(exports, module) {
	function _objectWithoutPropertiesLoose(r, e) {
		if (null == r) return {};
		var t = {};
		for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
			if (e.includes(n)) continue;
			t[n] = r[n];
		}
		return t;
	}
	module.exports = _objectWithoutPropertiesLoose, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectWithoutProperties.js
var require_objectWithoutProperties = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectWithoutProperties.js"(exports, module) {
	var objectWithoutPropertiesLoose = require_objectWithoutPropertiesLoose();
	function _objectWithoutProperties$1(e, t) {
		if (null == e) return {};
		var o, r, i = objectWithoutPropertiesLoose(e, t);
		if (Object.getOwnPropertySymbols) {
			var s = Object.getOwnPropertySymbols(e);
			for (r = 0; r < s.length; r++) o = s[r], t.includes(o) || {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
		}
		return i;
	}
	module.exports = _objectWithoutProperties$1, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region src/unstable-core-do-not-import/procedureBuilder.ts
var import_objectWithoutProperties = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_objectWithoutProperties(), 1);
var import_objectSpread2$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
const _excluded = [
	"middlewares",
	"inputs",
	"meta"
];
function createNewBuilder(def1, def2) {
	const { middlewares = [], inputs, meta } = def2, rest = (0, import_objectWithoutProperties.default)(def2, _excluded);
	return createBuilder((0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, (0,codes_DagpWZLc/* mergeWithoutOverrides */.uf)(def1, rest)), {}, {
		inputs: [...def1.inputs, ...inputs !== null && inputs !== void 0 ? inputs : []],
		middlewares: [...def1.middlewares, ...middlewares],
		meta: def1.meta && meta ? (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, def1.meta), meta) : meta !== null && meta !== void 0 ? meta : def1.meta
	}));
}
function createBuilder(initDef = {}) {
	const _def = (0, import_objectSpread2$1.default)({
		procedure: true,
		inputs: [],
		middlewares: []
	}, initDef);
	const builder = {
		_def,
		input(input) {
			const parser = getParseFn(input);
			return createNewBuilder(_def, {
				inputs: [input],
				middlewares: [createInputMiddleware(parser)]
			});
		},
		output(output) {
			const parser = getParseFn(output);
			return createNewBuilder(_def, {
				output,
				middlewares: [createOutputMiddleware(parser)]
			});
		},
		meta(meta) {
			return createNewBuilder(_def, { meta });
		},
		use(middlewareBuilderOrFn) {
			const middlewares = "_middlewares" in middlewareBuilderOrFn ? middlewareBuilderOrFn._middlewares : [middlewareBuilderOrFn];
			return createNewBuilder(_def, { middlewares });
		},
		unstable_concat(builder$1) {
			return createNewBuilder(_def, builder$1._def);
		},
		concat(builder$1) {
			return createNewBuilder(_def, builder$1._def);
		},
		query(resolver) {
			return createResolver((0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, _def), {}, { type: "query" }), resolver);
		},
		mutation(resolver) {
			return createResolver((0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, _def), {}, { type: "mutation" }), resolver);
		},
		subscription(resolver) {
			return createResolver((0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, _def), {}, { type: "subscription" }), resolver);
		},
		experimental_caller(caller) {
			return createNewBuilder(_def, { caller });
		}
	};
	return builder;
}
function createResolver(_defIn, resolver) {
	const finalBuilder = createNewBuilder(_defIn, {
		resolver,
		middlewares: [async function resolveMiddleware(opts) {
			const data = await resolver(opts);
			return {
				marker: middlewareMarker,
				ok: true,
				data,
				ctx: opts.ctx
			};
		}]
	});
	const _def = (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, finalBuilder._def), {}, {
		type: _defIn.type,
		experimental_caller: Boolean(finalBuilder._def.caller),
		meta: finalBuilder._def.meta,
		$types: null
	});
	const invoke = createProcedureCaller(finalBuilder._def);
	const callerOverride = finalBuilder._def.caller;
	if (!callerOverride) return invoke;
	const callerWrapper = async (...args) => {
		return await callerOverride({
			args,
			invoke,
			_def
		});
	};
	callerWrapper._def = _def;
	return callerWrapper;
}
const codeblock = `
This is a client-only function.
If you want to call this function on the server, see https://trpc.io/docs/v11/server/server-side-calls
`.trim();
async function callRecursive(index, _def, opts) {
	try {
		const middleware = _def.middlewares[index];
		const result = await middleware((0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, opts), {}, {
			meta: _def.meta,
			input: opts.input,
			next(_nextOpts) {
				var _nextOpts$getRawInput;
				const nextOpts = _nextOpts;
				return callRecursive(index + 1, _def, (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, opts), {}, {
					ctx: (nextOpts === null || nextOpts === void 0 ? void 0 : nextOpts.ctx) ? (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, opts.ctx), nextOpts.ctx) : opts.ctx,
					input: nextOpts && "input" in nextOpts ? nextOpts.input : opts.input,
					getRawInput: (_nextOpts$getRawInput = nextOpts === null || nextOpts === void 0 ? void 0 : nextOpts.getRawInput) !== null && _nextOpts$getRawInput !== void 0 ? _nextOpts$getRawInput : opts.getRawInput
				}));
			}
		}));
		return result;
	} catch (cause) {
		return {
			ok: false,
			error: (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause),
			marker: middlewareMarker
		};
	}
}
function createProcedureCaller(_def) {
	async function procedure(opts) {
		if (!opts || !("getRawInput" in opts)) throw new Error(codeblock);
		const result = await callRecursive(0, _def, opts);
		if (!result) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "INTERNAL_SERVER_ERROR",
			message: "No result from middlewares - did you forget to `return next()`?"
		});
		if (!result.ok) throw result.error;
		return result.data;
	}
	procedure._def = _def;
	procedure.procedure = true;
	procedure.meta = _def.meta;
	return procedure;
}

//#endregion
//#region src/unstable-core-do-not-import/rootConfig.ts
var _globalThis$process, _globalThis$process2, _globalThis$process3;
/**
* The default check to see if we're in a server
*/
const isServerDefault = typeof window === "undefined" || "Deno" in window || ((_globalThis$process = globalThis.process) === null || _globalThis$process === void 0 || (_globalThis$process = _globalThis$process.env) === null || _globalThis$process === void 0 ? void 0 : _globalThis$process["NODE_ENV"]) === "test" || !!((_globalThis$process2 = globalThis.process) === null || _globalThis$process2 === void 0 || (_globalThis$process2 = _globalThis$process2.env) === null || _globalThis$process2 === void 0 ? void 0 : _globalThis$process2["JEST_WORKER_ID"]) || !!((_globalThis$process3 = globalThis.process) === null || _globalThis$process3 === void 0 || (_globalThis$process3 = _globalThis$process3.env) === null || _globalThis$process3 === void 0 ? void 0 : _globalThis$process3["VITEST_WORKER_ID"]);

//#endregion
//#region src/unstable-core-do-not-import/initTRPC.ts
var import_objectSpread2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
var TRPCBuilder = class TRPCBuilder {
	/**
	* Add a context shape as a generic to the root object
	* @see https://trpc.io/docs/v11/server/context
	*/
	context() {
		return new TRPCBuilder();
	}
	/**
	* Add a meta shape as a generic to the root object
	* @see https://trpc.io/docs/v11/quickstart
	*/
	meta() {
		return new TRPCBuilder();
	}
	/**
	* Create the root object
	* @see https://trpc.io/docs/v11/server/routers#initialize-trpc
	*/
	create(opts) {
		var _opts$transformer, _opts$isDev, _globalThis$process$1, _opts$allowOutsideOfS, _opts$errorFormatter, _opts$isServer;
		const config = (0, import_objectSpread2.default)((0, import_objectSpread2.default)({}, opts), {}, {
			transformer: (0,tracked_Bjtgv3wJ/* getDataTransformer */.u$)((_opts$transformer = opts === null || opts === void 0 ? void 0 : opts.transformer) !== null && _opts$transformer !== void 0 ? _opts$transformer : tracked_Bjtgv3wJ/* defaultTransformer */.bJ),
			isDev: (_opts$isDev = opts === null || opts === void 0 ? void 0 : opts.isDev) !== null && _opts$isDev !== void 0 ? _opts$isDev : ((_globalThis$process$1 = globalThis.process) === null || _globalThis$process$1 === void 0 ? void 0 : _globalThis$process$1.env["NODE_ENV"]) !== "production",
			allowOutsideOfServer: (_opts$allowOutsideOfS = opts === null || opts === void 0 ? void 0 : opts.allowOutsideOfServer) !== null && _opts$allowOutsideOfS !== void 0 ? _opts$allowOutsideOfS : false,
			errorFormatter: (_opts$errorFormatter = opts === null || opts === void 0 ? void 0 : opts.errorFormatter) !== null && _opts$errorFormatter !== void 0 ? _opts$errorFormatter : tracked_Bjtgv3wJ/* defaultFormatter */.EN,
			isServer: (_opts$isServer = opts === null || opts === void 0 ? void 0 : opts.isServer) !== null && _opts$isServer !== void 0 ? _opts$isServer : isServerDefault,
			$types: null
		});
		{
			var _opts$isServer2;
			const isServer = (_opts$isServer2 = opts === null || opts === void 0 ? void 0 : opts.isServer) !== null && _opts$isServer2 !== void 0 ? _opts$isServer2 : isServerDefault;
			if (!isServer && (opts === null || opts === void 0 ? void 0 : opts.allowOutsideOfServer) !== true) throw new Error(`You're trying to use @trpc/server in a non-server environment. This is not supported by default.`);
		}
		return {
			_config: config,
			procedure: createBuilder({ meta: opts === null || opts === void 0 ? void 0 : opts.defaultMeta }),
			middleware: createMiddlewareFactory(),
			router: (0,tracked_Bjtgv3wJ/* createRouterFactory */.OX)(config),
			mergeRouters: tracked_Bjtgv3wJ/* mergeRouters */.ri,
			createCallerFactory: (0,tracked_Bjtgv3wJ/* createCallerFactory */.OA)()
		};
	}
};
/**
* Builder to initialize the tRPC root object - use this exactly once per backend
* @see https://trpc.io/docs/v11/quickstart
*/
const initTRPC = new TRPCBuilder();

//#endregion

//# sourceMappingURL=initTRPC-RoZMIBeA.mjs.map
// EXTERNAL MODULE: ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js + 6 modules
var types = __webpack_require__(46996);
;// CONCATENATED MODULE: ../../packages/cli/dist/local-router.js


const t = initTRPC.context().create();
const DIFFS_SQL = `
  SELECT
    d.id, d.snapshot_id AS snapshotId,
    d.baseline_s3_key AS baselineS3Key,
    d.diff_s3_key AS diffS3Key,
    d.pixel_diff_percent AS pixelDiffPercent,
    d.ssim_score AS ssimScore, d.passed,
    s.url, s.viewport, s.browser,
    s.s3_key AS snapshotS3Key,
    s.breakpoint_name AS breakpointName,
    s.parameter_name AS parameterName
  FROM diff_reports d
  INNER JOIN snapshots s ON s.id = d.snapshot_id
  WHERE s.run_id = ?
`;
const localRouter = t.router({
    projects: t.router({
        list: t.procedure.query(({ ctx }) => {
            return ctx.db.query.projects.findMany({
                orderBy: (p, { desc }) => [desc(p.createdAt)],
            });
        }),
    }),
    runs: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj().optional() }).optional())
            .query(({ ctx, input }) => {
            return ctx.db.query.captureRuns.findMany({
                orderBy: (r, { desc }) => [desc(r.createdAt)],
                ...(input?.projectId
                    ? { where: (r, { eq }) => eq(r.projectId, input.projectId) }
                    : {}),
            });
        }),
        get: t.procedure
            .input(types/* object */.Ik({ id: types/* string */.Yj().optional(), runId: types/* string */.Yj().optional() }))
            .query(async ({ ctx, input }) => {
            const lookupId = input.runId ?? input.id;
            if (!lookupId)
                return null;
            const result = ctx.db.query.captureRuns.findFirst({
                where: (r, { eq }) => eq(r.id, lookupId),
            });
            return result ?? null;
        }),
    }),
    diffs: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const stmt = ctx.db.$client.prepare(DIFFS_SQL);
            return stmt.all(input.runId);
        }),
        byRunId: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const stmt = ctx.db.$client.prepare(DIFFS_SQL);
            return stmt.all(input.runId);
        }),
    }),
    approvals: t.router({
        approve: t.procedure
            .input(types/* object */.Ik({ diffReportId: types/* string */.Yj(), reason: types/* string */.Yj().optional() }))
            .mutation(({ ctx, input }) => {
            const id = crypto.randomUUID();
            ctx.db.$client
                .prepare(`INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
             VALUES (?, ?, 'approved', 'local', 'local', ?, ?)`)
                .run(id, input.diffReportId, input.reason ?? null, Date.now());
            ctx.db.$client
                .prepare(`UPDATE diff_reports SET passed = 'passed' WHERE id = ?`)
                .run(input.diffReportId);
            return { success: true };
        }),
        reject: t.procedure
            .input(types/* object */.Ik({ diffReportId: types/* string */.Yj(), reason: types/* string */.Yj().optional() }))
            .mutation(({ ctx, input }) => {
            const id = crypto.randomUUID();
            ctx.db.$client
                .prepare(`INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
             VALUES (?, ?, 'rejected', 'local', 'local', ?, ?)`)
                .run(id, input.diffReportId, input.reason ?? null, Date.now());
            return { success: true };
        }),
        defer: t.procedure
            .input(types/* object */.Ik({ diffReportId: types/* string */.Yj(), reason: types/* string */.Yj().optional() }))
            .mutation(({ ctx, input }) => {
            const id = crypto.randomUUID();
            ctx.db.$client
                .prepare(`INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
             VALUES (?, ?, 'deferred', 'local', 'local', ?, ?)`)
                .run(id, input.diffReportId, input.reason ?? null, Date.now());
            return { success: true };
        }),
        history: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj().optional(), diffReportId: types/* string */.Yj().optional() }))
            .query(({ ctx, input }) => {
            if (input.diffReportId) {
                const stmt = ctx.db.$client.prepare(`SELECT id, diff_report_id AS diffReportId, action, user_id AS userId,
                    user_email AS userEmail, reason, created_at AS createdAt
             FROM approval_decisions WHERE diff_report_id = ? ORDER BY created_at DESC`);
                return stmt.all(input.diffReportId);
            }
            if (input.runId) {
                const stmt = ctx.db.$client.prepare(`SELECT a.id, a.diff_report_id AS diffReportId, a.action, a.user_id AS userId,
                    a.user_email AS userEmail, a.reason, a.created_at AS createdAt
             FROM approval_decisions a
             INNER JOIN diff_reports d ON d.id = a.diff_report_id
             INNER JOIN snapshots s ON s.id = d.snapshot_id
             WHERE s.run_id = ? ORDER BY a.created_at DESC`);
                return stmt.all(input.runId);
            }
            return [];
        }),
        bulkApprove: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj(), reason: types/* string */.Yj().optional() }))
            .mutation(({ ctx, input }) => {
            const failedDiffs = ctx.db.$client.prepare(`
          SELECT d.id
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          WHERE s.run_id = ? AND d.passed = 'false'
        `).all(input.runId);
            const now = Date.now();
            const insertStmt = ctx.db.$client.prepare(`
          INSERT INTO approval_decisions (id, diff_report_id, action, user_id, user_email, reason, created_at)
          VALUES (?, ?, 'approved', 'local', 'local', ?, ?)
        `);
            const updateStmt = ctx.db.$client.prepare(`UPDATE diff_reports SET passed = 'passed' WHERE id = ?`);
            for (const diff of failedDiffs) {
                insertStmt.run(crypto.randomUUID(), diff.id, input.reason ?? null, now);
                updateStmt.run(diff.id);
            }
            return { approvedCount: failedDiffs.length };
        }),
    }),
    a11y: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            return ctx.db.query.a11yViolations.findMany({
                where: (v, { eq }) => eq(v.captureRunId, input.runId),
            });
        }),
        byRunId: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const violations = ctx.db.$client.prepare(`
          SELECT id, rule_id AS ruleId, impact, css_selector AS cssSelector,
                 html, help_url AS helpUrl, is_new AS isNew, fingerprint
          FROM a11y_violations WHERE capture_run_id = ?
        `).all(input.runId);
            const newCount = violations.filter((v) => v.isNew === 1).length;
            const existingCount = violations.filter((v) => v.isNew === 0).length;
            // Compute fixed count by comparing against previous run
            let fixedCount = 0;
            const run = ctx.db.$client.prepare(`SELECT project_id AS projectId FROM capture_runs WHERE id = ?`).get(input.runId);
            if (run) {
                const prevRun = ctx.db.$client.prepare(`SELECT id FROM capture_runs WHERE project_id = ? AND id != ? ORDER BY created_at DESC LIMIT 1`).get(run.projectId, input.runId);
                if (prevRun) {
                    const prevViolations = ctx.db.$client.prepare(`SELECT fingerprint FROM a11y_violations WHERE capture_run_id = ?`).all(prevRun.id);
                    const currentFingerprints = new Set(violations.map((v) => v.fingerprint));
                    fixedCount = prevViolations.filter((pv) => !currentFingerprints.has(pv.fingerprint)).length;
                }
            }
            return {
                summary: { new: newCount, fixed: fixedCount, existing: existingCount },
                violations,
            };
        }),
        byProject: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const stmt = ctx.db.$client.prepare(`
          SELECT v.* FROM a11y_violations v
          INNER JOIN capture_runs r ON r.id = v.capture_run_id
          WHERE r.project_id = ?
          ORDER BY v.created_at DESC
        `);
            return stmt.all(input.projectId);
        }),
    }),
    classifications: t.router({
        get: t.procedure
            .input(types/* object */.Ik({ diffReportId: types/* string */.Yj() }))
            .query(async ({ ctx, input }) => {
            const result = ctx.db.query.diffClassifications.findFirst({
                where: (c, { eq }) => eq(c.diffReportId, input.diffReportId),
            });
            return result ?? null;
        }),
        byRunId: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const stmt = ctx.db.$client.prepare(`
          SELECT c.id, c.diff_report_id AS diffReportId, c.category, c.severity,
                 c.confidence, c.summary, c.created_at AS createdAt
          FROM diff_classifications c
          INNER JOIN diff_reports d ON d.id = c.diff_report_id
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          WHERE s.run_id = ?
        `);
            return stmt.all(input.runId);
        }),
        layoutShifts: t.procedure
            .input(types/* object */.Ik({ diffReportId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const stmt = ctx.db.$client.prepare(`
          SELECT id, diff_report_id AS diffReportId, selector,
                 baseline_x AS baselineX, baseline_y AS baselineY,
                 baseline_width AS baselineWidth, baseline_height AS baselineHeight,
                 current_x AS currentX, current_y AS currentY,
                 current_width AS currentWidth, current_height AS currentHeight,
                 shift_distance AS shiftDistance
          FROM layout_shifts WHERE diff_report_id = ?
        `);
            return stmt.all(input.diffReportId);
        }),
        override: t.procedure
            .input(types/* object */.Ik({
            diffReportId: types/* string */.Yj(),
            overrideCategory: types/* enum */.k5(['layout', 'style', 'content', 'cosmetic']),
        }))
            .mutation(({ ctx, input }) => {
            const classification = ctx.db.$client.prepare(`SELECT category FROM diff_classifications WHERE diff_report_id = ?`).get(input.diffReportId);
            const originalCategory = classification?.category ?? 'unknown';
            ctx.db.$client.prepare(`
          INSERT INTO classification_overrides (id, diff_report_id, original_category, override_category, user_id, created_at)
          VALUES (?, ?, ?, ?, 'local', ?)
        `).run(crypto.randomUUID(), input.diffReportId, originalCategory, input.overrideCategory, Date.now());
            return { success: true };
        }),
    }),
    lighthouse: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ runId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            return ctx.db.query.lighthouseScores.findMany({
                where: (l, { eq }) => eq(l.captureRunId, input.runId),
            });
        }),
        routeUrls: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            return ctx.db.$client.prepare(`
          SELECT DISTINCT url FROM lighthouse_scores WHERE project_id = ?
        `).all(input.projectId);
        }),
        trend: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            url: types/* string */.Yj(),
            limit: types/* number */.ai().min(1).max(100).default(20),
        }))
            .query(({ ctx, input }) => {
            const rows = ctx.db.$client.prepare(`
          SELECT id, capture_run_id AS captureRunId, project_id AS projectId,
                 url, viewport, performance, accessibility,
                 best_practices AS bestPractices, seo, created_at AS createdAt
          FROM lighthouse_scores
          WHERE project_id = ? AND url = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(input.projectId, input.url, input.limit);
            return rows.reverse(); // chronological order
        }),
        budgetsList: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            return ctx.db.$client.prepare(`
          SELECT id, project_id AS projectId, route,
                 performance, accessibility,
                 best_practices AS bestPractices, seo,
                 created_at AS createdAt, updated_at AS updatedAt
          FROM performance_budgets
          WHERE project_id = ?
        `).all(input.projectId);
        }),
    }),
    components: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            return ctx.db.query.components.findMany({
                where: (c, { eq }) => eq(c.projectId, input.projectId),
            });
        }),
        create: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            name: types/* string */.Yj().min(1).max(100),
            selector: types/* string */.Yj().min(1).max(500),
            description: types/* string */.Yj().max(500).optional(),
        }))
            .mutation(({ ctx, input }) => {
            const id = crypto.randomUUID();
            const now = Date.now();
            ctx.db.$client.prepare(`
          INSERT INTO components (id, project_id, name, selector, description, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(id, input.projectId, input.name, input.selector, input.description ?? null, now, now);
            return ctx.db.$client.prepare(`SELECT id, project_id AS projectId, name, selector, description, enabled, created_at AS createdAt, updated_at AS updatedAt FROM components WHERE id = ?`).get(id);
        }),
        update: t.procedure
            .input(types/* object */.Ik({
            id: types/* string */.Yj(),
            name: types/* string */.Yj().min(1).max(100).optional(),
            selector: types/* string */.Yj().min(1).max(500).optional(),
            description: types/* string */.Yj().max(500).nullish(),
            enabled: types/* number */.ai().int().min(0).max(1).optional(),
        }))
            .mutation(({ ctx, input }) => {
            const sets = ['updated_at = ?'];
            const values = [Date.now()];
            if (input.name !== undefined) {
                sets.push('name = ?');
                values.push(input.name);
            }
            if (input.selector !== undefined) {
                sets.push('selector = ?');
                values.push(input.selector);
            }
            if (input.description !== undefined) {
                sets.push('description = ?');
                values.push(input.description);
            }
            if (input.enabled !== undefined) {
                sets.push('enabled = ?');
                values.push(input.enabled);
            }
            values.push(input.id);
            ctx.db.$client.prepare(`UPDATE components SET ${sets.join(', ')} WHERE id = ?`).run(...values);
            return ctx.db.$client.prepare(`SELECT id, project_id AS projectId, name, selector, description, enabled, created_at AS createdAt, updated_at AS updatedAt FROM components WHERE id = ?`).get(input.id);
        }),
        delete: t.procedure
            .input(types/* object */.Ik({ id: types/* string */.Yj() }))
            .mutation(({ ctx, input }) => {
            ctx.db.$client.prepare(`DELETE FROM components WHERE id = ?`).run(input.id);
            return { success: true };
        }),
        consistency: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const enabledComponents = ctx.db.$client.prepare(`
          SELECT id, name FROM components WHERE project_id = ? AND enabled = 1
        `).all(input.projectId);
            if (enabledComponents.length === 0)
                return [];
            const result = [];
            for (const component of enabledComponents) {
                const componentSnapshots = ctx.db.$client.prepare(`
            SELECT id, url, s3_key AS s3Key, captured_at AS capturedAt
            FROM snapshots
            WHERE component_id = ?
            ORDER BY captured_at DESC
          `).all(component.id);
                // Deduplicate: keep latest per URL
                const byUrl = new Map();
                for (const snap of componentSnapshots) {
                    if (!byUrl.has(snap.url)) {
                        byUrl.set(snap.url, { snapshotId: snap.id, s3Key: snap.s3Key });
                    }
                }
                const projectUrls = ctx.db.$client.prepare(`
            SELECT DISTINCT s.url
            FROM snapshots s
            INNER JOIN capture_runs r ON r.id = s.run_id
            WHERE r.project_id = ?
          `).all(input.projectId);
                const uniqueUrls = [...new Set(projectUrls.map((r) => r.url))];
                const pages = uniqueUrls.map((url) => {
                    const componentSnap = byUrl.get(url);
                    if (!componentSnap) {
                        return { url, snapshotId: null, status: 'missing' };
                    }
                    return { url, snapshotId: componentSnap.snapshotId, status: 'consistent' };
                });
                result.push({
                    componentId: component.id,
                    componentName: component.name,
                    pages,
                });
            }
            return result;
        }),
    }),
    healthScores: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            return ctx.db.query.healthScores.findMany({
                where: (h, { eq }) => eq(h.projectId, input.projectId),
            });
        }),
        projectScore: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const row = ctx.db.$client.prepare(`
          SELECT score, computed_at AS computedAt
          FROM health_scores
          WHERE project_id = ? AND component_id IS NULL
          ORDER BY computed_at DESC
          LIMIT 1
        `).get(input.projectId);
            return row ?? null;
        }),
        componentScores: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const rows = ctx.db.$client.prepare(`
          SELECT
            hs.component_id AS componentId,
            c.name AS componentName,
            hs.score,
            hs.computed_at AS computedAt
          FROM health_scores hs
          INNER JOIN components c ON c.id = hs.component_id
          WHERE hs.project_id = ?
            AND hs.component_id IS NOT NULL
            AND hs.score != -1
          ORDER BY hs.computed_at DESC
        `).all(input.projectId);
            // Deduplicate: keep latest per componentId
            const seen = new Set();
            const deduped = rows.filter((row) => {
                if (seen.has(row.componentId))
                    return false;
                seen.add(row.componentId);
                return true;
            });
            // Sort worst-first
            deduped.sort((a, b) => a.score - b.score);
            return deduped;
        }),
        trend: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            windowDays: types/* enum */.k5(['7', '30', '90']).default('30'),
            componentId: types/* string */.Yj().optional(),
        }))
            .query(({ ctx, input }) => {
            const windowDays = parseInt(input.windowDays, 10);
            const cutoff = Date.now() - windowDays * 86400000;
            if (input.componentId) {
                return ctx.db.$client.prepare(`
            SELECT score, computed_at AS computedAt
            FROM health_scores
            WHERE project_id = ? AND component_id = ? AND computed_at >= ?
            ORDER BY computed_at ASC
          `).all(input.projectId, input.componentId, cutoff);
            }
            return ctx.db.$client.prepare(`
          SELECT score, computed_at AS computedAt
          FROM health_scores
          WHERE project_id = ? AND component_id IS NULL AND computed_at >= ?
          ORDER BY computed_at ASC
        `).all(input.projectId, cutoff);
        }),
    }),
    stability: t.router({
        list: t.procedure
            .input(types/* object */.Ik({ projectId: types/* string */.Yj() }))
            .query(({ ctx, input }) => {
            const cutoff = Date.now() - 30 * 86400000;
            const rows = ctx.db.$client.prepare(`
          SELECT
            s.url, s.viewport, s.browser, s.parameter_name AS parameterName,
            d.passed, d.created_at AS createdAt
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ? AND d.created_at >= ?
          ORDER BY d.created_at ASC
        `).all(input.projectId, cutoff);
            if (rows.length === 0)
                return [];
            // Group by route key
            const groups = new Map();
            for (const row of rows) {
                const key = `${row.url}|${row.viewport}|${row.browser}|${row.parameterName}`;
                const group = groups.get(key) ?? [];
                group.push(row);
                groups.set(key, group);
            }
            const results = [];
            for (const [, group] of groups) {
                // Count flips
                let flipCount = 0;
                for (let i = 1; i < group.length; i++) {
                    const prev = group[i - 1].passed === 'true';
                    const curr = group[i].passed === 'true';
                    if (prev !== curr)
                        flipCount++;
                }
                results.push({
                    url: group[0].url,
                    viewport: group[0].viewport,
                    browser: group[0].browser,
                    parameterName: group[0].parameterName,
                    stabilityScore: Math.max(0, 100 - flipCount * 10),
                    flipCount,
                    totalRuns: group.length,
                });
            }
            // Sort worst-first
            results.sort((a, b) => a.stabilityScore - b.stabilityScore);
            return results;
        }),
        flipHistory: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            url: types/* string */.Yj(),
            viewport: types/* string */.Yj(),
            browser: types/* string */.Yj(),
            parameterName: types/* string */.Yj(),
        }))
            .query(({ ctx, input }) => {
            const cutoff = Date.now() - 30 * 86400000;
            return ctx.db.$client.prepare(`
          SELECT d.passed, d.created_at AS createdAt
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ?
            AND s.url = ?
            AND s.viewport = ?
            AND s.browser = ?
            AND s.parameter_name = ?
            AND d.created_at >= ?
          ORDER BY d.created_at ASC
        `).all(input.projectId, input.url, input.viewport, input.browser, input.parameterName, cutoff);
        }),
    }),
    analytics: t.router({
        regressionTrend: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            windowDays: types/* enum */.k5(['30', '60', '90']).default('30'),
        }))
            .query(({ ctx, input }) => {
            const windowDays = parseInt(input.windowDays, 10);
            const cutoff = Date.now() - windowDays * 86400000;
            const rows = ctx.db.$client.prepare(`
          SELECT
            strftime('%Y-%m-%d', d.created_at / 1000, 'unixepoch') AS date,
            COUNT(*) AS count
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ?
            AND d.passed = 'false'
            AND d.created_at >= ?
          GROUP BY strftime('%Y-%m-%d', d.created_at / 1000, 'unixepoch')
          ORDER BY date ASC
        `).all(input.projectId, cutoff);
            return rows.map((r) => ({ date: String(r.date), count: Number(r.count) }));
        }),
        teamMetrics: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            windowDays: types/* enum */.k5(['30', '60', '90']).default('30'),
        }))
            .query(({ ctx, input }) => {
            const windowDays = parseInt(input.windowDays, 10);
            const cutoff = Date.now() - windowDays * 86400000;
            const rows = ctx.db.$client.prepare(`
          SELECT
            a.created_at AS approvalCreatedAt,
            d.created_at AS diffCreatedAt
          FROM approval_decisions a
          INNER JOIN diff_reports d ON d.id = a.diff_report_id
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          WHERE r.project_id = ?
            AND a.action = 'approved'
            AND a.created_at >= ?
        `).all(input.projectId, cutoff);
            if (rows.length === 0) {
                return { meanTimeToApproveMs: null, approvalVelocity: 0, totalApprovals: 0 };
            }
            const totalApprovals = rows.length;
            const totalMs = rows.reduce((sum, row) => sum + (row.approvalCreatedAt - row.diffCreatedAt), 0);
            const meanTimeToApproveMs = Math.round(totalMs / totalApprovals);
            const approvalVelocity = totalApprovals / windowDays;
            return { meanTimeToApproveMs, approvalVelocity, totalApprovals };
        }),
        diffExport: t.procedure
            .input(types/* object */.Ik({
            projectId: types/* string */.Yj(),
            windowDays: types/* enum */.k5(['30', '60', '90']).default('30'),
        }))
            .query(({ ctx, input }) => {
            const windowDays = parseInt(input.windowDays, 10);
            const cutoff = Date.now() - windowDays * 86400000;
            const rows = ctx.db.$client.prepare(`
          SELECT
            s.url,
            s.viewport,
            d.pixel_diff_percent AS pixelDiffPercent,
            d.passed,
            d.created_at AS diffCreatedAt,
            a.action AS approvalAction,
            a.created_at AS approvalDate,
            a.user_email AS approverEmail
          FROM diff_reports d
          INNER JOIN snapshots s ON s.id = d.snapshot_id
          INNER JOIN capture_runs r ON r.id = s.run_id
          LEFT JOIN approval_decisions a ON a.diff_report_id = d.id
          WHERE r.project_id = ?
            AND d.created_at >= ?
          ORDER BY d.created_at ASC
        `).all(input.projectId, cutoff);
            return rows.map((r) => ({
                url: r.url,
                viewport: r.viewport,
                pixelDiffPercent: r.pixelDiffPercent != null ? r.pixelDiffPercent / 100 : null,
                passed: r.passed,
                diffCreatedAt: new Date(r.diffCreatedAt).toISOString(),
                approvalAction: r.approvalAction ?? null,
                approvalDate: r.approvalDate ? new Date(r.approvalDate).toISOString() : null,
                approverEmail: r.approverEmail ?? null,
            }));
        }),
    }),
});
//# sourceMappingURL=local-router.js.map

/***/ })

};

//# sourceMappingURL=274.index.js.map