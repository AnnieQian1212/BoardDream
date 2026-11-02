import { RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  /** Changes when the game on the table does, giving the new one a fresh start. */
  resetKey: string;
  /** Told when the table could not be drawn. */
  onError?(): void;
  /**
   * Shows what went wrong and a button to draw the table again. Left off where the page shows
   * something else instead, like the design sheet while a draft is checked.
   */
  fallback?: boolean;
  children: ReactNode;
}

interface State {
  failedFor?: string;
  error?: string;
}

/**
 * Keeps a bug in drawing the table off the rest of the page: rules still being written and checked
 * can throw while the table draws them, and so can a layout the window's size has not settled yet.
 * The page is told, and the table either steps aside or says so and offers to try again.
 */
export class TableGuard extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return { failedFor: "pending", error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(): void {
    this.setState({ failedFor: this.props.resetKey });
    this.props.onError?.();
  }

  render() {
    const failed = this.state.failedFor === "pending" || this.state.failedFor === this.props.resetKey;
    if (!failed) return this.props.children;
    if (!this.props.fallback) return null;
    return (
      <div className="table-fallback" role="alert">
        <div className="table-fallback-card">
          <h3>The table did not draw</h3>
          <p>Something went wrong laying out this game. The game itself is fine: draw the table again to carry on.</p>
          <button type="button" className="action" onClick={() => this.setState({ failedFor: undefined, error: undefined })}>
            <RotateCcw size={15} /> Try again
          </button>
          {this.state.error && <p className="table-fallback-detail">{this.state.error}</p>}
        </div>
      </div>
    );
  }
}
