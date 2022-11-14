import React from "react";

import * as dmv from "dicom-microscopy-viewer";
import { withRouter } from "react-router-dom";
import { StorageClasses } from "./dicomService";

class Worklist extends React.Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.state = {
      studies: [],
    };
  }

  searchForStudies() {
    const queryParams = { ModalitiesInStudy: "SM" };
    const searchOptions = { queryParams };
    const client =
      this.props.clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE];
    client
      .searchForStudies(searchOptions)
      .then((studies) => {
        this.setState({
          studies: studies.map((study) => {
            const { dataset } = dmv.metadata.formatMetadata(study);
            return dataset;
          }),
        });
      })
      .catch((error) => {
        //   message.error('An error occured. Search for studies failed.');
        console.error(error, "error");
      });
  }

  componentDidMount() {
    this.searchForStudies();
  }

  handleClick(study) {
    this.props.history.push(`/study/${study.StudyInstanceUID}`);
  }

  render() {
    return this.state.studies.map((item, key) =>
      key === 0 ? (
        <div
          onClick={() => this.handleClick(item)}
          style={{
            backgroundColor: "#eee",
            padding: "5px 15px",
            marginBottom: 10,
            marginTop: 10,
            cursor: "pointer",
          }}
          key={key}
        >
          {item.AccessionNumber} / {item.StudyID} / {item.PatientID} /{" "}
          {item.ModalitiesInStudy} / &gt;&gt;&gt; Click to view in detail page
          viewer
        </div>
      ) : null
    );
  }
}

export default withRouter(Worklist);
