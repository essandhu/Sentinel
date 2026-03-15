export const id = 485;
export const ids = [485];
export const modules = {

/***/ 14256:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   D_: () => (/* binding */ identity),
/* harmony export */   Gv: () => (/* binding */ isObject),
/* harmony export */   Td: () => (/* binding */ isAsyncIterable),
/* harmony export */   Tn: () => (/* binding */ isFunction),
/* harmony export */   Yk: () => (/* binding */ TRPC_ERROR_CODES_BY_KEY),
/* harmony export */   eF: () => (/* binding */ run),
/* harmony export */   uB: () => (/* binding */ TRPC_ERROR_CODES_BY_NUMBER),
/* harmony export */   uf: () => (/* binding */ mergeWithoutOverrides),
/* harmony export */   vB: () => (/* binding */ emptyObject),
/* harmony export */   zf: () => (/* binding */ abortSignalsAnyPonyfill)
/* harmony export */ });
/* unused harmony exports assert, noop, retryableRpcCodes, sleep */
//#region src/unstable-core-do-not-import/utils.ts
/**
* Ensures there are no duplicate keys when building a procedure.
* @internal
*/
function mergeWithoutOverrides(obj1, ...objs) {
	const newObj = Object.assign(emptyObject(), obj1);
	for (const overrides of objs) for (const key in overrides) {
		if (key in newObj && newObj[key] !== overrides[key]) throw new Error(`Duplicate key ${key}`);
		newObj[key] = overrides[key];
	}
	return newObj;
}
/**
* Check that value is object
* @internal
*/
function isObject(value) {
	return !!value && !Array.isArray(value) && typeof value === "object";
}
function isFunction(fn) {
	return typeof fn === "function";
}
/**
* Create an object without inheriting anything from `Object.prototype`
* @internal
*/
function emptyObject() {
	return Object.create(null);
}
const asyncIteratorsSupported = typeof Symbol === "function" && !!Symbol.asyncIterator;
function isAsyncIterable(value) {
	return asyncIteratorsSupported && isObject(value) && Symbol.asyncIterator in value;
}
/**
* Run an IIFE
*/
const run = (fn) => fn();
function noop() {}
function identity(it) {
	return it;
}
/**
* Generic runtime assertion function. Throws, if the condition is not `true`.
*
* Can be used as a slightly less dangerous variant of type assertions. Code
* mistakes would be revealed at runtime then (hopefully during testing).
*/
function assert(condition, msg = "no additional info") {
	if (!condition) throw new Error(`AssertionError: ${msg}`);
}
function sleep(ms = 0) {
	return new Promise((res) => setTimeout(res, ms));
}
/**
* Ponyfill for
* [`AbortSignal.any`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static).
*/
function abortSignalsAnyPonyfill(signals) {
	if (typeof AbortSignal.any === "function") return AbortSignal.any(signals);
	const ac = new AbortController();
	for (const signal of signals) {
		if (signal.aborted) {
			trigger();
			break;
		}
		signal.addEventListener("abort", trigger, { once: true });
	}
	return ac.signal;
	function trigger() {
		ac.abort();
		for (const signal of signals) signal.removeEventListener("abort", trigger);
	}
}

//#endregion
//#region src/unstable-core-do-not-import/rpc/codes.ts
/**
* JSON-RPC 2.0 Error codes
*
* `-32000` to `-32099` are reserved for implementation-defined server-errors.
* For tRPC we're copying the last digits of HTTP 4XX errors.
*/
const TRPC_ERROR_CODES_BY_KEY = {
	PARSE_ERROR: -32700,
	BAD_REQUEST: -32600,
	INTERNAL_SERVER_ERROR: -32603,
	NOT_IMPLEMENTED: -32603,
	BAD_GATEWAY: -32603,
	SERVICE_UNAVAILABLE: -32603,
	GATEWAY_TIMEOUT: -32603,
	UNAUTHORIZED: -32001,
	PAYMENT_REQUIRED: -32002,
	FORBIDDEN: -32003,
	NOT_FOUND: -32004,
	METHOD_NOT_SUPPORTED: -32005,
	TIMEOUT: -32008,
	CONFLICT: -32009,
	PRECONDITION_FAILED: -32012,
	PAYLOAD_TOO_LARGE: -32013,
	UNSUPPORTED_MEDIA_TYPE: -32015,
	UNPROCESSABLE_CONTENT: -32022,
	PRECONDITION_REQUIRED: -32028,
	TOO_MANY_REQUESTS: -32029,
	CLIENT_CLOSED_REQUEST: -32099
};
const TRPC_ERROR_CODES_BY_NUMBER = {
	[-32700]: "PARSE_ERROR",
	[-32600]: "BAD_REQUEST",
	[-32603]: "INTERNAL_SERVER_ERROR",
	[-32001]: "UNAUTHORIZED",
	[-32002]: "PAYMENT_REQUIRED",
	[-32003]: "FORBIDDEN",
	[-32004]: "NOT_FOUND",
	[-32005]: "METHOD_NOT_SUPPORTED",
	[-32008]: "TIMEOUT",
	[-32009]: "CONFLICT",
	[-32012]: "PRECONDITION_FAILED",
	[-32013]: "PAYLOAD_TOO_LARGE",
	[-32015]: "UNSUPPORTED_MEDIA_TYPE",
	[-32022]: "UNPROCESSABLE_CONTENT",
	[-32028]: "PRECONDITION_REQUIRED",
	[-32029]: "TOO_MANY_REQUESTS",
	[-32099]: "CLIENT_CLOSED_REQUEST"
};
/**
* tRPC error codes that are considered retryable
* With out of the box SSE, the client will reconnect when these errors are encountered
*/
const retryableRpcCodes = [
	TRPC_ERROR_CODES_BY_KEY.BAD_GATEWAY,
	TRPC_ERROR_CODES_BY_KEY.SERVICE_UNAVAILABLE,
	TRPC_ERROR_CODES_BY_KEY.GATEWAY_TIMEOUT,
	TRPC_ERROR_CODES_BY_KEY.INTERNAL_SERVER_ERROR
];

//#endregion

//# sourceMappingURL=codes-DagpWZLc.mjs.map

/***/ }),

/***/ 6700:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   E$: () => (/* binding */ getHTTPStatusCode),
/* harmony export */   KQ: () => (/* binding */ getErrorShape),
/* harmony export */   P$: () => (/* binding */ __commonJS),
/* harmony export */   Vh: () => (/* binding */ require_defineProperty),
/* harmony export */   f1: () => (/* binding */ __toESM),
/* harmony export */   jr: () => (/* binding */ require_objectSpread2),
/* harmony export */   vX: () => (/* binding */ createRecursiveProxy)
/* harmony export */ });
/* unused harmony exports HTTP_CODE_TO_JSONRPC2, JSONRPC2_TO_HTTP_CODE, createFlatProxy, getHTTPStatusCodeFromError, getStatusCodeFromKey, getStatusKeyFromCode */
/* harmony import */ var _codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(14256);


//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
//#region src/unstable-core-do-not-import/createProxy.ts
const noop = () => {};
const freezeIfAvailable = (obj) => {
	if (Object.freeze) Object.freeze(obj);
};
function createInnerProxy(callback, path, memo) {
	var _memo$cacheKey;
	const cacheKey = path.join(".");
	(_memo$cacheKey = memo[cacheKey]) !== null && _memo$cacheKey !== void 0 || (memo[cacheKey] = new Proxy(noop, {
		get(_obj, key) {
			if (typeof key !== "string" || key === "then") return void 0;
			return createInnerProxy(callback, [...path, key], memo);
		},
		apply(_1, _2, args) {
			const lastOfPath = path[path.length - 1];
			let opts = {
				args,
				path
			};
			if (lastOfPath === "call") opts = {
				args: args.length >= 2 ? [args[1]] : [],
				path: path.slice(0, -1)
			};
			else if (lastOfPath === "apply") opts = {
				args: args.length >= 2 ? args[1] : [],
				path: path.slice(0, -1)
			};
			freezeIfAvailable(opts.args);
			freezeIfAvailable(opts.path);
			return callback(opts);
		}
	}));
	return memo[cacheKey];
}
/**
* Creates a proxy that calls the callback with the path and arguments
*
* @internal
*/
const createRecursiveProxy = (callback) => createInnerProxy(callback, [], (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_0__/* .emptyObject */ .vB)());
/**
* Used in place of `new Proxy` where each handler will map 1 level deep to another value.
*
* @internal
*/
const createFlatProxy = (callback) => {
	return new Proxy(noop, { get(_obj, name) {
		if (name === "then") return void 0;
		return callback(name);
	} });
};

//#endregion
//#region src/unstable-core-do-not-import/http/getHTTPStatusCode.ts
const JSONRPC2_TO_HTTP_CODE = {
	PARSE_ERROR: 400,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	PAYMENT_REQUIRED: 402,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_SUPPORTED: 405,
	TIMEOUT: 408,
	CONFLICT: 409,
	PRECONDITION_FAILED: 412,
	PAYLOAD_TOO_LARGE: 413,
	UNSUPPORTED_MEDIA_TYPE: 415,
	UNPROCESSABLE_CONTENT: 422,
	PRECONDITION_REQUIRED: 428,
	TOO_MANY_REQUESTS: 429,
	CLIENT_CLOSED_REQUEST: 499,
	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504
};
const HTTP_CODE_TO_JSONRPC2 = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	402: "PAYMENT_REQUIRED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	405: "METHOD_NOT_SUPPORTED",
	408: "TIMEOUT",
	409: "CONFLICT",
	412: "PRECONDITION_FAILED",
	413: "PAYLOAD_TOO_LARGE",
	415: "UNSUPPORTED_MEDIA_TYPE",
	422: "UNPROCESSABLE_CONTENT",
	428: "PRECONDITION_REQUIRED",
	429: "TOO_MANY_REQUESTS",
	499: "CLIENT_CLOSED_REQUEST",
	500: "INTERNAL_SERVER_ERROR",
	501: "NOT_IMPLEMENTED",
	502: "BAD_GATEWAY",
	503: "SERVICE_UNAVAILABLE",
	504: "GATEWAY_TIMEOUT"
};
function getStatusCodeFromKey(code) {
	var _JSONRPC2_TO_HTTP_COD;
	return (_JSONRPC2_TO_HTTP_COD = JSONRPC2_TO_HTTP_CODE[code]) !== null && _JSONRPC2_TO_HTTP_COD !== void 0 ? _JSONRPC2_TO_HTTP_COD : 500;
}
function getStatusKeyFromCode(code) {
	var _HTTP_CODE_TO_JSONRPC;
	return (_HTTP_CODE_TO_JSONRPC = HTTP_CODE_TO_JSONRPC2[code]) !== null && _HTTP_CODE_TO_JSONRPC !== void 0 ? _HTTP_CODE_TO_JSONRPC : "INTERNAL_SERVER_ERROR";
}
function getHTTPStatusCode(json) {
	const arr = Array.isArray(json) ? json : [json];
	const httpStatuses = new Set(arr.map((res) => {
		if ("error" in res && (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_0__/* .isObject */ .Gv)(res.error.data)) {
			var _res$error$data;
			if (typeof ((_res$error$data = res.error.data) === null || _res$error$data === void 0 ? void 0 : _res$error$data["httpStatus"]) === "number") return res.error.data["httpStatus"];
			const code = _codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_0__/* .TRPC_ERROR_CODES_BY_NUMBER */ .uB[res.error.code];
			return getStatusCodeFromKey(code);
		}
		return 200;
	}));
	if (httpStatuses.size !== 1) return 207;
	const httpStatus = httpStatuses.values().next().value;
	return httpStatus;
}
function getHTTPStatusCodeFromError(error) {
	return getStatusCodeFromKey(error.code);
}

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/typeof.js
var require_typeof = __commonJS({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/typeof.js"(exports, module) {
	function _typeof$2(o) {
		"@babel/helpers - typeof";
		return module.exports = _typeof$2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
			return typeof o$1;
		} : function(o$1) {
			return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
		}, module.exports.__esModule = true, module.exports["default"] = module.exports, _typeof$2(o);
	}
	module.exports = _typeof$2, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPrimitive.js
var require_toPrimitive = __commonJS({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPrimitive.js"(exports, module) {
	var _typeof$1 = require_typeof()["default"];
	function toPrimitive$1(t, r) {
		if ("object" != _typeof$1(t) || !t) return t;
		var e = t[Symbol.toPrimitive];
		if (void 0 !== e) {
			var i = e.call(t, r || "default");
			if ("object" != _typeof$1(i)) return i;
			throw new TypeError("@@toPrimitive must return a primitive value.");
		}
		return ("string" === r ? String : Number)(t);
	}
	module.exports = toPrimitive$1, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPropertyKey.js
var require_toPropertyKey = __commonJS({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPropertyKey.js"(exports, module) {
	var _typeof = require_typeof()["default"];
	var toPrimitive = require_toPrimitive();
	function toPropertyKey$1(t) {
		var i = toPrimitive(t, "string");
		return "symbol" == _typeof(i) ? i : i + "";
	}
	module.exports = toPropertyKey$1, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/defineProperty.js
var require_defineProperty = __commonJS({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/defineProperty.js"(exports, module) {
	var toPropertyKey = require_toPropertyKey();
	function _defineProperty(e, r, t) {
		return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
			value: t,
			enumerable: !0,
			configurable: !0,
			writable: !0
		}) : e[r] = t, e;
	}
	module.exports = _defineProperty, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectSpread2.js
var require_objectSpread2 = __commonJS({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectSpread2.js"(exports, module) {
	var defineProperty = require_defineProperty();
	function ownKeys(e, r) {
		var t = Object.keys(e);
		if (Object.getOwnPropertySymbols) {
			var o = Object.getOwnPropertySymbols(e);
			r && (o = o.filter(function(r$1) {
				return Object.getOwnPropertyDescriptor(e, r$1).enumerable;
			})), t.push.apply(t, o);
		}
		return t;
	}
	function _objectSpread2(e) {
		for (var r = 1; r < arguments.length; r++) {
			var t = null != arguments[r] ? arguments[r] : {};
			r % 2 ? ownKeys(Object(t), !0).forEach(function(r$1) {
				defineProperty(e, r$1, t[r$1]);
			}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r$1) {
				Object.defineProperty(e, r$1, Object.getOwnPropertyDescriptor(t, r$1));
			});
		}
		return e;
	}
	module.exports = _objectSpread2, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region src/unstable-core-do-not-import/error/getErrorShape.ts
var import_objectSpread2 = __toESM(require_objectSpread2(), 1);
/**
* @internal
*/
function getErrorShape(opts) {
	const { path, error, config } = opts;
	const { code } = opts.error;
	const shape = {
		message: error.message,
		code: _codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_0__/* .TRPC_ERROR_CODES_BY_KEY */ .Yk[code],
		data: {
			code,
			httpStatus: getHTTPStatusCodeFromError(error)
		}
	};
	if (config.isDev && typeof opts.error.stack === "string") shape.data.stack = opts.error.stack;
	if (typeof path === "string") shape.data.path = path;
	return config.errorFormatter((0, import_objectSpread2.default)((0, import_objectSpread2.default)({}, opts), {}, { shape }));
}

//#endregion

//# sourceMappingURL=getErrorShape-vC8mUXJD.mjs.map

/***/ }),

/***/ 52485:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   EN: () => (/* binding */ defaultFormatter),
/* harmony export */   Iw: () => (/* binding */ getProcedureAtPath),
/* harmony export */   OA: () => (/* binding */ createCallerFactory),
/* harmony export */   OD: () => (/* binding */ callProcedure),
/* harmony export */   OX: () => (/* binding */ createRouterFactory),
/* harmony export */   bJ: () => (/* binding */ defaultTransformer),
/* harmony export */   gt: () => (/* binding */ TRPCError),
/* harmony export */   qO: () => (/* binding */ getTRPCErrorFromUnknown),
/* harmony export */   ri: () => (/* binding */ mergeRouters),
/* harmony export */   t9: () => (/* binding */ transformTRPCResponse),
/* harmony export */   u$: () => (/* binding */ getDataTransformer),
/* harmony export */   vJ: () => (/* binding */ isTrackedEnvelope)
/* harmony export */ });
/* unused harmony exports getCauseFromUnknown, lazy, sse, tracked, transformResult */
/* harmony import */ var _getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6700);
/* harmony import */ var _codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(14256);



//#region src/unstable-core-do-not-import/error/formatter.ts
const defaultFormatter = ({ shape }) => {
	return shape;
};

//#endregion
//#region src/unstable-core-do-not-import/error/TRPCError.ts
var import_defineProperty = (0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .__toESM */ .f1)((0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .require_defineProperty */ .Vh)(), 1);
var UnknownCauseError = class extends Error {};
function getCauseFromUnknown(cause) {
	if (cause instanceof Error) return cause;
	const type = typeof cause;
	if (type === "undefined" || type === "function" || cause === null) return void 0;
	if (type !== "object") return new Error(String(cause));
	if ((0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .isObject */ .Gv)(cause)) return Object.assign(new UnknownCauseError(), cause);
	return void 0;
}
function getTRPCErrorFromUnknown(cause) {
	if (cause instanceof TRPCError) return cause;
	if (cause instanceof Error && cause.name === "TRPCError") return cause;
	const trpcError = new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		cause
	});
	if (cause instanceof Error && cause.stack) trpcError.stack = cause.stack;
	return trpcError;
}
var TRPCError = class extends Error {
	constructor(opts) {
		var _ref, _opts$message, _this$cause;
		const cause = getCauseFromUnknown(opts.cause);
		const message = (_ref = (_opts$message = opts.message) !== null && _opts$message !== void 0 ? _opts$message : cause === null || cause === void 0 ? void 0 : cause.message) !== null && _ref !== void 0 ? _ref : opts.code;
		super(message, { cause });
		(0, import_defineProperty.default)(this, "cause", void 0);
		(0, import_defineProperty.default)(this, "code", void 0);
		this.code = opts.code;
		this.name = "TRPCError";
		(_this$cause = this.cause) !== null && _this$cause !== void 0 || (this.cause = cause);
	}
};

//#endregion
//#region src/unstable-core-do-not-import/transformer.ts
var import_objectSpread2$1 = (0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .__toESM */ .f1)((0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .require_objectSpread2 */ .jr)(), 1);
/**
* @internal
*/
function getDataTransformer(transformer) {
	if ("input" in transformer) return transformer;
	return {
		input: transformer,
		output: transformer
	};
}
/**
* @internal
*/
const defaultTransformer = {
	input: {
		serialize: (obj) => obj,
		deserialize: (obj) => obj
	},
	output: {
		serialize: (obj) => obj,
		deserialize: (obj) => obj
	}
};
function transformTRPCResponseItem(config, item) {
	if ("error" in item) return (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, item), {}, { error: config.transformer.output.serialize(item.error) });
	if ("data" in item.result) return (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, item), {}, { result: (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, item.result), {}, { data: config.transformer.output.serialize(item.result.data) }) });
	return item;
}
/**
* Takes a unserialized `TRPCResponse` and serializes it with the router's transformers
**/
function transformTRPCResponse(config, itemOrItems) {
	return Array.isArray(itemOrItems) ? itemOrItems.map((item) => transformTRPCResponseItem(config, item)) : transformTRPCResponseItem(config, itemOrItems);
}
/** @internal */
function transformResultInner(response, transformer) {
	if ("error" in response) {
		const error = transformer.deserialize(response.error);
		return {
			ok: false,
			error: (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, response), {}, { error })
		};
	}
	const result = (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, response.result), (!response.result.type || response.result.type === "data") && {
		type: "data",
		data: transformer.deserialize(response.result.data)
	});
	return {
		ok: true,
		result
	};
}
var TransformResultError = class extends Error {
	constructor() {
		super("Unable to transform response from server");
	}
};
/**
* Transforms and validates that the result is a valid TRPCResponse
* @internal
*/
function transformResult(response, transformer) {
	let result;
	try {
		result = transformResultInner(response, transformer);
	} catch (_unused) {
		throw new TransformResultError();
	}
	if (!result.ok && (!isObject(result.error.error) || typeof result.error.error["code"] !== "number")) throw new TransformResultError();
	if (result.ok && !isObject(result.result)) throw new TransformResultError();
	return result;
}

//#endregion
//#region src/unstable-core-do-not-import/router.ts
var import_objectSpread2 = (0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .__toESM */ .f1)((0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .require_objectSpread2 */ .jr)(), 1);
/**
* @internal
*/
const lazyMarker = "lazyMarker";
function once(fn) {
	const uncalled = Symbol();
	let result = uncalled;
	return () => {
		if (result === uncalled) result = fn();
		return result;
	};
}
/**
* Lazy load a router
* @see https://trpc.io/docs/server/merging-routers#lazy-load
*/
function lazy(importRouter) {
	async function resolve() {
		const mod = await importRouter();
		if (isRouter(mod)) return mod;
		const routers = Object.values(mod);
		if (routers.length !== 1 || !isRouter(routers[0])) throw new Error("Invalid router module - either define exactly 1 export or return the router directly.\nExample: `lazy(() => import('./slow.js').then((m) => m.slowRouter))`");
		return routers[0];
	}
	resolve[lazyMarker] = true;
	return resolve;
}
function isLazy(input) {
	return typeof input === "function" && lazyMarker in input;
}
function isRouter(value) {
	return (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .isObject */ .Gv)(value) && (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .isObject */ .Gv)(value["_def"]) && "router" in value["_def"];
}
const emptyRouter = {
	_ctx: null,
	_errorShape: null,
	_meta: null,
	queries: {},
	mutations: {},
	subscriptions: {},
	errorFormatter: defaultFormatter,
	transformer: defaultTransformer
};
/**
* Reserved words that can't be used as router or procedure names
*/
const reservedWords = [
	"then",
	"call",
	"apply"
];
/**
* @internal
*/
function createRouterFactory(config) {
	function createRouterInner(input) {
		const reservedWordsUsed = new Set(Object.keys(input).filter((v) => reservedWords.includes(v)));
		if (reservedWordsUsed.size > 0) throw new Error("Reserved words used in `router({})` call: " + Array.from(reservedWordsUsed).join(", "));
		const procedures = (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .emptyObject */ .vB)();
		const lazy$1 = (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .emptyObject */ .vB)();
		function createLazyLoader(opts) {
			return {
				ref: opts.ref,
				load: once(async () => {
					const router$1 = await opts.ref();
					const lazyPath = [...opts.path, opts.key];
					const lazyKey = lazyPath.join(".");
					opts.aggregate[opts.key] = step(router$1._def.record, lazyPath);
					delete lazy$1[lazyKey];
					for (const [nestedKey, nestedItem] of Object.entries(router$1._def.lazy)) {
						const nestedRouterKey = [...lazyPath, nestedKey].join(".");
						lazy$1[nestedRouterKey] = createLazyLoader({
							ref: nestedItem.ref,
							path: lazyPath,
							key: nestedKey,
							aggregate: opts.aggregate[opts.key]
						});
					}
				})
			};
		}
		function step(from, path = []) {
			const aggregate = (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .emptyObject */ .vB)();
			for (const [key, item] of Object.entries(from !== null && from !== void 0 ? from : {})) {
				if (isLazy(item)) {
					lazy$1[[...path, key].join(".")] = createLazyLoader({
						path,
						ref: item,
						key,
						aggregate
					});
					continue;
				}
				if (isRouter(item)) {
					aggregate[key] = step(item._def.record, [...path, key]);
					continue;
				}
				if (!isProcedure(item)) {
					aggregate[key] = step(item, [...path, key]);
					continue;
				}
				const newPath = [...path, key].join(".");
				if (procedures[newPath]) throw new Error(`Duplicate key: ${newPath}`);
				procedures[newPath] = item;
				aggregate[key] = item;
			}
			return aggregate;
		}
		const record = step(input);
		const _def = (0, import_objectSpread2.default)((0, import_objectSpread2.default)({
			_config: config,
			router: true,
			procedures,
			lazy: lazy$1
		}, emptyRouter), {}, { record });
		const router = (0, import_objectSpread2.default)((0, import_objectSpread2.default)({}, record), {}, {
			_def,
			createCaller: createCallerFactory()({ _def })
		});
		return router;
	}
	return createRouterInner;
}
function isProcedure(procedureOrRouter) {
	return typeof procedureOrRouter === "function";
}
/**
* @internal
*/
async function getProcedureAtPath(router, path) {
	const { _def } = router;
	let procedure = _def.procedures[path];
	while (!procedure) {
		const key = Object.keys(_def.lazy).find((key$1) => path.startsWith(key$1));
		if (!key) return null;
		const lazyRouter = _def.lazy[key];
		await lazyRouter.load();
		procedure = _def.procedures[path];
	}
	return procedure;
}
/**
* @internal
*/
async function callProcedure(opts) {
	const { type, path } = opts;
	const proc = await getProcedureAtPath(opts.router, path);
	if (!proc || !isProcedure(proc) || proc._def.type !== type && !opts.allowMethodOverride) throw new TRPCError({
		code: "NOT_FOUND",
		message: `No "${type}"-procedure on path "${path}"`
	});
	/* istanbul ignore if -- @preserve */
	if (proc._def.type !== type && opts.allowMethodOverride && proc._def.type === "subscription") throw new TRPCError({
		code: "METHOD_NOT_SUPPORTED",
		message: `Method override is not supported for subscriptions`
	});
	return proc(opts);
}
function createCallerFactory() {
	return function createCallerInner(router) {
		const { _def } = router;
		return function createCaller(ctxOrCallback, opts) {
			return (0,_getErrorShape_vC8mUXJD_mjs__WEBPACK_IMPORTED_MODULE_0__/* .createRecursiveProxy */ .vX)(async (innerOpts) => {
				const { path, args } = innerOpts;
				const fullPath = path.join(".");
				if (path.length === 1 && path[0] === "_def") return _def;
				const procedure = await getProcedureAtPath(router, fullPath);
				let ctx = void 0;
				try {
					if (!procedure) throw new TRPCError({
						code: "NOT_FOUND",
						message: `No procedure found on path "${path}"`
					});
					ctx = (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .isFunction */ .Tn)(ctxOrCallback) ? await Promise.resolve(ctxOrCallback()) : ctxOrCallback;
					return await procedure({
						path: fullPath,
						getRawInput: async () => args[0],
						ctx,
						type: procedure._def.type,
						signal: opts === null || opts === void 0 ? void 0 : opts.signal,
						batchIndex: 0
					});
				} catch (cause) {
					var _opts$onError, _procedure$_def$type;
					opts === null || opts === void 0 || (_opts$onError = opts.onError) === null || _opts$onError === void 0 || _opts$onError.call(opts, {
						ctx,
						error: getTRPCErrorFromUnknown(cause),
						input: args[0],
						path: fullPath,
						type: (_procedure$_def$type = procedure === null || procedure === void 0 ? void 0 : procedure._def.type) !== null && _procedure$_def$type !== void 0 ? _procedure$_def$type : "unknown"
					});
					throw cause;
				}
			});
		};
	};
}
function mergeRouters(...routerList) {
	var _routerList$, _routerList$2;
	const record = (0,_codes_DagpWZLc_mjs__WEBPACK_IMPORTED_MODULE_1__/* .mergeWithoutOverrides */ .uf)({}, ...routerList.map((r) => r._def.record));
	const errorFormatter = routerList.reduce((currentErrorFormatter, nextRouter) => {
		if (nextRouter._def._config.errorFormatter && nextRouter._def._config.errorFormatter !== defaultFormatter) {
			if (currentErrorFormatter !== defaultFormatter && currentErrorFormatter !== nextRouter._def._config.errorFormatter) throw new Error("You seem to have several error formatters");
			return nextRouter._def._config.errorFormatter;
		}
		return currentErrorFormatter;
	}, defaultFormatter);
	const transformer = routerList.reduce((prev, current) => {
		if (current._def._config.transformer && current._def._config.transformer !== defaultTransformer) {
			if (prev !== defaultTransformer && prev !== current._def._config.transformer) throw new Error("You seem to have several transformers");
			return current._def._config.transformer;
		}
		return prev;
	}, defaultTransformer);
	const router = createRouterFactory({
		errorFormatter,
		transformer,
		isDev: routerList.every((r) => r._def._config.isDev),
		allowOutsideOfServer: routerList.every((r) => r._def._config.allowOutsideOfServer),
		isServer: routerList.every((r) => r._def._config.isServer),
		$types: (_routerList$ = routerList[0]) === null || _routerList$ === void 0 ? void 0 : _routerList$._def._config.$types,
		sse: (_routerList$2 = routerList[0]) === null || _routerList$2 === void 0 ? void 0 : _routerList$2._def._config.sse
	})(record);
	return router;
}

//#endregion
//#region src/unstable-core-do-not-import/stream/tracked.ts
const trackedSymbol = Symbol();
/**
* Produce a typed server-sent event message
* @deprecated use `tracked(id, data)` instead
*/
function sse(event) {
	return tracked(event.id, event.data);
}
function isTrackedEnvelope(value) {
	return Array.isArray(value) && value[2] === trackedSymbol;
}
/**
* Automatically track an event so that it can be resumed from a given id if the connection is lost
*/
function tracked(id, data) {
	if (id === "") throw new Error("`id` must not be an empty string as empty string is the same as not setting the id at all");
	return [
		id,
		data,
		trackedSymbol
	];
}

//#endregion

//# sourceMappingURL=tracked-Bjtgv3wJ.mjs.map

/***/ })

};

//# sourceMappingURL=485.index.js.map