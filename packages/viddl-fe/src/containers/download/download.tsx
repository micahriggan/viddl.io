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
  Progress
} from "semantic-ui-react";

const BackendURL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";

type IProps = RouteComponentProps<{ url: string }>;

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
}

export class DownloadContainer extends React.Component<IProps, IState> {
  public state: IState = {
    downloading: { "https://www.youtube.com/watch?v=mrRfpiAwad0": 1 },
    selectedFormat: "",
    videos: []
  };

  public io: typeof IO.Socket;

  constructor(props: IProps) {
    super(props);
    this.handleFileDownload = this.handleFileDownload.bind(this);
    this.videoRow = this.videoRow.bind(this);
    this.handleFormatChange = this.handleFormatChange.bind(this);
    this.handleDownloadAll = this.handleDownloadAll.bind(this);
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
    this.io.on("connect", () => {
      window.console.log("Connected to websocket");
      const downloadsInterval = {};
      this.io.on("download:start", (videoUrl: string, size: number) => {
        window.console.log("download started", videoUrl);
        downloadsInterval[videoUrl] = setInterval(() => {
          const currentPercent = this.state.downloading[videoUrl] || 0;
          const newPercent =
            currentPercent < 90 ? currentPercent + 1 : currentPercent;
          this.setState({
            downloading: {
              [videoUrl]: newPercent
            }
          });
        }, 1000);
      });
      this.io.on("download:complete", (videoUrl: string) => {
        clearInterval(downloadsInterval[videoUrl]);
        window.console.log("download finished", videoUrl);
        this.setState({
          downloading: {
            [videoUrl]: 100
          }
        });
      });
    });

    try {
      const videoInfo = await this.getVideoInfo(url);
      this.setState({ videos: videoInfo });
      window.console.log(this.state.videos);
    } catch (e) {
      this.io.emit("info", url);
      this.io.on(url, (info: IVideo) => {
        this.setState({ videos: this.state.videos.concat([info]) });
      });
    }
  }

  public handleFormatChange(
    event: React.FormEvent<HTMLSelectElement>,
    { value }: { value: string }
  ) {
    window.console.log(value);
    this.setState({ selectedFormat: value });
  }

  public handleDownloadAll() {
    for (const video of this.state.videos) {
      this.handleFileDownload(video)();
    }
  }

  public downloadManySettings() {
    const options = this.state.videos[0].formats.map(f => ({
      key: f.format_id,
      text: f.ext + " - " + f.format,
      value: f.format
    }));

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
        <Button
          basic={true}
          color="blue"
          content="Download All"
          icon="download"
          onClick={this.handleDownloadAll}
          label={{
            as: "a",
            basic: true,
            color: "blue",
            content: this.state.videos.length,
            pointing: "left"
          }}
        />
      </div>
    );
  }

  public handleFileDownload(video: IVideo) {
    return async () => {
      const videoFormat = video.formats.find(
        f => f.format === this.state.selectedFormat
      );
      if (videoFormat) {
        window.console.log("Video selected", video);
        const id = videoFormat.format_id;
        const videoUrl = encodeURIComponent(video.webpage_url);
        const dlUrl = `${BackendURL}/download/${id}/${videoUrl}/${
          this.io.id
        }`;
        window.console.log(dlUrl);
        const filename = video.fulltitle + "." + videoFormat.ext;
        window.console.log("Downloading", dlUrl, filename);
        window.open(dlUrl, "_blank");
      }
    };
  }

  public videoRow(video: IVideo) {
    const currentPercent = this.state.downloading[video.webpage_url];
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
              />
            ) : null}
          </div>

          <div className="overlay">
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
