export const id = 6;
export const ids = [6];
export const modules = {

/***/ 74108:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



module.exports = cliWidth;

function normalizeOpts(options) {
  const defaultOpts = {
    defaultWidth: 0,
    output: process.stdout,
    tty: __webpack_require__(52018),
  };

  if (!options) {
    return defaultOpts;
  }

  Object.keys(defaultOpts).forEach(function (key) {
    if (!options[key]) {
      options[key] = defaultOpts[key];
    }
  });

  return options;
}

function cliWidth(options) {
  const opts = normalizeOpts(options);

  if (opts.output.getWindowSize) {
    return opts.output.getWindowSize()[0] || opts.defaultWidth;
  }

  if (opts.tty.getWindowSize) {
    return opts.tty.getWindowSize()[1] || opts.defaultWidth;
  }

  if (opts.output.columns) {
    return opts.output.columns;
  }

  if (process.env.CLI_WIDTH) {
    const width = parseInt(process.env.CLI_WIDTH, 10);

    if (!isNaN(width) && width !== 0) {
      return width;
    }
  }

  return opts.defaultWidth;
}


/***/ }),

/***/ 47124:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const Stream = __webpack_require__(2203)

class MuteStream extends Stream {
  #isTTY = null

  constructor (opts = {}) {
    super(opts)
    this.writable = this.readable = true
    this.muted = false
    this.on('pipe', this._onpipe)
    this.replace = opts.replace

    // For readline-type situations
    // This much at the start of a line being redrawn after a ctrl char
    // is seen (such as backspace) won't be redrawn as the replacement
    this._prompt = opts.prompt || null
    this._hadControl = false
  }

  #destSrc (key, def) {
    if (this._dest) {
      return this._dest[key]
    }
    if (this._src) {
      return this._src[key]
    }
    return def
  }

  #proxy (method, ...args) {
    if (typeof this._dest?.[method] === 'function') {
      this._dest[method](...args)
    }
    if (typeof this._src?.[method] === 'function') {
      this._src[method](...args)
    }
  }

  get isTTY () {
    if (this.#isTTY !== null) {
      return this.#isTTY
    }
    return this.#destSrc('isTTY', false)
  }

  // basically just get replace the getter/setter with a regular value
  set isTTY (val) {
    this.#isTTY = val
  }

  get rows () {
    return this.#destSrc('rows')
  }

  get columns () {
    return this.#destSrc('columns')
  }

  mute () {
    this.muted = true
  }

  unmute () {
    this.muted = false
  }

  _onpipe (src) {
    this._src = src
  }

  pipe (dest, options) {
    this._dest = dest
    return super.pipe(dest, options)
  }

  pause () {
    if (this._src) {
      return this._src.pause()
    }
  }

  resume () {
    if (this._src) {
      return this._src.resume()
    }
  }

  write (c) {
    if (this.muted) {
      if (!this.replace) {
        return true
      }
      // eslint-disable-next-line no-control-regex
      if (c.match(/^\u001b/)) {
        if (c.indexOf(this._prompt) === 0) {
          c = c.slice(this._prompt.length)
          c = c.replace(/./g, this.replace)
          c = this._prompt + c
        }
        this._hadControl = true
        return this.emit('data', c)
      } else {
        if (this._prompt && this._hadControl &&
          c.indexOf(this._prompt) === 0) {
          this._hadControl = false
          this.emit('data', this._prompt)
          c = c.slice(this._prompt.length)
        }
        c = c.toString().replace(/./g, this.replace)
      }
    }
    this.emit('data', c)
  }

  end (c) {
    if (this.muted) {
      if (c && this.replace) {
        c = c.toString().replace(/./g, this.replace)
      } else {
        c = null
      }
    }
    if (c) {
      this.emit('data', c)
    }
    this.emit('end')
  }

  destroy (...args) {
    return this.#proxy('destroy', ...args)
  }

  destroySoon (...args) {
    return this.#proxy('destroySoon', ...args)
  }

  close (...args) {
    return this.#proxy('close', ...args)
  }
}

module.exports = MuteStream


/***/ }),

/***/ 56006:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  confirm: () => (/* reexport */ confirm_dist),
  input: () => (/* reexport */ input_dist)
});

// UNUSED EXPORTS: Separator, checkbox, editor, expand, number, password, rawlist, search, select

// EXTERNAL MODULE: external "node:readline"
var external_node_readline_ = __webpack_require__(80481);
// EXTERNAL MODULE: external "node:async_hooks"
var external_node_async_hooks_ = __webpack_require__(16698);
// EXTERNAL MODULE: ../../node_modules/.pnpm/mute-stream@3.0.0/node_modules/mute-stream/lib/index.js
var lib = __webpack_require__(47124);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/signal-exit@4.1.0/node_modules/signal-exit/dist/mjs/signals.js
/**
 * This is not the set of all possible signals.
 *
 * It IS, however, the set of all signals that trigger
 * an exit on either Linux or BSD systems.  Linux is a
 * superset of the signal names supported on BSD, and
 * the unknown signals just fail to register, so we can
 * catch that easily enough.
 *
 * Windows signals are a different set, since there are
 * signals that terminate Windows processes, but don't
 * terminate (or don't even exist) on Posix systems.
 *
 * Don't bother with SIGKILL.  It's uncatchable, which
 * means that we can't fire any callbacks anyway.
 *
 * If a user does happen to register a handler on a non-
 * fatal signal like SIGWINCH or something, and then
 * exit, it'll end up firing `process.emit('exit')`, so
 * the handler will be fired anyway.
 *
 * SIGBUS, SIGFPE, SIGSEGV and SIGILL, when not raised
 * artificially, inherently leave the process in a
 * state from which it is not safe to try and enter JS
 * listeners.
 */
const signals = [];
signals.push('SIGHUP', 'SIGINT', 'SIGTERM');
if (process.platform !== 'win32') {
    signals.push('SIGALRM', 'SIGABRT', 'SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT'
    // should detect profiler and enable/disable accordingly.
    // see #21
    // 'SIGPROF'
    );
}
if (process.platform === 'linux') {
    signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT');
}
//# sourceMappingURL=signals.js.map
;// CONCATENATED MODULE: ../../node_modules/.pnpm/signal-exit@4.1.0/node_modules/signal-exit/dist/mjs/index.js
// Note: since nyc uses this module to output coverage, any lines
// that are in the direct sync flow of nyc's outputCoverage are
// ignored, since we can never get coverage for them.
// grab a reference to node's real process object right away


const processOk = (process) => !!process &&
    typeof process === 'object' &&
    typeof process.removeListener === 'function' &&
    typeof process.emit === 'function' &&
    typeof process.reallyExit === 'function' &&
    typeof process.listeners === 'function' &&
    typeof process.kill === 'function' &&
    typeof process.pid === 'number' &&
    typeof process.on === 'function';
const kExitEmitter = Symbol.for('signal-exit emitter');
const global = globalThis;
const ObjectDefineProperty = Object.defineProperty.bind(Object);
// teeny special purpose ee
class Emitter {
    emitted = {
        afterExit: false,
        exit: false,
    };
    listeners = {
        afterExit: [],
        exit: [],
    };
    count = 0;
    id = Math.random();
    constructor() {
        if (global[kExitEmitter]) {
            return global[kExitEmitter];
        }
        ObjectDefineProperty(global, kExitEmitter, {
            value: this,
            writable: false,
            enumerable: false,
            configurable: false,
        });
    }
    on(ev, fn) {
        this.listeners[ev].push(fn);
    }
    removeListener(ev, fn) {
        const list = this.listeners[ev];
        const i = list.indexOf(fn);
        /* c8 ignore start */
        if (i === -1) {
            return;
        }
        /* c8 ignore stop */
        if (i === 0 && list.length === 1) {
            list.length = 0;
        }
        else {
            list.splice(i, 1);
        }
    }
    emit(ev, code, signal) {
        if (this.emitted[ev]) {
            return false;
        }
        this.emitted[ev] = true;
        let ret = false;
        for (const fn of this.listeners[ev]) {
            ret = fn(code, signal) === true || ret;
        }
        if (ev === 'exit') {
            ret = this.emit('afterExit', code, signal) || ret;
        }
        return ret;
    }
}
class SignalExitBase {
}
const signalExitWrap = (handler) => {
    return {
        onExit(cb, opts) {
            return handler.onExit(cb, opts);
        },
        load() {
            return handler.load();
        },
        unload() {
            return handler.unload();
        },
    };
};
class SignalExitFallback extends SignalExitBase {
    onExit() {
        return () => { };
    }
    load() { }
    unload() { }
}
class SignalExit extends SignalExitBase {
    // "SIGHUP" throws an `ENOSYS` error on Windows,
    // so use a supported signal instead
    /* c8 ignore start */
    #hupSig = mjs_process.platform === 'win32' ? 'SIGINT' : 'SIGHUP';
    /* c8 ignore stop */
    #emitter = new Emitter();
    #process;
    #originalProcessEmit;
    #originalProcessReallyExit;
    #sigListeners = {};
    #loaded = false;
    constructor(process) {
        super();
        this.#process = process;
        // { <signal>: <listener fn>, ... }
        this.#sigListeners = {};
        for (const sig of signals) {
            this.#sigListeners[sig] = () => {
                // If there are no other listeners, an exit is coming!
                // Simplest way: remove us and then re-send the signal.
                // We know that this will kill the process, so we can
                // safely emit now.
                const listeners = this.#process.listeners(sig);
                let { count } = this.#emitter;
                // This is a workaround for the fact that signal-exit v3 and signal
                // exit v4 are not aware of each other, and each will attempt to let
                // the other handle it, so neither of them do. To correct this, we
                // detect if we're the only handler *except* for previous versions
                // of signal-exit, and increment by the count of listeners it has
                // created.
                /* c8 ignore start */
                const p = process;
                if (typeof p.__signal_exit_emitter__ === 'object' &&
                    typeof p.__signal_exit_emitter__.count === 'number') {
                    count += p.__signal_exit_emitter__.count;
                }
                /* c8 ignore stop */
                if (listeners.length === count) {
                    this.unload();
                    const ret = this.#emitter.emit('exit', null, sig);
                    /* c8 ignore start */
                    const s = sig === 'SIGHUP' ? this.#hupSig : sig;
                    if (!ret)
                        process.kill(process.pid, s);
                    /* c8 ignore stop */
                }
            };
        }
        this.#originalProcessReallyExit = process.reallyExit;
        this.#originalProcessEmit = process.emit;
    }
    onExit(cb, opts) {
        /* c8 ignore start */
        if (!processOk(this.#process)) {
            return () => { };
        }
        /* c8 ignore stop */
        if (this.#loaded === false) {
            this.load();
        }
        const ev = opts?.alwaysLast ? 'afterExit' : 'exit';
        this.#emitter.on(ev, cb);
        return () => {
            this.#emitter.removeListener(ev, cb);
            if (this.#emitter.listeners['exit'].length === 0 &&
                this.#emitter.listeners['afterExit'].length === 0) {
                this.unload();
            }
        };
    }
    load() {
        if (this.#loaded) {
            return;
        }
        this.#loaded = true;
        // This is the number of onSignalExit's that are in play.
        // It's important so that we can count the correct number of
        // listeners on signals, and don't wait for the other one to
        // handle it instead of us.
        this.#emitter.count += 1;
        for (const sig of signals) {
            try {
                const fn = this.#sigListeners[sig];
                if (fn)
                    this.#process.on(sig, fn);
            }
            catch (_) { }
        }
        this.#process.emit = (ev, ...a) => {
            return this.#processEmit(ev, ...a);
        };
        this.#process.reallyExit = (code) => {
            return this.#processReallyExit(code);
        };
    }
    unload() {
        if (!this.#loaded) {
            return;
        }
        this.#loaded = false;
        signals.forEach(sig => {
            const listener = this.#sigListeners[sig];
            /* c8 ignore start */
            if (!listener) {
                throw new Error('Listener not defined for signal: ' + sig);
            }
            /* c8 ignore stop */
            try {
                this.#process.removeListener(sig, listener);
                /* c8 ignore start */
            }
            catch (_) { }
            /* c8 ignore stop */
        });
        this.#process.emit = this.#originalProcessEmit;
        this.#process.reallyExit = this.#originalProcessReallyExit;
        this.#emitter.count -= 1;
    }
    #processReallyExit(code) {
        /* c8 ignore start */
        if (!processOk(this.#process)) {
            return 0;
        }
        this.#process.exitCode = code || 0;
        /* c8 ignore stop */
        this.#emitter.emit('exit', this.#process.exitCode, null);
        return this.#originalProcessReallyExit.call(this.#process, this.#process.exitCode);
    }
    #processEmit(ev, ...args) {
        const og = this.#originalProcessEmit;
        if (ev === 'exit' && processOk(this.#process)) {
            if (typeof args[0] === 'number') {
                this.#process.exitCode = args[0];
                /* c8 ignore start */
            }
            /* c8 ignore start */
            const ret = og.call(this.#process, ev, ...args);
            /* c8 ignore start */
            this.#emitter.emit('exit', this.#process.exitCode, null);
            /* c8 ignore stop */
            return ret;
        }
        else {
            return og.call(this.#process, ev, ...args);
        }
    }
}
const mjs_process = globalThis.process;
// wrap so that we call the method on the actual handler, without
// exporting it directly.
const { 
/**
 * Called when the process is exiting, whether via signal, explicit
 * exit, or running out of stuff to do.
 *
 * If the global process object is not suitable for instrumentation,
 * then this will be a no-op.
 *
 * Returns a function that may be used to unload signal-exit.
 */
onExit, 
/**
 * Load the listeners.  Likely you never need to call this, unless
 * doing a rather deep integration with signal-exit functionality.
 * Mostly exposed for the benefit of testing.
 *
 * @internal
 */
load, 
/**
 * Unload the listeners.  Likely you never need to call this, unless
 * doing a rather deep integration with signal-exit functionality.
 * Mostly exposed for the benefit of testing.
 *
 * @internal
 */
unload, } = signalExitWrap(processOk(mjs_process) ? new SignalExit(mjs_process) : new SignalExitFallback());
//# sourceMappingURL=index.js.map
// EXTERNAL MODULE: external "node:util"
var external_node_util_ = __webpack_require__(57975);
// EXTERNAL MODULE: ../../node_modules/.pnpm/cli-width@4.1.0/node_modules/cli-width/index.js
var cli_width = __webpack_require__(74108);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/utils.js
/* MAIN */
const getCodePointsLength = (() => {
    const SURROGATE_PAIR_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
    return (input) => {
        let surrogatePairsNr = 0;
        SURROGATE_PAIR_RE.lastIndex = 0;
        while (SURROGATE_PAIR_RE.test(input)) {
            surrogatePairsNr += 1;
        }
        return input.length - surrogatePairsNr;
    };
})();
const isFullWidth = (x) => {
    return x === 0x3000 || x >= 0xFF01 && x <= 0xFF60 || x >= 0xFFE0 && x <= 0xFFE6;
};
const isWideNotCJKTNotEmoji = (x) => {
    return x === 0x231B || x === 0x2329 || x >= 0x2FF0 && x <= 0x2FFF || x >= 0x3001 && x <= 0x303E || x >= 0x3099 && x <= 0x30FF || x >= 0x3105 && x <= 0x312F || x >= 0x3131 && x <= 0x318E || x >= 0x3190 && x <= 0x31E3 || x >= 0x31EF && x <= 0x321E || x >= 0x3220 && x <= 0x3247 || x >= 0x3250 && x <= 0x4DBF || x >= 0xFE10 && x <= 0xFE19 || x >= 0xFE30 && x <= 0xFE52 || x >= 0xFE54 && x <= 0xFE66 || x >= 0xFE68 && x <= 0xFE6B || x >= 0x1F200 && x <= 0x1F202 || x >= 0x1F210 && x <= 0x1F23B || x >= 0x1F240 && x <= 0x1F248 || x >= 0x20000 && x <= 0x2FFFD || x >= 0x30000 && x <= 0x3FFFD;
};
/* EXPORT */


;// CONCATENATED MODULE: ../../node_modules/.pnpm/fast-string-truncated-width@3.0.3/node_modules/fast-string-truncated-width/dist/index.js
/* IMPORT */

/* HELPERS */
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]|\u001b\]8;[^;]*;.*?(?:\u0007|\u001b\u005c)/y;
const CONTROL_RE = /[\x00-\x08\x0A-\x1F\x7F-\x9F]{1,1000}/y;
const CJKT_WIDE_RE = /(?:(?![\uFF61-\uFF9F\uFF00-\uFFEF])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Tangut}]){1,1000}/yu;
const TAB_RE = /\t{1,1000}/y;
const EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]{2}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,3}\u{E007F}|(?:\p{Emoji}\uFE0F\u20E3?|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation})(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F\u20E3?))*/yu;
const LATIN_RE = /(?:[\x20-\x7E\xA0-\xFF](?!\uFE0F)){1,1000}/y;
const MODIFIER_RE = /\p{M}+/gu;
const NO_TRUNCATION = { limit: Infinity, ellipsis: '' };
/* MAIN */
const getStringTruncatedWidth = (input, truncationOptions = {}, widthOptions = {}) => {
    /* CONSTANTS */
    const LIMIT = truncationOptions.limit ?? Infinity;
    const ELLIPSIS = truncationOptions.ellipsis ?? '';
    const ELLIPSIS_WIDTH = truncationOptions?.ellipsisWidth ?? (ELLIPSIS ? getStringTruncatedWidth(ELLIPSIS, NO_TRUNCATION, widthOptions).width : 0);
    const ANSI_WIDTH = 0;
    const CONTROL_WIDTH = widthOptions.controlWidth ?? 0;
    const TAB_WIDTH = widthOptions.tabWidth ?? 8;
    const EMOJI_WIDTH = widthOptions.emojiWidth ?? 2;
    const FULL_WIDTH_WIDTH = 2;
    const REGULAR_WIDTH = widthOptions.regularWidth ?? 1;
    const WIDE_WIDTH = widthOptions.wideWidth ?? FULL_WIDTH_WIDTH;
    const PARSE_BLOCKS = [
        [LATIN_RE, REGULAR_WIDTH],
        [ANSI_RE, ANSI_WIDTH],
        [CONTROL_RE, CONTROL_WIDTH],
        [TAB_RE, TAB_WIDTH],
        [EMOJI_RE, EMOJI_WIDTH],
        [CJKT_WIDE_RE, WIDE_WIDTH],
    ];
    /* STATE */
    let indexPrev = 0;
    let index = 0;
    let length = input.length;
    let lengthExtra = 0;
    let truncationEnabled = false;
    let truncationIndex = length;
    let truncationLimit = Math.max(0, LIMIT - ELLIPSIS_WIDTH);
    let unmatchedStart = 0;
    let unmatchedEnd = 0;
    let width = 0;
    let widthExtra = 0;
    /* PARSE LOOP */
    outer: while (true) {
        /* UNMATCHED */
        if ((unmatchedEnd > unmatchedStart) || (index >= length && index > indexPrev)) {
            const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrev, index);
            lengthExtra = 0;
            for (const char of unmatched.replaceAll(MODIFIER_RE, '')) {
                const codePoint = char.codePointAt(0) || 0;
                if (isFullWidth(codePoint)) {
                    widthExtra = FULL_WIDTH_WIDTH;
                }
                else if (isWideNotCJKTNotEmoji(codePoint)) {
                    widthExtra = WIDE_WIDTH;
                }
                else {
                    widthExtra = REGULAR_WIDTH;
                }
                if ((width + widthExtra) > truncationLimit) {
                    truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrev) + lengthExtra);
                }
                if ((width + widthExtra) > LIMIT) {
                    truncationEnabled = true;
                    break outer;
                }
                lengthExtra += char.length;
                width += widthExtra;
            }
            unmatchedStart = unmatchedEnd = 0;
        }
        /* EXITING */
        if (index >= length) {
            break outer;
        }
        /* PARSE BLOCKS */
        for (let i = 0, l = PARSE_BLOCKS.length; i < l; i++) {
            const [BLOCK_RE, BLOCK_WIDTH] = PARSE_BLOCKS[i];
            BLOCK_RE.lastIndex = index;
            if (BLOCK_RE.test(input)) {
                lengthExtra = BLOCK_RE === CJKT_WIDE_RE ? getCodePointsLength(input.slice(index, BLOCK_RE.lastIndex)) : BLOCK_RE === EMOJI_RE ? 1 : BLOCK_RE.lastIndex - index;
                widthExtra = lengthExtra * BLOCK_WIDTH;
                if ((width + widthExtra) > truncationLimit) {
                    truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / BLOCK_WIDTH));
                }
                if ((width + widthExtra) > LIMIT) {
                    truncationEnabled = true;
                    break outer;
                }
                width += widthExtra;
                unmatchedStart = indexPrev;
                unmatchedEnd = index;
                index = indexPrev = BLOCK_RE.lastIndex;
                continue outer;
            }
        }
        /* UNMATCHED INDEX */
        index += 1;
    }
    /* RETURN */
    return {
        width: truncationEnabled ? truncationLimit : width,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        ellipsed: truncationEnabled && LIMIT >= ELLIPSIS_WIDTH
    };
};
/* EXPORT */
/* harmony default export */ const dist = (getStringTruncatedWidth);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/fast-string-width@3.0.2/node_modules/fast-string-width/dist/index.js
/* IMPORT */

/* HELPERS */
const dist_NO_TRUNCATION = {
    limit: Infinity,
    ellipsis: '',
    ellipsisWidth: 0,
};
/* MAIN */
const fastStringWidth = (input, options = {}) => {
    return dist(input, dist_NO_TRUNCATION, options).width;
};
/* EXPORT */
/* harmony default export */ const fast_string_width_dist = (fastStringWidth);

;// CONCATENATED MODULE: ../../node_modules/.pnpm/fast-wrap-ansi@0.2.0/node_modules/fast-wrap-ansi/lib/main.js

const ESC = '\x1B';
const CSI = '\x9B';
const END_CODE = 39;
const ANSI_ESCAPE_BELL = '\u0007';
const ANSI_CSI = '[';
const ANSI_OSC = ']';
const ANSI_SGR_TERMINATOR = 'm';
const ANSI_ESCAPE_LINK = `${ANSI_OSC}8;;`;
const GROUP_REGEX = new RegExp(`(?:\\${ANSI_CSI}(?<code>\\d+)m|\\${ANSI_ESCAPE_LINK}(?<uri>.*)${ANSI_ESCAPE_BELL})`, 'y');
const getClosingCode = (openingCode) => {
    if (openingCode >= 30 && openingCode <= 37)
        return 39;
    if (openingCode >= 90 && openingCode <= 97)
        return 39;
    if (openingCode >= 40 && openingCode <= 47)
        return 49;
    if (openingCode >= 100 && openingCode <= 107)
        return 49;
    if (openingCode === 1 || openingCode === 2)
        return 22;
    if (openingCode === 3)
        return 23;
    if (openingCode === 4)
        return 24;
    if (openingCode === 7)
        return 27;
    if (openingCode === 8)
        return 28;
    if (openingCode === 9)
        return 29;
    if (openingCode === 0)
        return 0;
    return undefined;
};
const wrapAnsiCode = (code) => `${ESC}${ANSI_CSI}${code}${ANSI_SGR_TERMINATOR}`;
const wrapAnsiHyperlink = (url) => `${ESC}${ANSI_ESCAPE_LINK}${url}${ANSI_ESCAPE_BELL}`;
const wrapWord = (rows, word, columns) => {
    const characters = word[Symbol.iterator]();
    let isInsideEscape = false;
    let isInsideLinkEscape = false;
    let lastRow = rows.at(-1);
    let visible = lastRow === undefined ? 0 : fast_string_width_dist(lastRow);
    let currentCharacter = characters.next();
    let nextCharacter = characters.next();
    let rawCharacterIndex = 0;
    while (!currentCharacter.done) {
        const character = currentCharacter.value;
        const characterLength = fast_string_width_dist(character);
        if (visible + characterLength <= columns) {
            rows[rows.length - 1] += character;
        }
        else {
            rows.push(character);
            visible = 0;
        }
        if (character === ESC || character === CSI) {
            isInsideEscape = true;
            isInsideLinkEscape = word.startsWith(ANSI_ESCAPE_LINK, rawCharacterIndex + 1);
        }
        if (isInsideEscape) {
            if (isInsideLinkEscape) {
                if (character === ANSI_ESCAPE_BELL) {
                    isInsideEscape = false;
                    isInsideLinkEscape = false;
                }
            }
            else if (character === ANSI_SGR_TERMINATOR) {
                isInsideEscape = false;
            }
        }
        else {
            visible += characterLength;
            if (visible === columns && !nextCharacter.done) {
                rows.push('');
                visible = 0;
            }
        }
        currentCharacter = nextCharacter;
        nextCharacter = characters.next();
        rawCharacterIndex += character.length;
    }
    lastRow = rows.at(-1);
    if (!visible && lastRow !== undefined && lastRow.length && rows.length > 1) {
        rows[rows.length - 2] += rows.pop();
    }
};
const stringVisibleTrimSpacesRight = (string) => {
    const words = string.split(' ');
    let last = words.length;
    while (last) {
        if (fast_string_width_dist(words[last - 1])) {
            break;
        }
        last--;
    }
    if (last === words.length) {
        return string;
    }
    return words.slice(0, last).join(' ') + words.slice(last).join('');
};
const exec = (string, columns, options = {}) => {
    if (options.trim !== false && string.trim() === '') {
        return '';
    }
    let returnValue = '';
    let escapeCode;
    let escapeUrl;
    const words = string.split(' ');
    let rows = [''];
    let rowLength = 0;
    for (let index = 0; index < words.length; index++) {
        const word = words[index];
        if (options.trim !== false) {
            const row = rows.at(-1) ?? '';
            const trimmed = row.trimStart();
            if (row.length !== trimmed.length) {
                rows[rows.length - 1] = trimmed;
                rowLength = fast_string_width_dist(trimmed);
            }
        }
        if (index !== 0) {
            if (rowLength >= columns &&
                (options.wordWrap === false || options.trim === false)) {
                rows.push('');
                rowLength = 0;
            }
            if (rowLength || options.trim === false) {
                rows[rows.length - 1] += ' ';
                rowLength++;
            }
        }
        const wordLength = fast_string_width_dist(word);
        if (options.hard && wordLength > columns) {
            const remainingColumns = columns - rowLength;
            const breaksStartingThisLine = 1 + Math.floor((wordLength - remainingColumns - 1) / columns);
            const breaksStartingNextLine = Math.floor((wordLength - 1) / columns);
            if (breaksStartingNextLine < breaksStartingThisLine) {
                rows.push('');
            }
            wrapWord(rows, word, columns);
            rowLength = fast_string_width_dist(rows.at(-1) ?? '');
            continue;
        }
        if (rowLength + wordLength > columns && rowLength && wordLength) {
            if (options.wordWrap === false && rowLength < columns) {
                wrapWord(rows, word, columns);
                rowLength = fast_string_width_dist(rows.at(-1) ?? '');
                continue;
            }
            rows.push('');
            rowLength = 0;
        }
        if (rowLength + wordLength > columns && options.wordWrap === false) {
            wrapWord(rows, word, columns);
            rowLength = fast_string_width_dist(rows.at(-1) ?? '');
            continue;
        }
        rows[rows.length - 1] += word;
        rowLength += wordLength;
    }
    if (options.trim !== false) {
        rows = rows.map((row) => stringVisibleTrimSpacesRight(row));
    }
    const preString = rows.join('\n');
    let inSurrogate = false;
    for (let i = 0; i < preString.length; i++) {
        const character = preString[i];
        returnValue += character;
        if (!inSurrogate) {
            inSurrogate = character >= '\ud800' && character <= '\udbff';
            if (inSurrogate) {
                continue;
            }
        }
        else {
            inSurrogate = false;
        }
        if (character === ESC || character === CSI) {
            GROUP_REGEX.lastIndex = i + 1;
            const groupsResult = GROUP_REGEX.exec(preString);
            const groups = groupsResult?.groups;
            if (groups?.code !== undefined) {
                const code = Number.parseFloat(groups.code);
                escapeCode = code === END_CODE ? undefined : code;
            }
            else if (groups?.uri !== undefined) {
                escapeUrl = groups.uri.length === 0 ? undefined : groups.uri;
            }
        }
        if (preString[i + 1] === '\n') {
            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink('');
            }
            const closingCode = escapeCode ? getClosingCode(escapeCode) : undefined;
            if (escapeCode && closingCode) {
                returnValue += wrapAnsiCode(closingCode);
            }
        }
        else if (character === '\n') {
            if (escapeCode && getClosingCode(escapeCode)) {
                returnValue += wrapAnsiCode(escapeCode);
            }
            if (escapeUrl) {
                returnValue += wrapAnsiHyperlink(escapeUrl);
            }
        }
    }
    return returnValue;
};
const CRLF_OR_LF = /\r?\n/;
function wrapAnsi(string, columns, options) {
    return String(string)
        .normalize()
        .split(CRLF_OR_LF)
        .map((line) => exec(line, columns, options))
        .join('\n');
}
//# sourceMappingURL=main.js.map
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/errors.js
class AbortPromptError extends Error {
    name = 'AbortPromptError';
    message = 'Prompt was aborted';
    constructor(options) {
        super();
        this.cause = options?.cause;
    }
}
class CancelPromptError extends Error {
    name = 'CancelPromptError';
    message = 'Prompt was canceled';
}
class ExitPromptError extends Error {
    name = 'ExitPromptError';
}
class HookError extends Error {
    name = 'HookError';
}
class ValidationError extends Error {
    name = 'ValidationError';
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/hook-engine.js
/* eslint @typescript-eslint/no-explicit-any: ["off"] */


const hookStorage = new external_node_async_hooks_.AsyncLocalStorage();
function createStore(rl) {
    const store = {
        rl,
        hooks: [],
        hooksCleanup: [],
        hooksEffect: [],
        index: 0,
        handleChange() { },
    };
    return store;
}
// Run callback in with the hook engine setup.
function withHooks(rl, cb) {
    const store = createStore(rl);
    return hookStorage.run(store, () => {
        function cycle(render) {
            store.handleChange = () => {
                store.index = 0;
                render();
            };
            store.handleChange();
        }
        return cb(cycle);
    });
}
// Safe getStore utility that'll return the store or throw if undefined.
function getStore() {
    const store = hookStorage.getStore();
    if (!store) {
        throw new HookError('[Inquirer] Hook functions can only be called from within a prompt');
    }
    return store;
}
function readline() {
    return getStore().rl;
}
// Merge state updates happening within the callback function to avoid multiple renders.
function withUpdates(fn) {
    const wrapped = (...args) => {
        const store = getStore();
        let shouldUpdate = false;
        const oldHandleChange = store.handleChange;
        store.handleChange = () => {
            shouldUpdate = true;
        };
        const returnValue = fn(...args);
        if (shouldUpdate) {
            oldHandleChange();
        }
        store.handleChange = oldHandleChange;
        return returnValue;
    };
    return external_node_async_hooks_.AsyncResource.bind(wrapped);
}
function withPointer(cb) {
    const store = getStore();
    const { index } = store;
    const pointer = {
        get() {
            return store.hooks[index];
        },
        set(value) {
            store.hooks[index] = value;
        },
        initialized: index in store.hooks,
    };
    const returnValue = cb(pointer);
    store.index++;
    return returnValue;
}
function handleChange() {
    getStore().handleChange();
}
const effectScheduler = {
    queue(cb) {
        const store = getStore();
        const { index } = store;
        store.hooksEffect.push(() => {
            store.hooksCleanup[index]?.();
            const cleanFn = cb(readline());
            if (cleanFn != null && typeof cleanFn !== 'function') {
                throw new ValidationError('useEffect return value must be a cleanup function or nothing.');
            }
            store.hooksCleanup[index] = cleanFn;
        });
    },
    run() {
        const store = getStore();
        withUpdates(() => {
            store.hooksEffect.forEach((effect) => {
                effect();
            });
            // Warning: Clean the hooks before exiting the `withUpdates` block.
            // Failure to do so means an updates would hit the same effects again.
            store.hooksEffect.length = 0;
        })();
    },
    clearAll() {
        const store = getStore();
        store.hooksCleanup.forEach((cleanFn) => {
            cleanFn?.();
        });
        store.hooksEffect.length = 0;
        store.hooksCleanup.length = 0;
    },
};

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/utils.js



/**
 * Force line returns at specific width. This function is ANSI code friendly and it'll
 * ignore invisible codes during width calculation.
 * @param {string} content
 * @param {number} width
 * @return {string}
 */
function breakLines(content, width) {
    return content
        .split('\n')
        .flatMap((line) => wrapAnsi(line, width, { trim: false, hard: true })
        .split('\n')
        .map((str) => str.trimEnd()))
        .join('\n');
}
/**
 * Returns the width of the active readline, or 80 as default value.
 * @returns {number}
 */
function readlineWidth() {
    return cli_width({ defaultWidth: 80, output: readline().output });
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+ansi@2.0.3/node_modules/@inquirer/ansi/dist/index.js
const dist_ESC = '\u001B[';
/** Move cursor to first column */
const cursorLeft = dist_ESC + 'G';
/** Hide the cursor */
const cursorHide = dist_ESC + '?25l';
/** Show the cursor */
const cursorShow = dist_ESC + '?25h';
/** Move cursor up by count rows */
const cursorUp = (rows = 1) => (rows > 0 ? `${dist_ESC}${rows}A` : '');
/** Move cursor down by count rows */
const cursorDown = (rows = 1) => rows > 0 ? `${dist_ESC}${rows}B` : '';
/** Move cursor to position (x, y) */
const cursorTo = (x, y) => {
    if (typeof y === 'number' && !Number.isNaN(y)) {
        return `${dist_ESC}${y + 1};${x + 1}H`;
    }
    return `${dist_ESC}${x + 1}G`;
};
const eraseLine = dist_ESC + '2K';
/** Erase the specified number of lines above the cursor */
const eraseLines = (lines) => lines > 0 ? (eraseLine + cursorUp(1)).repeat(lines - 1) + eraseLine + cursorLeft : '';

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/screen-manager.js



const height = (content) => content.split('\n').length;
const lastLine = (content) => content.split('\n').pop() ?? '';
class ScreenManager {
    // These variables are keeping information to allow correct prompt re-rendering
    height = 0;
    extraLinesUnderPrompt = 0;
    cursorPos;
    rl;
    constructor(rl) {
        this.rl = rl;
        this.cursorPos = rl.getCursorPos();
    }
    write(content) {
        this.rl.output.unmute();
        this.rl.output.write(content);
        this.rl.output.mute();
    }
    render(content, bottomContent = '') {
        // Write message to screen and setPrompt to control backspace
        const promptLine = lastLine(content);
        const rawPromptLine = (0,external_node_util_.stripVTControlCharacters)(promptLine);
        // Remove the rl.line from our prompt. We can't rely on the content of
        // rl.line (mainly because of the password prompt), so just rely on it's
        // length.
        let prompt = rawPromptLine;
        if (this.rl.line.length > 0) {
            prompt = prompt.slice(0, -this.rl.line.length);
        }
        this.rl.setPrompt(prompt);
        // SetPrompt will change cursor position, now we can get correct value
        this.cursorPos = this.rl.getCursorPos();
        const width = readlineWidth();
        content = breakLines(content, width);
        bottomContent = breakLines(bottomContent, width);
        // Manually insert an extra line if we're at the end of the line.
        // This prevent the cursor from appearing at the beginning of the
        // current line.
        if (rawPromptLine.length % width === 0) {
            content += '\n';
        }
        let output = content + (bottomContent ? '\n' + bottomContent : '');
        /**
         * Re-adjust the cursor at the correct position.
         */
        // We need to consider parts of the prompt under the cursor as part of the bottom
        // content in order to correctly cleanup and re-render.
        const promptLineUpDiff = Math.floor(rawPromptLine.length / width) - this.cursorPos.rows;
        const bottomContentHeight = promptLineUpDiff + (bottomContent ? height(bottomContent) : 0);
        // Return cursor to the input position (on top of the bottomContent)
        if (bottomContentHeight > 0)
            output += cursorUp(bottomContentHeight);
        // Return cursor to the initial left offset.
        output += cursorTo(this.cursorPos.cols);
        /**
         * Render and store state for future re-rendering
         */
        this.write(cursorDown(this.extraLinesUnderPrompt) + eraseLines(this.height) + output);
        this.extraLinesUnderPrompt = bottomContentHeight;
        this.height = height(output);
    }
    checkCursorPos() {
        const cursorPos = this.rl.getCursorPos();
        if (cursorPos.cols !== this.cursorPos.cols) {
            this.write(cursorTo(cursorPos.cols));
            this.cursorPos = cursorPos;
        }
    }
    done({ clearContent }) {
        this.rl.setPrompt('');
        let output = cursorDown(this.extraLinesUnderPrompt);
        output += clearContent ? eraseLines(this.height) : '\n';
        output += cursorShow;
        this.write(output);
        this.rl.close();
    }
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/promise-polyfill.js
// TODO: Remove this class once Node 22 becomes the minimum supported version.
class PromisePolyfill extends Promise {
    // Available starting from Node 22
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
    static withResolver() {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve: resolve, reject: reject };
    }
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/create-prompt.js








// Capture the real setImmediate at module load time so it works even when test
// frameworks mock timers with vi.useFakeTimers() or similar.
const nativeSetImmediate = globalThis.setImmediate;
function getCallSites() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const _prepareStackTrace = Error.prepareStackTrace;
    let result = [];
    try {
        Error.prepareStackTrace = (_, callSites) => {
            const callSitesWithoutCurrent = callSites.slice(1);
            result = callSitesWithoutCurrent;
            return callSitesWithoutCurrent;
        };
        // oxlint-disable-next-line no-unused-expressions
        new Error().stack;
    }
    catch {
        // An error will occur if the Node flag --frozen-intrinsics is used.
        // https://nodejs.org/api/cli.html#--frozen-intrinsics
        return result;
    }
    Error.prepareStackTrace = _prepareStackTrace;
    return result;
}
function createPrompt(view) {
    const callSites = getCallSites();
    const prompt = (config, context = {}) => {
        // Default `input` to stdin
        const { input = process.stdin, signal } = context;
        const cleanups = new Set();
        // Add mute capabilities to the output
        const output = new lib();
        output.pipe(context.output ?? process.stdout);
        // Pre-mute the output so that readline doesn't echo stale keystrokes
        // to the terminal before the first render. ScreenManager will unmute/mute
        // the output around each render call as needed.
        output.mute();
        const rl = external_node_readline_.createInterface({
            terminal: true,
            input,
            output,
        });
        const screen = new ScreenManager(rl);
        const { promise, resolve, reject } = PromisePolyfill.withResolver();
        const cancel = () => reject(new CancelPromptError());
        if (signal) {
            const abort = () => reject(new AbortPromptError({ cause: signal.reason }));
            if (signal.aborted) {
                abort();
                return Object.assign(promise, { cancel });
            }
            signal.addEventListener('abort', abort);
            cleanups.add(() => signal.removeEventListener('abort', abort));
        }
        cleanups.add(onExit((code, signal) => {
            reject(new ExitPromptError(`User force closed the prompt with ${code} ${signal}`));
        }));
        // SIGINT must be explicitly handled by the prompt so the ExitPromptError can be handled.
        // Otherwise, the prompt will stop and in some scenarios never resolve.
        // Ref issue #1741
        const sigint = () => reject(new ExitPromptError(`User force closed the prompt with SIGINT`));
        rl.on('SIGINT', sigint);
        cleanups.add(() => rl.removeListener('SIGINT', sigint));
        return withHooks(rl, (cycle) => {
            // The close event triggers immediately when the user press ctrl+c. SignalExit on the other hand
            // triggers after the process is done (which happens after timeouts are done triggering.)
            // We triggers the hooks cleanup phase on rl `close` so active timeouts can be cleared.
            const hooksCleanup = external_node_async_hooks_.AsyncResource.bind(() => effectScheduler.clearAll());
            rl.on('close', hooksCleanup);
            cleanups.add(() => rl.removeListener('close', hooksCleanup));
            const startCycle = () => {
                // Re-renders only happen when the state change; but the readline cursor could
                // change position and that also requires a re-render (and a manual one because
                // we mute the streams). We set the listener after the initial workLoop to avoid
                // a double render if render triggered by a state change sets the cursor to the
                // right position.
                const checkCursorPos = () => screen.checkCursorPos();
                rl.input.on('keypress', checkCursorPos);
                cleanups.add(() => rl.input.removeListener('keypress', checkCursorPos));
                cycle(() => {
                    try {
                        const nextView = view(config, (value) => {
                            setImmediate(() => resolve(value));
                        });
                        // Typescript won't allow this, but not all users rely on typescript.
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                        if (nextView === undefined) {
                            const callerFilename = callSites[1]?.getFileName();
                            throw new Error(`Prompt functions must return a string.\n    at ${callerFilename}`);
                        }
                        const [content, bottomContent] = typeof nextView === 'string' ? [nextView] : nextView;
                        screen.render(content, bottomContent);
                        effectScheduler.run();
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            };
            // Proper Readable streams (like process.stdin) may have OS-level buffered
            // data that arrives in the poll phase when readline resumes the stream.
            // Deferring the first render by one setImmediate tick (check phase, after
            // poll) lets that stale data flow through readline harmlessly—no keypress
            // handlers are registered yet and the output is muted, so the stale
            // keystrokes are silently discarded.
            // Old-style streams (like MuteStream) have no such buffering, so the
            // render cycle starts immediately.
            //
            // @see https://github.com/SBoudrias/Inquirer.js/issues/1303
            if ('readableFlowing' in input) {
                nativeSetImmediate(startCycle);
            }
            else {
                startCycle();
            }
            return Object.assign(promise
                .then((answer) => {
                effectScheduler.clearAll();
                return answer;
            }, (error) => {
                effectScheduler.clearAll();
                throw error;
            })
                // Wait for the promise to settle, then cleanup.
                .finally(() => {
                cleanups.forEach((cleanup) => cleanup());
                screen.done({ clearContent: Boolean(context.clearPromptOnDone) });
                output.end();
            })
                // Once cleanup is done, let the expose promise resolve/reject to the internal one.
                .then(() => promise), { cancel });
        });
    };
    return prompt;
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/use-state.js


function useState(defaultValue) {
    return withPointer((pointer) => {
        const setState = external_node_async_hooks_.AsyncResource.bind(function setState(newValue) {
            // Noop if the value is still the same.
            if (pointer.get() !== newValue) {
                pointer.set(newValue);
                // Trigger re-render
                handleChange();
            }
        });
        if (pointer.initialized) {
            return [pointer.get(), setState];
        }
        const value = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
        pointer.set(value);
        return [value, setState];
    });
}

// EXTERNAL MODULE: external "node:process"
var external_node_process_ = __webpack_require__(1708);
;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+figures@2.0.3/node_modules/@inquirer/figures/dist/index.js
// process.env dot-notation access prints:
// Property 'TERM' comes from an index signature, so it must be accessed with ['TERM'].ts(4111)
/* eslint dot-notation: ["off"] */

// Ported from is-unicode-supported
function isUnicodeSupported() {
    if (external_node_process_.platform !== 'win32') {
        return external_node_process_.env['TERM'] !== 'linux'; // Linux console (kernel)
    }
    return (Boolean(external_node_process_.env['WT_SESSION']) || // Windows Terminal
        Boolean(external_node_process_.env['TERMINUS_SUBLIME']) || // Terminus (<0.2.27)
        external_node_process_.env['ConEmuTask'] === '{cmd::Cmder}' || // ConEmu and cmder
        external_node_process_.env['TERM_PROGRAM'] === 'Terminus-Sublime' ||
        external_node_process_.env['TERM_PROGRAM'] === 'vscode' ||
        external_node_process_.env['TERM'] === 'xterm-256color' ||
        external_node_process_.env['TERM'] === 'alacritty' ||
        external_node_process_.env['TERMINAL_EMULATOR'] === 'JetBrains-JediTerm');
}
// Ported from figures
const common = {
    circleQuestionMark: '(?)',
    questionMarkPrefix: '(?)',
    square: '█',
    squareDarkShade: '▓',
    squareMediumShade: '▒',
    squareLightShade: '░',
    squareTop: '▀',
    squareBottom: '▄',
    squareLeft: '▌',
    squareRight: '▐',
    squareCenter: '■',
    bullet: '●',
    dot: '․',
    ellipsis: '…',
    pointerSmall: '›',
    triangleUp: '▲',
    triangleUpSmall: '▴',
    triangleDown: '▼',
    triangleDownSmall: '▾',
    triangleLeftSmall: '◂',
    triangleRightSmall: '▸',
    home: '⌂',
    heart: '♥',
    musicNote: '♪',
    musicNoteBeamed: '♫',
    arrowUp: '↑',
    arrowDown: '↓',
    arrowLeft: '←',
    arrowRight: '→',
    arrowLeftRight: '↔',
    arrowUpDown: '↕',
    almostEqual: '≈',
    notEqual: '≠',
    lessOrEqual: '≤',
    greaterOrEqual: '≥',
    identical: '≡',
    infinity: '∞',
    subscriptZero: '₀',
    subscriptOne: '₁',
    subscriptTwo: '₂',
    subscriptThree: '₃',
    subscriptFour: '₄',
    subscriptFive: '₅',
    subscriptSix: '₆',
    subscriptSeven: '₇',
    subscriptEight: '₈',
    subscriptNine: '₉',
    oneHalf: '½',
    oneThird: '⅓',
    oneQuarter: '¼',
    oneFifth: '⅕',
    oneSixth: '⅙',
    oneEighth: '⅛',
    twoThirds: '⅔',
    twoFifths: '⅖',
    threeQuarters: '¾',
    threeFifths: '⅗',
    threeEighths: '⅜',
    fourFifths: '⅘',
    fiveSixths: '⅚',
    fiveEighths: '⅝',
    sevenEighths: '⅞',
    line: '─',
    lineBold: '━',
    lineDouble: '═',
    lineDashed0: '┄',
    lineDashed1: '┅',
    lineDashed2: '┈',
    lineDashed3: '┉',
    lineDashed4: '╌',
    lineDashed5: '╍',
    lineDashed6: '╴',
    lineDashed7: '╶',
    lineDashed8: '╸',
    lineDashed9: '╺',
    lineDashed10: '╼',
    lineDashed11: '╾',
    lineDashed12: '−',
    lineDashed13: '–',
    lineDashed14: '‐',
    lineDashed15: '⁃',
    lineVertical: '│',
    lineVerticalBold: '┃',
    lineVerticalDouble: '║',
    lineVerticalDashed0: '┆',
    lineVerticalDashed1: '┇',
    lineVerticalDashed2: '┊',
    lineVerticalDashed3: '┋',
    lineVerticalDashed4: '╎',
    lineVerticalDashed5: '╏',
    lineVerticalDashed6: '╵',
    lineVerticalDashed7: '╷',
    lineVerticalDashed8: '╹',
    lineVerticalDashed9: '╻',
    lineVerticalDashed10: '╽',
    lineVerticalDashed11: '╿',
    lineDownLeft: '┐',
    lineDownLeftArc: '╮',
    lineDownBoldLeftBold: '┓',
    lineDownBoldLeft: '┒',
    lineDownLeftBold: '┑',
    lineDownDoubleLeftDouble: '╗',
    lineDownDoubleLeft: '╖',
    lineDownLeftDouble: '╕',
    lineDownRight: '┌',
    lineDownRightArc: '╭',
    lineDownBoldRightBold: '┏',
    lineDownBoldRight: '┎',
    lineDownRightBold: '┍',
    lineDownDoubleRightDouble: '╔',
    lineDownDoubleRight: '╓',
    lineDownRightDouble: '╒',
    lineUpLeft: '┘',
    lineUpLeftArc: '╯',
    lineUpBoldLeftBold: '┛',
    lineUpBoldLeft: '┚',
    lineUpLeftBold: '┙',
    lineUpDoubleLeftDouble: '╝',
    lineUpDoubleLeft: '╜',
    lineUpLeftDouble: '╛',
    lineUpRight: '└',
    lineUpRightArc: '╰',
    lineUpBoldRightBold: '┗',
    lineUpBoldRight: '┖',
    lineUpRightBold: '┕',
    lineUpDoubleRightDouble: '╚',
    lineUpDoubleRight: '╙',
    lineUpRightDouble: '╘',
    lineUpDownLeft: '┤',
    lineUpBoldDownBoldLeftBold: '┫',
    lineUpBoldDownBoldLeft: '┨',
    lineUpDownLeftBold: '┥',
    lineUpBoldDownLeftBold: '┩',
    lineUpDownBoldLeftBold: '┪',
    lineUpDownBoldLeft: '┧',
    lineUpBoldDownLeft: '┦',
    lineUpDoubleDownDoubleLeftDouble: '╣',
    lineUpDoubleDownDoubleLeft: '╢',
    lineUpDownLeftDouble: '╡',
    lineUpDownRight: '├',
    lineUpBoldDownBoldRightBold: '┣',
    lineUpBoldDownBoldRight: '┠',
    lineUpDownRightBold: '┝',
    lineUpBoldDownRightBold: '┡',
    lineUpDownBoldRightBold: '┢',
    lineUpDownBoldRight: '┟',
    lineUpBoldDownRight: '┞',
    lineUpDoubleDownDoubleRightDouble: '╠',
    lineUpDoubleDownDoubleRight: '╟',
    lineUpDownRightDouble: '╞',
    lineDownLeftRight: '┬',
    lineDownBoldLeftBoldRightBold: '┳',
    lineDownLeftBoldRightBold: '┯',
    lineDownBoldLeftRight: '┰',
    lineDownBoldLeftBoldRight: '┱',
    lineDownBoldLeftRightBold: '┲',
    lineDownLeftRightBold: '┮',
    lineDownLeftBoldRight: '┭',
    lineDownDoubleLeftDoubleRightDouble: '╦',
    lineDownDoubleLeftRight: '╥',
    lineDownLeftDoubleRightDouble: '╤',
    lineUpLeftRight: '┴',
    lineUpBoldLeftBoldRightBold: '┻',
    lineUpLeftBoldRightBold: '┷',
    lineUpBoldLeftRight: '┸',
    lineUpBoldLeftBoldRight: '┹',
    lineUpBoldLeftRightBold: '┺',
    lineUpLeftRightBold: '┶',
    lineUpLeftBoldRight: '┵',
    lineUpDoubleLeftDoubleRightDouble: '╩',
    lineUpDoubleLeftRight: '╨',
    lineUpLeftDoubleRightDouble: '╧',
    lineUpDownLeftRight: '┼',
    lineUpBoldDownBoldLeftBoldRightBold: '╋',
    lineUpDownBoldLeftBoldRightBold: '╈',
    lineUpBoldDownLeftBoldRightBold: '╇',
    lineUpBoldDownBoldLeftRightBold: '╊',
    lineUpBoldDownBoldLeftBoldRight: '╉',
    lineUpBoldDownLeftRight: '╀',
    lineUpDownBoldLeftRight: '╁',
    lineUpDownLeftBoldRight: '┽',
    lineUpDownLeftRightBold: '┾',
    lineUpBoldDownBoldLeftRight: '╂',
    lineUpDownLeftBoldRightBold: '┿',
    lineUpBoldDownLeftBoldRight: '╃',
    lineUpBoldDownLeftRightBold: '╄',
    lineUpDownBoldLeftBoldRight: '╅',
    lineUpDownBoldLeftRightBold: '╆',
    lineUpDoubleDownDoubleLeftDoubleRightDouble: '╬',
    lineUpDoubleDownDoubleLeftRight: '╫',
    lineUpDownLeftDoubleRightDouble: '╪',
    lineCross: '╳',
    lineBackslash: '╲',
    lineSlash: '╱',
};
const specialMainSymbols = {
    tick: '✔',
    info: 'ℹ',
    warning: '⚠',
    cross: '✘',
    squareSmall: '◻',
    squareSmallFilled: '◼',
    circle: '◯',
    circleFilled: '◉',
    circleDotted: '◌',
    circleDouble: '◎',
    circleCircle: 'ⓞ',
    circleCross: 'ⓧ',
    circlePipe: 'Ⓘ',
    radioOn: '◉',
    radioOff: '◯',
    checkboxOn: '☒',
    checkboxOff: '☐',
    checkboxCircleOn: 'ⓧ',
    checkboxCircleOff: 'Ⓘ',
    pointer: '❯',
    triangleUpOutline: '△',
    triangleLeft: '◀',
    triangleRight: '▶',
    lozenge: '◆',
    lozengeOutline: '◇',
    hamburger: '☰',
    smiley: '㋡',
    mustache: '෴',
    star: '★',
    play: '▶',
    nodejs: '⬢',
    oneSeventh: '⅐',
    oneNinth: '⅑',
    oneTenth: '⅒',
};
const specialFallbackSymbols = {
    tick: '√',
    info: 'i',
    warning: '‼',
    cross: '×',
    squareSmall: '□',
    squareSmallFilled: '■',
    circle: '( )',
    circleFilled: '(*)',
    circleDotted: '( )',
    circleDouble: '( )',
    circleCircle: '(○)',
    circleCross: '(×)',
    circlePipe: '(│)',
    radioOn: '(*)',
    radioOff: '( )',
    checkboxOn: '[×]',
    checkboxOff: '[ ]',
    checkboxCircleOn: '(×)',
    checkboxCircleOff: '( )',
    pointer: '>',
    triangleUpOutline: '∆',
    triangleLeft: '◄',
    triangleRight: '►',
    lozenge: '♦',
    lozengeOutline: '◊',
    hamburger: '≡',
    smiley: '☺',
    mustache: '┌─┐',
    star: '✶',
    play: '►',
    nodejs: '♦',
    oneSeventh: '1/7',
    oneNinth: '1/9',
    oneTenth: '1/10',
};
const mainSymbols = {
    ...common,
    ...specialMainSymbols,
};
const fallbackSymbols = {
    ...common,
    ...specialFallbackSymbols,
};
const shouldUseMain = isUnicodeSupported();
const figures = shouldUseMain
    ? mainSymbols
    : fallbackSymbols;
/* harmony default export */ const figures_dist = (figures);
const replacements = Object.entries(specialMainSymbols);
// On terminals which do not support Unicode symbols, substitute them to other symbols
const replaceSymbols = (string, { useFallback = !shouldUseMain } = {}) => {
    if (useFallback) {
        for (const [key, mainSymbol] of replacements) {
            const fallbackSymbol = fallbackSymbols[key];
            if (!fallbackSymbol) {
                throw new Error(`Unable to find fallback for ${key}`);
            }
            string = string.replaceAll(mainSymbol, fallbackSymbol);
        }
    }
    return string;
};

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/theme.js


const defaultTheme = {
    prefix: {
        idle: (0,external_node_util_.styleText)('blue', '?'),
        done: (0,external_node_util_.styleText)('green', figures_dist.tick),
    },
    spinner: {
        interval: 80,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map((frame) => (0,external_node_util_.styleText)('yellow', frame)),
    },
    style: {
        answer: (text) => (0,external_node_util_.styleText)('cyan', text),
        message: (text) => (0,external_node_util_.styleText)('bold', text),
        error: (text) => (0,external_node_util_.styleText)('red', `> ${text}`),
        defaultAnswer: (text) => (0,external_node_util_.styleText)('dim', `(${text})`),
        help: (text) => (0,external_node_util_.styleText)('dim', text),
        highlight: (text) => (0,external_node_util_.styleText)('cyan', text),
        key: (text) => (0,external_node_util_.styleText)('cyan', (0,external_node_util_.styleText)('bold', `<${text}>`)),
    },
};

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/make-theme.js

function isPlainObject(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    let proto = value;
    while (Object.getPrototypeOf(proto) !== null) {
        proto = Object.getPrototypeOf(proto);
    }
    return Object.getPrototypeOf(value) === proto;
}
function deepMerge(...objects) {
    const output = {};
    for (const obj of objects) {
        for (const [key, value] of Object.entries(obj)) {
            const prevValue = output[key];
            output[key] =
                isPlainObject(prevValue) && isPlainObject(value)
                    ? deepMerge(prevValue, value)
                    : value;
        }
    }
    return output;
}
function makeTheme(...themes) {
    const themesToMerge = [
        defaultTheme,
        ...themes.filter((theme) => theme != null),
    ];
    return deepMerge(...themesToMerge);
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/use-effect.js

function useEffect(cb, depArray) {
    withPointer((pointer) => {
        const oldDeps = pointer.get();
        const hasChanged = !Array.isArray(oldDeps) || depArray.some((dep, i) => !Object.is(dep, oldDeps[i]));
        if (hasChanged) {
            effectScheduler.queue(cb);
        }
        pointer.set(depArray);
    });
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/use-prefix.js



function usePrefix({ status = 'idle', theme, }) {
    const [showLoader, setShowLoader] = useState(false);
    const [tick, setTick] = useState(0);
    const { prefix, spinner } = makeTheme(theme);
    useEffect(() => {
        if (status === 'loading') {
            let tickInterval;
            let inc = -1;
            // Delay displaying spinner by 300ms, to avoid flickering
            const delayTimeout = setTimeout(() => {
                setShowLoader(true);
                tickInterval = setInterval(() => {
                    inc = inc + 1;
                    setTick(inc % spinner.frames.length);
                }, spinner.interval);
            }, 300);
            return () => {
                clearTimeout(delayTimeout);
                clearInterval(tickInterval);
            };
        }
        else {
            setShowLoader(false);
        }
    }, [status]);
    if (showLoader) {
        return spinner.frames[tick];
    }
    // There's a delay before we show the loader. So we want to ignore `loading` here, and pass idle instead.
    const iconName = status === 'loading' ? 'idle' : status;
    return typeof prefix === 'string' ? prefix : (prefix[iconName] ?? prefix['idle']);
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/use-ref.js

function useRef(val) {
    return useState({ current: val })[0];
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/use-keypress.js



function useKeypress(userHandler) {
    const signal = useRef(userHandler);
    signal.current = userHandler;
    useEffect((rl) => {
        let ignore = false;
        const handler = withUpdates((_input, event) => {
            if (ignore)
                return;
            void signal.current(event, rl);
        });
        rl.input.on('keypress', handler);
        return () => {
            ignore = true;
            rl.input.removeListener('keypress', handler);
        };
    }, []);
}

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+core@11.1.5_@types+node@25.3.3/node_modules/@inquirer/core/dist/lib/key.js
const isUpKey = (key, keybindings = []) => 
// The up key
key.name === 'up' ||
    // Vim keybinding: hjkl keys map to left/down/up/right
    (keybindings.includes('vim') && key.name === 'k') ||
    // Emacs keybinding: Ctrl+P means "previous" in Emacs navigation conventions
    (keybindings.includes('emacs') && key.ctrl && key.name === 'p');
const isDownKey = (key, keybindings = []) => 
// The down key
key.name === 'down' ||
    // Vim keybinding: hjkl keys map to left/down/up/right
    (keybindings.includes('vim') && key.name === 'j') ||
    // Emacs keybinding: Ctrl+N means "next" in Emacs navigation conventions
    (keybindings.includes('emacs') && key.ctrl && key.name === 'n');
const isSpaceKey = (key) => key.name === 'space';
const isBackspaceKey = (key) => key.name === 'backspace';
const isTabKey = (key) => key.name === 'tab';
const isNumberKey = (key) => '1234567890'.includes(key.name);
const isEnterKey = (key) => key.name === 'enter' || key.name === 'return';
const isShiftKey = (key) => key.shift;

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+confirm@6.0.8_@types+node@25.3.3/node_modules/@inquirer/confirm/dist/index.js

function getBooleanValue(value, defaultValue) {
    let answer = defaultValue !== false;
    if (/^(y|yes)/i.test(value))
        answer = true;
    else if (/^(n|no)/i.test(value))
        answer = false;
    return answer;
}
function boolToString(value) {
    return value ? 'Yes' : 'No';
}
/* harmony default export */ const confirm_dist = (createPrompt((config, done) => {
    const { transformer = boolToString } = config;
    const [status, setStatus] = useState('idle');
    const [value, setValue] = useState('');
    const theme = makeTheme(config.theme);
    const prefix = usePrefix({ status, theme });
    useKeypress((key, rl) => {
        if (status !== 'idle')
            return;
        if (isEnterKey(key)) {
            const answer = getBooleanValue(value, config.default);
            setValue(transformer(answer));
            setStatus('done');
            done(answer);
        }
        else if (isTabKey(key)) {
            const answer = boolToString(!getBooleanValue(value, config.default));
            rl.clearLine(0); // Remove the tab character.
            rl.write(answer);
            setValue(answer);
        }
        else {
            setValue(rl.line);
        }
    });
    let formattedValue = value;
    let defaultValue = '';
    if (status === 'done') {
        formattedValue = theme.style.answer(value);
    }
    else {
        defaultValue = ` ${theme.style.defaultAnswer(config.default === false ? 'y/N' : 'Y/n')}`;
    }
    const message = theme.style.message(config.message, status);
    return `${prefix} ${message}${defaultValue} ${formattedValue}`;
}));

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+input@5.0.8_@types+node@25.3.3/node_modules/@inquirer/input/dist/index.js

const inputTheme = {
    validationFailureMode: 'keep',
};
/* harmony default export */ const input_dist = (createPrompt((config, done) => {
    const { prefill = 'tab' } = config;
    const theme = makeTheme(inputTheme, config.theme);
    const [status, setStatus] = useState('idle');
    // Coerce to string to handle runtime values that may be numbers despite TypeScript types
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
    const [defaultValue, setDefaultValue] = useState(String(config.default ?? ''));
    const [errorMsg, setError] = useState();
    const [value, setValue] = useState('');
    const prefix = usePrefix({ status, theme });
    async function validate(value) {
        const { required, pattern, patternError = 'Invalid input' } = config;
        if (required && !value) {
            return 'You must provide a value';
        }
        if (pattern && !pattern.test(value)) {
            return patternError;
        }
        if (typeof config.validate === 'function') {
            return (await config.validate(value)) || 'You must provide a valid value';
        }
        return true;
    }
    useKeypress(async (key, rl) => {
        // Ignore keypress while our prompt is doing other processing.
        if (status !== 'idle') {
            return;
        }
        if (isEnterKey(key)) {
            const answer = value || defaultValue;
            setStatus('loading');
            const isValid = await validate(answer);
            if (isValid === true) {
                setValue(answer);
                setStatus('done');
                done(answer);
            }
            else {
                if (theme.validationFailureMode === 'clear') {
                    setValue('');
                }
                else {
                    // Reset the readline line value to the previous value. On line event, the value
                    // get cleared, forcing the user to re-enter the value instead of fixing it.
                    rl.write(value);
                }
                setError(isValid);
                setStatus('idle');
            }
        }
        else if (isBackspaceKey(key) && !value) {
            setDefaultValue('');
        }
        else if (isTabKey(key) && !value) {
            setDefaultValue('');
            rl.clearLine(0); // Remove the tab character.
            rl.write(defaultValue);
            setValue(defaultValue);
        }
        else {
            setValue(rl.line);
            setError(undefined);
        }
    });
    // If prefill is set to 'editable' cut out the default value and paste into current state and the user's cli buffer
    // They can edit the value immediately instead of needing to press 'tab'
    useEffect((rl) => {
        if (prefill === 'editable' && defaultValue) {
            rl.write(defaultValue);
            setValue(defaultValue);
        }
    }, []);
    const message = theme.style.message(config.message, status);
    let formattedValue = value;
    if (typeof config.transformer === 'function') {
        formattedValue = config.transformer(value, { isFinal: status === 'done' });
    }
    else if (status === 'done') {
        formattedValue = theme.style.answer(value);
    }
    let defaultStr;
    if (defaultValue && status !== 'done' && !value) {
        defaultStr = theme.style.defaultAnswer(defaultValue);
    }
    let error = '';
    if (errorMsg) {
        error = theme.style.error(errorMsg);
    }
    return [
        [prefix, message, defaultStr, formattedValue]
            .filter((v) => v !== undefined)
            .join(' '),
        error,
    ];
}));

;// CONCATENATED MODULE: ../../node_modules/.pnpm/@inquirer+prompts@8.3.0_@types+node@25.3.3/node_modules/@inquirer/prompts/dist/index.js












/***/ })

};

//# sourceMappingURL=6.index.js.map