/// <reference types="vite/client" />

interface ImgAttr<T> extends React.ImgHTMLAttributes<T> {
  loading: 'auto' | 'lazy' | 'eager';
}
