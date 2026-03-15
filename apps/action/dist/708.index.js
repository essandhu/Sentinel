export const id = 708;
export const ids = [708];
export const modules = {

/***/ 94708:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  fastifyTRPCPlugin: () => (/* binding */ fastifyTRPCPlugin)
});

// UNUSED EXPORTS: fastifyRequestHandler

// EXTERNAL MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/getErrorShape-vC8mUXJD.mjs
var getErrorShape_vC8mUXJD = __webpack_require__(6700);
// EXTERNAL MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/codes-DagpWZLc.mjs
var codes_DagpWZLc = __webpack_require__(14256);
// EXTERNAL MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/tracked-Bjtgv3wJ.mjs
var tracked_Bjtgv3wJ = __webpack_require__(52485);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/observable-UMO3vUa_.mjs
//#region src/observable/observable.ts
/** @public */
function isObservable(x) {
	return typeof x === "object" && x !== null && "subscribe" in x;
}
/** @public */
function observable(subscribe) {
	const self = {
		subscribe(observer) {
			let teardownRef = null;
			let isDone = false;
			let unsubscribed = false;
			let teardownImmediately = false;
			function unsubscribe() {
				if (teardownRef === null) {
					teardownImmediately = true;
					return;
				}
				if (unsubscribed) return;
				unsubscribed = true;
				if (typeof teardownRef === "function") teardownRef();
				else if (teardownRef) teardownRef.unsubscribe();
			}
			teardownRef = subscribe({
				next(value) {
					var _observer$next;
					if (isDone) return;
					(_observer$next = observer.next) === null || _observer$next === void 0 || _observer$next.call(observer, value);
				},
				error(err) {
					var _observer$error;
					if (isDone) return;
					isDone = true;
					(_observer$error = observer.error) === null || _observer$error === void 0 || _observer$error.call(observer, err);
					unsubscribe();
				},
				complete() {
					var _observer$complete;
					if (isDone) return;
					isDone = true;
					(_observer$complete = observer.complete) === null || _observer$complete === void 0 || _observer$complete.call(observer);
					unsubscribe();
				}
			});
			if (teardownImmediately) unsubscribe();
			return { unsubscribe };
		},
		pipe(...operations) {
			return operations.reduce(pipeReducer, self);
		}
	};
	return self;
}
function pipeReducer(prev, fn) {
	return fn(prev);
}
/** @internal */
function observableToPromise(observable$1) {
	const ac = new AbortController();
	const promise = new Promise((resolve, reject) => {
		let isDone = false;
		function onDone() {
			if (isDone) return;
			isDone = true;
			obs$.unsubscribe();
		}
		ac.signal.addEventListener("abort", () => {
			reject(ac.signal.reason);
		});
		const obs$ = observable$1.subscribe({
			next(data) {
				isDone = true;
				resolve(data);
				onDone();
			},
			error(data) {
				reject(data);
			},
			complete() {
				ac.abort();
				onDone();
			}
		});
	});
	return promise;
}
/**
* @internal
*/
function observableToReadableStream(observable$1, signal) {
	let unsub = null;
	const onAbort = () => {
		unsub === null || unsub === void 0 || unsub.unsubscribe();
		unsub = null;
		signal.removeEventListener("abort", onAbort);
	};
	return new ReadableStream({
		start(controller) {
			unsub = observable$1.subscribe({
				next(data) {
					controller.enqueue({
						ok: true,
						value: data
					});
				},
				error(error) {
					controller.enqueue({
						ok: false,
						error
					});
					controller.close();
				},
				complete() {
					controller.close();
				}
			});
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
		},
		cancel() {
			onAbort();
		}
	});
}
/** @internal */
function observableToAsyncIterable(observable$1, signal) {
	const stream = observableToReadableStream(observable$1, signal);
	const reader = stream.getReader();
	const iterator = {
		async next() {
			const value = await reader.read();
			if (value.done) return {
				value: void 0,
				done: true
			};
			const { value: result } = value;
			if (!result.ok) throw result.error;
			return {
				value: result.value,
				done: false
			};
		},
		async return() {
			await reader.cancel();
			return {
				value: void 0,
				done: true
			};
		}
	};
	return { [Symbol.asyncIterator]() {
		return iterator;
	} };
}

//#endregion

//# sourceMappingURL=observable-UMO3vUa_.mjs.map
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/resolveResponse-BVDlNZwN.mjs





//#region src/unstable-core-do-not-import/http/parseConnectionParams.ts
function parseConnectionParamsFromUnknown(parsed) {
	try {
		if (parsed === null) return null;
		if (!(0,codes_DagpWZLc/* isObject */.Gv)(parsed)) throw new Error("Expected object");
		const nonStringValues = Object.entries(parsed).filter(([_key, value]) => typeof value !== "string");
		if (nonStringValues.length > 0) throw new Error(`Expected connectionParams to be string values. Got ${nonStringValues.map(([key, value]) => `${key}: ${typeof value}`).join(", ")}`);
		return parsed;
	} catch (cause) {
		throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "PARSE_ERROR",
			message: "Invalid connection params shape",
			cause
		});
	}
}
function parseConnectionParamsFromString(str) {
	let parsed;
	try {
		parsed = JSON.parse(str);
	} catch (cause) {
		throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "PARSE_ERROR",
			message: "Not JSON-parsable query params",
			cause
		});
	}
	return parseConnectionParamsFromUnknown(parsed);
}

//#endregion
//#region src/unstable-core-do-not-import/http/contentType.ts
var import_objectSpread2$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
/**
* Memoize a function that takes no arguments
* @internal
*/
function memo(fn) {
	let promise = null;
	const sym = Symbol.for("@trpc/server/http/memo");
	let value = sym;
	return {
		read: async () => {
			var _promise;
			if (value !== sym) return value;
			(_promise = promise) !== null && _promise !== void 0 || (promise = fn().catch((cause) => {
				if (cause instanceof tracked_Bjtgv3wJ/* TRPCError */.gt) throw cause;
				throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
					code: "BAD_REQUEST",
					message: cause instanceof Error ? cause.message : "Invalid input",
					cause
				});
			}));
			value = await promise;
			promise = null;
			return value;
		},
		result: () => {
			return value !== sym ? value : void 0;
		}
	};
}
const jsonContentTypeHandler = {
	isMatch(req) {
		var _req$headers$get;
		return !!((_req$headers$get = req.headers.get("content-type")) === null || _req$headers$get === void 0 ? void 0 : _req$headers$get.startsWith("application/json"));
	},
	async parse(opts) {
		var _types$values$next$va;
		const { req } = opts;
		const isBatchCall = opts.searchParams.get("batch") === "1";
		const paths = isBatchCall ? opts.path.split(",") : [opts.path];
		const getInputs = memo(async () => {
			let inputs = void 0;
			if (req.method === "GET") {
				const queryInput = opts.searchParams.get("input");
				if (queryInput) inputs = JSON.parse(queryInput);
			} else inputs = await req.json();
			if (inputs === void 0) return (0,codes_DagpWZLc/* emptyObject */.vB)();
			if (!isBatchCall) {
				const result = (0,codes_DagpWZLc/* emptyObject */.vB)();
				result[0] = opts.router._def._config.transformer.input.deserialize(inputs);
				return result;
			}
			if (!(0,codes_DagpWZLc/* isObject */.Gv)(inputs)) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
				code: "BAD_REQUEST",
				message: "\"input\" needs to be an object when doing a batch call"
			});
			const acc = (0,codes_DagpWZLc/* emptyObject */.vB)();
			for (const index of paths.keys()) {
				const input = inputs[index];
				if (input !== void 0) acc[index] = opts.router._def._config.transformer.input.deserialize(input);
			}
			return acc;
		});
		const calls = await Promise.all(paths.map(async (path, index) => {
			const procedure = await (0,tracked_Bjtgv3wJ/* getProcedureAtPath */.Iw)(opts.router, path);
			return {
				batchIndex: index,
				path,
				procedure,
				getRawInput: async () => {
					const inputs = await getInputs.read();
					let input = inputs[index];
					if ((procedure === null || procedure === void 0 ? void 0 : procedure._def.type) === "subscription") {
						var _ref, _opts$headers$get;
						const lastEventId = (_ref = (_opts$headers$get = opts.headers.get("last-event-id")) !== null && _opts$headers$get !== void 0 ? _opts$headers$get : opts.searchParams.get("lastEventId")) !== null && _ref !== void 0 ? _ref : opts.searchParams.get("Last-Event-Id");
						if (lastEventId) if ((0,codes_DagpWZLc/* isObject */.Gv)(input)) input = (0, import_objectSpread2$1.default)((0, import_objectSpread2$1.default)({}, input), {}, { lastEventId });
						else {
							var _input;
							(_input = input) !== null && _input !== void 0 || (input = { lastEventId });
						}
					}
					return input;
				},
				result: () => {
					var _getInputs$result;
					return (_getInputs$result = getInputs.result()) === null || _getInputs$result === void 0 ? void 0 : _getInputs$result[index];
				}
			};
		}));
		const types = new Set(calls.map((call) => {
			var _call$procedure;
			return (_call$procedure = call.procedure) === null || _call$procedure === void 0 ? void 0 : _call$procedure._def.type;
		}).filter(Boolean));
		/* istanbul ignore if -- @preserve */
		if (types.size > 1) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "BAD_REQUEST",
			message: `Cannot mix procedure types in call: ${Array.from(types).join(", ")}`
		});
		const type = (_types$values$next$va = types.values().next().value) !== null && _types$values$next$va !== void 0 ? _types$values$next$va : "unknown";
		const connectionParamsStr = opts.searchParams.get("connectionParams");
		const info = {
			isBatchCall,
			accept: req.headers.get("trpc-accept"),
			calls,
			type,
			connectionParams: connectionParamsStr === null ? null : parseConnectionParamsFromString(connectionParamsStr),
			signal: req.signal,
			url: opts.url
		};
		return info;
	}
};
const formDataContentTypeHandler = {
	isMatch(req) {
		var _req$headers$get2;
		return !!((_req$headers$get2 = req.headers.get("content-type")) === null || _req$headers$get2 === void 0 ? void 0 : _req$headers$get2.startsWith("multipart/form-data"));
	},
	async parse(opts) {
		const { req } = opts;
		if (req.method !== "POST") throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "METHOD_NOT_SUPPORTED",
			message: "Only POST requests are supported for multipart/form-data requests"
		});
		const getInputs = memo(async () => {
			const fd = await req.formData();
			return fd;
		});
		const procedure = await (0,tracked_Bjtgv3wJ/* getProcedureAtPath */.Iw)(opts.router, opts.path);
		return {
			accept: null,
			calls: [{
				batchIndex: 0,
				path: opts.path,
				getRawInput: getInputs.read,
				result: getInputs.result,
				procedure
			}],
			isBatchCall: false,
			type: "mutation",
			connectionParams: null,
			signal: req.signal,
			url: opts.url
		};
	}
};
const octetStreamContentTypeHandler = {
	isMatch(req) {
		var _req$headers$get3;
		return !!((_req$headers$get3 = req.headers.get("content-type")) === null || _req$headers$get3 === void 0 ? void 0 : _req$headers$get3.startsWith("application/octet-stream"));
	},
	async parse(opts) {
		const { req } = opts;
		if (req.method !== "POST") throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "METHOD_NOT_SUPPORTED",
			message: "Only POST requests are supported for application/octet-stream requests"
		});
		const getInputs = memo(async () => {
			return req.body;
		});
		return {
			calls: [{
				batchIndex: 0,
				path: opts.path,
				getRawInput: getInputs.read,
				result: getInputs.result,
				procedure: await (0,tracked_Bjtgv3wJ/* getProcedureAtPath */.Iw)(opts.router, opts.path)
			}],
			isBatchCall: false,
			accept: null,
			type: "mutation",
			connectionParams: null,
			signal: req.signal,
			url: opts.url
		};
	}
};
const handlers = [
	jsonContentTypeHandler,
	formDataContentTypeHandler,
	octetStreamContentTypeHandler
];
function getContentTypeHandler(req) {
	const handler = handlers.find((handler$1) => handler$1.isMatch(req));
	if (handler) return handler;
	if (!handler && req.method === "GET") return jsonContentTypeHandler;
	throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
		code: "UNSUPPORTED_MEDIA_TYPE",
		message: req.headers.has("content-type") ? `Unsupported content-type "${req.headers.get("content-type")}` : "Missing content-type header"
	});
}
async function getRequestInfo(opts) {
	const handler = getContentTypeHandler(opts.req);
	return await handler.parse(opts);
}

//#endregion
//#region src/unstable-core-do-not-import/http/abortError.ts
function resolveResponse_BVDlNZwN_isAbortError(error) {
	return (0,codes_DagpWZLc/* isObject */.Gv)(error) && error["name"] === "AbortError";
}
function throwAbortError(message = "AbortError") {
	throw new DOMException(message, "AbortError");
}

//#endregion
//#region src/vendor/is-plain-object.ts
/*!
* is-plain-object <https://github.com/jonschlinkert/is-plain-object>
*
* Copyright (c) 2014-2017, Jon Schlinkert.
* Released under the MIT License.
*/
function isObject$1(o) {
	return Object.prototype.toString.call(o) === "[object Object]";
}
function isPlainObject(o) {
	var ctor, prot;
	if (isObject$1(o) === false) return false;
	ctor = o.constructor;
	if (ctor === void 0) return true;
	prot = ctor.prototype;
	if (isObject$1(prot) === false) return false;
	if (prot.hasOwnProperty("isPrototypeOf") === false) return false;
	return true;
}

//#endregion
//#region src/vendor/unpromise/unpromise.ts
var import_defineProperty = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_defineProperty */.Vh)(), 1);
let _Symbol$toStringTag;
/** Memory safe (weakmapped) cache of the ProxyPromise for each Promise,
* which is retained for the lifetime of the original Promise.
*/
const subscribableCache = /* @__PURE__ */ new WeakMap();
/** A NOOP function allowing a consistent interface for settled
* SubscribedPromises (settled promises are not subscribed - they resolve
* immediately). */
const NOOP = () => {};
_Symbol$toStringTag = Symbol.toStringTag;
/**
* Every `Promise<T>` can be shadowed by a single `ProxyPromise<T>`. It is
* created once, cached and reused throughout the lifetime of the Promise. Get a
* Promise's ProxyPromise using `Unpromise.proxy(promise)`.
*
* The `ProxyPromise<T>` attaches handlers to the original `Promise<T>`
* `.then()` and `.catch()` just once. Promises derived from it use a
* subscription- (and unsubscription-) based mechanism that monitors these
* handlers.
*
* Every time you call `.subscribe()`, `.then()` `.catch()` or `.finally()` on a
* `ProxyPromise<T>` it returns a `SubscribedPromise<T>` having an additional
* `unsubscribe()` method. Calling `unsubscribe()` detaches reference chains
* from the original, potentially long-lived Promise, eliminating memory leaks.
*
* This approach can eliminate the memory leaks that otherwise come about from
* repeated `race()` or `any()` calls invoking `.then()` and `.catch()` multiple
* times on the same long-lived native Promise (subscriptions which can never be
* cleaned up).
*
* `Unpromise.race(promises)` is a reference implementation of `Promise.race`
* avoiding memory leaks when using long-lived unsettled Promises.
*
* `Unpromise.any(promises)` is a reference implementation of `Promise.any`
* avoiding memory leaks when using long-lived unsettled Promises.
*
* `Unpromise.resolve(promise)` returns an ephemeral `SubscribedPromise<T>` for
* any given `Promise<T>` facilitating arbitrary async/await patterns. Behind
* the scenes, `resolve` is implemented simply as
* `Unpromise.proxy(promise).subscribe()`. Don't forget to call `.unsubscribe()`
* to tidy up!
*
*/
var Unpromise = class Unpromise {
	constructor(arg) {
		(0, import_defineProperty.default)(this, "promise", void 0);
		(0, import_defineProperty.default)(this, "subscribers", []);
		(0, import_defineProperty.default)(this, "settlement", null);
		(0, import_defineProperty.default)(this, _Symbol$toStringTag, "Unpromise");
		if (typeof arg === "function") this.promise = new Promise(arg);
		else this.promise = arg;
		const thenReturn = this.promise.then((value) => {
			const { subscribers } = this;
			this.subscribers = null;
			this.settlement = {
				status: "fulfilled",
				value
			};
			subscribers === null || subscribers === void 0 || subscribers.forEach(({ resolve }) => {
				resolve(value);
			});
		});
		if ("catch" in thenReturn) thenReturn.catch((reason) => {
			const { subscribers } = this;
			this.subscribers = null;
			this.settlement = {
				status: "rejected",
				reason
			};
			subscribers === null || subscribers === void 0 || subscribers.forEach(({ reject }) => {
				reject(reason);
			});
		});
	}
	/** Create a promise that mitigates uncontrolled subscription to a long-lived
	* Promise via .then() and .catch() - otherwise a source of memory leaks.
	*
	* The returned promise has an `unsubscribe()` method which can be called when
	* the Promise is no longer being tracked by application logic, and which
	* ensures that there is no reference chain from the original promise to the
	* new one, and therefore no memory leak.
	*
	* If original promise has not yet settled, this adds a new unique promise
	* that listens to then/catch events, along with an `unsubscribe()` method to
	* detach it.
	*
	* If original promise has settled, then creates a new Promise.resolve() or
	* Promise.reject() and provided unsubscribe is a noop.
	*
	* If you call `unsubscribe()` before the returned Promise has settled, it
	* will never settle.
	*/
	subscribe() {
		let promise;
		let unsubscribe;
		const { settlement } = this;
		if (settlement === null) {
			if (this.subscribers === null) throw new Error("Unpromise settled but still has subscribers");
			const subscriber = withResolvers();
			this.subscribers = listWithMember(this.subscribers, subscriber);
			promise = subscriber.promise;
			unsubscribe = () => {
				if (this.subscribers !== null) this.subscribers = listWithoutMember(this.subscribers, subscriber);
			};
		} else {
			const { status } = settlement;
			if (status === "fulfilled") promise = Promise.resolve(settlement.value);
			else promise = Promise.reject(settlement.reason);
			unsubscribe = NOOP;
		}
		return Object.assign(promise, { unsubscribe });
	}
	/** STANDARD PROMISE METHODS (but returning a SubscribedPromise) */
	then(onfulfilled, onrejected) {
		const subscribed = this.subscribe();
		const { unsubscribe } = subscribed;
		return Object.assign(subscribed.then(onfulfilled, onrejected), { unsubscribe });
	}
	catch(onrejected) {
		const subscribed = this.subscribe();
		const { unsubscribe } = subscribed;
		return Object.assign(subscribed.catch(onrejected), { unsubscribe });
	}
	finally(onfinally) {
		const subscribed = this.subscribe();
		const { unsubscribe } = subscribed;
		return Object.assign(subscribed.finally(onfinally), { unsubscribe });
	}
	/** Unpromise STATIC METHODS */
	/** Create or Retrieve the proxy Unpromise (a re-used Unpromise for the VM lifetime
	* of the provided Promise reference) */
	static proxy(promise) {
		const cached = Unpromise.getSubscribablePromise(promise);
		return typeof cached !== "undefined" ? cached : Unpromise.createSubscribablePromise(promise);
	}
	/** Create and store an Unpromise keyed by an original Promise. */
	static createSubscribablePromise(promise) {
		const created = new Unpromise(promise);
		subscribableCache.set(promise, created);
		subscribableCache.set(created, created);
		return created;
	}
	/** Retrieve a previously-created Unpromise keyed by an original Promise. */
	static getSubscribablePromise(promise) {
		return subscribableCache.get(promise);
	}
	/** Promise STATIC METHODS */
	/** Lookup the Unpromise for this promise, and derive a SubscribedPromise from
	* it (that can be later unsubscribed to eliminate Memory leaks) */
	static resolve(value) {
		const promise = typeof value === "object" && value !== null && "then" in value && typeof value.then === "function" ? value : Promise.resolve(value);
		return Unpromise.proxy(promise).subscribe();
	}
	static async any(values) {
		const valuesArray = Array.isArray(values) ? values : [...values];
		const subscribedPromises = valuesArray.map(Unpromise.resolve);
		try {
			return await Promise.any(subscribedPromises);
		} finally {
			subscribedPromises.forEach(({ unsubscribe }) => {
				unsubscribe();
			});
		}
	}
	static async race(values) {
		const valuesArray = Array.isArray(values) ? values : [...values];
		const subscribedPromises = valuesArray.map(Unpromise.resolve);
		try {
			return await Promise.race(subscribedPromises);
		} finally {
			subscribedPromises.forEach(({ unsubscribe }) => {
				unsubscribe();
			});
		}
	}
	/** Create a race of SubscribedPromises that will fulfil to a single winning
	* Promise (in a 1-Tuple). Eliminates memory leaks from long-lived promises
	* accumulating .then() and .catch() subscribers. Allows simple logic to
	* consume the result, like...
	* ```ts
	* const [ winner ] = await Unpromise.race([ promiseA, promiseB ]);
	* if(winner === promiseB){
	*   const result = await promiseB;
	*   // do the thing
	* }
	* ```
	* */
	static async raceReferences(promises) {
		const selfPromises = promises.map(resolveSelfTuple);
		try {
			return await Promise.race(selfPromises);
		} finally {
			for (const promise of selfPromises) promise.unsubscribe();
		}
	}
};
/** Promises a 1-tuple containing the original promise when it resolves. Allows
* awaiting the eventual Promise ***reference*** (easy to destructure and
* exactly compare with ===). Avoids resolving to the Promise ***value*** (which
* may be ambiguous and therefore hard to identify as the winner of a race).
* You can call unsubscribe on the Promise to mitigate memory leaks.
* */
function resolveSelfTuple(promise) {
	return Unpromise.proxy(promise).then(() => [promise]);
}
/** VENDORED (Future) PROMISE UTILITIES */
/** Reference implementation of https://github.com/tc39/proposal-promise-with-resolvers */
function withResolvers() {
	let resolve;
	let reject;
	const promise = new Promise((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});
	return {
		promise,
		resolve,
		reject
	};
}
/** IMMUTABLE LIST OPERATIONS */
function listWithMember(arr, member) {
	return [...arr, member];
}
function listWithoutIndex(arr, index) {
	return [...arr.slice(0, index), ...arr.slice(index + 1)];
}
function listWithoutMember(arr, member) {
	const index = arr.indexOf(member);
	if (index !== -1) return listWithoutIndex(arr, index);
	return arr;
}

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/disposable.ts
var _Symbol, _Symbol$dispose, _Symbol2, _Symbol2$asyncDispose;
(_Symbol$dispose = (_Symbol = Symbol).dispose) !== null && _Symbol$dispose !== void 0 || (_Symbol.dispose = Symbol());
(_Symbol2$asyncDispose = (_Symbol2 = Symbol).asyncDispose) !== null && _Symbol2$asyncDispose !== void 0 || (_Symbol2.asyncDispose = Symbol());
/**
* Takes a value and a dispose function and returns a new object that implements the Disposable interface.
* The returned object is the original value augmented with a Symbol.dispose method.
* @param thing The value to make disposable
* @param dispose Function to call when disposing the resource
* @returns The original value with Symbol.dispose method added
*/
function makeResource(thing, dispose) {
	const it = thing;
	const existing = it[Symbol.dispose];
	it[Symbol.dispose] = () => {
		dispose();
		existing === null || existing === void 0 || existing();
	};
	return it;
}
/**
* Takes a value and an async dispose function and returns a new object that implements the AsyncDisposable interface.
* The returned object is the original value augmented with a Symbol.asyncDispose method.
* @param thing The value to make async disposable
* @param dispose Async function to call when disposing the resource
* @returns The original value with Symbol.asyncDispose method added
*/
function makeAsyncResource(thing, dispose) {
	const it = thing;
	const existing = it[Symbol.asyncDispose];
	it[Symbol.asyncDispose] = async () => {
		await dispose();
		await (existing === null || existing === void 0 ? void 0 : existing());
	};
	return it;
}

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/timerResource.ts
const disposablePromiseTimerResult = Symbol();
function timerResource(ms) {
	let timer = null;
	return makeResource({ start() {
		if (timer) throw new Error("Timer already started");
		const promise = new Promise((resolve) => {
			timer = setTimeout(() => resolve(disposablePromiseTimerResult), ms);
		});
		return promise;
	} }, () => {
		if (timer) clearTimeout(timer);
	});
}

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/usingCtx.js
var require_usingCtx = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/usingCtx.js"(exports, module) {
	function _usingCtx() {
		var r = "function" == typeof SuppressedError ? SuppressedError : function(r$1, e$1) {
			var n$1 = Error();
			return n$1.name = "SuppressedError", n$1.error = r$1, n$1.suppressed = e$1, n$1;
		}, e = {}, n = [];
		function using(r$1, e$1) {
			if (null != e$1) {
				if (Object(e$1) !== e$1) throw new TypeError("using declarations can only be used with objects, functions, null, or undefined.");
				if (r$1) var o = e$1[Symbol.asyncDispose || Symbol["for"]("Symbol.asyncDispose")];
				if (void 0 === o && (o = e$1[Symbol.dispose || Symbol["for"]("Symbol.dispose")], r$1)) var t = o;
				if ("function" != typeof o) throw new TypeError("Object is not disposable.");
				t && (o = function o$1() {
					try {
						t.call(e$1);
					} catch (r$2) {
						return Promise.reject(r$2);
					}
				}), n.push({
					v: e$1,
					d: o,
					a: r$1
				});
			} else r$1 && n.push({
				d: e$1,
				a: r$1
			});
			return e$1;
		}
		return {
			e,
			u: using.bind(null, !1),
			a: using.bind(null, !0),
			d: function d() {
				var o, t = this.e, s = 0;
				function next() {
					for (; o = n.pop();) try {
						if (!o.a && 1 === s) return s = 0, n.push(o), Promise.resolve().then(next);
						if (o.d) {
							var r$1 = o.d.call(o.v);
							if (o.a) return s |= 2, Promise.resolve(r$1).then(next, err);
						} else s |= 1;
					} catch (r$2) {
						return err(r$2);
					}
					if (1 === s) return t !== e ? Promise.reject(t) : Promise.resolve();
					if (t !== e) throw t;
				}
				function err(n$1) {
					return t = t !== e ? new r(n$1, t) : n$1, next();
				}
				return next();
			}
		};
	}
	module.exports = _usingCtx, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/OverloadYield.js
var require_OverloadYield = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/OverloadYield.js"(exports, module) {
	function _OverloadYield(e, d) {
		this.v = e, this.k = d;
	}
	module.exports = _OverloadYield, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/awaitAsyncGenerator.js
var require_awaitAsyncGenerator = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/awaitAsyncGenerator.js"(exports, module) {
	var OverloadYield$2 = require_OverloadYield();
	function _awaitAsyncGenerator$5(e) {
		return new OverloadYield$2(e, 0);
	}
	module.exports = _awaitAsyncGenerator$5, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/wrapAsyncGenerator.js
var require_wrapAsyncGenerator = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/wrapAsyncGenerator.js"(exports, module) {
	var OverloadYield$1 = require_OverloadYield();
	function _wrapAsyncGenerator$6(e) {
		return function() {
			return new AsyncGenerator(e.apply(this, arguments));
		};
	}
	function AsyncGenerator(e) {
		var r, t;
		function resume(r$1, t$1) {
			try {
				var n = e[r$1](t$1), o = n.value, u = o instanceof OverloadYield$1;
				Promise.resolve(u ? o.v : o).then(function(t$2) {
					if (u) {
						var i = "return" === r$1 ? "return" : "next";
						if (!o.k || t$2.done) return resume(i, t$2);
						t$2 = e[i](t$2).value;
					}
					settle(n.done ? "return" : "normal", t$2);
				}, function(e$1) {
					resume("throw", e$1);
				});
			} catch (e$1) {
				settle("throw", e$1);
			}
		}
		function settle(e$1, n) {
			switch (e$1) {
				case "return":
					r.resolve({
						value: n,
						done: !0
					});
					break;
				case "throw":
					r.reject(n);
					break;
				default: r.resolve({
					value: n,
					done: !1
				});
			}
			(r = r.next) ? resume(r.key, r.arg) : t = null;
		}
		this._invoke = function(e$1, n) {
			return new Promise(function(o, u) {
				var i = {
					key: e$1,
					arg: n,
					resolve: o,
					reject: u,
					next: null
				};
				t ? t = t.next = i : (r = t = i, resume(e$1, n));
			});
		}, "function" != typeof e["return"] && (this["return"] = void 0);
	}
	AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
		return this;
	}, AsyncGenerator.prototype.next = function(e) {
		return this._invoke("next", e);
	}, AsyncGenerator.prototype["throw"] = function(e) {
		return this._invoke("throw", e);
	}, AsyncGenerator.prototype["return"] = function(e) {
		return this._invoke("return", e);
	};
	module.exports = _wrapAsyncGenerator$6, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/asyncIterable.ts
var import_usingCtx$4 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_usingCtx(), 1);
var import_awaitAsyncGenerator$4 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_awaitAsyncGenerator(), 1);
var import_wrapAsyncGenerator$5 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_wrapAsyncGenerator(), 1);
function iteratorResource(iterable) {
	const iterator = iterable[Symbol.asyncIterator]();
	if (iterator[Symbol.asyncDispose]) return iterator;
	return makeAsyncResource(iterator, async () => {
		var _iterator$return;
		await ((_iterator$return = iterator.return) === null || _iterator$return === void 0 ? void 0 : _iterator$return.call(iterator));
	});
}
/**
* Derives a new {@link AsyncGenerator} based of {@link iterable}, that yields its first
* {@link count} values. Then, a grace period of {@link gracePeriodMs} is started in which further
* values may still come through. After this period, the generator aborts.
*/
function takeWithGrace(_x, _x2) {
	return _takeWithGrace.apply(this, arguments);
}
function _takeWithGrace() {
	_takeWithGrace = (0, import_wrapAsyncGenerator$5.default)(function* (iterable, opts) {
		try {
			var _usingCtx$1 = (0, import_usingCtx$4.default)();
			const iterator = _usingCtx$1.a(iteratorResource(iterable));
			let result;
			const timer = _usingCtx$1.u(timerResource(opts.gracePeriodMs));
			let count = opts.count;
			let timerPromise = new Promise(() => {});
			while (true) {
				result = yield (0, import_awaitAsyncGenerator$4.default)(Unpromise.race([iterator.next(), timerPromise]));
				if (result === disposablePromiseTimerResult) throwAbortError();
				if (result.done) return result.value;
				yield result.value;
				if (--count === 0) timerPromise = timer.start();
				result = null;
			}
		} catch (_) {
			_usingCtx$1.e = _;
		} finally {
			yield (0, import_awaitAsyncGenerator$4.default)(_usingCtx$1.d());
		}
	});
	return _takeWithGrace.apply(this, arguments);
}

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/createDeferred.ts
function createDeferred() {
	let resolve;
	let reject;
	const promise = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return {
		promise,
		resolve,
		reject
	};
}

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/mergeAsyncIterables.ts
var import_usingCtx$3 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_usingCtx(), 1);
var import_awaitAsyncGenerator$3 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_awaitAsyncGenerator(), 1);
var import_wrapAsyncGenerator$4 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_wrapAsyncGenerator(), 1);
function createManagedIterator(iterable, onResult) {
	const iterator = iterable[Symbol.asyncIterator]();
	let state = "idle";
	function cleanup() {
		state = "done";
		onResult = () => {};
	}
	function pull() {
		if (state !== "idle") return;
		state = "pending";
		const next = iterator.next();
		next.then((result) => {
			if (result.done) {
				state = "done";
				onResult({
					status: "return",
					value: result.value
				});
				cleanup();
				return;
			}
			state = "idle";
			onResult({
				status: "yield",
				value: result.value
			});
		}).catch((cause) => {
			onResult({
				status: "error",
				error: cause
			});
			cleanup();
		});
	}
	return {
		pull,
		destroy: async () => {
			var _iterator$return;
			cleanup();
			await ((_iterator$return = iterator.return) === null || _iterator$return === void 0 ? void 0 : _iterator$return.call(iterator));
		}
	};
}
/**
* Creates a new async iterable that merges multiple async iterables into a single stream.
* Values from the input iterables are yielded in the order they resolve, similar to Promise.race().
*
* New iterables can be added dynamically using the returned {@link MergedAsyncIterables.add} method, even after iteration has started.
*
* If any of the input iterables throws an error, that error will be propagated through the merged stream.
* Other iterables will not continue to be processed.
*
* @template TYield The type of values yielded by the input iterables
*/
function mergeAsyncIterables() {
	let state = "idle";
	let flushSignal = createDeferred();
	/**
	* used while {@link state} is `idle`
	*/
	const iterables = [];
	/**
	* used while {@link state} is `pending`
	*/
	const iterators = /* @__PURE__ */ new Set();
	const buffer = [];
	function initIterable(iterable) {
		if (state !== "pending") return;
		const iterator = createManagedIterator(iterable, (result) => {
			if (state !== "pending") return;
			switch (result.status) {
				case "yield":
					buffer.push([iterator, result]);
					break;
				case "return":
					iterators.delete(iterator);
					break;
				case "error":
					buffer.push([iterator, result]);
					iterators.delete(iterator);
					break;
			}
			flushSignal.resolve();
		});
		iterators.add(iterator);
		iterator.pull();
	}
	return {
		add(iterable) {
			switch (state) {
				case "idle":
					iterables.push(iterable);
					break;
				case "pending":
					initIterable(iterable);
					break;
				case "done": break;
			}
		},
		[Symbol.asyncIterator]() {
			return (0, import_wrapAsyncGenerator$4.default)(function* () {
				try {
					var _usingCtx$1 = (0, import_usingCtx$3.default)();
					if (state !== "idle") throw new Error("Cannot iterate twice");
					state = "pending";
					const _finally = _usingCtx$1.a(makeAsyncResource({}, async () => {
						state = "done";
						const errors = [];
						await Promise.all(Array.from(iterators.values()).map(async (it) => {
							try {
								await it.destroy();
							} catch (cause) {
								errors.push(cause);
							}
						}));
						buffer.length = 0;
						iterators.clear();
						flushSignal.resolve();
						if (errors.length > 0) throw new AggregateError(errors);
					}));
					while (iterables.length > 0) initIterable(iterables.shift());
					while (iterators.size > 0) {
						yield (0, import_awaitAsyncGenerator$3.default)(flushSignal.promise);
						while (buffer.length > 0) {
							const [iterator, result] = buffer.shift();
							switch (result.status) {
								case "yield":
									yield result.value;
									iterator.pull();
									break;
								case "error": throw result.error;
							}
						}
						flushSignal = createDeferred();
					}
				} catch (_) {
					_usingCtx$1.e = _;
				} finally {
					yield (0, import_awaitAsyncGenerator$3.default)(_usingCtx$1.d());
				}
			})();
		}
	};
}

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/readableStreamFrom.ts
/**
* Creates a ReadableStream from an AsyncIterable.
*
* @param iterable - The source AsyncIterable to stream from
* @returns A ReadableStream that yields values from the AsyncIterable
*/
function readableStreamFrom(iterable) {
	const iterator = iterable[Symbol.asyncIterator]();
	return new ReadableStream({
		async cancel() {
			var _iterator$return;
			await ((_iterator$return = iterator.return) === null || _iterator$return === void 0 ? void 0 : _iterator$return.call(iterator));
		},
		async pull(controller) {
			const result = await iterator.next();
			if (result.done) {
				controller.close();
				return;
			}
			controller.enqueue(result.value);
		}
	});
}

//#endregion
//#region src/unstable-core-do-not-import/stream/utils/withPing.ts
var import_usingCtx$2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_usingCtx(), 1);
var import_awaitAsyncGenerator$2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_awaitAsyncGenerator(), 1);
var import_wrapAsyncGenerator$3 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_wrapAsyncGenerator(), 1);
const PING_SYM = Symbol("ping");
/**
* Derives a new {@link AsyncGenerator} based of {@link iterable}, that yields {@link PING_SYM}
* whenever no value has been yielded for {@link pingIntervalMs}.
*/
function withPing(_x, _x2) {
	return _withPing.apply(this, arguments);
}
function _withPing() {
	_withPing = (0, import_wrapAsyncGenerator$3.default)(function* (iterable, pingIntervalMs) {
		try {
			var _usingCtx$1 = (0, import_usingCtx$2.default)();
			const iterator = _usingCtx$1.a(iteratorResource(iterable));
			let result;
			let nextPromise = iterator.next();
			while (true) try {
				var _usingCtx3 = (0, import_usingCtx$2.default)();
				const pingPromise = _usingCtx3.u(timerResource(pingIntervalMs));
				result = yield (0, import_awaitAsyncGenerator$2.default)(Unpromise.race([nextPromise, pingPromise.start()]));
				if (result === disposablePromiseTimerResult) {
					yield PING_SYM;
					continue;
				}
				if (result.done) return result.value;
				nextPromise = iterator.next();
				yield result.value;
				result = null;
			} catch (_) {
				_usingCtx3.e = _;
			} finally {
				_usingCtx3.d();
			}
		} catch (_) {
			_usingCtx$1.e = _;
		} finally {
			yield (0, import_awaitAsyncGenerator$2.default)(_usingCtx$1.d());
		}
	});
	return _withPing.apply(this, arguments);
}

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/asyncIterator.js
var require_asyncIterator = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/asyncIterator.js"(exports, module) {
	function _asyncIterator$2(r) {
		var n, t, o, e = 2;
		for ("undefined" != typeof Symbol && (t = Symbol.asyncIterator, o = Symbol.iterator); e--;) {
			if (t && null != (n = r[t])) return n.call(r);
			if (o && null != (n = r[o])) return new AsyncFromSyncIterator(n.call(r));
			t = "@@asyncIterator", o = "@@iterator";
		}
		throw new TypeError("Object is not async iterable");
	}
	function AsyncFromSyncIterator(r) {
		function AsyncFromSyncIteratorContinuation(r$1) {
			if (Object(r$1) !== r$1) return Promise.reject(new TypeError(r$1 + " is not an object."));
			var n = r$1.done;
			return Promise.resolve(r$1.value).then(function(r$2) {
				return {
					value: r$2,
					done: n
				};
			});
		}
		return AsyncFromSyncIterator = function AsyncFromSyncIterator$1(r$1) {
			this.s = r$1, this.n = r$1.next;
		}, AsyncFromSyncIterator.prototype = {
			s: null,
			n: null,
			next: function next() {
				return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments));
			},
			"return": function _return(r$1) {
				var n = this.s["return"];
				return void 0 === n ? Promise.resolve({
					value: r$1,
					done: !0
				}) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments));
			},
			"throw": function _throw(r$1) {
				var n = this.s["return"];
				return void 0 === n ? Promise.reject(r$1) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments));
			}
		}, new AsyncFromSyncIterator(r);
	}
	module.exports = _asyncIterator$2, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region src/unstable-core-do-not-import/stream/jsonl.ts
var import_awaitAsyncGenerator$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_awaitAsyncGenerator(), 1);
var import_wrapAsyncGenerator$2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_wrapAsyncGenerator(), 1);
var import_usingCtx$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_usingCtx(), 1);
var import_asyncIterator$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_asyncIterator(), 1);
const CHUNK_VALUE_TYPE_PROMISE = 0;
const CHUNK_VALUE_TYPE_ASYNC_ITERABLE = 1;
const PROMISE_STATUS_FULFILLED = 0;
const PROMISE_STATUS_REJECTED = 1;
const ASYNC_ITERABLE_STATUS_RETURN = 0;
const ASYNC_ITERABLE_STATUS_YIELD = 1;
const ASYNC_ITERABLE_STATUS_ERROR = 2;
function isPromise(value) {
	return ((0,codes_DagpWZLc/* isObject */.Gv)(value) || (0,codes_DagpWZLc/* isFunction */.Tn)(value)) && typeof (value === null || value === void 0 ? void 0 : value["then"]) === "function" && typeof (value === null || value === void 0 ? void 0 : value["catch"]) === "function";
}
var MaxDepthError = class extends Error {
	constructor(path) {
		super("Max depth reached at path: " + path.join("."));
		this.path = path;
	}
};
function createBatchStreamProducer(_x3) {
	return _createBatchStreamProducer.apply(this, arguments);
}
function _createBatchStreamProducer() {
	_createBatchStreamProducer = (0, import_wrapAsyncGenerator$2.default)(function* (opts) {
		const { data } = opts;
		let counter = 0;
		const placeholder = 0;
		const mergedIterables = mergeAsyncIterables();
		function registerAsync(callback) {
			const idx = counter++;
			const iterable$1 = callback(idx);
			mergedIterables.add(iterable$1);
			return idx;
		}
		function encodePromise(promise, path) {
			return registerAsync(/* @__PURE__ */ function() {
				var _ref = (0, import_wrapAsyncGenerator$2.default)(function* (idx) {
					const error = checkMaxDepth(path);
					if (error) {
						promise.catch((cause) => {
							var _opts$onError;
							(_opts$onError = opts.onError) === null || _opts$onError === void 0 || _opts$onError.call(opts, {
								error: cause,
								path
							});
						});
						promise = Promise.reject(error);
					}
					try {
						const next = yield (0, import_awaitAsyncGenerator$1.default)(promise);
						yield [
							idx,
							PROMISE_STATUS_FULFILLED,
							encode(next, path)
						];
					} catch (cause) {
						var _opts$onError2, _opts$formatError;
						(_opts$onError2 = opts.onError) === null || _opts$onError2 === void 0 || _opts$onError2.call(opts, {
							error: cause,
							path
						});
						yield [
							idx,
							PROMISE_STATUS_REJECTED,
							(_opts$formatError = opts.formatError) === null || _opts$formatError === void 0 ? void 0 : _opts$formatError.call(opts, {
								error: cause,
								path
							})
						];
					}
				});
				return function(_x) {
					return _ref.apply(this, arguments);
				};
			}());
		}
		function encodeAsyncIterable(iterable$1, path) {
			return registerAsync(/* @__PURE__ */ function() {
				var _ref2 = (0, import_wrapAsyncGenerator$2.default)(function* (idx) {
					try {
						var _usingCtx$1 = (0, import_usingCtx$1.default)();
						const error = checkMaxDepth(path);
						if (error) throw error;
						const iterator = _usingCtx$1.a(iteratorResource(iterable$1));
						try {
							while (true) {
								const next = yield (0, import_awaitAsyncGenerator$1.default)(iterator.next());
								if (next.done) {
									yield [
										idx,
										ASYNC_ITERABLE_STATUS_RETURN,
										encode(next.value, path)
									];
									break;
								}
								yield [
									idx,
									ASYNC_ITERABLE_STATUS_YIELD,
									encode(next.value, path)
								];
							}
						} catch (cause) {
							var _opts$onError3, _opts$formatError2;
							(_opts$onError3 = opts.onError) === null || _opts$onError3 === void 0 || _opts$onError3.call(opts, {
								error: cause,
								path
							});
							yield [
								idx,
								ASYNC_ITERABLE_STATUS_ERROR,
								(_opts$formatError2 = opts.formatError) === null || _opts$formatError2 === void 0 ? void 0 : _opts$formatError2.call(opts, {
									error: cause,
									path
								})
							];
						}
					} catch (_) {
						_usingCtx$1.e = _;
					} finally {
						yield (0, import_awaitAsyncGenerator$1.default)(_usingCtx$1.d());
					}
				});
				return function(_x2) {
					return _ref2.apply(this, arguments);
				};
			}());
		}
		function checkMaxDepth(path) {
			if (opts.maxDepth && path.length > opts.maxDepth) return new MaxDepthError(path);
			return null;
		}
		function encodeAsync(value, path) {
			if (isPromise(value)) return [CHUNK_VALUE_TYPE_PROMISE, encodePromise(value, path)];
			if ((0,codes_DagpWZLc/* isAsyncIterable */.Td)(value)) {
				if (opts.maxDepth && path.length >= opts.maxDepth) throw new Error("Max depth reached");
				return [CHUNK_VALUE_TYPE_ASYNC_ITERABLE, encodeAsyncIterable(value, path)];
			}
			return null;
		}
		function encode(value, path) {
			if (value === void 0) return [[]];
			const reg = encodeAsync(value, path);
			if (reg) return [[placeholder], [null, ...reg]];
			if (!isPlainObject(value)) return [[value]];
			const newObj = (0,codes_DagpWZLc/* emptyObject */.vB)();
			const asyncValues = [];
			for (const [key, item] of Object.entries(value)) {
				const transformed = encodeAsync(item, [...path, key]);
				if (!transformed) {
					newObj[key] = item;
					continue;
				}
				newObj[key] = placeholder;
				asyncValues.push([key, ...transformed]);
			}
			return [[newObj], ...asyncValues];
		}
		const newHead = (0,codes_DagpWZLc/* emptyObject */.vB)();
		for (const [key, item] of Object.entries(data)) newHead[key] = encode(item, [key]);
		yield newHead;
		let iterable = mergedIterables;
		if (opts.pingMs) iterable = withPing(mergedIterables, opts.pingMs);
		var _iteratorAbruptCompletion = false;
		var _didIteratorError = false;
		var _iteratorError;
		try {
			for (var _iterator = (0, import_asyncIterator$1.default)(iterable), _step; _iteratorAbruptCompletion = !(_step = yield (0, import_awaitAsyncGenerator$1.default)(_iterator.next())).done; _iteratorAbruptCompletion = false) {
				const value = _step.value;
				yield value;
			}
		} catch (err) {
			_didIteratorError = true;
			_iteratorError = err;
		} finally {
			try {
				if (_iteratorAbruptCompletion && _iterator.return != null) yield (0, import_awaitAsyncGenerator$1.default)(_iterator.return());
			} finally {
				if (_didIteratorError) throw _iteratorError;
			}
		}
	});
	return _createBatchStreamProducer.apply(this, arguments);
}
/**
* JSON Lines stream producer
* @see https://jsonlines.org/
*/
function jsonlStreamProducer(opts) {
	let stream = readableStreamFrom(createBatchStreamProducer(opts));
	const { serialize } = opts;
	if (serialize) stream = stream.pipeThrough(new TransformStream({ transform(chunk, controller) {
		if (chunk === PING_SYM) controller.enqueue(PING_SYM);
		else controller.enqueue(serialize(chunk));
	} }));
	return stream.pipeThrough(new TransformStream({ transform(chunk, controller) {
		if (chunk === PING_SYM) controller.enqueue(" ");
		else controller.enqueue(JSON.stringify(chunk) + "\n");
	} })).pipeThrough(new TextEncoderStream());
}
var AsyncError = class extends Error {
	constructor(data) {
		super("Received error from server");
		this.data = data;
	}
};
const nodeJsStreamToReaderEsque = (source) => {
	return { getReader() {
		const stream = new ReadableStream({ start(controller) {
			source.on("data", (chunk) => {
				controller.enqueue(chunk);
			});
			source.on("end", () => {
				controller.close();
			});
			source.on("error", (error) => {
				controller.error(error);
			});
		} });
		return stream.getReader();
	} };
};
function createLineAccumulator(from) {
	const reader = "getReader" in from ? from.getReader() : nodeJsStreamToReaderEsque(from).getReader();
	let lineAggregate = "";
	return new ReadableStream({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) controller.close();
			else controller.enqueue(value);
		},
		cancel() {
			return reader.cancel();
		}
	}).pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({ transform(chunk, controller) {
		var _parts$pop;
		lineAggregate += chunk;
		const parts = lineAggregate.split("\n");
		lineAggregate = (_parts$pop = parts.pop()) !== null && _parts$pop !== void 0 ? _parts$pop : "";
		for (const part of parts) controller.enqueue(part);
	} }));
}
function createConsumerStream(from) {
	const stream = createLineAccumulator(from);
	let sentHead = false;
	return stream.pipeThrough(new TransformStream({ transform(line, controller) {
		if (!sentHead) {
			const head = JSON.parse(line);
			controller.enqueue(head);
			sentHead = true;
		} else {
			const chunk = JSON.parse(line);
			controller.enqueue(chunk);
		}
	} }));
}
/**
* Creates a handler for managing stream controllers and their lifecycle
*/
function createStreamsManager(abortController) {
	const controllerMap = /* @__PURE__ */ new Map();
	/**
	* Checks if there are no pending controllers or deferred promises
	*/
	function isEmpty() {
		return Array.from(controllerMap.values()).every((c) => c.closed);
	}
	/**
	* Creates a stream controller
	*/
	function createStreamController() {
		let originalController;
		const stream = new ReadableStream({ start(controller) {
			originalController = controller;
		} });
		const streamController = {
			enqueue: (v) => originalController.enqueue(v),
			close: () => {
				originalController.close();
				clear();
				if (isEmpty()) abortController.abort();
			},
			closed: false,
			getReaderResource: () => {
				const reader = stream.getReader();
				return makeResource(reader, () => {
					streamController.close();
					reader.releaseLock();
				});
			},
			error: (reason) => {
				originalController.error(reason);
				clear();
			}
		};
		function clear() {
			Object.assign(streamController, {
				closed: true,
				close: () => {},
				enqueue: () => {},
				getReaderResource: null,
				error: () => {}
			});
		}
		return streamController;
	}
	/**
	* Gets or creates a stream controller
	*/
	function getOrCreate(chunkId) {
		let c = controllerMap.get(chunkId);
		if (!c) {
			c = createStreamController();
			controllerMap.set(chunkId, c);
		}
		return c;
	}
	/**
	* Cancels all pending controllers and rejects deferred promises
	*/
	function cancelAll(reason) {
		for (const controller of controllerMap.values()) controller.error(reason);
	}
	return {
		getOrCreate,
		cancelAll
	};
}
/**
* JSON Lines stream consumer
* @see https://jsonlines.org/
*/
async function jsonlStreamConsumer(opts) {
	const { deserialize = (v) => v } = opts;
	let source = createConsumerStream(opts.from);
	if (deserialize) source = source.pipeThrough(new TransformStream({ transform(chunk, controller) {
		controller.enqueue(deserialize(chunk));
	} }));
	let headDeferred = createDeferred();
	const streamManager = createStreamsManager(opts.abortController);
	function decodeChunkDefinition(value) {
		const [_path, type, chunkId] = value;
		const controller = streamManager.getOrCreate(chunkId);
		switch (type) {
			case CHUNK_VALUE_TYPE_PROMISE: return run(async () => {
				try {
					var _usingCtx3 = (0, import_usingCtx$1.default)();
					const reader = _usingCtx3.u(controller.getReaderResource());
					const { value: value$1 } = await reader.read();
					const [_chunkId, status, data] = value$1;
					switch (status) {
						case PROMISE_STATUS_FULFILLED: return decode(data);
						case PROMISE_STATUS_REJECTED:
							var _opts$formatError3, _opts$formatError4;
							throw (_opts$formatError3 = (_opts$formatError4 = opts.formatError) === null || _opts$formatError4 === void 0 ? void 0 : _opts$formatError4.call(opts, { error: data })) !== null && _opts$formatError3 !== void 0 ? _opts$formatError3 : new AsyncError(data);
					}
				} catch (_) {
					_usingCtx3.e = _;
				} finally {
					_usingCtx3.d();
				}
			});
			case CHUNK_VALUE_TYPE_ASYNC_ITERABLE: return run((0, import_wrapAsyncGenerator$2.default)(function* () {
				try {
					var _usingCtx4 = (0, import_usingCtx$1.default)();
					const reader = _usingCtx4.u(controller.getReaderResource());
					while (true) {
						const { value: value$1 } = yield (0, import_awaitAsyncGenerator$1.default)(reader.read());
						const [_chunkId, status, data] = value$1;
						switch (status) {
							case ASYNC_ITERABLE_STATUS_YIELD:
								yield decode(data);
								break;
							case ASYNC_ITERABLE_STATUS_RETURN: return decode(data);
							case ASYNC_ITERABLE_STATUS_ERROR:
								var _opts$formatError5, _opts$formatError6;
								throw (_opts$formatError5 = (_opts$formatError6 = opts.formatError) === null || _opts$formatError6 === void 0 ? void 0 : _opts$formatError6.call(opts, { error: data })) !== null && _opts$formatError5 !== void 0 ? _opts$formatError5 : new AsyncError(data);
						}
					}
				} catch (_) {
					_usingCtx4.e = _;
				} finally {
					_usingCtx4.d();
				}
			}));
		}
	}
	function decode(value) {
		const [[data], ...asyncProps] = value;
		for (const value$1 of asyncProps) {
			const [key] = value$1;
			const decoded = decodeChunkDefinition(value$1);
			if (key === null) return decoded;
			data[key] = decoded;
		}
		return data;
	}
	const closeOrAbort = (reason) => {
		headDeferred === null || headDeferred === void 0 || headDeferred.reject(reason);
		streamManager.cancelAll(reason);
	};
	source.pipeTo(new WritableStream({
		write(chunkOrHead) {
			if (headDeferred) {
				const head = chunkOrHead;
				for (const [key, value] of Object.entries(chunkOrHead)) {
					const parsed = decode(value);
					head[key] = parsed;
				}
				headDeferred.resolve(head);
				headDeferred = null;
				return;
			}
			const chunk = chunkOrHead;
			const [idx] = chunk;
			const controller = streamManager.getOrCreate(idx);
			controller.enqueue(chunk);
		},
		close: closeOrAbort,
		abort: closeOrAbort
	})).catch((error) => {
		var _opts$onError4;
		(_opts$onError4 = opts.onError) === null || _opts$onError4 === void 0 || _opts$onError4.call(opts, { error });
		closeOrAbort(error);
	});
	return [await headDeferred.promise];
}

//#endregion
//#region ../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/asyncGeneratorDelegate.js
var require_asyncGeneratorDelegate = (0,getErrorShape_vC8mUXJD/* __commonJS */.P$)({ "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/asyncGeneratorDelegate.js"(exports, module) {
	var OverloadYield = require_OverloadYield();
	function _asyncGeneratorDelegate$1(t) {
		var e = {}, n = !1;
		function pump(e$1, r) {
			return n = !0, r = new Promise(function(n$1) {
				n$1(t[e$1](r));
			}), {
				done: !1,
				value: new OverloadYield(r, 1)
			};
		}
		return e["undefined" != typeof Symbol && Symbol.iterator || "@@iterator"] = function() {
			return this;
		}, e.next = function(t$1) {
			return n ? (n = !1, t$1) : pump("next", t$1);
		}, "function" == typeof t["throw"] && (e["throw"] = function(t$1) {
			if (n) throw n = !1, t$1;
			return pump("throw", t$1);
		}), "function" == typeof t["return"] && (e["return"] = function(t$1) {
			return n ? (n = !1, t$1) : pump("return", t$1);
		}), e;
	}
	module.exports = _asyncGeneratorDelegate$1, module.exports.__esModule = true, module.exports["default"] = module.exports;
} });

//#endregion
//#region src/unstable-core-do-not-import/stream/sse.ts
var import_asyncIterator = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_asyncIterator(), 1);
var import_awaitAsyncGenerator = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_awaitAsyncGenerator(), 1);
var import_wrapAsyncGenerator$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_wrapAsyncGenerator(), 1);
var import_asyncGeneratorDelegate = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_asyncGeneratorDelegate(), 1);
var import_usingCtx = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_usingCtx(), 1);
const PING_EVENT = "ping";
const SERIALIZED_ERROR_EVENT = "serialized-error";
const CONNECTED_EVENT = "connected";
const RETURN_EVENT = "return";
/**
*
* @see https://html.spec.whatwg.org/multipage/server-sent-events.html
*/
function sseStreamProducer(opts) {
	var _opts$ping$enabled, _opts$ping, _opts$ping$intervalMs, _opts$ping2, _opts$client;
	const { serialize = codes_DagpWZLc/* identity */.D_ } = opts;
	const ping = {
		enabled: (_opts$ping$enabled = (_opts$ping = opts.ping) === null || _opts$ping === void 0 ? void 0 : _opts$ping.enabled) !== null && _opts$ping$enabled !== void 0 ? _opts$ping$enabled : false,
		intervalMs: (_opts$ping$intervalMs = (_opts$ping2 = opts.ping) === null || _opts$ping2 === void 0 ? void 0 : _opts$ping2.intervalMs) !== null && _opts$ping$intervalMs !== void 0 ? _opts$ping$intervalMs : 1e3
	};
	const client = (_opts$client = opts.client) !== null && _opts$client !== void 0 ? _opts$client : {};
	if (ping.enabled && client.reconnectAfterInactivityMs && ping.intervalMs > client.reconnectAfterInactivityMs) throw new Error(`Ping interval must be less than client reconnect interval to prevent unnecessary reconnection - ping.intervalMs: ${ping.intervalMs} client.reconnectAfterInactivityMs: ${client.reconnectAfterInactivityMs}`);
	function generator() {
		return _generator.apply(this, arguments);
	}
	function _generator() {
		_generator = (0, import_wrapAsyncGenerator$1.default)(function* () {
			yield {
				event: CONNECTED_EVENT,
				data: JSON.stringify(client)
			};
			let iterable = opts.data;
			if (opts.emitAndEndImmediately) iterable = takeWithGrace(iterable, {
				count: 1,
				gracePeriodMs: 1
			});
			if (ping.enabled && ping.intervalMs !== Infinity && ping.intervalMs > 0) iterable = withPing(iterable, ping.intervalMs);
			let value;
			let chunk;
			var _iteratorAbruptCompletion = false;
			var _didIteratorError = false;
			var _iteratorError;
			try {
				for (var _iterator = (0, import_asyncIterator.default)(iterable), _step; _iteratorAbruptCompletion = !(_step = yield (0, import_awaitAsyncGenerator.default)(_iterator.next())).done; _iteratorAbruptCompletion = false) {
					value = _step.value;
					{
						if (value === PING_SYM) {
							yield {
								event: PING_EVENT,
								data: ""
							};
							continue;
						}
						chunk = (0,tracked_Bjtgv3wJ/* isTrackedEnvelope */.vJ)(value) ? {
							id: value[0],
							data: value[1]
						} : { data: value };
						chunk.data = JSON.stringify(serialize(chunk.data));
						yield chunk;
						value = null;
						chunk = null;
					}
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (_iteratorAbruptCompletion && _iterator.return != null) yield (0, import_awaitAsyncGenerator.default)(_iterator.return());
				} finally {
					if (_didIteratorError) throw _iteratorError;
				}
			}
		});
		return _generator.apply(this, arguments);
	}
	function generatorWithErrorHandling() {
		return _generatorWithErrorHandling.apply(this, arguments);
	}
	function _generatorWithErrorHandling() {
		_generatorWithErrorHandling = (0, import_wrapAsyncGenerator$1.default)(function* () {
			try {
				yield* (0, import_asyncGeneratorDelegate.default)((0, import_asyncIterator.default)(generator()));
				yield {
					event: RETURN_EVENT,
					data: ""
				};
			} catch (cause) {
				var _opts$formatError, _opts$formatError2;
				if (resolveResponse_BVDlNZwN_isAbortError(cause)) return;
				const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause);
				const data = (_opts$formatError = (_opts$formatError2 = opts.formatError) === null || _opts$formatError2 === void 0 ? void 0 : _opts$formatError2.call(opts, { error })) !== null && _opts$formatError !== void 0 ? _opts$formatError : null;
				yield {
					event: SERIALIZED_ERROR_EVENT,
					data: JSON.stringify(serialize(data))
				};
			}
		});
		return _generatorWithErrorHandling.apply(this, arguments);
	}
	const stream = readableStreamFrom(generatorWithErrorHandling());
	return stream.pipeThrough(new TransformStream({ transform(chunk, controller) {
		if ("event" in chunk) controller.enqueue(`event: ${chunk.event}\n`);
		if ("data" in chunk) controller.enqueue(`data: ${chunk.data}\n`);
		if ("id" in chunk) controller.enqueue(`id: ${chunk.id}\n`);
		if ("comment" in chunk) controller.enqueue(`: ${chunk.comment}\n`);
		controller.enqueue("\n\n");
	} })).pipeThrough(new TextEncoderStream());
}
async function withTimeout(opts) {
	try {
		var _usingCtx$1 = (0, import_usingCtx.default)();
		const timeoutPromise = _usingCtx$1.u(timerResource(opts.timeoutMs));
		const res = await Unpromise.race([opts.promise, timeoutPromise.start()]);
		if (res === disposablePromiseTimerResult) return await opts.onTimeout();
		return res;
	} catch (_) {
		_usingCtx$1.e = _;
	} finally {
		_usingCtx$1.d();
	}
}
/**
* @see https://html.spec.whatwg.org/multipage/server-sent-events.html
*/
function sseStreamConsumer(opts) {
	const { deserialize = (v) => v } = opts;
	let clientOptions = emptyObject();
	const signal = opts.signal;
	let _es = null;
	const createStream = () => new ReadableStream({
		async start(controller) {
			const [url, init] = await Promise.all([opts.url(), opts.init()]);
			const eventSource = _es = new opts.EventSource(url, init);
			controller.enqueue({
				type: "connecting",
				eventSource: _es,
				event: null
			});
			eventSource.addEventListener(CONNECTED_EVENT, (_msg) => {
				const msg = _msg;
				const options = JSON.parse(msg.data);
				clientOptions = options;
				controller.enqueue({
					type: "connected",
					options,
					eventSource
				});
			});
			eventSource.addEventListener(SERIALIZED_ERROR_EVENT, (_msg) => {
				const msg = _msg;
				controller.enqueue({
					type: "serialized-error",
					error: deserialize(JSON.parse(msg.data)),
					eventSource
				});
			});
			eventSource.addEventListener(PING_EVENT, () => {
				controller.enqueue({
					type: "ping",
					eventSource
				});
			});
			eventSource.addEventListener(RETURN_EVENT, () => {
				eventSource.close();
				controller.close();
				_es = null;
			});
			eventSource.addEventListener("error", (event) => {
				if (eventSource.readyState === eventSource.CLOSED) controller.error(event);
				else controller.enqueue({
					type: "connecting",
					eventSource,
					event
				});
			});
			eventSource.addEventListener("message", (_msg) => {
				const msg = _msg;
				const chunk = deserialize(JSON.parse(msg.data));
				const def = { data: chunk };
				if (msg.lastEventId) def.id = msg.lastEventId;
				controller.enqueue({
					type: "data",
					data: def,
					eventSource
				});
			});
			const onAbort = () => {
				try {
					eventSource.close();
					controller.close();
				} catch (_unused) {}
			};
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort);
		},
		cancel() {
			_es === null || _es === void 0 || _es.close();
		}
	});
	const getStreamResource = () => {
		let stream = createStream();
		let reader = stream.getReader();
		async function dispose() {
			await reader.cancel();
			_es = null;
		}
		return makeAsyncResource({
			read() {
				return reader.read();
			},
			async recreate() {
				await dispose();
				stream = createStream();
				reader = stream.getReader();
			}
		}, dispose);
	};
	return run((0, import_wrapAsyncGenerator$1.default)(function* () {
		try {
			var _usingCtx3 = (0, import_usingCtx.default)();
			const stream = _usingCtx3.a(getStreamResource());
			while (true) {
				let promise = stream.read();
				const timeoutMs = clientOptions.reconnectAfterInactivityMs;
				if (timeoutMs) promise = withTimeout({
					promise,
					timeoutMs,
					onTimeout: async () => {
						const res = {
							value: {
								type: "timeout",
								ms: timeoutMs,
								eventSource: _es
							},
							done: false
						};
						await stream.recreate();
						return res;
					}
				});
				const result = yield (0, import_awaitAsyncGenerator.default)(promise);
				if (result.done) return result.value;
				yield result.value;
			}
		} catch (_) {
			_usingCtx3.e = _;
		} finally {
			yield (0, import_awaitAsyncGenerator.default)(_usingCtx3.d());
		}
	}));
}
const sseHeaders = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	"X-Accel-Buffering": "no",
	Connection: "keep-alive"
};

//#endregion
//#region src/unstable-core-do-not-import/http/resolveResponse.ts
var import_wrapAsyncGenerator = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_wrapAsyncGenerator(), 1);
var import_objectSpread2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
function errorToAsyncIterable(err) {
	return (0,codes_DagpWZLc/* run */.eF)((0, import_wrapAsyncGenerator.default)(function* () {
		throw err;
	}));
}
function combinedAbortController(signal) {
	const controller = new AbortController();
	const combinedSignal = (0,codes_DagpWZLc/* abortSignalsAnyPonyfill */.zf)([signal, controller.signal]);
	return {
		signal: combinedSignal,
		controller
	};
}
const TYPE_ACCEPTED_METHOD_MAP = {
	mutation: ["POST"],
	query: ["GET"],
	subscription: ["GET"]
};
const TYPE_ACCEPTED_METHOD_MAP_WITH_METHOD_OVERRIDE = {
	mutation: ["POST"],
	query: ["GET", "POST"],
	subscription: ["GET", "POST"]
};
function initResponse(initOpts) {
	var _responseMeta, _info$calls$find$proc, _info$calls$find;
	const { ctx, info, responseMeta, untransformedJSON, errors = [], headers } = initOpts;
	let status = untransformedJSON ? (0,getErrorShape_vC8mUXJD/* getHTTPStatusCode */.E$)(untransformedJSON) : 200;
	const eagerGeneration = !untransformedJSON;
	const data = eagerGeneration ? [] : Array.isArray(untransformedJSON) ? untransformedJSON : [untransformedJSON];
	const meta = (_responseMeta = responseMeta === null || responseMeta === void 0 ? void 0 : responseMeta({
		ctx,
		info,
		paths: info === null || info === void 0 ? void 0 : info.calls.map((call) => call.path),
		data,
		errors,
		eagerGeneration,
		type: (_info$calls$find$proc = info === null || info === void 0 || (_info$calls$find = info.calls.find((call) => {
			var _call$procedure;
			return (_call$procedure = call.procedure) === null || _call$procedure === void 0 ? void 0 : _call$procedure._def.type;
		})) === null || _info$calls$find === void 0 || (_info$calls$find = _info$calls$find.procedure) === null || _info$calls$find === void 0 ? void 0 : _info$calls$find._def.type) !== null && _info$calls$find$proc !== void 0 ? _info$calls$find$proc : "unknown"
	})) !== null && _responseMeta !== void 0 ? _responseMeta : {};
	if (meta.headers) {
		if (meta.headers instanceof Headers) for (const [key, value] of meta.headers.entries()) headers.append(key, value);
		else
 /**
		* @deprecated, delete in v12
		*/
		for (const [key, value] of Object.entries(meta.headers)) if (Array.isArray(value)) for (const v of value) headers.append(key, v);
		else if (typeof value === "string") headers.set(key, value);
	}
	if (meta.status) status = meta.status;
	return { status };
}
function caughtErrorToData(cause, errorOpts) {
	const { router, req, onError } = errorOpts.opts;
	const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause);
	onError === null || onError === void 0 || onError({
		error,
		path: errorOpts.path,
		input: errorOpts.input,
		ctx: errorOpts.ctx,
		type: errorOpts.type,
		req
	});
	const untransformedJSON = { error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
		config: router._def._config,
		error,
		type: errorOpts.type,
		path: errorOpts.path,
		input: errorOpts.input,
		ctx: errorOpts.ctx
	}) };
	const transformedJSON = (0,tracked_Bjtgv3wJ/* transformTRPCResponse */.t9)(router._def._config, untransformedJSON);
	const body = JSON.stringify(transformedJSON);
	return {
		error,
		untransformedJSON,
		body
	};
}
/**
* Check if a value is a stream-like object
* - if it's an async iterable
* - if it's an object with async iterables or promises
*/
function isDataStream(v) {
	if (!(0,codes_DagpWZLc/* isObject */.Gv)(v)) return false;
	if ((0,codes_DagpWZLc/* isAsyncIterable */.Td)(v)) return true;
	return Object.values(v).some(isPromise) || Object.values(v).some(codes_DagpWZLc/* isAsyncIterable */.Td);
}
async function resolveResponse_BVDlNZwN_resolveResponse(opts) {
	var _ref, _opts$allowBatching, _opts$batching, _opts$allowMethodOver, _config$sse$enabled, _config$sse;
	const { router, req } = opts;
	const headers = new Headers([["vary", "trpc-accept"]]);
	const config = router._def._config;
	const url = new URL(req.url);
	if (req.method === "HEAD") return new Response(null, { status: 204 });
	const allowBatching = (_ref = (_opts$allowBatching = opts.allowBatching) !== null && _opts$allowBatching !== void 0 ? _opts$allowBatching : (_opts$batching = opts.batching) === null || _opts$batching === void 0 ? void 0 : _opts$batching.enabled) !== null && _ref !== void 0 ? _ref : true;
	const allowMethodOverride = ((_opts$allowMethodOver = opts.allowMethodOverride) !== null && _opts$allowMethodOver !== void 0 ? _opts$allowMethodOver : false) && req.method === "POST";
	const infoTuple = await (0,codes_DagpWZLc/* run */.eF)(async () => {
		try {
			return [void 0, await getRequestInfo({
				req,
				path: decodeURIComponent(opts.path),
				router,
				searchParams: url.searchParams,
				headers: opts.req.headers,
				url
			})];
		} catch (cause) {
			return [(0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause), void 0];
		}
	});
	const ctxManager = (0,codes_DagpWZLc/* run */.eF)(() => {
		let result = void 0;
		return {
			valueOrUndefined: () => {
				if (!result) return void 0;
				return result[1];
			},
			value: () => {
				const [err, ctx] = result;
				if (err) throw err;
				return ctx;
			},
			create: async (info) => {
				if (result) throw new Error("This should only be called once - report a bug in tRPC");
				try {
					const ctx = await opts.createContext({ info });
					result = [void 0, ctx];
				} catch (cause) {
					result = [(0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause), void 0];
				}
			}
		};
	});
	const methodMapper = allowMethodOverride ? TYPE_ACCEPTED_METHOD_MAP_WITH_METHOD_OVERRIDE : TYPE_ACCEPTED_METHOD_MAP;
	/**
	* @deprecated
	*/
	const isStreamCall = req.headers.get("trpc-accept") === "application/jsonl";
	const experimentalSSE = (_config$sse$enabled = (_config$sse = config.sse) === null || _config$sse === void 0 ? void 0 : _config$sse.enabled) !== null && _config$sse$enabled !== void 0 ? _config$sse$enabled : true;
	try {
		const [infoError, info] = infoTuple;
		if (infoError) throw infoError;
		if (info.isBatchCall && !allowBatching) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "BAD_REQUEST",
			message: `Batching is not enabled on the server`
		});
		/* istanbul ignore if -- @preserve */
		if (isStreamCall && !info.isBatchCall) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			message: `Streaming requests must be batched (you can do a batch of 1)`,
			code: "BAD_REQUEST"
		});
		await ctxManager.create(info);
		const rpcCalls = info.calls.map(async (call) => {
			const proc = call.procedure;
			const combinedAbort = combinedAbortController(opts.req.signal);
			try {
				if (opts.error) throw opts.error;
				if (!proc) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
					code: "NOT_FOUND",
					message: `No procedure found on path "${call.path}"`
				});
				if (!methodMapper[proc._def.type].includes(req.method)) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
					code: "METHOD_NOT_SUPPORTED",
					message: `Unsupported ${req.method}-request to ${proc._def.type} procedure at path "${call.path}"`
				});
				if (proc._def.type === "subscription") {
					var _config$sse2;
					/* istanbul ignore if -- @preserve */
					if (info.isBatchCall) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
						code: "BAD_REQUEST",
						message: `Cannot batch subscription calls`
					});
					if ((_config$sse2 = config.sse) === null || _config$sse2 === void 0 ? void 0 : _config$sse2.maxDurationMs) {
						function cleanup() {
							clearTimeout(timer);
							combinedAbort.signal.removeEventListener("abort", cleanup);
							combinedAbort.controller.abort();
						}
						const timer = setTimeout(cleanup, config.sse.maxDurationMs);
						combinedAbort.signal.addEventListener("abort", cleanup);
					}
				}
				const data = await proc({
					path: call.path,
					getRawInput: call.getRawInput,
					ctx: ctxManager.value(),
					type: proc._def.type,
					signal: combinedAbort.signal,
					batchIndex: call.batchIndex
				});
				return [void 0, { data }];
			} catch (cause) {
				var _opts$onError, _call$procedure$_def$, _call$procedure2;
				const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause);
				const input = call.result();
				(_opts$onError = opts.onError) === null || _opts$onError === void 0 || _opts$onError.call(opts, {
					error,
					path: call.path,
					input,
					ctx: ctxManager.valueOrUndefined(),
					type: (_call$procedure$_def$ = (_call$procedure2 = call.procedure) === null || _call$procedure2 === void 0 ? void 0 : _call$procedure2._def.type) !== null && _call$procedure$_def$ !== void 0 ? _call$procedure$_def$ : "unknown",
					req: opts.req
				});
				return [error, void 0];
			}
		});
		if (!info.isBatchCall) {
			const [call] = info.calls;
			const [error, result] = await rpcCalls[0];
			switch (info.type) {
				case "unknown":
				case "mutation":
				case "query": {
					headers.set("content-type", "application/json");
					if (isDataStream(result === null || result === void 0 ? void 0 : result.data)) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
						code: "UNSUPPORTED_MEDIA_TYPE",
						message: "Cannot use stream-like response in non-streaming request - use httpBatchStreamLink"
					});
					const res = error ? { error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
						config,
						ctx: ctxManager.valueOrUndefined(),
						error,
						input: call.result(),
						path: call.path,
						type: info.type
					}) } : { result: { data: result.data } };
					const headResponse$1 = initResponse({
						ctx: ctxManager.valueOrUndefined(),
						info,
						responseMeta: opts.responseMeta,
						errors: error ? [error] : [],
						headers,
						untransformedJSON: [res]
					});
					return new Response(JSON.stringify((0,tracked_Bjtgv3wJ/* transformTRPCResponse */.t9)(config, res)), {
						status: headResponse$1.status,
						headers
					});
				}
				case "subscription": {
					const iterable = (0,codes_DagpWZLc/* run */.eF)(() => {
						if (error) return errorToAsyncIterable(error);
						if (!experimentalSSE) return errorToAsyncIterable(new tracked_Bjtgv3wJ/* TRPCError */.gt({
							code: "METHOD_NOT_SUPPORTED",
							message: "Missing experimental flag \"sseSubscriptions\""
						}));
						if (!isObservable(result.data) && !(0,codes_DagpWZLc/* isAsyncIterable */.Td)(result.data)) return errorToAsyncIterable(new tracked_Bjtgv3wJ/* TRPCError */.gt({
							message: `Subscription ${call.path} did not return an observable or a AsyncGenerator`,
							code: "INTERNAL_SERVER_ERROR"
						}));
						const dataAsIterable = isObservable(result.data) ? observableToAsyncIterable(result.data, opts.req.signal) : result.data;
						return dataAsIterable;
					});
					const stream = sseStreamProducer((0, import_objectSpread2.default)((0, import_objectSpread2.default)({}, config.sse), {}, {
						data: iterable,
						serialize: (v) => config.transformer.output.serialize(v),
						formatError(errorOpts) {
							var _call$procedure$_def$2, _call$procedure3, _opts$onError2;
							const error$1 = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(errorOpts.error);
							const input = call === null || call === void 0 ? void 0 : call.result();
							const path = call === null || call === void 0 ? void 0 : call.path;
							const type = (_call$procedure$_def$2 = call === null || call === void 0 || (_call$procedure3 = call.procedure) === null || _call$procedure3 === void 0 ? void 0 : _call$procedure3._def.type) !== null && _call$procedure$_def$2 !== void 0 ? _call$procedure$_def$2 : "unknown";
							(_opts$onError2 = opts.onError) === null || _opts$onError2 === void 0 || _opts$onError2.call(opts, {
								error: error$1,
								path,
								input,
								ctx: ctxManager.valueOrUndefined(),
								req: opts.req,
								type
							});
							const shape = (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
								config,
								ctx: ctxManager.valueOrUndefined(),
								error: error$1,
								input,
								path,
								type
							});
							return shape;
						}
					}));
					for (const [key, value] of Object.entries(sseHeaders)) headers.set(key, value);
					const headResponse$1 = initResponse({
						ctx: ctxManager.valueOrUndefined(),
						info,
						responseMeta: opts.responseMeta,
						errors: [],
						headers,
						untransformedJSON: null
					});
					return new Response(stream, {
						headers,
						status: headResponse$1.status
					});
				}
			}
		}
		if (info.accept === "application/jsonl") {
			headers.set("content-type", "application/json");
			headers.set("transfer-encoding", "chunked");
			const headResponse$1 = initResponse({
				ctx: ctxManager.valueOrUndefined(),
				info,
				responseMeta: opts.responseMeta,
				errors: [],
				headers,
				untransformedJSON: null
			});
			const stream = jsonlStreamProducer((0, import_objectSpread2.default)((0, import_objectSpread2.default)({}, config.jsonl), {}, {
				maxDepth: Infinity,
				data: rpcCalls.map(async (res) => {
					const [error, result] = await res;
					const call = info.calls[0];
					if (error) {
						var _procedure$_def$type, _procedure;
						return { error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
							config,
							ctx: ctxManager.valueOrUndefined(),
							error,
							input: call.result(),
							path: call.path,
							type: (_procedure$_def$type = (_procedure = call.procedure) === null || _procedure === void 0 ? void 0 : _procedure._def.type) !== null && _procedure$_def$type !== void 0 ? _procedure$_def$type : "unknown"
						}) };
					}
					/**
					* Not very pretty, but we need to wrap nested data in promises
					* Our stream producer will only resolve top-level async values or async values that are directly nested in another async value
					*/
					const iterable = isObservable(result.data) ? observableToAsyncIterable(result.data, opts.req.signal) : Promise.resolve(result.data);
					return { result: Promise.resolve({ data: iterable }) };
				}),
				serialize: (data) => config.transformer.output.serialize(data),
				onError: (cause) => {
					var _opts$onError3, _info$type;
					(_opts$onError3 = opts.onError) === null || _opts$onError3 === void 0 || _opts$onError3.call(opts, {
						error: (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause),
						path: void 0,
						input: void 0,
						ctx: ctxManager.valueOrUndefined(),
						req: opts.req,
						type: (_info$type = info === null || info === void 0 ? void 0 : info.type) !== null && _info$type !== void 0 ? _info$type : "unknown"
					});
				},
				formatError(errorOpts) {
					var _call$procedure$_def$3, _call$procedure4;
					const call = info === null || info === void 0 ? void 0 : info.calls[errorOpts.path[0]];
					const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(errorOpts.error);
					const input = call === null || call === void 0 ? void 0 : call.result();
					const path = call === null || call === void 0 ? void 0 : call.path;
					const type = (_call$procedure$_def$3 = call === null || call === void 0 || (_call$procedure4 = call.procedure) === null || _call$procedure4 === void 0 ? void 0 : _call$procedure4._def.type) !== null && _call$procedure$_def$3 !== void 0 ? _call$procedure$_def$3 : "unknown";
					const shape = (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
						config,
						ctx: ctxManager.valueOrUndefined(),
						error,
						input,
						path,
						type
					});
					return shape;
				}
			}));
			return new Response(stream, {
				headers,
				status: headResponse$1.status
			});
		}
		/**
		* Non-streaming response:
		* - await all responses in parallel, blocking on the slowest one
		* - create headers with known response body
		* - return a complete HTTPResponse
		*/
		headers.set("content-type", "application/json");
		const results = (await Promise.all(rpcCalls)).map((res) => {
			const [error, result] = res;
			if (error) return res;
			if (isDataStream(result.data)) return [new tracked_Bjtgv3wJ/* TRPCError */.gt({
				code: "UNSUPPORTED_MEDIA_TYPE",
				message: "Cannot use stream-like response in non-streaming request - use httpBatchStreamLink"
			}), void 0];
			return res;
		});
		const resultAsRPCResponse = results.map(([error, result], index) => {
			const call = info.calls[index];
			if (error) {
				var _call$procedure$_def$4, _call$procedure5;
				return { error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
					config,
					ctx: ctxManager.valueOrUndefined(),
					error,
					input: call.result(),
					path: call.path,
					type: (_call$procedure$_def$4 = (_call$procedure5 = call.procedure) === null || _call$procedure5 === void 0 ? void 0 : _call$procedure5._def.type) !== null && _call$procedure$_def$4 !== void 0 ? _call$procedure$_def$4 : "unknown"
				}) };
			}
			return { result: { data: result.data } };
		});
		const errors = results.map(([error]) => error).filter(Boolean);
		const headResponse = initResponse({
			ctx: ctxManager.valueOrUndefined(),
			info,
			responseMeta: opts.responseMeta,
			untransformedJSON: resultAsRPCResponse,
			errors,
			headers
		});
		return new Response(JSON.stringify((0,tracked_Bjtgv3wJ/* transformTRPCResponse */.t9)(config, resultAsRPCResponse)), {
			status: headResponse.status,
			headers
		});
	} catch (cause) {
		var _info$type2;
		const [_infoError, info] = infoTuple;
		const ctx = ctxManager.valueOrUndefined();
		const { error, untransformedJSON, body } = caughtErrorToData(cause, {
			opts,
			ctx: ctxManager.valueOrUndefined(),
			type: (_info$type2 = info === null || info === void 0 ? void 0 : info.type) !== null && _info$type2 !== void 0 ? _info$type2 : "unknown"
		});
		const headResponse = initResponse({
			ctx,
			info,
			responseMeta: opts.responseMeta,
			untransformedJSON,
			errors: [error],
			headers
		});
		return new Response(body, {
			status: headResponse.status,
			headers
		});
	}
}

//#endregion

//# sourceMappingURL=resolveResponse-BVDlNZwN.mjs.map
// EXTERNAL MODULE: external "node:http"
var external_node_http_ = __webpack_require__(37067);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/node-http-DtA2iLK9.mjs






//#region src/adapters/node-http/incomingMessageToRequest.ts
function createBody(req, opts) {
	if ("body" in req) {
		if (req.body === void 0) return void 0;
		if (typeof req.body === "string") return req.body;
		if (req.body instanceof external_node_http_.IncomingMessage) return req.body;
		return JSON.stringify(req.body);
	}
	let size = 0;
	let hasClosed = false;
	return new ReadableStream({
		start(controller) {
			const onData = (chunk) => {
				size += chunk.length;
				if (!opts.maxBodySize || size <= opts.maxBodySize) {
					controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
					return;
				}
				controller.error(new tracked_Bjtgv3wJ/* TRPCError */.gt({ code: "PAYLOAD_TOO_LARGE" }));
				hasClosed = true;
				req.off("data", onData);
				req.off("end", onEnd);
			};
			const onEnd = () => {
				if (hasClosed) return;
				hasClosed = true;
				req.off("data", onData);
				req.off("end", onEnd);
				controller.close();
			};
			req.on("data", onData);
			req.on("end", onEnd);
		},
		cancel() {
			req.destroy();
		}
	});
}
function createURL(req) {
	try {
		var _ref, _req$headers$host;
		const protocol = req.headers[":scheme"] && req.headers[":scheme"] === "https" || req.socket && "encrypted" in req.socket && req.socket.encrypted ? "https:" : "http:";
		const host = (_ref = (_req$headers$host = req.headers.host) !== null && _req$headers$host !== void 0 ? _req$headers$host : req.headers[":authority"]) !== null && _ref !== void 0 ? _ref : "localhost";
		return new URL(req.url, `${protocol}//${host}`);
	} catch (cause) {
		throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
			code: "BAD_REQUEST",
			message: "Invalid URL",
			cause
		});
	}
}
function createHeaders(incoming) {
	const headers = new Headers();
	for (const key in incoming) {
		const value = incoming[key];
		if (typeof key === "string" && key.startsWith(":")) continue;
		if (Array.isArray(value)) for (const item of value) headers.append(key, item);
		else if (value != null) headers.append(key, value);
	}
	return headers;
}
/**
* Convert an [`IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage) to a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
*/
function incomingMessageToRequest(req, res, opts) {
	const ac = new AbortController();
	const onAbort = () => {
		res.off("close", onAbort);
		req.off("aborted", onAbort);
		ac.abort();
	};
	res.once("close", onAbort);
	req.once("aborted", onAbort);
	const url = createURL(req);
	const init = {
		headers: createHeaders(req.headers),
		method: req.method,
		signal: ac.signal
	};
	if (req.method !== "GET" && req.method !== "HEAD") {
		init.body = createBody(req, opts);
		init.duplex = "half";
	}
	const request = new Request(url, init);
	return request;
}

//#endregion
//#region src/adapters/node-http/writeResponse.ts
async function writeResponseBodyChunk(res, chunk) {
	if (res.write(chunk) === false) await new Promise((resolve, reject) => {
		const onError = (err) => {
			reject(err);
			cleanup();
		};
		const onDrain = () => {
			resolve();
			cleanup();
		};
		const cleanup = () => {
			res.off("error", onError);
			res.off("drain", onDrain);
		};
		res.once("error", onError);
		res.once("drain", onDrain);
	});
}
/**
* @internal
*/
async function writeResponseBody(opts) {
	const { res } = opts;
	try {
		const writableStream = new WritableStream({ async write(chunk) {
			var _res$flush;
			await writeResponseBodyChunk(res, chunk);
			(_res$flush = res.flush) === null || _res$flush === void 0 || _res$flush.call(res);
		} });
		await opts.body.pipeTo(writableStream, { signal: opts.signal });
	} catch (err) {
		if (isAbortError(err)) return;
		throw err;
	}
}
/**
* @internal
*/
async function writeResponse(opts) {
	const { response, rawResponse } = opts;
	if (rawResponse.statusCode === 200) rawResponse.statusCode = response.status;
	for (const [key, value] of response.headers) rawResponse.setHeader(key, value);
	try {
		if (response.body) await writeResponseBody({
			res: rawResponse,
			signal: opts.request.signal,
			body: response.body
		});
	} catch (err) {
		if (!rawResponse.headersSent) rawResponse.statusCode = 500;
		throw err;
	} finally {
		rawResponse.end();
	}
}

//#endregion
//#region src/adapters/node-http/nodeHTTPRequestHandler.ts
var node_http_DtA2iLK9_import_objectSpread2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
/**
* @internal
*/
function internal_exceptionHandler(opts) {
	return (cause) => {
		var _opts$onError;
		const { res, req } = opts;
		const error = getTRPCErrorFromUnknown(cause);
		const shape = getErrorShape({
			config: opts.router._def._config,
			error,
			type: "unknown",
			path: void 0,
			input: void 0,
			ctx: void 0
		});
		(_opts$onError = opts.onError) === null || _opts$onError === void 0 || _opts$onError.call(opts, {
			req,
			error,
			type: "unknown",
			path: void 0,
			input: void 0,
			ctx: void 0
		});
		const transformed = transformTRPCResponse(opts.router._def._config, { error: shape });
		res.statusCode = shape.data.httpStatus;
		res.end(JSON.stringify(transformed));
	};
}
/**
* @remark the promise never rejects
*/
async function nodeHTTPRequestHandler(opts) {
	return new Promise((resolve) => {
		var _opts$middleware;
		const handleViaMiddleware = (_opts$middleware = opts.middleware) !== null && _opts$middleware !== void 0 ? _opts$middleware : (_req, _res, next) => next();
		opts.res.once("finish", () => {
			resolve();
		});
		return handleViaMiddleware(opts.req, opts.res, (err) => {
			run(async () => {
				var _opts$maxBodySize;
				const request = incomingMessageToRequest(opts.req, opts.res, { maxBodySize: (_opts$maxBodySize = opts.maxBodySize) !== null && _opts$maxBodySize !== void 0 ? _opts$maxBodySize : null });
				const createContext = async (innerOpts) => {
					var _opts$createContext;
					return await ((_opts$createContext = opts.createContext) === null || _opts$createContext === void 0 ? void 0 : _opts$createContext.call(opts, (0, node_http_DtA2iLK9_import_objectSpread2.default)((0, node_http_DtA2iLK9_import_objectSpread2.default)({}, opts), innerOpts)));
				};
				const response = await resolveResponse((0, node_http_DtA2iLK9_import_objectSpread2.default)((0, node_http_DtA2iLK9_import_objectSpread2.default)({}, opts), {}, {
					req: request,
					error: err ? getTRPCErrorFromUnknown(err) : null,
					createContext,
					onError(o) {
						var _opts$onError2;
						opts === null || opts === void 0 || (_opts$onError2 = opts.onError) === null || _opts$onError2 === void 0 || _opts$onError2.call(opts, (0, node_http_DtA2iLK9_import_objectSpread2.default)((0, node_http_DtA2iLK9_import_objectSpread2.default)({}, o), {}, { req: opts.req }));
					}
				}));
				await writeResponse({
					request,
					response,
					rawResponse: opts.res
				});
			}).catch(internal_exceptionHandler(opts));
		});
	});
}

//#endregion

//# sourceMappingURL=node-http-DtA2iLK9.mjs.map
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/parseTRPCMessage-CTow-umk.mjs


//#region src/unstable-core-do-not-import/procedure.ts
const procedureTypes = [
	"query",
	"mutation",
	"subscription"
];

//#endregion
//#region src/unstable-core-do-not-import/rpc/parseTRPCMessage.ts
/* istanbul ignore next -- @preserve */
function assertIsObject(obj) {
	if (!(0,codes_DagpWZLc/* isObject */.Gv)(obj)) throw new Error("Not an object");
}
/* istanbul ignore next -- @preserve */
function assertIsProcedureType(obj) {
	if (!procedureTypes.includes(obj)) throw new Error("Invalid procedure type");
}
/* istanbul ignore next -- @preserve */
function assertIsRequestId(obj) {
	if (obj !== null && typeof obj === "number" && isNaN(obj) && typeof obj !== "string") throw new Error("Invalid request id");
}
/* istanbul ignore next -- @preserve */
function assertIsString(obj) {
	if (typeof obj !== "string") throw new Error("Invalid string");
}
/* istanbul ignore next -- @preserve */
function assertIsJSONRPC2OrUndefined(obj) {
	if (typeof obj !== "undefined" && obj !== "2.0") throw new Error("Must be JSONRPC 2.0");
}
/** @public */
function parseTRPCMessage(obj, transformer) {
	assertIsObject(obj);
	const { id, jsonrpc, method, params } = obj;
	assertIsRequestId(id);
	assertIsJSONRPC2OrUndefined(jsonrpc);
	if (method === "subscription.stop") return {
		id,
		jsonrpc,
		method
	};
	assertIsProcedureType(method);
	assertIsObject(params);
	const { input: rawInput, path, lastEventId } = params;
	assertIsString(path);
	if (lastEventId !== void 0) assertIsString(lastEventId);
	const input = transformer.input.deserialize(rawInput);
	return {
		id,
		jsonrpc,
		method,
		params: {
			input,
			path,
			lastEventId
		}
	};
}

//#endregion

//# sourceMappingURL=parseTRPCMessage-CTow-umk.mjs.map
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/ws-CJgZE7Hg.mjs








//#region src/adapters/wsEncoder.ts
/**
* Default JSON encoder - used when no encoder is specified.
* This maintains backwards compatibility with existing behavior.
*/
const jsonEncoder = {
	encode: (data) => JSON.stringify(data),
	decode: (data) => {
		if (typeof data !== "string") throw new Error("jsonEncoder received binary data. JSON uses text frames. Use a binary encoder for binary data.");
		return JSON.parse(data);
	}
};

//#endregion
//#region src/adapters/ws.ts
var ws_CJgZE7Hg_import_objectSpread2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
var ws_CJgZE7Hg_import_usingCtx = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)(require_usingCtx(), 1);
/**
* Importing ws causes a build error
* @see https://github.com/trpc/trpc/pull/5279
*/
const WEBSOCKET_OPEN = 1;
function getWSConnectionHandler(opts) {
	var _opts$experimental_en;
	const { createContext, router } = opts;
	const { transformer } = router._def._config;
	const encoder = (_opts$experimental_en = opts.experimental_encoder) !== null && _opts$experimental_en !== void 0 ? _opts$experimental_en : jsonEncoder;
	return (client, req) => {
		var _opts$keepAlive;
		const clientSubscriptions = /* @__PURE__ */ new Map();
		const abortController = new AbortController();
		if ((_opts$keepAlive = opts.keepAlive) === null || _opts$keepAlive === void 0 ? void 0 : _opts$keepAlive.enabled) {
			const { pingMs, pongWaitMs } = opts.keepAlive;
			handleKeepAlive(client, pingMs, pongWaitMs);
		}
		function respond(untransformedJSON) {
			client.send(encoder.encode((0,tracked_Bjtgv3wJ/* transformTRPCResponse */.t9)(router._def._config, untransformedJSON)));
		}
		async function createCtxPromise(getConnectionParams) {
			try {
				return await (0,codes_DagpWZLc/* run */.eF)(async () => {
					ctx = await (createContext === null || createContext === void 0 ? void 0 : createContext({
						req,
						res: client,
						info: {
							connectionParams: getConnectionParams(),
							calls: [],
							isBatchCall: false,
							accept: null,
							type: "unknown",
							signal: abortController.signal,
							url: null
						}
					}));
					return {
						ok: true,
						value: ctx
					};
				});
			} catch (cause) {
				var _opts$onError, _globalThis$setImmedi;
				const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause);
				(_opts$onError = opts.onError) === null || _opts$onError === void 0 || _opts$onError.call(opts, {
					error,
					path: void 0,
					type: "unknown",
					ctx,
					req,
					input: void 0
				});
				respond({
					id: null,
					error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
						config: router._def._config,
						error,
						type: "unknown",
						path: void 0,
						input: void 0,
						ctx
					})
				});
				((_globalThis$setImmedi = globalThis.setImmediate) !== null && _globalThis$setImmedi !== void 0 ? _globalThis$setImmedi : globalThis.setTimeout)(() => {
					client.close();
				});
				return {
					ok: false,
					error
				};
			}
		}
		let ctx = void 0;
		/**
		* promise for initializing the context
		*
		* - the context promise will be created immediately on connection if no connectionParams are expected
		* - if connection params are expected, they will be created once received
		*/
		let ctxPromise = createURL(req).searchParams.get("connectionParams") === "1" ? null : createCtxPromise(() => null);
		function handleRequest(msg, batchIndex) {
			const { id, jsonrpc } = msg;
			if (id === null) {
				var _opts$onError2;
				const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(new tracked_Bjtgv3wJ/* TRPCError */.gt({
					code: "PARSE_ERROR",
					message: "`id` is required"
				}));
				(_opts$onError2 = opts.onError) === null || _opts$onError2 === void 0 || _opts$onError2.call(opts, {
					error,
					path: void 0,
					type: "unknown",
					ctx,
					req,
					input: void 0
				});
				respond({
					id,
					jsonrpc,
					error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
						config: router._def._config,
						error,
						type: "unknown",
						path: void 0,
						input: void 0,
						ctx
					})
				});
				return;
			}
			if (msg.method === "subscription.stop") {
				var _clientSubscriptions$;
				(_clientSubscriptions$ = clientSubscriptions.get(id)) === null || _clientSubscriptions$ === void 0 || _clientSubscriptions$.abort();
				return;
			}
			const { path, lastEventId } = msg.params;
			let { input } = msg.params;
			const type = msg.method;
			if (lastEventId !== void 0) if ((0,codes_DagpWZLc/* isObject */.Gv)(input)) input = (0, ws_CJgZE7Hg_import_objectSpread2.default)((0, ws_CJgZE7Hg_import_objectSpread2.default)({}, input), {}, { lastEventId });
			else {
				var _input;
				(_input = input) !== null && _input !== void 0 || (input = { lastEventId });
			}
			(0,codes_DagpWZLc/* run */.eF)(async () => {
				const res = await ctxPromise;
				if (!res.ok) throw res.error;
				const abortController$1 = new AbortController();
				const result = await (0,tracked_Bjtgv3wJ/* callProcedure */.OD)({
					router,
					path,
					getRawInput: async () => input,
					ctx,
					type,
					signal: abortController$1.signal,
					batchIndex
				});
				const isIterableResult = (0,codes_DagpWZLc/* isAsyncIterable */.Td)(result) || isObservable(result);
				if (type !== "subscription") {
					if (isIterableResult) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
						code: "UNSUPPORTED_MEDIA_TYPE",
						message: `Cannot return an async iterable or observable from a ${type} procedure with WebSockets`
					});
					respond({
						id,
						jsonrpc,
						result: {
							type: "data",
							data: result
						}
					});
					return;
				}
				if (!isIterableResult) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
					message: `Subscription ${path} did not return an observable or a AsyncGenerator`,
					code: "INTERNAL_SERVER_ERROR"
				});
				/* istanbul ignore next -- @preserve */
				if (client.readyState !== WEBSOCKET_OPEN) return;
				/* istanbul ignore next -- @preserve */
				if (clientSubscriptions.has(id)) throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
					message: `Duplicate id ${id}`,
					code: "BAD_REQUEST"
				});
				const iterable = isObservable(result) ? observableToAsyncIterable(result, abortController$1.signal) : result;
				(0,codes_DagpWZLc/* run */.eF)(async () => {
					try {
						var _usingCtx = (0, ws_CJgZE7Hg_import_usingCtx.default)();
						const iterator = _usingCtx.a(iteratorResource(iterable));
						const abortPromise = new Promise((resolve) => {
							abortController$1.signal.onabort = () => resolve("abort");
						});
						let next;
						let result$1;
						while (true) {
							next = await Unpromise.race([iterator.next().catch(tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO), abortPromise]);
							if (next === "abort") {
								var _iterator$return;
								await ((_iterator$return = iterator.return) === null || _iterator$return === void 0 ? void 0 : _iterator$return.call(iterator));
								break;
							}
							if (next instanceof Error) {
								var _opts$onError3;
								const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(next);
								(_opts$onError3 = opts.onError) === null || _opts$onError3 === void 0 || _opts$onError3.call(opts, {
									error,
									path,
									type,
									ctx,
									req,
									input
								});
								respond({
									id,
									jsonrpc,
									error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
										config: router._def._config,
										error,
										type,
										path,
										input,
										ctx
									})
								});
								break;
							}
							if (next.done) break;
							result$1 = {
								type: "data",
								data: next.value
							};
							if ((0,tracked_Bjtgv3wJ/* isTrackedEnvelope */.vJ)(next.value)) {
								const [id$1, data] = next.value;
								result$1.id = id$1;
								result$1.data = {
									id: id$1,
									data
								};
							}
							respond({
								id,
								jsonrpc,
								result: result$1
							});
							next = null;
							result$1 = null;
						}
						respond({
							id,
							jsonrpc,
							result: { type: "stopped" }
						});
						clientSubscriptions.delete(id);
					} catch (_) {
						_usingCtx.e = _;
					} finally {
						await _usingCtx.d();
					}
				}).catch((cause) => {
					var _opts$onError4;
					const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause);
					(_opts$onError4 = opts.onError) === null || _opts$onError4 === void 0 || _opts$onError4.call(opts, {
						error,
						path,
						type,
						ctx,
						req,
						input
					});
					respond({
						id,
						jsonrpc,
						error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
							config: router._def._config,
							error,
							type,
							path,
							input,
							ctx
						})
					});
					abortController$1.abort();
				});
				clientSubscriptions.set(id, abortController$1);
				respond({
					id,
					jsonrpc,
					result: { type: "started" }
				});
			}).catch((cause) => {
				var _opts$onError5;
				const error = (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause);
				(_opts$onError5 = opts.onError) === null || _opts$onError5 === void 0 || _opts$onError5.call(opts, {
					error,
					path,
					type,
					ctx,
					req,
					input
				});
				respond({
					id,
					jsonrpc,
					error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
						config: router._def._config,
						error,
						type,
						path,
						input,
						ctx
					})
				});
			});
		}
		client.on("message", (rawData, isBinary) => {
			if (!isBinary) {
				const msgStr = rawData.toString();
				if (msgStr === "PONG") return;
				if (msgStr === "PING") {
					if (!opts.dangerouslyDisablePong) client.send("PONG");
					return;
				}
			}
			if (!Buffer.isBuffer(rawData)) {
				const error = new tracked_Bjtgv3wJ/* TRPCError */.gt({
					code: "UNPROCESSABLE_CONTENT",
					message: "Unexpected WebSocket message format"
				});
				respond({
					id: null,
					error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
						config: router._def._config,
						error,
						type: "unknown",
						path: void 0,
						input: void 0,
						ctx
					})
				});
				return;
			}
			const data = isBinary ? rawData : rawData.toString("utf8");
			if (!ctxPromise) {
				ctxPromise = createCtxPromise(() => {
					let msg;
					try {
						msg = encoder.decode(data);
						if (!(0,codes_DagpWZLc/* isObject */.Gv)(msg)) throw new Error("Message was not an object");
					} catch (cause) {
						throw new tracked_Bjtgv3wJ/* TRPCError */.gt({
							code: "PARSE_ERROR",
							message: `Malformed TRPCConnectionParamsMessage`,
							cause
						});
					}
					const connectionParams = parseConnectionParamsFromUnknown(msg.data);
					return connectionParams;
				});
				return;
			}
			const parsedMsgs = (0,codes_DagpWZLc/* run */.eF)(() => {
				try {
					const msgJSON = encoder.decode(data);
					const msgs = Array.isArray(msgJSON) ? msgJSON : [msgJSON];
					return msgs.map((raw) => parseTRPCMessage(raw, transformer));
				} catch (cause) {
					const error = new tracked_Bjtgv3wJ/* TRPCError */.gt({
						code: "PARSE_ERROR",
						cause
					});
					respond({
						id: null,
						error: (0,getErrorShape_vC8mUXJD/* getErrorShape */.KQ)({
							config: router._def._config,
							error,
							type: "unknown",
							path: void 0,
							input: void 0,
							ctx
						})
					});
					return [];
				}
			});
			parsedMsgs.map((msg, index) => handleRequest(msg, index));
		});
		client.on("error", (cause) => {
			var _opts$onError6;
			(_opts$onError6 = opts.onError) === null || _opts$onError6 === void 0 || _opts$onError6.call(opts, {
				ctx,
				error: (0,tracked_Bjtgv3wJ/* getTRPCErrorFromUnknown */.qO)(cause),
				input: void 0,
				path: void 0,
				type: "unknown",
				req
			});
		});
		client.once("close", () => {
			for (const sub of clientSubscriptions.values()) sub.abort();
			clientSubscriptions.clear();
			abortController.abort();
		});
	};
}
/**
* Handle WebSocket keep-alive messages
*/
function handleKeepAlive(client, pingMs = 3e4, pongWaitMs = 5e3) {
	let timeout = void 0;
	let ping = void 0;
	const schedulePing = () => {
		const scheduleTimeout = () => {
			timeout = setTimeout(() => {
				client.terminate();
			}, pongWaitMs);
		};
		ping = setTimeout(() => {
			client.send("PING");
			scheduleTimeout();
		}, pingMs);
	};
	const onMessage = () => {
		clearTimeout(ping);
		clearTimeout(timeout);
		schedulePing();
	};
	client.on("message", onMessage);
	client.on("close", () => {
		clearTimeout(ping);
		clearTimeout(timeout);
	});
	schedulePing();
}
function applyWSSHandler(opts) {
	var _opts$experimental_en2;
	const encoder = (_opts$experimental_en2 = opts.experimental_encoder) !== null && _opts$experimental_en2 !== void 0 ? _opts$experimental_en2 : jsonEncoder;
	const onConnection = getWSConnectionHandler(opts);
	opts.wss.on("connection", (client, req) => {
		var _req$url;
		if (opts.prefix && !((_req$url = req.url) === null || _req$url === void 0 ? void 0 : _req$url.startsWith(opts.prefix))) return;
		onConnection(client, req);
	});
	return { broadcastReconnectNotification: () => {
		const response = {
			id: null,
			method: "reconnect"
		};
		const data = encoder.encode(response);
		for (const client of opts.wss.clients) if (client.readyState === WEBSOCKET_OPEN) client.send(data);
	} };
}

//#endregion

//# sourceMappingURL=ws-CJgZE7Hg.mjs.map
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@trpc+server@11.11.0_typescript@5.9.3/node_modules/@trpc/server/dist/adapters/fastify/index.mjs














//#region src/adapters/fastify/fastifyRequestHandler.ts
var fastify_import_objectSpread2$1 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
async function fastifyRequestHandler(opts) {
	const createContext = async (innerOpts) => {
		var _opts$createContext;
		return await ((_opts$createContext = opts.createContext) === null || _opts$createContext === void 0 ? void 0 : _opts$createContext.call(opts, (0, fastify_import_objectSpread2$1.default)((0, fastify_import_objectSpread2$1.default)({}, opts), innerOpts)));
	};
	const incomingMessage = opts.req.raw;
	if ("body" in opts.req) incomingMessage.body = opts.req.body;
	const req = incomingMessageToRequest(incomingMessage, opts.res.raw, { maxBodySize: null });
	const res = await resolveResponse_BVDlNZwN_resolveResponse((0, fastify_import_objectSpread2$1.default)((0, fastify_import_objectSpread2$1.default)({}, opts), {}, {
		req,
		error: null,
		createContext,
		onError(o) {
			var _opts$onError;
			opts === null || opts === void 0 || (_opts$onError = opts.onError) === null || _opts$onError === void 0 || _opts$onError.call(opts, (0, fastify_import_objectSpread2$1.default)((0, fastify_import_objectSpread2$1.default)({}, o), {}, { req: opts.req }));
		}
	}));
	await opts.res.send(res);
}

//#endregion
//#region src/adapters/fastify/fastifyTRPCPlugin.ts
var fastify_import_objectSpread2 = (0,getErrorShape_vC8mUXJD/* __toESM */.f1)((0,getErrorShape_vC8mUXJD/* require_objectSpread2 */.jr)(), 1);
function fastifyTRPCPlugin(fastify, opts, done) {
	var _opts$prefix;
	fastify.removeContentTypeParser("application/json");
	fastify.addContentTypeParser("application/json", { parseAs: "string" }, function(_, body, _done) {
		_done(null, body);
	});
	fastify.removeContentTypeParser("multipart/form-data");
	fastify.addContentTypeParser("multipart/form-data", {}, function(_, body, _done) {
		_done(null, body);
	});
	let prefix = (_opts$prefix = opts.prefix) !== null && _opts$prefix !== void 0 ? _opts$prefix : "";
	if (typeof fastifyTRPCPlugin.default !== "function") prefix = "";
	fastify.all(`${prefix}/:path`, async (req, res) => {
		const path = req.params.path;
		await fastifyRequestHandler((0, fastify_import_objectSpread2.default)((0, fastify_import_objectSpread2.default)({}, opts.trpcOptions), {}, {
			req,
			res,
			path
		}));
	});
	if (opts.useWSS) {
		var _prefix;
		const trpcOptions = opts.trpcOptions;
		const onConnection = getWSConnectionHandler((0, fastify_import_objectSpread2.default)({}, trpcOptions));
		fastify.get((_prefix = prefix) !== null && _prefix !== void 0 ? _prefix : "/", { websocket: true }, (socket, req) => {
			var _trpcOptions$keepAliv;
			onConnection(socket, req.raw);
			if (trpcOptions === null || trpcOptions === void 0 || (_trpcOptions$keepAliv = trpcOptions.keepAlive) === null || _trpcOptions$keepAliv === void 0 ? void 0 : _trpcOptions$keepAliv.enabled) {
				const { pingMs, pongWaitMs } = trpcOptions.keepAlive;
				handleKeepAlive(socket, pingMs, pongWaitMs);
			}
		});
	}
	done();
}

//#endregion

//# sourceMappingURL=index.mjs.map

/***/ })

};

//# sourceMappingURL=708.index.js.map