"use strict";
const print = console.log;
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

class Env {
    constructor(parms = [], args = [], outer = null) {
        this.env = Object.fromEntries(parms.map((p, i) => [p, args[i]]));
        this.outer = outer;
    }

    get(symbol) {
        if (symbol in this.env) {
            return this.env[symbol];
        } else if (this.outer !== null) {
            return this.outer.get(symbol);
        } else {
            throw new Error(`Unbound variable: ${symbol}`);
        }
    }

    set(symbol, value) {
        this.env[symbol] = value;
    }

    find(symbol) {
        if (symbol in this.env) {
            return this;
        } else if (this.outer !== null) {
            return this.outer.find(symbol);
        } else {
            throw new Error(`Unbound variable: ${symbol}`);
        }
    }
}

class Procedure {
    constructor(parms, body, env) {
        this.parms = parms;
        this.body = body;
        this.env = env;
    }

    call(args) {
        const localEnv = new Env(this.parms, args, this.env);
        let result;
        for (let expr of this.body) {
            result = eval_lisp(expr, localEnv);
        }
        return result;
    }
}

function tokenize(chars) {
    /**
     * Convert a string of characters into a list of tokens.
     */
    const tokens = [];
    let current = "";
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];

        if (escapeNext) {
            current += char;
            escapeNext = false;
            continue;
        }

        if (char === "\\") {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            if (inString) {
                // End of string
                tokens.push('"' + current + '"');
                current = "";
                inString = false;
            } else {
                // Start of string
                if (current) tokens.push(current);
                current = "";
                inString = true;
            }
            continue;
        }

        if (inString) {
            current += char;
            continue;
        }

        if (char === "(" || char === ")") {
            if (current) tokens.push(current);
            tokens.push(char);
            current = "";
            continue;
        }

        if (char === " " || char === "\n" || char === "\t") {
            if (current) tokens.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    if (current) tokens.push(current);
    if (inString) tokens.push('"' + current);

    return tokens.filter((token) => token.trim() !== "");
}

function parse(program) {
    /**
     * Read a Scheme expression from a string.
     */
    return read_from_tokens(tokenize(program));
}

function read_from_tokens(tokens) {
    /**
     * Read an expression from a sequence of tokens.
     */
    if (tokens.length === 0) {
        throw new SyntaxError("unexpected EOF");
    }
    let token = tokens.shift();
    if (token === "(") {
        let L = [];
        while (tokens[0] != ")") {
            L.push(read_from_tokens(tokens));
        }
        tokens.shift(); // Pop off ')'
        return L;
    } else if (token === ")") {
        // console.log(token);
        throw new SyntaxError("unexpected )");
    } else {
        return atom(token);
    }
}

function atom(token) {
    /**
     * Numbers become numbers; every other token is a symbol/string
     */

    if (token.startsWith('"') && token.endsWith('"')) {
        return { type: "string", value: token.slice(1, -1) };
    }

    const trimmed = token.trim();

    const num = Number(trimmed);

    // if it's a valid number and not an empty string
    if (!isNaN(num) && trimmed !== "") {
        return num;
    }

    return trimmed;
}

function standard_env() {
    /**
     * Standard environment for the interpreter.
     */
    let env = {};
    const canvas = document.getElementById("myCanvas");
    const ctx = canvas.getContext("2d");

    env.abs = Math.abs;
    env.max = Math.max;
    env.min = Math.min;
    env.sqrt = Math.sqrt;
    env.pi = Math.PI;
    env.sin = Math.sin;
    env.cos = Math.cos;
    env.pow = Math.pow;
    env.round = Math.round;
    env.oops = Math.oops;
    env.floor = Math.floor;
    env.ceil = Math.ceil;
    env["="] = (a, b) => a === b;
    env["+"] = (...a) => a.reduce((a, b) => a + b);
    env["-"] = (a, ...b) => (b.length ? b.reduce((acc, x) => acc - x, a) : -a); // wtf?
    // env["-"] = (...a) => a.reduce((a, b) => a - b, 0);
    env["*"] = (...a) => a.reduce((a, b) => a * b);
    env["/"] = (...a) => a.reduce((a, b) => a / b);
    env[">"] = (a, b) => a > b;
    env["<"] = (a, b) => a < b;
    env["<="] = (a, b) => a <= b;
    env[">="] = (a, b) => a >= b;
    env.modulo = (a, b) => a % b;
    env.negative = (a) => -a;

    env.append = (a, b) => a + b;
    env.apply = (proc, args) => proc(...args);
    env.car = (x) => x.at(0);
    env.cdr = (x) => x.slice(1);
    env.cons = (x, y) => [x, y];
    env["eq?"] = (x, y) => x === y;
    env.expt = Math.pow;
    env["equal?"] = (x, y) => x === y;
    env.length = (x) => x.length;
    env.list = (...x) => arrayToList(x);
    env["list?"] = (x) => Array.isArray(x);
    env["filter"] = (pred, list) => {
        const arr = listToArray(list);
        const filtered = arr.filter((item) => {
            if (pred instanceof Procedure) {
                return pred.call([item]);
            } else {
                return pred(item);
            }
        });
        return arrayToList(filtered);
    };

    env["while"] = (test, ...body) => {
        while (eval_lisp(test, globalEnv)) {
            for (const exp of body) {
                eval_lisp(exp, globalEnv);
            }
        }
        return undefined;
    };

    env["number->string"] = (num) => String(num);
    env["string->number"] = (str) => Number(str);
    env.not = (a, b) => a != b;
    env["null?"] = (x) => Array.isArray(x) && x.length === 0;
    env["number?"] = (x) => typeof x === "number";
    env["procedure?"] = (x) => typeof x === "function";
    env["symbol?"] = (x) => typeof x === "string";
    env.print = (...x) => {
        console.log(...x);
        return x;
    };
    env["request-animation-frame"] = (fn) => {
        if (fn instanceof Procedure) {
            requestAnimationFrame(() => {
                try {
                    fn.call([]);
                } catch (e) {
                    console.error("Animation error:", e);
                }
            });
        } else {
            requestAnimationFrame(fn);
        }
        return 0;
    };
    env["set-interval"] = (fn, ms) => setInterval(fn, ms);
    env["clear-interval"] = (id) => clearInterval(id);
    env["js-call"] = (a, b) => toJSCallback(a, globalEnv);
    env["string-append"] = (...args) => args.join("");
    env["get-canvas-width"] = () => canvas.width;
    env["get-canvas-height"] = () => canvas.height;
    env["mod"] = (a, b) => ((a % b) + b) % b;
    env["random"] = (max) => Math.random() * max;
    env["ctx"] = ctx;
    env["beginPath"] = () => ctx.beginPath();
    env["moveTo"] = (x, y) => ctx.moveTo(x, y);
    env["lineTo"] = (x, y) => ctx.lineTo(x, y);
    env["stroke"] = () => ctx.stroke();

    env["first"] = (lst) => lst[0];
    env["rest"] = (lst) => lst.slice(1);
    env["set-line-width"] = (width) => (ctx.lineWidth = width);
    env["list-ref"] = (lst, n) => {
        if (n < 0 || n >= lst.length) {
            throw new Error("Index out of bounds");
        }
        return lst[n];
    };
    env["range"] = (s, e) => {
        const arr = [];
        for (let i = s; i < e; i++) {
            arr.push(i);
        }
        // console.log(arr);
        return arrayToList(arr); // Convert js array to lisp list
    };

    env.map = (func, lst) => {
        const arr = listToArray(lst);
        const mapped = arr.map((item) => {
            if (func instanceof Procedure) {
                return func.call([item]);
            } else if (typeof func === "function") {
                return func(item);
            } else {
                throw new Error("map: func is not a function or Procedure");
            }
        });
        return arrayToList(mapped);
    };

    env.sum = (list) => {
        let arr = listToArray(list);
        return arr.reduce((a, b) => a + b, 0);
    };

    env["for-each"] = (proc, list) => {
        while (Array.isArray(list) && list.length > 0) {
            const item = list[0];

            if (proc instanceof Procedure) {
                proc.call([item]);
            } else {
                proc(item);
            }

            list = list[1];
        }
        return undefined;
    };

    env["set-timeout"] = (fn, ms) => {
        if (fn instanceof Procedure) {
            setTimeout(() => {
                try {
                    fn.call([]);
                } catch (e) {
                    console.error("Timeout error:", e);
                }
            }, ms);
        } else {
            setTimeout(fn, ms);
        }
        return -1;
    };
    env["defineProperty"] = (obj, prop, func) => {
        obj[prop] = func;
    };

    env["closePath"] = () => ctx.closePath();
    env["get-canvas-by-id"] = (id) => document.getElementById(id);
    env["get-context"] = (canvas) => canvas.getContext("2d");
    env["set-canvas-width"] = (canvas, w) => (canvas.width = w);
    env["set-canvas-height"] = (canvas, h) => (canvas.height = h);

    env["deg-to-rad"] = (deg) => (deg * Math.PI) / 180;

    env["make-simple-array"] = (...items) => items;
    env["array-ref"] = (arr, index) => arr[index];
    env["array-map"] = (func, arr) => {
        return arr.map((item) => {
            if (func instanceof Procedure) {
                return func.call([item]);
            } else {
                return func(item);
            }
        });
    };
    env["array-for-each"] = (func, arr) => {
        arr.forEach((item) => {
            if (func instanceof Procedure) {
                func.call([item]);
            } else {
                func(item);
            }
        });
        return undefined;
    };

    // 3D cube stuff
    env["make-point"] = (x, y, z) => ({ x: x, y: y, z: z });
    env["point-x"] = (p) => p.x;
    env["point-y"] = (p) => p.y;
    env["point-z"] = (p) => p.z;

    env["rotate-x"] = (point, angle) => {
        const rad = (angle * Math.PI) / 180;
        const cosa = Math.cos(rad);
        const sina = Math.sin(rad);
        const y = point.y * cosa - point.z * sina;
        const z = point.y * sina + point.z * cosa;
        return { x: point.x, y: y, z: z };
    };

    env["rotate-y"] = (point, angle) => {
        const rad = (angle * Math.PI) / 180;
        const cosa = Math.cos(rad);
        const sina = Math.sin(rad);
        const z = point.z * cosa - point.x * sina;
        const x = point.z * sina + point.x * cosa;
        return { x: x, y: point.y, z: z };
    };

    env["rotate-z"] = (point, angle) => {
        const rad = (angle * Math.PI) / 180;
        const cosa = Math.cos(rad);
        const sina = Math.sin(rad);
        const x = point.x * cosa - point.y * sina;
        const y = point.x * sina + point.y * cosa;
        return { x: x, y: y, z: point.z };
    };

    env["project-point"] = (
        point,
        viewWidth,
        viewHeight,
        fieldOfView,
        viewDistance
    ) => {
        const factor = fieldOfView / (viewDistance + point.z);
        const x = point.x * factor + viewWidth / 2;
        const y = point.y * factor + viewHeight / 2;
        return { x: x, y: y, z: point.z };
    };

    // Global variable helpers
    env["set-global"] = (name, value) => {
        globalEnv.set(name, value);
        return value;
    };

    env.window = () => window;

    return env;
}

function toJSCallback(proc, env) {
    return () => proc([], env);
}

function listToArray(lst) {
    /**
     * Convert lisp-style cons to js array
     */
    const arr = [];
    while (Array.isArray(lst) && lst.length > 0) {
        arr.push(lst[0]);
        lst = lst[1];
    }
    return arr;
}

function arrayToList(arr) {
    /**
     * Convert Js array to lisp list
     */
    let list = [];
    for (let i = arr.length - 1; i >= 0; i--) {
        list = [arr[i], list];
    }
    return list;
}

function make_quoted(exp) {
    if (typeof exp === "string") {
        return { type: "symbol", name: exp };
    } else if (Array.isArray(exp)) {
        return exp.map(make_quoted);
    } else {
        return exp;
    }
}

function eval_lisp(x, env = globalEnv) {
    /**
     * Evalute an expression in an environment.
     */

    if (x === undefined || x === null) {
        throw new Error(`eval_lisp called with undefined or null input`);
    }
    if (
        typeof x !== "string" &&
        typeof x !== "number" &&
        !Array.isArray(x) &&
        !(x && x.type === "string")
    ) {
        throw new Error(
            `eval_lisp got unexpected type: ${typeof x}, value: ${JSON.stringify(
                x
            )}`
        );
    }

    // Handle string literals
    if (x && typeof x === "object" && x.type === "string") {
        return x.value;
    }

    if (typeof x === "string") {
        return env.get(x);
    } else if (typeof x === "number") {
        return x;
    } else if (x[0] === "if") {
        const [_, test, conseq, alt] = x;

        let testResult;
        try {
            testResult = eval_lisp(test, env);
        } catch (e) {
            throw new Error(
                `Error evaluating 'if' test expression ${JSON.stringify(
                    test
                )}: ${e.message}`
            );
        }
        const exp = testResult ? conseq : alt;

        if (exp === undefined) {
            return undefined;
        }

        try {
            return eval_lisp(exp, env);
        } catch (e) {
            throw new Error(
                `Error evaluating 'if' branch expression ${JSON.stringify(
                    exp
                )}: ${e.message}`
            );
        }
    } else if (x[0] === "define") {
        // Check if it's a function definition: (define (func args) body)
        if (Array.isArray(x[1]) && x[1].length > 0) {
            const [funcName, ...args] = x[1];
            const body = x.slice(2);
            // console.log(args);
            const lambda = ["lambda", args, ...body];
            env.set(funcName, eval_lisp(lambda, env));
            return undefined;
        }
        // Regular variable definition
        else {
            const symbol = x[1];
            const exp = x[2];
            env.set(symbol, eval_lisp(exp, env));
            return undefined;
        }
    } else if (x[0] === "let") {
        const bindings = x[1];
        const body = x.slice(2);
        const newEnv = new Env([], [], env);

        // Evaluate bindings
        for (const binding of bindings) {
            const [name, value] = binding;
            newEnv.set(name, eval_lisp(value, newEnv));
        }

        // Evaluate body in new environment
        let result;
        for (const expr of body) {
            result = eval_lisp(expr, newEnv);
        }
        return result;
    } else if (x[0] === "lambda") {
        // lambda (args) body
        const [_, parms, ...body] = x;
        return new Procedure(parms, body, env);
    } else if (x[0] === "begin") {
        let result;
        for (let i = 1; i < x.length; i++) {
            result = eval_lisp(x[i], env); // all use same env
        }
        return result;
    } else if (x[0] === "when") {
        const [_, test, ...body] = x;
        if (eval_lisp(test, env)) {
            let result;
            for (const expr of body) {
                result = eval_lisp(expr, env);
            }
            return result;
        }
        return undefined;
    } else if (x[0] === "set!") {
        const [_, symbol, exp] = x;
        env.find(symbol).set(symbol, eval_lisp(exp, env));
        return undefined;
    } else if (x[0] === "quote") {
        return make_quoted(x[1]);
    } else {
        const proc = eval_lisp(x[0], env);
        const args = x.slice(1).map((arg) => eval_lisp(arg, env));
        if (proc instanceof Procedure) {
            return proc.call(args);
        } else if (typeof proc === "function") {
            return proc(...args);
        } else {
            throw new Error(`Unknown procedure type : ${x}`);
        }
    }
}

function schemestr(exp) {
    if (typeof exp === "string") {
        return `"${exp}"`;
    } else if (exp && typeof exp === "object") {
        if (exp.type === "symbol") {
            return exp.name; // Symbols without quotes
        } else if (exp.type === "string") {
            return `"${exp.value}"`; // String literals with quotes
        }
    }

    if (exp instanceof Procedure) {
        return "#<procedure>";
    }
    if (typeof exp === "undefined") {
        return "<nothing>";
    }

    if (Array.isArray(exp)) {
        try {
            // check if it's lisp list
            const arr = listToArray(exp);
            if (arr.length > 0) {
                return `(${arr.map(schemestr).join(" ")})`;
            } else {
                return "()";
            }
        } catch (e) {
            // fall back to generic array printing
            return `(${exp.map(schemestr).join(" ")})`;
        }
    } else {
        return String(exp);
    }
}
function evaluate_exp() {
    clearOutput();
    const inputBox = document.getElementById("input");
    const output = document.getElementById("output");
    const code = inputBox.value.trim();

    if (!code) return;
    const tmp = code.split("\n").map((element) => {
        if (element.trim().includes(";")) {
            return;
        } else {
            return element.trim();
        }
    });
    const inputLines = tmp.filter(Boolean);
    const wrapped =
        inputLines.length > 1 ? `(begin ${inputLines.join(" ")})` : code;

    try {
        const expr = parse(wrapped);
        const result = eval_lisp(expr, globalEnv);

        const inputDiv = document.createElement("div");
        inputDiv.className = "input-line";
        inputDiv.textContent =
            wrapped.length > 64 ? `> ${wrapped.slice(0, 256)} ...` : wrapped;
        output.appendChild(inputDiv);

        const outputDiv = document.createElement("div");
        outputDiv.className = "output-line";
        outputDiv.textContent = schemestr(result);
        output.appendChild(outputDiv);
    } catch (e) {
        const inputDiv = document.createElement("div");
        inputDiv.className = "input-line";
        inputDiv.textContent = `> ${wrapped}`;
        output.appendChild(inputDiv);

        const errorDiv = document.createElement("div");
        errorDiv.className = "error-line";
        errorDiv.textContent = `Error: ${e.message}`;
        output.appendChild(errorDiv);
    }

    // inputBox.value = "";
    output.scrollTop = output.scrollHeight;
}

let currentAnimationFrame = null;
function clearOutput() {
    document.getElementById("output").innerHTML = "";

    globalEnv = new Env();
    Object.assign(globalEnv.env, standard_env());
    Object.assign(globalEnv.env, canvas_procs);

    if (currentAnimationFrame !== null) {
        cancelAnimationFrame(currentAnimationFrame);
        currentAnimationFrame = null;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

var globalEnv = new Env();
Object.assign(globalEnv.env, standard_env());

const input_el = document.getElementById("input");
const output_el = document.getElementById("output");
input_el.addEventListener("input", () => {
    const input = input_el.value.trim();

    if (!input) {
        clearOutput();
        return;
    }

    clearOutput();

    evaluate_exp();
});
input_el.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        clearOutput();
        evaluate_exp();
    }
});

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

// Additional functions for the canvas
var canvas_procs = {
    "clear-canvas": () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    "fill-rect": (x, y, width, height) => {
        ctx.fillRect(x, y, width, height);
    },
    "set-fill-style": (color) => {
        ctx.fillStyle = color;
    },
    "set-stroke-style": (color) => {
        ctx.strokeStyle = color;
    },
    "stroke-rect": (x, y, width, height) => {
        ctx.strokeRect(x, y, width, height);
    },
    "resize-canvas": resizeCanvas,
};
resizeCanvas();

window.addEventListener("resize", resizeCanvas);
Object.assign(globalEnv.env, canvas_procs);
