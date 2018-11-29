import * as React from "react";
import { RouteComponentProps } from "react-router";
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

interface IState {
  videos: IVideo[];
}

export class DownloadContainer extends React.Component<IProps, IState> {
  public componentDidMount() {
    const url = decodeURIComponent(this.props.match.params.url);
    window.console.log(url);
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
