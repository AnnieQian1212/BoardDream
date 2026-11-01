import { Component, type ReactNode } from "react";

interface Props {
  /** Changes when the game on the table does, giving the new one a fresh start. */
  resetKey: string;
  /** Told when the table could not be drawn. */
  onError?(): void;
  children: ReactNode;
}

/**
 * Keeps a draft's bug off the rest of the page: rules still being written and checked can throw
 * while the table draws them. The table then shows nothing until the next draft or game, and the
 * page is told, so it can show something else instead.
 */
export class TableGuard extends Component<Props, { failedFor?: string }> {
  state: { failedFor?: string } = {};

  static getDerivedStateFromError(): { failedFor: string } {
    return { failedFor: "pending" };
  }

  componentDidCatch(): void {
    this.setState({ failedFor: this.props.resetKey });
    this.props.onError?.();
  }

  render() {
    const failed = this.state.failedFor === "pending" || this.state.failedFor === this.props.resetKey;
    return failed ? null : this.props.children;
  }
}
