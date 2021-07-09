import { Client } from "ssh2";
import { $ } from "./index.mjs";
import { ProcessPromise } from "./utils.mjs";
import { interpCmd, colorize, ProcessOutput } from "./utils.mjs";

export function ssh(opt, callback) {
  const conn = new Client();
  let __from = new Error().stack.split("at ")[2].trim();

  function $$(pieces, ...args) {
    let __from = new Error().stack.split("at ")[2].trim();
    let cmd = interpCmd($.quote, pieces, args);
    let verbose = $$.verbose;
    if (verbose) {
      console.log(chalk.blueBright($$.prompt), "$", colorize(cmd));
    }
    cmd = `${$$.prefix} ${cmd}`;
    if ($$.cwd) {
      cmd = `cd ${$$.quote($$cwd)}; ${cmd}`;
    }
    let promise = new ProcessPromise((resolve, reject) => {
      conn.exec(cmd, { pty: $$.pty }, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        stream.on("exit", (code) => {
          stream.on("close", () => {
            let output = new ProcessOutput({
              code,
              stdout,
              stderr,
              combined,
              message: `${stderr || "\n"}    at ${__from}`,
            });
            (code === 0 || promise._nothrow ? resolve : reject)(output);
          });
        });
        if (process.stdin.isTTY) {
          process.stdin.pipe(stream.stdin);
        }
        let stdout = "",
          stderr = "",
          combined = "";
        function onStdout(data) {
          if (verbose) process.stdout.write(data);
          stdout += data;
          combined += data;
        }
        function onStderr(data) {
          if (verbose) process.stderr.write(data);
          stderr += data;
          combined += data;
        }
        stream.stdout.on("data", onStdout);
        stream.stderr.on("data", onStderr);
        promise._stop = () => {
          stream.stdout.off("data", onStdout);
          stream.stderr.off("data", onStderr);
        };
        promise.child = stream;
      });
    });
    return promise;
  }

  $$.prompt = `${opt.host}`;
  $$.verbose = $.verbose;
  $$.quote = $.quote;
  $$.cwd = "";
  $$.prefix = "";
  $$.pty = true;
  if ($.verbose) {
    if (opt.username) {
      console.log("$", colorize(`ssh ${opt.username}@${opt.host}`));
    } else {
      console.log("$", colorize(`ssh ${opt.host}`));
    }
  }
  return new Promise((resolve, reject) => {
    conn
      .on("ready", () => {
        if (callback) {
          callback($$)
            .then(resolve)
            .catch(reject)
            .finally(() => conn.end());
        } else {
          $$.close = () => conn.end();
          resolve($$);
        }
      })
      .on("error", (e) => {
        console.error(`ssh: ${opt.host}: ${e}`);
        console.error(`    at ${__from}`);
        process.exit(1);
      })
      .connect(opt);
  });
}
