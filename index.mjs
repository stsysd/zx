// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import fs from "fs-extra";
import os from "os";
import { promisify } from "util";
import { spawn } from "child_process";
import { createInterface } from "readline";
import { default as nodeFetch } from "node-fetch";
import which from "which";
import chalk from "chalk";
import minimist from "minimist";
import {
  interpCmd,
  colorize,
  ProcessPromise,
  ProcessOutput,
} from "./utils.mjs";
import { ssh } from "./ssh.mjs";

export function $(pieces, ...args) {
  let __from = new Error().stack.split("at ")[2].trim();
  let cmd = interpCmd($.quote, pieces, args);
  let verbose = $.verbose;
  if (verbose) console.log("$", colorize(cmd));
  let options = {
    cwd: $.cwd,
    shell: typeof $.shell === "string" ? $.shell : true,
    windowsHide: true,
  };
  let child = spawn($.prefix + cmd, options);
  let promise = new ProcessPromise((resolve, reject) => {
    child.on("exit", (code) => {
      child.on("close", () => {
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
  });
  if (process.stdin.isTTY) {
    process.stdin.pipe(child.stdin);
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
  child.stdout.on("data", onStdout);
  child.stderr.on("data", onStderr);
  promise._stop = () => {
    child.stdout.off("data", onStdout);
    child.stderr.off("data", onStderr);
  };
  promise.child = child;
  return promise;
}

export const argv = minimist(process.argv.slice(2));

$.verbose = !argv.quiet;
if (typeof argv.shell === "string") {
  $.shell = argv.shell;
  $.prefix = "";
} else {
  try {
    $.shell = await which("bash");
    $.prefix = "set -euo pipefail;";
  } catch (e) {
    $.prefix = ""; // Bash not found, no prefix.
  }
}
if (typeof argv.prefix === "string") {
  $.prefix = argv.prefix;
}
$.quote = quote;
$.cwd = undefined;

export function cd(path) {
  if ($.verbose) console.log("$", colorize(`cd ${path}`));
  if (!fs.existsSync(path)) {
    let __from = new Error().stack.split("at ")[2].trim();
    console.error(`cd: ${path}: No such directory`);
    console.error(`    at ${__from}`);
    process.exit(1);
  }
  $.cwd = path;
}

export async function question(query, options) {
  let completer = undefined;
  if (Array.isArray(options?.choices)) {
    completer = function completer(line) {
      const completions = options.choices;
      const hits = completions.filter((c) => c.startsWith(line));
      return [hits.length ? hits : completions, line];
    };
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  });
  const question = (q) =>
    new Promise((resolve) => rl.question(q ?? "", resolve));
  let answer = await question(query);
  rl.close();
  return answer;
}

export async function fetch(url, init) {
  if ($.verbose) {
    if (typeof init !== "undefined") {
      console.log("$", colorize(`fetch ${url}`), init);
    } else {
      console.log("$", colorize(`fetch ${url}`));
    }
  }
  return nodeFetch(url, init);
}

export const sleep = promisify(setTimeout);

export function nothrow(promise) {
  promise._nothrow = true;
  return promise;
}

function quote(arg) {
  if (/^[a-z0-9_.-/]+$/i.test(arg)) {
    return arg;
  }
  return (
    `$'` +
    arg
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\f/g, "\\f")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\v/g, "\\v")
      .replace(/\0/g, "\\0") +
    `'`
  );
}

Object.assign(global, {
  $,
  argv,
  cd,
  chalk,
  fetch,
  fs,
  nothrow,
  os,
  question,
  sleep,
  ssh,
});

export { chalk, fs, ProcessPromise, ProcessOutput };
