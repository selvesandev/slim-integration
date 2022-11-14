import React from 'react';
import {
  Switch,
  Route,
  useLocation,
  useParams,
  withRouter,
} from 'react-router-dom';

import * as dmv from 'dicom-microscopy-viewer';

import SlideViewer from './SlideViewer';
import { createSlides, StorageClasses } from './dicomService';


const ParametrizedSlideViewer = ({
  clients,
  slides,
}) => {
  const { studyInstanceUID, seriesInstanceUID } = useParams();
  const location = useLocation();

  const selectedSlide = slides.find((slide) => slide.seriesInstanceUIDs.find((uid) => uid === seriesInstanceUID));
  const searchParams = new URLSearchParams(location.search);
  let presentationStateUID;
  if (!searchParams.has('access_token')) {
    presentationStateUID = searchParams.get('state');
    if (presentationStateUID === null) {
      presentationStateUID = undefined;
    }
  }
  let viewer = null;
  console.log('case viewer', selectedSlide);
  if (selectedSlide != null) {
    viewer = (
      <SlideViewer
        clients={clients}
        studyInstanceUID={studyInstanceUID}
        seriesInstanceUID={seriesInstanceUID}
        selectedPresentationStateUID={presentationStateUID}
        slide={selectedSlide}
        preload
      />
    );
  }
  return viewer;
};

class Viewer extends React.Component {
  state = {
    slides: [],
    isLoading: true,
  }

  constructor(props) {
    super(props);
    this.handleSeriesSelection = this.handleSeriesSelection.bind(this);
  }

  componentDidMount() {
    this.fetchImageMetadata().then(
      (metadata) => {
        console.log(metadata, 'fetchImageMetadata');
        const slides = createSlides(metadata);
        console.log('createSlides', slides);

        console.log(slides, 'slides printed');

        const firstSlide = slides[0];
        const volumeInstances = firstSlide.volumeImages;
        console.log(volumeInstances, 'volumeInstances length');
        if (volumeInstances.length === 0) {
          return null;
        }
        let selectedSeriesInstanceUID;
        if (this.props.history.location.pathname.includes('series/')) {
          const fragments = this.props.history.location.pathname.split('/');
          selectedSeriesInstanceUID = fragments[4];
        } else {
          selectedSeriesInstanceUID = volumeInstances[0].SeriesInstanceUID;
        }
        this.handleSeriesSelection({ seriesInstanceUID: selectedSeriesInstanceUID, slides });
      },
    ).catch((error) => {
      console.error(error, 'error');
      this.setState({ isLoading: false });
    });
  }

  /**
   * Fetch metadata for VL Whole Slide Microscopy Image instances of the study.
   *
   * @returns Metadata of image instances of the study grouped per series
   */
  async fetchImageMetadata() {
    const images = [];
    const { studyInstanceUID } = this.props;
    console.info(`search for series of study "${studyInstanceUID}"...`);

    const client = this.props.clients[
      StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE
    ];
    const matchedSeries = await client.searchForSeries({
      queryParams: {
        Modality: 'SM',
        StudyInstanceUID: studyInstanceUID,
      },
    });

    await Promise.all(matchedSeries.map(async (s) => {
      const { dataset } = dmv.metadata.formatMetadata(s);
      const loadingSeries = dataset;
      console.info(
        `retrieve metadata of series "${loadingSeries.SeriesInstanceUID}"`,
      );
      const retrievedMetadata = await client.retrieveSeriesMetadata({
        studyInstanceUID: this.props.studyInstanceUID,
        seriesInstanceUID: loadingSeries.SeriesInstanceUID,
      });

      const seriesImages = [];
      retrievedMetadata.forEach((item) => {
        if (item['00080016'] != null) {
          const values = item['00080016'].Value;
          if (values != null) {
            const sopClassUID = values[0];
            if (sopClassUID === StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE) {
              const image = new dmv.metadata.VLWholeSlideMicroscopyImage({
                metadata: item,
              });
              seriesImages.push(image);
            }
          }
        }
      });
      if (seriesImages.length > 0) {
        images.push(seriesImages);
      }
    }));

    return images;
  }

  handleSeriesSelection(
    { seriesInstanceUID, slides },
  ) {
    console.log(`switch to series "${seriesInstanceUID}"`);
    let urlPath = (
      `/study/${this.props.studyInstanceUID}`
      + `/series/${seriesInstanceUID}`
    );
    if (
      this.props.location.pathname.includes('/series/')
      && this.props.location.search != null
    ) {
      urlPath += this.props.location.search;
    }
    this.setState({
      slides,
      isLoading: false,
    });
    this.props.history.push(urlPath, { replace: true });
  }

  render() {
    
    return (
      <div style={{ height: '100%' }}>
        <Switch>
          <Route
            exact
            path="/study/:studyInstanceUID/series/:seriesInstanceUID"
            render={
                () => (
                  <ParametrizedSlideViewer
                    clients={this.props.clients}
                    slides={this.state.slides}
                  />
                )
            }
          />
        </Switch>
      </div>
    );
  }
}

export default withRouter(Viewer);
