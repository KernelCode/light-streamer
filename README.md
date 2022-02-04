# [light-streamer](http://altahery.com/light-streamer)

A JavaScript library for streaming video/audio files to browser with http-range header

## Node.JS

```js
const { Streamer } = require("light-streamer");

Streamer.config({
  streamBy: "headers",
  badwidthLimit: 300,
  resourceURI: __dirname + "/videos",
});
/*
  avengers.mp4
  bunny.mp4
  ...
  
*/
Streamer.stream("/stream/:video", (error, file, streamConfig, params) => {
  if (error.code != 0) throw new Error(error.message);

  file.on("stream", (chunk, file) => {
    console.log(chunk.length);
  });

  return file
    .setFileName(params.video) // "avengers.mp4"
    .limitBandwidth(streamConfig.badwidthLimit || 100 /* kb/s */)
    .catch((error) => {
      console.log(error);
      file.close(404, "not found!");
    })
    .send();
});

Streamer.listen(3000, (error) => {
  if (error) throw new Error(error.message);
  console.log("Server is listening on port 3000");
});
```

## Express.JS

```js
const { Streamer } = require("light-streamer");
const express = require("express");
const app = express();

app.use(
  Streamer.expressMiddleware({
    streamBy: "headers",
    badwidthLimit: 300,
    resourceURI: __dirname + "/videos",
    router: {
      endpoints: ["/stream/:video"],
      callback: (error, file, streamConfig, params) => {
        if (error.code != 0) throw new Error(error.message);

        return file
          .setFileName(params.video) // "avengers.mp4"
          .limitBandwidth(streamConfig.badwidthLimit || 100 /* kb/s */)
          .catch((error) => {
            console.log(error);
            file.close(404, "not found!");
          })
          .send();
      },
    },
  })
);

app.listen(3000);
```

## License

light-streamer is freely distributable under the terms of the [MIT license][license-url].
