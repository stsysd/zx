import chalk from "chalk";
import { inspect } from "util";

export function interpCmd(quote, pieces, args) {
  let cmd = pieces[0],
    i = 0;
  while (i < args.length) {
    let s;
    if (Array.isArray(args[i])) {
      s = args[i].map((x) => quote(substitute(x))).join(" ");
    } else {
      s = quote(substitute(args[i]));
    }
    cmd += s + pieces[++i];
  }
  return cmd;
}

function substitute(arg) {
  if (arg instanceof ProcessOutput) {
    return arg.stdout.replace(/\n$/, "");
  }
  return arg.toString();
}

export function colorize(cmd) {
  return cmd.replace(/^\w+(\s|$)/, (substr) => {
    return chalk.greenBright(substr);
  });
}

export class ProcessPromise extends Promise {
  child = undefined;
  _stop = () => void 0;
  _nothrow = false;

  get stdin() {
    return this.child.stdin;
  }

  get stdout() {
    return this.child.stdout;
  }

  get stderr() {
    return this.child.stderr;
  }

  get exitCode() {
    return this.then((p) => p.exitCode).catch((p) => p.exitCode);
  }

  pipe(dest) {
    if (typeof dest === "string") {
      throw new Error("The pipe() method does not take strings. Forgot $?");
    }
    this._stop();
    if (dest instanceof ProcessPromise) {
      process.stdin.unpipe(dest.stdin);
      this.stdout.pipe(dest.stdin);
      return dest;
    }
    this.stdout.pipe(dest);
    return this;
  }
}

export class ProcessOutput extends Error {
  #code = 0;
  #stdout = "";
  #stderr = "";
  #combined = "";

  constructor({ code, stdout, stderr, combined, message }) {
    super(message);
    this.#code = code;
    this.#stdout = stdout;
    this.#stderr = stderr;
    this.#combined = combined;
  }

  toString() {
    return this.#combined;
  }

  get stdout() {
    return this.#stdout;
  }

  get stderr() {
    return this.#stderr;
  }

  get exitCode() {
    return this.#code;
  }

  [inspect.custom]() {
    let stringify = (s, c) => (s.length === 0 ? "''" : c(inspect(s)));
    return `ProcessOutput {
  stdout: ${stringify(this.stdout, chalk.green)},
  stderr: ${stringify(this.stderr, chalk.red)},
  exitCode: ${(this.exitCode === 0 ? chalk.green : chalk.red)(this.exitCode)}
}`;
  }
}
