import { createServer } from "http";
import { createReadStream, statSync } from "fs";
import { resolve, join } from "path";

const Throttle = require("throttle");
const mime = require("mime-types");
type Chunk = {
  length: number;
  data: Buffer;
};
class File {
  private req: any;
  private res: any;
  private fileName: string;
  public stream: any;
  private streamer: StreamerClass;
  private events: { [key: string]: any } = {};
  private streamSpeed: number;
  public range: {
    start: number;
    end?: number;
  };
  public catch_cb;
  private stat: any;
  constructor(req, res, streamer: StreamerClass) {
    this.req = req;
    this.res = res;

    this.streamer = streamer;
  }
  setFileName(filename: string) {
    this.fileName = filename;
    return this;
  }
  public toString() {
    return this.getPath();
  }
  public catch(cb) {
    this.catch_cb = cb;
    return this;
  }
  close(code: number, message: string) {
    if (this.stream) {
      this.stream.destroy();
    } else {
      this.res.sendStatus(code);
      this.res.end(message);
    }
  }
  getPath() {
    return resolve(join(this.streamer.getConfig().resourceURI, this.fileName));
  }
  getStat() {
    if (!this.stat) this.stat = statSync(this.getPath());
    return this.stat;
  }
  limitBandwidth(limit: number): File {
    this.streamSpeed =
      (limit || this.streamer.getConfig().badwidthLimit) * 1024; // in kb/s
    return this;
  }
  on(event: string, cb: any): File {
    this.events[event] = cb;
    return this;
  }
  send(): File {
    try {
      this.range = this.streamer.setupRangesAndHeaders(
        this.req,
        this.res,
        this
      );
      this.stream = createReadStream(this.getPath(), {
        start: this.range.start,
        end: this.range.end || this.getStat().size,
      })
        .on("open", () => {
          if (!this.streamSpeed) return this.stream.pipe(this.res);

          this.stream.pipe(new Throttle(this.streamSpeed)).pipe(this.res);
        })
        .on("data", async (data) => {
          if (this.events["stream"])
            this.events["stream"](
              {
                length: data.length,
                data,
              },
              this
            );
        })
        .on("close", async () => {})
        .on("error", (err) => {
          if (this.catch_cb) this.catch_cb(err);
        });
      this.req.on("close", () => {
        this.stream.destroy();
        this.stream.close();
      });
    } catch (e) {
      if (this.catch_cb) this.catch_cb(e);
    }

    return this;
  }
}
type StreamError = {
  code: number;
  message: string;
};
type StreamConfig = {
  streamBy?: string; // "headers" | "body" | "query"
  badwidthLimit?: number;
  mime?: string; // defualt is "application/octet-stream"
  resourceURI: string;
  router?: {
    endpoints: [string];
    callback: StreamerCallback;
  };

  //...
};
type StreamerCallback = (
  error: StreamError,
  file: File,
  streamConfig: StreamConfig
) => any;

class StreamerClass {
  private _config: StreamConfig;
  /*
   /stream/:video
   /stream/aaa.mp4/something
   /stream/kkk.mp4
   ["stream","aaa.mp4","something"]
   ["stream","kkk.mp4"]
   ["stream",":video"]
  */
  private _listners = {
    callbacks: [],
    cache: {},
    getIndex: (url) => {
      if (this._listners.cache[url]) return this._listners.cache[url];
      let result = this._listners.callbacks.findIndex((cb, index) => {
        let sourceURL = url.split("/");
        let distURL = cb[1].split("/");
        if (sourceURL.length != distURL.length) return false;

        for (let i = 0; i < sourceURL.length; i++)
          if (sourceURL[i] != distURL[i] && distURL[i][0] != ":") return false;

        return true;
      });

      this._listners.cache[url] = result;
      return result;
    },
    check: (url) => {
      return this._listners.getIndex(url) != -1;
    },
    getParamters(distURL, sourceURL) {
      let paramters = {};
      sourceURL = sourceURL.split("/");
      distURL = distURL.split("/");

      for (let i = 0; i < sourceURL.length; i++)
        if (distURL[i][0] == ":")
          paramters[distURL[i].substr(1)] = sourceURL[i];
      return paramters;
    },
    get: (url) => {
      return (...args) => {
        let cb_index = this._listners.getIndex(url);

        if (cb_index > -1) {
          args.push(
            this._listners.getParamters(
              this._listners.callbacks[cb_index][1],
              url
            )
          );
          return this._listners.callbacks[cb_index][0](...args);
        }

        throw new Error("No callback found for this url");
      };
    },
    add: (url, callback) => this._listners.callbacks.push([callback, url]),
  };
  private static instance: StreamerClass;
  stream(url: string, callback: StreamerCallback): any {
    this._listners.add(url, callback);
  }
  getConfig() {
    return this._config;
  }
  config(config: StreamConfig) {
    this._config = config;
    return this;
  }

  public static getInstance(): StreamerClass {
    // Singleton
    if (!this.instance) this.instance = new StreamerClass();
    return this.instance;
  }
  public expressMiddleware(config: StreamConfig) {
    this.config(config);
    // setup endpoints;
    config.router
      ? config.router.endpoints.map((endpoint) => {
          this._listners[endpoint] = config.router.callback;
        })
      : null;

    return (req, res, next) => {
      if (!this._listners.check(req.url)) {
        next();
        return;
      }
      let ERROR_OBJ = { code: 0, message: "" };

      let file;
      try {
        file = new File(req, res, this);
      } catch (err) {
        ERROR_OBJ = { code: 1, message: "Error Creating File" };
      }
      return this._listners.get(req.url)(ERROR_OBJ, file, this._config);
    };
  }

  public setupRangesAndHeaders(req: any, res: any, file: File) {
    let stat = file.getStat();
    let range = req.headers.range;

    if (range !== undefined) {
      let parts = range.replace(/bytes=/, "").split("-");

      let partial_start = parts[0];
      let partial_end = parts[1];

      if (
        (isNaN(partial_start) && partial_start.length > 1) ||
        (isNaN(partial_end) && partial_end.length > 1)
      ) {
        return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
      }

      let start = parseInt(partial_start, 10);
      let end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
      let content_length = end - start + 1;

      res.status(206).header({
        "Content-Type": this._config.mime || mime.lookup(file.getPath()),
        "Content-Length": content_length,
        "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
      });
      return { start, end };
    } else {
      res.header({
        "Content-Type": this._config.mime || mime.lookup(file.getPath()),
        "Content-Length": stat.size,
      });
      return { start: 0, end: stat.size - 1 };
    }
  }
  maptoExpress(res) {
    if (res.header) return res;

    res.header = (headers: object) =>
      Object.keys(headers).map((o) => res.setHeader(o, headers[o]));

    res.status = (status: number) => {
      res.statusCode = status;
      return res;
    };
    res.sendStatus = (status: number) => {
      res.statusCode = status;
      return res;
    };

    return res;
  }
  private incomingReqs(req: any, res: any) {
    res = this.maptoExpress(res);

    if (this._listners.check(req.url)) {
      let ERROR_OBJ = { code: 0, message: "" };
      let file;
      try {
        file = new File(req, res, this);
      } catch (err) {
        ERROR_OBJ = { code: 1, message: "Error Creating File" };
      }
      return this._listners.get(req.url)(ERROR_OBJ, file, this._config);
    }

    res.end("error 404");
  }
  listen(port: number, cb: any) {
    const server = createServer(this.incomingReqs.bind(this));
    server.listen(port, cb);
  }
}

const Streamer = StreamerClass.getInstance();

export { Streamer, Chunk, StreamConfig, File, StreamError, StreamerCallback };
