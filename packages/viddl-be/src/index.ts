import express from "express";
import fs from "fs";
import path from "path";
import youtubedl from "youtube-dl";
import cors from "cors";
import IO = require("socket.io");
import * as HTTP from "http";
import "./polyfill";

const app = express();
app.use(cors());

const cache: { [url: string]: Array<any> } = {};
const queue = [];

function fetchInfo(url, params = []) {
  const processArgs = {
      maxBuffer: 1024 * 1024 * 10 // 10MB
  };
  return new Promise((resolve, reject) => {
    console.log(`Fetching video data for ${url}`);
    try {
      youtubedl.getInfo(url, params, processArgs, (err, data) => {
        if (err) return reject(err);
        else return resolve(data);
      });
    } catch (err) {
      console.log("Err", err);
    }
  });
}

async function* iterateInfo(url: string, startIndex = 1, batchSize = 3) {
  let failureCount = 0;
  let lastBatch = [];
  if (url.includes("playlist")) {
    do {
      try {
        const batch = `${startIndex}-${startIndex + batchSize}`;
        const playlistParams = [`--playlist-items=${batch}`];
        console.log("Fetching ", url, "video", batch);
        lastBatch = (await fetchInfo(url, playlistParams)) as Array<any>;
        // inclusive if successful
        startIndex += batchSize + 1;
        failureCount = 0;

        for (let item of lastBatch) {
          yield item;
        }
      } catch (e) {
        if (batchSize <= 0) {
          startIndex++;
          batchSize = 3;
          failureCount++;
        } else {
          batchSize--;
        }
      }
    } while (
      startIndex < batchSize ||
      (lastBatch.length >= 0 && failureCount < 3)
    );
  } else {
    try {
      const videoInfo = await fetchInfo(url, []);
      yield videoInfo;
    } catch (e) {
      console.log(e);
    }
  }
}

app.use("/info/:url", async (req, res) => {
  const url = decodeURIComponent(req.params.url);
  if (cache[url]) {
    res.json(cache[url]);
  } else {
    res.status(307).json({ status: `use websockets to fetch data for ${url}` });
  }
});

function saveVideo(url, params, options, writeStream, notify='') {
  const video = youtubedl(url, params, options);
  video.on("info", info => {
    writeStream.setHeader(
      "Content-disposition",
      "attachment; filename=" + info.title + `.${info.ext}`
    );
    console.log("Saving video", url);
    video.pipe(writeStream);
    if(notify) {
      io.to(notify).emit('download:start', url);
    }
  });
  video.on('end', function() {
    if(notify) {
      io.to(notify).emit('download:complete', url);
    }
  });
  return video;
}

app.use("/download/:format/:url/:notify", async (req, res) => {
  const url = decodeURIComponent(req.params.url);
  const format = `--format=${req.params.format || 136}`;
  console.log(url, format);
  const params = [format];
  const options = {};
  saveVideo(url, params, options, res, req.params.notify);
});

app.use("/valid/:url", async (req, res) => {
  const url = decodeURIComponent(req.params.url);
  const valid = await youtubedl.validateURL(url);
  res.json({ valid });
});

const port = 8080;
const server = HTTP.createServer(app);
const io = IO(server);

io.on("connection", socket => {
  console.log("connection");
  socket.on("info", async url => {
    console.log("wsclient requested", url);
    if (cache[url]) {
      if (cache[url].length) {
        cache[url].forEach(video => socket.emit(url, video));
      }
    } else {
      cache[url] = [];
      for await (let video of iterateInfo(url)) {
        console.log(`video info fetched for ${url}`);
        cache[url].push(video);
        socket.emit(url, video);
      }
    }
  });
});

server.listen(port, () => {
  console.log("app is now listening on port", port);
});
