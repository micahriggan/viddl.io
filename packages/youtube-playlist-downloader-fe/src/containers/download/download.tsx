import * as React from "react";
import { RouteComponentProps } from "react-router";
import * as request from "request-promise";
import { Card, Input } from "semantic-ui-react";

type IProps = RouteComponentProps<{ url: string }>;

interface IVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  description: string;
  _filename: string;
  format_id: string;
}

interface IYTPlaylistItem {
  id: string;
  name: string;
  url: string;
}

interface IState {
  videos: IVideo[];
}

export class DownloadContainer extends React.Component<IProps, IState> {
  public async getPlaylistItems(url: string) {
    const encodedUrl = encodeURIComponent(url);
    const resp = await request.get(
      `http://localhost:8080/playlist/${encodedUrl}`,
      { json: true }
    );
    return resp as Promise<IYTPlaylistItem[]>;
  }

  public async getVideoInfo(url: string) {
    const encodedUrl = encodeURIComponent(url);
    const resp = await request.get(
      `http://localhost:8080/info/${encodedUrl}`,
      { json: true }
    );
    return resp as Promise<IVideo[]>;
  }

  public async componentDidMount() {
    const url = decodeURIComponent(this.props.match.params.url);
    const videoInfo = await this.getVideoInfo(url);
    window.console.log(videoInfo);
  }

  public render() {
    return (
      <Card>
        <Card.Content>
          <Card.Header>viddl.io</Card.Header>
          <Card.Meta>download videos</Card.Meta>
          <Card.Description>
            <Input action={{ icon: "search" }} placeholder="Search..." />
          </Card.Description>
        </Card.Content>
        <Card.Content extra={true} />
      </Card>
    );
  }
}
