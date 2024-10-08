import {
  GetSeriesFunc,
  GetChaptersFunc,
  GetPageRequesterDataFunc,
  GetPageUrlsFunc,
  GetSearchFunc,
  GetImageFunc,
  PageRequesterData,
  GetDirectoryFunc,
  Chapter,
  LanguageKey,
  Series,
  SeriesStatus,
  ExtensionClientAbstract,
  GetSettingsFunc,
  SetSettingsFunc,
  GetSettingTypesFunc,
  SettingType,
  FilterValues,
  FilterCheckbox,
  FilterMultiToggle,
  FilterSeparator,
  FilterSort,
  SortDirection,
  TriState,
  MultiToggleValues,
  FilterSortValue,
  FilterCycle,
  ExternalClient,
  WebviewResponse,
  ConvertExternalDataFunc,
  SeriesListResponse,
  GetExternalExtensionsFunc,
  GetFilterOptionsFunc,
  WebviewFunc,
} from '@tiyo/common';
import { JSDOM } from 'jsdom';
import { METADATA } from './metadata';

export * from './metadata';

import { appendFileSync } from 'fs';

const logToFile = (message: string, object?: any) => {
  const timestamp = new Date().toISOString();
  if (object) {
    // If the object is a document, log its HTML content
    if (object instanceof Document) {
      appendFileSync('C:\\Users\\GrayCat\\Downloads\\extension_client.log', `${timestamp} - ${message}: ${object.documentElement.outerHTML}\n`);
    } else {
      appendFileSync('C:\\Users\\GrayCat\\Downloads\\extension_client.log', `${timestamp} - ${message}: ${JSON.stringify(object, null, 2)}\n`);
    }
  } else {
    appendFileSync('C:\\Users\\GrayCat\\Downloads\\extension_client.log', `${timestamp} - ${message}\n`);
  }
};

const BASE_URL = 'https://cubari.moe';
const PAGE_SIZE = 48;

const parseDirectoryResponse = async (doc: Document): Promise<SeriesListResponse> => {
  const pageContent = doc.querySelector("div.series-content");
  const article = pageContent.getElementsByTagName("article")[0];

  const sourceId = article.querySelector("a.manga-link.external").getAttribute("href");

  const response = await fetch(sourceId);
  const json = await response.json();

  const parsedJson = parseJson(json, sourceId);
  
  const hasMore = false;

  return {
    seriesList: [parsedJson],
    hasMore,
  };
};



const _parseChapterSources = (json: any, chapterSourceId: string) => {
  const chapters = json.chapters;
  const chapter = chapters[chapterSourceId];
  const groups = chapter.groups;
  const group = groups[Object.keys(groups)[0]];

  const pageFilenames = group.map((filePath) => {
    if ((!filePath.startsWith('http://') && !filePath.startsWith('https://')) || !filePath.includes(".")) {
      return BASE_URL + filePath;
    }
    return filePath;
  });

  return {
    server: "", // can ignore
    hash: "", // can ignore
    numPages: pageFilenames.length,
    pageFilenames,
  };
};

const parseJson = (json: any, sourceId: string) => {
  const series: Series = {
    id: undefined,
    extensionId: METADATA.id,
    sourceId: sourceId,
    title: json.title,
    altTitles: [],
    description: json.description,
    authors: json?.author && json.author.trim() !== "" ? [json.author] : ["Unknown Author"],
    artists: json?.artist && json.artist.trim() !== "" ? [json.artist] : ["Unknown artist"],
    tags: [],
    status: SeriesStatus.ONGOING,
    originalLanguageKey: LanguageKey.MULTI,
    numberUnread: 0,
    remoteCoverUrl: json.cover,
  };

  return series;
};

const SERIES_STATUS_MAP: { [key: string]: SeriesStatus } = {
  ongoing: SeriesStatus.ONGOING,
  completed: SeriesStatus.COMPLETED,
  hiatus: SeriesStatus.ONGOING,
  cancelled: SeriesStatus.CANCELLED,
};


export class CubariExtensionClient extends ExtensionClientAbstract {
  constructor(webviewFn: WebviewFunc) {
    super(webviewFn);
  }

  override getSeries: GetSeriesFunc = (id: string): Promise<Series> => {
    return fetch(
      id
    )
    .then((response: Response) => response.json())
    .then((json: any) => {
      return parseJson(json , id);
    });
  };
  
  // works fine
  override getChapters: GetChaptersFunc = async (id: string) => {
    const reponse = await fetch(id);
    const json = await reponse.json();

    const chapters = json.chapters;
    const chapterList: Chapter[] = [];
    Object.keys(chapters).forEach((chapterKey) => {
      const chapter = chapters[chapterKey];
  
      const title = chapter.title;
      const volume = chapter.volume;
      const lastUpdated = chapter.last_updated;
 
      const groupName = Object.keys(chapter.groups)[0];
      chapterList.push({
       id: undefined,
       seriesId: undefined,
       sourceId: chapterKey,
       title: title,
       chapterNumber: chapterKey,
       volumeNumber: volume,
       languageKey: LanguageKey.MULTI,
       groupName,
       time: new Date(parseInt(lastUpdated, 10) * 1000).getTime(),
       read: false,
     });
    });

    return chapterList;
  };


  override getPageRequesterData: GetPageRequesterDataFunc = (
    seriesSourceId: string,
    chapterSourceId: string
  ) => {
    return fetch(
      seriesSourceId
    )
      .then((response: Response) => response.json())
      .then((json: any) => {
        return _parseChapterSources(json , chapterSourceId);
      });
  };

  override getPageUrls: GetPageUrlsFunc = (pageRequesterData: PageRequesterData) => {
    return pageRequesterData.pageFilenames;
  };

  override getImage: GetImageFunc = (series: Series, url: string) => {
    return new Promise((resolve) => {
      resolve(url);
    });
  };

  override getDirectory: GetDirectoryFunc = (page: number, filterValues: FilterValues) => {
    return Promise.resolve({
      seriesList: [],
      hasMore: false,
    });
  };

  override getSearch: GetSearchFunc = (text: string, page: number, filterValues: FilterValues) => {
    logToFile(`getSearch called with text: ${text}, page: ${page}`);
    logToFile( `Acessing url: ${BASE_URL}/read/gist/${text}/`)

    return this.webviewFn(`${BASE_URL}/read/gist/${text}/`).then((response: WebviewResponse) => {
      const doc = new JSDOM(response.text).window.document;

      return parseDirectoryResponse(doc);
    });
  };
  
  override getSettingTypes: GetSettingTypesFunc = () => {
    return {};
  };

  override getSettings: GetSettingsFunc = () => {
    return {};
  };

  override setSettings: SetSettingsFunc = (newSettings: { [key: string]: any }) => {};

  override getFilterOptions: GetFilterOptionsFunc = () => [];
}
