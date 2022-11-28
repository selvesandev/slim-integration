import { Route, Switch, useParams, withRouter } from "react-router-dom";
import CaseViewer from "./CaseViewer";
import { StorageClasses } from "./dicomService";
import DicomWebManager from "./DicomWebManager";
import WorkList from "./WorkList";

// eslint-disable-next-line no-underscore-dangle
function _createClientMapping({ baseUri, settings, onError }) {
  const storageClassMapping = { default: 0 };
  settings.forEach((serverSettings) => {
    if (serverSettings.storageClasses != null) {
      serverSettings.storageClasses.forEach((sopClassUID) => {
        if (Object.values(StorageClasses).includes(sopClassUID)) {
          if (sopClassUID in storageClassMapping) {
            storageClassMapping[sopClassUID] += 1;
          } else {
            storageClassMapping[sopClassUID] = 1;
          }
        } else {
          // console.warn(
          //   `unknown storage class "${sopClassUID}" specified `
          //   + `for configured server "${serverSettings.id}"`,
          // );
        }
      });
    } else {
      storageClassMapping.default += 1;
    }
  });

  if (storageClassMapping.default > 1) {
    throw new Error(
      "Only one default server can be configured without specification " +
        "of storage classes."
    );
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const key in storageClassMapping) {
    if (key === "default") {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (storageClassMapping[key] > 1) {
      throw new Error(
        "Only one configured server can specify a given storage class. " +
          `Storage class "${key}" is specified by more than one ` +
          "of the configured servers."
      );
    }
  }
  const clientMapping = {};

  if (Object.keys(storageClassMapping).length > 1) {
    settings.forEach((server) => {
      const client = new DicomWebManager({
        baseUri,
        settings: [server],
        onError,
      });
      if (server.storageClasses != null) {
        server.storageClasses.forEach((sopClassUID) => {
          clientMapping[sopClassUID] = client;
        });
      }
    });
    clientMapping.default =
      clientMapping[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE];
  } else {
    const client = new DicomWebManager({ baseUri, settings, onError });
    clientMapping.default = client;
  }
  Object.values(StorageClasses).forEach((sopClassUID) => {
    if (!(sopClassUID in clientMapping)) {
      clientMapping[sopClassUID] = clientMapping.default;
    }
  });
  return clientMapping;
}

const { protocol, host } = window.location;
const baseUri = `${protocol}//${host}`;
const clients = _createClientMapping({
  baseUri,
  settings: window.config.servers,
});

const ParametrizedCaseViewer = ({
  clients,
  // user,
  // app,
  // config,
}) => {
  const { studyInstanceUID } = useParams();
  // const enableAnnotationTools = !(config.disableAnnotationTools ?? false)
  // const preload = config.preload ?? false
  return (
    <CaseViewer clients={clients} preload studyInstanceUID={studyInstanceUID} />
  );
};

function App({ match }) {
  return (
    <Switch>
      <Route
        exact
        path={`${match.url}`}
        render={(props) => <WorkList clients={clients} {...props} />}
      />
      <Route
        path={`${match.url}study/:studyInstanceUID/`}
        render={() => (
          <section className="ant-layout" style={{ height: "100vh" }}>
            <div className="ant-layout-content" style={{ height: "100%" }}>
              <div
                style={{
                  height: "calc(100% - 0px)",
                  overflow: "hidden",
                  cursor: "default",
                }}
              >
                <ParametrizedCaseViewer clients={clients} />
              </div>
            </div>
          </section>
        )}
      />
    </Switch>
  );
}

export default withRouter(App);
