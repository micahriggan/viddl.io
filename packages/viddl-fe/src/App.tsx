import * as React from "react";
import "semantic-ui-css/semantic.min.css";
import "./App.css";

import { createBrowserHistory } from "history";
import { Route, Router, Switch } from "react-router";
import { DownloadContainer } from "./containers/download/download";
import { SearchContainer } from "./containers/search/search";

const customHistory = createBrowserHistory();

class App extends React.Component {
  public render() {
    return (
      <Router history={customHistory}>
        <Switch>
          <Route exact={true} path="/" component={SearchContainer} />
          <Route
            exact={true}
            path="/dl/:url*"
            component={DownloadContainer}
          />
        </Switch>
      </Router>
    );
  }
}

export default App;
