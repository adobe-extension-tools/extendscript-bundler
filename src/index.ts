/// <reference path="./index.d.ts" />

import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { execSync, spawn } from 'child_process'
import * as browserify from 'browserify'
import * as watchify from 'watchify'
import * as prependify from 'prependify'
import * as envify from 'envify'
import * as debug from 'debug'
import * as yuicompressor from 'yuicompressor'
import * as http from 'http'
import * as fetch from 'node-fetch'

const log = debug('extendscript-bundler')

interface BundlerOpts {
  tsEntry: string;
  jsEntry: string;
  dest: string;
  minify: boolean;
  logServerPort?: number;
  devConnectPort: number;
  devConnectHost?: string;
}

const escape = (str: string) => str.replace(/[\\"]/g, '\\$&')

function sendJsxToApp(opts: BundlerOpts) {
  log('-> sendJsxToApp')
  const code = `$.global.errorToPretty = function (err) {
  var stack = $.stack.split('\\n')
  stack.shift()
  var lines = (err.source && err.source.split('\\n')) || []
  err.line--;
  return {
    name: err.name,
    message: err.message,
    line: err.line,
    context: [
      lines[err.line - 2] || '',
      lines[err.line - 1] || '',
      lines[err.line] || '',
      lines[err.line + 1] || '',
      lines[err.line + 2] || ''
    ],
    stack: stack
  }
}
try {
  $.evalFile('${opts.dest}');
  $.writeln('Live-reloaded JSX');
} catch (err) {
  $.writeln('Unable to livereload: ' + JSON.stringify($.global.errorToPretty(err), undefined, 2));
}`
  fetch(`http://${opts.devConnectHost || 'localhost'}:${opts.devConnectPort}`, {
    method: 'POST',
    headers: [
      ['content-type', 'application/json']
    ],
    body: JSON.stringify({ jsx: code })
  })
  .catch((err: Error) => {
    console.log(`Unable to connect to "Dev Connect" (${`http://${opts.devConnectHost || 'localhost'}:${opts.devConnectPort}`}) extension, did you install and open it in the target application?`)
  })
}

function getBundler(opts: BundlerOpts) {
  log('-> getBundler')
  const bundler = browserify({
    entries: [opts.jsEntry],
    cache: {},
    packageCache: {}
  })
  bundler.plugin(prependify, `var globalThis = this;`)
  bundler.transform(envify)
  return bundler
}

function typescriptCompile(opts: BundlerOpts) {
  console.log('-> typescriptCompile')
  let tscPath = `${__dirname}/../../.bin/tsc`
  if (!fs.existsSync(tscPath)) {
    tscPath = `${__dirname}/../node_modules/.bin/tsc`
  }
  try {
    execSync(`${tscPath} --project ${opts.tsEntry}`)
  } catch (err) {
    console.log(err.stdout.toString())
    process.exit(1)
  }
}

function typescriptWatch(opts: BundlerOpts) {
  console.log('-> typescriptWatch')
  let tscPath = `${__dirname}/../../.bin/tsc`
  if (!fs.existsSync(tscPath)) {
    tscPath = `${__dirname}/../node_modules/.bin/tsc`
  }
  const jsTsc = spawn(tscPath, ['--watch', '--project', opts.tsEntry], {
    env: process.env,
    stdio: 'inherit'
  })
  process.on('exit', function () {
    jsTsc.kill()
  })
}

export function build(opts: BundlerOpts) {
  log('-> build')
  try {
    typescriptCompile(opts)
  } catch (err) {}
  const bundler = getBundler(opts)
  const writeStream = fs.createWriteStream(opts.dest)
  bundler.bundle()
    .on('error', (err: Error) => console.error(err.message))
    .pipe(writeStream)
}

export function watch(opts: BundlerOpts) {
  log('-> watch')  
  typescriptCompile(opts)
  typescriptWatch(opts)
  if (opts.logServerPort) {
    startLogServer(opts)
    process.env.LOG_SERVER_PORT = opts.logServerPort + ''
  }
  const bundler = getBundler(opts)
  bundler.plugin(watchify)
  function bundle() {
    log('-> bundle')
    const writeStream = fs.createWriteStream(opts.dest)
    writeStream.on('finish', () => {
      const contents = fs.readFileSync(opts.dest, 'utf8')
      if (opts.minify) {
        yuicompressor.compress(
          contents,
          {
            charset: 'utf8',
            type: 'js',
            'preserve-semi': true,
            // nomunge: false
          },
          function (err: Error, minified: string) {
            if (err) {
              console.error(err)
              return
            }
            fs.writeFileSync(opts.dest, minified)
          }
        )
      }
      try {
        sendJsxToApp(opts)
      } catch (err) {
        console.log(err)
      }
    })
    bundler.bundle()
      .on('error', (err: Error) => console.error(err.message))
      .pipe(writeStream)
  }
  bundler.on('update', bundle)
  bundle()
}

function startLogServer(opts: BundlerOpts) {
  log('-> startLogServer')
  const server = http.createServer((req, res) => {
    const { method, url } = req
    let bodyChunks: any[] = []
    req.on('data', (chunk) => {
      bodyChunks.push(chunk)
    })
    .on('end', () => {
      const body: string = Buffer.concat(bodyChunks).toString()
      try {
        const parsedBody = JSON.parse(body)
        if (parsedBody.type && parsedBody.type === '__ERROR__') {
          console.error(`Error: ${parsedBody.message} on line ${parsedBody.line}`)
          console.error(`Context:`)
          console.error('\t' + parsedBody.context.join('\n\t'))
          console.error(`Stack:`)
          console.error('\t' + parsedBody.stack.join('\n\t'))
        } else {
          console.log(parsedBody)
        }
      } catch (err) {}
    })
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    })
    res.end(JSON.stringify({
      success: true
    }))
  })
  server.listen(opts.logServerPort)
}