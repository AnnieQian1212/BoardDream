import { Component, type ReactNode } from "react";

interface Props {
  /** Changes when the game on the table does, giving the new one a fresh start. */
  resetKey: string;
  children: ReactNode;
}

/**
 * Keeps a draft's bug off the rest of the page: rules still being written and checked can throw
 * while the table draws them. The table then shows nothing until the next draft or game.
 */
export class TableGuard extends Component<Props, { failedFor?: string }> {
  state: { failedFor?: string } = {};

  static getDerivedStateFromError(): { failedFor: string } {
    return { failedFor: "pending" };
  }

  componentDidCatch(): void {
    this.setState({ failedFor: this.props.resetKey });
  }

  render() {
    const failed = this.state.failedFor === "pending" || this.state.failedFor === this.props.resetKey;
    return failed ? null : this.props.children;
  }
}
