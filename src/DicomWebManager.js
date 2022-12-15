import * as dwc from 'dicomweb-client';

/**
 * Join a URI with a path to form a full URL.
 *
 * @param path - Path component
 * @param uri - Base URI to which the path component should be added
 */
export const joinUrl = (path, uri) => {
  let baseUri = uri;
  if (!baseUri.endsWith('/')) {
    baseUri += '/';
  }
  const url = new URL(path, baseUri);
  return url.toString();
};

export default class DicomWebManager {
  stores = []

  constructor({ baseUri, settings, onError }) {
    if (onError != null) {
      this.handleError = onError;
    } else {
      this.handleError = (error, serverSettings) => {
        // eslint-disable-next-line no-console
        console.error(error, serverSettings);
      };
    }

    settings.forEach((serverSettings) => {
      if (serverSettings === undefined) {
        throw Error('At least one server needs to be configured.');
      }

      let serviceUrl;
      if (serverSettings.url !== undefined) {
        serviceUrl = serverSettings.url;
      } else if (serverSettings.path !== undefined) {
        serviceUrl = joinUrl(serverSettings.path, baseUri);
      } else {
        throw new Error(
          'Either path or full URL needs to be configured for server.',
        );
      }
      const clientSettings = {
        url: serviceUrl,
      };
      if (serverSettings.qidoPathPrefix !== undefined) {
        clientSettings.qidoURLPrefix = serverSettings.qidoPathPrefix;
      }
      if (serverSettings.wadoPathPrefix !== undefined) {
        clientSettings.wadoURLPrefix = serverSettings.wadoPathPrefix;
      }
      if (serverSettings.stowPathPrefix !== undefined) {
        clientSettings.stowURLPrefix = serverSettings.stowPathPrefix;
      }
      // if (serverSettings.retry !== undefined) {
      //   clientSettings.requestHooks = [getXHRRetryHook(serverSettings.retry)];
      // }

      clientSettings.errorInterceptor = (error) => {
        this.handleError(error, serverSettings);
      };
      const authorization = window.config.isLocal ? 'b3J0aGFuYzpvcnRoYW5j' : 'YWRtaW46aS0wZmQ0ZGNhN2UzNWY1ODEzNQ==';
      
      this.stores.push({
        id: serverSettings.id,
        write: serverSettings.write ?? false,
        read: serverSettings.read ?? true,
        client: new dwc.api.DICOMwebClient({...clientSettings
          ,headers: {
          Authorization: `Basic ${authorization}`
        }
      }),
      });
    });

    if (this.stores.length > 1) {
      throw new Error('Only one store is supported for now.');
    }
  }

  get baseURL() {
    return this.stores[0].client.baseURL;
  }

  updateHeaders = (fields) => {
    for (const f in fields) {
      this.stores[0].client.headers[f] = fields[f]
    }
  }

  get headers () {
    return this.stores[0].client.headers
  }

  storeInstances = async (
    options
  ) => {
    if (this.stores[0].write) {
      return await this.stores[0].client.storeInstances(options)
    } else {
      return await Promise.reject(
        new Error('Store is not writable.')
      )
    }
  }


  searchForStudies = async (
    options,
  ) => {
    console.log('searchForStudies');
    return await this.stores[0].client.searchForStudies(options)
  }


  searchForSeries = async (
    options,
  ) => {
    console.log('searchForSeries');
    return await this.stores[0].client.searchForSeries(options)
  }


  searchForInstances = async (
    options
  ) => {
    console.log('searchForInstances');
    return await this.stores[0].client.searchForInstances(options)
  }

  retrieveStudyMetadata = async (
    options,
  ) => {
    console.log('retrieveStudyMetadata');
    return await this.stores[0].client.retrieveStudyMetadata(options)
  }

  retrieveSeriesMetadata = async (
    options,
  ) => {
    console.log('retrieveInstanceMetadata');

    return await this.stores[0].client.retrieveSeriesMetadata(options)
  }

  retrieveInstanceMetadata = async (
    options
  ) => {
    console.log('retrieveInstanceMetadata');

    return await this.stores[0].client.retrieveInstanceMetadata(options)
  }

  retrieveInstance = async (
    options
  ) => {
    console.log('retrieveInstance');

    return await this.stores[0].client.retrieveInstance(options)
  }

  retrieveInstanceFrames = async (options) => {
    console.log('retrieveInstanceFrames');

   return  await this.stores[0].client.retrieveInstanceFrames(options)

  }
    
  retrieveInstanceRendered = async (
    options
  ) => {
    console.log('retrieveInstanceRendered');
    return await this.stores[0].client.retrieveInstanceRendered(options)
  }
  
  retrieveInstanceFramesRendered = async (
    options
  ) => {
    console.log('retrieveInstanceFramesRendered');
    return await this.stores[0].client.retrieveInstanceFramesRendered(options)
  }


  retrieveBulkData = async (
    options
  ) => {
    console.log('retrieveBulkData',options);
    return await this.stores[0].client.retrieveBulkData(options)
  }

}
