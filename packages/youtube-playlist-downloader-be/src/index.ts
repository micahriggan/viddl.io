import express from "express";
import * as youtubedl from "youtube-dl";
import cors from "cors";
import IO = require("socket.io");
import * as HTTP from "http";
import "./polyfill";

const app = express();
app.use(cors());

const cache: { [url: string]: Array<any> } = {};
const queue = [];

function fetchInfo(url, options = []) {
  return new Promise((resolve, reject) => {
    console.log(`Fetching video data for ${url}`);
    youtubedl.getInfo(url, options, (err, data) => {
      if (err) return reject(err);
      else return resolve(data);
    });
  });
}

async function* iterateInfo(url, startIndex = 1, batchSize = 3) {
  let failureCount = 0;
  let lastBatch = [];
  do {
    try {
      const batch = `${startIndex}-${startIndex + batchSize}`;
      console.log("Fetching ", url, "video", batch);
      lastBatch = (await fetchInfo(url, [
        `--playlist-items=${batch}`
      ])) as Array<any>;
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
  } while (startIndex < batchSize || (lastBatch.length >= 0 && failureCount < 3));
}

app.use("/info/:url", async (req, res) => {
  const url = decodeURIComponent(req.params.url);
  if (cache[url]) {
    res.json(cache[url]);
  } else {
    res.status(307).json({ status: `use websockets to fetch data for ${url}` });
  }
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
    console.log('wsclient requested', url);
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
