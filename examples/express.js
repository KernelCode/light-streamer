const { Streamer } = require("../dist/LightStreamer");
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
