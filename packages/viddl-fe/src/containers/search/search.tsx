import "./search.css";

import * as React from "react";
import { RouteComponentProps } from "react-router";
import { Link } from "react-router-dom";
import { Button, Card, Icon, Input } from "semantic-ui-react";

type IProps = RouteComponentProps<any>;
interface IState {
  url: string;
}
export class SearchContainer extends React.Component<IProps, IState> {
  public state = {
    url: ""
  };

  constructor(props: IProps) {
    super(props);
    this.handleUrlUpdate = this.handleUrlUpdate.bind(this);
    this.navToDownload = this.navToDownload.bind(this);
  }

  public navToDownload() {
    const url = this.state.url;
    this.props.history.push(`/dl/${encodeURIComponent(url)}`);
  }

  public handleUrlUpdate(event: React.FormEvent<HTMLInputElement>) {
    this.setState({ url: event.currentTarget.value });
  }

  public render() {
    return (
      <div className="search-container">
        <Card>
          <Card.Content>
            <Card.Header>
              <Link to="/">viddl.io</Link>
            </Card.Header>
            <Card.Meta>download videos</Card.Meta>
            <Card.Description>
              <Input
                onChange={this.handleUrlUpdate}
                action={
                  <Button onClick={this.navToDownload}>
                    <Icon name="search" />
                  </Button>
                }
                fluid={true}
                placeholder="Url with video or playlist..."
              />
            </Card.Description>
          </Card.Content>
          <Card.Content extra={true} />
        </Card>
      </div>
    );
  }
}
