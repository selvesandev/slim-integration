import React from 'react';

import * as dmv from 'dicom-microscopy-viewer';
import { withRouter } from 'react-router-dom';
import { StorageClasses } from './dicomService';
const _constructViewers = ({ clients, slide, preload }) => {
  console.info(
    'instantiate viewer for VOLUME images of slide '
    + `"${slide.volumeImages[0].ContainerIdentifier}" HERE`,
  );
  try {
    console.log(window.config, 'window.config');
    console.log(clients, 'clients....');
    console.log(slide.volumeImages, 'slide.volumeImages');
    const volumeViewer = new dmv.viewer.VolumeImageViewer({
      clientMapping: clients,
      metadata: slide.volumeImages,
      controls: ['overview', 'position'],
      preload,
    });
    volumeViewer.activateSelectInteraction({});
    console.log(volumeViewer, "volumeViewerConsole");

    let labelViewer;
    console.log(slide.labelImages.length, 'slide.labelImages.length');
    if (slide.labelImages.length > 0) {
      console.info(
        'instantiate viewer for LABEL image of slide '
        + `"${slide.labelImages[0].ContainerIdentifier}" THERE`,
      );
      labelViewer = new dmv.viewer.LabelImageViewer({
        client: clients[StorageClasses.VL_WHOLE_SLIDE_MICROSCOPY_IMAGE],
        metadata: slide.labelImages[0],
        resizeFactor: 1,
        orientation: 'vertical',
      });
    }
    return { volumeViewer, labelViewer };
  } catch (error) {
    console.error('Failed to instantiate viewer');
    throw error;
  }
};

class SlideViewer extends React.Component {
selectionColor = [140, 184, 198]

constructor(props) {
  console.log('slideViewr __constructor');
  super(props);
  const { volumeViewer, labelViewer } = _constructViewers({
    clients: this.props.clients,
    slide: this.props.slide,
    preload: this.props.preload,
  });
  this.volumeViewer = volumeViewer;
  this.labelViewer = labelViewer;
  this.volumeViewportRef = React.createRef();
  this.labelViewportRef = React.createRef();
  console.log(this.volumeViewer, 'this.volumeViewer');
  console.log(this.labelViewer, 'this.labelViewer');
  console.log(this.volumeViewportRef, 'this.volumeViewportRef');
  console.log(this.labelViewportRef, 'this.labelViewportRef');

  this.volumeViewer.getAllOpticalPaths().forEach((opticalPath) => {
    console.log('opticalPath', opticalPath);
    this.volumeViewer.deactivateOpticalPath(opticalPath.identifier);
    console.log('deactivateOpticalPath');
  });

  const [offset, size] = this.volumeViewer.boundingBox

  this.state = {
    presentationStates: [],
    isLoading: false,
    visibleRoiUIDs: new Set(),
    visibleSegmentUIDs: new Set(),
    visibleMappingUIDs: new Set(),
    visibleAnnotationGroupUIDs: new Set(),
    visibleOpticalPathIdentifiers: new Set(),
    activeOpticalPathIdentifiers: new Set(),
    loadingFrames: new Set(),
    validXCoordinateRange: [offset[0], offset[0] + size[0]],
    validYCoordinateRange: [offset[1], offset[1] + size[1]],
  };

}

  loadPresentationStates = () => {
    console.log('search for Presentation State instances', this.props.studyInstanceUID);
    const client = this.props.clients[
      StorageClasses.ADVANCED_BLENDING_PRESENTATION_STATE
    ];
    client.searchForInstances({
      studyInstanceUID: this.props.studyInstanceUID,
      queryParams: {
        Modality: 'PR',
      },
    }).then((matchedInstances) => {
      if (matchedInstances == null) {
        matchedInstances = [];
      }
      matchedInstances.forEach((rawInstance, index) => {
        const { dataset } = dmv.metadata.formatMetadata(rawInstance);
        const instance = dataset;
        console.info(`retrieve PR instance "${instance.SOPInstanceUID}"`);
        client.retrieveInstance({
          studyInstanceUID: this.props.studyInstanceUID,
          seriesInstanceUID: instance.SeriesInstanceUID,
          sopInstanceUID: instance.SOPInstanceUID,
        }).then((retrievedInstance) => {
          const data = window.dcmjs.data.DicomMessage.readFile(retrievedInstance);
          console.log('dcomMessage', data);
          const { dataset } = dmv.metadata.formatMetadata(data.dict);
          if (this.props.slide.areVolumeImagesMonochrome) {
            const presentationState = (
              dataset
            );
            let doesMatch = false;
            presentationState.AdvancedBlendingSequence.forEach((blendingItem) => {
              doesMatch = this.props.slide.seriesInstanceUIDs.includes(
                blendingItem.SeriesInstanceUID,
              );
            });
            if (doesMatch) {
              console.info(
                'include Advanced Blending Presentation State instance '
                + `"${presentationState.SOPInstanceUID}"`, presentationState, this.props.selectedPresentationStateUID, index,
              );
              if (
                index === 0
                && this.props.selectedPresentationStateUID == null
              ) {
                console.log('setting presentation state if');
                this.setPresentationState(presentationState);
              } else if (
                presentationState.SOPInstanceUID
                    === this.props.selectedPresentationStateUID
              ) {
                console.log('setting presentation state else if');
                this.setPresentationState(presentationState);
              }
            }
          } else {
            console.log(
              `ignore presentation state "${instance.SOPInstanceUID}", `
              + 'application of presentation states for color images '
              + 'has not (yet) been implemented',
            );
          }
        }).catch((error) => {
          console.log(
            'failed to load presentation state '
            + `of SOP instance "${instance.SOPInstanceUID}" `
            + `of series "${instance.SeriesInstanceUID}" `
            + `of study "${this.props.studyInstanceUID}": `,
            error,
          );
        });
      });
    }).catch((error) => {
      console.error('Presentation State could not be loaded');
      console.error(error);
    });
  }

  setPresentationState = (
    presentationState,
  ) => {
    const opticalPaths = this.volumeViewer.getAllOpticalPaths();
    console.log(opticalPaths, 'opticalPaths...');
    console.info(
      `apply Presentation State instance "${presentationState.SOPInstanceUID}"`,
    );
    const opticalPathStyles = {};
    opticalPaths.forEach((opticalPath) => {
      // First, deactivate and hide all optical paths and reset style
      const { identifier } = opticalPath;
      this.volumeViewer.hideOpticalPath(identifier);
      this.volumeViewer.deactivateOpticalPath(identifier);
      const style = this.volumeViewer.getOpticalPathDefaultStyle(identifier);
      this.volumeViewer.setOpticalPathStyle(identifier, style);

      presentationState.AdvancedBlendingSequence.forEach((blendingItem) => {
        let refInstanceItems = blendingItem.ReferencedInstanceSequence;
        if (refInstanceItems === undefined) {
          refInstanceItems = blendingItem.ReferencedImageSequence;
        }
        if (refInstanceItems === undefined) {
          console.log('refInstanceItems is undefined');
          return;
        }
        refInstanceItems.forEach((imageItem) => {
          const isReferenced = opticalPath.sopInstanceUIDs.includes(
            imageItem.ReferencedSOPInstanceUID,
          );
          if (isReferenced) {
            let paletteColorLUT;
            if (blendingItem.PaletteColorLookupTableSequence != null) {
              const cpLUTItem = blendingItem.PaletteColorLookupTableSequence[0];
              paletteColorLUT = new dmv.color.PaletteColorLookupTable({
                uid: (
                  cpLUTItem.PaletteColorLookupTableUID != null
                    ? cpLUTItem.PaletteColorLookupTableUID
                    : ''
                ),
                redDescriptor:
                  cpLUTItem.RedPaletteColorLookupTableDescriptor,
                greenDescriptor:
                  cpLUTItem.GreenPaletteColorLookupTableDescriptor,
                blueDescriptor:
                  cpLUTItem.BluePaletteColorLookupTableDescriptor,
                redData: (
                  (cpLUTItem.RedPaletteColorLookupTableData != null)
                    ? new Uint16Array(
                      cpLUTItem.RedPaletteColorLookupTableData,
                    )
                    : undefined
                ),
                greenData: (
                  (cpLUTItem.GreenPaletteColorLookupTableData != null)
                    ? new Uint16Array(
                      cpLUTItem.GreenPaletteColorLookupTableData,
                    )
                    : undefined
                ),
                blueData: (
                  (cpLUTItem.BluePaletteColorLookupTableData != null)
                    ? new Uint16Array(
                      cpLUTItem.BluePaletteColorLookupTableData,
                    )
                    : undefined
                ),
                redSegmentedData: (
                  (cpLUTItem.SegmentedRedPaletteColorLookupTableData != null)
                    ? new Uint16Array(
                      cpLUTItem.SegmentedRedPaletteColorLookupTableData,
                    )
                    : undefined
                ),
                greenSegmentedData: (
                  (cpLUTItem.SegmentedGreenPaletteColorLookupTableData != null)
                    ? new Uint16Array(
                      cpLUTItem.SegmentedGreenPaletteColorLookupTableData,
                    )
                    : undefined
                ),
                blueSegmentedData: (
                  (cpLUTItem.SegmentedBluePaletteColorLookupTableData != null)
                    ? new Uint16Array(
                      cpLUTItem.SegmentedBluePaletteColorLookupTableData,
                    )
                    : undefined
                ),
              });
            }

            let limitValues;
            if (blendingItem.SoftcopyVOILUTSequence != null) {
              const voiLUTItem = blendingItem.SoftcopyVOILUTSequence[0];
              const windowCenter = voiLUTItem.WindowCenter;
              const windowWidth = voiLUTItem.WindowWidth;
              limitValues = [
                windowCenter - windowWidth * 0.5,
                windowCenter + windowWidth * 0.5,
              ];
            }

            opticalPathStyles[identifier] = {
              opacity: 1,
              paletteColorLookupTable: paletteColorLUT,
              limitValues,
            };
          }
        });
      });
    });

    const selectedOpticalPathIdentifiers = new Set();
    Object.keys(opticalPathStyles).forEach((identifier) => {
      const styleOptions = opticalPathStyles[identifier];
      if (styleOptions != null) {
        this.volumeViewer.setOpticalPathStyle(identifier, styleOptions);
        this.volumeViewer.activateOpticalPath(identifier);
        this.volumeViewer.showOpticalPath(identifier);
        selectedOpticalPathIdentifiers.add(identifier);
      } else {
        this.volumeViewer.hideOpticalPath(identifier);
        this.volumeViewer.deactivateOpticalPath(identifier);
      }
    });
    const { history } = this.props;
    const searchParams = new URLSearchParams(history.location.search);
    searchParams.set('state', presentationState.SOPInstanceUID);

    history.push(
      {
        pathname: history.location.pathname,
        search: searchParams.toString(),
      },
      { replace: true },
    );
  }


  componentCleanup () {
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_roi_drawn',
    //   this.onRoiDrawn
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_roi_selected',
    //   this.onRoiSelected
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_roi_removed',
    //   this.onRoiRemoved
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_roi_modified',
    //   this.onRoiModified
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_loading_started',
    //   this.onLoadingStarted
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_loading_ended',
    //   this.onLoadingEnded
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_frame_loading_started',
    //   this.onFrameLoadingStarted
    // )
    // document.body.removeEventListener(
    //   'dicommicroscopyviewer_frame_loading_ended',
    //   this.onFrameLoadingEnded
    // )
    // document.body.removeEventListener(
    //   'keyup',
    //   this.onKeyUp
    // )
    // window.removeEventListener('resize', this.onWindowResize)

    // this.volumeViewer.cleanup()
    // if (this.labelViewer != null) {
    //   this.labelViewer.cleanup()
    // }
    /*
     * FIXME: React appears to not clean the content of referenced
     * HTMLDivElement objects when the page is reloaded. As a consequence,
     * optical paths and other display items cannot be toggled or updated after
     * a manual page reload. I have tried using ref callbacks and passing the
     * ref objects from the parent component via the props. Both didn't work
     * either.
     */
  }


  populateViewports = () => {

    console.info('populate viewports...');

    this.setState({
      isLoading: true,
      presentationStates: [],
    });

    console.log(this.volumeViewportRef.current, 'this.volumeViewportRef.current');

    if (this.volumeViewportRef.current != null) {
      this.volumeViewer.render({ container: this.volumeViewportRef.current });
    }
    if (
      this.labelViewportRef.current != null &&
      this.labelViewer != null
    ) {
      this.labelViewer.render({ container: this.labelViewportRef.current })
    }
    this.setState({ isLoading: false });
    this.loadPresentationStates();
  }


  componentDidUpdate (
    previousProps,
    previousState
  ) {
    console.log(previousState,previousProps,'previousProps,previousState');
    console.log(this.props.location.pathname);
    if (
      this.props.location.pathname !== previousProps.location.pathname ||
      this.props.studyInstanceUID !== previousProps.studyInstanceUID ||
      this.props.seriesInstanceUID !== previousProps.seriesInstanceUID ||
      this.props.slide !== previousProps.slide ||
      this.props.clients !== previousProps.clients
    ) {
      if (this.volumeViewportRef.current != null) {
        this.volumeViewportRef.current.innerHTML = ''
      }
      this.volumeViewer.cleanup()
      if (this.labelViewer != null) {
        if (this.labelViewportRef.current != null) {
          this.labelViewportRef.current.innerHTML = ''
        }
        this.labelViewer.cleanup()
      }
      const { volumeViewer, labelViewer } = _constructViewers({
        clients: this.props.clients,
        slide: this.props.slide,
        preload: this.props.preload
      })
      this.volumeViewer = volumeViewer
      this.labelViewer = labelViewer

      const activeOpticalPathIdentifiers = new Set()
      const visibleOpticalPathIdentifiers = new Set()
      console.log(this.volumeViewer.getAllOpticalPaths(),'getAllOpticalPaths()');
      this.volumeViewer.getAllOpticalPaths().forEach(opticalPath => {
        const identifier = opticalPath.identifier
        if (this.volumeViewer.isOpticalPathVisible(identifier)) {
          visibleOpticalPathIdentifiers.add(identifier)
        }
        if (this.volumeViewer.isOpticalPathActive(identifier)) {
          activeOpticalPathIdentifiers.add(identifier)
        }
      })

      const [offset, size] = this.volumeViewer.boundingBox
      console.log(this.volumeViewer.boundingBox,'this.volumeViewer.boundingBox');
      this.setState({
        visibleRoiUIDs: new Set(),
        visibleSegmentUIDs: new Set(),
        visibleMappingUIDs: new Set(),
        visibleAnnotationGroupUIDs: new Set(),
        visibleOpticalPathIdentifiers,
        activeOpticalPathIdentifiers,
        presentationStates: [],
        loadingFrames: new Set(),
        validXCoordinateRange: [offset[0], offset[0] + size[0]],
        validYCoordinateRange: [offset[1], offset[1] + size[1]]
      })
      this.populateViewports()
    }
  }

  componentDidMount() {
    console.log('slideViewr componentDidMount');
    this.populateViewports();

    if (!this.props.slide.areVolumeImagesMonochrome) {
      console.log('this.props.slide.areVolumeImagesMonochrome');
      let hasICCProfile = false
      const image = this.props.slide.volumeImages[0]
      const metadataItem = image.OpticalPathSequence[0]
      if (metadataItem.ICCProfile == null) {
        if ('OpticalPathSequence' in image.bulkdataReferences) {
          // @ts-expect-error
          const bulkdataItem = image.bulkdataReferences.OpticalPathSequence[0]
          if ('ICCProfile' in bulkdataItem) {
            hasICCProfile = true
          }
        }
      } else {
        hasICCProfile = true
      }
      if (!hasICCProfile) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        console.log('No ICC Profile was found for color images')
      }
    }
  
  }

  render() {
    const toolbarHeight = '0px';

    let cursor = 'default';
    if (this.state.isLoading) {
      cursor = 'progress';
    }

    console.log('render function slide viewer');
    return (
      // <section style={{ height: '100%' }}>
        <div style={{ height: '100%' }}>
          <div
            style={{
              height: `calc(100% - ${toolbarHeight})`,
              overflow: 'hidden',
              cursor,
            }}
            ref={this.volumeViewportRef}
          />
        </div>
      // </section>
    );
  }
}

export default withRouter(SlideViewer);
