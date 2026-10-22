import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Страховка на случай ошибки в разделе: один битый объект не должен
 * оставлять пустой весь экран. Данные остаются в IndexedDB, поэтому
 * достаточно повторить попытку или перезагрузить приложение.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Раздел не открылся', error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="mx-auto w-full max-w-lg rounded-lg border border-border/70 bg-card p-6 text-center shadow-card"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
          <AlertTriangle className="h-6 w-6 text-danger-ink" aria-hidden />
        </span>
        <h2 className="mt-3 text-lg font-semibold">Раздел не открылся</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Данные не потеряны — они остались в хранилище. Попробуйте открыть раздел ещё раз.
        </p>
        <pre className="mt-3 max-h-24 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-left text-xs text-muted-foreground">
          {this.state.error.message}
        </pre>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={this.retry}>
            Попробовать снова
          </Button>
          <Button variant="gradient" onClick={() => window.location.reload()}>
            Перезагрузить
          </Button>
        </div>
      </div>
    );
  }
}
