import express from "express";
import * as youtubedl from "ytdl-core";
import cors from "cors";
import IO = require("socket.io");
import * as HTTP from "http";

const app = express();
app.use(cors());

const cache = {};
const queue = [];

app.use("/info/:url", async (req, res) => {
  const url = decodeURIComponent(req.params.url);
  if (cache[url]) {
    res.json(cache[url]);
  } else {
    cache[url] = youtubedl.getInfo(url);
    res.status(307).json({ status: `fetching data for ${url}` });
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
    if (!cache[url]) {
      cache[url] = youtubedl.getInfo(url);
    }
    socket.emit(url, await cache[url]);
  });
});

server.listen(port, () => {
  console.log("app is now listening on port", port);
});
