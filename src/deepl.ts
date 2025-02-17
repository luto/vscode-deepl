import axios from 'axios';
import { state } from './state';
import { Language, LanguageType, Translation } from './types';

/* eslint-disable */
export enum DeepLErrorCodes {
  AUTHORIZATION_FAILED = 403,
  REQUEST_SIZE_EXCEEDED = 413,
  CHARACTER_LIMIT_REACHED = 456,
  TOO_MANY_REQUEST_4XX = 429,
  TOO_MANY_REQUEST_5XX = 529,
  INTERNAL_SERVER_ERROR = 500,
}
/* eslint-enable */

export class DeepLException extends Error {
  public readonly code: DeepLErrorCodes;

  constructor(code: DeepLErrorCodes) {
    super();
    this.code = code;
  }

  public static createFromStatusCode(code: number) {
    var exception = new DeepLException(code);
    exception.name = DeepLException.name;
    switch (code) {
      case DeepLErrorCodes.AUTHORIZATION_FAILED:
        exception.message = "Authentication failed. Please check your DeepL API key. You may be using the DeepL Pro API by mistake.";
        break;
    
      case DeepLErrorCodes.REQUEST_SIZE_EXCEEDED:
        exception.message = "Please try again with a shorter text";
        break;
  
      case DeepLErrorCodes.TOO_MANY_REQUEST_4XX:
      case DeepLErrorCodes.TOO_MANY_REQUEST_5XX:
        exception.message = "You have done too many translations recently. Please try again later.";
        break;
  
      case DeepLErrorCodes.CHARACTER_LIMIT_REACHED:
        exception.message = "You have reached the maximum character limit. You can see your usage [here](https://www.deepl.com/pro-account/usage)";
        break;
      
      default:
        exception.message = "Unfortunately, the DeepL API cannot accept any requests at the moment. Please try again later."
        break;
    }
    return exception;
  }
}

type ErrorHandler = (e: DeepLException) => void;

const http = axios.create();
const errorHandlers: ErrorHandler[] = [];

http.interceptors.request.use((config) => {
  config.baseURL = state.usePro
    ? 'https://api.deepl.com'
    : 'https://api-free.deepl.com';

  if (!config.params) {
    config.params = {};
  }
  config.params.auth_key = state.apiKey;
  return config;
});

http.interceptors.response.use( 
  res => res,
  e => {
    if (!e.response) {
      throw e;
    }

    const exception = DeepLException.createFromStatusCode(e.response.status);
    for (const handler of errorHandlers) {
      handler(exception);
    }
    throw exception;
  }
);

export async function translate(text: string, targetLanguage: string, sourceLanguage?: string): Promise<Translation[]> {
  const response = await http.post('/v2/translate', null, {
    /* eslint-disable */
    params: {
      text: text,
      target_lang: targetLanguage,
      source_lang: sourceLanguage
    }
    /* eslint-enable */
  });

  return response.data.translations as Translation[];
} 

export async function languages(type: LanguageType = 'source'): Promise<Language[]> {
  if (state.languages[type].length === 0) {
    const response = await http.get('/v2/languages', { params: { type } });
    state.languages[type] = response.data as Language[];  
  }

  return state.languages[type];
}

export const addErrorHandler = (handler: ErrorHandler) => errorHandlers.push(handler);