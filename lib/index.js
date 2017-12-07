"use strict";
/// <reference path="./index.d.ts" />
exports.__esModule = true;
var os = require("os");
var path = require("path");
var fs = require("fs");
var child_process_1 = require("child_process");
var browserify = require("browserify");
var watchify = require("watchify");
var prependify = require("prependify");
var envify = require("envify");
var debug = require("debug");
var yuicompressor = require("yuicompressor");
var http = require("http");
var log = debug('extendscript-bundler');
var escape = function (str) { return str.replace(/[\\"]/g, '\\$&'); };
function sendJsxToApp(jsxFile, applicationPath) {
    log('-> sendJsxToApp');
    var appleScriptPath = path.join(os.tmpdir(), "evalinadobe.scpt");
    var code = "$.global.errorToPretty = function (err) {\n  var stack = $.stack.split('\\n')\n  stack.shift()\n  var lines = (err.source && err.source.split('\\n')) || []\n  err.line--;\n  return {\n    name: err.name,\n    message: err.message,\n    line: err.line,\n    context: [\n      lines[err.line - 2] || '',\n      lines[err.line - 1] || '',\n      lines[err.line] || '',\n      lines[err.line + 1] || '',\n      lines[err.line + 2] || ''\n    ],\n    stack: stack\n  }\n}\ntry {\n  $.evalFile(\"" + jsxFile + "\");\n  $.writeln('Live-reloaded JSX');\n} catch (err) {\n  $.writeln('Unable to livereload: ' + JSON.stringify($.global.errorToPretty(err), undefined, 2));\n}";
    var appleScriptContents = "tell application \"" + applicationPath + "\"\n  DoScript \"" + escape(code) + "\"\nend tell";
    fs.writeFileSync(appleScriptPath, appleScriptContents, 'utf8');
    child_process_1.execSync("osascript \"" + appleScriptPath + "\"");
}
function getBundler(opts) {
    log('-> getBundler');
    var bundler = browserify({
        entries: [opts.entry],
        cache: {},
        packageCache: {}
    });
    bundler.plugin(prependify, "var globalThis = this;");
    bundler.transform(envify);
    return bundler;
}
function build(opts) {
    log('-> build');
    var bundler = getBundler(opts);
    var writeStream = fs.createWriteStream(opts.dest);
    bundler.bundle()
        .on('error', function (err) { return console.error(err.message); })
        .pipe(writeStream);
}
function watch(opts) {
    if (opts.logServerPort) {
        startLogServer(opts);
        process.env.LOG_SERVER_PORT = opts.logServerPort + '';
    }
    log('-> watch');
    var bundler = getBundler(opts);
    bundler.plugin(watchify);
    function bundle() {
        log('-> bundle');
        var writeStream = fs.createWriteStream(opts.dest);
        writeStream.on('finish', function () {
            var contents = fs.readFileSync(opts.dest, 'utf8');
            if (opts.minify) {
                yuicompressor.compress(contents, {
                    charset: 'utf8',
                    type: 'js',
                    'preserve-semi': true
                }, function (err, minified) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    fs.writeFileSync(opts.dest, minified);
                });
            }
            sendJsxToApp(opts.dest, opts.app);
        });
        bundler.bundle()
            .on('error', function (err) { return console.error(err.message); })
            .pipe(writeStream);
    }
    bundler.on('update', bundle);
    bundle();
}
function startLogServer(opts) {
    log('-> startLogServer');
    var server = http.createServer(function (req, res) {
        var method = req.method, url = req.url;
        var bodyChunks = [];
        req.on('data', function (chunk) {
            bodyChunks.push(chunk);
        })
            .on('end', function () {
            var body = Buffer.concat(bodyChunks).toString();
            try {
                var parsedBody = JSON.parse(body);
                if (parsedBody.type && parsedBody.type === '__ERROR__') {
                    console.error("Error: " + parsedBody.message + " on line " + parsedBody.line);
                    console.error("Context:");
                    console.error('\t' + parsedBody.context.join('\n\t'));
                    console.error("Stack:");
                    console.error('\t' + parsedBody.stack.join('\n\t'));
                }
                else {
                    console.log(parsedBody);
                }
            }
            catch (err) { }
        });
        res.writeHead(200, {
            'Content-Type': 'text/plain'
        });
        res.end(JSON.stringify({
            success: true
        }));
    });
    server.listen(opts.logServerPort);
}
exports["default"] = function (opts) {
    log(opts);
    if (opts.live) {
        watch(opts);
    }
    else {
        build(opts);
    }
};
