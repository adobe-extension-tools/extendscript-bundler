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
var log = debug('extendscript-bundler');
var escape = function (str) { return str.replace(/[\\"]/g, '\\$&'); };
function sendJsxToApp(jsxFile, applicationPath) {
    log('-> sendJsxToApp');
    var appleScriptPath = path.join(os.tmpdir(), "evalinadobe.scpt");
    var code = "try {\n    $.evalFile(\"" + jsxFile + "\");\n    $.writeln('Live-reloaded JSX');\n  } catch (err) {\n    $.writeln('Unable to livereload: ' + err.message + ' on line ' + err.line);\n  }";
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
exports["default"] = function (opts) {
    log(opts);
    if (opts.live) {
        watch(opts);
    }
    else {
        build(opts);
    }
};
