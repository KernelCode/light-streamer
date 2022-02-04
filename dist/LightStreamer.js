"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.File = exports.Streamer = void 0;
var http_1 = require("http");
var fs_1 = require("fs");
var path_1 = require("path");
var Throttle = require("throttle");
var mime = require("mime-types");
var File = /** @class */ (function () {
    function File(req, res, streamer) {
        this.events = {};
        this.req = req;
        this.res = res;
        this.streamer = streamer;
    }
    File.prototype.setFileName = function (filename) {
        this.fileName = filename;
        return this;
    };
    File.prototype.toString = function () {
        return this.getPath();
    };
    File.prototype.catch = function (cb) {
        this.catch_cb = cb;
        return this;
    };
    File.prototype.close = function (code, message) {
        if (this.stream) {
            this.stream.destroy();
        }
        else {
            this.res.sendStatus(code);
            this.res.end(message);
        }
    };
    File.prototype.getPath = function () {
        return (0, path_1.resolve)((0, path_1.join)(this.streamer.getConfig().resourceURI, this.fileName));
    };
    File.prototype.getStat = function () {
        if (!this.stat)
            this.stat = (0, fs_1.statSync)(this.getPath());
        return this.stat;
    };
    File.prototype.limitBandwidth = function (limit) {
        this.streamSpeed =
            (limit || this.streamer.getConfig().badwidthLimit) * 1024; // in kb/s
        return this;
    };
    File.prototype.on = function (event, cb) {
        this.events[event] = cb;
        return this;
    };
    File.prototype.send = function () {
        var _this = this;
        try {
            this.range = this.streamer.setupRangesAndHeaders(this.req, this.res, this);
            this.stream = (0, fs_1.createReadStream)(this.getPath(), {
                start: this.range.start,
                end: this.range.end || this.getStat().size,
            })
                .on("open", function () {
                if (!_this.streamSpeed)
                    return _this.stream.pipe(_this.res);
                _this.stream.pipe(new Throttle(_this.streamSpeed)).pipe(_this.res);
            })
                .on("data", function (data) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (this.events["stream"])
                        this.events["stream"]({
                            length: data.length,
                            data: data,
                        }, this);
                    return [2 /*return*/];
                });
            }); })
                .on("close", function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); }); })
                .on("error", function (err) {
                if (_this.catch_cb)
                    _this.catch_cb(err);
            });
            this.req.on("close", function () {
                _this.stream.destroy();
                _this.stream.close();
            });
        }
        catch (e) {
            if (this.catch_cb)
                this.catch_cb(e);
        }
        return this;
    };
    return File;
}());
exports.File = File;
var StreamerClass = /** @class */ (function () {
    function StreamerClass() {
        var _this = this;
        /*
         /stream/:video
         /stream/aaa.mp4/something
         /stream/kkk.mp4
         ["stream","aaa.mp4","something"]
         ["stream","kkk.mp4"]
         ["stream",":video"]
        */
        this._listners = {
            callbacks: [],
            cache: {},
            getIndex: function (url) {
                if (_this._listners.cache[url])
                    return _this._listners.cache[url];
                var result = _this._listners.callbacks.findIndex(function (cb, index) {
                    var sourceURL = url.split("/");
                    var distURL = cb[1].split("/");
                    if (sourceURL.length != distURL.length)
                        return false;
                    for (var i = 0; i < sourceURL.length; i++)
                        if (sourceURL[i] != distURL[i] && distURL[i][0] != ":")
                            return false;
                    return true;
                });
                _this._listners.cache[url] = result;
                return result;
            },
            check: function (url) {
                return _this._listners.getIndex(url) != -1;
            },
            getParamters: function (distURL, sourceURL) {
                var paramters = {};
                sourceURL = sourceURL.split("/");
                distURL = distURL.split("/");
                for (var i = 0; i < sourceURL.length; i++)
                    if (distURL[i][0] == ":")
                        paramters[distURL[i].substr(1)] = sourceURL[i];
                return paramters;
            },
            get: function (url) {
                return function () {
                    var _a;
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    var cb_index = _this._listners.getIndex(url);
                    if (cb_index > -1) {
                        args.push(_this._listners.getParamters(_this._listners.callbacks[cb_index][1], url));
                        return (_a = _this._listners.callbacks[cb_index])[0].apply(_a, args);
                    }
                    throw new Error("No callback found for this url");
                };
            },
            add: function (url, callback) { return _this._listners.callbacks.push([callback, url]); },
        };
    }
    StreamerClass.prototype.stream = function (url, callback) {
        this._listners.add(url, callback);
    };
    StreamerClass.prototype.getConfig = function () {
        return this._config;
    };
    StreamerClass.prototype.config = function (config) {
        this._config = config;
        return this;
    };
    StreamerClass.getInstance = function () {
        // Singleton
        if (!this.instance)
            this.instance = new StreamerClass();
        return this.instance;
    };
    StreamerClass.prototype.expressMiddleware = function (config) {
        var _this = this;
        this.config(config);
        // setup endpoints;
        config.router
            ? config.router.endpoints.map(function (endpoint) {
                _this._listners[endpoint] = config.router.callback;
            })
            : null;
        return function (req, res, next) {
            if (!_this._listners.check(req.url)) {
                next();
                return;
            }
            var ERROR_OBJ = { code: 0, message: "" };
            var file;
            try {
                file = new File(req, res, _this);
            }
            catch (err) {
                ERROR_OBJ = { code: 1, message: "Error Creating File" };
            }
            return _this._listners.get(req.url)(ERROR_OBJ, file, _this._config);
        };
    };
    StreamerClass.prototype.setupRangesAndHeaders = function (req, res, file) {
        var stat = file.getStat();
        var range = req.headers.range;
        if (range !== undefined) {
            var parts = range.replace(/bytes=/, "").split("-");
            var partial_start = parts[0];
            var partial_end = parts[1];
            if ((isNaN(partial_start) && partial_start.length > 1) ||
                (isNaN(partial_end) && partial_end.length > 1)) {
                return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
            }
            var start = parseInt(partial_start, 10);
            var end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
            var content_length = end - start + 1;
            res.status(206).header({
                "Content-Type": this._config.mime || mime.lookup(file.getPath()),
                "Content-Length": content_length,
                "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
            });
            return { start: start, end: end };
        }
        else {
            res.header({
                "Content-Type": this._config.mime || mime.lookup(file.getPath()),
                "Content-Length": stat.size,
            });
            return { start: 0, end: stat.size - 1 };
        }
    };
    StreamerClass.prototype.maptoExpress = function (res) {
        if (res.header)
            return res;
        res.header = function (headers) {
            return Object.keys(headers).map(function (o) { return res.setHeader(o, headers[o]); });
        };
        res.status = function (status) {
            res.statusCode = status;
            return res;
        };
        res.sendStatus = function (status) {
            res.statusCode = status;
            return res;
        };
        return res;
    };
    StreamerClass.prototype.incomingReqs = function (req, res) {
        res = this.maptoExpress(res);
        if (this._listners.check(req.url)) {
            var ERROR_OBJ = { code: 0, message: "" };
            var file = void 0;
            try {
                file = new File(req, res, this);
            }
            catch (err) {
                ERROR_OBJ = { code: 1, message: "Error Creating File" };
            }
            return this._listners.get(req.url)(ERROR_OBJ, file, this._config);
        }
        res.end("error 404");
    };
    StreamerClass.prototype.listen = function (port, cb) {
        var server = (0, http_1.createServer)(this.incomingReqs.bind(this));
        server.listen(port, cb);
    };
    return StreamerClass;
}());
var Streamer = StreamerClass.getInstance();
exports.Streamer = Streamer;
