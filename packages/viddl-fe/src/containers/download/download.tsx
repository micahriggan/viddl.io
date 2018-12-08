import "./download.css";

import * as React from "react";
import * as requestPromise from "request-promise";
import * as IO from "socket.io-client";

import { RouteComponentProps } from "react-router";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Dropdown,
  Header,
  Icon,
  Image,
  Label,
  Progress
} from "semantic-ui-react";

const BackendURL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";

type IProps = RouteComponentProps<{ url: string; socket: string }>;

interface IVideo {
  id: string;
  fulltitle: string;
  title: string;
  url: string;
  thumbnail: string;
  description: string;
  _filename: string;
  format_id: string;
  formats: IFormat[];
  webpage_url: string;
}

interface IFormat {
  format_id: string;
  format_note: string;
  format: string;
  ext: string;
  url: string;
  acodec: string;
  vcodec: string;
}
interface IYTPlaylistItem {
  id: string;
  name: string;
  url: string;
}

interface IState {
  videos: IVideo[];
  selectedFormat: string;
  downloading: { [url: string]: number };
  paused: boolean;
  queue: IVideo[];
}

export class DownloadContainer extends React.Component<IProps, IState> {
  public state: IState = {
    downloading: {},
    paused: false,
    queue: [],
    selectedFormat: "",
    videos: []
  };

  public io: typeof IO.Socket;
  public intervalId: number;

  constructor(props: IProps) {
    super(props);
    this.handleFileDownload = this.handleFileDownload.bind(this);
    this.videoRow = this.videoRow.bind(this);
    this.handleFormatChange = this.handleFormatChange.bind(this);
    this.handleDownloadAll = this.handleDownloadAll.bind(this);
    this.handleFileDownloadQueue = this.handleFileDownloadQueue.bind(this);
    this.getVideoDownloadUrl = this.getVideoDownloadUrl.bind(this);
    this.handleTogglePause = this.handleTogglePause.bind(this);
  }

  public async getPlaylistItems(url: string) {
    const encodedUrl = encodeURIComponent(url);
    const resp = await requestPromise.get(
      `${BackendURL}/playlist/${encodedUrl}`,
      {
        json: true
      }
    );
    return resp as Promise<IYTPlaylistItem[]>;
  }

  public async getVideoInfo(url: string) {
    const encodedUrl = encodeURIComponent(url);
    const resp = await requestPromise.get(`${BackendURL}/info/${encodedUrl}`, {
      json: true
    });
    return resp as Promise<IVideo[]>;
  }

  public async componentDidMount() {
    const url = decodeURIComponent(this.props.match.params.url);

    this.io = IO(BackendURL, {
      reconnection: true,
      transports: ["websocket"]
    });

    this.handleFileDownloadEvents();
    this.fetchVideoInformation(url);
    this.handleFileDownloadQueue();
  }

  public handleFileDownloadQueue() {
    this.intervalId = window.setInterval(async () => {
      if (!this.state.paused) {
        const downloadingCount = Object.values(this.state.downloading).filter(
          value => {
            return value > 0 && value < 100;
          }
        ).length;
        if (downloadingCount < 1 && this.state.queue.length > 0) {
          const dlVideo = this.state.queue[0];
          const dlUrl = this.getVideoDownloadUrl(
            dlVideo,
            this.state.selectedFormat
          );
          const newQueue = this.state.queue.slice(1);
          await this.updateFileDownloadProgress(dlVideo, 1);
          await this.setState({
            queue: newQueue
          });
          window.open(dlUrl, "_blank");
          window.focus();
        }
      }
    }, 5000);
  }

  public async updateFileDownloadProgress(
    video: IVideo | string,
    progress: number
  ) {
    const url = typeof video === "string" ? video : video.webpage_url;
    await this.setState({
      downloading: { ...this.state.downloading, [url]: progress }
    });
  }

  public async fetchVideoInformation(url: string) {
    try {
      const videoInfo = await this.getVideoInfo(url);
      this.setState({ videos: videoInfo });
    } catch (e) {
      this.io.emit("info", url);
      this.io.on(url, (info: IVideo) => {
        this.setState({ videos: this.state.videos.concat([info]) });
      });
    }
  }

  public handleFileDownloadEvents() {
    this.io.on("connect", () => {
      window.console.log("Connected to websocket");
      if (!this.props.match.params.socket) {
        this.props.history.push(
          "/dl/" + this.props.match.params.url + "/" + this.io.id
        );
      } else {
        (this.io.io as any).engine.id = this.props.match.params.socket;
      }
      this.io.on("download:start", (videoUrl: string, size: number) => {
        window.console.log("download started", videoUrl);
        this.updateFileDownloadProgress(videoUrl, 1);
      });

      this.io.on("download:complete", (videoUrl: string) => {
        window.console.log("download finished", videoUrl);
        const videoIndex = this.state.queue.findIndex(
          v => v.webpage_url === videoUrl
        );
        if (videoIndex > -1) {
          // this shouldn't happen, since we download by popping from the queue
          const newQueue = this.state.queue.slice();
          newQueue.splice(videoIndex, 1);
          this.setState({ queue: newQueue });
        }
        this.updateFileDownloadProgress(videoUrl, 100);
      });

      this.io.on("download:percent", (videoUrl: string, percent: number) => {
        this.updateFileDownloadProgress(videoUrl, Math.floor(percent));
      });

      this.io.on("download:error", (videoUrl: string) => {
        window.console.error("Error downloading", videoUrl);
        this.updateFileDownloadProgress(videoUrl, 0);
      });
    });
  }

  public handleFormatChange(
    event: React.FormEvent<HTMLSelectElement>,
    { value }: { value: string }
  ) {
    this.setState({ selectedFormat: value });
  }

  public async handleDownloadAll() {
    for (const video of this.state.videos) {
      await this.handleFileDownload(video)();
    }
  }

  public async handleTogglePause() {
    this.setState({ paused: !this.state.paused });
  }

  public downloadManySettings() {
    const options = this.state.videos[0].formats.map(f => ({
      key: f.format_id,
      text: `${f.ext} - ${f.format}`,
      value: f.format
    }));

    const downloadProgress = Math.floor(
      ((this.state.videos.length - this.state.queue.length) /
        this.state.videos.length) *
        100
    );

    const paused = this.state.paused;
    return (
      <div className="settings-container">
        <Dropdown
          icon="caret down"
          placeholder="Select a format"
          search={true}
          selection={true}
          options={options}
          onChange={this.handleFormatChange}
        />
        <Button as="div" labelPosition="right" onClick={this.handleDownloadAll}>
          <Button color="blue">
            <Icon name="download" />
            Save All
          </Button>
          <Label basic={true} as="a" color="blue" pointing="left">
            {this.state.videos.length}
          </Label>
        </Button>
        {this.state.queue.length > 0 ? (
          <Button
            color={!paused ? "red" : "blue"}
            onClick={this.handleTogglePause}
          >
            <Icon name={!paused ? "pause" : "play"} />
            {!paused ? "Pause" : "Resume"}
          </Button>
        ) : null}
        {downloadProgress > 0 && this.state.queue.length > 0 ? (
          <Progress
            percent={downloadProgress}
            size="large"
            indicating={true}
            progress={true}
          />
        ) : null}
      </div>
    );
  }

  public getVideoDownloadUrl(video: IVideo, format: string) {
    const videoFormat = video.formats.find(f => f.format === format);
    if (videoFormat) {
      const id = videoFormat.format_id;
      const videoUrl = encodeURIComponent(video.webpage_url);
      const dlUrl = `${BackendURL}/download/${id}/${videoUrl}/${this.io.id}`;
      return dlUrl;
    } else {
      throw new Error("Video format can not be found for this video");
    }
  }

  public handleFileDownload(video: IVideo) {
    return async () => {
      window.console.log("Video selected", video);
      if (this.state.downloading[video.webpage_url]) {
        // may need to retry download
        await this.updateFileDownloadProgress(video, 0);
      }
      await this.setState({
        queue: this.state.queue.concat([video])
      });
    };
  }

  public videoRow(video: IVideo) {
    const currentPercent = this.state.downloading[video.webpage_url];
    const inQueue = this.state.queue.includes(video);
    return (
      <div key={video._filename}>
        <div className="container">
          <Image src={video.thumbnail} />
          <div className="progress">
            {currentPercent ? (
              <Progress
                percent={currentPercent}
                size="large"
                indicating={true}
                progress={true}
              />
            ) : null}
          </div>

          <div className="icon-overlay icon-container">
            {inQueue ? (
              <Icon
                name="wait"
                size="massive"
                onClick={this.handleFileDownload(video)}
              />
            ) : null}
          </div>

          <div className="overlay icon-container">
            <Icon
              name="download"
              size="massive"
              onClick={this.handleFileDownload(video)}
            />
          </div>
          <Header as="h3">{video.fulltitle}</Header>
        </div>
      </div>
    );
  }

  public render() {
    return (
      <div className="download-container">
        <Card style={{ width: "100%" }}>
          <Card.Content>
            <Card.Header>
              <Link to="/">viddl.io</Link>
            </Card.Header>
            <Card.Meta>download videos</Card.Meta>
            <Card.Description>
              {this.state.videos.length > 0
                ? this.downloadManySettings()
                : null}
              {this.state.videos.map(this.videoRow)}
            </Card.Description>
          </Card.Content>
          <Card.Content extra={true} />
        </Card>
      </div>
    );
  }
}
