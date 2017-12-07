/// <reference path="./index.d.ts" />

import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import * as browserify from 'browserify'
import * as watchify from 'watchify'
import * as prependify from 'prependify'
import * as envify from 'envify'
import * as debug from 'debug'
import * as yuicompressor from 'yuicompressor'
import * as http from 'http'

const log = debug('extendscript-bundler')

interface BundlerOpts {
  app: string;
  live: boolean;
  entry: string;
  dest: string;
  minify: boolean;
  logServerPort: number;
}

const escape = (str: string) => str.replace(/[\\"]/g, '\\$&')

function sendJsxToApp(jsxFile: string, applicationPath: string) {
  log('-> sendJsxToApp')
  const appleScriptPath = path.join(os.tmpdir(), `evalinadobe.scpt`);
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
  $.evalFile("${jsxFile}");
  $.writeln('Live-reloaded JSX');
} catch (err) {
  $.writeln('Unable to livereload: ' + JSON.stringify($.global.errorToPretty(err), undefined, 2));
}`
  const appleScriptContents = `tell application "${applicationPath}"
  DoScript "${escape(code)}"
end tell`;
  fs.writeFileSync(appleScriptPath, appleScriptContents, 'utf8');
  execSync(`osascript "${appleScriptPath}"`)
}

function getBundler(opts: BundlerOpts) {
  log('-> getBundler')
  const bundler = browserify({
    entries: [opts.entry],
    cache: {},
    packageCache: {}
  })
  bundler.plugin(prependify, `var globalThis = this;`)
  bundler.transform(envify)
  return bundler
}

function build(opts: BundlerOpts) {
  log('-> build')
  const bundler = getBundler(opts)
  const writeStream = fs.createWriteStream(opts.dest)
  bundler.bundle()
    .on('error', (err: Error) => console.error(err.message))
    .pipe(writeStream)
}

function watch(opts: BundlerOpts) {
  if (opts.logServerPort) {
    startLogServer(opts)
    process.env.LOG_SERVER_PORT = opts.logServerPort + ''
  }
  log('-> watch')
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
      sendJsxToApp(opts.dest, opts.app)
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

export default (opts: BundlerOpts) => {
  log(opts)
  if (opts.live) {
    watch(opts)
  } else {
    build(opts)
  }
}