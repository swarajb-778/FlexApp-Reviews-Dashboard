declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: { startTime?: number };
    __retryCount?: number;
    __tokenRefreshed?: boolean;
  }
  
  interface InternalAxiosRequestConfig {
    metadata?: { startTime?: number };
    __retryCount?: number;
    __tokenRefreshed?: boolean;
  }
}
