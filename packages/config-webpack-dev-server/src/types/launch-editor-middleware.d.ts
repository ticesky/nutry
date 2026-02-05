declare module 'launch-editor-middleware' {
  import type { RequestHandler } from 'express';

  interface LaunchEditorOptions {
    /**
     * 默认使用的编辑器
     * e.g. 'code', 'webstorm', 'vim'
     */
    editor?: string;

    /**
     * 当前项目的工作目录
     */
    cwd?: string;

    /**
     * 打开文件失败时的回调
     */
    onError?: (error: Error) => void;
  }

  /**
   * Create an express middleware that opens files in editor
   */
  export default function launchEditorMiddleware(
    options?: LaunchEditorOptions
  ): RequestHandler;
}
