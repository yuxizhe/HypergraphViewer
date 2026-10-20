/**
 * Python pickle 的只读解码器（协议 0-5），用于在浏览器中读取 Hypergraph-DB 的 .hgdb 文件
 *
 * 只还原数据，不执行任何代码：
 * - dict → Map（键可以是元组、数字），list → Array，tuple → PyTuple，set / frozenset → PySet
 * - collections.defaultdict / OrderedDict 当作普通 dict；datetime、date、time、Decimal 转为字符串
 * - 其他类的对象一律为 PyObject 占位，显示为 <模块.类名>
 */

export class PyTuple extends Array {}
export class PySet extends Array {}
export class PyObject {
    constructor(name) {
        this.name = name;
    }
    toString() {
        return `<${this.name}>`;
    }
}

const MARK = Symbol('mark');

// 可以还原为数据的类；未列出的类在 REDUCE / NEWOBJ 时变成 PyObject 占位
const pad = (n, width = 2) => String(n).padStart(width, '0');
const dateOf = (b) => `${pad((b[0] << 8) | b[1], 4)}-${pad(b[2])}-${pad(b[3])}`;
const timeOf = (b) => {
    const micro = (b[3] << 16) | (b[4] << 8) | b[5];
    return `${pad(b[0])}:${pad(b[1])}:${pad(b[2])}${micro ? `.${pad(micro, 6)}` : ''}`;
};
const KNOWN = {
    'collections defaultdict': () => new Map(),
    'collections OrderedDict': (items) => new Map(items || []),
    'builtins set': (items) => PySet.from(items || []),
    'builtins frozenset': (items) => PySet.from(items || []),
    'builtins bytearray': (data) => (data instanceof Uint8Array ? data : new Uint8Array(0)),
    // 协议 2 中 bytes 写成 _codecs.encode(str, 'latin1')
    '_codecs encode': (text) => Uint8Array.from(text, (c) => c.charCodeAt(0)),
    'datetime datetime': (b) => (b instanceof Uint8Array ? `${dateOf(b)}T${timeOf(b.subarray(4))}` : undefined),
    'datetime date': (b) => (b instanceof Uint8Array ? dateOf(b) : undefined),
    'datetime time': (b) => (b instanceof Uint8Array ? timeOf(b) : undefined),
    'decimal Decimal': (text) => String(text),
};
// Python 2 写出的模块名
const MODULE_ALIASES = { __builtin__: 'builtins', copy_reg: 'copyreg' };

class Callable {
    constructor(module, name) {
        this.key = `${MODULE_ALIASES[module] || module} ${name}`;
        this.name = `${module}.${name}`;
    }
    call(args) {
        const make = KNOWN[this.key];
        const value = make && make(...args);
        return value === undefined ? new PyObject(this.name) : value;
    }
}

const decoder = new TextDecoder('utf-8');
// 分块转换，展开过长的数组会超出调用栈
const latin1 = (bytes) => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return text;
};

// 有符号小端整数（LONG1 / LONG4），超出安全整数范围时保留为 BigInt
const littleEndianInt = (bytes) => {
    if (bytes.length === 0) return 0;
    let n = 0n;
    for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
    if (bytes[bytes.length - 1] & 0x80) n -= 1n << BigInt(bytes.length * 8);
    return Number.isSafeInteger(Number(n)) ? Number(n) : n;
};

// 协议 0 的文本整数：INT 中 "01" / "00" 表示 True / False，LONG 以 L 结尾
const textInt = (line) => {
    if (line === '01') return true;
    if (line === '00') return false;
    const n = BigInt(line.replace(/L$/, ''));
    return Number.isSafeInteger(Number(n)) ? Number(n) : n;
};

// 协议 0 的 UNICODE 为 raw-unicode-escape：只转义 \uXXXX 与 \UXXXXXXXX
const rawUnicode = (text) =>
    text.replace(/\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/g, (_, u, U) => String.fromCodePoint(parseInt(u || U, 16)));

/**
 * 解码 pickle 字节
 * @param {ArrayBuffer|Uint8Array} buffer - pickle 数据
 * @returns {*} 解码后的值
 */
export const unpickle = (buffer) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    let stack = [];
    const marks = [];
    const memo = new Map();

    const need = (n) => {
        if (pos + n > bytes.length) throw new Error('Pickle data is truncated');
    };
    const u8 = () => (need(1), bytes[pos++]);
    const u16 = () => (need(2), (pos += 2), view.getUint16(pos - 2, true));
    const u32 = () => (need(4), (pos += 4), view.getUint32(pos - 4, true));
    const i32 = () => (need(4), (pos += 4), view.getInt32(pos - 4, true));
    const u64 = () => {
        need(8);
        const n = Number(view.getBigUint64(pos, true));
        pos += 8;
        return n;
    };
    const take = (n) => {
        need(n);
        pos += n;
        return bytes.subarray(pos - n, pos);
    };
    const line = () => {
        const end = bytes.indexOf(0x0a, pos);
        if (end < 0) throw new Error('Pickle data is truncated');
        const text = latin1(bytes.subarray(pos, end));
        pos = end + 1;
        return text;
    };
    // 协议 0 的 STRING 是带引号的 Python 字面量
    const quoted = (text) => {
        const body = text.slice(1, -1);
        return body.replace(/\\(x[0-9a-fA-F]{2}|.)/g, (_, e) =>
            e[0] === 'x' ? String.fromCharCode(parseInt(e.slice(1), 16)) : ({ n: '\n', r: '\r', t: '\t' }[e] ?? e)
        );
    };
    const top = () => {
        if (!stack.length) throw new Error('Pickle stack underflow');
        return stack[stack.length - 1];
    };
    const pop = () => {
        if (!stack.length) throw new Error('Pickle stack underflow');
        return stack.pop();
    };
    const popMark = () => {
        if (!marks.length) throw new Error('Pickle MARK missing');
        const items = stack;
        stack = marks.pop();
        return items;
    };
    const get = (key) => {
        if (!memo.has(key)) throw new Error(`Pickle memo key ${key} missing`);
        return memo.get(key);
    };
    const setItems = (target, items) => {
        for (let i = 0; i + 1 < items.length; i += 2) {
            if (target instanceof Map) target.set(items[i], items[i + 1]);
        }
    };
    const call = (fn, args) => (fn instanceof Callable ? fn.call(args) : new PyObject(String(fn?.name ?? 'object')));

    for (;;) {
        const op = String.fromCharCode(u8());
        switch (op) {
            // 协议与分帧
            case '\x80': u8(); break; // PROTO
            case '\x95': u64(); break; // FRAME
            case '.': // STOP
                return pop();

            // 栈操作
            case '(': marks.push(stack); stack = []; break; // MARK
            case '0': pop(); break; // POP
            case '1': popMark(); break; // POP_MARK
            case '2': stack.push(top()); break; // DUP

            // 常量
            case 'N': stack.push(null); break; // NONE
            case '\x88': stack.push(true); break; // NEWTRUE
            case '\x89': stack.push(false); break; // NEWFALSE

            // 整数与浮点数
            case 'J': stack.push(i32()); break; // BININT
            case 'K': stack.push(u8()); break; // BININT1
            case 'M': stack.push(u16()); break; // BININT2
            case 'I': stack.push(textInt(line())); break; // INT
            case 'L': stack.push(textInt(line())); break; // LONG
            case '\x8a': stack.push(littleEndianInt(take(u8()))); break; // LONG1
            case '\x8b': stack.push(littleEndianInt(take(i32()))); break; // LONG4
            case 'G': need(8); stack.push(view.getFloat64(pos, false)); pos += 8; break; // BINFLOAT
            case 'F': stack.push(parseFloat(line())); break; // FLOAT

            // 字符串与字节
            case '\x8c': stack.push(decoder.decode(take(u8()))); break; // SHORT_BINUNICODE
            case 'X': stack.push(decoder.decode(take(u32()))); break; // BINUNICODE
            case '\x8d': stack.push(decoder.decode(take(u64()))); break; // BINUNICODE8
            case 'V': stack.push(rawUnicode(line())); break; // UNICODE
            case 'U': stack.push(latin1(take(u8()))); break; // SHORT_BINSTRING（Python 2 str）
            case 'T': stack.push(latin1(take(i32()))); break; // BINSTRING
            case 'S': stack.push(quoted(line())); break; // STRING
            case 'C': stack.push(take(u8()).slice()); break; // SHORT_BINBYTES
            case 'B': stack.push(take(u32()).slice()); break; // BINBYTES
            case '\x8e': stack.push(take(u64()).slice()); break; // BINBYTES8
            case '\x96': stack.push(take(u64()).slice()); break; // BYTEARRAY8

            // 容器
            case '}': stack.push(new Map()); break; // EMPTY_DICT
            case 'd': { const items = popMark(); const m = new Map(); setItems(m, items); stack.push(m); break; } // DICT
            case 's': { const v = pop(); const k = pop(); setItems(top(), [k, v]); break; } // SETITEM
            case 'u': { const items = popMark(); setItems(top(), items); break; } // SETITEMS
            case ']': stack.push([]); break; // EMPTY_LIST
            case 'l': { const items = popMark(); stack.push(items); break; } // LIST
            case 'a': { const v = pop(); const t = top(); if (Array.isArray(t)) t.push(v); break; } // APPEND
            case 'e': { const items = popMark(); const t = top(); if (Array.isArray(t)) t.push(...items); break; } // APPENDS
            case ')': stack.push(new PyTuple()); break; // EMPTY_TUPLE
            case 't': { const items = popMark(); stack.push(PyTuple.from(items)); break; } // TUPLE
            case '\x85': stack.push(PyTuple.of(pop())); break; // TUPLE1
            case '\x86': { const b = pop(); const a = pop(); stack.push(PyTuple.of(a, b)); break; } // TUPLE2
            case '\x87': { const c = pop(); const b = pop(); const a = pop(); stack.push(PyTuple.of(a, b, c)); break; } // TUPLE3
            case '\x8f': stack.push(new PySet()); break; // EMPTY_SET
            case '\x90': { const items = popMark(); const t = top(); if (t instanceof PySet) t.push(...items); break; } // ADDITEMS
            case '\x91': { const items = popMark(); stack.push(PySet.from(items)); break; } // FROZENSET

            // 备忘录
            case 'p': memo.set(Number(line()), top()); break; // PUT
            case 'q': memo.set(u8(), top()); break; // BINPUT
            case 'r': memo.set(u32(), top()); break; // LONG_BINPUT
            case '\x94': memo.set(memo.size, top()); break; // MEMOIZE
            case 'g': stack.push(get(Number(line()))); break; // GET
            case 'h': stack.push(get(u8())); break; // BINGET
            case 'j': stack.push(get(u32())); break; // LONG_BINGET

            // 类与对象：只认 KNOWN 中的类，其余为占位，不导入、不调用任何东西
            case 'c': { const module = line(); stack.push(new Callable(module, line())); break; } // GLOBAL
            case '\x93': { const name = pop(); const module = pop(); stack.push(new Callable(module, name)); break; } // STACK_GLOBAL
            case 'R': { const args = pop(); const fn = pop(); stack.push(call(fn, args)); break; } // REDUCE
            case '\x81': { pop(); const cls = pop(); stack.push(call(cls, [])); break; } // NEWOBJ
            case '\x92': { pop(); pop(); const cls = pop(); stack.push(call(cls, [])); break; } // NEWOBJ_EX
            case 'b': { const state = pop(); const t = top(); if (t instanceof Map && state instanceof Map) state.forEach((v, k) => t.set(k, v)); break; } // BUILD
            case 'i': { const module = line(); const name = line(); popMark(); stack.push(new PyObject(`${module}.${name}`)); break; } // INST
            case 'o': { const items = popMark(); stack.push(call(items[0], [])); break; } // OBJ

            default:
                throw new Error(`Unsupported pickle opcode 0x${op.charCodeAt(0).toString(16)} at byte ${pos - 1}`);
        }
    }
};

/**
 * 是否像 pickle 数据：协议 2 及以上以 0x80 + 协议号开头
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export const looksLikePickle = (bytes) => bytes.length > 2 && bytes[0] === 0x80 && bytes[1] >= 2 && bytes[1] <= 5;
