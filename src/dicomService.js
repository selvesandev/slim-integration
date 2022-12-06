const ImageFlavors = {
  VOLUME: 'VOLUME',
  LABEL: 'LABEL',
  OVERVIEW: 'OVERVIEW',
  THUMBNAIL: 'THUMBNAIL',
};

/**
 * Check if instance belongs to the slide.
 *
 * Compares values of Frame of Reference UID and Container Identifier attributes.
 *
 * @param slide - Slide metadata object
 * @param image - Metadata of VOLUME, LABEL or OVERVIEW image instance
 */
// eslint-disable-next-line no-underscore-dangle
const _doesImageBelongToSlide = (slide, image) => {
  if (
    slide.frameOfReferenceUID === image.FrameOfReferenceUID
        && slide.containerIdentifier === image.ContainerIdentifier
        && slide.acquisitionUID === image.AcquisitionUID
  ) {
    return true;
  }
  return false;
};

const areSameAcquisition = (
  image,
  refImage,
) => {
  if (image.AcquisitionUID != null) {
    return image.AcquisitionUID === refImage.AcquisitionUID;
  }
  return false;
};

const hasImageFlavor = (
  image,
  imageFlavor,
) => image.ImageType[2] === imageFlavor;

class Slide {
    description

    acquisitionUID

    frameOfReferenceUID

    containerIdentifier

    seriesInstanceUIDs

    opticalPathIdentifiers

    pyramidUIDs = []

    areVolumeImagesMonochrome

    volumeImages

    labelImages

    overviewImages

    /**
     * @param options
     * @param options.images - Metadata of images associated with the slide
     * @param options.description - Description of the slide
     */
    constructor(
      options,
    ) {
      if (options.images.length === 0) {
        throw new Error('Value of option "images" have been non-zero length.');
      }

      const seriesInstanceUIDs = new Set([]);
      const acquisitionUIDs = new Set([]);
      const opticalPathIdentifiers = new Set([]);
      const containerIdentifiers = new Set([]);
      const frameOfReferenceUIDs = {
        VOLUME: new Set([]),
        LABEL: new Set([]),
        OVERVIEW: new Set([]),
      };
      const pyramidUIDs = {
        VOLUME: {},
      };
      const volumeImages = [];
      const labelImages = [];
      const overviewImages = [];
      options.images.forEach((image) => {
        containerIdentifiers.add(image.ContainerIdentifier);
        seriesInstanceUIDs.add(image.SeriesInstanceUID);
        options.images[0].OpticalPathSequence.forEach((item) => {
          opticalPathIdentifiers.add(item.OpticalPathIdentifier);
        });
        if (image.AcquisitionUID != null) {
          acquisitionUIDs.add(image.AcquisitionUID);
        }
        if (
          hasImageFlavor(image, ImageFlavors.VOLUME)
          || hasImageFlavor(image, ImageFlavors.THUMBNAIL)
        ) {
          frameOfReferenceUIDs.VOLUME.add(image.FrameOfReferenceUID);
          if (image.PyramidUID != null) {
            // eslint-disable-next-line no-restricted-syntax, guard-for-in
            for (const identifier in opticalPathIdentifiers) {
              pyramidUIDs.VOLUME[identifier].add(image.PyramidUID);
            }
          }
          volumeImages.push(image);
        } else if (hasImageFlavor(image, ImageFlavors.LABEL)) {
          frameOfReferenceUIDs.LABEL.add(image.FrameOfReferenceUID);
          labelImages.push(image);
        } else if (hasImageFlavor(image, ImageFlavors.OVERVIEW)) {
          frameOfReferenceUIDs.OVERVIEW.add(image.FrameOfReferenceUID);
          overviewImages.push(image);
        }
      });
      if (volumeImages.length === 0) {
        throw new Error('At least one VOLUME image must be provided for a slide.');
      } else {
        if (acquisitionUIDs.size > 1) {
          throw new Error(
            'All VOLUME images of a slide must have the same number of '
            + 'Samples per Pixel.',
          );
        }
        const samplesPerPixel = new Set([]);
        volumeImages.forEach((image) => {
          samplesPerPixel.add(image.SamplesPerPixel);
        });
        if (samplesPerPixel.size > 1) {
          throw new Error(
            'All VOLUME images of a slide must have the same number of '
            + 'Samples per Pixel.',
          );
        }
        const isNotResampled = volumeImages.filter((image) => image.ImageType[3] !== 'RESAMPLED');
        if (isNotResampled.length > opticalPathIdentifiers.size) {
          // eslint-disable-next-line no-console
          console.warn(
            'the set of VOLUME images of a slide must contain only a single '
            + 'image that has not been resampled per optical path',
          );
        }
      }
      this.volumeImages = volumeImages;
      this.labelImages = labelImages;
      this.overviewImages = overviewImages;

      this.seriesInstanceUIDs = [...seriesInstanceUIDs];
      this.opticalPathIdentifiers = [...opticalPathIdentifiers];

      if (containerIdentifiers.size !== 1) {
        throw new Error(
          'All images of a slide must have the same Container Identifier.',
        );
      }
      // eslint-disable-next-line prefer-destructuring
      this.containerIdentifier = [...containerIdentifiers][0];

      if (frameOfReferenceUIDs.VOLUME.size !== 1) {
        throw new Error(
          'All VOLUME images of a slide must have '
          + 'the same Frame of Reference UID.',
        );
      }
      // eslint-disable-next-line prefer-destructuring
      this.frameOfReferenceUID = [...frameOfReferenceUIDs.VOLUME][0];

      let requirePyramidUID = false;
      if (Object.keys(pyramidUIDs.VOLUME).length > 0) {
        requirePyramidUID = true;
      }
      this.opticalPathIdentifiers.forEach((identifier) => {
        if (pyramidUIDs.VOLUME[identifier] != null) {
          if (pyramidUIDs.VOLUME[identifier].size > 1) {
            throw new Error(
              `All VOLUME images for optical path "${identifier}"`
              + 'must be part of the same multi-resolution pyramid.',
            );
          } else if (pyramidUIDs.VOLUME[identifier].size === 1) {
            this.pyramidUIDs.push([...pyramidUIDs.VOLUME[identifier]][0]);
          } else {
            throw new Error(
              `The VOLUME images for optical path "${identifier}" `
              + 'lack the Pyramid UID, while the images for other optical paths '
              + 'contain it.',
            );
          }
        } else if (requirePyramidUID) {
          throw new Error(
            `The VOLUME images for optical path "${identifier}" `
              + 'lack the Pyramid UID, while the images for other optical paths '
              + 'contain it.',
          );
        }
      });

      if (acquisitionUIDs.size > 1) {
        throw new Error(
          'All VOLUME images of a slide must be part of the same  '
          + 'acquisition and have the same Acquisition UID.',
        );
      } else if (acquisitionUIDs.size === 1) {
        // eslint-disable-next-line prefer-destructuring
        this.acquisitionUID = [...acquisitionUIDs][0];
      } else {
        this.acquisitionUID = null;
      }

      this.areVolumeImagesMonochrome = (
        this.volumeImages[0].SamplesPerPixel === 1
        && this.volumeImages[0].PhotometricInterpretation === 'MONOCHROME2'
      );

      this.description = (
        options.description !== undefined ? options.description : ''
      );
    }
}

export const createSlides = (
  images,
) => {
  const slideMetadata = [];
  images.forEach((series) => {
    if (series.length > 0) {
      const volumeImages = series.filter((image) => (
        hasImageFlavor(image, ImageFlavors.VOLUME)
            || hasImageFlavor(image, ImageFlavors.THUMBNAIL)
      ));
      if (volumeImages.length > 0) {
        const refImage = volumeImages[0];
        const filteredVolumeImages = volumeImages.filter((image) => refImage.SamplesPerPixel === image.SamplesPerPixel);
        const slideMetadataIndex = slideMetadata.findIndex((slide) => _doesImageBelongToSlide(slide, refImage));

        const labelImages = series.filter((image) => hasImageFlavor(image, ImageFlavors.LABEL));
        let filteredLabelImages = [];
        if (labelImages.length > 1) {
          filteredLabelImages = labelImages.filter((image) => areSameAcquisition(image, refImage));
        } else {
          filteredLabelImages = labelImages;
        }
        const overviewImages = series.filter((image) => hasImageFlavor(image, ImageFlavors.OVERVIEW));
        let filteredOverviewImages = [];
        if (overviewImages.length > 1) {
          filteredOverviewImages = overviewImages.filter((image) => areSameAcquisition(image, refImage));
        } else {
          filteredOverviewImages = overviewImages;
        }

        if (slideMetadataIndex === -1) {
          const slideMetadataItem = {
            acquisitionUID: refImage.AcquisitionUID,
            frameOfReferenceUID: refImage.FrameOfReferenceUID,
            containerIdentifier: refImage.ContainerIdentifier,
            volumeImages: filteredVolumeImages,
            labelImages: filteredLabelImages,
            overviewImages: filteredOverviewImages,
          };
          slideMetadata.push(slideMetadataItem);
        } else {
          const slideMetadataItem = slideMetadata[slideMetadataIndex];
          slideMetadataItem.volumeImages.push(...filteredVolumeImages);
          slideMetadataItem.labelImages.push(...filteredLabelImages);
          slideMetadataItem.overviewImages.push(...filteredOverviewImages);
        }
      }
    }
  });

  let slides = slideMetadata.map((item) => new Slide({
    images: [
      ...item.volumeImages,
      ...item.labelImages,
      ...item.overviewImages,
    ],
  }));
  slides = slides.sort((a, b) => {
    const imgA = a.volumeImages[0];
    const imgB = b.volumeImages[0];
    if (imgA.ContainerIdentifier != null && imgB.ContainerIdentifier != null) {
      return Number(imgA.ContainerIdentifier) - Number(imgB.ContainerIdentifier);
    }
    return 0;
  });

  return slides;
};

export const StorageClasses = {
  VL_WHOLE_SLIDE_MICROSCOPY_IMAGE: '1.2.840.10008.5.1.4.1.1.77.1.6',
  COMPREHENSIVE_SR: '1.2.840.10008.5.1.4.1.1.88.33',
  COMPREHENSIVE_3D_SR: '1.2.840.10008.5.1.4.1.1.88.34',
  SEGMENTATION: '1.2.840.10008.5.1.4.1.1.66.4',
  MICROSCOPY_BULK_SIMPLE_ANNOTATION: '1.2.840.10008.5.1.4.1.1.91.1',
  PARAMETRIC_MAP: '1.2.840.10008.5.1.4.1.1.30',
  ADVANCED_BLENDING_PRESENTATION_STATE: '1.2.840.10008.5.1.4.1.1.11.8',
  COLOR_SOFTCOPY_PRESENTATION_STATE: '1.2.840.10008.5.1.4.1.1.11.2',
  GRAYSCALE_SOFTCOPY_PRESENTATION_STATE: '1.2.840.10008.5.1.4.1.1.11.1',
  PSEUDOCOLOR_SOFTCOPY_PRESENTATION_STATE: '1.2.840.10008.5.1.4.1.1.11.3',
};
