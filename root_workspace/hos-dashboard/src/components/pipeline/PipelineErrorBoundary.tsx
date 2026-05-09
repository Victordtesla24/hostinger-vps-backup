import { Component, type ReactNode, type ErrorInfo } from 'react';
import { PipelineFallback2D } from './PipelineFallback2D';

interface State {
  hasError: boolean;
}

export class PipelineErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PipelineCanvas3D] WebGL/Three.js error — degrading to 2D view:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <PipelineFallback2D />;
    }
    return this.props.children;
  }
}
